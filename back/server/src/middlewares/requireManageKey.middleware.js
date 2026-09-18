import crypto from "node:crypto";

import { logger } from "../../config/logger.js";
import {
  MANAGE_KEY_HEADER,
  MIN_MANAGE_KEY_LENGTH,
} from "../../../../shared/manage-contract/index.js";

/**
 * Gate for the management API that the central SuperAdmin calls
 * (docs/decisions.md D10).
 *
 * ── Why a key and not a login ───────────────────────────────────────────────
 *
 * The caller is a server (superadmin-server on the developer's PC), not a
 * person with a session. Each branch has its own key in `MANAGE_API_KEY`, so
 * a leaked key opens one branch, not all of them. Tailscale already limits who
 * can reach this port; the key is the application-level check behind it.
 *
 * ── Off unless configured ───────────────────────────────────────────────────
 *
 * No key (or one too short to be real) means the whole management API answers
 * 503. A fresh install is therefore closed by default, and a typo in `.env`
 * cannot leave it open.
 */

/** Hash both sides first so the comparison takes the same time for any length. */
const sameKey = (given, expected) =>
  crypto.timingSafeEqual(
    crypto.createHash("sha256").update(String(given)).digest(),
    crypto.createHash("sha256").update(String(expected)).digest()
  );

/**
 * @param {() => string|undefined} [readKey] where the key comes from; tests pass their own.
 */
export const requireManageKey =
  (readKey = () => process.env.MANAGE_API_KEY) =>
  (req, res, next) => {
    const expected = readKey();

    if (!expected || expected.length < MIN_MANAGE_KEY_LENGTH) {
      return res.status(503).json({
        success: false,
        message: "The management API is not enabled on this installation",
        code: "MANAGE_DISABLED",
      });
    }

    const given = req.get(MANAGE_KEY_HEADER);
    if (!given || !sameKey(given, expected)) {
      (req.logger || logger).warn("Management API: rejected key", {
        ip: req.ip,
        path: req.originalUrl,
      });
      return res.status(401).json({
        success: false,
        message: "Invalid management key",
        code: "MANAGE_KEY_INVALID",
      });
    }

    return next();
  };

export default requireManageKey;
