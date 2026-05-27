/**
 * Database Reset Script (ESM)
 *
 * Drops the entire database and recreates it empty (no tables).
 * ⚠️  WARNING: This is the nuclear option — destroys everything!
 *
 * Usage: node scripts/reset-database.js
 */

import "dotenv/config";
import mysql from "mysql2/promise";

const DB_CONFIG = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
};

const DB_NAME = process.env.DB_DATABASE;

async function main() {
  let connection;

  try {
    console.log("⚠️  WARNING: This will DROP the entire database!");
    console.log(`   Database: ${DB_NAME}\n`);

    console.log("🔌 Connecting to MySQL...");
    connection = await mysql.createConnection(DB_CONFIG);

    // Drop database
    console.log(`🗑️  Dropping database "${DB_NAME}"...`);
    await connection.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);

    // Recreate empty database
    console.log(`📦 Recreating database "${DB_NAME}"...`);
    await connection.query(
      `CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );

    console.log("\n🎉 Database reset complete! (empty, no tables)");
    console.log("   Run 'npm run db:setup' to recreate tables.");
  } catch (error) {
    console.error("\n❌ Database reset failed:", error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
