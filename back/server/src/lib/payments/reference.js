/**
 * Payment reference numbers — the transaction id printed on a GCash receipt,
 * a QR Ph confirmation or a bank transfer slip.
 *
 * ── Why they are stored in `payments.providerPaymentId` ─────────────────────
 *
 * That column is UNIQUE, and `settleInvoice()` already refuses a payment whose
 * id is on file. So a reference stored there makes it impossible to record the
 * same GCash transaction twice — by two clerks, or by one clerk working from
 * the same notification on two different days. Kept in `notes`, nothing stopped
 * that, and a double entry marks a second customer's invoice paid with money
 * that belongs to the first.
 *
 * It is also the key a future GCash import will settle through
 * (docs/gcash-payment-flow.md), so a payment entered by hand today and the same
 * transaction imported tomorrow collide instead of counting twice — provided
 * both go through `normalizePaymentReference`.
 *
 * ── Normalised, because people copy them inconsistently ─────────────────────
 *
 * GCash displays a reference as `1234 567 890123`; the same number gets pasted
 * as `1234567890123` or typed with hyphens. Those must be one key, not three,
 * or the duplicate guard only catches identical typing.
 */

/** A reference is required for the merchant-QR channels, where double entry is the real risk. */
export const REFERENCE_REQUIRED_CHANNELS = ["GCASH", "QRPH"];

/** Cash has no transaction id, and accepting one would let a typo block a real payment later. */
export const REFERENCE_FORBIDDEN_CHANNELS = ["CASH"];

/** After normalisation: letters and digits only. Six is shorter than any real scheme's id. */
export const REFERENCE_PATTERN = /^[A-Z0-9]{6,64}$/;

/**
 * The canonical form of a reference: separators removed, upper-cased.
 *
 * @param {string|null|undefined} raw
 * @returns {string} empty string when there is nothing left.
 *
 * @example normalizePaymentReference(" 1234 567-890123 ") // "1234567890123"
 */
export const normalizePaymentReference = (raw) =>
  String(raw ?? "")
    .replace(/[\s\-_.]/g, "")
    .toUpperCase();

export default {
  REFERENCE_REQUIRED_CHANNELS,
  REFERENCE_FORBIDDEN_CHANNELS,
  REFERENCE_PATTERN,
  normalizePaymentReference,
};
