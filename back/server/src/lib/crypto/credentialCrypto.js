import crypto from "node:crypto";

/**
 * Envelope encryption for device credentials.
 *
 * ── What this protects ──────────────────────────────────────────────────────
 *
 * OLT and MikroTik logins let this system take a customer's internet away. They
 * are the highest-value secret in the database, and a plaintext column would
 * hand them to anyone with a stray backup file or a SQL-injection foothold.
 *
 * ── Why envelope encryption rather than one key ─────────────────────────────
 *
 * Each record gets its OWN random data key; that data key is then encrypted
 * ("wrapped") with the master key from `CREDENTIAL_MASTER_KEY`. Two consequences
 * that matter:
 *
 *   - Rotating the master key means re-wrapping N small data keys, not
 *     re-encrypting every credential blob.
 *   - The master key never directly encrypts two different plaintexts, which is
 *     what makes an IV-reuse mistake catastrophic with AES-GCM.
 *
 * ── Authenticated, not just encrypted ───────────────────────────────────────
 *
 * AES-256-GCM carries an auth tag, so tampering is *detected* rather than
 * silently decrypting to garbage that then gets sent to a device as a password.
 * `decryptCredentials` throws on any modified byte.
 *
 * ── Stored shape ────────────────────────────────────────────────────────────
 *
 * One opaque buffer per record, so callers never assemble the parts themselves:
 *
 *   [ 1 byte  version ]
 *   [ 12 bytes keyIv  ] [ 16 bytes keyTag ] [ 32 bytes wrappedDataKey ]
 *   [ 12 bytes dataIv ] [ 16 bytes dataTag ] [ ciphertext … ]
 *
 * The version byte exists so a future algorithm change can be rolled out
 * without guessing at the layout of rows written by the old one.
 */

const VERSION = 1;
const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // 96-bit nonce, the GCM standard
const TAG_BYTES = 16;

/** Byte offsets in the stored buffer. */
const OFF = {
  version: 0,
  keyIv: 1,
  keyTag: 1 + IV_BYTES,
  wrappedKey: 1 + IV_BYTES + TAG_BYTES,
  dataIv: 1 + IV_BYTES + TAG_BYTES + KEY_BYTES,
  dataTag: 1 + IV_BYTES + TAG_BYTES + KEY_BYTES + IV_BYTES,
  ciphertext: 1 + IV_BYTES + TAG_BYTES + KEY_BYTES + IV_BYTES + TAG_BYTES,
};

/**
 * Read and validate the master key.
 *
 * Read per call rather than at import time so a missing key fails the request
 * that needed it, with a clear message — not the whole server boot with a stack
 * trace from a module nobody was looking at.
 *
 * @returns {Buffer} 32 bytes
 */
const getMasterKey = () => {
  const raw = process.env.CREDENTIAL_MASTER_KEY;

  if (!raw) {
    throw new Error(
      "CREDENTIAL_MASTER_KEY is not set. Device credentials cannot be encrypted or read. " +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  // 64 hex characters is the documented form; raw 32-byte strings are accepted
  // so an existing deployment is not locked out by the format alone.
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "utf8");

  if (key.length !== KEY_BYTES) {
    throw new Error(
      `CREDENTIAL_MASTER_KEY must be 32 bytes (64 hex characters); got ${key.length} bytes.`
    );
  }

  return key;
};

/**
 * Encrypt a credentials object for storage.
 *
 * @param {Object} credentials - e.g. `{ username: "root", password: "…", enablePassword: "…" }`
 * @returns {Buffer} the opaque blob for a `VARBINARY` column.
 */
export const encryptCredentials = (credentials) => {
  if (credentials === null || credentials === undefined || typeof credentials !== "object") {
    throw new Error("encryptCredentials expects an object");
  }

  const masterKey = getMasterKey();
  const plaintext = Buffer.from(JSON.stringify(credentials), "utf8");

  // Fresh data key per record — the whole point of the envelope.
  const dataKey = crypto.randomBytes(KEY_BYTES);
  const dataIv = crypto.randomBytes(IV_BYTES);
  const dataCipher = crypto.createCipheriv(ALGORITHM, dataKey, dataIv);
  const ciphertext = Buffer.concat([dataCipher.update(plaintext), dataCipher.final()]);
  const dataTag = dataCipher.getAuthTag();

  const keyIv = crypto.randomBytes(IV_BYTES);
  const keyCipher = crypto.createCipheriv(ALGORITHM, masterKey, keyIv);
  const wrappedKey = Buffer.concat([keyCipher.update(dataKey), keyCipher.final()]);
  const keyTag = keyCipher.getAuthTag();

  // Don't leave the data key sitting in memory any longer than necessary.
  dataKey.fill(0);

  return Buffer.concat([
    Buffer.from([VERSION]),
    keyIv,
    keyTag,
    wrappedKey,
    dataIv,
    dataTag,
    ciphertext,
  ]);
};

/**
 * Decrypt a stored blob back into the credentials object.
 *
 * @param {Buffer} blob - from {@link encryptCredentials}.
 * @returns {Object}
 * @throws {Error} if the blob is malformed, truncated, tampered with, or was
 *   written under a different master key.
 */
export const decryptCredentials = (blob) => {
  if (!Buffer.isBuffer(blob) || blob.length <= OFF.ciphertext) {
    throw new Error("Stored credentials are malformed or truncated");
  }

  const version = blob[OFF.version];
  if (version !== VERSION) {
    throw new Error(`Unsupported credential format version ${version}`);
  }

  const masterKey = getMasterKey();

  const keyIv = blob.subarray(OFF.keyIv, OFF.keyTag);
  const keyTag = blob.subarray(OFF.keyTag, OFF.wrappedKey);
  const wrappedKey = blob.subarray(OFF.wrappedKey, OFF.dataIv);
  const dataIv = blob.subarray(OFF.dataIv, OFF.dataTag);
  const dataTag = blob.subarray(OFF.dataTag, OFF.ciphertext);
  const ciphertext = blob.subarray(OFF.ciphertext);

  let dataKey;
  try {
    const keyDecipher = crypto.createDecipheriv(ALGORITHM, masterKey, keyIv);
    keyDecipher.setAuthTag(keyTag);
    dataKey = Buffer.concat([keyDecipher.update(wrappedKey), keyDecipher.final()]);
  } catch {
    // Deliberately not echoing the underlying error: it differs between "wrong
    // key" and "tampered", which is a hint worth withholding.
    throw new Error(
      "Could not decrypt device credentials — the master key may have changed, or the row was tampered with"
    );
  }

  try {
    const dataDecipher = crypto.createDecipheriv(ALGORITHM, dataKey, dataIv);
    dataDecipher.setAuthTag(dataTag);
    const plaintext = Buffer.concat([dataDecipher.update(ciphertext), dataDecipher.final()]);
    return JSON.parse(plaintext.toString("utf8"));
  } catch {
    throw new Error("Stored device credentials failed integrity verification");
  } finally {
    dataKey.fill(0);
  }
};

/**
 * True when a master key is configured and usable.
 *
 * Lets a route give a clear "device credentials are not configured" message
 * instead of a 500 from deep inside a driver.
 */
export const isCredentialCryptoConfigured = () => {
  try {
    getMasterKey();
    return true;
  } catch {
    return false;
  }
};

export default { encryptCredentials, decryptCredentials, isCredentialCryptoConfigured };
