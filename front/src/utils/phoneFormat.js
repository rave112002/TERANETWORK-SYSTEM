/**
 * Philippine mobile number helpers.
 *
 * Canonical format (stored + sent to the API): `09XX XXXX XXX`
 *   11 digits, grouped 4-4-3 with single spaces — e.g. `0912 3456 789`.
 *
 * The UI hint is always the concrete example, never the `09XX…` mask.
 * See the phone entry in the repo-root CLAUDE.md.
 */

import { z } from "zod";

/** The placeholder every phone input should use. */
export const PHONE_PLACEHOLDER = "0912 3456 789";

/** Canonical length once formatted: 11 digits + 2 spaces. */
export const PHONE_MAX_LENGTH = 13;

/**
 * Reduce any accepted input to bare local digits (`09XXXXXXXXX`).
 * Handles +63 / 63 / 9… prefixes and strips spaces, dashes, parentheses.
 */
export const toLocalDigits = (phone) => {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");

  if (digits.startsWith("63") && digits.length === 12) {
    digits = `0${digits.slice(2)}`; // 639XXXXXXXXX
  } else if (digits.startsWith("9") && digits.length === 10) {
    digits = `0${digits}`; // 9XXXXXXXXX
  }

  return digits;
};

/** True when the value is a complete PH mobile number. */
export const isValidPhoneNumber = (phone) =>
  /^09\d{9}$/.test(toLocalDigits(phone));

/**
 * Group digits as 4-4-3, tolerating partial input so it can drive an
 * as-you-type mask: "0912" → "0912", "09123456" → "0912 3456".
 */
export const groupPhoneDigits = (digits) => {
  const d = digits.slice(0, 11);
  const parts = [d.slice(0, 4), d.slice(4, 8), d.slice(8, 11)].filter(Boolean);
  return parts.join(" ");
};

/**
 * Format a stored/arbitrary value for display: `09XX XXXX XXX`.
 * Returns the original string untouched if it isn't a valid number, so odd
 * legacy data stays visible rather than silently blanking.
 */
export const formatPhoneDisplay = (phone) => {
  if (!phone) return "";
  const digits = toLocalDigits(phone);
  return isValidPhoneNumber(digits) ? groupPhoneDigits(digits) : phone;
};

/** Normalise to the canonical form for submission. */
export const formatPhoneNumber = (phone) => {
  const digits = toLocalDigits(phone);
  return isValidPhoneNumber(digits) ? groupPhoneDigits(digits) : phone || "";
};

/* ── React Hook Form + Zod ───────────────────────────────────────────────── */

/**
 * As-you-type formatter for a react-hook-form field. Returns the grouped value
 * so the spaces are typed in for the user.
 *
 * Usage:
 *   <Input onChange={(e) => field.onChange(formatPhoneOnChange(e.target.value))} />
 */
export const formatPhoneOnChange = (value) =>
  groupPhoneDigits(toLocalDigits(value));

/**
 * Zod schema fragment for an optional PH phone. Phone is optional everywhere
 * (every `phone` column is NULL-able and the API writes `phone || null`), so an
 * empty string passes; only the *format* is enforced once something is typed.
 *
 * If a form needs phone mandatory, add `.min(1, "…")` in front of the refine so
 * the empty case fails too.
 */
export const zPhone = z
  .string()
  .refine((v) => v === "" || isValidPhoneNumber(v), {
    message: `Enter a valid mobile number, e.g. ${PHONE_PLACEHOLDER}`,
  });
