/**
 * JWT Key Generation Script (ESM)
 *
 * Generates an RS256 public/private key pair used to sign and verify JWTs.
 * Writes the PEM files to the paths configured in .env:
 *   - jwtAuthPath        (directory that holds the keys)
 *   - jwtAuthPrivatePath (private key — used to SIGN tokens)
 *   - jwtAuthPublicPath  (public key — used to VERIFY tokens)
 *
 * Non-destructive by default: refuses to overwrite existing keys.
 * Re-generating keys invalidates every previously issued token (all users
 * must log in again).
 *
 * Usage:
 *   npm run keys           # generate keys (fails if they already exist)
 *   npm run keys -- --force  # overwrite existing keys
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const KEY_DIR = process.env.jwtAuthPath || "./auth-keys";
const PRIVATE_KEY_PATH =
  process.env.jwtAuthPrivatePath || path.join(KEY_DIR, "private.pem");
const PUBLIC_KEY_PATH =
  process.env.jwtAuthPublicPath || path.join(KEY_DIR, "public.pem");

const force = process.argv.includes("--force");

function main() {
  const privatePath = path.resolve(PRIVATE_KEY_PATH);
  const publicPath = path.resolve(PUBLIC_KEY_PATH);
  const keyDir = path.resolve(KEY_DIR);

  console.log("🔐 Generating RS256 JWT key pair...\n");

  // Guard against clobbering existing keys
  const existing = [privatePath, publicPath].filter((p) => fs.existsSync(p));
  if (existing.length > 0 && !force) {
    console.error("❌ Keys already exist:");
    for (const p of existing) console.error(`   ${p}`);
    console.error(
      "\n   Refusing to overwrite. Re-run with --force to regenerate."
    );
    console.error("   ⚠️  Regenerating invalidates all existing JWTs.\n");
    process.exit(1);
  }

  // Ensure the key directory exists
  if (!fs.existsSync(keyDir)) {
    fs.mkdirSync(keyDir, { recursive: true });
    console.log(`📁 Created directory: ${keyDir}`);
  }

  // Generate a 2048-bit RSA key pair in PEM format
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  // Write private key with restrictive permissions (owner read/write only)
  fs.writeFileSync(privatePath, privateKey, { mode: 0o600 });
  fs.writeFileSync(publicPath, publicKey, { mode: 0o644 });

  console.log("✅ Key pair generated:\n");
  console.log(`   🔑 Private (sign):   ${privatePath}`);
  console.log(`   🔓 Public  (verify): ${publicPath}\n`);
  console.log("🎉 Done. Keep the private key secret — never commit it.");
}

try {
  main();
} catch (error) {
  console.error("\n❌ Key generation failed:", error.message);
  process.exit(1);
}
