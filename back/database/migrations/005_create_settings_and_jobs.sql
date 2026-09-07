-- ============================================================================
-- 005 — Runtime settings + the durable jobs queue
--
-- Migration stage S5 (docs/migration/03-final-migration-plan.md).
-- Same end state as database/schema.sql.
-- ============================================================================

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

-- ── Permission ──────────────────────────────────────────────────────────────
-- One permission covers both the settings screen and the job queue view: they
-- are the same audience (whoever is allowed to flip the kill switch is who
-- needs to see what the worker is doing).

INSERT INTO permissions (permissionId, module, submodule, description, portal, status, dateCreated, dateUpdated)
SELECT UUID(), 'system', NULL, 'System settings and job queue', 'ADMIN', 'Active',
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE module = 'system' AND submodule IS NULL
);

INSERT INTO role_permissions (roleId, permissionId, accessLevel, dateCreated)
SELECT r.roleId, p.permissionId, 'write', CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
FROM roles r
CROSS JOIN permissions p
WHERE r.roleName = 'Owner'
  AND p.module = 'system' AND p.submodule IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.roleId = r.roleId AND rp.permissionId = p.permissionId
  );

-- ── Default settings for every existing company ─────────────────────────────
-- Seeded here rather than relied on as code defaults, so the values are visible
-- and editable in the UI from the first day rather than appearing only once
-- someone changes them.

INSERT INTO system_settings (companyId, settingKey, settingValue, description, dateCreated, dateUpdated)
SELECT c.companyId, d.settingKey, d.settingValue, d.description,
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
FROM companies c
CROSS JOIN (
  SELECT 'DRY_RUN' AS settingKey, 'false' AS settingValue,
         'Rehearse device commands without executing them' AS description
  UNION ALL SELECT 'GRACE_DAYS', '0',
         'Days after the due date before service is suspended'
  UNION ALL SELECT 'VAT_RATE', '0',
         'Tax rate applied to invoices, e.g. 0.12 for 12%'
  UNION ALL SELECT 'RECONNECTION_FEE_ENABLED', 'false',
         'Charge a fee when service is restored after suspension'
) AS d
WHERE c.status != 'Deleted'
  AND NOT EXISTS (
    SELECT 1 FROM system_settings ss
    WHERE ss.companyId = c.companyId AND ss.settingKey = d.settingKey
  );
