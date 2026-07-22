-- ============================================================================
-- 001 — Baseline schema
-- The full table set as of the first migration. Uses CREATE TABLE IF NOT EXISTS
-- so it is a no-op on databases that already have these tables.
-- ============================================================================

CREATE TABLE IF NOT EXISTS companies (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  companyId VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  website VARCHAR(255) NULL,
  logoUrl VARCHAR(255) NULL,
  subscriptionPlan ENUM('Basic','Standard','Premium','Enterprise') NOT NULL,
  subscriptionStartDate DATE NULL,
  subscriptionEndDate DATE NULL,
  status ENUM('Active','Inactive','Suspended','Pending','Deleted') NOT NULL DEFAULT 'Pending',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL
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
  INDEX idx_branches_companyId (companyId)
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

CREATE TABLE IF NOT EXISTS credentials (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  accountId VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  salt VARCHAR(100) NOT NULL,
  type ENUM('SUPERADMIN','ADMIN','USER') NOT NULL,
  status ENUM('Active','Inactive','Suspended','Deleted') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cached responses for mutation requests carrying an Idempotency-Key header
-- (see middlewares/idempotency.middleware.js). Rows are immutable and TTL'd.
-- All DATETIME values in this table are Asia/Manila local.
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

-- Issued refresh tokens, keyed by the JWT's jti claim. Enables rotation
-- (every /refresh revokes the presented token), reuse detection, and logout
-- revocation. Stored as Asia/Manila local (converted from the token's UTC exp).
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
  INDEX idx_users_roleId (roleId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  INDEX idx_roles_branchId (branchId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  INDEX idx_role_permissions_permissionId (permissionId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_permissions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  userPermissionId VARCHAR(50) NOT NULL UNIQUE,
  accountId VARCHAR(50) NOT NULL,
  permissionId VARCHAR(50) NOT NULL,
  accessLevel ENUM('none','read','write') NOT NULL DEFAULT 'read',
  dateCreated DATETIME NOT NULL,
  INDEX idx_user_permissions_accountId (accountId),
  INDEX idx_user_permissions_permissionId (permissionId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
