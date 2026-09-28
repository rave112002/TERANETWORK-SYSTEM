import { normalizeMac } from "./reconcile.helpers.js";
import { reconcile } from "./reconcile.js";
import { resolveDriver } from "../olt-drivers/index.js";
import { decryptCredentials } from "../crypto/credentialCrypto.js";
import { writeAudit } from "../../utils/audit.js";
import { getCurrentTimestampLocal } from "../../utils/dateUtils.js";
import { logger } from "../../../config/logger.js";
import APIError from "../../utils/APIError.js";

/**
 * Running a discovery sweep, and importing what it found.
 *
 * ── Read-only until a person says otherwise ─────────────────────────────────
 *
 * A sweep talks to the OLT, compares what it reports against our records, and
 * writes the comparison to `discovered_items`. It does not create a customer,
 * an ONU, or a subscription. Nothing it stages is live.
 *
 * Importing is the separate, deliberate, audited step — one item at a time,
 * with staff-confirmed values. That split exists because a sweep of a
 * four-hundred-modem OLT would otherwise create four hundred inventory records
 * from free text typed by whoever installed them, and unpicking that is worse
 * than typing them.
 *
 * ── Scope: OLT only ─────────────────────────────────────────────────────────
 *
 * The reconciler accepts MikroTik accounts and sessions, and nothing produces
 * them. There is no RouterOS client (M22), and the router's address and
 * credentials are still an open question (P4). Sweeping only the OLT is the
 * honest half; the shape is settled so adding the router later does not mean
 * rewriting this.
 */

/**
 * Read every ONU the OLT can see.
 *
 * Sweeps each PON port registered in the DB for this OLT so that drivers
 * (like HSGQ) that require a `ponPortIndex` per call get one. Results from
 * all ports are merged into a single ONU list. The `command` and
 * `rawResponse` fields aggregate all port sweeps for the run log.
 *
 * @param {Object} db
 * @param {Object} olt an `olts` row including `credentialsEnc`.
 * @returns {Promise<{onus: Array, command: string|null, rawResponse: string|null}>}
 */
const readOltOnus = async (db, olt) => {
  const driver = resolveDriver({ vendor: olt.vendor });
  const credentials = olt.credentialsEnc ? decryptCredentials(olt.credentialsEnc) : undefined;

  // Fetch every PON port registered for this OLT. The portIndex value
  // ("1", "2", "0/1/3", etc.) is what the driver passes to the device.
  const ponPorts = await db.query(
    `SELECT portIndex FROM pon_ports
      WHERE oltId = ? AND status != 'Deleted'
      ORDER BY portIndex`,
    [olt.oltId]
  );

  if (ponPorts.length === 0) {
    throw new APIError(
      "This OLT has no PON ports registered — add at least one under Network → PON Ports before running discovery",
      422,
      "NO_PON_PORTS"
    );
  }

  const allOnus = [];
  const allCommands = [];
  const allResponses = [];

  for (const { portIndex } of ponPorts) {
    // eslint-disable-next-line no-await-in-loop
    const result = await driver.listOnus({
      host: olt.host,
      port: olt.port,
      protocol: olt.protocol,
      credentials,
      ponPortIndex: portIndex,
    });

    if (!result.success) {
      // Surfaced rather than swallowed. A sweep that could not reach the device
      // and a sweep that found nothing produce the same empty list and mean
      // opposite things.
      throw new APIError(
        result.error || `The OLT did not answer the discovery command for PON ${portIndex}`,
        502,
        "DEVICE_ERROR"
      );
    }

    if (Array.isArray(result.parsed)) allOnus.push(...result.parsed);
    if (result.command) allCommands.push(result.command);
    if (result.rawResponse) allResponses.push(result.rawResponse);
  }

  return {
    onus: allOnus,
    command: allCommands.join("\n---\n") || null,
    rawResponse: allResponses.join("\n---\n") || null,
  };
};

/**
 * Run one sweep of one OLT and stage the result.
 *
 * The run row is written first, in `running`, and stamped `completed` or
 * `failed` afterwards. A crash therefore leaves a visible unfinished run rather
 * than no evidence that anything was attempted.
 *
 * @param {Object} db
 * @param {Object} args
 * @param {Object} args.olt the OLT row to sweep, already scoped by the caller.
 * @param {Object} args.context audit context.
 * @param {string} [args.triggeredBy]
 * @returns {Promise<{discoveryRunId: string, summary: Object, itemCount: number}>}
 */
export const runDiscovery = async (db, { olt, context, triggeredBy = "user" }) => {
  const startedAt = getCurrentTimestampLocal();
  const startedMs = Date.now();

  const [uuidRow] = await db.query(`SELECT UUID() AS id`);
  const discoveryRunId = uuidRow.id;

  await db.query(
    `INSERT INTO discovery_runs
       (discoveryRunId, companyId, branchId, oltId, status, triggeredBy,
        startedAt, dateCreated, dateUpdated)
     VALUES (?, ?, ?, ?, 'running', ?, ?, ?, ?)`,
    [
      discoveryRunId,
      olt.companyId,
      olt.branchId,
      olt.oltId,
      triggeredBy,
      startedAt,
      startedAt,
      startedAt,
    ]
  );

  try {
    const device = await readOltOnus(db, olt);

    // Our side. Scoped to this OLT's branch: a sweep of the Bicutan OLT must
    // not report Bagumbayan's modems as orphaned just because this device
    // cannot see them.
    const [existingOnus, existingSubs] = await Promise.all([
      db.query(
        `SELECT onuId, mac, serialNo FROM onus
          WHERE companyId = ? AND branchId = ? AND recordStatus != 'Deleted'
            AND (oltId = ? OR oltId IS NULL)`,
        [olt.companyId, olt.branchId, olt.oltId]
      ),
      db.query(
        `SELECT subscriptionId, onuId FROM subscriptions
          WHERE companyId = ? AND branchId = ? AND recordStatus != 'Deleted'
            AND onuId IS NOT NULL`,
        [olt.companyId, olt.branchId]
      ),
    ]);

    const { items, summary } = reconcile({
      oltOnus: device.onus,
      existing: { onus: existingOnus, subscriptions: existingSubs },
    });

    const now = getCurrentTimestampLocal();

    // Staged in one transaction with the run's own completion, so a run never
    // reports counts its items do not back up.
    let conn;
    try {
      conn = await db.beginTransaction();

      for (const item of items) {
        // eslint-disable-next-line no-await-in-loop
        const [itemUuid] = await conn.execute(`SELECT UUID() AS id`);
        // eslint-disable-next-line no-await-in-loop
        await conn.execute(
          `INSERT INTO discovered_items
             (discoveredItemId, discoveryRunId, companyId, branchId, source,
              externalKey, matchStatus, matchedEntity, matchedId, raw, suggested,
              dateCreated)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemUuid[0].id,
            discoveryRunId,
            olt.companyId,
            olt.branchId,
            item.source,
            item.externalKey,
            item.matchStatus,
            item.matchedEntity,
            item.matchedId,
            JSON.stringify(item.raw ?? {}),
            item.suggested ? JSON.stringify(item.suggested) : null,
            now,
          ]
        );
      }

      await conn.execute(
        `UPDATE discovery_runs
            SET status = 'completed', matchedCount = ?, newCount = ?, orphanedCount = ?,
                command = ?, deviceResponse = ?, durationMs = ?, finishedAt = ?, dateUpdated = ?
          WHERE discoveryRunId = ?`,
        [
          summary.matched,
          summary.new,
          summary.orphaned,
          device.command,
          device.rawResponse,
          Date.now() - startedMs,
          now,
          now,
          discoveryRunId,
        ]
      );

      await writeAudit(conn, {
        context,
        module: "network",
        action: "discovery_run",
        description: `Swept ${olt.name} — ${summary.new} new, ${summary.matched} matched, ${summary.orphaned} orphaned`,
        after: { discoveryRunId, oltId: olt.oltId, ...summary },
      });

      await db.commit(conn);
    } catch (err) {
      if (conn) await db.rollback(conn);
      throw err;
    }

    logger.info(
      `[discovery] ${olt.name}: ${summary.new} new, ${summary.matched} matched, ` +
        `${summary.orphaned} orphaned`
    );

    return { discoveryRunId, summary, itemCount: items.length };
  } catch (err) {
    const now = getCurrentTimestampLocal();
    await db.query(
      `UPDATE discovery_runs
          SET status = 'failed', error = ?, durationMs = ?, finishedAt = ?, dateUpdated = ?
        WHERE discoveryRunId = ?`,
      [String(err.message).slice(0, 2000), Date.now() - startedMs, now, now, discoveryRunId]
    );

    logger.error(`🚨 [discovery] sweep of ${olt.name} failed: ${err.message}`);
    throw err;
  }
};

/**
 * Turn one staged `new` item into a real ONU.
 *
 * ── Why overrides win over what the device said ─────────────────────────────
 *
 * Everything parsed out of an ONU description is a guess at what a technician
 * meant years ago. `overrides` carries what a person actually confirmed on the
 * form, and it takes precedence over every discovered value. The suggestion
 * saves typing; it does not decide anything.
 *
 * @param {Object} db
 * @param {Object} args
 * @param {Object} args.item the staged row, with its run's `oltId`.
 * @param {Object} args.overrides staff-confirmed values.
 * @param {Object} args.context audit context.
 * @param {string} args.accountId who imported it.
 * @returns {Promise<{onuId: string, status: 'imported'}>}
 */
export const importDiscoveredItem = async (db, { item, overrides, context, accountId }) => {
  if (item.matchStatus !== "new") {
    throw new APIError(
      item.importedAt
        ? "This item has already been imported"
        : `Only new items can be imported — this one is '${item.matchStatus}'`,
      409,
      "INVALID_STATE"
    );
  }

  const raw = typeof item.raw === "string" ? JSON.parse(item.raw) : (item.raw ?? {});

  const mac = normalizeMac(overrides.mac ?? raw.mac) ?? null;
  const serialNo = overrides.serialNo ?? raw.serialNo ?? null;

  // The same rule the ONU validator enforces: on EPON the MAC is the identity,
  // on GPON the serial. A record with neither cannot be matched to a device at
  // all, so it is not inventory — it is a note.
  if (!mac && !serialNo) {
    throw new APIError(
      "This item has neither a MAC nor a serial number — provide one to import it",
      400,
      "VALIDATION_FAILED"
    );
  }

  let conn;
  try {
    conn = await db.beginTransaction();

    const [uuidRow] = await conn.execute(`SELECT UUID() AS id`);
    const onuId = uuidRow[0].id;
    const now = getCurrentTimestampLocal();

    // Derived from what the sweep actually saw, and NOT overridable. A modem the
    // OLT reported online is already carrying service, so it is 'active';
    // anything else is 'unprovisioned'. Letting the import form assert this
    // would let somebody record a device as up when nothing confirmed it — and
    // the dunning sweep reads this column to decide who is already disconnected.
    const provisioningState = raw.online ? "active" : "unprovisioned";

    await conn.execute(
      `INSERT INTO onus
         (onuId, companyId, branchId, oltId, ponPortId, napId, napPort,
          serialNo, mac, model, onuIndex, description, provisioningState,
          recordStatus, dateCreated, dateUpdated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`,
      [
        onuId,
        item.companyId,
        item.branchId,
        overrides.oltId ?? item.runOltId,
        overrides.ponPortId ?? null,
        overrides.napId ?? null,
        overrides.napPort ?? null,
        serialNo,
        mac,
        overrides.model ?? raw.model ?? null,
        overrides.onuIndex ?? raw.onuIndex ?? null,
        // The original free text is kept verbatim. The parsed hints are a
        // reading of it, and the reading can be wrong.
        overrides.description ?? raw.description ?? null,
        provisioningState,
        now,
        now,
      ]
    );

    // Stamped matched, not deleted: the staged row is the record of where this
    // ONU came from, and re-running the sweep should now find it as matched.
    await conn.execute(
      `UPDATE discovered_items
          SET importedAt = ?, importedBy = ?, matchStatus = 'matched',
              matchedEntity = 'onu', matchedId = ?
        WHERE discoveredItemId = ?`,
      [now, accountId, onuId, item.discoveredItemId]
    );

    await writeAudit(conn, {
      context,
      module: "network",
      action: "discovery_import",
      description: `Imported ${mac ?? serialNo} from discovery`,
      after: { onuId, mac, serialNo, provisioningState, discoveredItemId: item.discoveredItemId },
    });

    await db.commit(conn);

    logger.info(`[discovery] imported ${mac ?? serialNo} as ONU ${onuId}`);
    return { onuId, status: "imported" };
  } catch (err) {
    if (conn) await db.rollback(conn);

    if (err?.code === "ER_DUP_ENTRY") {
      // Two staff importing the same item at once, or a modem added by hand
      // between the sweep and the import.
      throw new APIError(
        "An ONU with this MAC or serial number already exists",
        409,
        "DUPLICATE_ENTRY"
      );
    }
    throw err;
  }
};

export default { runDiscovery, importDiscoveredItem };
