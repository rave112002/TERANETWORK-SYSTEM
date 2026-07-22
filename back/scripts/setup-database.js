/**
 * Database Setup Script (ESM)
 *
 * Applies all pending migrations (database/migrations/) then seeds default
 * permissions + a superadmin account. Additive and re-runnable — existing
 * tables and data are left untouched; seeds are skipped when already present.
 *
 * Usage: node scripts/setup-database.js
 */

import "dotenv/config";
import mysql from "mysql2/promise";
import argon2 from "argon2";
import moment from "moment-timezone";
import { runMigrations } from "./migrate.js";

const DB_CONFIG = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  multipleStatements: true,
};

const DB_NAME = process.env.DB_DATABASE;

// Storage is Asia/Manila local (matches getCurrentTimestampLocal + pool tz +08:00).
function now() {
  return moment().tz(process.env.TIMEZONE || "Asia/Manila").format("YYYY-MM-DD HH:mm:ss");
}

async function hashPassword(password) {
  // Argon2 embeds a random salt in the encoded hash — no separate salt needed.
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB (OWASP minimum for Argon2id)
    timeCost: 3,
    parallelism: 1,
  });
}

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

    // Seed permissions (skipped when already seeded — setup is re-runnable)
    console.log("\n🔐 Seeding permissions...");
    const timestamp = now();

    const [permCount] = await connection.query(`SELECT COUNT(*) as count FROM permissions`);
    if (permCount[0].count > 0) {
      console.log("   ⏭️  Permissions already seeded — skipping");
    } else {
      const permissions = [
        { module: "dashboard", submodule: null, description: "Dashboard access" },
        { module: "users", submodule: "list", description: "Users list management" },
        { module: "users", submodule: "roles", description: "Roles management" },
        { module: "settings", submodule: null, description: "Settings management" },
        { module: "audit_trail", submodule: null, description: "Audit Trail access" },
      ];

      for (const perm of permissions) {
        const [uuidRow] = await connection.query(`SELECT UUID() as id`);
        await connection.query(
          `INSERT INTO permissions (permissionId, module, submodule, description, portal, status, dateCreated, dateUpdated)
           VALUES (?, ?, ?, ?, 'ADMIN', 'Active', ?, ?)`,
          [uuidRow[0].id, perm.module, perm.submodule, perm.description, timestamp, timestamp]
        );
      }
      console.log(`   ✅ ${permissions.length} permissions seeded`);
    }

    // Seed superadmin (skipped when the account already exists)
    console.log("\n👤 Creating superadmin account...");

    const [existingSA] = await connection.query(
      `SELECT accountId FROM credentials WHERE email = 'superadmin@template.com' LIMIT 1`
    );
    if (existingSA.length > 0) {
      console.log("   ⏭️  SuperAdmin account already exists — skipping");
    } else {
      const [uuidRow2] = await connection.query(`SELECT UUID() as id`);
      const accountId = uuidRow2[0].id;

      await connection.query(
        `INSERT INTO superadmins (accountId, firstName, lastName, status, dateCreated, dateUpdated)
         VALUES (?, 'Super', 'Admin', 'Active', ?, ?)`,
        [accountId, timestamp, timestamp]
      );

      const hash = await hashPassword("superadmin123");
      await connection.query(
        `INSERT INTO credentials (accountId, email, password, type, status, dateCreated, dateUpdated)
         VALUES (?, 'superadmin@template.com', ?, 'SUPERADMIN', 'Active', ?, ?)`,
        [accountId, hash, timestamp, timestamp]
      );

      console.log("\n   📋 SuperAdmin Credentials:");
      console.log("   ┌──────────────────────────────────────────────────┐");
      console.log("   │ Email:    superadmin@template.com                │");
      console.log("   │ Password: superadmin123                          │");
      console.log("   └──────────────────────────────────────────────────┘");
    }

    console.log("\n🎉 Database setup complete!");
  } catch (error) {
    console.error("\n❌ Database setup failed:", error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
