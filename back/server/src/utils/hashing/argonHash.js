import argon2 from "argon2";
import APIError from "../APIError.js";

// OWASP-recommended Argon2id parameters (memoryCost in KiB → 19 MiB).
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 3, // Iterations
  parallelism: 1, // Threads
};

// Returns the encoded Argon2id hash string. The salt is generated internally
// by argon2 and embedded in the hash — there is no separate salt to store.
export const hashPassword = async (password) => {
  try {
    return await argon2.hash(password, ARGON2_OPTIONS);
  } catch (_error) {
    throw new APIError(
      "An error occurred while generating new hash password",
      500
    );
  }
};

// Function to compare the provided password with the stored hash
// (argon2.verify reads the algorithm type and salt from the encoded hash
// string itself — passing them as options is ignored, so we don't)
export const comparePassword = async (password, storedHash) => {
  try {
    return await argon2.verify(storedHash, password);
  } catch (_err) {
    // If there's an error (e.g., verification failure), return false
    return false;
  }
};
