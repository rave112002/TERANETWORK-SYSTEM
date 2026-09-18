import crypto from "node:crypto";

import express from "express";

import { MIN_MANAGE_KEY_LENGTH } from "../../shared/manage-contract/index.js";
import { checkBranchHealth } from "./branchClient.js";
import { createBranchCompanyRouter } from "./branchCompany.js";
import { createBranchUsersRouter } from "./branchUsers.js";
import { decryptSecret, encryptSecret } from "./crypto.js";
import { nowIso } from "./db.js";
import { fail, ok } from "./respond.js";

/**
 * The branch list: which installations this SuperAdmin manages, and how to
 * reach each one.
 *
 * The key is write-only. It goes in encrypted and never comes back out in a
 * response; the page only learns whether it works, from the health check.
 */

const PUBLIC_COLUMNS = "branchId, name, baseUrl, dateCreated, dateUpdated";

/**
 * `http://100.64.0.12:8787/` → `http://100.64.0.12:8787`. Only http(s), no
 * username/password in the URL, no query or fragment.
 *
 * @returns {{value?: string, error?: string}}
 */
export const normalizeBaseUrl = (raw) => {
  let url;
  try {
    url = new URL(String(raw ?? "").trim());
  } catch {
    return { error: "Enter the branch address, e.g. http://100.64.0.12:8787" };
  }
  if (!["http:", "https:"].includes(url.protocol)) return { error: "The address must start with http:// or https://" };
  if (url.username || url.password) return { error: "Do not put a username or password in the address" };
  if (url.search || url.hash) return { error: "The address cannot have ? or # parts" };
  return { value: `${url.origin}${url.pathname.replace(/\/+$/, "")}` };
};

const validate = (body, { requireKey }) => {
  const errors = [];
  const name = String(body?.name ?? "").trim();
  if (!name) errors.push({ field: "name", message: "Enter the branch name" });
  if (name.length > 100) errors.push({ field: "name", message: "Keep the name under 100 characters" });

  const url = normalizeBaseUrl(body?.baseUrl);
  if (url.error) errors.push({ field: "baseUrl", message: url.error });

  const apiKey = String(body?.apiKey ?? "").trim();
  if ((requireKey || apiKey) && apiKey.length < MIN_MANAGE_KEY_LENGTH) {
    errors.push({
      field: "apiKey",
      message: `The key is at least ${MIN_MANAGE_KEY_LENGTH} characters — copy MANAGE_API_KEY from the branch's .env`,
    });
  }
  return { errors, name, baseUrl: url.value, apiKey };
};

const validationFailed = (res, errors) =>
  res.status(400).json({ success: false, message: errors[0].message, code: "VALIDATION_FAILED", errors });

/**
 * @param {{db: import('node:sqlite').DatabaseSync, config: object, fetchImpl?: typeof fetch}} deps
 */
export const createBranchesRouter = ({ db, config, fetchImpl }) => {
  const router = express.Router();

  const findActive = (branchId) =>
    db.prepare(`SELECT * FROM branches WHERE branchId = ? AND status = 'Active'`).get(branchId);

  const addressTaken = (baseUrl, exceptId = "") =>
    db
      .prepare(`SELECT branchId FROM branches WHERE baseUrl = ? AND status = 'Active' AND branchId != ?`)
      .get(baseUrl, exceptId);

  router.get("/", (req, res) => {
    const branches = db
      .prepare(`SELECT ${PUBLIC_COLUMNS} FROM branches WHERE status = 'Active' ORDER BY name COLLATE NOCASE`)
      .all();
    return ok(res, "Branches", { branches });
  });

  router.post("/", (req, res) => {
    const { errors, name, baseUrl, apiKey } = validate(req.body, { requireKey: true });
    if (errors.length) return validationFailed(res, errors);
    if (addressTaken(baseUrl)) return fail(res, 409, "A branch with this address is already listed", "DUPLICATE_ENTRY");

    const branchId = crypto.randomUUID();
    const now = nowIso();
    db.prepare(
      `INSERT INTO branches (branchId, name, baseUrl, apiKeyEnc, status, dateCreated, dateUpdated)
       VALUES (?, ?, ?, ?, 'Active', ?, ?)`
    ).run(branchId, name, baseUrl, encryptSecret(apiKey, config.secret), now, now);

    return ok(res, "Branch added", { branchId }, 201);
  });

  router.put("/:branchId", (req, res) => {
    const branch = findActive(req.params.branchId);
    if (!branch) return fail(res, 404, "Branch not found");

    const { errors, name, baseUrl, apiKey } = validate(req.body, { requireKey: false });
    if (errors.length) return validationFailed(res, errors);
    if (addressTaken(baseUrl, branch.branchId)) {
      return fail(res, 409, "A branch with this address is already listed", "DUPLICATE_ENTRY");
    }

    // A blank key keeps the stored one: the page never has it to send back.
    const apiKeyEnc = apiKey ? encryptSecret(apiKey, config.secret) : branch.apiKeyEnc;
    db.prepare(
      `UPDATE branches SET name = ?, baseUrl = ?, apiKeyEnc = ?, dateUpdated = ? WHERE branchId = ?`
    ).run(name, baseUrl, apiKeyEnc, nowIso(), branch.branchId);

    return ok(res, "Branch updated", { branchId: branch.branchId });
  });

  router.delete("/:branchId", (req, res) => {
    const result = db
      .prepare(`UPDATE branches SET status = 'Deleted', dateUpdated = ? WHERE branchId = ? AND status = 'Active'`)
      .run(nowIso(), req.params.branchId);
    if (!result.changes) return fail(res, 404, "Branch not found");
    // Only removes it from this list. The branch itself is untouched.
    return ok(res, "Branch removed from SuperAdmin");
  });

  router.get("/:branchId/health", async (req, res) => {
    const branch = findActive(req.params.branchId);
    if (!branch) return fail(res, 404, "Branch not found");

    let apiKey;
    try {
      apiKey = decryptSecret(branch.apiKeyEnc, config.secret);
    } catch {
      return ok(res, "Branch health", {
        branchId: branch.branchId,
        status: "error",
        message: "The stored key cannot be read. Was SUPERADMIN_SECRET changed? Enter the key again.",
        checkedAt: nowIso(),
      });
    }

    const health = await checkBranchHealth(
      { baseUrl: branch.baseUrl, apiKey },
      { timeoutMs: config.branchTimeoutMs, fetchImpl }
    );
    return ok(res, "Branch health", { branchId: branch.branchId, ...health });
  });

  /**
   * Everything under /:branchId/<area> acts on that branch through its
   * management API. This loads the branch and decrypts its key once.
   */
  const loadBranch = (req, res, next) => {
    const branch = findActive(req.params.branchId);
    if (!branch) return fail(res, 404, "Branch not found");
    try {
      req.branch = { ...branch, apiKey: decryptSecret(branch.apiKeyEnc, config.secret) };
    } catch {
      return fail(
        res,
        409,
        "The stored key for this branch cannot be read. Was SUPERADMIN_SECRET changed? Enter the key again in Branches.",
        "BRANCH_KEY_UNREADABLE"
      );
    }
    return next();
  };

  router.use("/:branchId/company-profile", loadBranch, createBranchCompanyRouter({ fetchImpl }));
  router.use("/:branchId/users", loadBranch, createBranchUsersRouter({ fetchImpl }));

  return router;
};

export default { createBranchesRouter, normalizeBaseUrl };
