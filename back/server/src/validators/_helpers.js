import { z } from "zod";

/**
 * Wrap a schema so an "empty" value is treated as absent (undefined).
 *
 * Three shapes all mean "no value" for an optional field mapped to a NULLable
 * column, and all three must be accepted:
 *   - `""`        HTML forms and multipart/form-data send this for cleared
 *                 fields; a query string sends it for any rendered-but-unset param
 *   - `null`      what a JSON client sends to explicitly clear a field (our own
 *                 form drawers post `value || null`)
 *   - `undefined` the key omitted entirely
 *
 * Normalising to `undefined` lets `.optional()` accept all three, and the
 * controllers' `value || null` then writes SQL NULL. This matches the
 * "optional/nullable fields mirror the column's NULL constraint" rule in
 * docs/validators.md.
 */
export const emptyToUndefined = (schema) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), schema);

/** Optional free-text string, capped at `max`, tolerant of "". */
export const optionalString = (max) =>
  emptyToUndefined(z.string().max(max).optional());

/** Optional email, capped at `max`, tolerant of "". */
export const optionalEmail = (max = 100) =>
  emptyToUndefined(z.string().email("Invalid email address").max(max).optional());

/* ── Phone ──────────────────────────────────────────────────────────────────
 * Canonical stored format is `09XX XXXX XXX` (PH mobile, 11 digits grouped
 * 4-4-3). See the phone entry in the repo-root CLAUDE.md.
 */

/** Strip to digits and normalise the common PH prefixes to `09XXXXXXXXX`. */
const toLocalDigits = (input) => {
  const digits = String(input).replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length === 12) return `0${digits.slice(2)}`; // 639…
  if (digits.startsWith("9") && digits.length === 10) return `0${digits}`; // 9…
  return digits;
};

/** `09XXXXXXXXX` → `09XX XXXX XXX` */
export const formatPhone = (digits) =>
  `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`;

/**
 * Optional PH mobile number.
 *
 * Accepts the canonical grouped form, bare 11 digits, and `+63`/`63`/`9…`
 * variants (so API clients aren't forced to pre-format), then **transforms to
 * `09XX XXXX XXX`** — controllers and the DB only ever see the canonical form.
 * Empty string / null / omitted all mean "no number".
 */
export const optionalPhone = () =>
  emptyToUndefined(
    z
      .string()
      .max(20)
      .optional()
      .refine(
        (v) => v === undefined || /^09\d{9}$/.test(toLocalDigits(v)),
        "Phone must be a valid PH mobile number, e.g. 0912 3456 789",
      )
      .transform((v) => (v === undefined ? undefined : formatPhone(toLocalDigits(v)))),
  );

/* ── Query-string helpers ───────────────────────────────────────────────────
 * A query string cannot express "absent" for a rendered param: an unset filter
 * arrives as `?status=` (empty string), not as a missing key. axios serialises
 * `{ status: "" }` exactly that way. So EVERY optional query field must treat ""
 * as absent, or a default page load 400s. Use these instead of bare z.enum().
 */

/** Optional enum filter, tolerant of "". */
export const queryEnum = (values) => emptyToUndefined(z.enum(values).optional());

/**
 * Enum with a fallback (sortBy/sortOrder). "" → the default, so the controller
 * never receives undefined for a field it calls .toUpperCase() on.
 */
export const queryEnumDefault = (values, defaultValue) =>
  emptyToUndefined(z.enum(values).default(defaultValue));

/** Coerced positive integer with a fallback ("" would otherwise coerce to 0). */
export const queryInt = (defaultValue, { min = 1, max } = {}) => {
  let schema = z.coerce.number().int().min(min);
  if (max !== undefined) schema = schema.max(max);
  return emptyToUndefined(schema.default(defaultValue));
};

/* ── Money & coordinates ────────────────────────────────────────────────────
 * The ISP domain adds two field shapes the template did not have. Both are
 * here rather than in each validator so the rules (and the error messages a
 * customer-facing form shows) stay identical everywhere.
 */

/**
 * A peso amount for a DECIMAL(12,2) column.
 *
 * Coerced, because an HTML number input posts a string. Capped at the column's
 * real limit — DECIMAL(12,2) holds up to 9,999,999,999.99 — so an over-large
 * value is a 400 with a readable message instead of a driver error. Rejects
 * more than 2 decimal places rather than silently rounding someone's bill.
 *
 * @param {{ min?: number, required?: boolean }} [options]
 */
export const money = ({ min = 0, required = true } = {}) => {
  const schema = z.coerce
    .number({ error: "Must be a number" })
    .min(min, `Must be at least ${min}`)
    .max(9999999999.99, "Amount is too large")
    .refine(
      (v) => Number.isInteger(Math.round(v * 100)) && Math.abs(v * 100 - Math.round(v * 100)) < 1e-9,
      "Use at most 2 decimal places",
    );
  return required ? schema : emptyToUndefined(schema.optional());
};

/** Optional latitude for a DECIMAL(10,7) column. */
export const optionalLatitude = () =>
  emptyToUndefined(
    z.coerce
      .number({ error: "Latitude must be a number" })
      .min(-90, "Latitude must be between -90 and 90")
      .max(90, "Latitude must be between -90 and 90")
      .optional(),
  );

/** Optional longitude for a DECIMAL(10,7) column. */
export const optionalLongitude = () =>
  emptyToUndefined(
    z.coerce
      .number({ error: "Longitude must be a number" })
      .min(-180, "Longitude must be between -180 and 180")
      .max(180, "Longitude must be between -180 and 180")
      .optional(),
  );
