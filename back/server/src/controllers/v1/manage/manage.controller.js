import express from "express";

import { catchAsync } from "../../../utils/catchAsync.js";
import { collectBranchHealth } from "../../../lib/manage/health.service.js";
import companyController from "./company.controller.js";
import usersController from "./users.controller.js";

const router = express.Router();

/**
 * The management API: what the central SuperAdmin calls on this branch
 * (docs/decisions.md D10, shared/manage-contract).
 *
 * Mounted behind `requireManageKey` in routes/route.js. There is no user here —
 * the key identifies the SuperAdmin app — so nothing in this controller reads
 * `req.user`, and nothing here returns customer or payment data.
 */

/**
 * GET /health
 *
 * Always 200 when the branch server is up, even if its database is not: the
 * report says what is wrong, and SuperAdmin tells "server down" (no answer)
 * apart from "server up, database down".
 */
router.get(
  "/health",
  catchAsync(async (req, res) => {
    const health = await collectBranchHealth(req.db);
    return res.sendSuccess("Branch health", health);
  })
);

router.use("/company-profile", companyController);
router.use("/users", usersController);

export default router;
