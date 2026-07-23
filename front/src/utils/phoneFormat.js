/**
 * Philippine mobile number helpers.
 *
 * Canonical format (stored + sent to the API): `09XX XXXX XXX`
 *   11 digits, grouped 4-4-3 with single spaces — e.g. `0912 3456 789`.
 *
 * The UI hint is always the concrete example, never the `09XX…` mask.
 * See the phone entry in the repo-root CLAUDE.md.
 */

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

/**
 * Custom validator for Ant Design Form.
 *
 * Phone is OPTIONAL: every `phone` column is NULL-able and the API writes
 * `phone || null`, so an empty value passes. Only the *format* is enforced, and
 * only once something has been typed.
 *
 * If a form ever needs phone to be mandatory, pair this with a separate
 * `{ required: true }` rule — that way Ant also renders the required asterisk,
 * instead of the field erroring "required" with no `*` next to its label.
 */
export const phoneValidator = (_, value) => {
  if (!value) return Promise.resolve();

  if (!isValidPhoneNumber(value)) {
    return Promise.reject(
      new Error(`Enter a valid mobile number, e.g. ${PHONE_PLACEHOLDER}`),
    );
  }

  return Promise.resolve();
};

/**
 * onChange handler that types the spaces in for the user.
 *
 * Usage:
 *   <Input onChange={(e) => handlePhoneInput(e, form, "phone")} />
 */
export const handlePhoneInput = (e, form, fieldName = "phone") => {
  const grouped = groupPhoneDigits(toLocalDigits(e.target.value));
  form.setFieldsValue({ [fieldName]: grouped });
};
