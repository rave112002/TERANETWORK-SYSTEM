import express from "express";
import { catchAsync } from "../../../utils/catchAsync.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";

const router = express.Router();

/**
 * GET /
 * List audit trail logs (scoped by brand/branch from req.user)
 */
router.get(
  "/",
  checkPermission("audit_trail", null, "read"),
  catchAsync(async (req, res) => {
    const { brandId, branchId } = req.user;
    const {
      page = 1,
      pageSize = 20,
      search = "",
      module,
      accountId,
      startDate,
      endDate,
      sortOrder = "DESC",
    } = req.query;

    const offset = (page - 1) * pageSize;
    const params = [brandId, branchId];
    let whereClause = "WHERE a.brandId = ? AND a.branchId = ?";

    if (search) {
      whereClause += ` AND (a.action LIKE ? OR a.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (module) {
      whereClause += ` AND a.module = ?`;
      params.push(module);
    }

    if (accountId) {
      whereClause += ` AND a.accountId = ?`;
      params.push(accountId);
    }

    if (startDate) {
      whereClause += ` AND a.dateCreated >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND a.dateCreated <= ?`;
      params.push(`${endDate} 23:59:59`);
    }

    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const [countRows, logs] = await Promise.all([
      req.db.query(
        `SELECT COUNT(*) as total FROM audit_trail a ${whereClause}`,
        params
      ),
      req.db.query(
        `SELECT
        a.auditId,
        a.accountId,
        a.action,
        a.module,
        a.description,
        a.metadata,
        a.ipAddress,
        a.dateCreated,
        u.firstName,
        u.lastName
      FROM audit_trail a
      LEFT JOIN users u ON u.accountId = a.accountId
      ${whereClause}
      ORDER BY a.dateCreated ${safeSortOrder}
      LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
    ]);
    const total = countRows[0]?.total || 0;

    return res.sendSuccess("Audit trail retrieved successfully", {
      logs,
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
