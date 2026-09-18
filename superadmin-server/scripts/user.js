/**
 * Create a SuperAdmin login, or reset its password.
 *
 *   npm run user -- --username raven --first Raven --last Bayatan
 *   npm run user -- --username raven            (existing: resets the password)
 *
 * The password is asked for and not shown as you type. Run on the SuperAdmin PC.
 */
import crypto from "node:crypto";
import path from "node:path";
import readline from "node:readline";
import { parseArgs } from "node:util";

import { loadConfig } from "../src/config.js";
import { nowIso, openDatabase } from "../src/db.js";
import { hashPassword } from "../src/crypto.js";

const { values } = parseArgs({
  options: {
    username: { type: "string" },
    first: { type: "string" },
    last: { type: "string" },
  },
});

const askHidden = (question) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.startsWith(question)) process.stdout.write(question);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });

const username = values.username?.trim();
if (!username) {
  console.error("Usage: npm run user -- --username <name> [--first <first name>] [--last <last name>]");
  process.exit(1);
}

const config = loadConfig();
const db = openDatabase(path.join(config.dataDir, "superadmin.db"));
const existing = db.prepare(`SELECT accountId FROM users WHERE username = ?`).get(username);

const password = await askHidden("Password (at least 12 characters): ");
if (password.length < 12) {
  console.error("Too short. Nothing was changed.");
  process.exit(1);
}
if ((await askHidden("Type it again: ")) !== password) {
  console.error("The passwords do not match. Nothing was changed.");
  process.exit(1);
}

const now = nowIso();
if (existing) {
  db.prepare(`UPDATE users SET passwordHash = ?, status = 'Active', dateUpdated = ? WHERE accountId = ?`).run(
    hashPassword(password),
    now,
    existing.accountId
  );
  // A reset password ends every open session for that login.
  db.prepare(`DELETE FROM sessions WHERE accountId = ?`).run(existing.accountId);
  console.log(`Password reset for "${username}".`);
} else {
  db.prepare(
    `INSERT INTO users (accountId, username, firstName, lastName, passwordHash, status, dateCreated, dateUpdated)
     VALUES (?, ?, ?, ?, ?, 'Active', ?, ?)`
  ).run(crypto.randomUUID(), username, values.first || username, values.last || "", hashPassword(password), now, now);
  console.log(`SuperAdmin login "${username}" created.`);
}
