import { getCurrentTimestampLocal } from "../../utils/dateUtils.js";

/**
 * Runtime settings — the values that must be changeable without a restart.
 *
 * `DRY_RUN` is a kill switch someone reaches for while a disconnect is going
 * wrong; `GRACE_DAYS` is a business rule the client may revise. Neither can
 * live in the environment.
 *
 * ── The bug this module exists to prevent ───────────────────────────────────
 *
 * The previous build read the grace period as `parseInt(raw, 10) || 3` in four
 * places. `parseInt("0")` is `0`, and `0 || 3` is `3` — so setting a zero-day
 * grace silently gave every customer three extra days, the dunning sweep looked
 * broken, and nothing anywhere logged an error.
 *
 * The client's corrected model sets **GRACE_DAYS to 0**: disconnection happens
 * on the due date. So zero is not an edge case here, it is the configured
 * value, and {@link getGraceDays} treats it as valid. See
 * `docs/reference/PENDING-Billing-Model-Corrections.md`.
 */

export const SETTING_KEYS = {
  DRY_RUN: "DRY_RUN",
  GRACE_DAYS: "GRACE_DAYS",
  VAT_RATE: "VAT_RATE",
  RECONNECTION_FEE_ENABLED: "RECONNECTION_FEE_ENABLED",
};

/**
 * Fallbacks used only when a row is missing entirely — a company created before
 * a setting existed, say. Migration 005 seeds all of these, so in practice they
 * are a safety net rather than the source of truth.
 *
 * GRACE_DAYS falls back to 3, NOT 0: erring toward more grace can only delay a
 * disconnection, while erring toward less cuts off paying customers early.
 */
const DEFAULTS = {
  [SETTING_KEYS.DRY_RUN]: "false",
  [SETTING_KEYS.GRACE_DAYS]: "3",
  [SETTING_KEYS.VAT_RATE]: "0",
  [SETTING_KEYS.RECONNECTION_FEE_ENABLED]: "false",
};

/**
 * Read one setting as its raw string.
 *
 * @param {Object} db - `req.db`, or a transaction connection wrapped by {@link withConn}.
 * @param {string} companyId
 * @param {string} key
 * @returns {Promise<string|null>}
 */
export const getSetting = async (db, companyId, key) => {
  const rows = await db.query(
    `SELECT settingValue FROM system_settings WHERE companyId = ? AND settingKey = ? LIMIT 1`,
    [companyId, key]
  );

  if (rows.length === 0) return DEFAULTS[key] ?? null;
  // A row that exists with a NULL value means "explicitly unset", which is
  // different from "never configured" — both fall back, but only the second is
  // a gap worth noticing.
  return rows[0].settingValue ?? DEFAULTS[key] ?? null;
};

/** Read every setting for a company as a plain object, defaults filled in. */
export const getAllSettings = async (db, companyId) => {
  const rows = await db.query(
    `SELECT settingKey, settingValue, description, dateUpdated
     FROM system_settings WHERE companyId = ? ORDER BY settingKey`,
    [companyId]
  );

  const stored = Object.fromEntries(rows.map((r) => [r.settingKey, r.settingValue]));
  return { ...DEFAULTS, ...stored };
};

/**
 * Write one setting. Upserts, so a company missing the row still gets one.
 *
 * @param {import('mysql2/promise').PoolConnection} conn - the caller's
 *   transaction, so the change and its audit row commit together.
 */
export const setSetting = async (conn, { companyId, key, value, updatedBy = null }) => {
  const now = getCurrentTimestampLocal();

  await conn.execute(
    `INSERT INTO system_settings (companyId, settingKey, settingValue, updatedBy, dateCreated, dateUpdated)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       settingValue = VALUES(settingValue),
       updatedBy = VALUES(updatedBy),
       dateUpdated = VALUES(dateUpdated)`,
    [companyId, key, value === null || value === undefined ? null : String(value), updatedBy, now, now]
  );
};

/**
 * Parse a stored string as a boolean.
 *
 * Deliberately strict about what counts as true: anything unrecognised reads as
 * false. For DRY_RUN that is the safe direction — a typo must not silently
 * leave the system rehearsing when staff believe it is live, nor the reverse.
 */
export const parseBoolean = (raw, fallback = false) => {
  if (raw === null || raw === undefined) return fallback;
  const value = String(raw).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(value)) return true;
  if (["false", "0", "no", "off"].includes(value)) return false;
  return fallback;
};

/**
 * Is the kill switch on?
 *
 * When true the provisioning worker logs the command it *would* have sent and
 * stops — no device is touched, no state changes.
 */
export const isDryRun = async (db, companyId) =>
  parseBoolean(await getSetting(db, companyId, SETTING_KEYS.DRY_RUN), false);

/**
 * Days after the due date before service is suspended.
 *
 * **Zero is a valid, configured value** — see the note at the top of this file.
 * Junk, negatives and absurd values fall back to 3, because more grace only
 * delays a disconnection while less cuts off paying customers early.
 *
 * @returns {Promise<number>} 0–365
 */
export const getGraceDays = async (db, companyId) => {
  const raw = await getSetting(db, companyId, SETTING_KEYS.GRACE_DAYS);
  const parsed = Number.parseInt(raw, 10);

  // Not `parsed || 3` — that is the whole bug.
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 365) {
    return Number.parseInt(DEFAULTS[SETTING_KEYS.GRACE_DAYS], 10);
  }
  return parsed;
};

/**
 * Tax rate applied to invoices, as a fraction. 0 today, flipped to 0.12 if VAT
 * ever applies.
 *
 * @returns {Promise<number>} 0–1
 */
export const getVatRate = async (db, companyId) => {
  const raw = await getSetting(db, companyId, SETTING_KEYS.VAT_RATE);
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return 0;
  return parsed;
};

/** Whether a reconnection fee is charged. Disabled by client decision. */
export const isReconnectionFeeEnabled = async (db, companyId) =>
  parseBoolean(await getSetting(db, companyId, SETTING_KEYS.RECONNECTION_FEE_ENABLED), false);

export default {
  SETTING_KEYS,
  getSetting,
  getAllSettings,
  setSetting,
  parseBoolean,
  isDryRun,
  getGraceDays,
  getVatRate,
  isReconnectionFeeEnabled,
};
