import express from "express";

import { catchAsync, validateBody, validateQuery } from "../../../utils/catchAsync.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import { gatewayStatus } from "../../../lib/payment-gateways/index.js";
import { branchScope, getScopedBranchIds } from "../../../utils/branchScope.js";
import { getAuditContext } from "../../../utils/audit.js";
import {
  readSystemSettings,
  updateSystemSettings,
} from "../../../lib/settings/systemSettings.service.js";
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
    const result = await readSystemSettings(req.db, req.user.companyId);
    return res.sendSuccess("Settings retrieved successfully", result);
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
    const result = await updateSystemSettings(req.db, {
      companyId: req.user.companyId,
      updates: req.body,
      updatedBy: req.user.accountId,
      context: getAuditContext(req),
    });
    if (result.error) return res.sendError(result.error, 400);
    return res.sendSuccess("Settings updated successfully", { changed: result.changed });
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
