/**
 * Database Setup with Seed Data Script (ESM)
 *
 * Drops all tables, recreates from database/schema.sql, and seeds demo data.
 *
 * Usage: node scripts/setup-database-with-data.js
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

// ─── Seed Data ───────────────────────────────────────────────────────────────

async function seedData(connection) {
  const timestamp = now();

  // Generate UUIDs from MySQL
  const [uuids] = await connection.query(
    `SELECT UUID() as u1, UUID() as u2, UUID() as u3, UUID() as u4, UUID() as u5, UUID() as u6`
  );
  const uuid = uuids[0];

  const superAdminAccountId = uuid.u1;
  const brandId = uuid.u2;
  const branchId = uuid.u3;
  const adminAccountId = uuid.u4;
  const roleId = uuid.u5;
  const permissionId = uuid.u6;

  // 1. Seed SuperAdmin
  console.log("   👤 Creating superadmin...");
  await connection.query(
    `INSERT INTO superadmins (accountId, firstName, lastName, status, dateCreated, dateUpdated)
     VALUES (?, 'Super', 'Admin', 'Active', ?, ?)`,
    [superAdminAccountId, timestamp, timestamp]
  );

  // 2. Seed SuperAdmin credentials
  const superAdminCreds = await hashPassword("superadmin123");
  await connection.query(
    `INSERT INTO credentials (accountId, email, password, salt, type, status, dateCreated, dateUpdated)
     VALUES (?, 'superadmin@template.com', ?, ?, 'SUPERADMIN', 'Active', ?, ?)`,
    [superAdminAccountId, superAdminCreds.hash, superAdminCreds.salt, timestamp, timestamp]
  );

  // 3. Seed Brand
  console.log("   🏢 Creating demo brand...");
  await connection.query(
    `INSERT INTO brands (brandId, name, email, subscriptionPlan, subscriptionStartDate, status, dateCreated, dateUpdated)
     VALUES (?, 'Demo Brand', 'demo@brand.com', 'Premium', CURDATE(), 'Active', ?, ?)`,
    [brandId, timestamp, timestamp]
  );

  // 4. Seed Branch
  console.log("   🏪 Creating demo branch...");
  await connection.query(
    `INSERT INTO branches (branchId, brandId, name, isMainBranch, status, dateCreated, dateUpdated)
     VALUES (?, ?, 'Main Branch', 1, 'Active', ?, ?)`,
    [branchId, brandId, timestamp, timestamp]
  );

  // 5. Seed Role
  console.log("   🎭 Creating admin role...");
  await connection.query(
    `INSERT INTO roles (roleId, brandId, branchId, roleName, description, status, dateCreated, dateUpdated)
     VALUES (?, ?, ?, 'Administrator', 'Full access administrator role', 'Active', ?, ?)`,
    [roleId, brandId, branchId, timestamp, timestamp]
  );

  // 6. Seed Permission
  console.log("   🔐 Creating demo permission...");
  await connection.query(
    `INSERT INTO permissions (permissionId, module, submodule, description, portal, status, dateCreated, dateUpdated)
     VALUES (?, 'dashboard', NULL, 'Dashboard access', 'ADMIN', 'Active', ?, ?)`,
    [permissionId, timestamp, timestamp]
  );

  // 7. Seed Role Permission
  await connection.query(
    `INSERT INTO role_permissions (roleId, permissionId, dateCreated)
     VALUES (?, ?, ?)`,
    [roleId, permissionId, timestamp]
  );

  // 8. Seed Admin User
  console.log("   👤 Creating admin user...");
  await connection.query(
    `INSERT INTO users (accountId, brandId, branchId, firstName, lastName, roleId, status, dateCreated, dateUpdated)
     VALUES (?, ?, ?, 'Admin', 'User', ?, 'Active', ?, ?)`,
    [adminAccountId, brandId, branchId, roleId, timestamp, timestamp]
  );

  // 9. Seed Admin Credentials
  const adminCreds = await hashPassword("admin123");
  await connection.query(
    `INSERT INTO credentials (accountId, email, password, salt, type, status, dateCreated, dateUpdated)
     VALUES (?, 'admin@demo.com', ?, ?, 'ADMIN', 'Active', ?, ?)`,
    [adminAccountId, adminCreds.hash, adminCreds.salt, timestamp, timestamp]
  );

  console.log("\n   📋 Demo Credentials:");
  console.log("   ┌──────────────────────────────────────────────────┐");
  console.log("   │ SuperAdmin: superadmin@template.com              │");
  console.log("   │ Password:   superadmin123                        │");
  console.log("   │                                                  │");
  console.log("   │ Admin:      admin@demo.com                       │");
  console.log("   │ Password:   admin123                             │");
  console.log("   └──────────────────────────────────────────────────┘");
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  let connection;

  try {
    console.log("⚠️  WARNING: This will DROP all tables, recreate, and seed data!");
    console.log("   All existing data will be replaced with demo data.\n");

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

    // Execute schema
    console.log("\n📋 Executing schema...\n");
    await connection.query(schema);

    // List created tables
    const [tables] = await connection.query("SHOW TABLES");
    const tableKey2 = `Tables_in_${DB_NAME}`;
    for (const row of tables) {
      console.log(`   ✅ ${row[tableKey2]}`);
    }

    // Seed data
    console.log("\n🌱 Seeding demo data...\n");
    await seedData(connection);

    console.log("\n🎉 Database setup with data complete!");
  } catch (error) {
    console.error("\n❌ Database setup failed:", error.message);
    if (error.sql) console.error("   SQL:", error.sql.substring(0, 200));
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
