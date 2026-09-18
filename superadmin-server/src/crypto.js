import crypto from "node:crypto";

/**
 * Passwords, branch keys and session tokens — all with node:crypto, nothing to install.
 */

// ── Passwords: scrypt ──────────────────────────────────────────────────────

const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const HASH_BYTES = 64;

/** @returns {string} `scrypt$N$r$p$salt$hash`, base64url parts. */
export const hashPassword = (password) => {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, HASH_BYTES, SCRYPT);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), hash.toString("base64url")].join("$");
};

export const verifyPassword = (password, stored) => {
  const [scheme, N, r, p, salt, hash] = String(stored).split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = crypto.scryptSync(String(password), Buffer.from(salt, "base64url"), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  });
  return crypto.timingSafeEqual(actual, expected);
};

/**
 * Burn the same time as a real check, so a wrong username is not faster than a
 * wrong password.
 */
const DUMMY_HASH = hashPassword(crypto.randomBytes(12).toString("hex"));
export const verifyAgainstNothing = (password) => {
  verifyPassword(password, DUMMY_HASH);
  return false;
};

// ── Branch keys: AES-256-GCM ───────────────────────────────────────────────

const keyFrom = (secret) => crypto.createHash("sha256").update(String(secret)).digest();

/** @returns {string} `v1.iv.tag.ciphertext`, base64url parts. */
export const encryptSecret = (plain, secret) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const data = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
};

/** Throws when the value was encrypted with a different secret or was tampered with. */
export const decryptSecret = (sealed, secret) => {
  const [version, iv, tag, data] = String(sealed).split(".");
  if (version !== "v1") throw new Error("Unknown key format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyFrom(secret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
};

// ── Session tokens ─────────────────────────────────────────────────────────

export const newToken = () => crypto.randomBytes(32).toString("base64url");
export const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

export default {
  hashPassword,
  verifyPassword,
  verifyAgainstNothing,
  encryptSecret,
  decryptSecret,
  newToken,
  hashToken,
};
