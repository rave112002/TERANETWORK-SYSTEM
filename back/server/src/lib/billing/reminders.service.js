import moment from "moment-timezone";

import { cutoffDate } from "../dunning/dunning.service.js";
import { enqueue } from "../jobs/jobs.queue.js";
import { getBillingSchedule } from "../settings/settings.service.js";
import { writeAudit, systemAuditContext } from "../../utils/audit.js";
import { getCurrentTimestampLocal } from "../../utils/dateUtils.js";

/**
 * The three billing notices, and the overdue sweep. Run daily by the scheduler.
 *
 *   - `sendUpcomingDueReminders` — invoices due in `reminderDaysBefore` days:
 *     a nudge.
 *   - `sendFinalNotices` — invoices whose grace runs out TODAY: the last
 *     warning, sent hours before the disconnection sweep.
 *   - `markOverdueAndNotify` — invoices past their due date, flipped to
 *     'overdue' and notified.
 *
 * None of them touches service. Going overdue is a billing fact; disconnecting
 * is a separate decision made by the dunning sweep, and keeping them apart is
 * what lets grace days change without touching this file.
 *
 * ── Why the final notice exists ─────────────────────────────────────────────
 *
 * With the client's schedule — due on the 2nd, no grace, cut off at 20:00 that
 * evening — the two original notices left a hole big enough to lose a customer
 * in:
 *
 *   Aug  2  08:00  nothing sent: the invoice is due today, not yet past due
 *   Aug  2  20:00  disconnected
 *   Aug  3  08:00  "your invoice is past due" — the morning AFTER the cut-off
 *
 * The one message that mattered arrived after the thing it was warning about.
 * `sendFinalNotices` fires on the morning of the cut-off day, whatever the
 * grace period is, so the warning always lands before the sweep. That ordering
 * is enforced rather than assumed: `validateBillingSchedule` refuses a daily
 * hour at or after the dunning hour.
 *
 * All date math is Asia/Manila. Dates come back from the driver as
 * 'YYYY-MM-DD' strings, so they compare directly to the formatted values here.
 */

const TZ = process.env.TIMEZONE || "Asia/Manila";

/**
 * Scope fragment for an optional company filter.
 *
 * The scheduler runs these per company because the schedule is per company. A
 * null companyId means every company, which is what a manual run from a script
 * wants.
 */
const companyFilter = (companyId, column = "companyId") => ({
  clause: companyId ? ` AND ${column} = ?` : "",
  params: companyId ? [companyId] : [],
});

/**
 * Queue one email job per invoice, each in its own transaction.
 *
 * `enqueue` takes a connection because its dedupe check is a locking read, and
 * a reminder that fails to queue must not roll back the ones already queued.
 *
 * @returns {Promise<number>} how many were newly queued (deduped ones excluded).
 */
const queueNotices = async (db, invoices, { kind, dedupePrefix }) => {
  let queued = 0;

  for (const inv of invoices) {
    let conn;
    try {
      // eslint-disable-next-line no-await-in-loop
      conn = await db.beginTransaction();
      // eslint-disable-next-line no-await-in-loop
      const { deduped } = await enqueue(conn, {
        companyId: inv.companyId,
        branchId: inv.branchId,
        type: "email",
        payload: { kind, invoiceId: inv.invoiceId, customerId: inv.customerId },
        dedupeKey: `${dedupePrefix}:${inv.invoiceId}`,
      });
      // eslint-disable-next-line no-await-in-loop
      await db.commit(conn);
      if (!deduped) queued += 1;
    } catch (err) {
      // eslint-disable-next-line no-await-in-loop
      if (conn) await db.rollback(conn);
      throw err;
    }
  }

  return queued;
};

/**
 * Queue reminder emails for invoices due in `reminderDaysBefore` days.
 *
 * The dedupe key is per invoice, so re-running the sweep on the same day — or
 * twice in one day — sends one reminder, not two.
 *
 * @param {Object} db
 * @param {Object} [opts]
 * @param {Date|string} [opts.runDate=new Date()]
 * @param {string|null} [opts.companyId=null]
 * @param {number} [opts.reminderDaysBefore=2] days ahead of the due date.
 * @returns {Promise<{target: string, found: number, queued: number, skipped?: string}>}
 */
export const sendUpcomingDueReminders = async (
  db,
  { runDate = new Date(), companyId = null, reminderDaysBefore = 2 } = {}
) => {
  const target = moment.tz(runDate, TZ).add(reminderDaysBefore, "day").format("YYYY-MM-DD");

  // A lead time of zero would target the due date itself, which is the final
  // notice's day. Two emails in one morning saying different things about the
  // same bill is worse than one, so the nudge stands down.
  if (reminderDaysBefore <= 0) {
    return { target, found: 0, queued: 0, skipped: "the final notice covers the due date" };
  }

  const scope = companyFilter(companyId);
  const invoices = await db.query(
    `SELECT invoiceId, companyId, branchId, customerId
       FROM invoices WHERE status = 'issued' AND dueDate = ?${scope.clause}`,
    [target, ...scope.params]
  );

  const queued = await queueNotices(db, invoices, {
    kind: "reminder",
    dedupePrefix: "email:reminder",
  });

  return { target, found: invoices.length, queued };
};

/**
 * Queue the last warning for invoices whose grace period runs out today.
 *
 * The target date is `today - graceDays`: an invoice due then is exactly out of
 * grace now. That is {@link cutoffDate}, imported from the dunning sweep rather
 * than repeated here, because a warning sent for a different date than the
 * sweep acts on is worse than no warning at all.
 *
 * Matches 'overdue' as well as 'issued': with a grace period the invoice has
 * already been flipped by the time its cut-off day arrives.
 *
 * ── Why this only warns people who will actually be cut off ─────────────────
 *
 * The three conditions on the subscription mirror the sweep's own reasons NOT
 * to disconnect somebody (see `dunning.service.js`): already suspended, no
 * modem to suspend, or shielded by a staff exemption. Without them this sends
 * "your connection will be suspended at 20:00 today" to a customer whose
 * exemption means it will not — a false statement to a customer, and a phone
 * call for whoever granted the exemption.
 *
 * @param {Object} db
 * @param {Object} [opts]
 * @param {Date|string} [opts.runDate=new Date()]
 * @param {string|null} [opts.companyId=null]
 * @param {number} [opts.graceDays=0]
 * @returns {Promise<{target: string, found: number, queued: number}>}
 */
export const sendFinalNotices = async (
  db,
  { runDate = new Date(), companyId = null, graceDays = 0 } = {}
) => {
  const target = cutoffDate(runDate, graceDays);
  const now = getCurrentTimestampLocal();

  const scope = companyFilter(companyId, "i.companyId");
  const invoices = await db.query(
    `SELECT i.invoiceId, i.companyId, i.branchId, i.customerId
       FROM invoices i
       JOIN subscriptions s ON s.subscriptionId = i.subscriptionId
      WHERE i.status IN ('issued', 'overdue')
        AND i.dueDate = ?
        AND s.status = 'active'
        AND s.recordStatus != 'Deleted'
        AND s.onuId IS NOT NULL
        AND NOT EXISTS (
              SELECT 1 FROM dunning_exemptions de
               WHERE de.subscriptionId = s.subscriptionId
                 AND de.status = 'Active'
                 AND de.expiresAt > ?
            )${scope.clause}`,
    [target, now, ...scope.params]
  );

  const queued = await queueNotices(db, invoices, {
    kind: "final",
    dedupePrefix: "email:final",
  });

  return { target, found: invoices.length, queued };
};

/**
 * Flip past-due 'issued' invoices to 'overdue' and queue the notice.
 *
 * @param {Object} db
 * @param {Object} [opts]
 * @param {Date|string} [opts.runDate=new Date()]
 * @param {string|null} [opts.companyId=null]
 * @param {Object|null} [opts.context=null] audit context; defaults to a system actor.
 * @returns {Promise<{today: string, found: number, updated: number}>}
 */
export const markOverdueAndNotify = async (
  db,
  { runDate = new Date(), companyId = null, context = null } = {}
) => {
  const today = moment.tz(runDate, TZ).format("YYYY-MM-DD");

  const scope = companyFilter(companyId);
  const invoices = await db.query(
    `SELECT invoiceId, companyId, branchId, customerId, invoiceNo
       FROM invoices WHERE status = 'issued' AND dueDate < ?${scope.clause}`,
    [today, ...scope.params]
  );

  let updated = 0;
  for (const inv of invoices) {
    // One transaction per invoice: the status flip, the audit entry and the
    // email job land together or not at all.
    let conn;
    try {
      // eslint-disable-next-line no-await-in-loop
      conn = await db.beginTransaction();

      // `AND status = 'issued'` in the UPDATE, not just the SELECT above: a
      // payment landing in between must win, and this turns that race into
      // zero affected rows rather than an invoice marked overdue after it was
      // paid.
      // eslint-disable-next-line no-await-in-loop
      const [result] = await conn.execute(
        `UPDATE invoices SET status = 'overdue', dateUpdated = ?
          WHERE invoiceId = ? AND status = 'issued'`,
        [getCurrentTimestampLocal(), inv.invoiceId]
      );

      if (result.affectedRows === 0) {
        // eslint-disable-next-line no-await-in-loop
        await db.rollback(conn);
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      await writeAudit(conn, {
        context:
          context ??
          systemAuditContext("billing_overdue", {
            companyId: inv.companyId,
            branchId: inv.branchId,
          }),
        module: "billing",
        action: "invoice_overdue",
        description: `Invoice ${inv.invoiceNo} passed its due date`,
        before: { status: "issued" },
        after: { status: "overdue" },
      });

      // eslint-disable-next-line no-await-in-loop
      await enqueue(conn, {
        companyId: inv.companyId,
        branchId: inv.branchId,
        type: "email",
        payload: { kind: "overdue", invoiceId: inv.invoiceId, customerId: inv.customerId },
        dedupeKey: `email:overdue:${inv.invoiceId}`,
      });

      // eslint-disable-next-line no-await-in-loop
      await db.commit(conn);
      updated += 1;
    } catch (err) {
      // eslint-disable-next-line no-await-in-loop
      if (conn) await db.rollback(conn);
      throw err;
    }
  }

  return { today, found: invoices.length, updated };
};

/**
 * The daily billing maintenance run.
 *
 * Order matters, and it is the order a customer experiences:
 *
 *   1. overdue — invoices that passed their due date get the status and notice
 *      that says so, before anything else is sent about them.
 *   2. final   — invoices out of grace today get the last warning, hours before
 *      the evening sweep.
 *   3. reminder — invoices still days away get the nudge.
 *
 * Running them the other way round would send a "due in two days" reminder for
 * an invoice that is already past due.
 *
 * @param {Object} db
 * @param {Object} [opts]
 * @param {Date|string} [opts.runDate=new Date()]
 * @param {string|null} [opts.companyId=null] the company whose schedule applies.
 * @param {Object|null} [opts.schedule=null] pre-read schedule, if the caller has one.
 * @param {Object|null} [opts.context=null]
 * @returns {Promise<{overdue: Object, finals: Object, reminders: Object}>}
 */
export const runDailyBilling = async (
  db,
  { runDate = new Date(), companyId = null, schedule = null, context = null } = {}
) => {
  const effective = schedule ?? (companyId ? await getBillingSchedule(db, companyId) : null);
  const graceDays = effective?.graceDays ?? 0;
  const reminderDaysBefore = effective?.reminderDaysBefore ?? 2;

  const overdue = await markOverdueAndNotify(db, { runDate, companyId, context });
  const finals = await sendFinalNotices(db, { runDate, companyId, graceDays });
  const reminders = await sendUpcomingDueReminders(db, {
    runDate,
    companyId,
    reminderDaysBefore,
  });

  return { overdue, finals, reminders };
};

export default {
  sendUpcomingDueReminders,
  sendFinalNotices,
  markOverdueAndNotify,
  runDailyBilling,
};
