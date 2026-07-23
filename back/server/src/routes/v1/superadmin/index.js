import { Router } from "express";
import passport from "passport";

import authController from "../../../controllers/v1/auth/auth.controller.js";
import companiesController from "../../../controllers/v1/superadmin/companies.controller.js";
import branchesController from "../../../controllers/v1/superadmin/branches.controller.js";
import usersController from "../../../controllers/v1/superadmin/users.controller.js";
import systemController from "../../../controllers/v1/superadmin/system.controller.js";
import dashboardController from "../../../controllers/v1/superadmin/dashboard.controller.js";
import { requireSuperAdmin } from "../../../middlewares/requireSuperAdmin.middleware.js";

const router = Router();
const requireAuth = passport.authenticate("jwt", { session: false });

// Public routes (no auth required)
router.use("/auth", authController);

// Protected routes (JWT required + SUPERADMIN account type)
router.use("/companies", requireAuth, requireSuperAdmin, companiesController);
router.use("/branches", requireAuth, requireSuperAdmin, branchesController);
router.use("/users", requireAuth, requireSuperAdmin, usersController);
router.use("/system-info", requireAuth, requireSuperAdmin, systemController);
router.use("/dashboard", requireAuth, requireSuperAdmin, dashboardController);

export default router;
