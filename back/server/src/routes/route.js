// Importing Express framework
import { Router } from "express";

const router = Router();

// Importing route modules
import adminRoute from "./v1/admin/index.js";
import superAdminRoute from "./v1/superadmin/index.js";
import uploadRoute from "../controllers/v1/upload/upload.controller.js";

// Mount portal-based routes
router.use("/v1/admin", adminRoute);
router.use("/v1/superadmin", superAdminRoute);

// Shared routes (accessible by all authenticated users)
import passport from "passport";
const requireAuth = passport.authenticate("jwt", { session: false });
router.use("/v1/upload", requireAuth, uploadRoute);

// Exporting the router to be used in the main app
export default router;
