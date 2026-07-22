import crypto from "node:crypto";

import { logger } from "../../config/logger.js";
import APIError, { ERROR_CODES } from "../utils/APIError.js";
import { getCurrentTimestampLocal, toTimestampLocal } from "../utils/dateUtils.js";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Idempotency middleware (Stripe-style, opt-in per request)
 *
 * When a mutation request carries an `Idempotency-Key` header, its successful
 * (2xx) JSON response is cached in the `idempotency_keys` table. Replaying the
 * same key within the TTL returns the cached response without re-executing the
 * handler; replaying the same key with a DIFFERENT body is rejected with 409.
 *
 * Requests without the header are processed normally — external API consumers
 * (curl, Postman) are not forced to supply one. The frontend axios layer sends
 * a key on every mutation and reuses it on its internal retries, so retried
 * writes cannot double-apply.
 *
 * Skipped entirely for multipart requests: the body is parsed later (multer),
 * so a meaningful request hash cannot be computed here.
 *
 * All timestamps in `idempotency_keys` are Asia/Manila local.
 *
 * @param {Object} options - Configuration options
 * @param {number} options.ttlHours - Time to live for idempotency keys in hours (default: 24)
 * @returns {Function} Express middleware
 */
export const idempotencyMiddleware = (options = {}) => {
  const { ttlHours = 24 } = options;

  return async (req, res, next) => {
    try {
      if (!MUTATION_METHODS.has(req.method)) {
        return next();
      }

      const idempotencyKey = req.headers["idempotency-key"];
      if (!idempotencyKey) {
        return next();
      }

      if (req.is("multipart/form-data")) {
        return next();
      }

      // Scope the stored key by the caller's Authorization header: this
      // middleware runs before passport, and an unscoped client-chosen key
      // could otherwise replay another user's cached response.
      const scopedKey = crypto
        .createHash("sha256")
        .update(`${req.headers.authorization || ""}:${idempotencyKey}`)
        .digest("hex");

      // Hash the body so the same key cannot be reused with a different payload
      const requestHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(req.body ?? {}))
        .digest("hex");

      const now = getCurrentTimestampLocal();

      const existing = await req.db.query(
        `SELECT idempotencyKey, requestHash, responseCode, responseBody, expiresAt
         FROM idempotency_keys
         WHERE idempotencyKey = ?
         LIMIT 1`,
        [scopedKey]
      );

      if (existing.length > 0) {
        const record = existing[0];

        if (record.expiresAt < now) {
          // Expired — delete and process as a fresh request (Manila strings)
          await req.db.query(`DELETE FROM idempotency_keys WHERE idempotencyKey = ?`, [
            scopedKey,
          ]);
        } else {
          if (record.requestHash !== requestHash) {
            throw new APIError(
              "Idempotency key already used with a different request body",
              409,
              ERROR_CODES.DUPLICATE_ENTRY
            );
          }

          req.logger?.info("Idempotent replay — returning cached response", {
            idempotencyKey,
          });

          const body =
            typeof record.responseBody === "string"
              ? JSON.parse(record.responseBody)
              : record.responseBody;
          return res.status(record.responseCode).json(body);
        }
      }

      // Intercept res.json to cache the successful response
      const originalJson = res.json.bind(res);
      res.json = function (data) {
        const responseCode = res.statusCode || 200;

        if (responseCode >= 200 && responseCode < 300) {
          const storedAt = getCurrentTimestampLocal();
          const expiresAt = toTimestampLocal(Date.now() + ttlHours * 60 * 60 * 1000);

          // Fire-and-forget: caching failures (e.g. a concurrent duplicate
          // key) must not fail the request that already succeeded
          req.db
            .query(
              `INSERT INTO idempotency_keys
               (idempotencyKey, requestHash, responseCode, responseBody, dateCreated, expiresAt)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [scopedKey, requestHash, responseCode, JSON.stringify(data), storedAt, expiresAt]
            )
            .catch((error) => {
              req.logger?.warn("Failed to store idempotency key", {
                error: error.message,
                idempotencyKey,
              });
            });
        }

        return originalJson(data);
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Cleanup expired idempotency keys (run periodically via cron/worker)
 *
 * @param {Object} db - Database instance
 * @returns {Promise<number>} Number of deleted records
 */
export const cleanupExpiredKeys = async (db) => {
  try {
    const result = await db.query(`DELETE FROM idempotency_keys WHERE expiresAt < ?`, [
      getCurrentTimestampLocal(),
    ]);

    const deletedCount = result.affectedRows || 0;
    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} expired idempotency keys`);
    }

    return deletedCount;
  } catch (error) {
    logger.error("Failed to cleanup expired idempotency keys", { error: error.message });
    throw error;
  }
};
