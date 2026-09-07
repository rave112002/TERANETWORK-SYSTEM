import express from "express";

import { catchAsync, validateBody, validateQuery } from "../../../utils/catchAsync.js";
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import { getAuditContext, writeAudit } from "../../../utils/audit.js";
import {
  createPlanSchema,
  updatePlanSchema,
  listPlansQuerySchema,
} from "../../../validators/plans.validator.js";

const router = express.Router();

/**
 * Service plans — the speed/price catalogue.
 *
 * Company-wide, NOT branch-scoped (decision D3): one ISP, one price list. So
 * these queries scope on `companyId` alone and `branchScope()` is deliberately
 * absent — a technician in either branch sells the same plans.
 *
 * Plans are money-bearing and feed every invoice, so mutations write an
 * in-transaction audit row (`writeAudit`) rather than relying on the route
 * middleware alone: a price change has to be answerable months later.
 */

// Columns returned to clients, in one place so every query agrees.
const PLAN_COLUMNS = `p.planId, p.companyId, p.name, p.description,
  p.downMbps, p.upMbps, p.monthlyPrice, p.currency,
  p.installFee, p.reconnectionFee, p.status, p.dateCreated, p.dateUpdated`;

/**
 * GET /
 * List plans for the authenticated user's company.
 */
router.get(
  "/",
  checkPermission("plans", null, "read"),
  validateQuery(listPlansQuerySchema),
  catchAsync(async (req, res) => {
    const {
      page = 1,
      pageSize = 10,
      search = "",
      status,
      sortBy = "dateCreated",
      sortOrder = "DESC",
    } = req.query;
    const { companyId } = req.user;
    const offset = (page - 1) * pageSize;

    const params = [companyId];
    let whereClause = "WHERE p.companyId = ?";

    // No status filter → hide soft-deleted. Explicit ?status=Deleted → show them.
    if (status) {
      whereClause += " AND p.status = ?";
      params.push(status);
    } else {
      whereClause += " AND p.status != 'Deleted'";
    }

    if (search) {
      whereClause += " AND (p.name LIKE ? OR p.description LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    // Whitelisted — the sort column is interpolated, not bound.
    const allowedSortColumns = ["dateCreated", "dateUpdated", "name", "monthlyPrice", "downMbps"];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : "dateCreated";
    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const [countRows, plans] = await Promise.all([
      req.db.query(`SELECT COUNT(*) as total FROM plans p ${whereClause}`, params),
      req.db.query(
        `SELECT ${PLAN_COLUMNS}
         FROM plans p
         ${whereClause}
         ORDER BY p.${safeSortBy} ${safeSortOrder}
         LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
    ]);

    const total = countRows[0]?.total || 0;

    return res.sendSuccess("Plans retrieved successfully", {
      plans,
      pagination: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  })
);

/**
 * GET /:planId
 */
router.get(
  "/:planId",
  checkPermission("plans", null, "read"),
  catchAsync(async (req, res) => {
    const { planId } = req.params;
    const { companyId } = req.user;

    const rows = await req.db.query(
      `SELECT ${PLAN_COLUMNS}
       FROM plans p
       WHERE p.planId = ? AND p.companyId = ? AND p.status != 'Deleted'
       LIMIT 1`,
      [planId, companyId]
    );

    if (rows.length === 0) {
      return res.sendError("Plan not found", 404);
    }

    return res.sendSuccess("Plan retrieved successfully", { plan: rows[0] });
  })
);

/**
 * POST /
 * Create a plan. The duplicate-name check and the insert share one transaction
 * with FOR UPDATE, or two concurrent requests both pass the check.
 */
router.post(
  "/",
  checkPermission("plans", null, "write"),
  validateBody(createPlanSchema),
  catchAsync(async (req, res) => {
    const { name, description, downMbps, upMbps, monthlyPrice, installFee, reconnectionFee } =
      req.body;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const [existing] = await conn.execute(
        `SELECT planId FROM plans
         WHERE name = ? AND companyId = ? AND status != 'Deleted'
         LIMIT 1 FOR UPDATE`,
        [name, companyId]
      );

      if (existing.length > 0) {
        await req.db.rollback(conn);
        return res.sendError("A plan with this name already exists", 409);
      }

      const [uuidRow] = await conn.execute(`SELECT UUID() as id`);
      const planId = uuidRow[0].id;

      const plan = {
        planId,
        companyId,
        name,
        description: description || null,
        downMbps,
        upMbps,
        monthlyPrice,
        currency: "PHP",
        installFee: installFee ?? 0,
        reconnectionFee: reconnectionFee ?? 0,
        status: "Active",
      };

      await conn.execute(
        `INSERT INTO plans
           (planId, companyId, name, description, downMbps, upMbps, monthlyPrice,
            currency, installFee, reconnectionFee, status, dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`,
        [
          plan.planId,
          plan.companyId,
          plan.name,
          plan.description,
          plan.downMbps,
          plan.upMbps,
          plan.monthlyPrice,
          plan.currency,
          plan.installFee,
          plan.reconnectionFee,
          now,
          now,
        ]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "plans",
        action: "create",
        description: `Created plan "${name}"`,
        after: plan,
      });

      await req.db.commit(conn);
      return res.sendSuccess("Plan created successfully", { planId }, 201);
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * PUT /:planId
 *
 * Changing a price does NOT retroactively alter invoices already issued — they
 * store their own line amounts. It applies from the next billing cycle.
 */
router.put(
  "/:planId",
  checkPermission("plans", null, "write"),
  validateBody(updatePlanSchema),
  catchAsync(async (req, res) => {
    const { planId } = req.params;
    const {
      name,
      description,
      downMbps,
      upMbps,
      monthlyPrice,
      installFee,
      reconnectionFee,
      status,
    } = req.body;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const [existingRows] = await conn.execute(
        `SELECT planId, name, description, downMbps, upMbps, monthlyPrice, currency,
                installFee, reconnectionFee, status
         FROM plans
         WHERE planId = ? AND companyId = ? AND status != 'Deleted'
         LIMIT 1 FOR UPDATE`,
        [planId, companyId]
      );

      if (existingRows.length === 0) {
        await req.db.rollback(conn);
        return res.sendError("Plan not found", 404);
      }

      const before = existingRows[0];

      // Renaming onto another live plan's name would break the catalogue's
      // one-name-one-plan assumption.
      const [clash] = await conn.execute(
        `SELECT planId FROM plans
         WHERE name = ? AND companyId = ? AND planId != ? AND status != 'Deleted'
         LIMIT 1 FOR UPDATE`,
        [name, companyId, planId]
      );

      if (clash.length > 0) {
        await req.db.rollback(conn);
        return res.sendError("Another plan already uses this name", 409);
      }

      const after = {
        ...before,
        name,
        description: description || null,
        downMbps,
        upMbps,
        monthlyPrice,
        installFee: installFee ?? 0,
        reconnectionFee: reconnectionFee ?? 0,
        status: status || "Active",
      };

      await conn.execute(
        `UPDATE plans
         SET name = ?, description = ?, downMbps = ?, upMbps = ?, monthlyPrice = ?,
             installFee = ?, reconnectionFee = ?, status = ?, dateUpdated = ?
         WHERE planId = ? AND companyId = ? AND status != 'Deleted'`,
        [
          after.name,
          after.description,
          after.downMbps,
          after.upMbps,
          after.monthlyPrice,
          after.installFee,
          after.reconnectionFee,
          after.status,
          now,
          planId,
          companyId,
        ]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "plans",
        action: "update",
        description: `Updated plan "${after.name}"`,
        before,
        after,
      });

      await req.db.commit(conn);
      return res.sendSuccess("Plan updated successfully");
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * DELETE /:planId — soft delete.
 *
 * Refused while any non-terminated subscription still points at the plan:
 * deleting it would leave the billing cycle unable to price that subscriber.
 * The `subscriptions` table does not exist until S4, so the guard is written to
 * tolerate its absence and starts enforcing the moment it is created.
 */
router.delete(
  "/:planId",
  checkPermission("plans", null, "write"),
  catchAsync(async (req, res) => {
    const { planId } = req.params;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const [existingRows] = await conn.execute(
        `SELECT planId, name, status FROM plans
         WHERE planId = ? AND companyId = ? AND status != 'Deleted'
         LIMIT 1 FOR UPDATE`,
        [planId, companyId]
      );

      if (existingRows.length === 0) {
        await req.db.rollback(conn);
        return res.sendError("Plan not found", 404);
      }

      const before = existingRows[0];

      const [tableRows] = await conn.execute(
        `SELECT COUNT(*) AS present
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions'`
      );

      if (tableRows[0].present > 0) {
        const [inUse] = await conn.execute(
          `SELECT COUNT(*) AS total FROM subscriptions
           WHERE planId = ? AND status != 'terminated'`,
          [planId]
        );

        if (inUse[0].total > 0) {
          await req.db.rollback(conn);
          return res.sendError(
            `This plan is still used by ${inUse[0].total} subscription(s). Move them to another plan first.`,
            409
          );
        }
      }

      await conn.execute(
        `UPDATE plans SET status = 'Deleted', dateUpdated = ?
         WHERE planId = ? AND companyId = ? AND status != 'Deleted'`,
        [now, planId, companyId]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "plans",
        action: "delete",
        description: `Deleted plan "${before.name}"`,
        before,
        after: { ...before, status: "Deleted" },
      });

      await req.db.commit(conn);
      return res.sendSuccess("Plan deleted successfully");
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

export default router;
