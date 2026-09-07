-- ============================================================================
-- 006 — Device action log
--
-- Migration stage S6 (docs/migration/03-final-migration-plan.md).
-- Same end state as database/schema.sql.
-- ============================================================================

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

-- ── Permissions ─────────────────────────────────────────────────────────────
-- `provisioning` is write-only in spirit: it gates the buttons that suspend and
-- restore a customer's service. `action_logs` is the read side — deliberately a
-- separate permission, because someone auditing a disconnection does not need
-- the power to cause one.

INSERT INTO permissions (permissionId, module, submodule, description, portal, status, dateCreated, dateUpdated)
SELECT UUID(), 'network', sub.name, sub.description, 'ADMIN', 'Active',
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
FROM (
  SELECT 'provisioning' AS name, 'Activate and deactivate modems at the OLT' AS description
  UNION ALL SELECT 'action_logs', 'Device command history'
) AS sub
WHERE NOT EXISTS (
  SELECT 1 FROM permissions p WHERE p.module = 'network' AND p.submodule = sub.name
);

INSERT INTO role_permissions (roleId, permissionId, accessLevel, dateCreated)
SELECT r.roleId, p.permissionId, 'write', CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
FROM roles r
CROSS JOIN permissions p
WHERE r.roleName = 'Owner'
  AND p.module = 'network' AND p.submodule IN ('provisioning', 'action_logs')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.roleId = r.roleId AND rp.permissionId = p.permissionId
  );
