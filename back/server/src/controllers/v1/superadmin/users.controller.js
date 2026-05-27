import express from "express";
import { catchAsync } from "../../../utils/catchAsync.js";
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import { hashPassword } from "../../../utils/hashing/argonHash.js";

const router = express.Router();

/**
 * GET /
 * List all users across all brands (SuperAdmin view)
 */
router.get(
  "/",
  catchAsync(async (req, res) => {
    const {
      page = 1,
      pageSize = 10,
      search = "",
      brandId,
      branchId,
      status,
      sortBy = "dateCreated",
      sortOrder = "DESC",
    } = req.query;

    const offset = (page - 1) * pageSize;
    const params = [];
    let whereClause;

    // Default: hide Deleted. If status filter provided: show only that status.
    if (status) {
      whereClause = "WHERE u.status = ?";
      params.push(status);
    } else {
      whereClause = "WHERE u.status != 'Deleted'";
    }

    if (search) {
      whereClause += ` AND (u.firstName LIKE ? OR u.lastName LIKE ? OR c.email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (brandId) {
      whereClause += ` AND u.brandId = ?`;
      params.push(brandId);
    }

    if (branchId) {
      whereClause += ` AND u.branchId = ?`;
      params.push(branchId);
    }

    const allowedSortColumns = ["dateCreated", "dateUpdated", "firstName", "lastName"];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : "dateCreated";
    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const [countRows, users] = await Promise.all([
      req.db.query(
        `SELECT COUNT(*) as total
       FROM users u
       LEFT JOIN credentials c ON c.accountId = u.accountId
       ${whereClause}`,
        params
      ),
      req.db.query(
        `SELECT
        u.accountId,
        u.brandId,
        u.branchId,
        u.firstName,
        u.lastName,
        u.phone,
        u.roleId,
        u.status,
        u.dateCreated,
        c.email,
        r.roleName,
        b.name as brandName,
        br.name as branchName
      FROM users u
      LEFT JOIN credentials c ON c.accountId = u.accountId
      LEFT JOIN roles r ON r.roleId = u.roleId
      LEFT JOIN brands b ON b.brandId = u.brandId
      LEFT JOIN branches br ON br.branchId = u.branchId
      ${whereClause}
      ORDER BY u.${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
    ]);
    const total = countRows[0]?.total || 0;

    return res.sendSuccess("Users retrieved successfully", {
      data: users,
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
 * POST /
 * Create a new user (Owner) for a specific brand+branch
 *
 * Flow:
 * 1. Validate that the branch exists and belongs to the brand
 * 2. Check that the branch doesn't already have an Owner
 * 3. Find the Owner role for that brand+branch
 * 4. Create user + credential with the Owner role
 *
 * Rule: 1 Owner per branch
 */
router.post(
  "/",
  catchAsync(async (req, res) => {
    const { firstName, lastName, email, password, phone, brandId, branchId } = req.body;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      // 1. Verify branch exists and belongs to the brand
      const [branchRows] = await conn.execute(
        `SELECT branchId FROM branches 
         WHERE branchId = ? AND brandId = ? AND status != 'Deleted'
         LIMIT 1`,
        [branchId, brandId]
      );

      if (branchRows.length === 0) {
        await req.db.rollback(conn);
        return res.sendError("Branch not found or does not belong to this brand", 404);
      }

      // 2. Find the Owner role for this brand+branch
      const [ownerRoleRows] = await conn.execute(
        `SELECT roleId FROM roles 
         WHERE brandId = ? AND branchId = ? AND roleName = 'Owner' AND status = 'Active'
         LIMIT 1`,
        [brandId, branchId]
      );

      if (ownerRoleRows.length === 0) {
        await req.db.rollback(conn);
        return res.sendError(
          "Owner role not found for this branch. Please recreate the branch.",
          500
        );
      }

      const roleId = ownerRoleRows[0].roleId;

      // 3. Check that the branch doesn't already have an Owner (1 owner per branch)
      const [existingOwner] = await conn.execute(
        `SELECT accountId FROM users 
         WHERE brandId = ? AND branchId = ? AND roleId = ? AND status != 'Deleted'
         LIMIT 1 FOR UPDATE`,
        [brandId, branchId, roleId]
      );

      if (existingOwner.length > 0) {
        await req.db.rollback(conn);
        return res.sendError("This branch already has an Owner assigned", 409);
      }

      // 4. Check duplicate email in credentials
      const [existingCred] = await conn.execute(
        `SELECT accountId FROM credentials 
         WHERE email = ? AND status != 'Deleted'
         LIMIT 1 FOR UPDATE`,
        [email]
      );

      if (existingCred.length > 0) {
        await req.db.rollback(conn);
        return res.sendError("A user with this email already exists", 409);
      }

      // 5. Generate UUID
      const [uuidRow] = await conn.execute(`SELECT UUID() as id`);
      const accountId = uuidRow[0].id;

      // 6. Create user with Owner role
      await conn.execute(
        `INSERT INTO users (accountId, brandId, branchId, firstName, lastName, phone, roleId, status, dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`,
        [accountId, brandId, branchId, firstName, lastName, phone || null, roleId, now, now]
      );

      // 7. Create credential
      const { hash, salt } = await hashPassword(password);

      await conn.execute(
        `INSERT INTO credentials (accountId, email, password, salt, type, status, dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, 'ADMIN', 'Active', ?, ?)`,
        [accountId, email, hash, salt, now, now]
      );

      await req.db.commit(conn);

      return res.sendSuccess("User created successfully", { accountId, roleId }, 201);
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

export default router;
