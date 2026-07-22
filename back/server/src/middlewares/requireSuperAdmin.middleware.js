import { ERROR_CODES } from "../utils/APIError.js";

/**
 * SuperAdmin portal guard
 *
 * Must be mounted AFTER the passport JWT middleware — it asserts the already
 * authenticated account is a SUPERADMIN. Without this, any active ADMIN/USER
 * token could reach the cross-tenant /api/v1/superadmin/* endpoints.
 */
export const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "User not authenticated",
      code: ERROR_CODES.TOKEN_INVALID,
    });
  }

  if (req.user.type !== "SUPERADMIN") {
    return res.status(403).json({
      success: false,
      message: "Forbidden: SuperAdmin access required",
      code: ERROR_CODES.FORBIDDEN,
    });
  }

  next();
};

export default requireSuperAdmin;
