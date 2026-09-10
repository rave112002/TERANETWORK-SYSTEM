import moment from "moment-timezone";

import { enqueue } from "../jobs/jobs.queue.js";
import { getGraceDays, isDryRun } from "../settings/settings.service.js";
import { getCurrentTimestampLocal } from "../../utils/dateUtils.js";
import { logger } from "../../../config/logger.js";

/**
 * The dunning sweep — deciding who gets disconnected.
 *
 * ── Read the selection rules as reasons NOT to disconnect somebody ──────────
 *
 * This file can take a real family's internet away, and every condition in the
 * query below exists because of a specific way that goes wrong:
 *
 *   invoice is 'issued' or 'overdue'   never disconnect somebody who has paid
 *   dueDate + grace <= today           never disconnect on the due date itself
 *   subscription is 'active'           never re-disconnect the already-suspended
 *   no live exemption                  never override a staff decision to wait
 *   onuId IS NOT NULL                  never queue device work with no device
 *
 * ── What this file does not do ──────────────────────────────────────────────
 *
 * It does not touch a device, and it does not change any customer's state. It
 * writes job tickets and nothing else. The provisioning worker re-checks every
 * precondition immediately before acting — a payment can land in the gap —
 * honours DRY_RUN, and is the only thing that ever flips a subscription to
 * 'suspended', in the same transaction as the device's confirmed reply.
 *
 * That split is the whole safety design. A sweep that disconnected directly
 * would have to be right at the moment it runs; this one only has to be right
 * about who is *worth asking about*, and the worker asks again.
 */

const TZ = process.env.TIMEZONE || "Asia/Manila";

/**
 * The latest due date that is now old enough to disconnect for.
 *
 * The rule is inverted deliberately: rather than computing `dueDate + grace`
 * for every row in SQL, `today - grace` is computed once, here, in Asia/Manila.
 * That keeps the date arithmetic in JavaScript where the tested helpers live,
 * and off a database server whose session timezone may be eight hours out.
 *
 * @param {Date|string} runDate
 * @param {number} graceDays
 * @returns {string} 'YYYY-MM-DD'; invoices due on or before this are eligible.
 *
 * @example
 *   cutoffDate("2026-08-10", 3) // → "2026-08-07"
 *   // an invoice due Aug 7 is exactly three days past due on Aug 10 → eligible
 */
export const cutoffDate = (runDate, graceDays) =>
  moment.tz(runDate, TZ).subtract(graceDays, "days").format("YYYY-MM-DD");

/**
 * Every subscription currently due for disconnection.
 *
 * Read-only. Returns one row per SUBSCRIPTION even when a customer has several
 * unpaid invoices — a service is disconnected once, not once per bill.
 *
 * @param {Object} db
 * @param {Object} [opts]
 * @param {Date|string} [opts.runDate=new Date()]
 * @param {number} [opts.graceDays=0] the client's configured value. Every caller
 *   passes it from settings; the default only matters to a direct call.
 * @param {string|null} [opts.subscriptionId=null] narrow to one subscription.
 *   Used by the worker's re-check, so "should this customer be disconnected?"
 *   is asked in exactly one place. If the sweep and the re-check ever drifted,
 *   somebody could be queued by one and cut off against the other's judgement.
 * @param {string|null} [opts.companyId=null]
 * @param {string[]|null} [opts.branchIds=null] null means every branch.
 * @returns {Promise<Array>}
 */
export const findDisconnectCandidates = async (
  db,
  {
    runDate = new Date(),
    graceDays = 0,
    subscriptionId = null,
    companyId = null,
    branchIds = null,
  } = {}
) => {
  const cutoff = cutoffDate(runDate, graceDays);
  const now = getCurrentTimestampLocal();

  // Bound in the order the placeholders appear in the SQL below: the due-date
  // cutoff, then the exemption's `expiresAt`, then whatever filters follow.
  // Built as one list rather than assembled in pieces, because a mismatch here
  // is silent — MySQL happily compares a DATE against a DATETIME string, so the
  // query would return a plausible wrong answer about who to disconnect.
  const params = [cutoff, now];
  let filters = "";

  if (subscriptionId) {
    filters += " AND s.subscriptionId = ?";
    params.push(subscriptionId);
  }
  if (companyId) {
    filters += " AND s.companyId = ?";
    params.push(companyId);
  }
  if (Array.isArray(branchIds)) {
    // An empty scope must select nothing rather than everything. Getting this
    // backwards would let a user with no branches disconnect the whole estate.
    if (branchIds.length === 0) return [];
    filters += ` AND s.branchId IN (${branchIds.map(() => "?").join(",")})`;
    params.push(...branchIds);
  }

  return db.query(
    `SELECT s.subscriptionId,
            s.companyId,
            s.branchId,
            s.customerId,
            s.onuId,
            c.name              AS customerName,
            c.email             AS customerEmail,
            c.accountNo,
            o.mac               AS onuMac,
            o.provisioningState,
            MIN(i.dueDate)      AS oldestDueDate,
            COUNT(i.invoiceId)  AS unpaidCount,
            SUM(i.total)        AS amountDue
       FROM subscriptions s
       JOIN customers c ON c.customerId = s.customerId
       JOIN invoices  i ON i.subscriptionId = s.subscriptionId
       LEFT JOIN onus o ON o.onuId = s.onuId
      WHERE s.status = 'active'
        AND s.recordStatus != 'Deleted'
        AND s.onuId IS NOT NULL
        AND i.status IN ('issued', 'overdue')
        AND i.dueDate <= ?
        AND NOT EXISTS (
              SELECT 1 FROM dunning_exemptions de
               WHERE de.subscriptionId = s.subscriptionId
                 AND de.status = 'Active'
                 AND de.expiresAt > ?
            )${filters}
      GROUP BY s.subscriptionId, s.companyId, s.branchId, s.customerId, s.onuId,
               c.name, c.email, c.accountNo, o.mac, o.provisioningState
      ORDER BY MIN(i.dueDate) ASC`,
    params
  );
};

/**
 * Should this disconnection still go ahead, right now?
 *
 * ── Why this exists as well as the payment path cancelling queued jobs ──────
 *
 * The two guards cover different moments, and only together do they cover the
 * whole window:
 *
 *   - Settling a payment cancels jobs still `queued`.
 *   - This catches a job the worker has ALREADY CLAIMED (`processing`), which
 *     a cancel query cannot touch.
 *
 * The sequence that needs the second one is real and ordinary:
 *
 *   20:00:00  sweep queues a disconnect
 *   20:00:30  the customer pays; the webhook cancels queued jobs — but the
 *             worker claimed this one at 20:00:05, so there is nothing to cancel
 *   20:01:00  the worker reaches the device
 *
 * Without this check that customer is cut off thirty seconds after paying.
 *
 * Deliberately re-uses {@link findDisconnectCandidates} rather than
 * re-implementing the conditions, so there is exactly one definition of
 * "deserves disconnection" in the system.
 *
 * @param {Object} db
 * @param {string} subscriptionId
 * @param {Object} [opts]
 * @param {Date|string} [opts.runDate=new Date()]
 * @param {string|null} [opts.companyId=null]
 * @returns {Promise<boolean>}
 */
export const isStillEligibleForDisconnect = async (
  db,
  subscriptionId,
  { runDate = new Date(), companyId = null } = {}
) => {
  // Read fresh, not carried on the job. Staff shortening or extending the grace
  // period between the sweep and the worker should take effect immediately —
  // the whole point of it being a setting.
  const graceDays = await getGraceDays(db, companyId);

  const rows = await findDisconnectCandidates(db, {
    runDate,
    graceDays,
    subscriptionId,
    companyId,
  });

  return rows.length > 0;
};

/**
 * Run the sweep: find candidates, queue one disconnect each.
 *
 * Idempotent. `enqueue` skips when a live job already carries the same dedupe
 * key, so running the sweep twice in a night — by the scheduler and by a staff
 * member pressing the button — queues one disconnect per customer, not two.
 *
 * @param {Object} db
 * @param {Object} [opts]
 * @param {Date|string} [opts.runDate=new Date()]
 * @param {string|null} [opts.companyId=null]
 * @param {string[]|null} [opts.branchIds=null]
 * @param {string} [opts.triggeredBy="system:dunning"]
 * @returns {Promise<{graceDays: number, cutoff: string, candidates: number, queued: number, deduped: number, dryRun: boolean, details: Array}>}
 */
export const runDunningSweep = async (
  db,
  {
    runDate = new Date(),
    companyId = null,
    branchIds = null,
    triggeredBy = "system:dunning",
  } = {}
) => {
  const graceDays = await getGraceDays(db, companyId);
  const dryRun = await isDryRun(db, companyId);

  const cutoff = cutoffDate(runDate, graceDays);
  const candidates = await findDisconnectCandidates(db, {
    runDate,
    graceDays,
    companyId,
    branchIds,
  });

  logger.info(
    `[dunning] ${candidates.length} candidate(s) with invoices due on or before ${cutoff} ` +
      `(grace ${graceDays}d)${dryRun ? " [DRY RUN]" : ""}`
  );

  const details = [];
  let queued = 0;
  let deduped = 0;

  for (const candidate of candidates) {
    // One live disconnect per ONU, ever. This exact key is what the payment
    // path cancels — see lib/payments/webhook.service.js.
    const dedupeKey = `deactivate:onu:${candidate.onuId}`;

    let conn;
    try {
      // eslint-disable-next-line no-await-in-loop
      conn = await db.beginTransaction();
      // eslint-disable-next-line no-await-in-loop
      const job = await enqueue(conn, {
        companyId: candidate.companyId,
        branchId: candidate.branchId,
        type: "deactivate",
        payload: {
          onuId: candidate.onuId,
          subscriptionId: candidate.subscriptionId,
          reason: "dunning",
          triggeredBy,
        },
        dedupeKey,
      });
      // eslint-disable-next-line no-await-in-loop
      await db.commit(conn);

      if (job.deduped) deduped += 1;
      else queued += 1;

      details.push({
        subscriptionId: candidate.subscriptionId,
        customerName: candidate.customerName,
        accountNo: candidate.accountNo,
        onuId: candidate.onuId,
        oldestDueDate: candidate.oldestDueDate,
        unpaidCount: Number(candidate.unpaidCount),
        amountDue: candidate.amountDue,
        jobId: job.jobId,
        deduped: job.deduped,
      });
    } catch (err) {
      // eslint-disable-next-line no-await-in-loop
      if (conn) await db.rollback(conn);
      // One customer's bad data must not stop the other disconnections — but it
      // must be loud, because the opposite failure (somebody who should have
      // been cut off silently was not) is a revenue leak nobody notices.
      logger.error(
        `🚨 [dunning] could not queue a disconnect for ${candidate.accountNo}: ${err.message}`
      );
      details.push({
        subscriptionId: candidate.subscriptionId,
        customerName: candidate.customerName,
        error: err.message,
      });
    }
  }

  if (queued > 0) {
    // Warning level on purpose. Queuing a disconnection is not routine
    // bookkeeping — it is the system preparing to cut off customers — and it
    // should stand out in a log somebody is scanning.
    logger.warn(
      `[dunning] queued ${queued} disconnect(s)` +
        (deduped ? `, ${deduped} already queued` : "") +
        ` (${triggeredBy})${dryRun ? " [DRY RUN — the worker will not send commands]" : ""}`
    );
  }

  return {
    graceDays,
    cutoff,
    candidates: candidates.length,
    queued,
    deduped,
    // Reported so the UI can say "the kill switch is on". The sweep still
    // queues under DRY_RUN, so staff can see exactly what would have happened;
    // the worker is what declines to send the command.
    dryRun,
    details,
  };
};

/**
 * Who is heading for disconnection, and when.
 *
 * The read-only view behind the Dunning screen. Deliberately answers a
 * different question from the sweep: "who will be cut off if nothing changes",
 * including the people still inside their grace period, so staff can act before
 * the disconnection rather than explain it afterwards.
 *
 * @param {Object} db
 * @param {Object} [opts]
 * @param {Date|string} [opts.runDate=new Date()]
 * @param {string|null} [opts.companyId=null]
 * @param {string[]|null} [opts.branchIds=null]
 * @returns {Promise<{graceDays: number, cutoff: string, atRisk: Array}>}
 */
export const findAtRisk = async (
  db,
  { runDate = new Date(), companyId = null, branchIds = null } = {}
) => {
  const graceDays = await getGraceDays(db, companyId);
  const cutoff = cutoffDate(runDate, graceDays);
  const today = moment.tz(runDate, TZ).format("YYYY-MM-DD");
  const now = getCurrentTimestampLocal();

  // Placeholder order: DATEDIFF's `today` in the SELECT, the exemption's `now`
  // in the LEFT JOIN, the due-date `today` in the WHERE, then the filters.
  const params = [today, now, today];
  let filters = "";

  if (companyId) {
    filters += " AND s.companyId = ?";
    params.push(companyId);
  }
  if (Array.isArray(branchIds)) {
    if (branchIds.length === 0) return { graceDays, cutoff, atRisk: [] };
    filters += ` AND s.branchId IN (${branchIds.map(() => "?").join(",")})`;
    params.push(...branchIds);
  }

  // Everyone with an unpaid invoice already past its due date — not only those
  // past grace. `daysPastDue` and the live exemption come back so the screen
  // can show who is shielded and who has days left.
  const rows = await db.query(
    `SELECT s.subscriptionId,
            s.branchId,
            s.customerId,
            s.onuId,
            s.status            AS subscriptionStatus,
            c.name              AS customerName,
            c.accountNo,
            c.email             AS customerEmail,
            c.phone             AS customerPhone,
            b.name              AS branchName,
            MIN(i.dueDate)      AS oldestDueDate,
            COUNT(i.invoiceId)  AS unpaidCount,
            SUM(i.total)        AS amountDue,
            DATEDIFF(?, MIN(i.dueDate)) AS daysPastDue,
            MAX(de.expiresAt)   AS exemptUntil,
            MAX(de.reason)      AS exemptReason
       FROM subscriptions s
       JOIN customers c ON c.customerId = s.customerId
       JOIN invoices  i ON i.subscriptionId = s.subscriptionId
       LEFT JOIN branches b ON b.branchId = s.branchId
       LEFT JOIN dunning_exemptions de
              ON de.subscriptionId = s.subscriptionId
             AND de.status = 'Active'
             AND de.expiresAt > ?
      WHERE s.status IN ('active', 'suspended')
        AND s.recordStatus != 'Deleted'
        AND i.status IN ('issued', 'overdue')
        AND i.dueDate <= ?${filters}
      GROUP BY s.subscriptionId, s.branchId, s.customerId, s.onuId, s.status,
               c.name, c.accountNo, c.email, c.phone, b.name
      ORDER BY MIN(i.dueDate) ASC`,
    params
  );

  const atRisk = rows.map((row) => ({
    ...row,
    unpaidCount: Number(row.unpaidCount),
    daysPastDue: Number(row.daysPastDue),
    // Days until this account is eligible, so the screen can say "2 days left"
    // rather than making somebody do the arithmetic under time pressure.
    daysUntilDisconnect: Math.max(0, graceDays - Number(row.daysPastDue)),
    exempt: Boolean(row.exemptUntil),
    // Already disconnected, or eligible right now, or still inside grace.
    state:
      row.subscriptionStatus === "suspended"
        ? "suspended"
        : row.exemptUntil
          ? "exempt"
          : Number(row.daysPastDue) >= graceDays
            ? "eligible"
            : "in_grace",
  }));

  return { graceDays, cutoff, atRisk };
};

export default {
  cutoffDate,
  findDisconnectCandidates,
  isStillEligibleForDisconnect,
  runDunningSweep,
  findAtRisk,
};
