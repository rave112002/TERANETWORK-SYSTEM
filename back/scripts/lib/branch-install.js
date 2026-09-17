/**
 * Single-branch installation seed — shared by setup-database.js and
 * setup-database-clean.js.
 *
 * ── One branch per installation ─────────────────────────────────────────────
 *
 * Production runs one server + one database per TERANETWORK branch (decision
 * D7 in docs/decisions.md). There is no central server, so a
 * database holds exactly one company row and exactly one branch row. This
 * module creates that shape:
 *
 *   permissions → company → branch → Owner / Admin / Billing / Technician
 *
 * The multi-branch machinery that already exists (`user_branches`,
 * `branchScope()`) is left in place — with a single branch it returns the same
 * rows as `branchId = ?`, so it is harmless — but nothing here creates a
 * second branch.
 *
 * ── Re-runnable ─────────────────────────────────────────────────────────────
 *
 * Every step checks before inserting. A role that already exists is left
 * exactly as it is, permissions included: an administrator may have tuned it
 * through the Roles screen, and a setup re-run must not quietly undo that. The
 * one exception is the Owner role, which is topped up with any permission it is
 * missing — Owner is defined as "everything", and a permission added by a later
 * release would otherwise be invisible to the branch's own owner.
 */

import argon2 from "argon2";
import moment from "moment-timezone";

// ── The permission catalogue ────────────────────────────────────────────────

export const PERMISSIONS = [
  { module: "dashboard", submodule: null, description: "Dashboard access" },
  { module: "users", submodule: "list", description: "Users list management" },
  { module: "users", submodule: "roles", description: "Roles management" },
  { module: "settings", submodule: null, description: "Settings management" },
  { module: "audit_trail", submodule: null, description: "Audit Trail access" },
  // ── ISP domain ──
  { module: "plans", submodule: null, description: "Service plans management" },
  { module: "customers", submodule: null, description: "Subscribers management" },
  { module: "network", submodule: "olts", description: "OLT devices" },
  { module: "network", submodule: "pon_ports", description: "PON ports" },
  { module: "network", submodule: "splitters", description: "Optical splitters" },
  { module: "network", submodule: "naps", description: "Network access points" },
  { module: "network", submodule: "onus", description: "Subscriber modems (ONUs)" },
  { module: "network", submodule: "provisioning", description: "Activate and deactivate modems at the OLT" },
  { module: "network", submodule: "action_logs", description: "Device command history" },
  { module: "network", submodule: "topology", description: "Network topology and map" },
  { module: "network", submodule: "discovery", description: "Device discovery and import" },
  { module: "subscriptions", submodule: null, description: "Subscriptions management" },
  { module: "system", submodule: null, description: "System settings and job queue" },
  { module: "billing", submodule: "invoices", description: "Invoices — view, issue, void" },
  { module: "billing", submodule: "payments", description: "Payments — record and reverse" },
  { module: "billing", submodule: "adjustments", description: "Credits, discounts and one-off charges" },
  { module: "billing", submodule: "cycle", description: "Run the monthly billing cycle" },
  { module: "billing", submodule: "dunning", description: "Disconnection sweep and exemptions" },
];

// ── The operational roles ───────────────────────────────────────────────────
//
// Keyed "module" or "module/submodule". A permission absent from a role's map
// is not granted at all. Agreed with the owner on 2026-09-16.

const ROLE_MATRIX = {
  Admin: {
    description: "Runs the branch: users, roles, settings, billing and subscribers. Reads the network.",
    grants: {
      dashboard: "write",
      customers: "write",
      subscriptions: "write",
      plans: "write",
      "billing/invoices": "write",
      "billing/payments": "write",
      "billing/adjustments": "write",
      "billing/cycle": "write",
      "billing/dunning": "write",
      "network/olts": "read",
      "network/pon_ports": "read",
      "network/splitters": "read",
      "network/naps": "read",
      "network/onus": "read",
      "network/topology": "read",
      "network/provisioning": "write",
      "network/discovery": "read",
      "network/action_logs": "read",
      "users/list": "write",
      "users/roles": "write",
      settings: "write",
      system: "write",
      audit_trail: "read",
    },
  },
  Billing: {
    description: "Invoices, payments, adjustments, the billing cycle and the disconnection sweep.",
    grants: {
      dashboard: "read",
      customers: "write",
      subscriptions: "write",
      plans: "read",
      "billing/invoices": "write",
      "billing/payments": "write",
      "billing/adjustments": "write",
      "billing/cycle": "write",
      "billing/dunning": "write",
      audit_trail: "read",
    },
  },
  Technician: {
    description: "Network inventory, provisioning and discovery. Reads subscribers.",
    grants: {
      dashboard: "read",
      customers: "read",
      subscriptions: "read",
      "network/olts": "write",
      "network/pon_ports": "write",
      "network/splitters": "write",
      "network/naps": "write",
      "network/onus": "write",
      "network/topology": "write",
      "network/provisioning": "write",
      "network/discovery": "write",
      "network/action_logs": "write",
    },
  },
};

export const OPERATIONAL_ROLES = Object.keys(ROLE_MATRIX);

const permissionKey = (p) => (p.submodule ? `${p.module}/${p.submodule}` : p.module);

// Storage is Asia/Manila local (matches getCurrentTimestampLocal + pool tz +08:00).
export const now = () =>
  moment().tz(process.env.TIMEZONE || "Asia/Manila").format("YYYY-MM-DD HH:mm:ss");

export const hashPassword = (password) =>
  // Argon2 embeds a random salt in the encoded hash — no separate salt needed.
  argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB (OWASP minimum for Argon2id)
    timeCost: 3,
    parallelism: 1,
  });

const uuid = async (connection) => {
  const [rows] = await connection.query(`SELECT UUID() AS id`);
  return rows[0].id;
};

// ── Steps ───────────────────────────────────────────────────────────────────

/**
 * Insert every catalogue permission that is missing, one row at a time.
 *
 * Per row rather than all-or-nothing, because migrations insert permissions of
 * their own and run first — a `COUNT(*) > 0` guard would skip the base rows on
 * a fresh install and leave it with no dashboard access and no error.
 */
export async function seedPermissions(connection) {
  const timestamp = now();
  let inserted = 0;

  for (const perm of PERMISSIONS) {
    // submodule is NULLable, and `= NULL` never matches — the two shapes
    // need different SQL.
    const [existing] = await connection.query(
      perm.submodule === null
        ? `SELECT permissionId FROM permissions WHERE module = ? AND submodule IS NULL LIMIT 1`
        : `SELECT permissionId FROM permissions WHERE module = ? AND submodule = ? LIMIT 1`,
      perm.submodule === null ? [perm.module] : [perm.module, perm.submodule]
    );
    if (existing.length > 0) continue;

    await connection.query(
      `INSERT INTO permissions (permissionId, module, submodule, description, portal, status, dateCreated, dateUpdated)
       VALUES (?, ?, ?, ?, 'ADMIN', 'Active', ?, ?)`,
      [await uuid(connection), perm.module, perm.submodule, perm.description, timestamp, timestamp]
    );
    inserted += 1;
  }

  console.log(
    inserted > 0
      ? `   ✅ ${inserted} permission(s) seeded (${PERMISSIONS.length - inserted} already present)`
      : "   ⏭️  All permissions already present"
  );
}

/** The SuperAdmin login. Skipped when the account already exists. */
export async function seedSuperadmin(connection) {
  const [existing] = await connection.query(
    `SELECT accountId FROM credentials WHERE email = 'superadmin@template.com' LIMIT 1`
  );
  if (existing.length > 0) {
    console.log("   ⏭️  SuperAdmin account already exists — skipping");
    return;
  }

  const timestamp = now();
  const accountId = await uuid(connection);

  await connection.query(
    `INSERT INTO superadmins (accountId, firstName, lastName, status, dateCreated, dateUpdated)
     VALUES (?, 'Super', 'Admin', 'Active', ?, ?)`,
    [accountId, timestamp, timestamp]
  );
  await connection.query(
    `INSERT INTO credentials (accountId, email, password, type, status, dateCreated, dateUpdated)
     VALUES (?, 'superadmin@template.com', ?, 'SUPERADMIN', 'Active', ?, ?)`,
    [accountId, await hashPassword("superadmin123"), timestamp, timestamp]
  );

  console.log("\n   📋 SuperAdmin Credentials:");
  console.log("   ┌──────────────────────────────────────────────────┐");
  console.log("   │ Email:    superadmin@template.com                │");
  console.log("   │ Password: superadmin123                          │");
  console.log("   └──────────────────────────────────────────────────┘");
}

/**
 * The company row. There is exactly one per installation.
 * @returns {Promise<string>} companyId
 */
async function ensureCompany(connection) {
  const [companies] = await connection.query(
    `SELECT companyId, name FROM companies WHERE status != 'Deleted' ORDER BY id`
  );

  if (companies.length > 1) {
    throw new Error(
      `Found ${companies.length} companies. An installation holds exactly one — ` +
        "resolve the extra rows before running setup."
    );
  }
  if (companies.length === 1) {
    console.log(`   ⏭️  Company "${companies[0].name}" already exists`);
    return companies[0].companyId;
  }

  const name = process.env.COMPANY_NAME || "TERANETWORK";
  const email = process.env.COMPANY_EMAIL;
  if (!email) {
    throw new Error("COMPANY_EMAIL must be set in .env to create the company on a fresh install.");
  }

  const timestamp = now();
  const companyId = await uuid(connection);
  await connection.query(
    `INSERT INTO companies (companyId, name, email, subscriptionPlan, subscriptionStartDate, status, dateCreated, dateUpdated)
     VALUES (?, ?, ?, 'Enterprise', ?, 'Active', ?, ?)`,
    [companyId, name, email, timestamp.slice(0, 10), timestamp, timestamp]
  );
  console.log(`   ✅ Company "${name}" created`);
  return companyId;
}

/**
 * The installation's branch.
 *
 * A fresh database gets one, named by BRANCH_NAME. A database that already has
 * exactly one uses it. A database with several — only a development database
 * created before D7 can look like this — must name the branch to set up with
 * BRANCH_NAME, and setup still touches only that one.
 *
 * @returns {Promise<{branchId: string, name: string}>}
 */
async function ensureBranch(connection, companyId) {
  const wanted = process.env.BRANCH_NAME?.trim() || null;
  const [branches] = await connection.query(
    `SELECT branchId, name FROM branches WHERE companyId = ? AND status != 'Deleted' ORDER BY id`,
    [companyId]
  );

  if (branches.length > 1) {
    const match = wanted && branches.find((b) => b.name === wanted);
    if (!match) {
      throw new Error(
        `This database has ${branches.length} branches (${branches.map((b) => `"${b.name}"`).join(", ")}). ` +
          "Production is one branch per installation; set BRANCH_NAME to the one this install serves."
      );
    }
    console.log(
      `   ⚠️  ${branches.length} branches exist — setting up "${match.name}" only. ` +
        "Production installs hold a single branch (D7)."
    );
    return match;
  }

  if (branches.length === 1) {
    if (wanted && branches[0].name !== wanted) {
      console.log(
        `   ⚠️  BRANCH_NAME is "${wanted}" but this install's branch is "${branches[0].name}" — using the existing branch`
      );
    } else {
      console.log(`   ⏭️  Branch "${branches[0].name}" already exists`);
    }
    return branches[0];
  }

  if (!wanted) {
    throw new Error("BRANCH_NAME must be set in .env to create this installation's branch.");
  }

  const timestamp = now();
  const branchId = await uuid(connection);
  await connection.query(
    `INSERT INTO branches (branchId, companyId, name, isMainBranch, status, dateCreated, dateUpdated)
     VALUES (?, ?, ?, 1, 'Active', ?, ?)`,
    [branchId, companyId, wanted, timestamp, timestamp]
  );
  console.log(`   ✅ Branch "${wanted}" created`);
  return { branchId, name: wanted };
}

/** Owner gets every active permission at write; missing grants are topped up. */
async function ensureOwnerRole(connection, companyId, branchId) {
  const timestamp = now();
  const [rows] = await connection.query(
    `SELECT roleId FROM roles WHERE companyId = ? AND branchId = ? AND roleName = 'Owner' LIMIT 1`,
    [companyId, branchId]
  );

  let roleId = rows[0]?.roleId;
  if (!roleId) {
    roleId = await uuid(connection);
    await connection.query(
      `INSERT INTO roles (roleId, companyId, branchId, roleName, description, status, dateCreated, dateUpdated)
       VALUES (?, ?, ?, 'Owner', 'Full access owner role. Not visible in Admin portal.', 'Active', ?, ?)`,
      [roleId, companyId, branchId, timestamp, timestamp]
    );
    console.log("   ✅ Owner role created");
  }

  const [result] = await connection.query(
    `INSERT INTO role_permissions (roleId, permissionId, accessLevel, dateCreated)
     SELECT ?, p.permissionId, 'write', ?
       FROM permissions p
      WHERE p.status = 'Active'
        AND NOT EXISTS (
          SELECT 1 FROM role_permissions rp
           WHERE rp.roleId = ? AND rp.permissionId = p.permissionId
        )`,
    [roleId, timestamp, roleId]
  );
  if (rows[0]) {
    console.log(
      result.affectedRows > 0
        ? `   ✅ Owner role topped up with ${result.affectedRows} missing permission(s)`
        : "   ⏭️  Owner role already has every permission"
    );
  }
  return roleId;
}

/** Admin / Billing / Technician, granted per ROLE_MATRIX when first created. */
async function ensureOperationalRoles(connection, companyId, branchId) {
  const [perms] = await connection.query(
    `SELECT permissionId, module, submodule FROM permissions WHERE status = 'Active'`
  );
  const byKey = new Map(perms.map((p) => [permissionKey(p), p.permissionId]));

  for (const [roleName, { description, grants }] of Object.entries(ROLE_MATRIX)) {
    const [existing] = await connection.query(
      `SELECT roleId FROM roles WHERE companyId = ? AND branchId = ? AND roleName = ? LIMIT 1`,
      [companyId, branchId, roleName]
    );
    if (existing.length > 0) {
      console.log(`   ⏭️  ${roleName} role already exists — permissions left as configured`);
      continue;
    }

    // Every key in the matrix must resolve. A typo here would otherwise grant
    // less than agreed and say nothing.
    const missing = Object.keys(grants).filter((k) => !byKey.has(k));
    if (missing.length > 0) {
      throw new Error(`${roleName}: permission(s) not in the permissions table: ${missing.join(", ")}`);
    }

    const timestamp = now();
    const roleId = await uuid(connection);
    await connection.query(
      `INSERT INTO roles (roleId, companyId, branchId, roleName, description, status, dateCreated, dateUpdated)
       VALUES (?, ?, ?, ?, ?, 'Active', ?, ?)`,
      [roleId, companyId, branchId, roleName, description, timestamp, timestamp]
    );

    const entries = Object.entries(grants);
    await connection.query(
      `INSERT INTO role_permissions (roleId, permissionId, accessLevel, dateCreated)
       VALUES ${entries.map(() => "(?, ?, ?, ?)").join(", ")}`,
      entries.flatMap(([key, level]) => [roleId, byKey.get(key), level, timestamp])
    );

    const writes = entries.filter(([, level]) => level === "write").length;
    console.log(
      `   ✅ ${roleName} role created — ${entries.length} permissions (${writes} write, ${entries.length - writes} read)`
    );
  }
}

/**
 * Company, branch and the four roles for this installation.
 * Transactional: a failure part-way leaves no half-built branch behind.
 *
 * @returns {Promise<{companyId: string, branchId: string, branchName: string}>}
 */
export async function seedBranchInstallation(connection) {
  await connection.beginTransaction();
  try {
    const companyId = await ensureCompany(connection);
    const branch = await ensureBranch(connection, companyId);
    await ensureOwnerRole(connection, companyId, branch.branchId);
    await ensureOperationalRoles(connection, companyId, branch.branchId);
    await connection.commit();
    return { companyId, branchId: branch.branchId, branchName: branch.name };
  } catch (err) {
    await connection.rollback();
    throw err;
  }
}
