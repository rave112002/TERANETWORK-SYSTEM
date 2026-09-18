import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";

import { MANAGE_API_VERSION } from "../../shared/manage-contract/index.js";
import { createApp } from "../src/app.js";
import { decryptSecret, encryptSecret, hashPassword, verifyPassword } from "../src/crypto.js";
import { openDatabase } from "../src/db.js";
import { normalizeBaseUrl } from "../src/branches.js";

const SECRET = "s".repeat(40);
const BRANCH_KEY = "b".repeat(40);

const healthBody = (overrides = {}) => ({
  success: true,
  message: "Branch health",
  data: {
    manageApiVersion: MANAGE_API_VERSION,
    appVersion: "1.0.0",
    serverTime: "2026-09-17 10:00:00",
    uptimeSeconds: 60,
    installation: { companyName: "TERANETWORK", branchName: "New Lower Bicutan", branchCount: 1 },
    database: { ok: true, latencyMs: 2 },
    migrations: { applied: 15, pending: 0, latest: "015_gcash_statements.sql" },
    jobs: { queued: 0, failed: 0, dead: 0 },
    dryRun: false,
    backup: { lastBackupAt: null },
    ...overrides,
  },
});

/** A stand-in branch server: answers /api/v1/manage/health like back/ does. */
const startFakeBranch = (reply) =>
  new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const { status, body } = reply(req);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });

const urlOf = (server) => `http://127.0.0.1:${server.address().port}`;

describe("crypto", () => {
  it("verifies the right password only", () => {
    const stored = hashPassword("correct horse battery");
    assert.equal(verifyPassword("correct horse battery", stored), true);
    assert.equal(verifyPassword("wrong", stored), false);
  });

  it("round-trips a branch key, and refuses it under another secret", () => {
    const sealed = encryptSecret(BRANCH_KEY, SECRET);
    assert.notEqual(sealed, BRANCH_KEY);
    assert.equal(decryptSecret(sealed, SECRET), BRANCH_KEY);
    assert.throws(() => decryptSecret(sealed, "t".repeat(40)));
  });
});

describe("normalizeBaseUrl", () => {
  it("keeps origin and path, drops a trailing slash", () => {
    assert.equal(normalizeBaseUrl("http://100.64.0.12:8787/").value, "http://100.64.0.12:8787");
  });
  it("refuses non-http and credentials", () => {
    assert.ok(normalizeBaseUrl("ftp://x").error);
    assert.ok(normalizeBaseUrl("http://u:p@x").error);
    assert.ok(normalizeBaseUrl("not a url").error);
  });
});

describe("SuperAdmin server", () => {
  let server;
  let base;
  let branch;
  let branchMode = "ok";
  let cookie = "";
  const db = openDatabase(":memory:");

  const call = async (method, path, body, { withHeader = true } = {}) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(withHeader ? { "x-requested-with": "superadmin" } : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    return { status: res.status, body: await res.json() };
  };

  before(async () => {
    branch = await startFakeBranch((req) => {
      if (branchMode === "disabled") {
        return { status: 503, body: { success: false, code: "MANAGE_DISABLED" } };
      }
      if (req.headers["x-manage-key"] !== BRANCH_KEY) {
        return { status: 401, body: { success: false, code: "MANAGE_KEY_INVALID" } };
      }
      if (branchMode === "future") return { status: 200, body: healthBody({ manageApiVersion: 99 }) };
      if (branchMode === "dbdown") {
        return { status: 200, body: healthBody({ database: { ok: false, latencyMs: null } }) };
      }
      return { status: 200, body: healthBody({ migrations: { applied: 14, pending: 1, latest: "014" } }) };
    });

    db.prepare(
      `INSERT INTO users (accountId, username, firstName, lastName, passwordHash, dateCreated, dateUpdated)
       VALUES ('u1', 'raven', 'Raven', 'B', ?, 'now', 'now')`
    ).run(hashPassword("a very good password"));

    const app = createApp({
      db,
      config: { secret: SECRET, webDist: "/nonexistent", cookieSecure: false, sessionHours: 12, branchTimeoutMs: 1500 },
    });
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    server.close();
    branch.close();
  });

  it("keeps the branch list behind a login", async () => {
    const res = await call("GET", "/api/branches");
    assert.equal(res.status, 401);
  });

  it("refuses a wrong password, then logs in", async () => {
    assert.equal((await call("POST", "/api/auth/login", { username: "raven", password: "nope" })).status, 401);
    const res = await call("POST", "/api/auth/login", { username: "RAVEN", password: "a very good password" });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.username, "raven");
    assert.match(cookie, /^sa_session=/);
  });

  it("refuses a change without the SuperAdmin client header", async () => {
    const res = await call(
      "POST",
      "/api/branches",
      { name: "X", baseUrl: urlOf(branch), apiKey: BRANCH_KEY },
      { withHeader: false }
    );
    assert.equal(res.status, 403);
  });

  let branchId;
  it("adds a branch and never returns its key", async () => {
    const short = await call("POST", "/api/branches", { name: "NLB", baseUrl: urlOf(branch), apiKey: "short" });
    assert.equal(short.status, 400);

    const res = await call("POST", "/api/branches", { name: "New Lower Bicutan", baseUrl: `${urlOf(branch)}/`, apiKey: BRANCH_KEY });
    assert.equal(res.status, 201);
    branchId = res.body.data.branchId;

    const list = await call("GET", "/api/branches");
    assert.equal(list.body.data.branches.length, 1);
    assert.equal(list.body.data.branches[0].baseUrl, urlOf(branch));
    assert.equal(JSON.stringify(list.body).includes(BRANCH_KEY), false);

    const dup = await call("POST", "/api/branches", { name: "Again", baseUrl: urlOf(branch), apiKey: BRANCH_KEY });
    assert.equal(dup.status, 409);
  });

  it("reports an online branch with its warnings", async () => {
    branchMode = "ok";
    const { body } = await call("GET", `/api/branches/${branchId}/health`);
    assert.equal(body.data.status, "online");
    assert.equal(body.data.health.installation.branchName, "New Lower Bicutan");
    assert.ok(body.data.warnings.some((w) => /migration/.test(w)));
  });

  it("tells apart a down database, a newer branch, a missing key and a wrong key", async () => {
    branchMode = "dbdown";
    assert.equal((await call("GET", `/api/branches/${branchId}/health`)).body.data.status, "degraded");

    branchMode = "future";
    assert.equal((await call("GET", `/api/branches/${branchId}/health`)).body.data.status, "incompatible");

    branchMode = "disabled";
    assert.equal((await call("GET", `/api/branches/${branchId}/health`)).body.data.status, "not_enabled");

    branchMode = "ok";
    await call("PUT", `/api/branches/${branchId}`, { name: "New Lower Bicutan", baseUrl: urlOf(branch), apiKey: "w".repeat(40) });
    assert.equal((await call("GET", `/api/branches/${branchId}/health`)).body.data.status, "unauthorized");

    // A blank key on edit keeps the stored one.
    await call("PUT", `/api/branches/${branchId}`, { name: "NLB", baseUrl: urlOf(branch), apiKey: BRANCH_KEY });
    await call("PUT", `/api/branches/${branchId}`, { name: "NLB renamed", baseUrl: urlOf(branch), apiKey: "" });
    assert.equal((await call("GET", `/api/branches/${branchId}/health`)).body.data.status, "online");
  });

  it("reports an unreachable branch as offline", async () => {
    const res = await call("POST", "/api/branches", { name: "Bagumbayan", baseUrl: "http://127.0.0.1:9", apiKey: BRANCH_KEY });
    const { body } = await call("GET", `/api/branches/${res.body.data.branchId}/health`);
    assert.equal(body.data.status, "offline");
  });

  it("logs out", async () => {
    await call("POST", "/api/auth/logout");
    assert.equal((await call("GET", "/api/branches")).status, 401);
  });
});
