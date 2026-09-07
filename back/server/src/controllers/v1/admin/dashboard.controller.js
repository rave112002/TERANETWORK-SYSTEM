import express from "express";
import { catchAsync } from "../../../utils/catchAsync.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import { moment } from "../../../utils/dateUtils.js";
import { branchScope, getScopedBranchIds } from "../../../utils/branchScope.js";

const router = express.Router();

const TZ = process.env.TIMEZONE || "Asia/Manila";
const SERIES_DAYS = 14;

/**
 * Build a gap-free daily series for the last `days` days (Manila dates).
 * Rows come back as [{ day: 'YYYY-MM-DD', count }] and may skip empty days.
 */
const fillDailySeries = (rows, days = SERIES_DAYS) => {
  const counts = new Map(rows.map((r) => [String(r.day), Number(r.count)]));
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = moment().tz(TZ).subtract(i, "days").format("YYYY-MM-DD");
    series.push({ date, count: counts.get(date) || 0 });
  }
  return series;
};

/**
 * GET /stats
 * Dashboard metrics for the authenticated user's company + branch.
 */
router.get(
  "/stats",
  checkPermission("dashboard", null, "read"),
  catchAsync(async (req, res) => {
    const { companyId } = req.user;
    const since = moment().tz(TZ).subtract(SERIES_DAYS - 1, "days").format("YYYY-MM-DD 00:00:00");

    // Metrics cover every branch the user is assigned to, not just their home
    // branch — an admin over two branches should see both in one dashboard.
    const branchIds = getScopedBranchIds(req.user);
    const uScope = branchScope("u.branchId", branchIds);
    const bScope = branchScope("branchId", branchIds);
    const aScope = branchScope("a.branchId", branchIds);
    const scope = [companyId, ...bScope.params];

    const [
      userCounts,
      roleCount,
      auditCount,
      userSeries,
      activitySeries,
      recentActivity,
    ] = await Promise.all([
      // Totals + active, excluding the system-managed Owner
      req.db.query(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN u.status = 'Active' THEN 1 ELSE 0 END) AS active
         FROM users u
         LEFT JOIN roles r ON r.roleId = u.roleId
         WHERE u.companyId = ?${uScope.clause} AND u.status != 'Deleted'
           AND (r.roleName IS NULL OR r.roleName != 'Owner')`,
        [companyId, ...uScope.params]
      ),
      req.db.query(
        `SELECT COUNT(*) AS total FROM roles
         WHERE companyId = ?${bScope.clause} AND status != 'Deleted' AND roleName != 'Owner'`,
        scope
      ),
      req.db.query(
        `SELECT COUNT(*) AS total FROM audit_trail
         WHERE companyId = ?${bScope.clause} AND dateCreated >= ?`,
        [...scope, since]
      ),
      req.db.query(
        `SELECT DATE(dateCreated) AS day, COUNT(*) AS count
         FROM users
         WHERE companyId = ?${bScope.clause} AND status != 'Deleted' AND dateCreated >= ?
         GROUP BY DATE(dateCreated)`,
        [...scope, since]
      ),
      req.db.query(
        `SELECT DATE(dateCreated) AS day, COUNT(*) AS count
         FROM audit_trail
         WHERE companyId = ?${bScope.clause} AND dateCreated >= ?
         GROUP BY DATE(dateCreated)`,
        [...scope, since]
      ),
      req.db.query(
        `SELECT a.auditId, a.action, a.module, a.description, a.dateCreated,
                u.firstName, u.lastName
         FROM audit_trail a
         LEFT JOIN users u ON u.accountId = a.accountId
         WHERE a.companyId = ?${aScope.clause}
         ORDER BY a.dateCreated DESC
         LIMIT 6`,
        [companyId, ...aScope.params]
      ),
    ]);

    return res.sendSuccess("Dashboard stats retrieved successfully", {
      stats: {
        totalUsers: Number(userCounts[0]?.total || 0),
        activeUsers: Number(userCounts[0]?.active || 0),
        totalRoles: Number(roleCount[0]?.total || 0),
        auditEvents: Number(auditCount[0]?.total || 0),
        seriesDays: SERIES_DAYS,
      },
      userGrowth: fillDailySeries(userSeries),
      activityByDay: fillDailySeries(activitySeries),
      recentActivity,
    });
  })
);

export default router;
