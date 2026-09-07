import express from "express";
import { catchAsync, validateQuery } from "../../../utils/catchAsync.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import { listAuditQuerySchema } from "../../../validators/audit-trail.validator.js";
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import { branchScope, getScopedBranchIds } from "../../../utils/branchScope.js";

const router = express.Router();

// Spreadsheet apps evaluate a cell starting with =, +, -, @, TAB or CR as a
// formula. RFC4180 quoting does NOT prevent this — Excel strips the quotes and
// still evaluates the leading character. Audit rows carry user-controlled text
// (firstName/lastName, description, metadata), so a crafted value could run a
// formula on whoever opens the export. Neutralise it with a leading apostrophe,
// which spreadsheets consume as a "treat as text" marker.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

// RFC4180-ish CSV escaping: neutralise formulas, wrap in quotes, double any
// embedded quotes.
const csvCell = (value) => {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  const safe = FORMULA_TRIGGER.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
};

/**
 * Build the tenant-scoped WHERE clause + params shared by list and export.
 * @returns {{ whereClause: string, params: Array }}
 */
const buildAuditFilter = (req) => {
  const { companyId } = req.user;
  const { search = "", module, accountId, startDate, endDate } = req.query;
  const scope = branchScope("a.branchId", getScopedBranchIds(req.user));

  const params = [companyId, ...scope.params];
  let whereClause = `WHERE a.companyId = ?${scope.clause}`;

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

  return { whereClause, params };
};

/**
 * GET /
 * List audit trail logs (scoped by company/branch from req.user)
 */
router.get(
  "/",
  checkPermission("audit_trail", null, "read"),
  validateQuery(listAuditQuerySchema),
  catchAsync(async (req, res) => {
    const { page = 1, pageSize = 20, sortOrder = "DESC" } = req.query;

    const offset = (page - 1) * pageSize;
    const { whereClause, params } = buildAuditFilter(req);

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

/**
 * GET /export
 * Export the current filter selection as CSV.
 * NOTE: must be declared before `/:auditId` or it would match that param route.
 */
router.get(
  "/export",
  checkPermission("audit_trail", null, "read"),
  validateQuery(listAuditQuerySchema),
  catchAsync(async (req, res) => {
    const { sortOrder = "DESC" } = req.query;
    const { whereClause, params } = buildAuditFilter(req);
    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    // Hard cap so a huge tenant can't stream an unbounded response
    const MAX_ROWS = 10000;

    const logs = await req.db.query(
      `SELECT
        a.dateCreated, a.action, a.module, a.description,
        a.accountId, u.firstName, u.lastName, a.ipAddress, a.metadata
      FROM audit_trail a
      LEFT JOIN users u ON u.accountId = a.accountId
      ${whereClause}
      ORDER BY a.dateCreated ${safeSortOrder}
      LIMIT ?`,
      [...params, MAX_ROWS]
    );

    const header = [
      "Date",
      "Action",
      "Module",
      "Description",
      "User",
      "Account ID",
      "IP Address",
      "Metadata",
    ];

    const rows = logs.map((l) =>
      [
        l.dateCreated,
        l.action,
        l.module,
        l.description,
        [l.firstName, l.lastName].filter(Boolean).join(" "),
        l.accountId,
        l.ipAddress,
        l.metadata,
      ]
        .map(csvCell)
        .join(",")
    );

    // BOM so Excel opens UTF-8 correctly
    const csv = `﻿${header.map(csvCell).join(",")}\n${rows.join("\n")}\n`;
    const filename = `audit-trail-${getCurrentTimestampLocal().replace(/[: ]/g, "-")}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  })
);

/**
 * GET /:auditId
 * Full detail for a single audit event (includes userAgent, which the list omits).
 */
router.get(
  "/:auditId",
  checkPermission("audit_trail", null, "read"),
  catchAsync(async (req, res) => {
    const { companyId } = req.user;
    const { auditId } = req.params;
    const scope = branchScope("a.branchId", getScopedBranchIds(req.user));

    const rows = await req.db.query(
      `SELECT
        a.auditId, a.accountId, a.action, a.module, a.description, a.metadata,
        a.ipAddress, a.userAgent, a.dateCreated,
        u.firstName, u.lastName
      FROM audit_trail a
      LEFT JOIN users u ON u.accountId = a.accountId
      WHERE a.auditId = ? AND a.companyId = ?${scope.clause}
      LIMIT 1`,
      [auditId, companyId, ...scope.params]
    );

    if (rows.length === 0) {
      return res.sendError("Audit event not found", 404);
    }

    return res.sendSuccess("Audit event retrieved successfully", { log: rows[0] });
  })
);

export default router;
