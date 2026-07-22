import express from "express";
import { catchAsync, validateBody, validateQuery } from "../../../utils/catchAsync.js";
import { getCurrentTimestampLocal, getTodayDateLocal } from "../../../utils/dateUtils.js";
import { upload, compressImage } from "../../../utils/file/uploads.js";
import {
  createCompanySchema,
  updateCompanySchema,
  listCompaniesQuerySchema,
} from "../../../validators/companies.validator.js";

const router = express.Router();

// Multer config for logo upload: uploads/superadmin/logos/{companyId}/
const logoUpload = upload({
  filePath: (req) => {
    const companyId = req.params.companyId || "new";
    return `uploads/superadmin/logos/${companyId}`;
  },
  fileTypes: ["images"],
  maxFileSize: 1024 * 1024 * 2, // 2MB
});

/**
 * GET /
 * List all companies (companies) with pagination
 */
router.get(
  "/",
  validateQuery(listCompaniesQuerySchema),
  catchAsync(async (req, res) => {
    const {
      page = 1,
      pageSize = 10,
      search = "",
      status,
      subscriptionPlan,
      sortBy = "dateCreated",
      sortOrder = "DESC",
    } = req.query;

    const offset = (page - 1) * pageSize;
    const params = [];
    let whereClause;

    // Default: hide Deleted. If status filter provided: show only that status.
    if (status) {
      whereClause = "WHERE b.status = ?";
      params.push(status);
    } else {
      whereClause = "WHERE b.status != 'Deleted'";
    }

    if (search) {
      whereClause += ` AND (b.name LIKE ? OR b.email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (subscriptionPlan) {
      whereClause += ` AND b.subscriptionPlan = ?`;
      params.push(subscriptionPlan);
    }

    const allowedSortColumns = ["dateCreated", "dateUpdated", "name"];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : "dateCreated";
    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const [countRows, companies] = await Promise.all([
      req.db.query(
        `SELECT COUNT(*) as total FROM companies b ${whereClause}`,
        params
      ),
      req.db.query(
        `SELECT
        b.companyId,
        b.name,
        b.email,
        b.website,
        b.logoUrl,
        b.subscriptionPlan,
        b.subscriptionStartDate,
        b.subscriptionEndDate,
        b.status,
        b.dateCreated,
        b.dateUpdated,
        (SELECT COUNT(*) FROM branches br WHERE br.companyId = b.companyId AND br.status != 'Deleted') as branchCount
      FROM companies b
      ${whereClause}
      ORDER BY b.${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
    ]);
    const total = countRows[0]?.total || 0;

    return res.sendSuccess("Companies retrieved successfully", {
      data: companies,
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
 * GET /:companyId
 * Get single company (company)
 */
router.get(
  "/:companyId",
  catchAsync(async (req, res) => {
    const { companyId } = req.params;

    const companies = await req.db.query(
      `SELECT 
        companyId, name, email, website, logoUrl,
        subscriptionPlan, subscriptionStartDate, subscriptionEndDate,
        status, dateCreated, dateUpdated
      FROM companies
      WHERE companyId = ? AND status != 'Deleted'
      LIMIT 1`,
      [companyId]
    );

    if (companies.length === 0) {
      return res.sendError("Company not found", 404);
    }

    // Get branches for this company
    const branches = await req.db.query(
      `SELECT branchId, name, email, phone, address, isMainBranch, status, dateCreated
       FROM branches
       WHERE companyId = ? AND status != 'Deleted'
       ORDER BY isMainBranch DESC, dateCreated ASC`,
      [companyId]
    );

    return res.sendSuccess("Company retrieved successfully", {
      data: { ...companies[0], branches },
    });
  })
);

/**
 * POST /
 * Create new company (company) only.
 * Branch and Owner user are created separately via /branches and /users endpoints.
 */
router.post(
  "/",
  logoUpload.single("logo"),
  compressImage,
  validateBody(createCompanySchema),
  catchAsync(async (req, res) => {
    const { name, email, website, subscriptionPlan } = req.body;
    const now = getCurrentTimestampLocal();
    const today = getTodayDateLocal(); // Manila date, server-timezone-independent

    let conn;
    try {
      conn = await req.db.beginTransaction();

      // Check duplicate email
      const [existing] = await conn.execute(
        `SELECT companyId FROM companies 
         WHERE email = ? AND status != 'Deleted'
         LIMIT 1 FOR UPDATE`,
        [email]
      );

      if (existing.length > 0) {
        await req.db.rollback(conn);
        return res.sendError("An company with this email already exists", 409);
      }

      // Generate UUID
      const [uuidRow] = await conn.execute(`SELECT UUID() as companyId`);
      const companyId = uuidRow[0].companyId;

      // Move uploaded logo to the correct companyId folder
      let logoUrl = null;
      if (req.file) {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const correctDir = path.default.join("public", "uploads", "superadmin", "logos", companyId);
        fs.default.mkdirSync(correctDir, { recursive: true });
        const newPath = path.default.join(correctDir, req.file.filename);
        fs.default.renameSync(req.file.path, newPath);
        logoUrl = `/${newPath.replace(/\\/g, "/")}`;
      }

      // Create company
      await conn.execute(
        `INSERT INTO companies (companyId, name, email, website, logoUrl, subscriptionPlan, subscriptionStartDate, status, dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`,
        [companyId, name, email, website || null, logoUrl, subscriptionPlan || "Basic", today, now, now]
      );

      await req.db.commit(conn);

      return res.sendSuccess("Company created successfully", { companyId }, 201);
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * PUT /:companyId
 * Update company (company)
 */
router.put(
  "/:companyId",
  logoUpload.single("logo"),
  compressImage,
  validateBody(updateCompanySchema),
  catchAsync(async (req, res) => {
    const { companyId } = req.params;
    const {
      name,
      email,
      website,
      subscriptionPlan,
      subscriptionStartDate,
      subscriptionEndDate,
      status,
    } = req.body;
    const now = getCurrentTimestampLocal();
    const logoUrl = req.file ? `/${req.file.path.replace(/\\/g, "/")}` : req.body.logoUrl || null;

    const result = await req.db.query(
      `UPDATE companies 
       SET name = ?, email = ?, website = ?, logoUrl = ?, subscriptionPlan = ?, 
           subscriptionStartDate = ?, subscriptionEndDate = ?, status = ?, dateUpdated = ?
       WHERE companyId = ? AND status != 'Deleted'`,
      [
        name,
        email,
        website || null,
        logoUrl || null,
        subscriptionPlan,
        subscriptionStartDate || null,
        subscriptionEndDate || null,
        status || "Active",
        now,
        companyId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.sendError("Company not found", 404);
    }

    return res.sendSuccess("Company updated successfully");
  })
);

/**
 * DELETE /:companyId
 * Soft delete company (company) — sets status to 'Deleted'
 */
router.delete(
  "/:companyId",
  catchAsync(async (req, res) => {
    const { companyId } = req.params;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      // Soft delete company
      const [companyResult] = await conn.execute(
        `UPDATE companies SET status = 'Deleted', dateUpdated = ? WHERE companyId = ? AND status != 'Deleted'`,
        [now, companyId]
      );

      if (companyResult.affectedRows === 0) {
        await req.db.rollback(conn);
        return res.sendError("Company not found", 404);
      }

      // Soft delete all branches under this company
      await conn.execute(
        `UPDATE branches SET status = 'Deleted', dateUpdated = ? WHERE companyId = ? AND status != 'Deleted'`,
        [now, companyId]
      );

      await req.db.commit(conn);

      return res.sendSuccess("Company deleted successfully");
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

export default router;
