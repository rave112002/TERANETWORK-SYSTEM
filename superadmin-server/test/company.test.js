import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/crypto.js";
import { openDatabase } from "../src/db.js";

const SECRET = "s".repeat(40);
const KEY = "b".repeat(40);
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

describe("company profile through SuperAdmin", () => {
  let server;
  let branch;
  let base;
  let cookie = "";
  let branchId;
  const seen = [];
  let company = {
    name: "TERANETWORK",
    email: "ops@teranetwork.ph",
    phone: null,
    website: null,
    address: "Taguig",
    tin: null,
    hasLogo: false,
    logoVersion: null,
  };

  const call = async (method, path, { json, body, headers = {} } = {}) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        "x-requested-with": "superadmin",
        ...(json !== undefined ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : body,
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const type = res.headers.get("content-type") || "";
    return {
      status: res.status,
      type,
      body: type.includes("json") ? await res.json() : Buffer.from(await res.arrayBuffer()),
    };
  };

  before(async () => {
    branch = await new Promise((resolve) => {
      const s = http.createServer(async (req, res) => {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const raw = Buffer.concat(chunks);
        seen.push({ method: req.method, url: req.url, headers: req.headers, raw });

        const send = (status, payload, type = "application/json") => {
          res.writeHead(status, { "content-type": type });
          res.end(type === "application/json" ? JSON.stringify(payload) : payload);
        };
        if (req.headers["x-manage-key"] !== KEY) return send(401, { code: "MANAGE_KEY_INVALID" });

        const url = req.url;
        if (url === "/api/v1/manage/company-profile" && req.method === "GET") {
          return send(200, { success: true, data: { company } });
        }
        if (url === "/api/v1/manage/company-profile" && req.method === "PUT") {
          const body = JSON.parse(raw.toString());
          if (!body.email) {
            return send(400, {
              success: false,
              message: "Validation failed",
              code: "VALIDATION_FAILED",
              errors: [{ field: "email", message: "Email is required" }],
            });
          }
          company = { ...company, ...body };
          return send(200, { success: true, data: { company } });
        }
        if (url === "/api/v1/manage/company-profile/logo" && req.method === "PUT") {
          company = { ...company, hasLogo: true, logoVersion: "abc123" };
          return send(200, { success: true, data: { company } });
        }
        if (url === "/api/v1/manage/company-profile/logo" && req.method === "GET") {
          return send(200, PNG, "image/png");
        }
        return send(404, { success: false, message: "API not found", code: "INTERNAL_ERROR" });
      });
      s.listen(0, "127.0.0.1", () => resolve(s));
    });

    const db = openDatabase(":memory:");
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

    await call("POST", "/api/auth/login", { json: { username: "raven", password: "a very good password" } });
    const added = await call("POST", "/api/branches", {
      json: { name: "NLB", baseUrl: `http://127.0.0.1:${branch.address().port}`, apiKey: KEY },
    });
    branchId = added.body.data.branchId;
  });

  after(() => {
    server.close();
    branch.close();
  });

  it("reads the branch's profile", async () => {
    const res = await call("GET", `/api/branches/${branchId}/company-profile`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.company.name, "TERANETWORK");
  });

  it("saves changes and tells the branch who made them", async () => {
    const res = await call("PUT", `/api/branches/${branchId}/company-profile`, {
      json: { name: "TERANETWORK INC.", email: "ops@teranetwork.ph", tin: "000-123-456-000" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.company.tin, "000-123-456-000");
    const last = seen.at(-1);
    assert.equal(last.headers["x-manage-actor"], "raven");
    assert.equal(last.headers["x-manage-key"], KEY);
  });

  it("passes the branch's validation errors through", async () => {
    const res = await call("PUT", `/api/branches/${branchId}/company-profile`, { json: { name: "X" } });
    assert.equal(res.status, 400);
    assert.equal(res.body.errors[0].field, "email");
  });

  it("streams a logo upload through untouched", async () => {
    const form = new FormData();
    form.append("logo", new Blob([PNG], { type: "image/png" }), "logo.png");
    const res = await call("PUT", `/api/branches/${branchId}/company-profile/logo`, { body: form });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.company.hasLogo, true);
    const upload = seen.at(-1);
    assert.match(upload.headers["content-type"], /^multipart\/form-data; boundary=/);
    assert.ok(upload.raw.includes(PNG));
  });

  it("serves the logo image", async () => {
    const res = await call("GET", `/api/branches/${branchId}/company-profile/logo`);
    assert.equal(res.status, 200);
    assert.equal(res.type, "image/png");
    assert.deepEqual(res.body, PNG);
  });

  it("refuses an upload that is not multipart", async () => {
    const res = await call("PUT", `/api/branches/${branchId}/company-profile/logo`, { json: { x: 1 } });
    assert.equal(res.status, 400);
  });

  it("explains a branch that lacks the endpoint, and one that is offline", async () => {
    const outdated = await call("DELETE", `/api/branches/${branchId}/company-profile/logo`);
    assert.equal(outdated.body.code, "BRANCH_NEEDS_UPDATE");

    const off = await call("POST", "/api/branches", {
      json: { name: "Off", baseUrl: "http://127.0.0.1:9", apiKey: KEY },
    });
    const res = await call("GET", `/api/branches/${off.body.data.branchId}/company-profile`);
    assert.equal(res.status, 502);
    assert.equal(res.body.code, "BRANCH_OFFLINE");
  });
});
