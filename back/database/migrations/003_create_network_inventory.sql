-- ============================================================================
-- 003 — Network inventory: OLTs, PON ports, splitters, NAPs, ONUs
--
-- Migration stage S3 (docs/migration/03-final-migration-plan.md).
-- Same end state as database/schema.sql. Created in FK order: every table
-- references only tables defined above it.
-- ============================================================================

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

-- ── Permissions ─────────────────────────────────────────────────────────────
-- One submodule per inventory type, all under the `network` module, so the
-- sidebar group and the API route group share a permission namespace.
-- `provisioning` covers the activate/deactivate actions that arrive in S6;
-- `topology` is the read-only tree and map.

INSERT INTO permissions (permissionId, module, submodule, description, portal, status, dateCreated, dateUpdated)
SELECT UUID(), 'network', sub.name, sub.description, 'ADMIN', 'Active',
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
FROM (
  SELECT 'olts'      AS name, 'OLT devices'              AS description
  UNION ALL SELECT 'pon_ports', 'PON ports'
  UNION ALL SELECT 'splitters', 'Optical splitters'
  UNION ALL SELECT 'naps',      'Network access points'
  UNION ALL SELECT 'onus',      'Subscriber modems (ONUs)'
  UNION ALL SELECT 'topology',  'Network topology and map'
) AS sub
WHERE NOT EXISTS (
  SELECT 1 FROM permissions p WHERE p.module = 'network' AND p.submodule = sub.name
);

-- Grant them to every existing Owner role, or a tenant's own owner cannot see
-- the pages that were just created.
INSERT INTO role_permissions (roleId, permissionId, accessLevel, dateCreated)
SELECT r.roleId, p.permissionId, 'write', CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
FROM roles r
CROSS JOIN permissions p
WHERE r.roleName = 'Owner'
  AND p.module = 'network'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.roleId = r.roleId AND rp.permissionId = p.permissionId
  );
