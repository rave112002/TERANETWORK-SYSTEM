-- ============================================================================
-- 007 — Billing: invoices, lines, payments, pending charges, email events
--
-- Migration stage S7 (docs/migration/03-final-migration-plan.md).
-- Same end state as database/schema.sql. Depends on subscriptions, customers,
-- companies and branches, all created earlier.
--
-- Invoice numbers come from the shared `counters` table created in migration
-- 005, not a table of their own: it already allocates gap-free sequences
-- atomically, and one mechanism is easier to trust than two.
-- ============================================================================

-- ── Invoices ────────────────────────────────────────────────────────────────
--
-- One invoice per subscription per calendar month.
--
-- `uq_invoices_period (subscriptionId, billingPeriodStart)` is not an
-- optimisation. The cycle engine is a scheduled job, and scheduled jobs get run
-- twice — by a retry, by an operator, by two workers that both thought they
-- were alone. This key turns the second run into a no-op instead of a customer
-- billed twice, and the engine catches the duplicate-key error rather than
-- pre-checking and hoping.
CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  invoiceId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  subscriptionId VARCHAR(50) NOT NULL,
  customerId VARCHAR(50) NOT NULL,
  -- Human-readable and sequential: INV-2026-000123.
  invoiceNo VARCHAR(24) NOT NULL UNIQUE,
  billingPeriodStart DATE NOT NULL,
  billingPeriodEnd DATE NOT NULL,
  -- When it is issued (the 15th) and when payment is due (the 2nd of the next
  -- month). Both are business rules, not preferences — see lib/billing/billing.dates.js.
  statementDate DATE NOT NULL,
  dueDate DATE NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  fees DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tax DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(12,2) NOT NULL,
  amountPaid DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status ENUM('draft','issued','paid','overdue','void') NOT NULL DEFAULT 'draft',
  -- 128 bits of randomness. Every emailed link and QR encodes /pay/<token>,
  -- never a gateway URL — so the link keeps working after the gateway's own
  -- payment link expires, and a customer paying weeks late still lands
  -- somewhere useful.
  publicToken CHAR(32) NOT NULL UNIQUE,
  xenditRef VARCHAR(64) NULL UNIQUE,
  xenditPaymentUrl VARCHAR(512) NULL,
  xenditExpiresAt DATETIME NULL,
  pdfPath VARCHAR(255) NULL,
  issuedAt DATETIME NULL,
  paidAt DATETIME NULL,
  voidReason VARCHAR(255) NULL,
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  UNIQUE KEY uq_invoices_period (subscriptionId, billingPeriodStart),
  INDEX idx_invoices_customer (customerId),
  INDEX idx_invoices_due (status, dueDate),
  INDEX idx_invoices_tenant (companyId, branchId, status),
  CONSTRAINT fk_invoices_company      FOREIGN KEY (companyId)      REFERENCES companies(companyId),
  CONSTRAINT fk_invoices_branch       FOREIGN KEY (branchId)       REFERENCES branches(branchId),
  CONSTRAINT fk_invoices_subscription FOREIGN KEY (subscriptionId) REFERENCES subscriptions(subscriptionId),
  CONSTRAINT fk_invoices_customer     FOREIGN KEY (customerId)     REFERENCES customers(customerId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Invoice lines ───────────────────────────────────────────────────────────
--
-- Amounts are SIGNED: a credit is negative, which is how an outage credit
-- reduces a bill without needing a second mechanism.
CREATE TABLE IF NOT EXISTS invoice_lines (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  invoiceLineId VARCHAR(50) NOT NULL UNIQUE,
  invoiceId VARCHAR(50) NOT NULL,
  kind ENUM('plan','proration','install_fee','reconnection_fee','credit','debit','discount')
    NOT NULL,
  description VARCHAR(255) NOT NULL,
  qty DECIMAL(8,2) NOT NULL DEFAULT 1.00,
  unitPrice DECIMAL(12,2) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  sortOrder INT NOT NULL DEFAULT 0,
  dateCreated DATETIME NOT NULL,
  INDEX idx_invoice_lines_invoice (invoiceId, sortOrder),
  CONSTRAINT fk_invoice_lines_invoice FOREIGN KEY (invoiceId) REFERENCES invoices(invoiceId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Payments ────────────────────────────────────────────────────────────────
--
-- `uq_payments_xendit (xenditPaymentId)` is the webhook idempotency guard: the
-- gateway retries on any non-2xx, so the same payment WILL arrive more than
-- once. NULL for cash and over-the-counter entries, which is why it is a unique
-- index on a nullable column rather than a unique NOT NULL one.
--
-- Payments are never deleted. A mistaken entry is reversed by recording a
-- negative one, so the trail of what was believed and when survives.
CREATE TABLE IF NOT EXISTS payments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  paymentId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  invoiceId VARCHAR(50) NOT NULL,
  customerId VARCHAR(50) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  -- GCASH, MAYA, QRPH, CARD, CASH, BANK_TRANSFER…
  channel VARCHAR(40) NOT NULL,
  xenditPaymentId VARCHAR(64) NULL UNIQUE,
  -- Set for manual entries, so "who took this cash?" is answerable.
  recordedBy VARCHAR(50) NULL,
  paidAt DATETIME NOT NULL,
  -- The gateway's original payload, kept verbatim for dispute forensics.
  rawPayload JSON NULL,
  notes VARCHAR(255) NULL,
  dateCreated DATETIME NOT NULL,
  INDEX idx_payments_invoice (invoiceId),
  INDEX idx_payments_tenant (companyId, branchId, paidAt),
  CONSTRAINT fk_payments_company  FOREIGN KEY (companyId)  REFERENCES companies(companyId),
  CONSTRAINT fk_payments_branch   FOREIGN KEY (branchId)   REFERENCES branches(branchId),
  CONSTRAINT fk_payments_invoice  FOREIGN KEY (invoiceId)  REFERENCES invoices(invoiceId),
  CONSTRAINT fk_payments_customer FOREIGN KEY (customerId) REFERENCES customers(customerId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Pending charges ─────────────────────────────────────────────────────────
--
-- Amounts owed (or owing) that have no invoice to sit on yet: a reconnection
-- fee incurred on the 20th, a manual adjustment, and — when M18 lands — an
-- outage credit as a NEGATIVE amount.
--
-- `appliedInvoiceId IS NULL` is the idempotency guard. The cycle picks up
-- unapplied rows and stamps them inside the same transaction that creates the
-- invoice, so a re-run cannot bill one twice.
CREATE TABLE IF NOT EXISTS pending_charges (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  pendingChargeId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  customerId VARCHAR(50) NOT NULL,
  subscriptionId VARCHAR(50) NULL,
  kind ENUM('reconnection_fee','install_fee','credit','debit','discount') NOT NULL,
  description VARCHAR(255) NOT NULL,
  -- Signed: credits and discounts are negative.
  amount DECIMAL(12,2) NOT NULL,
  appliedInvoiceId VARCHAR(50) NULL,
  appliedAt DATETIME NULL,
  createdBy VARCHAR(50) NULL,
  status ENUM('Active','Deleted') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  INDEX idx_pending_charges_open (subscriptionId, appliedInvoiceId, status),
  INDEX idx_pending_charges_tenant (companyId, branchId),
  CONSTRAINT fk_pending_charges_company  FOREIGN KEY (companyId)  REFERENCES companies(companyId),
  CONSTRAINT fk_pending_charges_branch   FOREIGN KEY (branchId)   REFERENCES branches(branchId),
  CONSTRAINT fk_pending_charges_customer FOREIGN KEY (customerId) REFERENCES customers(customerId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Email events ────────────────────────────────────────────────────────────
--
-- One row per email the system tried to send.
--
-- With plain SMTP there are no delivery webhooks, so `providerStatus`
-- realistically reaches 'sent' or 'failed' and no further. 'delivered',
-- 'bounced' and 'opened' exist for the day a real transactional provider is
-- dropped in behind the same sendEmail() interface — recording the ceiling
-- honestly rather than implying tracking the system does not have.
CREATE TABLE IF NOT EXISTS email_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  emailEventId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  invoiceId VARCHAR(50) NULL,
  customerId VARCHAR(50) NOT NULL,
  type ENUM('invoice_issued','reminder','overdue','suspension','reconnection','payment_received')
    NOT NULL,
  recipient VARCHAR(190) NOT NULL,
  subject VARCHAR(255) NULL,
  providerMsgId VARCHAR(128) NULL,
  providerStatus ENUM('queued','sent','delivered','bounced','opened','failed')
    NOT NULL DEFAULT 'queued',
  error TEXT NULL,
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  INDEX idx_email_events_invoice (invoiceId),
  INDEX idx_email_events_customer (customerId, type),
  CONSTRAINT fk_email_events_company  FOREIGN KEY (companyId)  REFERENCES companies(companyId),
  CONSTRAINT fk_email_events_customer FOREIGN KEY (customerId) REFERENCES customers(customerId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Permissions ─────────────────────────────────────────────────────────────
--
-- Four separate keys because they are four separate powers. Reading a ledger,
-- marking money received, writing off a charge, and billing every customer at
-- once are not the same job, and a billing clerk who can do the first two
-- should not automatically be able to do the last two.
INSERT INTO permissions (permissionId, module, submodule, description, portal, status, dateCreated, dateUpdated)
SELECT UUID(), 'billing', 'invoices', 'Invoices — view, issue, void', 'ADMIN', 'Active',
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE module = 'billing' AND submodule = 'invoices'
);

INSERT INTO permissions (permissionId, module, submodule, description, portal, status, dateCreated, dateUpdated)
SELECT UUID(), 'billing', 'payments', 'Payments — record and reverse', 'ADMIN', 'Active',
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE module = 'billing' AND submodule = 'payments'
);

INSERT INTO permissions (permissionId, module, submodule, description, portal, status, dateCreated, dateUpdated)
SELECT UUID(), 'billing', 'adjustments', 'Credits, discounts and one-off charges', 'ADMIN', 'Active',
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE module = 'billing' AND submodule = 'adjustments'
);

INSERT INTO permissions (permissionId, module, submodule, description, portal, status, dateCreated, dateUpdated)
SELECT UUID(), 'billing', 'cycle', 'Run the monthly billing cycle', 'ADMIN', 'Active',
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE module = 'billing' AND submodule = 'cycle'
);

INSERT INTO role_permissions (roleId, permissionId, accessLevel, dateCreated)
SELECT r.roleId, p.permissionId, 'write', CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
FROM roles r
CROSS JOIN permissions p
WHERE r.roleName = 'Owner'
  AND p.module = 'billing'
  AND p.submodule IN ('invoices', 'payments', 'adjustments', 'cycle')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.roleId = r.roleId AND rp.permissionId = p.permissionId
  );
