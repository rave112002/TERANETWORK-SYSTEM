// Importing Express framework
import { Router } from "express";

const router = Router();

// Importing route modules
import adminRoute from "./v1/admin/index.js";
import superAdminRoute from "./v1/superadmin/index.js";
import payController from "../controllers/v1/public/pay.controller.js";
import uploadRoute from "../controllers/v1/upload/upload.controller.js";
import { idempotencyMiddleware } from "../middlewares/idempotency.middleware.js";

// Idempotent mutations: requests carrying an Idempotency-Key header get their
// successful response cached and replayed on retry (opt-in, Stripe-style)
router.use(idempotencyMiddleware());

// Mount portal-based routes
router.use("/v1/admin", adminRoute);
router.use("/v1/superadmin", superAdminRoute);

// The customer-facing payment surface. No auth by design — the emailed
// /pay/<token> link is the credential. See controllers/v1/public/pay.controller.js
// for what that costs and how it is bounded.
router.use("/v1/public", payController);

// Shared routes (accessible by all authenticated users)
import passport from "passport";
const requireAuth = passport.authenticate("jwt", { session: false });
router.use("/v1/upload", requireAuth, uploadRoute);

// Exporting the router to be used in the main app
export default router;
