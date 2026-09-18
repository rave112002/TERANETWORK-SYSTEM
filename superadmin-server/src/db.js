import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * SuperAdmin's own small database: SQLite, through Node's built-in `node:sqlite`
 * (no native package to compile on Windows).
 *
 * It holds only what SuperAdmin itself needs — its logins, their sessions, and
 * the list of branches with their encrypted keys. No branch business data ever
 * lands here (docs/decisions.md D10). Back it up by copying `data/superadmin.db`.
 *
 * Unlike the branch database, rows are few and there is one writer, so IDs are
 * `crypto.randomUUID()` and timestamps are ISO-8601 UTC strings.
 */

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    accountId   TEXT PRIMARY KEY,
    username    TEXT NOT NULL UNIQUE COLLATE NOCASE,
    firstName   TEXT NOT NULL,
    lastName    TEXT NOT NULL,
    passwordHash TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive','Deleted')),
    lastLoginAt TEXT,
    dateCreated TEXT NOT NULL,
    dateUpdated TEXT NOT NULL
  );

  -- The session token itself is never stored, only its SHA-256.
  CREATE TABLE IF NOT EXISTS sessions (
    tokenHash   TEXT PRIMARY KEY,
    accountId   TEXT NOT NULL REFERENCES users(accountId),
    expiresAt   TEXT NOT NULL,
    dateCreated TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS branches (
    branchId    TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    baseUrl     TEXT NOT NULL,
    -- AES-256-GCM with a key derived from SUPERADMIN_SECRET; see crypto.js.
    apiKeyEnc   TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Deleted')),
    dateCreated TEXT NOT NULL,
    dateUpdated TEXT NOT NULL
  );
`;

/**
 * @param {string} file a path, or ":memory:" for tests.
 * @returns {DatabaseSync}
 */
export const openDatabase = (file) => {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  return db;
};

export const nowIso = () => new Date().toISOString();

export default { openDatabase, nowIso };
