import express from "express";
import process from "node:process";
import { catchAsync } from "../../../utils/catchAsync.js";
import { availableProviders, gatewayStatus } from "../../../lib/payment-gateways/index.js";

const router = express.Router();

/**
 * GET /
 * Read-only platform/system information for the SuperAdmin System Settings page.
 */
router.get(
  "/",
  catchAsync(async (req, res) => {
    const dbHealthy = await req.db.healthCheck().catch(() => false);

    return res.sendSuccess("System info retrieved successfully", {
      system: {
        appName: process.env.APP_NAME || "Template",
        environment: process.env.NODE_ENV || "development",
        nodeVersion: process.version,
        timezone: process.env.TIMEZONE || "Asia/Manila",
        uptimeSeconds: Math.floor(process.uptime()),
        database: dbHealthy ? "connected" : "unreachable",
      },
      // What a branch may be set to collect through. Read from the registry
      // rather than listed here, so a new adapter appears in the branch form
      // the moment it is wired up — the alternative is a dropdown that quietly
      // lags the code by one release.
      paymentGateway: {
        ...gatewayStatus(),
        available: availableProviders(),
      },
    });
  })
);

export default router;
