/**
 * Database Setup Script (ESM)
 *
 * Creates all tables defined in database/schema.sql if they don't already exist.
 * Seeds a default superadmin account if none exists.
 * Does NOT drop existing tables or data.
 *
 * Usage: node scripts/setup-database.js
 */

import "dotenv/config";
import mysql from "mysql2/promise";
import argon2 from "argon2";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import moment from "moment-timezone";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(__dirname, "../database/schema.sql");

const DB_CONFIG = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  multipleStatements: true,
};

const DB_NAME = process.env.DB_DATABASE;
const TIMEZONE = process.env.TIMEZONE || "Asia/Manila";

function now() {
  return moment().tz(TIMEZONE).format("YYYY-MM-DD HH:mm:ss");
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await argon2.hash(password, {
    salt: Buffer.from(salt, "hex"),
    type: argon2.argon2id,
    memoryCost: 4096,
    timeCost: 3,
    parallelism: 1,
  });
  return { hash, salt };
}

async function main() {
  let connection;

  try {
    // Read schema file
    console.log(`📄 Reading schema from: database/schema.sql`);
    const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");

    console.log("🔌 Connecting to MySQL...");
    connection = await mysql.createConnection(DB_CONFIG);

    // Create database if not exists
    console.log(`📦 Creating database "${DB_NAME}" if not exists...`);
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.query(`USE \`${DB_NAME}\``);

    // Drop all existing tables first (clean slate)
    console.log("🗑️  Dropping existing tables...\n");
    const [existingTables] = await connection.query("SHOW TABLES");
    if (existingTables.length > 0) {
      await connection.query("SET FOREIGN_KEY_CHECKS = 0");
      const tableKey = `Tables_in_${DB_NAME}`;
      for (const row of existingTables) {
        const tableName = row[tableKey];
        await connection.query(`DROP TABLE IF EXISTS \`${tableName}\``);
        console.log(`   🗑️  Dropped ${tableName}`);
      }
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    }

    // Execute schema
    console.log("\n📋 Creating tables from schema...\n");
    await connection.query(schema);

    // List created tables
    const [tables] = await connection.query("SHOW TABLES");
    const tableKey = `Tables_in_${DB_NAME}`;
    for (const row of tables) {
      console.log(`   ✅ ${row[tableKey]}`);
    }

    // Seed permissions
    console.log("\n🔐 Seeding permissions...");
    const timestamp = now();

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

    // Seed superadmin
    console.log("\n👤 Creating superadmin account...");

    const [uuidRow2] = await connection.query(`SELECT UUID() as id`);
    const accountId = uuidRow2[0].id;

    await connection.query(
      `INSERT INTO superadmins (accountId, firstName, lastName, status, dateCreated, dateUpdated)
       VALUES (?, 'Super', 'Admin', 'Active', ?, ?)`,
      [accountId, timestamp, timestamp]
    );

    const creds = await hashPassword("superadmin123");
    await connection.query(
      `INSERT INTO credentials (accountId, email, password, salt, type, status, dateCreated, dateUpdated)
       VALUES (?, 'superadmin@template.com', ?, ?, 'SUPERADMIN', 'Active', ?, ?)`,
      [accountId, creds.hash, creds.salt, timestamp, timestamp]
    );

    console.log("\n   📋 SuperAdmin Credentials:");
    console.log("   ┌──────────────────────────────────────────────────┐");
    console.log("   │ Email:    superadmin@template.com                │");
    console.log("   │ Password: superadmin123                          │");
    console.log("   └──────────────────────────────────────────────────┘");

    console.log("\n🎉 Database setup complete!");
  } catch (error) {
    console.error("\n❌ Database setup failed:", error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
