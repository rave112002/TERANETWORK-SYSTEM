import express from "express";
import { catchAsync, validateBody, validateQuery } from "../../../utils/catchAsync.js";
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import { hashPassword } from "../../../utils/hashing/argonHash.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import {
  assertBranchInScope,
  branchScope,
  getScopedBranchIds,
} from "../../../utils/branchScope.js";
import {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
} from "../../../validators/admin-users.validator.js";

const router = express.Router();

/**
 * GET /
 * List all users with pagination and filtering
 * Scoped to the authenticated user's company/branch
 */
router.get(
  "/",
  checkPermission("users", "list", "read"),
  validateQuery(listUsersQuerySchema),
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
    const scope = branchScope("u.branchId", getScopedBranchIds(req.user));

    const offset = (page - 1) * pageSize;
    const params = [companyId, ...scope.params];
    let whereClause = `WHERE u.companyId = ?${scope.clause} AND u.status != 'Deleted' AND r.roleName != 'Owner'`;

    if (search) {
      whereClause += ` AND (u.firstName LIKE ? OR u.lastName LIKE ? OR c.email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      whereClause += ` AND u.status = ?`;
      params.push(status);
    }

    // Whitelist sort inputs before interpolating into SQL
    const allowedSortColumns = ["dateCreated", "dateUpdated", "firstName", "lastName"];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : "dateCreated";
    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    // Count + page are independent — run them on parallel pooled connections
    const [countRows, users] = await Promise.all([
      req.db.query(
        `SELECT COUNT(*) as total
         FROM users u
         LEFT JOIN credentials c ON c.accountId = u.accountId
         LEFT JOIN roles r ON r.roleId = u.roleId
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
        u.imageUrl,
        u.roleId,
        u.status,
        u.dateCreated,
        u.dateUpdated,
        c.email,
        r.roleName
      FROM users u
      LEFT JOIN credentials c ON c.accountId = u.accountId
      LEFT JOIN roles r ON r.roleId = u.roleId
      ${whereClause}
      ORDER BY u.${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
    ]);
    const total = countRows[0]?.total || 0;

    return res.sendSuccess("Users retrieved successfully", {
      users,
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
 * GET /:userId
 * Get single user by accountId
 */
router.get(
  "/:userId",
  checkPermission("users", "list", "read"),
  catchAsync(async (req, res) => {
    const { userId } = req.params;
    const { companyId } = req.user;
    const scope = branchScope("u.branchId", getScopedBranchIds(req.user));

    const users = await req.db.query(
      `SELECT
        u.accountId,
        u.companyId,
        u.branchId,
        u.firstName,
        u.lastName,
        u.phone,
        u.imageUrl,
        u.signature,
        u.roleId,
        u.status,
        u.dateCreated,
        u.dateUpdated,
        c.email,
        r.roleName
      FROM users u
      LEFT JOIN credentials c ON c.accountId = u.accountId
      LEFT JOIN roles r ON r.roleId = u.roleId
      WHERE u.accountId = ? AND u.companyId = ?${scope.clause} AND u.status != 'Deleted'
      LIMIT 1`,
      [userId, companyId, ...scope.params]
    );

    if (users.length === 0) {
      return res.sendError("User not found", 404);
    }

    // Every branch this user is assigned to, so the edit form can show the
    // current assignment rather than just the home branch.
    const assigned = await req.db.query(
      `SELECT ub.branchId, b.name AS branchName
       FROM user_branches ub
       INNER JOIN branches b ON b.branchId = ub.branchId
       WHERE ub.accountId = ? AND ub.status = 'Active'
       ORDER BY b.name ASC`,
      [userId]
    );

    return res.sendSuccess("User retrieved successfully", {
      user: { ...users[0], branches: assigned, branchIds: assigned.map((b) => b.branchId) },
    });
  })
);

/**
 * POST /
 * Create a new user + credential
 */
router.post(
  "/",
  checkPermission("users", "list", "write"),
  validateBody(createUserSchema),
  catchAsync(async (req, res) => {
    const { firstName, lastName, email, password, phone, roleId, branchIds } = req.body;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    // Default to the creator's own home branch. Anything explicit must be a
    // branch the creator themselves has access to — otherwise an admin could
    // seed a user into a branch they cannot see.
    const targetBranchIds = branchIds?.length ? [...new Set(branchIds)] : [req.user.branchId];
    targetBranchIds.forEach((id) => assertBranchInScope(req.user, id));
    const homeBranchId = targetBranchIds[0];

    let conn;
    try {
      conn = await req.db.beginTransaction();

      // Check for duplicate email in credentials
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

      // Generate UUID from MySQL
      const [uuidRow] = await conn.execute(`SELECT UUID() as id`);
      const accountId = uuidRow[0].id;

      // Create user
      await conn.execute(
        `INSERT INTO users (accountId, companyId, branchId, firstName, lastName, phone, roleId, status, dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`,
        [accountId, companyId, homeBranchId, firstName, lastName, phone || null, roleId, now, now]
      );

      // Branch assignments — the access boundary. The home branch is always one
      // of them, so `branchId IN (...)` needs no special case.
      for (const targetBranchId of targetBranchIds) {
        const [ubUuid] = await conn.execute(`SELECT UUID() as id`);
        await conn.execute(
          `INSERT INTO user_branches (userBranchId, accountId, branchId, status, dateCreated, dateUpdated)
           VALUES (?, ?, ?, 'Active', ?, ?)`,
          [ubUuid[0].id, accountId, targetBranchId, now, now]
        );
      }

      // Create credential (Argon2 embeds the salt in the encoded hash)
      const hash = await hashPassword(password);

      await conn.execute(
        `INSERT INTO credentials (accountId, email, password, type, status, dateCreated, dateUpdated)
         VALUES (?, ?, ?, 'ADMIN', 'Active', ?, ?)`,
        [accountId, email, hash, now, now]
      );

      await req.db.commit(conn);

      return res.sendSuccess("User created successfully", { accountId }, 201);
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * PUT /:userId
 * Update user
 */
router.put(
  "/:userId",
  checkPermission("users", "list", "write"),
  validateBody(updateUserSchema),
  catchAsync(async (req, res) => {
    const { userId } = req.params;
    const { firstName, lastName, phone, roleId, status, branchIds } = req.body;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();
    const scope = branchScope("branchId", getScopedBranchIds(req.user));

    // Omitting branchIds leaves the current assignment alone. Sending it
    // replaces the assignment wholesale, and the first entry becomes the new
    // home branch.
    const nextBranchIds = branchIds?.length ? [...new Set(branchIds)] : null;
    if (nextBranchIds) nextBranchIds.forEach((id) => assertBranchInScope(req.user, id));

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const [result] = await conn.execute(
        `UPDATE users
         SET firstName = ?, lastName = ?, phone = ?, roleId = ?, status = ?,
             branchId = COALESCE(?, branchId), dateUpdated = ?
         WHERE accountId = ? AND companyId = ?${scope.clause} AND status != 'Deleted'`,
        [
          firstName,
          lastName,
          phone || null,
          roleId,
          status || "Active",
          nextBranchIds ? nextBranchIds[0] : null,
          now,
          userId,
          companyId,
          ...scope.params,
        ]
      );

      if (result.affectedRows === 0) {
        await req.db.rollback(conn);
        return res.sendError("User not found", 404);
      }

      if (nextBranchIds) {
        // Retire assignments that are no longer wanted rather than deleting
        // them — who had access to what, and when, is worth keeping.
        await conn.execute(
          `UPDATE user_branches SET status = 'Inactive', dateUpdated = ?
           WHERE accountId = ? AND status = 'Active'`,
          [now, userId]
        );

        for (const targetBranchId of nextBranchIds) {
          const [ubUuid] = await conn.execute(`SELECT UUID() as id`);
          await conn.execute(
            `INSERT INTO user_branches (userBranchId, accountId, branchId, status, dateCreated, dateUpdated)
             VALUES (?, ?, ?, 'Active', ?, ?)
             ON DUPLICATE KEY UPDATE status = 'Active', dateUpdated = VALUES(dateUpdated)`,
            [ubUuid[0].id, userId, targetBranchId, now, now]
          );
        }
      }

      await req.db.commit(conn);

      return res.sendSuccess("User updated successfully");
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * DELETE /:userId
 * Soft delete user (sets status to 'Deleted')
 */
router.delete(
  "/:userId",
  checkPermission("users", "list", "write"),
  catchAsync(async (req, res) => {
    const { userId } = req.params;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();
    const scope = branchScope("branchId", getScopedBranchIds(req.user));

    let conn;
    try {
      conn = await req.db.beginTransaction();

      // Soft delete user
      const [userResult] = await conn.execute(
        `UPDATE users SET status = 'Deleted', dateUpdated = ?
         WHERE accountId = ? AND companyId = ?${scope.clause} AND status != 'Deleted'`,
        [now, userId, companyId, ...scope.params]
      );

      if (userResult.affectedRows === 0) {
        await req.db.rollback(conn);
        return res.sendError("User not found", 404);
      }

      // Retire their branch assignments so a deleted account cannot be revived
      // with stale access.
      await conn.execute(
        `UPDATE user_branches SET status = 'Deleted', dateUpdated = ? WHERE accountId = ?`,
        [now, userId]
      );

      // Soft delete credential
      await conn.execute(
        `UPDATE credentials SET status = 'Deleted', dateUpdated = ? WHERE accountId = ?`,
        [now, userId]
      );

      await req.db.commit(conn);

      return res.sendSuccess("User deleted successfully");
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

export default router;
