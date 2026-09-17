/**
 * Database Setup Script (ESM)
 *
 * Applies all pending migrations (database/migrations/), then seeds a complete
 * SINGLE-BRANCH installation: permissions, the SuperAdmin login, the company,
 * this installation's one branch, and its Owner / Admin / Billing / Technician
 * roles. Additive and re-runnable — existing tables and data are left
 * untouched; each seed step is skipped when already present.
 *
 * Production is one server + one database per branch (decision D7), so this
 * never creates a second branch. See scripts/lib/branch-install.js.
 *
 * Needs, on a fresh database:  COMPANY_EMAIL, BRANCH_NAME  (COMPANY_NAME optional)
 *
 * Usage: node scripts/setup-database.js
 */

import "dotenv/config";
import mysql from "mysql2/promise";
import { runMigrations } from "./migrate.js";
import { seedBranchInstallation, seedPermissions, seedSuperadmin } from "./lib/branch-install.js";

const DB_CONFIG = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  multipleStatements: true,
};

const DB_NAME = process.env.DB_DATABASE;

async function main() {
  let connection;

  try {
    console.log("🔌 Connecting to MySQL...");
    connection = await mysql.createConnection(DB_CONFIG);

    console.log(`📦 Creating database "${DB_NAME}" if not exists...`);
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.query(`USE \`${DB_NAME}\``);

    console.log("\n📋 Applying migrations...\n");
    await runMigrations(connection);

    console.log("\n🔐 Seeding permissions...");
    await seedPermissions(connection);

    console.log("\n👤 Creating superadmin account...");
    await seedSuperadmin(connection);

    console.log("\n🏢 Setting up this installation's branch...");
    const install = await seedBranchInstallation(connection);

    console.log(`\n🎉 Database setup complete — installation for branch "${install.branchName}".`);
    console.log("   The branch Owner login is created from the SuperAdmin portal (Users).");
  } catch (error) {
    console.error("\n❌ Database setup failed:", error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
