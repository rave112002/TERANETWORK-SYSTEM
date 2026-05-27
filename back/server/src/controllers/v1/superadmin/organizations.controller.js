import express from "express";
import { catchAsync } from "../../../utils/catchAsync.js";
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import { upload, compressImage } from "../../../utils/file/uploads.js";

const router = express.Router();

// Multer config for logo upload: uploads/superadmin/logos/{brandId}/
const logoUpload = upload({
  filePath: (req) => {
    const brandId = req.params.brandId || "new";
    return `uploads/superadmin/logos/${brandId}`;
  },
  fileTypes: ["images"],
  maxFileSize: 1024 * 1024 * 2, // 2MB
});

/**
 * GET /
 * List all brands (organizations) with pagination
 */
router.get(
  "/",
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

    const [countRows, organizations] = await Promise.all([
      req.db.query(
        `SELECT COUNT(*) as total FROM brands b ${whereClause}`,
        params
      ),
      req.db.query(
        `SELECT
        b.brandId,
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
        (SELECT COUNT(*) FROM branches br WHERE br.brandId = b.brandId AND br.status != 'Deleted') as branchCount
      FROM brands b
      ${whereClause}
      ORDER BY b.${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
    ]);
    const total = countRows[0]?.total || 0;

    return res.sendSuccess("Organizations retrieved successfully", {
      data: organizations,
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
 * GET /:brandId
 * Get single brand (organization)
 */
router.get(
  "/:brandId",
  catchAsync(async (req, res) => {
    const { brandId } = req.params;

    const brands = await req.db.query(
      `SELECT 
        brandId, name, email, website, logoUrl,
        subscriptionPlan, subscriptionStartDate, subscriptionEndDate,
        status, dateCreated, dateUpdated
      FROM brands
      WHERE brandId = ? AND status != 'Deleted'
      LIMIT 1`,
      [brandId]
    );

    if (brands.length === 0) {
      return res.sendError("Organization not found", 404);
    }

    // Get branches for this brand
    const branches = await req.db.query(
      `SELECT branchId, name, email, phone, address, isMainBranch, status, dateCreated
       FROM branches
       WHERE brandId = ? AND status != 'Deleted'
       ORDER BY isMainBranch DESC, dateCreated ASC`,
      [brandId]
    );

    return res.sendSuccess("Organization retrieved successfully", {
      data: { ...brands[0], branches },
    });
  })
);

/**
 * POST /
 * Create new brand (organization) only.
 * Branch and Owner user are created separately via /branches and /users endpoints.
 */
router.post(
  "/",
  logoUpload.single("logo"),
  compressImage,
  catchAsync(async (req, res) => {
    const { name, email, phone, website, subscriptionPlan } = req.body;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      // Check duplicate email
      const [existing] = await conn.execute(
        `SELECT brandId FROM brands 
         WHERE email = ? AND status != 'Deleted'
         LIMIT 1 FOR UPDATE`,
        [email]
      );

      if (existing.length > 0) {
        await req.db.rollback(conn);
        return res.sendError("An organization with this email already exists", 409);
      }

      // Generate UUID
      const [uuidRow] = await conn.execute(`SELECT UUID() as brandId`);
      const brandId = uuidRow[0].brandId;

      // Move uploaded logo to the correct brandId folder
      let logoUrl = null;
      if (req.file) {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const correctDir = path.default.join("public", "uploads", "superadmin", "logos", brandId);
        fs.default.mkdirSync(correctDir, { recursive: true });
        const newPath = path.default.join(correctDir, req.file.filename);
        fs.default.renameSync(req.file.path, newPath);
        logoUrl = `/${newPath.replace(/\\/g, "/")}`;
      }

      // Create brand
      await conn.execute(
        `INSERT INTO brands (brandId, name, email, website, logoUrl, subscriptionPlan, subscriptionStartDate, status, dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?, ?, CURDATE(), 'Active', ?, ?)`,
        [brandId, name, email, website || null, logoUrl, subscriptionPlan || "Basic", now, now]
      );

      await req.db.commit(conn);

      return res.sendSuccess("Organization created successfully", { brandId }, 201);
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * PUT /:brandId
 * Update brand (organization)
 */
router.put(
  "/:brandId",
  logoUpload.single("logo"),
  compressImage,
  catchAsync(async (req, res) => {
    const { brandId } = req.params;
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
      `UPDATE brands 
       SET name = ?, email = ?, website = ?, logoUrl = ?, subscriptionPlan = ?, 
           subscriptionStartDate = ?, subscriptionEndDate = ?, status = ?, dateUpdated = ?
       WHERE brandId = ? AND status != 'Deleted'`,
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
        brandId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.sendError("Organization not found", 404);
    }

    return res.sendSuccess("Organization updated successfully");
  })
);

/**
 * DELETE /:brandId
 * Soft delete brand (organization) — sets status to 'Deleted'
 */
router.delete(
  "/:brandId",
  catchAsync(async (req, res) => {
    const { brandId } = req.params;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      // Soft delete brand
      const [brandResult] = await conn.execute(
        `UPDATE brands SET status = 'Deleted', dateUpdated = ? WHERE brandId = ? AND status != 'Deleted'`,
        [now, brandId]
      );

      if (brandResult.affectedRows === 0) {
        await req.db.rollback(conn);
        return res.sendError("Organization not found", 404);
      }

      // Soft delete all branches under this brand
      await conn.execute(
        `UPDATE branches SET status = 'Deleted', dateUpdated = ? WHERE brandId = ? AND status != 'Deleted'`,
        [now, brandId]
      );

      await req.db.commit(conn);

      return res.sendSuccess("Organization deleted successfully");
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

export default router;
