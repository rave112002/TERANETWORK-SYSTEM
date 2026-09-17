-- ============================================================================
-- 015 — GCash statement check
--
-- Payments go to TERANETWORK's personal GCash account (docs/decisions.md D9).
-- Staff record each one by hand with its reference number, then upload the
-- account's transaction-history PDF to check those references against what
-- actually arrived. These two tables hold the result of reading that PDF —
-- never the PDF, never its password.
-- ============================================================================

-- ── GCash statements ────────────────────────────────────────────────────────
--
-- One row per transaction-history PDF staff uploaded to check recorded
-- payments against (docs/decisions.md D9, docs/payments.md).
--
-- The PDF itself is NOT kept, and neither is its password: the file is read in
-- memory and discarded. This row only records that a statement covering these
-- dates was checked, by whom, and how many incoming lines it held.
CREATE TABLE IF NOT EXISTS gcash_statements (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  statementId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  fileName VARCHAR(255) NULL,
  periodStart DATE NOT NULL,
  periodEnd DATE NOT NULL,
  -- Incoming lines in the file, and how many were not already known from an
  -- earlier, overlapping upload.
  creditCount INT NOT NULL DEFAULT 0,
  newCreditCount INT NOT NULL DEFAULT 0,
  uploadedBy VARCHAR(50) NULL,
  status ENUM('Active','Deleted') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  INDEX idx_gcash_statements_tenant (companyId, branchId, periodStart, periodEnd),
  CONSTRAINT fk_gcash_statements_company FOREIGN KEY (companyId) REFERENCES companies(companyId),
  CONSTRAINT fk_gcash_statements_branch  FOREIGN KEY (branchId)  REFERENCES branches(branchId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── GCash statement transactions ────────────────────────────────────────────
--
-- The INCOMING lines of uploaded statements. Money out is never a customer
-- payment, so it is not stored.
--
-- ── One row per reference, across uploads ───────────────────────────────────
--
-- UNIQUE (branchId, referenceNo): statements overlap (August, then 15 Aug–15
-- Sep), and the same transaction must be one line, not two. `referenceNo` is
-- stored normalised, the same way `payments.providerPaymentId` is, or the two
-- would never compare equal.
--
-- ── It is a personal account ────────────────────────────────────────────────
--
-- Some money in is not from a customer. `reviewStatus = 'not_customer'` is
-- staff saying so; it moves the line out of "in the file, not recorded".
CREATE TABLE IF NOT EXISTS gcash_statement_transactions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  transactionId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  -- The upload that brought this line in (the latest, if re-uploaded after a delete).
  statementId VARCHAR(50) NOT NULL,
  referenceNo VARCHAR(64) NOT NULL,
  transactedAt DATETIME NOT NULL,
  description VARCHAR(255) NULL,
  amount DECIMAL(12,2) NOT NULL,
  reviewStatus ENUM('open','not_customer') NOT NULL DEFAULT 'open',
  reviewedBy VARCHAR(50) NULL,
  reviewedAt DATETIME NULL,
  status ENUM('Active','Deleted') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  UNIQUE KEY uq_gcash_statement_transactions_ref (branchId, referenceNo),
  INDEX idx_gcash_statement_transactions_tenant (companyId, branchId, transactedAt),
  INDEX idx_gcash_statement_transactions_statement (statementId),
  CONSTRAINT fk_gcash_statement_transactions_company   FOREIGN KEY (companyId)   REFERENCES companies(companyId),
  CONSTRAINT fk_gcash_statement_transactions_branch    FOREIGN KEY (branchId)    REFERENCES branches(branchId),
  CONSTRAINT fk_gcash_statement_transactions_statement FOREIGN KEY (statementId) REFERENCES gcash_statements(statementId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
