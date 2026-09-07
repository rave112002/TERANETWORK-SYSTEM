import Decimal from "decimal.js";

/**
 * Money — exact decimal arithmetic for every peso amount in the system.
 *
 * ── Why this file is not optional ───────────────────────────────────────────
 *
 * The connection pool is configured with `decimalNumbers: true`
 * (`server/config/database.js`), so a `DECIMAL(12,2)` column comes back as a
 * JavaScript **number**. That is safe to READ and display, and never safe to do
 * arithmetic on: `0.1 + 0.2` is `0.30000000000000004`, and a cent lost in an
 * invoice total becomes a payment that fails an exact-amount check and a
 * customer who stays disconnected after paying.
 *
 * So: wrap any value in `money()` before arithmetic, and store the
 * `toAmount()` string. Never `+`, `*` or `===` on a price.
 *
 * Rounding is ROUND_HALF_UP — the ordinary invoicing convention, not banker's
 * rounding.
 *
 * ── Rounding discipline ─────────────────────────────────────────────────────
 *
 * Round once, at the end. Prorating from a rounded daily rate compounds the
 * error: 16 days of a PHP 1,200 month is PHP 619.35 computed from the exact
 * daily rate, and PHP 619.36 if you round the daily rate to 2dp first. The
 * billing tests pin the first answer.
 */

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

/**
 * Wrap a value for exact arithmetic. `null`/`undefined` read as zero, which is
 * what a missing money column means everywhere in this schema.
 *
 * @param {number|string|Decimal|null|undefined} value
 * @returns {Decimal}
 */
export const money = (value) => new Decimal(value ?? 0);

/**
 * Round to 2dp and return the string to write into a DECIMAL(12,2) column.
 * A string, not a number, so the driver hands MySQL the exact value.
 *
 * @param {number|string|Decimal} value
 * @returns {string} e.g. "4999.00"
 */
export const toAmount = (value) => money(value).toFixed(2);

/**
 * Round to 2dp as a number, for API responses and comparisons in tests.
 * @param {number|string|Decimal} value
 * @returns {number}
 */
export const toNumber = (value) => money(value).toDecimalPlaces(2).toNumber();

/**
 * Sum a list of money values exactly.
 * @param {Array<number|string|Decimal>} values
 * @returns {string} 2dp string
 */
export const sumAmounts = (values) =>
  values.reduce((acc, v) => acc.plus(money(v)), new Decimal(0)).toFixed(2);

/**
 * qty × unitPrice, rounded once at the end. Signed — credits are negative.
 * @returns {string} 2dp string
 */
export const lineAmount = (qty, unitPrice) => money(qty).times(money(unitPrice)).toFixed(2);

/**
 * base × rate (tax, discounts).
 * @returns {string} 2dp string
 */
export const applyRate = (base, rate) => money(base).times(money(rate)).toFixed(2);

/**
 * Exact equality at 2dp — the settlement rule.
 *
 * A payment must equal the invoice total exactly (no partial payments, client
 * decision). Comparing with `===` on floats would reject a correct payment, or
 * accept one a centavo short; both are worse than they sound when the
 * consequence is a customer's internet.
 *
 * @returns {boolean}
 */
export const amountsEqual = (a, b) =>
  money(a).toDecimalPlaces(2).equals(money(b).toDecimalPlaces(2));

/**
 * Compare two money values at 2dp.
 * @returns {-1|0|1} negative if a < b, 0 if equal, positive if a > b
 */
export const compareAmounts = (a, b) =>
  money(a).toDecimalPlaces(2).comparedTo(money(b).toDecimalPlaces(2));

/** True when the value rounds to exactly zero at 2dp. */
export const isZeroAmount = (value) => money(value).toDecimalPlaces(2).isZero();

/**
 * Format for display to a person: "PHP 4,999.00".
 * @param {number|string|Decimal} value
 * @param {string} [currency="PHP"]
 */
export const formatAmount = (value, currency = "PHP") => {
  const [whole, fraction] = money(value).toFixed(2).split(".");
  const negative = whole.startsWith("-");
  const digits = negative ? whole.slice(1) : whole;

  // Grouped by slicing rather than a lookahead regex: `(\d{3})+(?!\d)` is a
  // nested quantifier, which backtracks badly on a long run of digits.
  let grouped = "";
  for (let i = digits.length; i > 0; i -= 3) {
    const start = Math.max(0, i - 3);
    grouped = digits.slice(start, i) + (grouped ? `,${grouped}` : "");
  }

  return `${currency} ${negative ? "-" : ""}${grouped}.${fraction}`;
};

export default {
  money,
  toAmount,
  toNumber,
  sumAmounts,
  lineAmount,
  applyRate,
  amountsEqual,
  compareAmounts,
  isZeroAmount,
  formatAmount,
};
