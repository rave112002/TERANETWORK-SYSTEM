import express from "express";
import { catchAsync } from "../../../utils/catchAsync.js";

const router = express.Router();

/**
 * GET /
 * Get all available permissions (master list)
 */
router.get(
  "/",
  catchAsync(async (req, res) => {
    const permissions = await req.db.query(
      `SELECT 
        permissionId,
        module,
        submodule,
        description,
        portal,
        status
      FROM permissions
      WHERE status = 'Active'
      ORDER BY module, submodule`
    );

    return res.sendSuccess("Permissions retrieved successfully", { permissions });
  })
);

/**
 * GET /modules
 * Get list of available modules
 */
router.get(
  "/modules",
  catchAsync(async (req, res) => {
    const modules = await req.db.query(
      `SELECT DISTINCT module, submodule, description
       FROM permissions
       WHERE status = 'Active'
       ORDER BY module, submodule`
    );

    return res.sendSuccess("Modules retrieved successfully", { modules });
  })
);

/**
 * GET /user
 * Get current authenticated user's permissions
 * Combines role-based permissions + user-level overrides
 */
router.get(
  "/user",
  catchAsync(async (req, res) => {
    const accountId = req.user?.accountId;

    if (!accountId) {
      return res.sendError("Unauthorized", 401);
    }

    // roleId is already on the authenticated user (set by passport) — no extra
    // `SELECT roleId FROM users` round-trip. Coerce to null so a role-less user
    // (e.g. superadmin) binds cleanly and simply resolves to zero role permissions.
    const roleId = req.user.roleId ?? null;

    // Role permissions and user-specific overrides are independent — fetch in parallel.
    const [rolePermissions, userPermissions] = await Promise.all([
      req.db.query(
        `SELECT
        p.permissionId,
        p.module,
        p.submodule,
        p.description,
        rp.accessLevel,
        'role' as source
      FROM role_permissions rp
      INNER JOIN permissions p ON p.permissionId = rp.permissionId
      WHERE rp.roleId = ? AND p.status = 'Active'`,
        [roleId]
      ),
      req.db.query(
        `SELECT
        p.permissionId,
        p.module,
        p.submodule,
        p.description,
        up.accessLevel,
        'user' as source
      FROM user_permissions up
      INNER JOIN permissions p ON p.permissionId = up.permissionId
      WHERE up.accountId = ? AND p.status = 'Active'`,
        [accountId]
      ),
    ]);

    // Merge: user overrides take precedence over role permissions
    const permissionMap = new Map();

    for (const perm of rolePermissions) {
      permissionMap.set(perm.permissionId, perm);
    }

    for (const perm of userPermissions) {
      if (perm.accessLevel === "none") {
        // 'none' override removes the permission
        permissionMap.delete(perm.permissionId);
      } else {
        permissionMap.set(perm.permissionId, perm);
      }
    }

    const permissions = Array.from(permissionMap.values());

    return res.sendSuccess("User permissions retrieved", { permissions });
  })
);

/**
 * POST /check
 * Check if current user has a specific permission
 */
router.post(
  "/check",
  catchAsync(async (req, res) => {
    const { module, submodule, accessLevel } = req.body;
    const accountId = req.user?.accountId;

    if (!accountId) {
      return res.sendError("Unauthorized", 401);
    }

    // roleId is already on the authenticated user (set by passport). Coerce to
    // null so a role-less user resolves to "no role permission" rather than erroring.
    const roleId = req.user.roleId ?? null;

    // Check user-level override first
    const userPerm = await req.db.query(
      `SELECT up.accessLevel
       FROM user_permissions up
       INNER JOIN permissions p ON p.permissionId = up.permissionId
       WHERE up.accountId = ? AND p.module = ? AND (p.submodule <=> ?) AND p.status = 'Active'
       LIMIT 1`,
      [accountId, module, submodule || null]
    );

    if (userPerm.length > 0) {
      // User has an explicit override
      const userLevel = userPerm[0].accessLevel;
      if (userLevel === "none") {
        return res.sendSuccess("Permission check", { hasPermission: false });
      }
      const levelHierarchy = { none: 0, read: 1, write: 2 };
      const hasAccess = levelHierarchy[userLevel] >= levelHierarchy[accessLevel || "read"];
      return res.sendSuccess("Permission check", { hasPermission: hasAccess });
    }

    // Check role-level permission
    const rolePerm = await req.db.query(
      `SELECT 1 FROM role_permissions rp
       INNER JOIN permissions p ON p.permissionId = rp.permissionId
       WHERE rp.roleId = ? AND p.module = ? AND (p.submodule <=> ?) AND p.status = 'Active'
       LIMIT 1`,
      [roleId, module, submodule || null]
    );

    return res.sendSuccess("Permission check", {
      hasPermission: rolePerm.length > 0,
    });
  })
);

export default router;
