import express from "express";
import { catchAsync, validateBody, validateQuery } from "../../../utils/catchAsync.js";
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import { branchScope, getScopedBranchIds } from "../../../utils/branchScope.js";
import {
  createRoleSchema,
  updateRoleSchema,
  assignPermissionsSchema,
  listRolesQuerySchema,
} from "../../../validators/roles.validator.js";

const router = express.Router();

/**
 * Resolve a role the caller is actually allowed to touch. Returns undefined
 * when the role does not exist, belongs to another company, or sits in a branch
 * outside the caller's assignment — all three are reported to the client as a
 * plain 404 so role IDs cannot be probed.
 *
 * @returns {Promise<{roleId: string, branchId: string}|undefined>}
 */
const findScopedRole = async (req, roleId) => {
  const scope = branchScope("branchId", getScopedBranchIds(req.user));
  const [role] = await req.db.query(
    `SELECT roleId, branchId FROM roles
     WHERE roleId = ? AND companyId = ?${scope.clause} AND status != 'Deleted'
     LIMIT 1`,
    [roleId, req.user.companyId, ...scope.params]
  );
  return role;
};

/**
 * GET /
 * List all roles (scoped to the authenticated user's company + assigned branches)
 */
router.get(
  "/",
  checkPermission("users", "roles", "read"),
  validateQuery(listRolesQuerySchema),
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
    const scope = branchScope("r.branchId", getScopedBranchIds(req.user));
    const offset = (page - 1) * pageSize;
    const params = [companyId, ...scope.params];
    let whereClause = `WHERE r.companyId = ?${scope.clause} AND r.status != 'Deleted' AND r.roleName != 'Owner'`;

    if (search) {
      whereClause += ` AND (r.roleName LIKE ? OR r.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      whereClause += ` AND r.status = ?`;
      params.push(status);
    }

    const allowedSortColumns = ["dateCreated", "dateUpdated", "roleName"];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : "dateCreated";
    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const [countRows, roles] = await Promise.all([
      req.db.query(
        `SELECT COUNT(*) as total FROM roles r ${whereClause}`,
        params
      ),
      req.db.query(
        `SELECT
        r.roleId,
        r.companyId,
        r.branchId,
        r.roleName,
        r.description,
        r.status,
        r.dateCreated,
        r.dateUpdated
      FROM roles r
      ${whereClause}
      ORDER BY r.${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
    ]);
    const total = countRows[0]?.total || 0;

    return res.sendSuccess("Roles retrieved successfully", {
      roles,
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
 * GET /:roleId
 * Get single role
 */
router.get(
  "/:roleId",
  checkPermission("users", "roles", "read"),
  catchAsync(async (req, res) => {
    const { roleId } = req.params;
    const { companyId } = req.user;
    const scope = branchScope("branchId", getScopedBranchIds(req.user));
    const roles = await req.db.query(
      `SELECT roleId, companyId, branchId, roleName, description, status, dateCreated, dateUpdated
       FROM roles WHERE roleId = ? AND companyId = ?${scope.clause} AND status != 'Deleted' LIMIT 1`,
      [roleId, companyId, ...scope.params]
    );

    if (roles.length === 0) {
      return res.sendError("Role not found", 404);
    }

    return res.sendSuccess("Role retrieved successfully", { role: roles[0] });
  })
);

/**
 * POST /
 * Create new role
 */
router.post(
  "/",
  checkPermission("users", "roles", "write"),
  validateBody(createRoleSchema),
  catchAsync(async (req, res) => {
    const { roleName, description } = req.body;
    const { companyId, branchId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      // Generate UUID from MySQL
      const [uuidRow] = await conn.execute(`SELECT UUID() as id`);
      const roleId = uuidRow[0].id;

      // Check duplicate roleName within same company/branch
      const [existing] = await conn.execute(
        `SELECT roleId FROM roles 
         WHERE roleName = ? AND companyId = ? AND branchId = ? AND status != 'Deleted'
         LIMIT 1 FOR UPDATE`,
        [roleName, companyId, branchId]
      );

      if (existing.length > 0) {
        await req.db.rollback(conn);
        return res.sendError("A role with this name already exists", 409);
      }

      await conn.execute(
        `INSERT INTO roles (roleId, companyId, branchId, roleName, description, status, dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?, 'Active', ?, ?)`,
        [roleId, companyId, branchId, roleName, description || null, now, now]
      );

      await req.db.commit(conn);

      return res.sendSuccess("Role created successfully", { roleId }, 201);
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * PUT /:roleId
 * Update role
 */
router.put(
  "/:roleId",
  checkPermission("users", "roles", "write"),
  validateBody(updateRoleSchema),
  catchAsync(async (req, res) => {
    const { roleId } = req.params;
    const { roleName, description, status } = req.body;
    const now = getCurrentTimestampLocal();

    if (!(await findScopedRole(req, roleId))) {
      return res.sendError("Role not found", 404);
    }

    const result = await req.db.query(
      `UPDATE roles
       SET roleName = ?, description = ?, status = ?, dateUpdated = ?
       WHERE roleId = ? AND status != 'Deleted'`,
      [roleName, description || null, status || "Active", now, roleId]
    );

    if (result.affectedRows === 0) {
      return res.sendError("Role not found", 404);
    }

    return res.sendSuccess("Role updated successfully");
  })
);

/**
 * DELETE /:roleId
 * Soft delete role (status → Inactive since roles only have Active/Inactive)
 */
router.delete(
  "/:roleId",
  checkPermission("users", "roles", "write"),
  catchAsync(async (req, res) => {
    const { roleId } = req.params;
    const now = getCurrentTimestampLocal();

    if (!(await findScopedRole(req, roleId))) {
      return res.sendError("Role not found", 404);
    }

    const result = await req.db.query(
      `UPDATE roles SET status = 'Inactive', dateUpdated = ? WHERE roleId = ? AND status = 'Active'`,
      [now, roleId]
    );

    if (result.affectedRows === 0) {
      return res.sendError("Role not found", 404);
    }

    return res.sendSuccess("Role deleted successfully");
  })
);

/**
 * GET /:roleId/permissions
 * Get permissions assigned to a role
 */
router.get(
  "/:roleId/permissions",
  checkPermission("users", "roles", "read"),
  catchAsync(async (req, res) => {
    const { roleId } = req.params;

    if (!(await findScopedRole(req, roleId))) {
      return res.sendError("Role not found", 404);
    }

    const permissions = await req.db.query(
      `SELECT
        rp.id,
        rp.roleId,
        rp.permissionId,
        rp.accessLevel,
        rp.dateCreated,
        p.module,
        p.submodule,
        p.description
      FROM role_permissions rp
      INNER JOIN permissions p ON p.permissionId = rp.permissionId
      WHERE rp.roleId = ?`,
      [roleId]
    );

    return res.sendSuccess("Role permissions retrieved", { permissions });
  })
);

/**
 * POST /:roleId/permissions
 * Assign permissions to a role (replaces existing)
 * Body: { permissions: ["permissionId1", "permissionId2", ...] }
 */
router.post(
  "/:roleId/permissions",
  checkPermission("users", "roles", "write"),
  validateBody(assignPermissionsSchema),
  catchAsync(async (req, res) => {
    const { roleId } = req.params;
    const { permissions } = req.body;
    const now = getCurrentTimestampLocal();

    if (!(await findScopedRole(req, roleId))) {
      return res.sendError("Role not found", 404);
    }

    let conn;
    try {
      conn = await req.db.beginTransaction();

      // Remove existing permissions for this role
      await conn.execute(`DELETE FROM role_permissions WHERE roleId = ?`, [roleId]);

      // Insert new permissions in a single bulk statement.
      // Each perm must be { permissionId, accessLevel }.
      if (permissions && permissions.length > 0) {
        const placeholders = permissions.map(() => "(?, ?, ?, ?)").join(", ");
        const values = permissions.flatMap((perm) => [
          roleId,
          perm.permissionId,
          perm.accessLevel,
          now,
        ]);
        await conn.execute(
          `INSERT INTO role_permissions (roleId, permissionId, accessLevel, dateCreated)
           VALUES ${placeholders}`,
          values
        );
      }

      await req.db.commit(conn);

      return res.sendSuccess("Permissions assigned successfully");
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

export default router;
