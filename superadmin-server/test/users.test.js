import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/crypto.js";
import { openDatabase } from "../src/db.js";

const SECRET = "s".repeat(40);
const KEY = "b".repeat(40);

describe("branch logins through SuperAdmin", () => {
  let server;
  let branch;
  let base;
  let cookie = "";
  let branchId;
  const seen = [];
  const db = openDatabase(":memory:");

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
        seen.push({ method: req.method, url: req.url, headers: req.headers, body });
        const send = (status, payload) => {
          res.writeHead(status, { "content-type": "application/json" });
          res.end(JSON.stringify(payload));
        };
        if (req.url === "/api/v1/manage/users" && req.method === "GET") {
          return send(200, { success: true, message: "Branch logins", data: { users: [{ accountId: "a1", roleName: "Owner" }] } });
        }
        if (req.url === "/api/v1/manage/users" && req.method === "POST") {
          if (body.role === "Owner") {
            return send(409, { success: false, message: "This branch already has an Owner." });
          }
          return send(201, { success: true, message: "Admin login created", data: { user: { accountId: "a2" } } });
        }
        if (req.url === "/api/v1/manage/users/a1/password") {
          return send(200, { success: true, message: "Password reset", data: { user: { accountId: "a1" } } });
        }
        if (req.url === "/api/v1/manage/users/a1/status") {
          return send(409, { success: false, message: "This is the branch's only active Owner." });
        }
        return send(404, { success: false, message: "API not found", code: "INTERNAL_ERROR" });
      });
      s.listen(0, "127.0.0.1", () => resolve(s));
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

  it("lists the branch's logins", async () => {
    const res = await call("GET", `/api/branches/${branchId}/users`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.users[0].roleName, "Owner");
  });

  it("creates a login, passing the password to the branch and naming the actor", async () => {
    const res = await call("POST", `/api/branches/${branchId}/users`, {
      firstName: "Ana",
      lastName: "Cruz",
      email: "ana@teranetwork.ph",
      role: "Admin",
      password: "correct horse battery",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.message, "Admin login created");
    const last = seen.at(-1);
    assert.equal(last.body.password, "correct horse battery");
    assert.equal(last.headers["x-manage-actor"], "raven");
  });

  it("keeps nothing about the login locally", () => {
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all().map((t) => t.name);
    assert.deepEqual(tables.sort(), ["branches", "sessions", "users"]);
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM users`).get().n, 1);
  });

  it("passes the branch's refusals through with their reason", async () => {
    const owner = await call("POST", `/api/branches/${branchId}/users`, { role: "Owner" });
    assert.equal(owner.status, 409);
    assert.match(owner.body.message, /already has an Owner/);

    const lastOwner = await call("PUT", `/api/branches/${branchId}/users/a1/status`, { status: "Inactive" });
    assert.equal(lastOwner.status, 409);
  });

  it("resets a password", async () => {
    const res = await call("PUT", `/api/branches/${branchId}/users/a1/password`, { password: "another good password" });
    assert.equal(res.status, 200);
    assert.deepEqual(seen.at(-1).body, { password: "another good password" });
  });
});
