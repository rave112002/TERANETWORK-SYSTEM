import moment from "moment-timezone";

import { branchScope } from "../../utils/branchScope.js";

/**
 * Modem recovery — the end of the line for an account that never paid.
 *
 * ── The lifecycle, and where this sits in it ────────────────────────────────
 *
 *   active  →  suspended  →  for_recovery  →  terminated
 *              (the sweep)   (staff)          (staff, after the technician)
 *
 * The dunning sweep suspends. Nothing here happens automatically: this file
 * only answers "who has been cut off long enough that somebody should decide?"
 * The two transitions themselves are staff actions in the subscriptions
 * controller, by the client's explicit instruction — a system that revoked
 * accounts on a timer would eventually revoke one it should not have, and the
 * cost of that is a technician van and a customer who never comes back.
 *
 * ── Why the clock runs from the disconnection ───────────────────────────────
 *
 * Not from the last payment, and not from the due date. The client's rule is
 * 60 days without service, and `suspendedAt` is the only one of the three that
 * measures that. A customer who was suspended, paid, and was suspended again
 * gets a fresh 60 days, which is why the reconnection clears the stamp.
 */

const TZ = process.env.TIMEZONE || "Asia/Manila";

/**
 * The date on or before which a suspension is old enough to act on.
 *
 * Computed here in Asia/Manila rather than as `suspendedAt + N days` in SQL,
 * for the same reason the dunning cut-off is: it keeps the date arithmetic in
 * JavaScript, where it is tested, and off a database server whose session
 * timezone may be eight hours out.
 *
 * @param {Date|string} runDate
 * @param {number} recoveryAfterDays
 * @returns {string} 'YYYY-MM-DD HH:mm:ss'
 *
 * @example
 *   recoveryCutoff("2026-09-10", 60) // → "2026-07-12 00:00:00"
 *   // suspended on or before Jul 12 means 60 days without service by Sep 10
 */
export const recoveryCutoff = (runDate, recoveryAfterDays) =>
  moment.tz(runDate, TZ).subtract(recoveryAfterDays, "days").format("YYYY-MM-DD HH:mm:ss");

/**
 * Accounts suspended long enough to be worth a decision.
 *
 * Read-only, and deliberately so — it produces a list for a person, not a queue
 * for a machine.
 *
 * Note what is NOT filtered out: an account holding a live dunning exemption
 * still appears. An exemption shields somebody from being cut off; it says
 * nothing about a modem that has already been sitting idle for two months, and
 * silently hiding those accounts would mean a shield granted last March quietly
 * costs the business a modem. The row carries the exemption instead, so the
 * person deciding can see it.
 *
 * @param {Object} db
 * @param {Object} [opts]
 * @param {Date|string} [opts.runDate=new Date()]
 * @param {number} [opts.recoveryAfterDays=60]
 * @param {string|null} [opts.companyId=null]
 * @param {string[]|null} [opts.branchIds=null] null means every branch.
 * @param {string} [opts.search=""] customer name or account number.
 * @returns {Promise<{cutoff: string, recoveryAfterDays: number, candidates: Array}>}
 */
export const findRecoveryCandidates = async (
  db,
  {
    runDate = new Date(),
    recoveryAfterDays = 60,
    companyId = null,
    branchIds = null,
    search = "",
  } = {}
) => {
  const cutoff = recoveryCutoff(runDate, recoveryAfterDays);

  const scope = branchScope("s.branchId", branchIds);
  // An empty branch scope must select nothing rather than everything: getting
  // this backwards would put the whole estate on a pull-out list.
  if (Array.isArray(branchIds) && branchIds.length === 0) {
    return { cutoff, recoveryAfterDays, candidates: [] };
  }

  const params = [cutoff, ...scope.params];
  let filters = "";

  if (companyId) {
    filters += " AND s.companyId = ?";
    params.push(companyId);
  }
  if (search) {
    filters += " AND (c.name LIKE ? OR c.accountNo LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const candidates = await db.query(
    `SELECT s.subscriptionId,
            s.companyId,
            s.branchId,
            s.customerId,
            s.onuId,
            s.suspendedAt,
            c.name           AS customerName,
            c.accountNo,
            c.phone          AS customerPhone,
            c.address        AS customerAddress,
            p.name           AS planName,
            o.mac            AS onuMac,
            o.serialNo       AS onuSerialNo,
            n.label          AS napLabel,
            o.napPort,
            b.name           AS branchName,
            DATEDIFF(?, s.suspendedAt)            AS daysSuspended,
            COUNT(i.invoiceId)                    AS unpaidCount,
            COALESCE(SUM(i.total), 0)             AS amountOwed,
            MAX(de.expiresAt)                     AS exemptionUntil
       FROM subscriptions s
       JOIN customers c ON c.customerId = s.customerId
       JOIN plans p     ON p.planId = s.planId
       LEFT JOIN onus o     ON o.onuId = s.onuId
       LEFT JOIN naps n     ON n.napId = o.napId
       LEFT JOIN branches b ON b.branchId = s.branchId
       LEFT JOIN invoices i ON i.subscriptionId = s.subscriptionId
                           AND i.status IN ('issued', 'overdue')
       LEFT JOIN dunning_exemptions de ON de.subscriptionId = s.subscriptionId
                           AND de.status = 'Active'
      WHERE s.status = 'suspended'
        AND s.recordStatus != 'Deleted'
        AND s.suspendedAt IS NOT NULL
        AND s.suspendedAt <= ?${scope.clause}${filters}
      GROUP BY s.subscriptionId, s.companyId, s.branchId, s.customerId, s.onuId,
               s.suspendedAt, c.name, c.accountNo, c.phone, c.address, p.name,
               o.mac, o.serialNo, n.label, o.napPort, b.name
      ORDER BY s.suspendedAt ASC`,
    // `runDate` twice: once for DATEDIFF in the SELECT, once for the cut-off in
    // the WHERE. Bound in the order the placeholders appear, because a mismatch
    // here is silent — the query still runs and still returns people.
    [moment.tz(runDate, TZ).format("YYYY-MM-DD"), ...params]
  );

  return { cutoff, recoveryAfterDays, candidates };
};

/**
 * Modems awaiting collection — the technician's outstanding work.
 *
 * Ordered oldest first, because a pull-out nobody has done in three weeks is
 * the one worth asking about.
 *
 * @param {Object} db
 * @param {Object} [opts]
 * @returns {Promise<Array>}
 */
export const findAwaitingPullOut = async (
  db,
  { runDate = new Date(), companyId = null, branchIds = null, search = "" } = {}
) => {
  const scope = branchScope("s.branchId", branchIds);
  if (Array.isArray(branchIds) && branchIds.length === 0) return [];

  const params = [moment.tz(runDate, TZ).format("YYYY-MM-DD"), ...scope.params];
  let filters = "";

  if (companyId) {
    filters += " AND s.companyId = ?";
    params.push(companyId);
  }
  if (search) {
    filters += " AND (c.name LIKE ? OR c.accountNo LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  return db.query(
    `SELECT s.subscriptionId,
            s.companyId,
            s.branchId,
            s.customerId,
            s.onuId,
            s.suspendedAt,
            s.forRecoveryAt,
            c.name           AS customerName,
            c.accountNo,
            c.phone          AS customerPhone,
            c.address        AS customerAddress,
            p.name           AS planName,
            o.mac            AS onuMac,
            o.serialNo       AS onuSerialNo,
            n.label          AS napLabel,
            o.napPort,
            b.name           AS branchName,
            DATEDIFF(?, s.forRecoveryAt) AS daysWaiting
       FROM subscriptions s
       JOIN customers c ON c.customerId = s.customerId
       JOIN plans p     ON p.planId = s.planId
       LEFT JOIN onus o     ON o.onuId = s.onuId
       LEFT JOIN naps n     ON n.napId = o.napId
       LEFT JOIN branches b ON b.branchId = s.branchId
      WHERE s.status = 'for_recovery'
        AND s.recordStatus != 'Deleted'${scope.clause}${filters}
      ORDER BY s.forRecoveryAt ASC`,
    params
  );
};

export default { recoveryCutoff, findRecoveryCandidates, findAwaitingPullOut };
