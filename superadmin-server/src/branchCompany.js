import { Readable } from "node:stream";

import express from "express";

import { MAX_LOGO_BYTES } from "../../shared/manage-contract/index.js";
import { callBranch, sendBranchResult } from "./branchCall.js";
import { fail } from "./respond.js";

/**
 * A branch's company profile, through that branch's management API. Mounted at
 * /api/branches/:branchId/company-profile; `req.branch` is set by branches.js
 * (the row plus its decrypted key).
 *
 * Nothing is stored here: every read and change goes straight to the branch.
 */

const forward = sendBranchResult;

/**
 * @param {{fetchImpl?: typeof fetch}} deps
 */
export const createBranchCompanyRouter = ({ fetchImpl } = {}) => {
  const router = express.Router({ mergeParams: true });

  const call = (req, path, options = {}) =>
    callBranch(req.branch, path, { ...options, actor: req.user.username, fetchImpl });

  router.get("/", async (req, res) =>
    forward(res, await call(req, "/company-profile"), "Company profile")
  );

  router.put("/", async (req, res) =>
    forward(
      res,
      await call(req, "/company-profile", { method: "PUT", json: req.body ?? {} }),
      "Company profile saved"
    )
  );

  /**
   * The upload is passed through as-is — multipart body and all — so this
   * server never parses, stores or re-encodes the image. The branch checks the
   * type and size; the length check here only stops an oversized upload early.
   */
  router.put("/logo", async (req, res) => {
    const type = req.get("content-type") || "";
    const length = Number(req.get("content-length"));
    if (!type.startsWith("multipart/form-data")) return fail(res, 400, "Send the logo as a file upload");
    if (!length || length > MAX_LOGO_BYTES + 64 * 1024) {
      return fail(res, 413, `The logo must be ${MAX_LOGO_BYTES / 1024 / 1024} MB or smaller`);
    }

    const result = await call(req, "/company-profile/logo", {
      method: "PUT",
      stream: Readable.toWeb(req),
      headers: { "content-type": type, "content-length": String(length) },
      timeoutMs: 30000,
    });
    return forward(res, result, "Logo updated");
  });

  router.delete("/logo", async (req, res) =>
    forward(res, await call(req, "/company-profile/logo", { method: "DELETE" }), "Logo removed")
  );

  /** The image bytes, for the page's <img>. */
  router.get("/logo", async (req, res) => {
    const result = await call(req, "/company-profile/logo", { headers: { accept: "image/*" } });
    if (!result.ok) return res.status(result.status).json(result.body);

    const type = result.response.headers.get("content-type") || "application/octet-stream";
    if (!/^image\/(png|jpeg)$/.test(type.split(";")[0])) {
      return fail(res, 502, "The branch sent something that is not a PNG or JPG");
    }
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.send(Buffer.from(await result.response.arrayBuffer()));
  });

  return router;
};

export default { createBranchCompanyRouter };
