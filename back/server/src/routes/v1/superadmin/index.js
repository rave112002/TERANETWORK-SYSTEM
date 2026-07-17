import { Router } from "express";
import passport from "passport";

import authController from "../../../controllers/v1/auth/auth.controller.js";
import companiesController from "../../../controllers/v1/superadmin/companies.controller.js";
import branchesController from "../../../controllers/v1/superadmin/branches.controller.js";
import usersController from "../../../controllers/v1/superadmin/users.controller.js";

const router = Router();
const requireAuth = passport.authenticate("jwt", { session: false });

// Public routes (no auth required)
router.use("/auth", authController);

// Protected routes (JWT required)
router.use("/companies", requireAuth, companiesController);
router.use("/branches", requireAuth, branchesController);
router.use("/users", requireAuth, usersController);

export default router;
