import express from "express";
import { catchAsync, validateBody, validateQuery } from "../../../utils/catchAsync.js";
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import {
  createBranchSchema,
  updateBranchSchema,
  listBranchesQuerySchema,
} from "../../../validators/branches.validator.js";

const router = express.Router();

/**
 * GET /
 * List all branches with pagination (SuperAdmin view)
 */
router.get(
  "/",
  validateQuery(listBranchesQuerySchema),
  catchAsync(async (req, res) => {
    const {
      page = 1,
      pageSize = 10,
      search = "",
      status,
      companyId,
      sortBy = "dateCreated",
      sortOrder = "DESC",
    } = req.query;

    const offset = (page - 1) * pageSize;
    const params = [];
    let whereClause;

    // Default: hide Deleted. If status filter provided: show only that status.
    if (status) {
      whereClause = "WHERE br.status = ?";
      params.push(status);
    } else {
      whereClause = "WHERE br.status != 'Deleted'";
    }

    if (search) {
      whereClause += ` AND (br.name LIKE ? OR br.email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (companyId) {
      whereClause += ` AND br.companyId = ?`;
      params.push(companyId);
    }

    const allowedSortColumns = ["dateCreated", "dateUpdated", "name"];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : "dateCreated";
    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const [countRows, branches] = await Promise.all([
      req.db.query(
        `SELECT COUNT(*) as total FROM branches br ${whereClause}`,
        params
      ),
      req.db.query(
        `SELECT
        br.branchId,
        br.companyId,
        br.name,
        br.email,
        br.phone,
        br.address,
        br.paymentProvider,
        br.isMainBranch,
        br.status,
        br.dateCreated,
        br.dateUpdated,
        b.name as companyName
      FROM branches br
      LEFT JOIN companies b ON b.companyId = br.companyId
      ${whereClause}
      ORDER BY br.${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
    ]);
    const total = countRows[0]?.total || 0;

    return res.sendSuccess("Branches retrieved successfully", {
      data: branches,
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
 * GET /:branchId
 * Get single branch
 */
router.get(
  "/:branchId",
  catchAsync(async (req, res) => {
    const { branchId } = req.params;

    const branches = await req.db.query(
      `SELECT 
        br.branchId, br.companyId, br.name, br.email, br.phone, br.address,
        br.regCode, br.provCode, br.citymunCode, br.brgyCode, br.zipCode,
        br.logoUrl, br.website, br.paymentProvider,
        br.isMainBranch, br.status, br.dateCreated, br.dateUpdated,
        b.name as companyName
      FROM branches br
      LEFT JOIN companies b ON b.companyId = br.companyId
      WHERE br.branchId = ? AND br.status != 'Deleted'
      LIMIT 1`,
      [branchId]
    );

    if (branches.length === 0) {
      return res.sendError("Branch not found", 404);
    }

    return res.sendSuccess("Branch retrieved successfully", { data: branches[0] });
  })
);

/**
 * POST /
 * Create a new branch for an existing company
 * Also creates an Owner role for the new branch with all permissions
 */
router.post(
  "/",
  validateBody(createBranchSchema),
  catchAsync(async (req, res) => {
    const { companyId, name, email, phone, address, paymentProvider } = req.body;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      // Verify company exists
      const [companyRows] = await conn.execute(
        `SELECT companyId FROM companies WHERE companyId = ? AND status != 'Deleted' LIMIT 1`,
        [companyId]
      );

      if (companyRows.length === 0) {
        await req.db.rollback(conn);
        return res.sendError("Company not found", 404);
      }

      // Generate UUIDs
      const [uuids] = await conn.execute(`SELECT UUID() as branchId, UUID() as roleId`);
      const branchId = uuids[0].branchId;
      const roleId = uuids[0].roleId;

      // Create branch
      await conn.execute(
        `INSERT INTO branches (branchId, companyId, name, email, phone, address,
                               paymentProvider, isMainBranch, status, dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'Active', ?, ?)`,
        [
          branchId,
          companyId,
          name,
          email || null,
          phone || null,
          address || null,
          // NULL, not a default slug: a branch nobody has thought about should
          // follow the company default rather than be silently pinned to
          // whichever gateway happened to be first.
          paymentProvider || null,
          now,
          now,
        ]
      );

      // Create Owner role for this company+branch
      await conn.execute(
        `INSERT INTO roles (roleId, companyId, branchId, roleName, description, status, dateCreated, dateUpdated)
         VALUES (?, ?, ?, 'Owner', 'Full access owner role. Not visible in Admin portal.', 'Active', ?, ?)`,
        [roleId, companyId, branchId, now, now]
      );

      // Assign ALL active permissions to the Owner role in a single bulk insert
      const [allPermissions] = await conn.execute(
        `SELECT permissionId FROM permissions WHERE status = 'Active'`
      );

      if (allPermissions.length > 0) {
        const placeholders = allPermissions
          .map(() => "(?, ?, 'write', ?)")
          .join(", ");
        const values = allPermissions.flatMap((perm) => [
          roleId,
          perm.permissionId,
          now,
        ]);
        await conn.execute(
          `INSERT INTO role_permissions (roleId, permissionId, accessLevel, dateCreated)
           VALUES ${placeholders}`,
          values
        );
      }

      await req.db.commit(conn);

      return res.sendSuccess("Branch created successfully", { branchId, roleId }, 201);
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * PUT /:branchId
 * Update branch
 */
router.put(
  "/:branchId",
  validateBody(updateBranchSchema),
  catchAsync(async (req, res) => {
    const { branchId } = req.params;
    const { name, email, phone, address, paymentProvider, status } = req.body;
    const now = getCurrentTimestampLocal();

    const result = await req.db.query(
      `UPDATE branches
       SET name = ?, email = ?, phone = ?, address = ?, paymentProvider = ?,
           status = ?, dateUpdated = ?
       WHERE branchId = ? AND status != 'Deleted'`,
      [
        name,
        email || null,
        phone || null,
        address || null,
        // An empty string is how a cleared dropdown arrives, and it means
        // "follow the company default" — stored as NULL, not as "".
        paymentProvider || null,
        status || "Active",
        now,
        branchId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.sendError("Branch not found", 404);
    }

    return res.sendSuccess("Branch updated successfully");
  })
);

/**
 * DELETE /:branchId
 * Soft delete branch
 */
router.delete(
  "/:branchId",
  catchAsync(async (req, res) => {
    const { branchId } = req.params;
    const now = getCurrentTimestampLocal();

    // Prevent deleting main branch
    const mainCheck = await req.db.query(
      `SELECT isMainBranch FROM branches WHERE branchId = ? LIMIT 1`,
      [branchId]
    );

    if (mainCheck.length > 0 && mainCheck[0].isMainBranch) {
      return res.sendError("Cannot delete the main branch", 400);
    }

    const result = await req.db.query(
      `UPDATE branches SET status = 'Deleted', dateUpdated = ? WHERE branchId = ? AND status != 'Deleted'`,
      [now, branchId]
    );

    if (result.affectedRows === 0) {
      return res.sendError("Branch not found", 404);
    }

    return res.sendSuccess("Branch deleted successfully");
  })
);

export default router;
