import { logger } from "../../config/logger.js";
import { ERROR_CODES } from "../utils/APIError.js";

/**
 * Permission check middleware for RBAC
 * Checks if user has required permission based on module, submodule, and access level
 * Priority: User-specific permissions override role permissions
 */
export const checkPermission = (module, submodule = null, accessLevel = "read") => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.accountId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
          code: ERROR_CODES.TOKEN_INVALID,
        });
      }

      let userAccessLevel = null;
      let permissionSource = null;

      // 1. Check user-specific permissions first (overrides take priority)
      try {
        let userPermQuery = `
          SELECT up.accessLevel
          FROM user_permissions up
          JOIN permissions p ON up.permissionId = p.permissionId
          WHERE up.accountId = ? AND p.module = ? AND p.status = 'Active'
        `;
        const userPermParams = [userId, module];

        if (submodule) {
          userPermQuery += " AND p.submodule = ?";
          userPermParams.push(submodule);
        } else {
          userPermQuery += " AND p.submodule IS NULL";
        }

        const userPermResult = await req.db.query(userPermQuery, userPermParams);

        if (userPermResult.length > 0) {
          userAccessLevel = userPermResult[0].accessLevel;
          permissionSource = "user";
        }
      } catch (userPermError) {
        // If user_permissions check fails, fall back to role permissions
        (req.logger || logger).warn(
          "User permissions check failed, falling back to role permissions",
          { error: userPermError.message }
        );
      }

      // 2. If no user-specific permission found, check role permissions
      if (!userAccessLevel) {
        // roleId is already on the JWT-authenticated user (set by passport),
        // so no extra `SELECT roleId FROM users` round-trip is needed here.
        const roleId = req.user.roleId;

        if (!roleId) {
          return res.status(403).json({
            success: false,
            message: "No role assigned to user",
            code: ERROR_CODES.FORBIDDEN,
          });
        }

        let rolePermQuery = `
          SELECT rp.accessLevel
          FROM role_permissions rp
          JOIN permissions p ON rp.permissionId = p.permissionId
          WHERE rp.roleId = ? AND p.module = ? AND p.status = 'Active'
        `;
        const rolePermParams = [roleId, module];

        if (submodule) {
          rolePermQuery += " AND p.submodule = ?";
          rolePermParams.push(submodule);
        } else {
          rolePermQuery += " AND p.submodule IS NULL";
        }

        const rolePermResult = await req.db.query(rolePermQuery, rolePermParams);

        if (rolePermResult.length === 0) {
          return res.status(403).json({
            success: false,
            message: "Insufficient permissions",
            code: ERROR_CODES.FORBIDDEN,
            required: submodule
              ? `${module}.${submodule} (${accessLevel})`
              : `${module} (${accessLevel})`,
          });
        }

        userAccessLevel = rolePermResult[0].accessLevel;
        permissionSource = "role";
      }

      // 3. Check access level hierarchy: none < read < write
      const accessLevels = { none: 0, read: 1, write: 2 };

      if (accessLevels[userAccessLevel] < accessLevels[accessLevel]) {
        return res.status(403).json({
          success: false,
          message: "Insufficient access level",
          code: ERROR_CODES.FORBIDDEN,
          required: accessLevel,
          current: userAccessLevel,
        });
      }

      // 4. Attach permission info to request for downstream use
      req.userPermission = {
        module,
        submodule,
        accessLevel: userAccessLevel,
        source: permissionSource, // 'user' or 'role'
      };

      next();
    } catch (err) {
      (req.logger || logger).error("Permission check error", {
        error: err.message,
        stack: err.stack,
      });
      return res.status(500).json({
        success: false,
        message: "Failed to check permissions",
        code: ERROR_CODES.INTERNAL_ERROR,
      });
    }
  };
};
