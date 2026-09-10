import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import { decryptCredentials } from "../../crypto/credentialCrypto.js";
import { resolveDriver } from "../../olt-drivers/index.js";
import { isDryRun } from "../../settings/settings.service.js";
import { isStillEligibleForDisconnect } from "../../dunning/dunning.service.js";

/**
 * The provisioning processor — where a device response becomes database state.
 *
 * This is the most consequential function in the system: it is what actually
 * takes a paying customer's internet away, and gives it back.
 *
 * ── The invariant, stated once ──────────────────────────────────────────────
 *
 *   The database is only ever updated AFTER the device confirms the command,
 *   and the state write and its action-log row happen in the SAME transaction.
 *
 * So there is no path that marks someone suspended without a matching
 * successful device command, and none that logs a command whose state write
 * rolled back. A failure leaves everything exactly as it was — "nothing
 * happened", never "half happened" — and the queue retries.
 *
 * ── The four gates before anything is sent ──────────────────────────────────
 *
 *   1. The ONU still exists and is in scope.
 *   2. It is not already in the state we are heading for (idempotency).
 *   3. The precondition still holds — a payment may have landed while this job
 *      sat in the queue, which is the whole race the dunning engine has to win.
 *   4. Dry-run is off. If it is on, the intended command is logged and nothing
 *      is sent.
 */

/** Where each action is trying to get the ONU to. */
const TARGET_STATE = {
  deactivate: "suspended",
  activate: "active",
};

/**
 * Where this particular job is trying to get the ONU to.
 *
 * ── The one case where an activate does not mean "back in service" ──────────
 *
 * On this OLT, activating is literally `blacklist delete mac` — it lifts the
 * block and lets the unit register again. A modem recovered from a closed
 * account needs exactly that command, because a unit left blacklisted is a
 * brick when a technician seats it for the next customer months later.
 *
 * But it is not going back into service, it is going into a box. Recording it
 * as 'active' would put a modem nobody is using into the "modems up" figure on
 * the dashboard and hide a real outage behind it.
 *
 * Exported so that distinction is pinned by a test rather than left to whoever
 * next simplifies this back into a lookup table.
 */
export const targetStateFor = (action, reason) =>
  action === "activate" && reason === "recovery"
    ? "unprovisioned"
    : (TARGET_STATE[action] ?? null);

/**
 * Load everything the driver needs: the ONU, its OLT, and the decrypted login.
 *
 * @returns {Promise<Object|null>} null when the ONU is gone — a deleted modem
 *   is not an error worth retrying, it is work that no longer applies.
 */
const loadContext = async (db, onuId) => {
  const [row] = await db.query(
    `SELECT u.onuId, u.companyId, u.branchId, u.mac, u.serialNo, u.onuIndex,
            u.provisioningState, u.recordStatus,
            o.oltId, o.name AS oltName, o.vendor, o.host, o.port, o.protocol,
            o.credentialsEnc, o.status AS oltStatus,
            p.portIndex AS ponPortIndex
     FROM onus u
     LEFT JOIN olts o ON o.oltId = u.oltId
     LEFT JOIN pon_ports p ON p.ponPortId = u.ponPortId
     WHERE u.onuId = ? LIMIT 1`,
    [onuId]
  );

  if (!row || row.recordStatus === "Deleted") return null;
  return row;
};

/**
 * Has a payment, or a staff decision, made this disconnect unnecessary while it
 * waited in the queue?
 *
 * ── The last line of defence, and the one that matters ──────────────────────
 *
 * The payment path already cancels queued disconnects when an invoice settles.
 * That is not enough on its own, because cancellation cannot touch a job the
 * worker has already claimed:
 *
 *   20:00:00  the sweep queues a disconnect
 *   20:00:05  the worker claims it — status is now 'processing'
 *   20:00:30  the customer pays; the cancel finds nothing to cancel
 *   20:01:00  the worker reaches the device
 *
 * Everything between claiming the job and sending the command is unprotected
 * except by this function. It runs as late as possible, immediately before the
 * device call, and it is the reason a customer who pays at 20:00:30 does not
 * lose their connection at 20:01.
 *
 * ── Why 'dunning' and 'manual' are checked differently ──────────────────────
 *
 * A dunning disconnect is only justified while the debt stands, so it re-asks
 * the sweep's own question — through the sweep's own code, not a copy of it.
 * A staff member suspending a line by hand has a reason the system does not
 * know about (abuse, a move-out, a request from the customer), so requiring an
 * overdue invoice would make the button silently refuse to work.
 *
 * @returns {Promise<string|null>} a reason to skip, or null to proceed
 */
const preconditionFailure = async (db, { action, onu, reason }) => {
  // A recovery activate is deliberate housekeeping on an unbound modem — there
  // is no subscription left to ask about, and asking would refuse it.
  if (action === "activate" && reason === "recovery") return null;

  if (action === "status") return null;

  const [subscription] = await db.query(
    `SELECT subscriptionId, status FROM subscriptions
     WHERE onuId = ? AND recordStatus != 'Deleted' LIMIT 1`,
    [onu.onuId]
  );

  if (action === "activate") {
    // Restoring service to a revoked account would hand the internet back to
    // somebody the business has written off and is trying to collect a modem
    // from. Refused here rather than trusted to the caller, because "Restore
    // service" is a button on the ONU screen and the person pressing it is
    // looking at a modem, not at a subscription.
    if (subscription?.status === "for_recovery") {
      return "the account is awaiting modem pull-out — restoring it needs a new subscription";
    }
    if (subscription?.status === "terminated") {
      return "the subscription has been terminated";
    }
    return null;
  }

  if (!subscription) {
    return "the ONU is no longer bound to a subscription";
  }

  if (subscription.status === "terminated") {
    return "the subscription has been terminated";
  }

  // The dunning sweep only ever queues disconnects for `active` subscriptions.
  // Anything else means the situation changed underneath this job.
  if (subscription.status !== "active") {
    return `the subscription is now '${subscription.status}'`;
  }

  // Only for disconnects the sweep raised. See the note above on why a manual
  // suspension is not held to the same test.
  if (reason === "dunning") {
    const stillOwing = await isStillEligibleForDisconnect(db, subscription.subscriptionId, {
      companyId: onu.companyId,
    });

    if (!stillOwing) {
      // Said as a fact about the customer rather than about the job, because
      // this line ends up in the device history somebody reads when asking
      // "why was I / was I not disconnected on the 5th?".
      return "the account is no longer overdue — it has been paid, or exempted";
    }
  }

  return null;
};

/**
 * Write the action to the black box. Always called — success, failure, skip and
 * dry-run alike — because "we tried and it failed" is exactly the record
 * someone will come looking for.
 */
const writeActionLog = async (conn, entry) => {
  const now = getCurrentTimestampLocal();
  const [uuidRow] = await conn.execute(`SELECT UUID() as id`);

  await conn.execute(
    `INSERT INTO network_action_logs
       (actionLogId, companyId, branchId, onuId, oltId, action, triggeredBy, jobId,
        command, deviceResponse, success, error, durationMs, dateCreated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidRow[0].id,
      entry.companyId,
      entry.branchId,
      entry.onuId,
      entry.oltId ?? null,
      entry.action,
      entry.triggeredBy,
      entry.jobId ?? null,
      entry.command ?? null,
      entry.deviceResponse ?? null,
      entry.success ? 1 : 0,
      entry.error ?? null,
      entry.durationMs ?? null,
      now,
    ]
  );

  return uuidRow[0].id;
};

/**
 * Run one provisioning job.
 *
 * Registered for the `deactivate`, `activate` and `status` job types.
 *
 * @param {Object} job - from the queue; `payload.onuId` and `payload.reason`
 * @param {{db: Object, logger: Object}} ctx
 * @returns {Promise<Object>} a summary stored on the job
 * @throws when the device fails — the queue then retries with backoff, and the
 *   database is left untouched
 */
export const provisioningProcessor = async (job, { db, logger }) => {
  const action = job.type;
  const { onuId, reason = "manual" } = job.payload ?? {};
  const triggeredBy = job.payload?.triggeredBy ?? `system:${reason}`;

  if (!onuId) {
    // Unfixable by retrying: fail it straight to the dead letter rather than
    // burning five attempts on a malformed job.
    throw new Error("Job payload has no onuId");
  }

  const onu = await loadContext(db, onuId);

  if (!onu) {
    logger.warn(`[provisioning] ONU ${onuId} no longer exists — skipping`, { jobId: job.jobId });
    return { skipped: true, reason: "the ONU no longer exists" };
  }

  // ── Gate 1: is there even a device to talk to? ─────────────────────
  if (!onu.oltId) {
    throw new Error(
      "This ONU is not attached to an OLT, so there is nothing to send a command to"
    );
  }

  // ── Gate 2: idempotency ───────────────────────────────────────────
  const target = targetStateFor(action, reason);
  if (target && onu.provisioningState === target) {
    logger.info(`[provisioning] ONU ${onuId} is already '${target}' — skipping`, {
      jobId: job.jobId,
    });
    return { skipped: true, reason: `already ${target}` };
  }

  // ── Gate 3: does the work still need doing? ───────────────────────
  const stale = await preconditionFailure(db, { action, onu, reason });
  if (stale) {
    logger.info(`[provisioning] skipping ${action} for ONU ${onuId} — ${stale}`, {
      jobId: job.jobId,
    });

    let conn;
    try {
      conn = await db.beginTransaction();
      await writeActionLog(conn, {
        ...onu,
        action,
        triggeredBy,
        jobId: job.jobId,
        command: null,
        deviceResponse: null,
        success: true,
        // Recorded as an outcome, not an error: deciding not to disconnect
        // somebody is a correct result worth being able to point at.
        error: `Skipped — ${stale}`,
      });
      await db.commit(conn);
    } catch (err) {
      await db.rollback(conn);
      throw err;
    }

    return { skipped: true, reason: stale };
  }

  // ── Gate 4: the kill switch ───────────────────────────────────────
  const dryRun = await isDryRun(db, onu.companyId);

  const driver = resolveDriver({ vendor: onu.vendor });
  const driverContext = {
    host: onu.host,
    port: onu.port,
    protocol: onu.protocol,
    ponPortIndex: onu.ponPortIndex,
    onuIndex: onu.onuIndex,
    serialNo: onu.serialNo,
    mac: onu.mac,
  };

  if (dryRun) {
    // The command is still BUILT, so the log shows exactly what would have gone
    // to the device — a rehearsal that does not produce the real command would
    // not be a rehearsal.
    const planned = driver.describe?.(action, driverContext) ?? `${action} ${onu.onuIndex ?? onu.mac}`;

    let conn;
    try {
      conn = await db.beginTransaction();
      await writeActionLog(conn, {
        ...onu,
        action: "dry_run",
        triggeredBy,
        jobId: job.jobId,
        command: String(planned),
        deviceResponse: null,
        success: true,
        error: `DRY RUN — '${action}' was not sent to the device`,
      });
      await db.commit(conn);
    } catch (err) {
      await db.rollback(conn);
      throw err;
    }

    logger.warn(`[provisioning] DRY RUN — ${action} for ONU ${onuId} not sent`, {
      jobId: job.jobId,
    });
    return { dryRun: true, action, planned: String(planned) };
  }

  // ── Talk to the device ────────────────────────────────────────────
  if (!onu.credentialsEnc) {
    throw new Error(`OLT "${onu.oltName}" has no stored credentials — cannot connect`);
  }

  driverContext.credentials = decryptCredentials(onu.credentialsEnc);

  const startedAt = Date.now();
  let result;
  let deviceError = null;

  try {
    if (action === "deactivate") result = await driver.deactivateOnu(driverContext);
    else if (action === "activate") result = await driver.activateOnu(driverContext);
    else result = await driver.getOnuStatus(driverContext);
  } catch (error) {
    deviceError = error;
    result = {
      success: false,
      command: null,
      rawResponse: null,
      error: error.message,
    };
  }

  const durationMs = Date.now() - startedAt;

  // ── Record and, only on success, change state ─────────────────────
  let conn;
  try {
    conn = await db.beginTransaction();

    await writeActionLog(conn, {
      ...onu,
      action,
      triggeredBy,
      jobId: job.jobId,
      command: result.command,
      deviceResponse: result.rawResponse,
      success: Boolean(result.success),
      error: result.success ? null : (result.error ?? deviceError?.message ?? "Device rejected the command"),
      durationMs,
    });

    if (result.success && target) {
      const now = getCurrentTimestampLocal();

      await conn.execute(
        `UPDATE onus SET provisioningState = ?, dateUpdated = ? WHERE onuId = ?`,
        [target, now, onu.onuId]
      );

      // The subscription follows the device. Written here rather than through
      // the subscriptions controller precisely because this is the only place
      // that has seen the OLT confirm it (decision D6).
      //
      // Two exclusions, and both matter:
      //
      //   reason 'recovery'  the modem has been collected and the subscription
      //                      was closed before this job ran. There is nothing
      //                      to follow, and the UPDATE would be a no-op anyway
      //                      because the ONU was unbound — said out loud rather
      //                      than relied on.
      //   'for_recovery'     the account is revoked and awaiting pull-out. An
      //                      activate reaching it would quietly put a written-
      //                      off customer back into service, still owing.
      if (reason !== "recovery") {
        const subscriptionStatus = action === "deactivate" ? "suspended" : "active";
        const stamp =
          action === "deactivate"
            ? `, suspendedAt = COALESCE(suspendedAt, ?)`
            : `, suspendedAt = NULL`;
        const stampParams = action === "deactivate" ? [now] : [];

        await conn.execute(
          `UPDATE subscriptions SET status = ?, dateUpdated = ?${stamp}
           WHERE onuId = ? AND status NOT IN ('terminated', 'for_recovery')
             AND recordStatus != 'Deleted'`,
          [subscriptionStatus, now, ...stampParams, onu.onuId]
        );
      }
    }

    if (result.success && action === "status" && result.parsed) {
      const now = getCurrentTimestampLocal();
      const { rxDbm, txDbm, online } = result.parsed;

      await conn.execute(
        `UPDATE onus
         SET lastRxDbm = ?, lastTxDbm = ?, lastSeenAt = ?, dateUpdated = ?,
             provisioningState = CASE
               -- A read must never resurrect a suspended ONU: it is offline
               -- because we put it there, and only an activate may undo that.
               WHEN provisioningState = 'suspended' THEN provisioningState
               WHEN ? = 1 THEN 'active'
               ELSE 'offline'
             END
         WHERE onuId = ?`,
        [
          rxDbm ?? null,
          txDbm ?? null,
          online ? now : null,
          now,
          online ? 1 : 0,
          onu.onuId,
        ]
      );
    }

    await db.commit(conn);
  } catch (err) {
    await db.rollback(conn);
    throw err;
  }

  if (!result.success) {
    // Thrown AFTER the log is committed, so the failed attempt is on record and
    // the queue still retries. The domain tables are untouched.
    throw new Error(
      result.error ?? deviceError?.message ?? `Device rejected the ${action} command`
    );
  }

  return {
    action,
    onuId,
    durationMs,
    state: target ?? null,
    parsed: result.parsed ?? null,
  };
};

export default provisioningProcessor;
