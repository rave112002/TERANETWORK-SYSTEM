import express from "express";
import { catchAsync } from "../../../utils/catchAsync.js";
import { moment } from "../../../utils/dateUtils.js";

const router = express.Router();

const TZ = process.env.TIMEZONE || "Asia/Manila";
const SERIES_DAYS = 14;

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
 * Platform-wide metrics across all companies (SuperAdmin).
 */
router.get(
  "/stats",
  catchAsync(async (req, res) => {
    const since = moment().tz(TZ).subtract(SERIES_DAYS - 1, "days").format("YYYY-MM-DD 00:00:00");

    const [
      companyCounts,
      branchCount,
      userCount,
      byPlan,
      companySeries,
      recentCompanies,
    ] = await Promise.all([
      req.db.query(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active
         FROM companies WHERE status != 'Deleted'`
      ),
      req.db.query(`SELECT COUNT(*) AS total FROM branches WHERE status != 'Deleted'`),
      req.db.query(`SELECT COUNT(*) AS total FROM users WHERE status != 'Deleted'`),
      req.db.query(
        `SELECT subscriptionPlan AS plan, COUNT(*) AS count
         FROM companies WHERE status != 'Deleted'
         GROUP BY subscriptionPlan`
      ),
      req.db.query(
        `SELECT DATE(dateCreated) AS day, COUNT(*) AS count
         FROM companies WHERE status != 'Deleted' AND dateCreated >= ?
         GROUP BY DATE(dateCreated)`,
        [since]
      ),
      req.db.query(
        `SELECT b.companyId, b.name, b.email, b.status, b.subscriptionPlan, b.dateCreated,
                (SELECT COUNT(*) FROM branches br WHERE br.companyId = b.companyId AND br.status != 'Deleted') AS branchCount
         FROM companies b
         WHERE b.status != 'Deleted'
         ORDER BY b.dateCreated DESC
         LIMIT 6`
      ),
    ]);

    // Always return every plan so the chart has a stable set of categories
    const PLANS = ["Basic", "Standard", "Premium", "Enterprise"];
    const planMap = new Map(byPlan.map((r) => [r.plan, Number(r.count)]));

    return res.sendSuccess("Dashboard stats retrieved successfully", {
      stats: {
        totalCompanies: Number(companyCounts[0]?.total || 0),
        activeCompanies: Number(companyCounts[0]?.active || 0),
        totalBranches: Number(branchCount[0]?.total || 0),
        totalUsers: Number(userCount[0]?.total || 0),
        seriesDays: SERIES_DAYS,
      },
      companiesByPlan: PLANS.map((plan) => ({ plan, count: planMap.get(plan) || 0 })),
      companyGrowth: fillDailySeries(companySeries),
      recentCompanies,
    });
  })
);

export default router;
