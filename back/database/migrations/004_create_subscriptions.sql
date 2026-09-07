-- ============================================================================
-- 004 — Subscriptions: the customer + plan + ONU binding
--
-- Migration stage S4 (docs/migration/03-final-migration-plan.md).
-- Same end state as database/schema.sql. Depends on customers, plans and onus,
-- all created earlier.
-- ============================================================================

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

-- ── Permission ──────────────────────────────────────────────────────────────

INSERT INTO permissions (permissionId, module, submodule, description, portal, status, dateCreated, dateUpdated)
SELECT UUID(), 'subscriptions', NULL, 'Subscriptions management', 'ADMIN', 'Active',
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE module = 'subscriptions' AND submodule IS NULL
);

INSERT INTO role_permissions (roleId, permissionId, accessLevel, dateCreated)
SELECT r.roleId, p.permissionId, 'write', CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
FROM roles r
CROSS JOIN permissions p
WHERE r.roleName = 'Owner'
  AND p.module = 'subscriptions' AND p.submodule IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.roleId = r.roleId AND rp.permissionId = p.permissionId
  );
