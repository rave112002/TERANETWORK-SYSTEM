/**
 * Database Migration Runner (ESM)
 *
 * Applies database/schema.sql (the baseline — the whole schema), then every
 * pending SQL file in database/migrations/ in filename order. Applied files are
 * tracked in a `_migrations` table so each runs exactly once; the baseline is
 * recorded under the name `schema.sql`. Safe to re-run.
 *
 * database/migrations/ holds incremental changes for databases that recorded the
 * baseline before those changes existed. schema.sql is kept current with every
 * migration, so a FRESH database gets the baseline and has the migrations
 * recorded as included rather than run on top of it.
 *
 * Usage: node scripts/migrate.js   (or: npm run db:migrate)
 *
 * Also exports runMigrations() so the setup scripts can apply migrations
 * before seeding, sharing a single connection.
 *
 * Note: MySQL DDL auto-commits per statement, so a file that fails partway
 * cannot be rolled back — keep each migration focused and idempotent-safe.
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mysql from "mysql2/promise";
import moment from "moment-timezone";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_FILE = path.resolve(__dirname, "../database/schema.sql");
const MIGRATIONS_DIR = path.resolve(__dirname, "../database/migrations");

/**
 * Apply the baseline + all pending migrations on an existing connection
 * (database already selected).
 * @param {import("mysql2/promise").Connection} connection
 * @param {{ baselineFile?: string, migrationsDir?: string }} [options]
 * @returns {Promise<string[]>} names of files applied this run
 */
export async function runMigrations(
  connection,
  { baselineFile = BASELINE_FILE, migrationsDir = MIGRATIONS_DIR } = {}
) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS _migrations (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL UNIQUE,
      appliedAt DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  const [appliedRows] = await connection.query(`SELECT name FROM _migrations`);
  const applied = new Set(appliedRows.map((r) => r.name));

  const now = () =>
    moment().tz(process.env.TIMEZONE || "Asia/Manila").format("YYYY-MM-DD HH:mm:ss");

  const apply = async (name, sql) => {
    console.log(`   ⏳ ${name} ...`);
    await connection.query(sql);
    await connection.query(`INSERT INTO _migrations (name, appliedAt) VALUES (?, ?)`, [
      name,
      now(),
    ]);
    console.log(`   ✅ ${name}`);
  };

  const ranNow = [];

  // 1. Baseline — the full schema. Every statement is CREATE TABLE IF NOT
  //    EXISTS, so applying it to an already-provisioned database is a no-op.
  const baselineName = path.basename(baselineFile);
  let baselineAppliedNow = false;
  if (applied.has(baselineName)) {
    console.log(`   ⏭️  ${baselineName} (already applied)`);
  } else {
    await apply(baselineName, fs.readFileSync(baselineFile, "utf-8"));
    ranNow.push(baselineName);
    baselineAppliedNow = true;
  }

  // 2. Incremental migrations on top. The directory is empty in a fresh
  //    template and may not exist at all if it was never committed.
  const files = fs.existsSync(migrationsDir)
    ? fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()
    : [];

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`   ⏭️  ${file} (already applied)`);
      continue;
    }
    // A database that received the baseline just now already has everything
    // the migrations add: schema.sql is kept current with every one of them
    // (the "two edits" rule in schema-conventions). Running them on top fails —
    // 008 drops columns the baseline never had. So on a fresh provision they
    // are recorded as included, not executed. Their data seeds (permissions,
    // Owner grants, settings) either need rows that do not exist yet or are
    // done by setup-database.js.
    if (baselineAppliedNow) {
      await connection.query(`INSERT INTO _migrations (name, appliedAt) VALUES (?, ?)`, [file, now()]);
      console.log(`   ⏭️  ${file} (included in ${baselineName})`);
      continue;
    }
    await apply(file, fs.readFileSync(path.join(migrationsDir, file), "utf-8"));
    ranNow.push(file);
  }

  return ranNow;
}

async function main() {
  const DB_NAME = process.env.DB_DATABASE;
  let connection;
  try {
    console.log("🔌 Connecting to MySQL...");
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || "3306"),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      multipleStatements: true,
    });

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.query(`USE \`${DB_NAME}\``);

    console.log("\n📦 Applying migrations...\n");
    const ran = await runMigrations(connection);

    console.log(
      ran.length ? `\n🎉 Applied ${ran.length} migration(s).` : "\n✅ Database already up to date."
    );
  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

// Run only when invoked directly (not when imported by the setup scripts)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
