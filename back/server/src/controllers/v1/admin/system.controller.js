import express from "express";

import { catchAsync, validateBody, validateQuery } from "../../../utils/catchAsync.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import { gatewayStatus } from "../../../lib/payment-gateways/index.js";
import { branchScope, getScopedBranchIds } from "../../../utils/branchScope.js";
import { getAuditContext, writeAudit } from "../../../utils/audit.js";
import {
  SETTING_KEYS,
  getAllSettings,
  getBillingSchedule,
  getRecoveryAfterDays,
  parseIntSetting,
  setSetting,
  validateBillingSchedule,
} from "../../../lib/settings/settings.service.js";
import { getQueueStats } from "../../../lib/jobs/jobs.queue.js";
import {
  updateSettingsSchema,
  listJobsQuerySchema,
} from "../../../validators/system.validator.js";

const router = express.Router();

/**
 * System settings and the background job queue.
 *
 * These two share a screen and a permission because they share an audience:
 * whoever is trusted to flip the kill switch is exactly who needs to see what
 * the worker is doing with it.
 */

/**
 * GET /settings
 *
 * Values come back typed rather than as the strings they are stored as, so a
 * toggle in the UI is bound to a boolean and a number input to a number.
 */
router.get(
  "/settings",
  checkPermission("system", null, "read"),
  catchAsync(async (req, res) => {
    const { companyId } = req.user;
    const raw = await getAllSettings(req.db, companyId);

    const rows = await req.db.query(
      `SELECT settingKey, description, updatedBy, dateUpdated
       FROM system_settings WHERE companyId = ?`,
      [companyId]
    );
    const meta = Object.fromEntries(rows.map((r) => [r.settingKey, r]));

    // The schedule comes back through the same parser the billing jobs use, so
    // the screen can never show a number the worker would reject as junk.
    const schedule = await getBillingSchedule(req.db, companyId);
    const recoveryAfterDays = await getRecoveryAfterDays(req.db, companyId);

    return res.sendSuccess("Settings retrieved successfully", {
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
    });
  })
);

/**
 * PUT /settings
 *
 * Every change is audited with before and after. These decide who gets
 * disconnected and what they are charged, so "who turned dry-run off, and
 * when?" has to be answerable months later.
 */
router.put(
  "/settings",
  checkPermission("system", null, "write"),
  validateBody(updateSettingsSchema),
  catchAsync(async (req, res) => {
    const { companyId, accountId } = req.user;
    const updates = req.body;

    // ── Check the schedule as a whole before writing any of it ──────────────
    //
    // The validator has already checked each value on its own. What it cannot
    // check is the combination, because an update is partial: "due day 20" is
    // fine or catastrophic depending on the statement day already stored. So
    // the stored schedule is merged with the incoming changes and the result is
    // judged as one thing.
    //
    // Refused before the transaction opens, so a rejected schedule leaves no
    // half-applied settings behind and the message says which two values
    // disagree rather than "invalid".
    const SCHEDULE_FIELDS = {
      [SETTING_KEYS.STATEMENT_DAY]: "statementDay",
      [SETTING_KEYS.DUE_DAY]: "dueDay",
      [SETTING_KEYS.GRACE_DAYS]: "graceDays",
      [SETTING_KEYS.DAILY_HOUR]: "dailyHour",
      [SETTING_KEYS.DUNNING_HOUR]: "dunningHour",
    };

    if (Object.keys(SCHEDULE_FIELDS).some((key) => key in updates)) {
      const merged = await getBillingSchedule(req.db, companyId);
      for (const [key, field] of Object.entries(SCHEDULE_FIELDS)) {
        if (key in updates) merged[field] = parseIntSetting(updates[key], key);
      }

      const problem = validateBillingSchedule(merged);
      if (problem) return res.sendError(problem, 400);
    }

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const [currentRows] = await conn.execute(
        `SELECT settingKey, settingValue FROM system_settings WHERE companyId = ?`,
        [companyId]
      );
      const before = Object.fromEntries(
        currentRows.map((r) => [r.settingKey, r.settingValue])
      );

      const after = { ...before };

      for (const [key, value] of Object.entries(updates)) {
        // Stored as strings, so booleans and numbers are normalised on the way
        // in — never `String(value)` on a boolean somewhere else and "TRUE"
        // here.
        const stored = typeof value === "boolean" ? String(value) : String(value);
        await setSetting(conn, { companyId, key, value: stored, updatedBy: accountId });
        after[key] = stored;
      }

      const changed = Object.keys(updates).filter((k) => before[k] !== after[k]);

      await writeAudit(conn, {
        context: getAuditContext(req),
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

      await req.db.commit(conn);
      return res.sendSuccess("Settings updated successfully", { changed });
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * GET /payment-gateway
 *
 * Which gateway is collecting, and whether it is pointed at test credentials.
 *
 * A read, and only a read. The provider and its keys come from the environment
 * — see lib/payment-gateways/index.js for why they cannot live in
 * `system_settings` — so this screen reports the deployment rather than
 * configuring it. Reporting it still matters: "are we live?" should be
 * answerable without SSH access, and `testMode: null` (an unrecognised key
 * prefix) must be shown as unknown rather than rounded to the comfortable
 * answer.
 */
router.get(
  "/payment-gateway",
  checkPermission("system", null, "read"),
  catchAsync(async (req, res) =>
    res.sendSuccess("Payment gateway status", { gateway: gatewayStatus() })
  )
);

/**
 * GET /jobs
 *
 * The queue, readable. The whole point of putting it in MySQL rather than a
 * broker is that it can be looked at — this is that, without a SQL client.
 */
router.get(
  "/jobs",
  checkPermission("system", null, "read"),
  validateQuery(listJobsQuerySchema),
  catchAsync(async (req, res) => {
    const {
      page = 1,
      pageSize = 20,
      status,
      type,
      branchId,
      sortBy = "dateCreated",
      sortOrder = "DESC",
    } = req.query;
    const { companyId } = req.user;
    const offset = (page - 1) * pageSize;

    // Company-wide jobs carry no branch, so they must not be filtered out for a
    // branch user — hence the `IS NULL` arm.
    const scope = branchScope("j.branchId", getScopedBranchIds(req.user));
    const scopeClause = scope.clause ? ` AND (j.branchId IS NULL${scope.clause})` : "";

    const params = [companyId, ...scope.params];
    let whereClause = `WHERE j.companyId = ?${scopeClause}`;

    if (branchId) {
      whereClause += " AND j.branchId = ?";
      params.push(branchId);
    }
    if (status) {
      whereClause += " AND j.status = ?";
      params.push(status);
    }
    if (type) {
      whereClause += " AND j.type = ?";
      params.push(type);
    }

    const allowedSortColumns = ["dateCreated", "dateUpdated", "nextRunAt"];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : "dateCreated";
    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const [countRows, jobs, stats] = await Promise.all([
      req.db.query(`SELECT COUNT(*) as total FROM jobs j ${whereClause}`, params),
      req.db.query(
        `SELECT j.jobId, j.companyId, j.branchId, j.type, j.payload, j.status,
                j.attempts, j.maxAttempts, j.nextRunAt, j.dedupeKey, j.lockedBy,
                j.lastError, j.startedAt, j.finishedAt, j.dateCreated, j.dateUpdated,
                b.name AS branchName
         FROM jobs j
         LEFT JOIN branches b ON b.branchId = j.branchId
         ${whereClause}
         ORDER BY j.${safeSortBy} ${safeSortOrder}
         LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
      getQueueStats(req.db, companyId),
    ]);

    const total = countRows[0]?.total || 0;

    return res.sendSuccess("Jobs retrieved successfully", {
      jobs,
      stats,
      pagination: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  })
);

export default router;
