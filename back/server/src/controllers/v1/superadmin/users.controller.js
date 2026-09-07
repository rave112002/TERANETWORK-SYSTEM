import express from "express";
import { catchAsync, validateBody, validateQuery } from "../../../utils/catchAsync.js";
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import { hashPassword } from "../../../utils/hashing/argonHash.js";
import {
  assignBranchesSchema,
  createOwnerSchema,
  listUsersQuerySchema,
} from "../../../validators/superadmin-users.validator.js";

const router = express.Router();

/**
 * GET /
 * List all users across all companies (SuperAdmin view)
 */
router.get(
  "/",
  validateQuery(listUsersQuerySchema),
  catchAsync(async (req, res) => {
    const {
      page = 1,
      pageSize = 10,
      search = "",
      companyId,
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

    if (companyId) {
      whereClause += ` AND u.companyId = ?`;
      params.push(companyId);
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
        u.companyId,
        u.branchId,
        u.firstName,
        u.lastName,
        u.phone,
        u.roleId,
        u.status,
        u.dateCreated,
        c.email,
        r.roleName,
        b.name as companyName,
        br.name as branchName
      FROM users u
      LEFT JOIN credentials c ON c.accountId = u.accountId
      LEFT JOIN roles r ON r.roleId = u.roleId
      LEFT JOIN companies b ON b.companyId = u.companyId
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
 * Create a new user (Owner) for a specific company+branch
 *
 * Flow:
 * 1. Validate that the branch exists and belongs to the company
 * 2. Check that the branch doesn't already have an Owner
 * 3. Find the Owner role for that company+branch
 * 4. Create user + credential with the Owner role
 *
 * Rule: 1 Owner per branch
 */
router.post(
  "/",
  validateBody(createOwnerSchema),
  catchAsync(async (req, res) => {
    const { firstName, lastName, email, password, phone, companyId, branchId } = req.body;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      // 1. Verify branch exists and belongs to the company
      const [branchRows] = await conn.execute(
        `SELECT branchId FROM branches 
         WHERE branchId = ? AND companyId = ? AND status != 'Deleted'
         LIMIT 1`,
        [branchId, companyId]
      );

      if (branchRows.length === 0) {
        await req.db.rollback(conn);
        return res.sendError("Branch not found or does not belong to this company", 404);
      }

      // 2. Find the Owner role for this company+branch
      const [ownerRoleRows] = await conn.execute(
        `SELECT roleId FROM roles 
         WHERE companyId = ? AND branchId = ? AND roleName = 'Owner' AND status = 'Active'
         LIMIT 1`,
        [companyId, branchId]
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
         WHERE companyId = ? AND branchId = ? AND roleId = ? AND status != 'Deleted'
         LIMIT 1 FOR UPDATE`,
        [companyId, branchId, roleId]
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
        `INSERT INTO users (accountId, companyId, branchId, firstName, lastName, phone, roleId, status, dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`,
        [accountId, companyId, branchId, firstName, lastName, phone || null, roleId, now, now]
      );

      // 7. Mirror the home branch into user_branches — the access boundary.
      //    Every user needs at least one row here or the `branchId IN (...)`
      //    scope predicate matches nothing and they see none of their own data.
      const [ubUuid] = await conn.execute(`SELECT UUID() as id`);
      await conn.execute(
        `INSERT INTO user_branches (userBranchId, accountId, branchId, status, dateCreated, dateUpdated)
         VALUES (?, ?, ?, 'Active', ?, ?)`,
        [ubUuid[0].id, accountId, branchId, now, now]
      );

      // 8. Create credential (Argon2 embeds the salt in the encoded hash)
      const hash = await hashPassword(password);

      await conn.execute(
        `INSERT INTO credentials (accountId, email, password, type, status, dateCreated, dateUpdated)
         VALUES (?, ?, ?, 'ADMIN', 'Active', ?, ?)`,
        [accountId, email, hash, now, now]
      );

      await req.db.commit(conn);

      return res.sendSuccess("User created successfully", { accountId, roleId }, 201);
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * GET /:accountId/branches
 * The branches a user is currently assigned to.
 */
router.get(
  "/:accountId/branches",
  catchAsync(async (req, res) => {
    const { accountId } = req.params;

    const [user] = await req.db.query(
      `SELECT accountId, companyId, branchId FROM users
       WHERE accountId = ? AND status != 'Deleted' LIMIT 1`,
      [accountId]
    );

    if (!user) {
      return res.sendError("User not found", 404);
    }

    const branches = await req.db.query(
      `SELECT ub.branchId, b.name, b.isMainBranch
       FROM user_branches ub
       INNER JOIN branches b ON b.branchId = ub.branchId
       WHERE ub.accountId = ? AND ub.status = 'Active'
       ORDER BY b.name ASC`,
      [accountId]
    );

    return res.sendSuccess("User branches retrieved successfully", {
      branches,
      homeBranchId: user.branchId,
    });
  })
);

/**
 * PUT /:accountId/branches
 * Replace a user's branch assignments. The first branch in the list becomes
 * their home branch (where records they create are filed).
 *
 * Assignments are retired rather than deleted — who had access to which branch,
 * and when, is worth keeping.
 */
router.put(
  "/:accountId/branches",
  validateBody(assignBranchesSchema),
  catchAsync(async (req, res) => {
    const { accountId } = req.params;
    const { branchIds } = req.body;
    const now = getCurrentTimestampLocal();
    const wanted = [...new Set(branchIds)];

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const [userRows] = await conn.execute(
        `SELECT accountId, companyId FROM users
         WHERE accountId = ? AND status != 'Deleted' LIMIT 1 FOR UPDATE`,
        [accountId]
      );

      if (userRows.length === 0) {
        await req.db.rollback(conn);
        return res.sendError("User not found", 404);
      }

      // Every branch must exist and belong to the user's own company — a user
      // must never be assigned across a company boundary.
      const placeholders = wanted.map(() => "?").join(", ");
      const [validBranches] = await conn.execute(
        `SELECT branchId FROM branches
         WHERE branchId IN (${placeholders}) AND companyId = ? AND status != 'Deleted'`,
        [...wanted, userRows[0].companyId]
      );

      if (validBranches.length !== wanted.length) {
        await req.db.rollback(conn);
        return res.sendError(
          "One or more branches do not exist or belong to another company",
          400
        );
      }

      await conn.execute(
        `UPDATE user_branches SET status = 'Inactive', dateUpdated = ?
         WHERE accountId = ? AND status = 'Active'`,
        [now, accountId]
      );

      for (const branchId of wanted) {
        const [ubUuid] = await conn.execute(`SELECT UUID() as id`);
        await conn.execute(
          `INSERT INTO user_branches (userBranchId, accountId, branchId, status, dateCreated, dateUpdated)
           VALUES (?, ?, ?, 'Active', ?, ?)
           ON DUPLICATE KEY UPDATE status = 'Active', dateUpdated = VALUES(dateUpdated)`,
          [ubUuid[0].id, accountId, branchId, now, now]
        );
      }

      await conn.execute(`UPDATE users SET branchId = ?, dateUpdated = ? WHERE accountId = ?`, [
        wanted[0],
        now,
        accountId,
      ]);

      await req.db.commit(conn);

      return res.sendSuccess("Branch assignments updated successfully", {
        branchIds: wanted,
        homeBranchId: wanted[0],
      });
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

export default router;
