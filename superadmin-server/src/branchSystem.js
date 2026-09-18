import express from "express";

import { callBranch, sendBranchResult } from "./branchCall.js";

/**
 * A branch's runtime settings (dry-run, billing schedule, grace days, VAT,
 * pull-out delay), through that branch's management API. Mounted at
 * /api/branches/:branchId/system-settings.
 *
 * The branch validates and audits everything; the rules are the same ones its
 * own Admin portal uses. Nothing is kept here.
 */

/**
 * @param {{fetchImpl?: typeof fetch}} deps
 */
export const createBranchSystemRouter = ({ fetchImpl } = {}) => {
  const router = express.Router({ mergeParams: true });

  const call = (req, options = {}) =>
    callBranch(req.branch, "/system-settings", { ...options, actor: req.user.username, fetchImpl });

  router.get("/", async (req, res) => sendBranchResult(res, await call(req), "System settings"));

  router.put("/", async (req, res) =>
    sendBranchResult(res, await call(req, { method: "PUT", json: req.body ?? {} }), "System settings saved")
  );

  return router;
};

export default { createBranchSystemRouter };
