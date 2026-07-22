import { Router } from "express";
import passport from "passport";

import authController from "../../../controllers/v1/auth/auth.controller.js";
import usersController from "../../../controllers/v1/admin/users.controller.js";
import rolesController from "../../../controllers/v1/admin/roles.controller.js";
import permissionsController from "../../../controllers/v1/admin/permissions.controller.js";
import userPermissionsController from "../../../controllers/v1/admin/user-permissions.controller.js";
import auditTrailController from "../../../controllers/v1/admin/audit-trail.controller.js";
import settingsController from "../../../controllers/v1/admin/settings.controller.js";
import { auditTrail } from "../../../middlewares/auditTrail.middleware.js";

const router = Router();
const requireAuth = passport.authenticate("jwt", { session: false });

// Public routes (no auth required)
router.use("/auth", authController);

// Protected routes (JWT required + auto audit logging)
router.use("/users", requireAuth, auditTrail("users"), usersController);
router.use("/roles", requireAuth, auditTrail("roles"), rolesController);
router.use("/permissions", requireAuth, permissionsController);
router.use(
  "/user-permissions",
  requireAuth,
  auditTrail("user-permissions"),
  userPermissionsController
);
router.use("/audit-trail", requireAuth, auditTrailController);
router.use("/settings", requireAuth, auditTrail("settings"), settingsController);

export default router;
