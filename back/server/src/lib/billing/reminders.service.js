import moment from "moment-timezone";

import { enqueue } from "../jobs/jobs.queue.js";
import { writeAudit, systemAuditContext } from "../../utils/audit.js";
import { getCurrentTimestampLocal } from "../../utils/dateUtils.js";

/**
 * Due reminders and the overdue sweep. Run daily by the scheduler.
 *
 *   - `sendUpcomingDueReminders` — invoices still 'issued' whose due date is
 *     two days out, queued a reminder email.
 *   - `markOverdueAndNotify` — invoices still 'issued' past their due date,
 *     flipped to 'overdue' and notified.
 *
 * Neither touches service. Going overdue is a billing fact; disconnecting is a
 * separate decision made by the dunning sweep after the grace period, and
 * keeping them apart is what lets grace days change without touching this file.
 *
 * All date math is Asia/Manila. Dates come back from the driver as
 * 'YYYY-MM-DD' strings, so they compare directly to the formatted values here.
 */

const TZ = process.env.TIMEZONE || "Asia/Manila";

/** How many days before the due date the reminder goes out. */
export const REMINDER_DAYS_BEFORE = 2;

/**
 * Queue reminder emails for invoices due in {@link REMINDER_DAYS_BEFORE} days.
 *
 * The dedupe key is per invoice, so re-running the sweep on the same day — or
 * twice in one day — sends one reminder, not two.
 *
 * @param {Object} db
 * @param {Object} [opts]
 * @param {Date|string} [opts.runDate=new Date()]
 * @returns {Promise<{target: string, found: number, queued: number}>}
 */
export const sendUpcomingDueReminders = async (db, { runDate = new Date() } = {}) => {
  const target = moment.tz(runDate, TZ).add(REMINDER_DAYS_BEFORE, "day").format("YYYY-MM-DD");

  const invoices = await db.query(
    `SELECT invoiceId, companyId, branchId, customerId
       FROM invoices WHERE status = 'issued' AND dueDate = ?`,
    [target]
  );

  let queued = 0;
  for (const inv of invoices) {
    // Its own transaction: enqueue takes a connection because the dedupe check
    // is a locking read, and a reminder that fails to queue must not roll back
    // the ones already queued.
    let conn;
    try {
      // eslint-disable-next-line no-await-in-loop
      conn = await db.beginTransaction();
      // eslint-disable-next-line no-await-in-loop
      const { deduped } = await enqueue(conn, {
        companyId: inv.companyId,
        branchId: inv.branchId,
        type: "email",
        payload: { kind: "reminder", invoiceId: inv.invoiceId, customerId: inv.customerId },
        dedupeKey: `email:reminder:${inv.invoiceId}`,
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

  return { target, found: invoices.length, queued };
};

/**
 * Flip past-due 'issued' invoices to 'overdue' and queue the notice.
 *
 * @param {Object} db
 * @param {Object} [opts]
 * @param {Date|string} [opts.runDate=new Date()]
 * @param {Object|null} [opts.context=null] audit context; defaults to a system actor.
 * @returns {Promise<{today: string, found: number, updated: number}>}
 */
export const markOverdueAndNotify = async (db, { runDate = new Date(), context = null } = {}) => {
  const today = moment.tz(runDate, TZ).format("YYYY-MM-DD");

  const invoices = await db.query(
    `SELECT invoiceId, companyId, branchId, customerId, invoiceNo
       FROM invoices WHERE status = 'issued' AND dueDate < ?`,
    [today]
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
 * The daily billing maintenance run: sweep overdue first, then remind.
 *
 * In that order so an invoice that is already past due gets the overdue notice
 * rather than a "due in two days" reminder.
 *
 * @param {Object} db
 * @param {Object} [opts]
 * @returns {Promise<{overdue: Object, reminders: Object}>}
 */
export const runDailyBilling = async (db, { runDate = new Date(), context = null } = {}) => {
  const overdue = await markOverdueAndNotify(db, { runDate, context });
  const reminders = await sendUpcomingDueReminders(db, { runDate });
  return { overdue, reminders };
};

export default {
  REMINDER_DAYS_BEFORE,
  sendUpcomingDueReminders,
  markOverdueAndNotify,
  runDailyBilling,
};
