-- ============================================================================
-- 001 — Multi-branch user assignment + company profile fields
--
-- Migration stage S0 of the TERANETWORK migration (docs/migration/03-final-migration-plan.md).
--
-- TERANETWORK is a single company with several branches. A user works in one or
-- more of them, so `users.branchId` (one branch) is no longer sufficient as the
-- access boundary. It stays as the user's HOME branch — where records they
-- create are filed and their uploads are stored — while `user_branches` becomes
-- the authority on what they may read.
--
-- Idempotency: the runner applies schema.sql first, so on a database
-- provisioned from scratch these changes already exist. Every statement below
-- therefore checks before it acts.
-- ============================================================================

-- ── companies: profile fields rendered on invoices and emails ───────────────

SET @hasAddress := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'address'
);
SET @sql := IF(
  @hasAddress = 0,
  'ALTER TABLE companies ADD COLUMN address TEXT NULL AFTER logoUrl',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @hasTin := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'tin'
);
SET @sql := IF(
  @hasTin = 0,
  'ALTER TABLE companies ADD COLUMN tin VARCHAR(20) NULL AFTER address',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── user_branches ───────────────────────────────────────────────────────────

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

-- ── Backfill: every existing user gets their home branch as an assignment ───
--
-- Without this, a user who existed before this migration would have no rows in
-- user_branches and the `branchId IN (...)` predicate would match nothing —
-- locking them out of their own data. The NOT EXISTS guard makes a re-run a
-- no-op, and CONVERT_TZ pins the timestamp to Asia/Manila regardless of the
-- database server's own timezone.

INSERT INTO user_branches (userBranchId, accountId, branchId, status, dateCreated, dateUpdated)
SELECT
  UUID(),
  u.accountId,
  u.branchId,
  'Active',
  CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
  CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
FROM users u
WHERE u.status != 'Deleted'
  AND NOT EXISTS (
    SELECT 1 FROM user_branches ub
    WHERE ub.accountId = u.accountId AND ub.branchId = u.branchId
  );
