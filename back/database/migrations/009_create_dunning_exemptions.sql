-- ============================================================================
-- 009 — Dunning exemptions: the human override on automatic disconnection
--
-- Migration stage S9 (docs/migration/03-final-migration-plan.md).
-- Same end state as database/schema.sql.
-- ============================================================================

-- ── Dunning exemptions ──────────────────────────────────────────────────────
--
-- "Do not auto-disconnect this subscription until <date>, because <reason>."
--
-- This table exists for the situations no rule anticipates: a disputed bill, a
-- promise to pay on Friday, a barangay office on a 30-day purchase-order cycle,
-- a customer whose payment is provably in transit. Without it, staff work around
-- the system — by editing due dates, or by leaving the sweep switched off for
-- everyone because of one account.
--
-- ── Both NOT NULL, deliberately ─────────────────────────────────────────────
--
-- `reason` is required and must be more than a couple of characters, because
-- "why is this customer four months overdue and still connected?" has to have
-- an answer with a name attached. An exemption with a blank reason is
-- indistinguishable from a mistake.
--
-- `expiresAt` is required because an exemption with no end date is not an
-- exemption, it is a silent permanent discount that nobody revisits. Staff who
-- genuinely need longer can renew it — which puts the decision back in front of
-- a person on a schedule.
--
-- Rows are never deleted, only revoked. "This customer was shielded from
-- disconnection for six weeks last year, by whom, and why" is exactly the
-- question an audit asks.
CREATE TABLE IF NOT EXISTS dunning_exemptions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  exemptionId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  subscriptionId VARCHAR(50) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  expiresAt DATETIME NOT NULL,
  createdBy VARCHAR(50) NULL,
  revokedBy VARCHAR(50) NULL,
  revokedAt DATETIME NULL,
  revokeReason VARCHAR(255) NULL,
  status ENUM('Active','Revoked') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  -- The index the sweep's NOT EXISTS subquery rides on. It runs once per
  -- candidate row every night, so it must not be a table scan.
  INDEX idx_dunning_exemptions_live (subscriptionId, status, expiresAt),
  INDEX idx_dunning_exemptions_tenant (companyId, branchId, status),
  CONSTRAINT fk_dunning_exemptions_company      FOREIGN KEY (companyId)      REFERENCES companies(companyId),
  CONSTRAINT fk_dunning_exemptions_branch       FOREIGN KEY (branchId)       REFERENCES branches(branchId),
  CONSTRAINT fk_dunning_exemptions_subscription FOREIGN KEY (subscriptionId) REFERENCES subscriptions(subscriptionId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Permission ──────────────────────────────────────────────────────────────
--
-- Its own key, separate from `billing/invoices` and `billing/cycle`, because it
-- is a different power: read shows who is about to lose service, and write
-- decides who keeps it. A billing clerk who can raise an invoice should not
-- automatically be able to shield an account from disconnection indefinitely.
INSERT INTO permissions (permissionId, module, submodule, description, portal, status, dateCreated, dateUpdated)
SELECT UUID(), 'billing', 'dunning', 'Disconnection sweep and exemptions', 'ADMIN', 'Active',
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE module = 'billing' AND submodule = 'dunning'
);

INSERT INTO role_permissions (roleId, permissionId, accessLevel, dateCreated)
SELECT r.roleId, p.permissionId, 'write', CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
FROM roles r
CROSS JOIN permissions p
WHERE r.roleName = 'Owner'
  AND p.module = 'billing' AND p.submodule = 'dunning'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.roleId = r.roleId AND rp.permissionId = p.permissionId
  );
