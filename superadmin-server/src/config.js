import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Settings, from `.env` (see .env.example). Read once at start-up so a missing
 * secret stops the server immediately instead of failing on the first branch.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const MIN_SECRET_LENGTH = 32;

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export const loadConfig = (env = process.env) => {
  const secret = env.SUPERADMIN_SECRET ?? "";
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `SUPERADMIN_SECRET must be at least ${MIN_SECRET_LENGTH} characters. It encrypts the branch keys; see .env.example.`
    );
  }

  return {
    // Loopback by default: this is one person's tool on one PC. Set HOST to the
    // Tailscale address only if SuperAdmin must be opened from another device.
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT) || 8788,
    secret,
    dataDir: path.resolve(ROOT, env.DATA_DIR || "data"),
    webDist: path.resolve(ROOT, env.WEB_DIST || "../front/dist-superadmin"),
    // Only over HTTPS. Plain http on localhost or the tailnet must leave it off,
    // or the browser drops the session cookie.
    cookieSecure: env.COOKIE_SECURE === "true",
    sessionHours: Number(env.SESSION_HOURS) || 12,
    branchTimeoutMs: Number(env.BRANCH_TIMEOUT_MS) || 5000,
  };
};

export default { loadConfig, MIN_SECRET_LENGTH };
