/**
 * Database Setup (Clean) Script (ESM)
 *
 * DROPS all existing tables then recreates from database/schema.sql.
 * ⚠️  WARNING: This will destroy all existing data!
 *
 * Usage: node scripts/setup-database-clean.js
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
    console.log("⚠️  WARNING: This will DROP all tables and recreate them!");
    console.log("   All existing data will be lost.\n");

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

    // Get existing tables and drop them
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

    // Execute schema (without IF NOT EXISTS since we just dropped everything)
    console.log("\n📋 Executing schema...\n");
    await connection.query(schema);

    // List created tables
    const [tables] = await connection.query("SHOW TABLES");
    const tableKey2 = `Tables_in_${DB_NAME}`;
    for (const row of tables) {
      console.log(`   ✅ ${row[tableKey2]}`);
    }

    // Seed superadmin if table is empty after clean
    console.log("\n👤 Creating default superadmin...");
    const timestamp = now();

    const [uuidRow] = await connection.query(`SELECT UUID() as id`);
    const accountId = uuidRow[0].id;

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

    console.log("\n🎉 Clean database setup complete!");
  } catch (error) {
    console.error("\n❌ Database setup failed:", error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
