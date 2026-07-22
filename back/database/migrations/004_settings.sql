-- ============================================================================
-- 004 — Tenant settings
-- A generic key/value settings store scoped to a company + branch. One row per
-- (companyId, branchId, settingKey). Values are stored as text (JSON-encoded by
-- the controller when needed). All DATETIME values are Asia/Manila local.
-- ============================================================================

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
