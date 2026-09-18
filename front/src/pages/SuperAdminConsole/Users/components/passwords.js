/**
 * Password rules for branch logins set from SuperAdmin. The minimum mirrors
 * MIN_BRANCH_PASSWORD_LENGTH in shared/manage-contract; the branch enforces it.
 */
export const MIN_PASSWORD_LENGTH = 10;

// No 0/O, 1/l/I: these passwords get read out over the phone.
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A random 14-character password from the browser's secure random source. */
export const generatePassword = (length = 14) => {
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (v) => ALPHABET[v % ALPHABET.length]).join("");
};
