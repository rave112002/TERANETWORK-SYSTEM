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
