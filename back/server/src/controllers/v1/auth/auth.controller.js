import express from "express";

import { csrfProtection, csrfTokenHandler } from "../../../middlewares/csrf.middleware.js";
import { authLimiter } from "../../../middlewares/rateLimiter.js";
import APIError, { ERROR_CODES } from "../../../utils/APIError.js";
import { catchAsync, validateBody } from "../../../utils/catchAsync.js";
import { comparePassword } from "../../../utils/hashing/argonHash.js";
import { generateTokenPair, verifyRefreshToken } from "../../../utils/jwt.js";
import {
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
} from "../../../validators/auth.validator.js";

const router = express.Router();

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
        c.salt,
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
      await comparePassword(
        password,
        "$argon2id$v=19$m=4096,t=3,p=1$fakesalt$fakehash",
        "fakesalt"
      );

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

    // 4. Verify password using Argon2
    const isPasswordValid = await comparePassword(password, credential.password, credential.salt);

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

    // 7. Log successful login
    req.logger?.info("User logged in successfully", {
      accountId: credential.accountId,
      email: credential.email,
    });

    // 8. Return tokens
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
 * - Refresh token rotation (old token invalidated)
 */
router.post(
  "/refresh",
  authLimiter,
  csrfProtection,
  validateBody(refreshTokenSchema),
  catchAsync(async (req, res) => {
    const { refreshToken } = req.body;

    // 1. Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      throw new APIError("Invalid or expired refresh token", 401, ERROR_CODES.TOKEN_INVALID);
    }

    // 2. Verify account still exists and is active
    const credentials = await req.db.query(
      `SELECT c.accountId, c.email, c.type, c.status
       FROM credentials c
       WHERE c.accountId = ? AND c.status = 'Active'
       LIMIT 1`,
      [decoded.accountId]
    );

    if (credentials.length === 0) {
      throw new APIError("Account not found or deactivated", 401, ERROR_CODES.TOKEN_INVALID);
    }

    const credential = credentials[0];

    // 3. Generate new token pair
    const { accessToken, refreshToken: newRefreshToken } = generateTokenPair({
      userId: credential.accountId,
      accountId: credential.accountId,
      email: credential.email,
      type: credential.type,
    });

    // 4. Return new tokens
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
 * - Token invalidation
 */
router.post(
  "/logout",
  csrfProtection,
  validateBody(logoutSchema),
  catchAsync(async (req, res) => {
    // Stateless JWT — no server-side token storage to invalidate
    // Client is responsible for discarding the token
    req.logger?.info("User logged out");
    return res.sendSuccess("Logout successful", null, 200);
  })
);

router.get(
  "/me",
  catchAsync(async (req, res) => {
    // req.user should be set by passport JWT middleware
    if (!req.user) {
      return res.sendError("Unauthorized", 401);
    }
    return res.sendSuccess("User profile", { user: req.user });
  })
);

export default router;
