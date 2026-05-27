/**
 * Database Check Script (ESM)
 *
 * Verifies database connectivity, lists existing tables, and shows row counts.
 * Non-destructive — safe to run anytime.
 *
 * Usage: node scripts/check-database.js
 */

import "dotenv/config";
import mysql from "mysql2/promise";

const DB_CONFIG = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_DATABASE,
};

async function main() {
  let connection;

  try {
    console.log("🔌 Connecting to MySQL...");
    console.log(`   Host: ${DB_CONFIG.host}:${DB_CONFIG.port}`);
    console.log(`   Database: ${DB_CONFIG.database}\n`);

    connection = await mysql.createConnection(DB_CONFIG);

    // Check connection
    await connection.ping();
    console.log("✅ Connection successful!\n");

    // Get MySQL version
    const [versionRows] = await connection.query("SELECT VERSION() as version");
    console.log(`📌 MySQL Version: ${versionRows[0].version}\n`);

    // List tables
    const [tables] = await connection.query("SHOW TABLES");

    if (tables.length === 0) {
      console.log("📋 No tables found. Run 'npm run db:setup' to create them.");
      return;
    }

    const tableKey = `Tables_in_${DB_CONFIG.database}`;
    console.log(`📋 Tables (${tables.length}):\n`);
    console.log("   ┌─────────────────────────────┬──────────┐");
    console.log("   │ Table                       │ Rows     │");
    console.log("   ├─────────────────────────────┼──────────┤");

    for (const row of tables) {
      const tableName = row[tableKey];
      const [countResult] = await connection.query(
        `SELECT COUNT(*) as count FROM \`${tableName}\``
      );
      const count = countResult[0].count;
      console.log(`   │ ${tableName.padEnd(27)} │ ${String(count).padStart(8)} │`);
    }

    console.log("   └─────────────────────────────┴──────────┘");
    console.log("\n🎉 Database check complete!");
  } catch (error) {
    if (error.code === "ER_BAD_DB_ERROR") {
      console.error(`\n❌ Database "${DB_CONFIG.database}" does not exist.`);
      console.error("   Run 'npm run db:setup' to create it.");
    } else if (error.code === "ECONNREFUSED") {
      console.error("\n❌ Cannot connect to MySQL server.");
      console.error(`   Is MySQL running on ${DB_CONFIG.host}:${DB_CONFIG.port}?`);
    } else if (error.code === "ER_ACCESS_DENIED_ERROR") {
      console.error("\n❌ Access denied. Check DB_USER and DB_PASS in .env");
    } else {
      console.error("\n❌ Database check failed:", error.message);
    }
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
