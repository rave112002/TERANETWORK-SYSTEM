import { money, toAmount } from "../money/money.js";

/**
 * Currency-unit conversion for payment gateways.
 *
 * ── The most dangerous twenty lines in the billing system ───────────────────
 *
 * Philippine payment gateways do not agree on what "amount" means, and the
 * disagreement is a factor of one hundred:
 *
 *   Xendit      amount: 1200      →  PHP 1,200.00   (whole pesos)
 *   PayMongo    amount: 120000    →  PHP 1,200.00   (centavos)
 *   Dragonpay   amount: "1200.00" →  PHP 1,200.00   (decimal string)
 *
 * Get it backwards in either direction and you either bill somebody a hundred
 * times their subscription or collect one percent of it. Neither is caught by
 * anything downstream: `settleInvoice()` demands the payment equal the invoice
 * total exactly, so an underpaid invoice stays unpaid and the customer stays
 * disconnected *after paying*.
 *
 * So the canonical form inside this system is always a 2dp string — what
 * `money.js` produces and what DECIMAL(12,2) stores — and conversion happens
 * once, at the adapter boundary, through these functions. An adapter that does
 * its own `* 100` is a bug waiting for a release.
 *
 * The Xendit figure above is not inference. V2 confirmed it against a live
 * sandbox invoice: `amount: 4999` with `currency: 'PHP'` rendered as
 * PHP 4,999.00 on the checkout page. Xendit's own docs cannot settle it —
 * every example is IDR, whose sub-unit has been dead for decades, so whole
 * and minor units are the same number there.
 */

/**
 * Whole pesos, as a number. Xendit's unit.
 *
 * Throws on a fractional amount rather than rounding. Every invoice total in
 * this system is already 2dp, so a fraction here means the caller passed
 * centavos by mistake — and silently rounding that away would hide the very
 * mistake this file exists to prevent.
 *
 * @param {string|number} amount canonical 2dp amount, e.g. "1200.00".
 * @returns {number} e.g. 1200
 */
export const toWholePesos = (amount) => {
  const value = money(amount);
  if (!value.decimalPlaces || value.decimalPlaces() > 0) {
    throw new Error(
      `Cannot send ${toAmount(amount)} as whole pesos — this gateway does not accept centavos`
    );
  }
  return value.toNumber();
};

/**
 * Centavos, as an integer. PayMongo's unit.
 *
 * Multiplied with decimal.js, not `* 100`: in floating point
 * `1200.10 * 100` is `120009.99999999999`, and `Math.round` would rescue that
 * particular case while quietly failing on another.
 *
 * @param {string|number} amount canonical 2dp amount.
 * @returns {number} e.g. 120000
 */
export const toCentavos = (amount) => {
  const value = money(amount).times(100);
  if (!value.isInteger()) {
    throw new Error(`Amount ${toAmount(amount)} has sub-centavo precision`);
  }
  return value.toNumber();
};

/**
 * A canonical 2dp string. Dragonpay's unit, and this system's own.
 *
 * @param {string|number} amount
 * @returns {string} e.g. "1200.00"
 */
export const toDecimalString = (amount) => toAmount(amount);

/**
 * Back from whole pesos to canonical form, for reading a gateway's response.
 * @param {number|string} value
 * @returns {string}
 */
export const fromWholePesos = (value) => toAmount(value);

/**
 * Back from centavos to canonical form.
 * @param {number|string} value
 * @returns {string}
 */
export const fromCentavos = (value) => money(value).dividedBy(100).toFixed(2);

export default {
  toWholePesos,
  toCentavos,
  toDecimalString,
  fromWholePesos,
  fromCentavos,
};
