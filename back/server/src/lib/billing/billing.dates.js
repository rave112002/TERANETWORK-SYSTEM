import moment from "moment-timezone";

/**
 * Billing date math, computed in Asia/Manila.
 *
 * The billing model:
 *   - The billing period is the CALENDAR MONTH (e.g. July 1–31).
 *   - The statement date is the 15th of that month (when the invoice is issued).
 *   - Payment is due on the 2nd of the NEXT month (July invoice → due Aug 2).
 *
 * ── Why the 15th and not the 1st ────────────────────────────────────────────
 *
 * The 15th is load-bearing, not cosmetic. It is what makes "a suspended
 * customer accrues nothing" fall out of the existing skip rule instead of
 * needing special handling:
 *
 *   May 15  MAY invoice issued, due Jun 2
 *   Jun  2  unpaid → disconnected
 *   Jun 15  cycle runs → subscription is 'suspended' → SKIPPED
 *           ✅ no June invoice
 *   Jul  5  customer pays → reconnected
 *   Jul 15  cycle runs → 'active' → JULY invoice in full, due Aug 2
 *
 * On a 1st-of-month statement the June invoice would be generated on Jun 1 —
 * the day BEFORE the Jun 2 disconnection — so the customer would wrongly owe
 * both May and June. Do not "simplify" this back to the 1st.
 *
 * These functions return 'YYYY-MM-DD' strings, which is also how the DATE
 * columns come back from the driver (`dateStrings: true`), so a period read
 * from a row compares to a computed one with ===.
 */

const TZ = process.env.TIMEZONE || "Asia/Manila";

/** Which day of the month invoices are issued. Read the note above first. */
export const STATEMENT_DAY = 15;

/** Which day of the following month payment is due. */
export const DUE_DAY_OF_NEXT_MONTH = 2;

/**
 * The billing period and its statement/due dates for the month `runDate` falls in.
 *
 * @param {Date|string} [runDate=new Date()]
 * @returns {{
 *   periodStart: string, periodEnd: string,
 *   statementDate: string, dueDate: string,
 *   daysInMonth: number, year: number
 * }} all dates as 'YYYY-MM-DD'.
 *
 * @example
 *   computeBilledPeriod("2026-07-20")
 *   // → { periodStart: '2026-07-01', periodEnd: '2026-07-31',
 *   //     statementDate: '2026-07-15', dueDate: '2026-08-02',
 *   //     daysInMonth: 31, year: 2026 }
 */
export const computeBilledPeriod = (runDate = new Date()) => {
  const m = moment.tz(runDate, TZ);
  const start = m.clone().startOf("month");
  const end = m.clone().endOf("month");
  // Issued on the 15th, but still covering the whole calendar month.
  const statementDate = start.clone().date(STATEMENT_DAY);
  const dueDate = start.clone().add(1, "month").date(DUE_DAY_OF_NEXT_MONTH);

  return {
    periodStart: start.format("YYYY-MM-DD"),
    periodEnd: end.format("YYYY-MM-DD"),
    statementDate: statementDate.format("YYYY-MM-DD"),
    dueDate: dueDate.format("YYYY-MM-DD"),
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

export default { STATEMENT_DAY, DUE_DAY_OF_NEXT_MONTH, computeBilledPeriod, serviceDaysInPeriod };
