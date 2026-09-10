import moment from "moment-timezone";

/**
 * Billing date math, computed in Asia/Manila.
 *
 * The billing model:
 *   - The billing period is the CALENDAR MONTH (e.g. July 1–31).
 *   - The statement day is when the invoice is issued — the 25th for this
 *     client.
 *   - Payment falls due on the 2nd of the NEXT month (July invoice → due Aug 2).
 *
 * ── The statement day is configuration, not a constant ──────────────────────
 *
 * It lives in `system_settings` and an admin can change it. The values below
 * are only the fallback for a caller that has no company to read settings for,
 * and every real billing path passes a schedule in. See
 * `lib/settings/settings.service.js`.
 *
 * ── Why it must stay late in the month ──────────────────────────────────────
 *
 * The statement day is load-bearing, not cosmetic. It is what makes "a
 * suspended customer accrues nothing" fall out of the existing skip rule
 * instead of needing special handling:
 *
 *   Jul 25  JULY invoice issued, due Aug 2
 *   Aug  2  unpaid → disconnected
 *   Aug 25  cycle runs → subscription is 'suspended' → SKIPPED
 *           ✅ no August invoice
 *   Sep  5  customer pays → reconnected
 *   Sep 25  cycle runs → 'active' → SEPTEMBER invoice in full, due Oct 2
 *
 * On a 1st-of-month statement the August invoice would be generated on Aug 1 —
 * the day BEFORE the Aug 2 disconnection — so the customer would wrongly owe
 * both July and August. `validateBillingSchedule` refuses that combination, and
 * it is refused rather than clamped because the correct fix depends on which
 * of the two dates the client actually meant to move.
 *
 * These functions return 'YYYY-MM-DD' strings, which is also how the DATE
 * columns come back from the driver (`dateStrings: true`), so a period read
 * from a row compares to a computed one with ===.
 */

const TZ = process.env.TIMEZONE || "Asia/Manila";

/**
 * The schedule used when no company context is available — a preview, a test,
 * a script. Matches what migration 011 seeds, so a fallback can never quietly
 * bill on a different day from the configured system.
 */
export const DEFAULT_STATEMENT_DAY = 25;
export const DEFAULT_DUE_DAY = 2;

/**
 * The billing period and its statement/due dates for the month `runDate` falls in.
 *
 * @param {Date|string} [runDate=new Date()]
 * @param {Object} [schedule]
 * @param {number} [schedule.statementDay=25] day of the month invoices are issued.
 * @param {number} [schedule.dueDay=2] day of the FOLLOWING month payment is due.
 * @returns {{
 *   periodStart: string, periodEnd: string,
 *   statementDate: string, dueDate: string,
 *   daysInMonth: number, year: number
 * }} all dates as 'YYYY-MM-DD'.
 *
 * @example
 *   computeBilledPeriod("2026-07-20")
 *   // → { periodStart: '2026-07-01', periodEnd: '2026-07-31',
 *   //     statementDate: '2026-07-25', dueDate: '2026-08-02',
 *   //     daysInMonth: 31, year: 2026 }
 */
export const computeBilledPeriod = (
  runDate = new Date(),
  { statementDay = DEFAULT_STATEMENT_DAY, dueDay = DEFAULT_DUE_DAY } = {}
) => {
  const m = moment.tz(runDate, TZ);
  const start = m.clone().startOf("month");
  const end = m.clone().endOf("month");
  const nextMonth = start.clone().add(1, "month");

  // The settings bounds stop at 28 precisely so this clamp never fires. It is
  // here for a schedule that arrives from somewhere else — a script, a seed —
  // because `moment().date(31)` in February rolls into March silently, which
  // would move a due date into the wrong month rather than to its last day.
  const onDay = (base, day) => base.clone().date(Math.min(day, base.daysInMonth()));

  return {
    periodStart: start.format("YYYY-MM-DD"),
    periodEnd: end.format("YYYY-MM-DD"),
    // Issued on the statement day, but still covering the whole calendar month.
    statementDate: onDay(start, statementDay).format("YYYY-MM-DD"),
    dueDate: onDay(nextMonth, dueDay).format("YYYY-MM-DD"),
    daysInMonth: m.daysInMonth(),
    year: m.year(),
  };
};

/**
 * How many days of service to bill this period.
 *
 * - Activated on or before the period start (or unknown) → the full month.
 * - Activated within the period → activation day through month end, inclusive.
 * - Activated after the period → 0, nothing to bill.
 *
 * ── The signature is deliberately this short ────────────────────────────────
 *
 * It takes the activation date and nothing else about the subscription's
 * history. A suspension does NOT reduce the bill: a customer cut off on Aug 5
 * for non-payment and reconnected on Aug 12 is still billed the full month of
 * August, because the downtime was caused by their own late payment.
 *
 * That is a client decision, and it was arrived at by rejecting the two obvious
 * alternatives — subtracting suspended days, and moving the billing anchor to
 * the payment date. Adding a fifth parameter here is how someone would
 * reintroduce either one, so `billing.dates.test.js` pins `.length === 4`.
 *
 * @param {Date|string|null} activatedAt
 * @param {string} periodStart 'YYYY-MM-DD'
 * @param {string} periodEnd   'YYYY-MM-DD'
 * @param {number} daysInMonth
 * @returns {number}
 */
export const serviceDaysInPeriod = (activatedAt, periodStart, periodEnd, daysInMonth) => {
  if (!activatedAt) return daysInMonth;

  const act = moment.tz(activatedAt, TZ);
  const start = moment.tz(periodStart, TZ);
  const end = moment.tz(periodEnd, TZ);

  if (act.isSameOrBefore(start, "day")) return daysInMonth;
  if (act.isAfter(end, "day")) return 0;

  // Inclusive: the activation day itself is billed.
  return end.date() - act.date() + 1;
};

export default {
  DEFAULT_STATEMENT_DAY,
  DEFAULT_DUE_DAY,
  computeBilledPeriod,
  serviceDaysInPeriod,
};
