-- ============================================================================
-- Database Schema — THE BASELINE
--
-- This file IS the schema and IS applied. `scripts/migrate.js` runs it first
-- (recorded in `_migrations` as `schema.sql`), then applies any numbered files
-- in database/migrations/ on top. Reached via `npm run db:migrate`, or
-- db:setup / db:setup:clean which migrate then seed.
--
-- Every statement is CREATE TABLE IF NOT EXISTS, so re-running it against an
-- already-provisioned database is a no-op.
--
-- ⚠️  Editing this file only affects databases provisioned from scratch — an
--     existing database has already recorded it as applied and will never
--     re-run it. To change a live schema, add a numbered migration in
--     database/migrations/ (001_*.sql, 002_*.sql, …) AND edit this file to
--     match, so the two never drift.
--
-- Conventions: every table has a surrogate `id BIGINT AUTO_INCREMENT` plus a
-- business ID (`varchar`, the value used in the API/URLs/FKs); timestamps are
-- DATETIME stored in Asia/Manila local time; rows are soft-deleted via
-- `status = 'Deleted'`, never physically removed.
--
-- Tables are ordered so inline FOREIGN KEY references always point at an
-- already-created table. FKs reference the business ID column (UNIQUE), never
-- the surrogate `id`. Default ON DELETE RESTRICT is intentional — with soft
-- deletes it never fires in normal operation but blocks accidental hard deletes
-- that would orphan children.
-- ============================================================================

-- ── Tenant hierarchy ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS companies (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  companyId VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  phone VARCHAR(20) NULL,
  website VARCHAR(255) NULL,
  logoUrl VARCHAR(255) NULL,
  -- Company profile fields. These are the branding and contact details that
  -- customer-facing documents (invoice PDFs, notification emails) render, so
  -- they live on the company row rather than being hardcoded in a template.
  address TEXT NULL,
  tin VARCHAR(20) NULL,
  subscriptionPlan ENUM('Basic','Standard','Premium','Enterprise') NOT NULL,
  subscriptionStartDate DATE NULL,
  subscriptionEndDate DATE NULL,
  status ENUM('Active','Inactive','Suspended','Pending','Deleted') NOT NULL DEFAULT 'Pending',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  INDEX idx_companies_status (status),
  INDEX idx_companies_subscriptionPlan (subscriptionPlan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS branches (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  branchId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NULL,
  phone VARCHAR(20) NULL,
  address TEXT NULL,
  regCode VARCHAR(20) NULL,
  provCode VARCHAR(20) NULL,
  citymunCode VARCHAR(20) NULL,
  brgyCode VARCHAR(20) NULL,
  zipCode VARCHAR(20) NULL,
  logoUrl VARCHAR(255) NULL,
  website VARCHAR(255) NULL,
  isMainBranch TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('Active','Inactive','Suspended','Deleted') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  INDEX idx_branches_companyId (companyId),
  INDEX idx_branches_tenant (companyId, status),
  CONSTRAINT fk_branches_company FOREIGN KEY (companyId) REFERENCES companies(companyId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Roles & users ───────────────────────────────────────────────────────────

-- `idx_roles_roleName` supports the constant `roleName != 'Owner'` filtering.
CREATE TABLE IF NOT EXISTS roles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  roleId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  roleName VARCHAR(50) NOT NULL,
  description TEXT NULL,
  status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  INDEX idx_roles_companyId (companyId),
  INDEX idx_roles_branchId (branchId),
  INDEX idx_roles_roleName (roleName),
  INDEX idx_roles_tenant (companyId, branchId, status),
  CONSTRAINT fk_roles_company FOREIGN KEY (companyId) REFERENCES companies(companyId),
  CONSTRAINT fk_roles_branch  FOREIGN KEY (branchId)  REFERENCES branches(branchId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- `idx_users_tenant` serves the universal query path:
-- WHERE companyId = ? AND branchId = ? AND status != 'Deleted'.
-- The single-column indexes remain because the FKs require them.
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  accountId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  firstName VARCHAR(50) NOT NULL,
  lastName VARCHAR(50) NOT NULL,
  phone VARCHAR(20) NULL,
  imageUrl VARCHAR(255) NULL,
  signature VARCHAR(255) NULL,
  roleId VARCHAR(50) NOT NULL,
  status ENUM('Active','Inactive','Suspended','Deleted') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  INDEX idx_users_companyId (companyId),
  INDEX idx_users_branchId (branchId),
  INDEX idx_users_roleId (roleId),
  INDEX idx_users_tenant (companyId, branchId, status),
  CONSTRAINT fk_users_company FOREIGN KEY (companyId) REFERENCES companies(companyId),
  CONSTRAINT fk_users_branch  FOREIGN KEY (branchId)  REFERENCES branches(branchId),
  CONSTRAINT fk_users_role    FOREIGN KEY (roleId)    REFERENCES roles(roleId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A user works in one or more branches. `users.branchId` remains the user's
-- HOME branch (where new records they create are filed, and where their uploads
-- are stored); this table is the authority on what they may READ and WRITE.
--
-- Every user has at least one row here, mirroring their home branch — so the
-- scoping predicate is uniformly `branchId IN (...)` with no special case for
-- "user with no assignments". See utils/branchScope.js.
CREATE TABLE IF NOT EXISTS user_branches (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  userBranchId VARCHAR(50) NOT NULL UNIQUE,
  accountId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  status ENUM('Active','Inactive','Deleted') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  UNIQUE KEY uq_user_branches (accountId, branchId),
  INDEX idx_user_branches_accountId (accountId),
  INDEX idx_user_branches_branchId (branchId),
  CONSTRAINT fk_user_branches_user   FOREIGN KEY (accountId) REFERENCES users(accountId),
  CONSTRAINT fk_user_branches_branch FOREIGN KEY (branchId)  REFERENCES branches(branchId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS superadmins (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  accountId VARCHAR(50) NOT NULL UNIQUE,
  firstName VARCHAR(50) NOT NULL,
  lastName VARCHAR(50) NOT NULL,
  phone VARCHAR(20) NULL,
  imageUrl VARCHAR(255) NULL,
  status ENUM('Active','Inactive','Suspended','Deleted') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Auth ────────────────────────────────────────────────────────────────────

-- Shared auth table for superadmins + users (keyed by accountId, polymorphic —
-- hence no FK on accountId). Argon2's encoded hash embeds the salt, so there is
-- no separate salt column. See utils/hashing/argonHash.js.
CREATE TABLE IF NOT EXISTS credentials (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  accountId VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  type ENUM('SUPERADMIN','ADMIN','USER') NOT NULL,
  status ENUM('Active','Inactive','Suspended','Deleted') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Issued refresh tokens, keyed by the JWT's jti claim. Enables rotation (every
-- /refresh revokes the presented token), reuse detection, and logout
-- revocation. accountId is polymorphic (superadmin OR user) — no FK.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  jti VARCHAR(64) NOT NULL UNIQUE,
  accountId VARCHAR(50) NOT NULL,
  expiresAt DATETIME NOT NULL,
  revokedAt DATETIME NULL,
  replacedByJti VARCHAR(64) NULL,
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  INDEX idx_refresh_tokens_accountId (accountId),
  INDEX idx_refresh_tokens_expiresAt (expiresAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Single-use, TTL'd tokens for the forgot/reset-password flow. Only the SHA-256
-- hash of the token is stored (the plaintext lives only in the emailed link).
-- accountId is polymorphic — no FK, matching refresh_tokens.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tokenHash VARCHAR(64) NOT NULL UNIQUE,
  accountId VARCHAR(50) NOT NULL,
  expiresAt DATETIME NOT NULL,
  usedAt DATETIME NULL,
  dateCreated DATETIME NOT NULL,
  INDEX idx_password_reset_tokens_accountId (accountId),
  INDEX idx_password_reset_tokens_expiresAt (expiresAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Permissions ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS permissions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  permissionId VARCHAR(50) NOT NULL UNIQUE,
  module VARCHAR(50) NOT NULL,
  submodule VARCHAR(50) NULL,
  description TEXT NULL,
  portal ENUM('ADMIN') NOT NULL DEFAULT 'ADMIN',
  status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  roleId VARCHAR(50) NOT NULL,
  permissionId VARCHAR(50) NOT NULL,
  accessLevel ENUM('read','write') NOT NULL,
  dateCreated DATETIME NOT NULL,
  INDEX idx_role_permissions_roleId (roleId),
  INDEX idx_role_permissions_permissionId (permissionId),
  CONSTRAINT fk_rp_role       FOREIGN KEY (roleId)       REFERENCES roles(roleId),
  CONSTRAINT fk_rp_permission FOREIGN KEY (permissionId) REFERENCES permissions(permissionId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_permissions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  userPermissionId VARCHAR(50) NOT NULL UNIQUE,
  accountId VARCHAR(50) NOT NULL,
  permissionId VARCHAR(50) NOT NULL,
  accessLevel ENUM('none','read','write') NOT NULL DEFAULT 'read',
  dateCreated DATETIME NOT NULL,
  INDEX idx_user_permissions_accountId (accountId),
  INDEX idx_user_permissions_permissionId (permissionId),
  CONSTRAINT fk_up_user       FOREIGN KEY (accountId)    REFERENCES users(accountId),
  CONSTRAINT fk_up_permission FOREIGN KEY (permissionId) REFERENCES permissions(permissionId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Tenant settings ─────────────────────────────────────────────────────────

-- Generic key/value store scoped to a company + branch. One row per
-- (companyId, branchId, settingKey). Values are text (JSON-encoded by the
-- controller when needed).
CREATE TABLE IF NOT EXISTS settings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  settingKey VARCHAR(100) NOT NULL,
  settingValue TEXT NULL,
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  UNIQUE KEY uq_settings_tenant_key (companyId, branchId, settingKey),
  CONSTRAINT fk_settings_company FOREIGN KEY (companyId) REFERENCES companies(companyId),
  CONSTRAINT fk_settings_branch  FOREIGN KEY (branchId)  REFERENCES branches(branchId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Infrastructure ──────────────────────────────────────────────────────────

-- Cached responses for mutation requests carrying an Idempotency-Key header
-- (see middlewares/idempotency.middleware.js). Rows are immutable and TTL'd.
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  idempotencyKey VARCHAR(100) NOT NULL UNIQUE,
  requestHash VARCHAR(64) NOT NULL,
  responseCode INT NOT NULL,
  responseBody JSON NULL,
  dateCreated DATETIME NOT NULL,
  expiresAt DATETIME NOT NULL,
  INDEX idx_idempotency_keys_expiresAt (expiresAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit rows must outlive their referents and accountId is polymorphic, so this
-- table intentionally has no foreign keys.
CREATE TABLE IF NOT EXISTS audit_trail (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  auditId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  accountId VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  description TEXT NULL,
  metadata JSON NULL,
  ipAddress VARCHAR(45) NULL,
  userAgent TEXT NULL,
  dateCreated DATETIME NOT NULL,
  INDEX idx_audit_trail_companyId (companyId),
  INDEX idx_audit_trail_branchId (branchId),
  INDEX idx_audit_trail_accountId (accountId),
  INDEX idx_audit_trail_dateCreated (dateCreated)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ISP DOMAIN
--
-- TERANETWORK is a single company with several branches (docs/migration/00-decisions.md
-- D1). Network inventory and subscribers belong to a branch; the service-plan
-- catalogue is shared company-wide (D3).
--
-- Money is DECIMAL(12,2) everywhere and never FLOAT. Application code must not
-- do arithmetic on the values the driver returns as JS numbers — see
-- server/src/lib/money/money.js.
-- ============================================================================

-- Sequence generator for human-readable business numbers (ACC-000123 today,
-- INV-2026-000123 when billing lands). Allocated inside the caller's
-- transaction with the LAST_INSERT_ID trick, so two concurrent creates can
-- never receive the same number:
--
--   INSERT INTO counters (name, nextValue) VALUES (?, 2)
--     ON DUPLICATE KEY UPDATE nextValue = LAST_INSERT_ID(nextValue) + 1;
--   -- first insert returns 1 via the VALUES default; later ones via LAST_INSERT_ID
CREATE TABLE IF NOT EXISTS counters (
  name VARCHAR(64) PRIMARY KEY,
  nextValue BIGINT UNSIGNED NOT NULL DEFAULT 1,
  dateUpdated DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Service plans — the speed/price catalogue.
--
-- Company-wide, NOT branch-scoped (decision D3): one ISP has one price list,
-- and duplicating a plan per branch would turn "change the price of Fiber 50"
-- into a multi-row edit that can go half-done. Revenue stays attributable per
-- branch because subscriptions and invoices carry branchId.
CREATE TABLE IF NOT EXISTS plans (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  planId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  downMbps INT UNSIGNED NOT NULL,
  upMbps INT UNSIGNED NOT NULL,
  monthlyPrice DECIMAL(12,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'PHP',
  -- Charged once, on a subscription's first invoice.
  installFee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  -- Retained as a mechanism but zero by client decision — there is no
  -- reconnection fee today. See docs/reference PENDING-Billing-Model-Corrections.
  reconnectionFee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status ENUM('Active','Inactive','Deleted') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  INDEX idx_plans_companyId (companyId),
  INDEX idx_plans_tenant (companyId, status),
  CONSTRAINT fk_plans_company FOREIGN KEY (companyId) REFERENCES companies(companyId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Subscribers — the paying account holders.
--
-- `email` is NOT NULL and deliberately so: invoices are delivered by email
-- only, so a customer without one cannot be billed.
CREATE TABLE IF NOT EXISTS customers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  customerId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  -- Human-readable account number, ACC-000123, from `counters`.
  accountNo VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NULL,
  address TEXT NULL,
  -- Plots the subscriber on the NAP map. 7 decimal places ≈ 1cm precision.
  gpsLat DECIMAL(10,7) NULL,
  gpsLng DECIMAL(10,7) NULL,
  idType VARCHAR(40) NULL,
  idNumber VARCHAR(64) NULL,
  notes TEXT NULL,
  status ENUM('Active','Inactive','Deleted') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  INDEX idx_customers_companyId (companyId),
  INDEX idx_customers_branchId (branchId),
  INDEX idx_customers_tenant (companyId, branchId, status),
  INDEX idx_customers_email (email),
  CONSTRAINT fk_customers_company FOREIGN KEY (companyId) REFERENCES companies(companyId),
  CONSTRAINT fk_customers_branch  FOREIGN KEY (branchId)  REFERENCES branches(branchId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Network inventory (OSS) ─────────────────────────────────────────────────
--
-- The physical fibre plant, in the order signal travels:
--   OLT → PON port → splitter (possibly cascaded) → NAP → ONU (subscriber modem)
--
-- `branchId` is denormalised onto every level rather than walked up the chain.
-- Scoping stays uniform (branchScope() on one column), lists need no three-deep
-- join, and equipment does not move between branches — a relocation is a
-- decommission-and-reinstall, not an UPDATE.

-- Optical Line Terminals — the head-end devices this system logs into to
-- suspend and restore a subscriber's service.
CREATE TABLE IF NOT EXISTS olts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  oltId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  vendor ENUM('hsgq','huawei','zte','fiberhome','vsol','bdcom','mock','other') NOT NULL,
  -- The lab OLT (HSGQ XE04I) is EPON, where an ONU is identified by MAC rather
  -- than by a GPON serial. Drivers branch on this.
  ponTechnology ENUM('epon','gpon') NOT NULL DEFAULT 'epon',
  model VARCHAR(80) NULL,
  host VARCHAR(190) NOT NULL,
  port SMALLINT UNSIGNED NOT NULL DEFAULT 23,
  protocol ENUM('ssh','telnet','snmp','tr069') NOT NULL DEFAULT 'telnet',
  -- Envelope-encrypted JSON, never plaintext. See lib/crypto/credentialCrypto.js.
  -- NULL until credentials are supplied, so a device can be inventoried first.
  credentialsEnc VARBINARY(2048) NULL,
  site VARCHAR(120) NULL,
  -- The XE04I has a 250 MHz CPU and tolerates one CLI session at a time; the
  -- worker uses this to cap in-flight jobs per device.
  maxConcurrentSessions TINYINT UNSIGNED NOT NULL DEFAULT 1,
  notes TEXT NULL,
  status ENUM('Active','Maintenance','Retired','Deleted') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  UNIQUE KEY uq_olts_name (companyId, name),
  INDEX idx_olts_companyId (companyId),
  INDEX idx_olts_branchId (branchId),
  INDEX idx_olts_tenant (companyId, branchId, status),
  CONSTRAINT fk_olts_company FOREIGN KEY (companyId) REFERENCES companies(companyId),
  CONSTRAINT fk_olts_branch  FOREIGN KEY (branchId)  REFERENCES branches(branchId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A PON port feeds a tree of subscribers, typically up to 64 or 128 ONUs.
CREATE TABLE IF NOT EXISTS pon_ports (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  ponPortId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  oltId VARCHAR(50) NOT NULL,
  -- Vendor formats vary: '1' on the HSGQ, '0/1/3' on a Huawei.
  portIndex VARCHAR(32) NOT NULL,
  capacity SMALLINT UNSIGNED NOT NULL DEFAULT 64,
  description VARCHAR(190) NULL,
  status ENUM('Active','Down','Reserved','Deleted') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  UNIQUE KEY uq_pon_ports (oltId, portIndex),
  INDEX idx_pon_ports_oltId (oltId),
  INDEX idx_pon_ports_tenant (companyId, branchId, status),
  CONSTRAINT fk_pon_ports_company FOREIGN KEY (companyId) REFERENCES companies(companyId),
  CONSTRAINT fk_pon_ports_branch  FOREIGN KEY (branchId)  REFERENCES branches(branchId),
  CONSTRAINT fk_pon_ports_olt     FOREIGN KEY (oltId)     REFERENCES olts(oltId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Passive optical splitters. The parent is polymorphic — a splitter hangs off
-- either a PON port or another splitter (cascading) — which MySQL cannot express
-- as a foreign key, so the service layer validates it and rejects a self-parent.
CREATE TABLE IF NOT EXISTS splitters (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  splitterId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  parentType ENUM('pon_port','splitter') NOT NULL,
  parentId VARCHAR(50) NOT NULL,
  ratio ENUM('1:2','1:4','1:8','1:16','1:32','1:64') NOT NULL,
  label VARCHAR(120) NOT NULL,
  location VARCHAR(190) NULL,
  status ENUM('Active','Inactive','Deleted') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  INDEX idx_splitters_parent (parentType, parentId),
  INDEX idx_splitters_tenant (companyId, branchId, status),
  CONSTRAINT fk_splitters_company FOREIGN KEY (companyId) REFERENCES companies(companyId),
  CONSTRAINT fk_splitters_branch  FOREIGN KEY (branchId)  REFERENCES branches(branchId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Network Access Points (also FAT/FDB) — the field boxes where subscriber drop
-- cables terminate. GPS is required: these are what the map is for.
CREATE TABLE IF NOT EXISTS naps (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  napId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  splitterId VARCHAR(50) NOT NULL,
  label VARCHAR(120) NOT NULL,
  totalPorts TINYINT UNSIGNED NOT NULL DEFAULT 8,
  gpsLat DECIMAL(10,7) NOT NULL,
  gpsLng DECIMAL(10,7) NOT NULL,
  address VARCHAR(255) NULL,
  notes TEXT NULL,
  status ENUM('Active','Inactive','Deleted') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  INDEX idx_naps_splitterId (splitterId),
  INDEX idx_naps_tenant (companyId, branchId, status),
  CONSTRAINT fk_naps_company  FOREIGN KEY (companyId)  REFERENCES companies(companyId),
  CONSTRAINT fk_naps_branch   FOREIGN KEY (branchId)   REFERENCES branches(branchId),
  CONSTRAINT fk_naps_splitter FOREIGN KEY (splitterId) REFERENCES splitters(splitterId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Subscriber modems. THIS is the device the dunning engine suspends and
-- restores, so its state is the most safety-critical column in the schema:
-- `provisioningState` is only ever moved to 'active'/'suspended' by the
-- provisioning worker, after a confirmed device response, in the same
-- transaction as the network action log.
--
-- `oltId` and `ponPortId` are denormalised so the worker can resolve
-- ONU -> OLT -> driver without walking NAP -> splitter -> PON port first.
CREATE TABLE IF NOT EXISTS onus (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  onuId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  -- The label printed on the unit. On EPON the MAC is the real identifier.
  serialNo VARCHAR(64) NULL,
  mac VARCHAR(17) NULL,
  model VARCHAR(80) NULL,
  napId VARCHAR(50) NULL,
  napPort TINYINT UNSIGNED NULL,
  oltId VARCHAR(50) NULL,
  ponPortId VARCHAR(50) NULL,
  -- Vendor-side index within the PON, e.g. '1/27'.
  onuIndex VARCHAR(32) NULL,
  provisioningState ENUM('unprovisioned','active','suspended','offline') NOT NULL DEFAULT 'unprovisioned',
  lastRxDbm DECIMAL(6,2) NULL,
  lastTxDbm DECIMAL(6,2) NULL,
  lastSeenAt DATETIME NULL,
  description VARCHAR(255) NULL,
  notes TEXT NULL,
  -- Separate from provisioningState: one is where the device sits in its service
  -- lifecycle, the other is whether the inventory record exists at all.
  recordStatus ENUM('Active','Inactive','Deleted') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  UNIQUE KEY uq_onus_serial (companyId, serialNo),
  UNIQUE KEY uq_onus_mac (companyId, mac),
  -- One ONU per NAP port — a second unit on the same port is a data-entry error.
  UNIQUE KEY uq_onus_nap_port (napId, napPort),
  INDEX idx_onus_oltId (oltId),
  INDEX idx_onus_napId (napId),
  INDEX idx_onus_state (provisioningState),
  INDEX idx_onus_tenant (companyId, branchId, recordStatus),
  CONSTRAINT fk_onus_company  FOREIGN KEY (companyId)  REFERENCES companies(companyId),
  CONSTRAINT fk_onus_branch   FOREIGN KEY (branchId)   REFERENCES branches(branchId),
  CONSTRAINT fk_onus_nap      FOREIGN KEY (napId)      REFERENCES naps(napId),
  CONSTRAINT fk_onus_olt      FOREIGN KEY (oltId)      REFERENCES olts(oltId),
  CONSTRAINT fk_onus_pon_port FOREIGN KEY (ponPortId)  REFERENCES pon_ports(ponPortId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Subscriptions ───────────────────────────────────────────────────────────
--
-- The binding that makes a customer billable: customer + plan + ONU. The
-- billing cycle iterates over these, and the dunning sweep suspends them.
--
-- ── `status` is a lifecycle, and it is not freely editable ──────────────────
--
--   pending  → active       staff activate a new connection
--   active   → suspended    the DUNNING WORKER, after the OLT confirms the cut
--   suspended→ active       the PAYMENT PATH, after the OLT confirms restore
--   any      → terminated   staff end the service
--
-- Only the first and last are staff actions. `suspended` mirrors what the
-- device is actually doing, so it is written by the provisioning worker in the
-- same transaction as the ONU's own state — never by hand, or the system starts
-- billing on a belief the hardware does not share.
--
-- ── There is deliberately no `statementDay` column ──────────────────────────
--
-- The original spec had a per-subscriber billing anchor. The client's corrected
-- model (docs/reference PENDING-Billing-Model-Corrections) bills everyone on
-- the 15th for the calendar month, so a per-row anchor would be dead config
-- that could silently disagree with the cron. See decision D5.
CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  subscriptionId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  customerId VARCHAR(50) NOT NULL,
  planId VARCHAR(50) NOT NULL,
  -- One live subscription per modem. NULL while a connection is pending
  -- installation, so the UNIQUE key tolerates many un-bound rows.
  onuId VARCHAR(50) NULL,
  status ENUM('pending','active','suspended','terminated') NOT NULL DEFAULT 'pending',
  -- When service actually began. Proration reads this, so it is set at
  -- activation rather than at creation.
  activatedAt DATETIME NULL,
  terminatedAt DATETIME NULL,
  notes TEXT NULL,
  -- Separate from `status`: one is the service lifecycle, the other is whether
  -- the record itself is still in use. Same split as onus.recordStatus.
  recordStatus ENUM('Active','Deleted') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  UNIQUE KEY uq_subscriptions_onu (onuId),
  INDEX idx_subscriptions_customerId (customerId),
  INDEX idx_subscriptions_planId (planId),
  INDEX idx_subscriptions_status (status),
  INDEX idx_subscriptions_tenant (companyId, branchId, recordStatus),
  CONSTRAINT fk_subscriptions_company  FOREIGN KEY (companyId)  REFERENCES companies(companyId),
  CONSTRAINT fk_subscriptions_branch   FOREIGN KEY (branchId)   REFERENCES branches(branchId),
  CONSTRAINT fk_subscriptions_customer FOREIGN KEY (customerId) REFERENCES customers(customerId),
  CONSTRAINT fk_subscriptions_plan     FOREIGN KEY (planId)     REFERENCES plans(planId),
  CONSTRAINT fk_subscriptions_onu      FOREIGN KEY (onuId)      REFERENCES onus(onuId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Runtime settings & background work ──────────────────────────────────────

-- Runtime-tunable configuration, company-wide.
--
-- These live in the database rather than the environment because they must be
-- changeable without a restart: DRY_RUN is a kill switch someone reaches for
-- while a disconnect is going wrong, and GRACE_DAYS is a business rule the
-- client may revise. Anything that only changes at deploy time stays in .env.
CREATE TABLE IF NOT EXISTS system_settings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  companyId VARCHAR(50) NOT NULL,
  settingKey VARCHAR(80) NOT NULL,
  settingValue VARCHAR(255) NULL,
  description VARCHAR(255) NULL,
  updatedBy VARCHAR(50) NULL,
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  UNIQUE KEY uq_system_settings (companyId, settingKey),
  CONSTRAINT fk_system_settings_company FOREIGN KEY (companyId) REFERENCES companies(companyId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The durable work queue — deliberately a table, not Redis.
--
-- `node-cron` only ever INSERTS here; a separate worker process claims rows with
-- SELECT ... FOR UPDATE SKIP LOCKED and does the actual work. Everything a job
-- runner normally gives you — retries, backoff, dead-lettering, cancellation,
-- concurrency — is modelled as columns plus the logic in lib/jobs, which keeps
-- the whole system on MySQL and makes the queue inspectable with a SELECT.
--
-- ── Why no HTTP request ever does device work ───────────────────────────────
--
-- A telnet session to an OLT takes seconds and can hang. Doing that inside a
-- request handler would tie up a connection, time out the browser, and leave
-- nobody knowing whether the command landed. So the API enqueues and returns
-- 202; the worker owns every device conversation.
CREATE TABLE IF NOT EXISTS jobs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  jobId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  -- NULL for company-wide work (a billing run); set for anything that belongs
  -- to one site, so the queue can be read per branch.
  branchId VARCHAR(50) NULL,
  type ENUM('deactivate','activate','status','email') NOT NULL,
  payload JSON NOT NULL,
  status ENUM('queued','processing','succeeded','failed','dead','cancelled')
    NOT NULL DEFAULT 'queued',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  maxAttempts INT UNSIGNED NOT NULL DEFAULT 5,
  -- Backoff is expressed by pushing this into the future on failure.
  nextRunAt DATETIME NOT NULL,
  -- Stable identity for a unit of work, e.g. 'deactivate:onu:<onuId>'. Two
  -- things depend on it: a re-run of the dunning sweep must not enqueue the
  -- same disconnect twice, and a payment must be able to cancel a queued
  -- disconnect it has just made unnecessary.
  dedupeKey VARCHAR(120) NULL,
  lockedAt DATETIME NULL,
  lockedBy VARCHAR(64) NULL,
  lastError TEXT NULL,
  startedAt DATETIME NULL,
  finishedAt DATETIME NULL,
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  -- Serves the claim query: WHERE status = ? AND nextRunAt <= ? ORDER BY id.
  INDEX idx_jobs_claim (status, nextRunAt, id),
  -- MySQL has no partial unique index, so "only one live job per key" is
  -- enforced in the service layer; this makes that check cheap.
  INDEX idx_jobs_dedupe (dedupeKey, status),
  INDEX idx_jobs_tenant (companyId, status),
  CONSTRAINT fk_jobs_company FOREIGN KEY (companyId) REFERENCES companies(companyId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Device action log ───────────────────────────────────────────────────────
--
-- The black box. Every command this system sends an OLT is recorded here with
-- the device's verbatim reply, whether it worked or not.
--
-- ── Why verbatim, and why append-only ───────────────────────────────────────
--
-- This platform can take a paying customer's internet away. When someone asks
-- "why was I disconnected on the 3rd?", the answer has to be the exact text
-- sent and the exact text received — not a summary written by the code that had
-- the bug. Nothing updates or deletes a row here.
--
-- ── Timestamps are ours, never the device's ─────────────────────────────────
--
-- The bench XE04I reports the year 2000 until NTP is configured, so a
-- device-reported time would make the log useless for exactly the disputes it
-- exists to settle. `dateCreated` is always server-side.
CREATE TABLE IF NOT EXISTS network_action_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  actionLogId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  onuId VARCHAR(50) NOT NULL,
  oltId VARCHAR(50) NULL,
  -- 'dry_run' is a first-class action: it records what WOULD have been sent
  -- while the kill switch was on, which is the point of rehearsing.
  action ENUM('activate','deactivate','status','dry_run') NOT NULL,
  -- 'system:dunning', 'system:payment', or 'user:<accountId>' — the same
  -- vocabulary the audit trail uses for automated actors.
  triggeredBy VARCHAR(64) NOT NULL,
  jobId VARCHAR(50) NULL,
  command TEXT NULL,
  deviceResponse MEDIUMTEXT NULL,
  success TINYINT(1) NOT NULL,
  error TEXT NULL,
  durationMs INT UNSIGNED NULL,
  dateCreated DATETIME NOT NULL,
  INDEX idx_nal_onu (onuId, dateCreated),
  INDEX idx_nal_tenant (companyId, branchId, dateCreated),
  INDEX idx_nal_job (jobId),
  CONSTRAINT fk_nal_company FOREIGN KEY (companyId) REFERENCES companies(companyId),
  CONSTRAINT fk_nal_branch  FOREIGN KEY (branchId)  REFERENCES branches(branchId),
  CONSTRAINT fk_nal_onu     FOREIGN KEY (onuId)     REFERENCES onus(onuId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- BILLING
--
-- Money is DECIMAL(12,2) throughout and never FLOAT. The pool sets
-- decimalNumbers: true, so these arrive as JS numbers — safe to read, never
-- safe to compute on. All arithmetic goes through server/src/lib/money/money.js.
-- ============================================================================

-- ── Invoices ────────────────────────────────────────────────────────────────
--
-- One invoice per subscription per calendar month.
--
-- `uq_invoices_period (subscriptionId, billingPeriodStart)` is not an
-- optimisation. The cycle engine is a scheduled job, and scheduled jobs get run
-- twice — by a retry, by an operator, by two workers that both thought they
-- were alone. This key turns the second run into a no-op instead of a customer
-- billed twice, and the engine catches the duplicate-key error rather than
-- pre-checking and hoping.
CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  invoiceId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  subscriptionId VARCHAR(50) NOT NULL,
  customerId VARCHAR(50) NOT NULL,
  -- Human-readable and sequential: INV-2026-000123.
  invoiceNo VARCHAR(24) NOT NULL UNIQUE,
  billingPeriodStart DATE NOT NULL,
  billingPeriodEnd DATE NOT NULL,
  -- When it is issued (the 15th) and when payment is due (the 2nd of the next
  -- month). Both are business rules, not preferences — see lib/billing/billing.dates.js.
  statementDate DATE NOT NULL,
  dueDate DATE NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  fees DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tax DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(12,2) NOT NULL,
  amountPaid DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status ENUM('draft','issued','paid','overdue','void') NOT NULL DEFAULT 'draft',
  -- 128 bits of randomness. Every emailed link and QR encodes /pay/<token>,
  -- never a gateway URL — so the link keeps working after the gateway's own
  -- payment link expires, and a customer paying weeks late still lands
  -- somewhere useful.
  publicToken CHAR(32) NOT NULL UNIQUE,
  xenditRef VARCHAR(64) NULL UNIQUE,
  xenditPaymentUrl VARCHAR(512) NULL,
  xenditExpiresAt DATETIME NULL,
  pdfPath VARCHAR(255) NULL,
  issuedAt DATETIME NULL,
  paidAt DATETIME NULL,
  voidReason VARCHAR(255) NULL,
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  UNIQUE KEY uq_invoices_period (subscriptionId, billingPeriodStart),
  INDEX idx_invoices_customer (customerId),
  INDEX idx_invoices_due (status, dueDate),
  INDEX idx_invoices_tenant (companyId, branchId, status),
  CONSTRAINT fk_invoices_company      FOREIGN KEY (companyId)      REFERENCES companies(companyId),
  CONSTRAINT fk_invoices_branch       FOREIGN KEY (branchId)       REFERENCES branches(branchId),
  CONSTRAINT fk_invoices_subscription FOREIGN KEY (subscriptionId) REFERENCES subscriptions(subscriptionId),
  CONSTRAINT fk_invoices_customer     FOREIGN KEY (customerId)     REFERENCES customers(customerId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Invoice lines ───────────────────────────────────────────────────────────
--
-- Amounts are SIGNED: a credit is negative, which is how an outage credit
-- reduces a bill without needing a second mechanism.
CREATE TABLE IF NOT EXISTS invoice_lines (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  invoiceLineId VARCHAR(50) NOT NULL UNIQUE,
  invoiceId VARCHAR(50) NOT NULL,
  kind ENUM('plan','proration','install_fee','reconnection_fee','credit','debit','discount')
    NOT NULL,
  description VARCHAR(255) NOT NULL,
  qty DECIMAL(8,2) NOT NULL DEFAULT 1.00,
  unitPrice DECIMAL(12,2) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  sortOrder INT NOT NULL DEFAULT 0,
  dateCreated DATETIME NOT NULL,
  INDEX idx_invoice_lines_invoice (invoiceId, sortOrder),
  CONSTRAINT fk_invoice_lines_invoice FOREIGN KEY (invoiceId) REFERENCES invoices(invoiceId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Payments ────────────────────────────────────────────────────────────────
--
-- `uq_payments_xendit (xenditPaymentId)` is the webhook idempotency guard: the
-- gateway retries on any non-2xx, so the same payment WILL arrive more than
-- once. NULL for cash and over-the-counter entries, which is why it is a unique
-- index on a nullable column rather than a unique NOT NULL one.
--
-- Payments are never deleted. A mistaken entry is reversed by recording a
-- negative one, so the trail of what was believed and when survives.
CREATE TABLE IF NOT EXISTS payments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  paymentId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  invoiceId VARCHAR(50) NOT NULL,
  customerId VARCHAR(50) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  -- GCASH, MAYA, QRPH, CARD, CASH, BANK_TRANSFER…
  channel VARCHAR(40) NOT NULL,
  xenditPaymentId VARCHAR(64) NULL UNIQUE,
  -- Set for manual entries, so "who took this cash?" is answerable.
  recordedBy VARCHAR(50) NULL,
  paidAt DATETIME NOT NULL,
  -- The gateway's original payload, kept verbatim for dispute forensics.
  rawPayload JSON NULL,
  notes VARCHAR(255) NULL,
  dateCreated DATETIME NOT NULL,
  INDEX idx_payments_invoice (invoiceId),
  INDEX idx_payments_tenant (companyId, branchId, paidAt),
  CONSTRAINT fk_payments_company  FOREIGN KEY (companyId)  REFERENCES companies(companyId),
  CONSTRAINT fk_payments_branch   FOREIGN KEY (branchId)   REFERENCES branches(branchId),
  CONSTRAINT fk_payments_invoice  FOREIGN KEY (invoiceId)  REFERENCES invoices(invoiceId),
  CONSTRAINT fk_payments_customer FOREIGN KEY (customerId) REFERENCES customers(customerId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Pending charges ─────────────────────────────────────────────────────────
--
-- Amounts owed (or owing) that have no invoice to sit on yet: a reconnection
-- fee incurred on the 20th, a manual adjustment, and — when M18 lands — an
-- outage credit as a NEGATIVE amount.
--
-- `appliedInvoiceId IS NULL` is the idempotency guard. The cycle picks up
-- unapplied rows and stamps them inside the same transaction that creates the
-- invoice, so a re-run cannot bill one twice.
CREATE TABLE IF NOT EXISTS pending_charges (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  pendingChargeId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  customerId VARCHAR(50) NOT NULL,
  subscriptionId VARCHAR(50) NULL,
  kind ENUM('reconnection_fee','install_fee','credit','debit','discount') NOT NULL,
  description VARCHAR(255) NOT NULL,
  -- Signed: credits and discounts are negative.
  amount DECIMAL(12,2) NOT NULL,
  appliedInvoiceId VARCHAR(50) NULL,
  appliedAt DATETIME NULL,
  createdBy VARCHAR(50) NULL,
  status ENUM('Active','Deleted') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  INDEX idx_pending_charges_open (subscriptionId, appliedInvoiceId, status),
  INDEX idx_pending_charges_tenant (companyId, branchId),
  CONSTRAINT fk_pending_charges_company  FOREIGN KEY (companyId)  REFERENCES companies(companyId),
  CONSTRAINT fk_pending_charges_branch   FOREIGN KEY (branchId)   REFERENCES branches(branchId),
  CONSTRAINT fk_pending_charges_customer FOREIGN KEY (customerId) REFERENCES customers(customerId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Email events ────────────────────────────────────────────────────────────
--
-- One row per email the system tried to send.
--
-- With plain SMTP there are no delivery webhooks, so `providerStatus`
-- realistically reaches 'sent' or 'failed' and no further. 'delivered',
-- 'bounced' and 'opened' exist for the day a real transactional provider is
-- dropped in behind the same sendEmail() interface — recording the ceiling
-- honestly rather than implying tracking the system does not have.
CREATE TABLE IF NOT EXISTS email_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  emailEventId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  invoiceId VARCHAR(50) NULL,
  customerId VARCHAR(50) NOT NULL,
  type ENUM('invoice_issued','reminder','overdue','suspension','reconnection','payment_received')
    NOT NULL,
  recipient VARCHAR(190) NOT NULL,
  subject VARCHAR(255) NULL,
  providerMsgId VARCHAR(128) NULL,
  providerStatus ENUM('queued','sent','delivered','bounced','opened','failed')
    NOT NULL DEFAULT 'queued',
  error TEXT NULL,
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  INDEX idx_email_events_invoice (invoiceId),
  INDEX idx_email_events_customer (customerId, type),
  CONSTRAINT fk_email_events_company  FOREIGN KEY (companyId)  REFERENCES companies(companyId),
  CONSTRAINT fk_email_events_customer FOREIGN KEY (customerId) REFERENCES customers(customerId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
