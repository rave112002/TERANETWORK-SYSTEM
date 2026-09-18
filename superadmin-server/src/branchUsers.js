import express from "express";

import { callBranch, sendBranchResult } from "./branchCall.js";

/**
 * A branch's logins, through that branch's management API. Mounted at
 * /api/branches/:branchId/users; `req.branch` is set by branches.js.
 *
 * Passwords pass through to the branch, which hashes them. This server never
 * stores or logs them.
 */

/**
 * @param {{fetchImpl?: typeof fetch}} deps
 */
export const createBranchUsersRouter = ({ fetchImpl } = {}) => {
  const router = express.Router({ mergeParams: true });

  const call = (req, path, options = {}) =>
    callBranch(req.branch, path, { ...options, actor: req.user.username, fetchImpl });

  const id = (req) => encodeURIComponent(req.params.accountId);

  router.get("/", async (req, res) => sendBranchResult(res, await call(req, "/users"), "Branch logins"));

  router.post("/", async (req, res) =>
    sendBranchResult(res, await call(req, "/users", { method: "POST", json: req.body ?? {} }), "Login created")
  );

  router.put("/:accountId/password", async (req, res) =>
    sendBranchResult(
      res,
      await call(req, `/users/${id(req)}/password`, { method: "PUT", json: { password: req.body?.password } }),
      "Password reset"
    )
  );

  router.put("/:accountId/status", async (req, res) =>
    sendBranchResult(
      res,
      await call(req, `/users/${id(req)}/status`, { method: "PUT", json: { status: req.body?.status } }),
      "Login updated"
    )
  );

  return router;
};

export default { createBranchUsersRouter };
