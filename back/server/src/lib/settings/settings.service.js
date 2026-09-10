import { getCurrentTimestampLocal } from "../../utils/dateUtils.js";

/**
 * Runtime settings — the values that must be changeable without a restart.
 *
 * `DRY_RUN` is a kill switch someone reaches for while a disconnect is going
 * wrong; the billing schedule is a set of business rules the client revises.
 * None of them can live in the environment.
 *
 * ── The bug this module exists to prevent ───────────────────────────────────
 *
 * The previous build read the grace period as `parseInt(raw, 10) || 3` in four
 * places. `parseInt("0")` is `0`, and `0 || 3` is `3` — so setting a zero-day
 * grace silently gave every customer three extra days, the dunning sweep looked
 * broken, and nothing anywhere logged an error.
 *
 * The client's model sets **GRACE_DAYS to 0**: due on the 2nd, cut off at 20:00
 * on the 2nd. So zero is not an edge case here, it is the configured value.
 *
 * ── The billing schedule ────────────────────────────────────────────────────
 *
 * The statement day, due day, reminder lead time and the hours the three
 * scheduled runs fire at all live here rather than in code or in cron strings.
 * An admin changes them on the System screen and the worker picks them up on
 * its next tick — no deploy, no restart. See {@link validateBillingSchedule}
 * for the one combination that is not allowed.
 */

export const SETTING_KEYS = {
  DRY_RUN: "DRY_RUN",
  GRACE_DAYS: "GRACE_DAYS",
  VAT_RATE: "VAT_RATE",
  RECONNECTION_FEE_ENABLED: "RECONNECTION_FEE_ENABLED",

  // The billing schedule.
  STATEMENT_DAY: "STATEMENT_DAY",
  DUE_DAY: "DUE_DAY",
  REMINDER_DAYS_BEFORE: "REMINDER_DAYS_BEFORE",
  CYCLE_HOUR: "CYCLE_HOUR",
  DAILY_HOUR: "DAILY_HOUR",
  DUNNING_HOUR: "DUNNING_HOUR",

  // How long a suspended account waits before staff are prompted to pull the
  // modem out. Nothing happens automatically when it elapses.
  RECOVERY_AFTER_DAYS: "RECOVERY_AFTER_DAYS",
};

/**
 * Fallbacks used only when a row is missing entirely — a company created before
 * a setting existed, say. Migrations 005 and 011 seed all of these, so in
 * practice they are a safety net rather than the source of truth.
 *
 * **They match what the migrations seed, deliberately.** An earlier version
 * fell back to a grace of 3 while the database held 0, on the reasoning that
 * more grace is the safer direction to be wrong in. That reasoning cost more
 * than it bought: the two numbers disagreed, so a missing row behaved
 * differently from a present one and nothing said so. A fallback that agrees
 * with the seed cannot hide a gap.
 */
const DEFAULTS = {
  [SETTING_KEYS.DRY_RUN]: "false",
  [SETTING_KEYS.GRACE_DAYS]: "0",
  [SETTING_KEYS.VAT_RATE]: "0",
  [SETTING_KEYS.RECONNECTION_FEE_ENABLED]: "false",

  [SETTING_KEYS.STATEMENT_DAY]: "25",
  [SETTING_KEYS.DUE_DAY]: "2",
  [SETTING_KEYS.REMINDER_DAYS_BEFORE]: "2",
  [SETTING_KEYS.CYCLE_HOUR]: "9",
  [SETTING_KEYS.DAILY_HOUR]: "8",
  [SETTING_KEYS.DUNNING_HOUR]: "20",

  [SETTING_KEYS.RECOVERY_AFTER_DAYS]: "60",
};

/**
 * Accepted range for each whole-number setting. A value outside its range is
 * treated as junk and falls back to the default rather than being clamped —
 * clamping would let a typo run as a plausible-looking schedule.
 *
 * ── Why the day-of-month settings stop at 28 ────────────────────────────────
 *
 * 28 is the last day that exists in every month. A statement day of 30 would
 * quietly become the 28th each February and the 30th otherwise, so the schedule
 * would move on its own once a year. Anyone who genuinely wants "the last day
 * of the month" needs that as its own rule, not as a number that happens to be
 * too big.
 */
export const SETTING_BOUNDS = {
  [SETTING_KEYS.GRACE_DAYS]: { min: 0, max: 365 },
  [SETTING_KEYS.STATEMENT_DAY]: { min: 1, max: 28 },
  [SETTING_KEYS.DUE_DAY]: { min: 1, max: 28 },
  [SETTING_KEYS.REMINDER_DAYS_BEFORE]: { min: 0, max: 28 },
  [SETTING_KEYS.CYCLE_HOUR]: { min: 0, max: 23 },
  [SETTING_KEYS.DAILY_HOUR]: { min: 0, max: 23 },
  [SETTING_KEYS.DUNNING_HOUR]: { min: 0, max: 23 },
  // At least a day, so a misplaced 0 cannot suggest pulling a modem out the
  // same evening the customer was cut off.
  [SETTING_KEYS.RECOVERY_AFTER_DAYS]: { min: 1, max: 365 },
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
 * Parse a stored string as a whole number within its declared bounds.
 *
 * Out of range and unparseable both fall back to the default. Note what this is
 * NOT: `Number.parseInt(raw, 10) || fallback`. That is the bug at the top of
 * this file — it turns a configured 0 into the fallback.
 *
 * @param {string|number|null} raw
 * @param {string} key one of {@link SETTING_KEYS}; supplies the bounds.
 * @returns {number}
 */
export const parseIntSetting = (raw, key) => {
  const bounds = SETTING_BOUNDS[key];
  const fallback = Number.parseInt(DEFAULTS[key], 10);
  if (!bounds) return fallback;

  const parsed = Number.parseInt(raw, 10);
  // Not `parsed || fallback`.
  if (!Number.isFinite(parsed) || parsed < bounds.min || parsed > bounds.max) return fallback;
  return parsed;
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
 * It is in fact the client's value: due on the 2nd, cut off the same evening.
 *
 * @returns {Promise<number>} 0–365
 */
export const getGraceDays = async (db, companyId) =>
  parseIntSetting(
    await getSetting(db, companyId, SETTING_KEYS.GRACE_DAYS),
    SETTING_KEYS.GRACE_DAYS
  );

/**
 * The whole billing schedule in one read.
 *
 * One round trip rather than seven: every caller needs several of these at
 * once, and the cycle would otherwise issue a query per knob per subscription.
 *
 * @param {Object} db
 * @param {string} companyId
 * @returns {Promise<{
 *   statementDay: number, dueDay: number, graceDays: number,
 *   reminderDaysBefore: number, cycleHour: number, dailyHour: number,
 *   dunningHour: number
 * }>}
 */
export const getBillingSchedule = async (db, companyId) => {
  const raw = await getAllSettings(db, companyId);
  const read = (key) => parseIntSetting(raw[key], key);

  return {
    statementDay: read(SETTING_KEYS.STATEMENT_DAY),
    dueDay: read(SETTING_KEYS.DUE_DAY),
    graceDays: read(SETTING_KEYS.GRACE_DAYS),
    reminderDaysBefore: read(SETTING_KEYS.REMINDER_DAYS_BEFORE),
    cycleHour: read(SETTING_KEYS.CYCLE_HOUR),
    dailyHour: read(SETTING_KEYS.DAILY_HOUR),
    dunningHour: read(SETTING_KEYS.DUNNING_HOUR),
  };
};

/**
 * The combinations of schedule settings that must be refused.
 *
 * Each value is individually sane — that is what the bounds above are for.
 * These two rules are about how they sit together, and both protect a customer
 * from something the system would otherwise do quietly.
 *
 * ── 1. The statement day must fall after the disconnection day ──────────────
 *
 * The billing period is the calendar month, and a suspended subscription is
 * skipped by the cycle. Those two facts only add up to "a suspended customer
 * accrues nothing" if the cycle runs AFTER the previous period's cut-off:
 *
 *   Jul 25  July invoice issued, due Aug 2
 *   Aug  2  unpaid → suspended
 *   Aug 25  cycle runs → subscription is suspended → SKIPPED, no August bill
 *   Sep  5  customer pays → reconnected
 *   Sep 25  cycle runs → active again → September billed in full
 *
 * Move the statement day to the 1st and the August invoice is generated on
 * Aug 1, the day BEFORE the Aug 2 disconnection — so every reconnected customer
 * owes a month they never had service for. Nothing errors; the invoices just
 * come out wrong, and the first anyone hears of it is a customer complaint.
 *
 * ── 2. The daily run must come before the disconnection sweep ───────────────
 *
 * The daily run is what tells a customer their bill is due today and their
 * service goes off this evening. Schedule it after the sweep and the warning
 * arrives the morning after the disconnection it was warning about.
 *
 * @param {Object} schedule as returned by {@link getBillingSchedule}.
 * @returns {string|null} an explanation, or null if the combination is allowed.
 */
export const validateBillingSchedule = ({
  statementDay,
  dueDay,
  graceDays,
  dailyHour,
  dunningHour,
}) => {
  const cutOffDay = dueDay + graceDays;

  const days = (n) => `${n} grace day${n === 1 ? "" : "s"}`;

  // A cut-off past the 28th cannot be fixed by moving the statement day, because
  // there is no day of the month left to move it to. Saying "move it later than
  // day 32" would be arithmetically consistent and useless.
  if (cutOffDay > 28) {
    return (
      `Payment falls due on day ${dueDay} and ${days(graceDays)} takes the cut-off past the ` +
      `end of the month, so there is no day left to issue the next invoice on. The grace ` +
      `period has to be short enough that the previous month is settled before the next ` +
      `statement goes out — at most ${28 - dueDay} day${28 - dueDay === 1 ? "" : "s"} with ` +
      `this due date.`
    );
  }

  if (statementDay <= cutOffDay) {
    return (
      `Invoices are issued on day ${statementDay}, but payment for the previous month ` +
      `is not settled until day ${cutOffDay} (due on day ${dueDay}, plus ${days(graceDays)}). ` +
      `Issuing before the cut-off bills customers who are about to be disconnected, so ` +
      `anyone who reconnects owes a month they had no service for. Move the statement day ` +
      `later than day ${cutOffDay}.`
    );
  }

  if (dailyHour >= dunningHour) {
    const hh = (h) => `${String(h).padStart(2, "0")}:00`;
    return (
      `The daily notice run is set for ${hh(dailyHour)} and the disconnection sweep for ` +
      `${hh(dunningHour)}. The notice has to go out first, or customers are cut off before ` +
      `they are told it is coming.`
    );
  }

  return null;
};

/**
 * Days suspended before an account is suggested for modem recovery.
 *
 * A suggestion and nothing more: the transition to 'for_recovery' is a staff
 * decision, by the client's explicit instruction. This number only decides when
 * an account appears on the list somebody reviews.
 *
 * @returns {Promise<number>} 1–365
 */
export const getRecoveryAfterDays = async (db, companyId) =>
  parseIntSetting(
    await getSetting(db, companyId, SETTING_KEYS.RECOVERY_AFTER_DAYS),
    SETTING_KEYS.RECOVERY_AFTER_DAYS
  );

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
  SETTING_BOUNDS,
  getSetting,
  getAllSettings,
  setSetting,
  parseBoolean,
  parseIntSetting,
  isDryRun,
  getGraceDays,
  getBillingSchedule,
  validateBillingSchedule,
  getRecoveryAfterDays,
  getVatRate,
  isReconnectionFeeEnabled,
};
