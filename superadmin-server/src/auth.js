import express from "express";

import { hashToken, newToken, verifyAgainstNothing, verifyPassword } from "./crypto.js";
import { nowIso } from "./db.js";
import { fail, ok } from "./respond.js";

/**
 * SuperAdmin login.
 *
 * ── Session cookie, not a token in localStorage ─────────────────────────────
 *
 * The browser app and this server share an origin, so an httpOnly cookie is
 * the simplest thing that script cannot read. The cookie holds a random token;
 * the database holds only its hash.
 *
 * ── Cross-site requests ─────────────────────────────────────────────────────
 *
 * The cookie is SameSite=Strict, and every request that changes something must
 * also carry `X-Requested-With: superadmin`. A form or link on another site can
 * send neither, and CORS is not enabled, so a foreign page cannot add the header.
 */

export const SESSION_COOKIE = "sa_session";
export const CLIENT_HEADER = "x-requested-with";
export const CLIENT_HEADER_VALUE = "superadmin";

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

const readCookie = (req, name) => {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
};

const publicUser = (u) => ({
  accountId: u.accountId,
  username: u.username,
  firstName: u.firstName,
  lastName: u.lastName,
});

/** Refuse state-changing requests that did not come from the SuperAdmin app. */
export const requireClientHeader = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.get(CLIENT_HEADER) !== CLIENT_HEADER_VALUE) {
    return fail(res, 403, "Request refused", "CLIENT_HEADER_MISSING");
  }
  return next();
};

/**
 * @param {{db: import('node:sqlite').DatabaseSync, config: ReturnType<import('./config.js').loadConfig>}} deps
 */
export const createAuth = ({ db, config }) => {
  const failures = new Map();

  const cookieOptions = {
    httpOnly: true,
    sameSite: "strict",
    secure: config.cookieSecure,
    path: "/",
  };

  /** Attaches `req.user`, or answers 401. */
  const requireSession = (req, res, next) => {
    const token = readCookie(req, SESSION_COOKIE);
    if (!token) return fail(res, 401, "Please log in", "NOT_LOGGED_IN");

    const row = db
      .prepare(
        `SELECT u.* , s.expiresAt FROM sessions s
           JOIN users u ON u.accountId = s.accountId
          WHERE s.tokenHash = ?`
      )
      .get(hashToken(token));

    if (!row || row.expiresAt <= nowIso() || row.status !== "Active") {
      return fail(res, 401, "Your session has ended. Please log in again.", "NOT_LOGGED_IN");
    }
    req.user = publicUser(row);
    req.sessionTokenHash = hashToken(token);
    return next();
  };

  const router = express.Router();

  router.post("/login", (req, res) => {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");
    if (!username || !password) return fail(res, 400, "Enter your username and password");

    const lockKey = `${req.ip}|${username.toLowerCase()}`;
    const record = failures.get(lockKey);
    if (record?.lockedUntil && record.lockedUntil > Date.now()) {
      return fail(res, 429, "Too many failed attempts. Try again in 15 minutes.", "LOCKED");
    }

    const user = db
      .prepare(`SELECT * FROM users WHERE username = ? AND status = 'Active'`)
      .get(username);
    const valid = user ? verifyPassword(password, user.passwordHash) : verifyAgainstNothing(password);

    if (!valid) {
      const count = (record?.count ?? 0) + 1;
      failures.set(lockKey, {
        count,
        lockedUntil: count >= MAX_FAILURES ? Date.now() + LOCK_MS : null,
      });
      return fail(res, 401, "Wrong username or password", "INVALID_CREDENTIALS");
    }
    failures.delete(lockKey);

    const token = newToken();
    const now = nowIso();
    const expiresAt = new Date(Date.now() + config.sessionHours * 3600 * 1000).toISOString();
    db.prepare(`DELETE FROM sessions WHERE expiresAt <= ?`).run(now);
    db.prepare(
      `INSERT INTO sessions (tokenHash, accountId, expiresAt, dateCreated) VALUES (?, ?, ?, ?)`
    ).run(hashToken(token), user.accountId, expiresAt, now);
    db.prepare(`UPDATE users SET lastLoginAt = ?, dateUpdated = ? WHERE accountId = ?`).run(
      now,
      now,
      user.accountId
    );

    res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: config.sessionHours * 3600 * 1000 });
    return ok(res, "Logged in", { user: publicUser(user) });
  });

  router.post("/logout", (req, res) => {
    const token = readCookie(req, SESSION_COOKIE);
    if (token) db.prepare(`DELETE FROM sessions WHERE tokenHash = ?`).run(hashToken(token));
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    return ok(res, "Logged out");
  });

  router.get("/me", requireSession, (req, res) => ok(res, "Current user", { user: req.user }));

  return { router, requireSession };
};

export default { createAuth, requireClientHeader, SESSION_COOKIE };
