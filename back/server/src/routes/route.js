// Importing Express framework
import { Router } from "express";

const router = Router();

// Importing route modules
import adminRoute from "./v1/admin/index.js";
import payController from "../controllers/v1/public/pay.controller.js";
import webhooksController from "../controllers/v1/public/webhooks.controller.js";
import uploadRoute from "../controllers/v1/upload/upload.controller.js";
import { idempotencyMiddleware } from "../middlewares/idempotency.middleware.js";
import { requireManageKey } from "../middlewares/requireManageKey.middleware.js";
import manageController from "../controllers/v1/manage/manage.controller.js";

// Idempotent mutations: requests carrying an Idempotency-Key header get their
// successful response cached and replayed on retry (opt-in, Stripe-style)
router.use(idempotencyMiddleware());

// Mount portal-based routes
router.use("/v1/admin", adminRoute);

// The customer-facing payment surface. No auth by design — the emailed
// /pay/<token> link is the credential. See controllers/v1/public/pay.controller.js
// for what that costs and how it is bounded.
router.use("/v1/public", payController);

// Payment gateway callbacks. No auth and no CSRF by necessity — a gateway is a
// server, holds no cookie, and cannot fetch a token. The signature is the
// authentication; see controllers/v1/public/webhooks.controller.js.
router.use("/v1/public/webhooks", webhooksController);

// The management API for the central SuperAdmin (docs/decisions.md D10). No user
// session: the per-branch MANAGE_API_KEY is the credential, and the whole API
// answers 503 until one is configured.
router.use("/v1/manage", requireManageKey(), manageController);

// Shared routes (accessible by all authenticated users)
import passport from "passport";
const requireAuth = passport.authenticate("jwt", { session: false });
router.use("/v1/upload", requireAuth, uploadRoute);

// Exporting the router to be used in the main app
export default router;
