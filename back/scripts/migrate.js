/**
 * Database Migration Runner (ESM)
 *
 * Applies every pending SQL file in database/migrations/ in filename order,
 * tracking applied files in a `_migrations` table so each runs exactly once.
 * Safe to re-run: already-applied migrations are skipped.
 *
 * Usage: node scripts/migrate.js   (or: npm run db:migrate)
 *
 * Also exports runMigrations() so the setup scripts can apply migrations
 * before seeding, sharing a single connection.
 *
 * Note: MySQL DDL auto-commits per statement, so a migration file that fails
 * partway cannot be rolled back — keep each file focused and idempotent-safe.
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mysql from "mysql2/promise";
import moment from "moment-timezone";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../database/migrations");

/**
 * Apply all pending migrations on an existing connection (database already selected).
 * @param {import("mysql2/promise").Connection} connection
 * @param {{ migrationsDir?: string }} [options]
 * @returns {Promise<string[]>} names of migrations applied this run
 */
export async function runMigrations(connection, { migrationsDir = MIGRATIONS_DIR } = {}) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS _migrations (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL UNIQUE,
      appliedAt DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  const [appliedRows] = await connection.query(`SELECT name FROM _migrations`);
  const applied = new Set(appliedRows.map((r) => r.name));

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const ranNow = [];
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`   ⏭️  ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    console.log(`   ⏳ ${file} ...`);
    await connection.query(sql);
    await connection.query(`INSERT INTO _migrations (name, appliedAt) VALUES (?, ?)`, [
      file,
      moment().tz(process.env.TIMEZONE || "Asia/Manila").format("YYYY-MM-DD HH:mm:ss"),
    ]);
    console.log(`   ✅ ${file}`);
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
