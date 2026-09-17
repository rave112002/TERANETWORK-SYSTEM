/**
 * Database Setup (Clean) Script (ESM)
 *
 * DROPS all existing tables, re-applies every migration from scratch, then
 * seeds a complete SINGLE-BRANCH installation — the same seed as
 * setup-database.js (see scripts/lib/branch-install.js).
 * ⚠️  WARNING: This will destroy all existing data!
 *
 * Needs: COMPANY_EMAIL, BRANCH_NAME  (COMPANY_NAME optional)
 *
 * Usage: node scripts/setup-database-clean.js
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
    console.log("⚠️  WARNING: This will DROP all tables and recreate them!");
    console.log("   All existing data will be lost.\n");

    console.log("🔌 Connecting to MySQL...");
    connection = await mysql.createConnection(DB_CONFIG);

    console.log(`📦 Creating database "${DB_NAME}" if not exists...`);
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.query(`USE \`${DB_NAME}\``);

    // Drop every table (including _migrations) for a true clean slate
    const [existingTables] = await connection.query("SHOW TABLES");
    if (existingTables.length > 0) {
      console.log("🗑️  Dropping existing tables...\n");
      await connection.query("SET FOREIGN_KEY_CHECKS = 0");
      const tableKey = `Tables_in_${DB_NAME}`;
      for (const row of existingTables) {
        const tableName = row[tableKey];
        await connection.query(`DROP TABLE IF EXISTS \`${tableName}\``);
        console.log(`   🗑️  Dropped ${tableName}`);
      }
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    }

    console.log("\n📋 Applying migrations...\n");
    await runMigrations(connection);

    console.log("\n🔐 Seeding permissions...");
    await seedPermissions(connection);

    console.log("\n👤 Creating default superadmin...");
    await seedSuperadmin(connection);

    console.log("\n🏢 Setting up this installation's branch...");
    const install = await seedBranchInstallation(connection);

    console.log(`\n🎉 Clean database setup complete — installation for branch "${install.branchName}".`);
    console.log("   Optional development data: npm run db:seed:dev");
  } catch (error) {
    console.error("\n❌ Database setup failed:", error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
