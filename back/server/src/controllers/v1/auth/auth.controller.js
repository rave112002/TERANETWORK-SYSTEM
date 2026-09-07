import crypto from "node:crypto";
import express from "express";
import passport from "passport";

import { csrfProtection, csrfTokenHandler } from "../../../middlewares/csrf.middleware.js";
import { authLimiter, passwordResetLimiter } from "../../../middlewares/rateLimiter.js";
import { sendMail } from "../../../lib/mailer/mailer.js";
import { passwordResetEmail } from "../../../lib/mailer/templates.js";
import APIError, { ERROR_CODES } from "../../../utils/APIError.js";
import { catchAsync, validateBody } from "../../../utils/catchAsync.js";
import {
  addMinutesLocal,
  getCurrentTimestampLocal,
  toTimestampLocal,
} from "../../../utils/dateUtils.js";
import { comparePassword, hashPassword } from "../../../utils/hashing/argonHash.js";
import { generateTokenPair, verifyRefreshToken } from "../../../utils/jwt.js";
import {
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  changePasswordSchema,
} from "../../../validators/auth.validator.js";

const router = express.Router();
const requireAuth = passport.authenticate("jwt", { session: false });

// How long a password-reset link is valid (minutes)
const RESET_TOKEN_TTL_MIN = 30;

// The public origin used to build links in emails (falls back to the first
// FRONTEND_URL entry, then localhost).
const appUrl = () =>
  (process.env.APP_URL || process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")[0]
    .trim()
    .replace(/\/$/, "");

// The auth controller is mounted under both /admin/auth and /superadmin/auth.
// Derive which portal a request targets from its mount path so reset links and
// portal/type checks resolve correctly.
const portalOf = (req) => (req.baseUrl.includes("/superadmin/") ? "superadmin" : "admin");
const typesForPortal = (portal) =>
  portal === "superadmin" ? ["SUPERADMIN"] : ["ADMIN", "USER"];

/**
 * GET /csrf-token
 * Get CSRF token for authentication requests
 *
 * Returns a CSRF token that must be included in POST requests (login, refresh, logout)
 * via the X-CSRF-Token header.
 *
 * Security features:
 * - Rate limiting (auth limiter)
 * - Token is valid for 1 hour (configured in csrf middleware)
 */
router.get("/csrf-token", authLimiter, csrfTokenHandler);

/**
 * POST /login
 * Authenticate user and return access + refresh tokens
 *
 * Security features:
 * - Rate limiting (10 attempts per 15 minutes)
 * - CSRF protection
 * - Argon2id password hashing
 * - Constant-time comparison to prevent timing attacks
 */
router.post(
  "/login",
  authLimiter,
  csrfProtection,
  validateBody(loginSchema),
  catchAsync(async (req, res) => {
    const { email, password } = req.body;

    // 1. Find credentials by email
    const credentials = await req.db.query(
      `SELECT
        c.accountId,
        c.email,
        c.password,
        c.type,
        c.status as credentialStatus
      FROM credentials c
      WHERE c.email = ? AND c.status != 'Deleted'
      LIMIT 1`,
      [email]
    );

    // 2. Check if user exists (use constant-time behavior to prevent enumeration)
    if (credentials.length === 0) {
      // Perform a dummy hash comparison to prevent timing attacks
      await comparePassword(password, "$argon2id$v=19$m=19456,t=3,p=1$fakesalt$fakehash");

      throw new APIError("Invalid email or password", 401, ERROR_CODES.INVALID_CREDENTIALS);
    }

    const credential = credentials[0];

    // 3. Check if credential is active
    if (credential.credentialStatus !== "Active") {
      throw new APIError(
        "Account has been deactivated. Please contact service provider.",
        401,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    // 4. Verify password using Argon2 (salt is embedded in the encoded hash)
    const isPasswordValid = await comparePassword(password, credential.password);

    if (!isPasswordValid) {
      throw new APIError("Invalid email or password", 401, ERROR_CODES.INVALID_CREDENTIALS);
    }

    // 5. Get user/superadmin profile based on credential type
    let user = null;

    if (credential.type === "SUPERADMIN") {
      const saRows = await req.db.query(
        `SELECT accountId, firstName, lastName, status FROM superadmins WHERE accountId = ? AND status = 'Active' LIMIT 1`,
        [credential.accountId]
      );
      if (saRows.length === 0) {
        throw new APIError("Account not found", 401, ERROR_CODES.INVALID_CREDENTIALS);
      }
      user = { ...saRows[0], email: credential.email, type: credential.type };
    } else {
      const userRows = await req.db.query(
        `SELECT u.accountId, u.firstName, u.lastName, u.companyId, u.branchId, u.roleId, u.status,
                r.roleName
         FROM users u
         LEFT JOIN roles r ON r.roleId = u.roleId
         WHERE u.accountId = ? AND u.status = 'Active'
         LIMIT 1`,
        [credential.accountId]
      );
      if (userRows.length === 0) {
        throw new APIError(
          "Account not found or deactivated",
          401,
          ERROR_CODES.INVALID_CREDENTIALS
        );
      }
      user = { ...userRows[0], email: credential.email, type: credential.type };
    }

    // 6. Generate token pair
    const { accessToken, refreshToken } = generateTokenPair({
      userId: credential.accountId,
      accountId: credential.accountId,
      email: credential.email,
      type: credential.type,
    });

    // 7. Persist the refresh token so it can be rotated/revoked later.
    //    Stored in Manila local (toTimestampLocal converts the JWT's UTC exp).
    const now = getCurrentTimestampLocal();
    await req.db.query(
      `INSERT INTO refresh_tokens (jti, accountId, expiresAt, dateCreated, dateUpdated)
       VALUES (?, ?, ?, ?, ?)`,
      [
        refreshToken.jti,
        credential.accountId,
        toTimestampLocal(refreshToken.expiresAt),
        now,
        now,
      ]
    );

    // 8. Log successful login
    req.logger?.info("User logged in successfully", {
      accountId: credential.accountId,
      email: credential.email,
    });

    // 9. Return tokens
    return res.sendSuccess(
      "Login successful",
      {
        user,
        token: accessToken.token,
        accessToken: {
          token: accessToken.token,
          expiresAt: accessToken.expiresAt,
          expiresIn: accessToken.expiresIn,
        },
        refreshToken: {
          token: refreshToken.token,
          expiresAt: refreshToken.expiresAt,
          expiresIn: refreshToken.expiresIn,
        },
      },
      200
    );
  })
);

/**
 * POST /refresh
 * Refresh access token using refresh token
 *
 * Security features:
 * - Rate limiting
 * - CSRF protection
 * - Refresh token rotation: the presented token must exist server-side and is
 *   revoked in the same transaction that records its replacement
 * - Reuse detection: presenting an already-revoked token revokes ALL of the
 *   account's refresh tokens (assume the token was stolen)
 */
router.post(
  "/refresh",
  authLimiter,
  csrfProtection,
  validateBody(refreshTokenSchema),
  catchAsync(async (req, res) => {
    const { refreshToken } = req.body;

    // 1. Verify refresh token signature/expiry
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (_error) {
      throw new APIError("Invalid or expired refresh token", 401, ERROR_CODES.TOKEN_INVALID);
    }

    const now = getCurrentTimestampLocal();
    let conn;
    let tokens;
    try {
      conn = await req.db.beginTransaction();

      // 2. The token must exist server-side — lock the row for rotation
      const [rows] = await conn.execute(
        `SELECT jti, accountId, expiresAt, revokedAt
         FROM refresh_tokens
         WHERE jti = ?
         LIMIT 1 FOR UPDATE`,
        [decoded.jti]
      );

      if (rows.length === 0) {
        await req.db.rollback(conn);
        throw new APIError("Invalid or expired refresh token", 401, ERROR_CODES.TOKEN_INVALID);
      }

      const stored = rows[0];

      // 3. Reuse detection: a revoked token being presented again means the
      //    token was leaked — kill every active session for this account.
      if (stored.revokedAt) {
        await conn.execute(
          `UPDATE refresh_tokens
           SET revokedAt = ?, dateUpdated = ?
           WHERE accountId = ? AND revokedAt IS NULL`,
          [now, now, stored.accountId]
        );
        await req.db.commit(conn);
        req.logger?.warn("Refresh token reuse detected — all sessions revoked", {
          accountId: stored.accountId,
          jti: decoded.jti,
        });
        throw new APIError("Invalid or expired refresh token", 401, ERROR_CODES.TOKEN_INVALID);
      }

      // 4. Server-side expiry check. Both are Manila "YYYY-MM-DD HH:mm:ss"
      //    strings (dateStrings pool), so a lexicographic compare is chronological.
      if (stored.expiresAt <= now) {
        await req.db.rollback(conn);
        throw new APIError("Invalid or expired refresh token", 401, ERROR_CODES.TOKEN_INVALID);
      }

      // 5. Verify account still exists and is active
      const [credentials] = await conn.execute(
        `SELECT c.accountId, c.email, c.type, c.status
         FROM credentials c
         WHERE c.accountId = ? AND c.status = 'Active'
         LIMIT 1`,
        [decoded.accountId]
      );

      if (credentials.length === 0) {
        await req.db.rollback(conn);
        throw new APIError("Account not found or deactivated", 401, ERROR_CODES.TOKEN_INVALID);
      }

      const credential = credentials[0];

      // 6. Generate the new pair, revoke the old token, record the new one
      tokens = generateTokenPair({
        userId: credential.accountId,
        accountId: credential.accountId,
        email: credential.email,
        type: credential.type,
      });

      await conn.execute(
        `UPDATE refresh_tokens
         SET revokedAt = ?, replacedByJti = ?, dateUpdated = ?
         WHERE jti = ?`,
        [now, tokens.refreshToken.jti, now, decoded.jti]
      );

      await conn.execute(
        `INSERT INTO refresh_tokens (jti, accountId, expiresAt, dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?)`,
        [
          tokens.refreshToken.jti,
          credential.accountId,
          toTimestampLocal(tokens.refreshToken.expiresAt),
          now,
          now,
        ]
      );

      await req.db.commit(conn);
    } catch (err) {
      // Every APIError above is thrown after an explicit rollback/commit, so
      // only unexpected errors leave the transaction open.
      if (conn && !(err instanceof APIError)) {
        await req.db.rollback(conn);
      }
      throw err;
    }

    const { accessToken, refreshToken: newRefreshToken } = tokens;

    // 7. Return new tokens
    return res.sendSuccess(
      "Token refreshed successfully",
      {
        token: accessToken.token,
        accessToken: {
          token: accessToken.token,
          expiresAt: accessToken.expiresAt,
          expiresIn: accessToken.expiresIn,
        },
        refreshToken: {
          token: newRefreshToken.token,
          expiresAt: newRefreshToken.expiresAt,
          expiresIn: newRefreshToken.expiresIn,
        },
      },
      200
    );
  })
);

/**
 * POST /logout
 * Invalidate refresh token
 *
 * Security features:
 * - CSRF protection
 * - Server-side refresh-token revocation (the presented token's jti is
 *   marked revoked, so it can never be used to mint new access tokens)
 *
 * Revocation is best-effort: logout always succeeds even if the token is
 * already expired/invalid — the client discards its copy either way.
 */
router.post(
  "/logout",
  csrfProtection,
  validateBody(logoutSchema),
  catchAsync(async (req, res) => {
    const { refreshToken } = req.body;

    if (refreshToken) {
      try {
        const decoded = verifyRefreshToken(refreshToken);
        const now = getCurrentTimestampLocal();
        await req.db.query(
          `UPDATE refresh_tokens
           SET revokedAt = ?, dateUpdated = ?
           WHERE jti = ? AND revokedAt IS NULL`,
          [now, now, decoded.jti]
        );
        req.logger?.info("User logged out — refresh token revoked", {
          accountId: decoded.accountId,
        });
      } catch {
        // Expired/invalid token — nothing to revoke
        req.logger?.info("User logged out (token already invalid)");
      }
    } else {
      req.logger?.info("User logged out (no refresh token provided)");
    }

    return res.sendSuccess("Logout successful", null, 200);
  })
);

/**
 * POST /forgot-password
 * Start a password reset. Always returns 200 (no account enumeration).
 */
router.post(
  "/forgot-password",
  passwordResetLimiter,
  csrfProtection,
  validateBody(forgotPasswordSchema),
  catchAsync(async (req, res) => {
    const { email } = req.body;
    const portal = portalOf(req);
    const genericOk = () =>
      res.sendSuccess(
        "If an account exists for that email, a password reset link has been sent.",
        null,
        200
      );

    // Only match credentials whose type belongs to the requesting portal
    const placeholders = typesForPortal(portal).map(() => "?").join(", ");
    const credentials = await req.db.query(
      `SELECT accountId, email, type FROM credentials
       WHERE email = ? AND status = 'Active' AND type IN (${placeholders})
       LIMIT 1`,
      [email, ...typesForPortal(portal)]
    );

    if (credentials.length === 0) {
      return genericOk(); // don't reveal whether the email exists
    }

    const { accountId, type } = credentials[0];

    // Look up the display name from the matching profile table
    let firstName = null;
    if (type === "SUPERADMIN") {
      const rows = await req.db.query(
        `SELECT firstName FROM superadmins WHERE accountId = ? LIMIT 1`,
        [accountId]
      );
      firstName = rows[0]?.firstName ?? null;
    } else {
      const rows = await req.db.query(
        `SELECT firstName FROM users WHERE accountId = ? LIMIT 1`,
        [accountId]
      );
      firstName = rows[0]?.firstName ?? null;
    }

    // Single-use token: store only its SHA-256 hash; email the plaintext
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const now = getCurrentTimestampLocal();

    // Invalidate any earlier unused tokens for this account, then insert
    await req.db.query(
      `UPDATE password_reset_tokens SET usedAt = ? WHERE accountId = ? AND usedAt IS NULL`,
      [now, accountId]
    );
    await req.db.query(
      `INSERT INTO password_reset_tokens (tokenHash, accountId, expiresAt, dateCreated)
       VALUES (?, ?, ?, ?)`,
      [tokenHash, accountId, addMinutesLocal(RESET_TOKEN_TTL_MIN), now]
    );

    const resetUrl = `${appUrl()}/${portal}/reset-password?token=${token}`;
    const mail = passwordResetEmail({
      name: firstName,
      resetUrl,
      expiresMinutes: RESET_TOKEN_TTL_MIN,
    });
    // Best-effort: a mail failure must not turn this into an enumeration signal
    await sendMail({ to: email, subject: mail.subject, html: mail.html });

    req.logger?.info("Password reset requested", { accountId, portal });
    return genericOk();
  })
);

/**
 * POST /reset-password
 * Complete a password reset with a valid, unused, unexpired token.
 */
router.post(
  "/reset-password",
  passwordResetLimiter,
  csrfProtection,
  validateBody(resetPasswordSchema),
  catchAsync(async (req, res) => {
    const { token, password } = req.body;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const [rows] = await conn.execute(
        `SELECT id, accountId, expiresAt, usedAt
         FROM password_reset_tokens
         WHERE tokenHash = ?
         LIMIT 1 FOR UPDATE`,
        [tokenHash]
      );

      if (
        rows.length === 0 ||
        rows[0].usedAt ||
        rows[0].expiresAt <= now // Manila strings compare chronologically
      ) {
        await req.db.rollback(conn);
        throw new APIError(
          "This password reset link is invalid or has expired.",
          400,
          ERROR_CODES.TOKEN_INVALID
        );
      }

      const { id, accountId } = rows[0];
      const hash = await hashPassword(password);

      await conn.execute(
        `UPDATE credentials SET password = ?, dateUpdated = ? WHERE accountId = ?`,
        [hash, now, accountId]
      );
      await conn.execute(
        `UPDATE password_reset_tokens SET usedAt = ? WHERE id = ?`,
        [now, id]
      );
      // Invalidate every existing session for this account
      await conn.execute(
        `UPDATE refresh_tokens SET revokedAt = ?, dateUpdated = ?
         WHERE accountId = ? AND revokedAt IS NULL`,
        [now, now, accountId]
      );

      await req.db.commit(conn);
    } catch (err) {
      if (conn && !(err instanceof APIError)) {
        await req.db.rollback(conn);
      }
      throw err;
    }

    return res.sendSuccess("Your password has been reset. You can now log in.", null, 200);
  })
);

/**
 * GET /me — the authenticated user's profile
 */
router.get(
  "/me",
  requireAuth,
  catchAsync(async (req, res) => {
    return res.sendSuccess("User profile", { user: req.user });
  })
);

/**
 * PUT /me — update the authenticated user's own profile
 */
router.put(
  "/me",
  requireAuth,
  csrfProtection,
  validateBody(updateProfileSchema),
  catchAsync(async (req, res) => {
    const { accountId, type } = req.user;
    const { firstName, lastName, phone, imageUrl } = req.body;
    const now = getCurrentTimestampLocal();
    const table = type === "SUPERADMIN" ? "superadmins" : "users";

    await req.db.query(
      `UPDATE ${table}
       SET firstName = ?, lastName = ?, phone = ?, imageUrl = ?, dateUpdated = ?
       WHERE accountId = ? AND status != 'Deleted'`,
      [firstName, lastName, phone || null, imageUrl || null, now, accountId]
    );

    return res.sendSuccess("Profile updated successfully", {
      user: { ...req.user, firstName, lastName, phone: phone || null, imageUrl: imageUrl || null },
    });
  })
);

/**
 * PUT /me/password — change the authenticated user's own password
 */
router.put(
  "/me/password",
  requireAuth,
  csrfProtection,
  validateBody(changePasswordSchema),
  catchAsync(async (req, res) => {
    const { accountId } = req.user;
    const { currentPassword, newPassword } = req.body;
    const now = getCurrentTimestampLocal();

    const creds = await req.db.query(
      `SELECT password FROM credentials WHERE accountId = ? AND status = 'Active' LIMIT 1`,
      [accountId]
    );
    if (creds.length === 0) {
      throw new APIError("Account not found", 404, ERROR_CODES.USER_NOT_FOUND);
    }

    const valid = await comparePassword(currentPassword, creds[0].password);
    if (!valid) {
      throw new APIError("Current password is incorrect", 401, ERROR_CODES.INVALID_CREDENTIALS);
    }

    const hash = await hashPassword(newPassword);
    await req.db.query(
      `UPDATE credentials SET password = ?, dateUpdated = ? WHERE accountId = ?`,
      [hash, now, accountId]
    );
    // Revoke other sessions after a password change
    await req.db.query(
      `UPDATE refresh_tokens SET revokedAt = ?, dateUpdated = ?
       WHERE accountId = ? AND revokedAt IS NULL`,
      [now, now, accountId]
    );

    return res.sendSuccess("Password changed successfully", null, 200);
  })
);

export default router;
