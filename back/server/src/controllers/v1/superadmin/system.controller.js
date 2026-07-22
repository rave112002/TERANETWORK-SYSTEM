import express from "express";
import process from "node:process";
import { catchAsync } from "../../../utils/catchAsync.js";

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
    });
  })
);

export default router;
