-- ============================================================================
-- 010 — Discovery: sweeping a device and staging what it reports
--
-- Migration stage S10 (docs/migration/03-final-migration-plan.md).
-- Same end state as database/schema.sql.
-- ============================================================================

-- ── Discovery runs ──────────────────────────────────────────────────────────
--
-- One sweep of one OLT.
--
-- Runs are kept rather than overwritten. "The modem was on the device in
-- August and gone in September" is a question about two runs, and it is exactly
-- the question asked when a customer says their connection vanished.
--
-- `status` separates a sweep that failed to reach the device from one that
-- reached it and found nothing. Those look identical in a summary count and
-- mean opposite things: the first is a broken sweep, the second is a genuinely
-- empty OLT.
CREATE TABLE IF NOT EXISTS discovery_runs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  discoveryRunId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  oltId VARCHAR(50) NOT NULL,
  status ENUM('running','completed','failed') NOT NULL DEFAULT 'running',
  -- The tallies, denormalised onto the run so a list of runs does not need a
  -- GROUP BY over every staged item.
  matchedCount INT NOT NULL DEFAULT 0,
  newCount INT NOT NULL DEFAULT 0,
  orphanedCount INT NOT NULL DEFAULT 0,
  -- The command actually sent and the device's verbatim reply, the same way
  -- network_action_logs keeps them. A sweep that returns nothing is a mystery
  -- without the raw output.
  command TEXT NULL,
  deviceResponse MEDIUMTEXT NULL,
  error TEXT NULL,
  durationMs INT NULL,
  triggeredBy VARCHAR(100) NULL,
  startedAt DATETIME NOT NULL,
  finishedAt DATETIME NULL,
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  INDEX idx_discovery_runs_olt (oltId, dateCreated),
  INDEX idx_discovery_runs_tenant (companyId, branchId, dateCreated),
  CONSTRAINT fk_discovery_runs_company FOREIGN KEY (companyId) REFERENCES companies(companyId),
  CONSTRAINT fk_discovery_runs_branch  FOREIGN KEY (branchId)  REFERENCES branches(branchId),
  CONSTRAINT fk_discovery_runs_olt     FOREIGN KEY (oltId)     REFERENCES olts(oltId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Discovered items ────────────────────────────────────────────────────────
--
-- One row per thing the sweep found, sorted into three buckets:
--
--   matched   on the device and already in our records — nothing to do
--   new       on the device, not in our records — a candidate to import
--   orphaned  in our records, not seen on the device — flagged, NEVER deleted
--
-- ── Why an orphan is only ever flagged ──────────────────────────────────────
--
-- The obvious next step from "this modem is gone" is to delete the row, and it
-- is wrong. An ONU disappears from a sweep for reasons that have nothing to do
-- with the customer: the fibre is cut, the modem is unplugged while they are on
-- holiday, the PON card is being replaced, the sweep read one port and not
-- another. Deleting on that evidence destroys a billable subscription's link to
-- its hardware over a temporary fault. So an orphan is a flag a person looks
-- at, and nothing else.
--
-- This table is a STAGING area. Nothing in it is live: importing an item is a
-- separate, deliberate, audited act that writes to `onus`.
CREATE TABLE IF NOT EXISTS discovered_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  discoveredItemId VARCHAR(50) NOT NULL UNIQUE,
  discoveryRunId VARCHAR(50) NOT NULL,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  -- 'olt' today. 'mikrotik' when a real RouterOS client exists — the reconciler
  -- already accepts its records, but nothing produces them yet.
  source ENUM('olt','mikrotik') NOT NULL DEFAULT 'olt',
  -- The device's own identifier: an ONU's MAC, or an account's username. What
  -- makes a run comparable to the one before it.
  externalKey VARCHAR(190) NOT NULL,
  matchStatus ENUM('matched','new','orphaned') NOT NULL,
  -- What it matched, when it matched. NULL for a genuinely new record.
  matchedEntity ENUM('onu','subscription') NULL,
  matchedId VARCHAR(50) NULL,
  -- The device record exactly as it was read.
  raw JSON NULL,
  -- Parsed hints for the import form: a name and NAP/port numbers pulled out of
  -- the previous operator's free-text description. Suggestions, never facts.
  suggested JSON NULL,
  importedAt DATETIME NULL,
  importedBy VARCHAR(50) NULL,
  dateCreated DATETIME NOT NULL,
  INDEX idx_discovered_items_run (discoveryRunId, matchStatus),
  INDEX idx_discovered_items_key (externalKey),
  INDEX idx_discovered_items_tenant (companyId, branchId),
  CONSTRAINT fk_discovered_items_run     FOREIGN KEY (discoveryRunId) REFERENCES discovery_runs(discoveryRunId),
  CONSTRAINT fk_discovered_items_company FOREIGN KEY (companyId)      REFERENCES companies(companyId),
  CONSTRAINT fk_discovered_items_branch  FOREIGN KEY (branchId)       REFERENCES branches(branchId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Permission ──────────────────────────────────────────────────────────────
--
-- Read sweeps a device and looks at the result; write creates real inventory
-- rows from what it found. Separate from `network/onus` because importing is
-- how a hundred modems arrive at once, and that is a different kind of mistake
-- from editing one.
INSERT INTO permissions (permissionId, module, submodule, description, portal, status, dateCreated, dateUpdated)
SELECT UUID(), 'network', 'discovery', 'Device discovery and import', 'ADMIN', 'Active',
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE module = 'network' AND submodule = 'discovery'
);

INSERT INTO role_permissions (roleId, permissionId, accessLevel, dateCreated)
SELECT r.roleId, p.permissionId, 'write', CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
FROM roles r
CROSS JOIN permissions p
WHERE r.roleName = 'Owner'
  AND p.module = 'network' AND p.submodule = 'discovery'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.roleId = r.roleId AND rp.permissionId = p.permissionId
  );
