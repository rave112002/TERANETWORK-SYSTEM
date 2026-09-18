import { writeAudit } from "../../utils/audit.js";
import {
  getAllSettings,
  getBillingSchedule,
  getRecoveryAfterDays,
  parseIntSetting,
  setSetting,
  SETTING_KEYS,
  validateBillingSchedule,
} from "./settings.service.js";

/**
 * Reading and changing the runtime settings (dry-run, billing schedule, grace
 * days, VAT, pull-out delay) — one implementation for both callers:
 *
 *   - the branch's Admin portal   (controllers/v1/admin/system.controller.js)
 *   - the central SuperAdmin      (controllers/v1/manage/system.controller.js)
 *
 * The rules must not differ by who is asking, so they live here.
 */

/**
 * The settings, typed (booleans and numbers, not stored strings), plus who last
 * changed each one.
 *
 * @param {Object} db
 * @param {string} companyId
 */
export const readSystemSettings = async (db, companyId) => {
  const raw = await getAllSettings(db, companyId);

  const rows = await db.query(
    `SELECT settingKey, description, updatedBy, dateUpdated
       FROM system_settings WHERE companyId = ?`,
    [companyId]
  );
  const meta = Object.fromEntries(rows.map((r) => [r.settingKey, r]));

  // Through the same parser the billing jobs use, so the screen can never show
  // a number the worker would reject as junk.
  const schedule = await getBillingSchedule(db, companyId);
  const recoveryAfterDays = await getRecoveryAfterDays(db, companyId);

  return {
    settings: {
      DRY_RUN: raw.DRY_RUN === "true",
      GRACE_DAYS: schedule.graceDays,
      VAT_RATE: Number.parseFloat(raw.VAT_RATE),
      RECONNECTION_FEE_ENABLED: raw.RECONNECTION_FEE_ENABLED === "true",

      STATEMENT_DAY: schedule.statementDay,
      DUE_DAY: schedule.dueDay,
      REMINDER_DAYS_BEFORE: schedule.reminderDaysBefore,
      CYCLE_HOUR: schedule.cycleHour,
      DAILY_HOUR: schedule.dailyHour,
      DUNNING_HOUR: schedule.dunningHour,

      RECOVERY_AFTER_DAYS: recoveryAfterDays,
    },
    meta,
  };
};

const SCHEDULE_FIELDS = {
  [SETTING_KEYS.STATEMENT_DAY]: "statementDay",
  [SETTING_KEYS.DUE_DAY]: "dueDay",
  [SETTING_KEYS.GRACE_DAYS]: "graceDays",
  [SETTING_KEYS.DAILY_HOUR]: "dailyHour",
  [SETTING_KEYS.DUNNING_HOUR]: "dunningHour",
};

/**
 * Apply a partial update (already validated field by field by
 * `updateSettingsSchema`), audited with before and after in one transaction.
 *
 * ── The schedule is judged as a whole ───────────────────────────────────────
 *
 * "Due day 20" is fine or catastrophic depending on the statement day already
 * stored, so the stored schedule is merged with the incoming changes and the
 * result checked before anything is written. A refused schedule leaves no
 * half-applied settings, and the message says which two values disagree.
 *
 * @param {Object} db
 * @param {Object} args
 * @param {string} args.companyId
 * @param {Object} args.updates
 * @param {string} args.updatedBy  an accountId, or `system:superadmin:<user>`
 * @param {Object} args.context    audit context (getAuditContext / manageAuditContext)
 * @returns {Promise<{error: string} | {changed: string[]}>}
 */
export const updateSystemSettings = async (db, { companyId, updates, updatedBy, context }) => {
  if (Object.keys(SCHEDULE_FIELDS).some((key) => key in updates)) {
    const merged = await getBillingSchedule(db, companyId);
    for (const [key, field] of Object.entries(SCHEDULE_FIELDS)) {
      if (key in updates) merged[field] = parseIntSetting(updates[key], key);
    }
    const problem = validateBillingSchedule(merged);
    if (problem) return { error: problem };
  }

  let conn;
  try {
    conn = await db.beginTransaction();

    const [currentRows] = await conn.execute(
      `SELECT settingKey, settingValue FROM system_settings WHERE companyId = ?`,
      [companyId]
    );
    const before = Object.fromEntries(currentRows.map((r) => [r.settingKey, r.settingValue]));
    const after = { ...before };

    for (const [key, value] of Object.entries(updates)) {
      // Stored as strings; booleans become "true"/"false" here and nowhere else.
      const stored = String(value);
      await setSetting(conn, { companyId, key, value: stored, updatedBy });
      after[key] = stored;
    }

    const changed = Object.keys(updates).filter((k) => before[k] !== after[k]);

    await writeAudit(conn, {
      context,
      module: "system",
      action: "settings.update",
      description:
        // Called out by name: this is the one that stops device commands.
        "DRY_RUN" in updates
          ? `Dry-run mode turned ${updates.DRY_RUN ? "ON — device commands will be logged, not executed" : "OFF — device commands will execute"}`
          : `Updated ${changed.join(", ") || "settings"}`,
      before,
      after,
    });

    await db.commit(conn);
    return { changed };
  } catch (err) {
    if (conn) await db.rollback(conn);
    throw err;
  }
};

export default { readSystemSettings, updateSystemSettings };
