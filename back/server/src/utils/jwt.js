import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import crypto from "node:crypto";
import APIError, { ERROR_CODES } from "./APIError.js";

/**
 * JWT Utility for Token Generation and Verification
 *
 * Uses RS256 algorithm with public/private key pairs for enhanced security.
 * Supports both access tokens (short-lived) and refresh tokens (long-lived).
 */

// Load keys
const privateKeyPath = process.env.jwtAuthPrivatePath;
const publicKeyPath = process.env.jwtAuthPublicPath;

let privateKey = null;
let publicKey = null;

// Lazy load keys to avoid startup errors if paths not configured
const getPrivateKey = () => {
  if (!privateKey) {
    if (!privateKeyPath) {
      throw new APIError(
        "JWT private key path not configured",
        500,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
    privateKey = fs.readFileSync(path.resolve(privateKeyPath), "utf-8");
  }
  return privateKey;
};

const getPublicKey = () => {
  if (!publicKey) {
    if (!publicKeyPath) {
      throw new APIError(
        "JWT public key path not configured",
        500,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
    publicKey = fs.readFileSync(path.resolve(publicKeyPath), "utf-8");
  }
  return publicKey;
};

// Issuer/audience — exported so the passport verify config uses the exact
// same values as token signing (a mismatch makes every token fail verification)
export const JWT_ISSUER = process.env.ISSUER || "template-api";
export const JWT_AUDIENCE = process.env.AUDIENCE || "template-client";

// Token configuration
const TOKEN_CONFIG = {
  access: {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "8h", // 8 hours
    algorithm: "RS256",
  },
  refresh: {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d", // 30 days
    algorithm: "RS256",
  },
};

/**
 * Generate a unique JWT ID (jti) for token tracking
 * @returns {string} Unique token identifier
 */
const generateJti = () => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Generate an access token
 *
 * @param {Object} payload - Token payload
 * @param {number} payload.accountId - User's account ID
 * @param {string} payload.email - User's email
 * @param {string} [payload.username] - User's username
 * @returns {Object} { token, expiresAt }
 */
export const generateAccessToken = (payload) => {
  const { accountId, email, username } = payload;

  const jti = generateJti();
  const now = Math.floor(Date.now() / 1000);

  const tokenPayload = {
    userId: accountId,
    accountId,
    email,
    username,
    type: "access",
    jti,
    iat: now,
  };

  const token = jwt.sign(tokenPayload, getPrivateKey(), {
    algorithm: TOKEN_CONFIG.access.algorithm,
    expiresIn: TOKEN_CONFIG.access.expiresIn,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });

  // Calculate expiration time
  const decoded = jwt.decode(token);
  const expiresAt = new Date(decoded.exp * 1000);

  return {
    token,
    expiresAt,
    expiresIn: TOKEN_CONFIG.access.expiresIn,
  };
};

/**
 * Generate a refresh token
 *
 * @param {Object} payload - Token payload
 * @param {number} payload.accountId - User's account ID
 * @returns {Object} { token, expiresAt, jti }
 */
export const generateRefreshToken = (payload) => {
  const { accountId } = payload;

  const jti = generateJti();
  const now = Math.floor(Date.now() / 1000);

  const tokenPayload = {
    userId: accountId,
    accountId,
    type: "refresh",
    jti,
    iat: now,
  };

  const token = jwt.sign(tokenPayload, getPrivateKey(), {
    algorithm: TOKEN_CONFIG.refresh.algorithm,
    expiresIn: TOKEN_CONFIG.refresh.expiresIn,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });

  // Calculate expiration time
  const decoded = jwt.decode(token);
  const expiresAt = new Date(decoded.exp * 1000);

  return {
    token,
    expiresAt,
    expiresIn: TOKEN_CONFIG.refresh.expiresIn,
    jti,
  };
};

/**
 * Generate both access and refresh tokens
 *
 * @param {Object} user - User object from database
 * @returns {Object} { accessToken, refreshToken }
 */
export const generateTokenPair = (user) => {
  const accessToken = generateAccessToken({
    accountId: user.accountId,
    email: user.email,
    username: user.username,
  });

  const refreshToken = generateRefreshToken({
    accountId: user.accountId,
  });

  return {
    accessToken,
    refreshToken,
  };
};

/**
 * Verify an access token
 *
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {APIError} If token is invalid or expired
 */
export const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, getPublicKey(), {
      algorithms: [TOKEN_CONFIG.access.algorithm],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (decoded.type !== "access") {
      throw new APIError(
        "Invalid token type",
        401,
        ERROR_CODES.TOKEN_INVALID
      );
    }

    return decoded;
  } catch (error) {
    if (error instanceof APIError) throw error;

    if (error.name === "TokenExpiredError") {
      throw new APIError(
        "Access token has expired",
        401,
        ERROR_CODES.TOKEN_EXPIRED
      );
    }

    throw new APIError(
      "Invalid access token",
      401,
      ERROR_CODES.TOKEN_INVALID
    );
  }
};

/**
 * Verify a refresh token
 *
 * @param {string} token - JWT refresh token to verify
 * @returns {Object} Decoded token payload
 * @throws {APIError} If token is invalid or expired
 */
export const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, getPublicKey(), {
      algorithms: [TOKEN_CONFIG.refresh.algorithm],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (decoded.type !== "refresh") {
      throw new APIError(
        "Invalid token type",
        401,
        ERROR_CODES.TOKEN_INVALID
      );
    }

    return decoded;
  } catch (error) {
    if (error instanceof APIError) throw error;

    if (error.name === "TokenExpiredError") {
      throw new APIError(
        "Refresh token has expired",
        401,
        ERROR_CODES.TOKEN_EXPIRED
      );
    }

    throw new APIError(
      "Invalid refresh token",
      401,
      ERROR_CODES.TOKEN_INVALID
    );
  }
};

/**
 * Decode a token without verification (for inspection only)
 *
 * @param {string} token - JWT token to decode
 * @returns {Object|null} Decoded token or null if invalid
 */
export const decodeToken = (token) => {
  return jwt.decode(token);
};

export default {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
};
