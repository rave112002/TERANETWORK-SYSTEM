import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/crypto.js";
import { openDatabase } from "../src/db.js";

const KEY = "b".repeat(40);

describe("branch system settings through SuperAdmin", () => {
  let server;
  let branch;
  let base;
  let cookie = "";
  let branchId;
  const seen = [];
  let settings = { DRY_RUN: true, GRACE_DAYS: 0, STATEMENT_DAY: 25, DUE_DAY: 2 };

  const call = async (method, path, json) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        "x-requested-with": "superadmin",
        ...(json !== undefined ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: json !== undefined ? JSON.stringify(json) : undefined,
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    return { status: res.status, body: await res.json() };
  };

  before(async () => {
    branch = await new Promise((resolve) => {
      const s = http.createServer(async (req, res) => {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
        seen.push({ method: req.method, headers: req.headers, body });
        const send = (status, payload) => {
          res.writeHead(status, { "content-type": "application/json" });
          res.end(JSON.stringify(payload));
        };
        if (req.method === "GET") return send(200, { success: true, data: { settings, meta: {} } });
        if (body.DUE_DAY === 27) {
          return send(400, {
            success: false,
            code: "SCHEDULE_INVALID",
            message: "Invoices must go out after the previous month's cut-off day.",
          });
        }
        settings = { ...settings, ...body };
        return send(200, { success: true, message: "System settings saved", data: { settings, changed: Object.keys(body) } });
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
      config: { secret: "s".repeat(40), webDist: "/nonexistent", cookieSecure: false, sessionHours: 12, branchTimeoutMs: 1500 },
    });
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    base = `http://127.0.0.1:${server.address().port}`;
    await call("POST", "/api/auth/login", { username: "raven", password: "a very good password" });
    const added = await call("POST", "/api/branches", {
      name: "NLB",
      baseUrl: `http://127.0.0.1:${branch.address().port}`,
      apiKey: KEY,
    });
    branchId = added.body.data.branchId;
  });

  after(() => {
    server.close();
    branch.close();
  });

  it("reads the settings", async () => {
    const res = await call("GET", `/api/branches/${branchId}/system-settings`);
    assert.equal(res.body.data.settings.DRY_RUN, true);
  });

  it("saves a change and names the actor", async () => {
    const res = await call("PUT", `/api/branches/${branchId}/system-settings`, { DRY_RUN: false });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.settings.DRY_RUN, false);
    assert.equal(seen.at(-1).headers["x-manage-actor"], "raven");
  });

  it("passes the branch's schedule refusal through", async () => {
    const res = await call("PUT", `/api/branches/${branchId}/system-settings`, { DUE_DAY: 27 });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "SCHEDULE_INVALID");
    assert.match(res.body.message, /cut-off/);
  });
});
