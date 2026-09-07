-- ============================================================================
-- 002 — ISP domain: counters, plans, customers (+ their ADMIN permissions)
--
-- Migration stage S2 (docs/migration/03-final-migration-plan.md).
-- Mirrors the same end state as database/schema.sql — the baseline covers
-- databases provisioned from scratch, this covers ones that already recorded
-- the baseline as applied.
--
-- MySQL DDL auto-commits per statement, so every statement here is written to
-- be safe on a re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS counters (
  name VARCHAR(64) PRIMARY KEY,
  nextValue BIGINT UNSIGNED NOT NULL DEFAULT 1,
  dateUpdated DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  installFee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  reconnectionFee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status ENUM('Active','Inactive','Deleted') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  INDEX idx_plans_companyId (companyId),
  INDEX idx_plans_tenant (companyId, status),
  CONSTRAINT fk_plans_company FOREIGN KEY (companyId) REFERENCES companies(companyId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  customerId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  accountNo VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NULL,
  address TEXT NULL,
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

-- ── Permissions ─────────────────────────────────────────────────────────────
-- A page whose permission row is missing is invisible to every non-Owner user
-- and its API returns 403. setup-database.js skips seeding entirely once the
-- permissions table is non-empty, which is why these also live here.

INSERT INTO permissions (permissionId, module, submodule, description, portal, status, dateCreated, dateUpdated)
SELECT UUID(), 'plans', NULL, 'Service plans management', 'ADMIN', 'Active',
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE module = 'plans' AND submodule IS NULL
);

INSERT INTO permissions (permissionId, module, submodule, description, portal, status, dateCreated, dateUpdated)
SELECT UUID(), 'customers', NULL, 'Subscribers management', 'ADMIN', 'Active',
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE module = 'customers' AND submodule IS NULL
);

-- Grant both to every existing Owner role, or a tenant's own owner cannot see
-- the pages that were just created.
INSERT INTO role_permissions (roleId, permissionId, accessLevel, dateCreated)
SELECT r.roleId, p.permissionId, 'write', CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
FROM roles r
CROSS JOIN permissions p
WHERE r.roleName = 'Owner'
  AND p.module IN ('plans', 'customers') AND p.submodule IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.roleId = r.roleId AND rp.permissionId = p.permissionId
  );
