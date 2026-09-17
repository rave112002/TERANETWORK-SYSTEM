import { Router } from "express";
import passport from "passport";

import authController from "../../../controllers/v1/auth/auth.controller.js";
import usersController from "../../../controllers/v1/admin/users.controller.js";
import rolesController from "../../../controllers/v1/admin/roles.controller.js";
import permissionsController from "../../../controllers/v1/admin/permissions.controller.js";
import userPermissionsController from "../../../controllers/v1/admin/user-permissions.controller.js";
import auditTrailController from "../../../controllers/v1/admin/audit-trail.controller.js";
import settingsController from "../../../controllers/v1/admin/settings.controller.js";
import dashboardController from "../../../controllers/v1/admin/dashboard.controller.js";
import plansController from "../../../controllers/v1/admin/plans.controller.js";
import customersController from "../../../controllers/v1/admin/customers.controller.js";
import oltsController from "../../../controllers/v1/admin/olts.controller.js";
import ponPortsController from "../../../controllers/v1/admin/pon-ports.controller.js";
import splittersController from "../../../controllers/v1/admin/splitters.controller.js";
import napsController from "../../../controllers/v1/admin/naps.controller.js";
import onusController from "../../../controllers/v1/admin/onus.controller.js";
import subscriptionsController from "../../../controllers/v1/admin/subscriptions.controller.js";
import systemController from "../../../controllers/v1/admin/system.controller.js";
import invoicesController from "../../../controllers/v1/admin/invoices.controller.js";
import paymentsController from "../../../controllers/v1/admin/payments.controller.js";
import paymentStatementsController from "../../../controllers/v1/admin/payment-statements.controller.js";
import adjustmentsController from "../../../controllers/v1/admin/adjustments.controller.js";
import dunningController from "../../../controllers/v1/admin/dunning.controller.js";
import reportsController from "../../../controllers/v1/admin/reports.controller.js";
import provisioningController from "../../../controllers/v1/admin/provisioning.controller.js";
import discoveryController from "../../../controllers/v1/admin/discovery.controller.js";
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
router.use("/dashboard", requireAuth, dashboardController);

// ── ISP domain ──
router.use("/plans", requireAuth, auditTrail("plans"), plansController);
router.use("/customers", requireAuth, auditTrail("customers"), customersController);

// ── Network inventory (OSS) ──
router.use("/network/olts", requireAuth, auditTrail("network"), oltsController);
router.use("/network/pon-ports", requireAuth, auditTrail("network"), ponPortsController);
router.use("/network/splitters", requireAuth, auditTrail("network"), splittersController);
router.use("/network/naps", requireAuth, auditTrail("network"), napsController);
router.use("/network/onus", requireAuth, auditTrail("network"), onusController);
// Mounted after /network/onus so the CRUD routes match first; these add the
// action sub-routes beneath the same path.
router.use("/network/provisioning", requireAuth, auditTrail("network"), provisioningController);
router.use("/network/discovery", requireAuth, auditTrail("network"), discoveryController);
router.use("/subscriptions", requireAuth, auditTrail("subscriptions"), subscriptionsController);
router.use("/system", requireAuth, auditTrail("system"), systemController);

// ── Billing ──
router.use("/invoices", requireAuth, auditTrail("billing"), invoicesController);
router.use("/payments", requireAuth, auditTrail("billing"), paymentsController);
router.use(
  "/payment-statements",
  requireAuth,
  auditTrail("billing"),
  paymentStatementsController
);
router.use("/adjustments", requireAuth, auditTrail("billing"), adjustmentsController);
router.use("/dunning", requireAuth, auditTrail("billing"), dunningController);

// Reports are read-only, so no auditTrail wrapper — the audit log records
// changes, and filling it with "somebody looked at the aging report" would
// bury the entries that matter.
router.use("/reports", requireAuth, reportsController);

export default router;
