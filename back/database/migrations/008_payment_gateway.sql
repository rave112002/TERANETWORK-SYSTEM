-- ============================================================================
-- 008 — Payment gateway: provider-agnostic columns, attempts, webhook events
--
-- Migration stage S8 (docs/migration/03-final-migration-plan.md).
-- Same end state as database/schema.sql.
--
-- ── Why this un-names Xendit ────────────────────────────────────────────────
--
-- Migration 007 shipped `xenditPaymentId`, `xenditRef`, `xenditPaymentUrl` and
-- `xenditExpiresAt`. That assumed an answer the client has not given: Xendit was
-- the first choice, but they want to evaluate other Philippine gateways.
--
-- A column named after one vendor is a small lie that gets expensive. Either
-- the next provider's ids go in a column called `xendit…`, or somebody runs a
-- rename against live payment history. Both are worse than doing it now, while
-- these tables are empty.
-- ============================================================================

-- ── Invoices: drop the per-provider cache ───────────────────────────────────
--
-- The live payment link now lives in `payment_attempts` and nowhere else.
--
-- These four columns were a denormalised copy of the newest attempt, and a copy
-- is a second thing that can be wrong: an attempt expires, the gateway is
-- switched, a link is regenerated — and the invoice row still advertises the
-- old URL. One indexed read of the newest attempt is cheap, and it cannot
-- disagree with itself.
ALTER TABLE invoices
  DROP COLUMN xenditRef,
  DROP COLUMN xenditPaymentUrl,
  DROP COLUMN xenditExpiresAt;

-- ── Payments: name the provider, don't hardcode it ──────────────────────────
--
-- `providerPaymentId` keeps its unique index — it is the webhook idempotency
-- guard, and it stays NULL for cash and over-the-counter entries. `provider`
-- records which gateway a payment came through, so revenue stays attributable
-- after a switch and both gateways can run side by side during one.
ALTER TABLE payments
  CHANGE COLUMN xenditPaymentId providerPaymentId VARCHAR(64) NULL,
  ADD COLUMN provider VARCHAR(32) NULL AFTER channel;

-- ── Payment attempts ────────────────────────────────────────────────────────
--
-- One row per time we asked a gateway to collect an invoice.
--
-- Several attempts per invoice is normal, not exceptional: a link expires
-- before the customer pays, they abandon GCash and come back to try a card, or
-- the ISP changes provider mid-month. Keeping only the newest would throw away
-- the answer to "what did we actually send them, and when".
--
-- `UNIQUE(provider, providerRef)` is the create-idempotency guard. A retried
-- job or a double-clicked Pay button must not open two payment sessions for one
-- bill — a customer who pays both is owed a refund, which is a conversation
-- nobody wants to have.
CREATE TABLE IF NOT EXISTS payment_attempts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  paymentAttemptId VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,
  invoiceId VARCHAR(50) NOT NULL,
  -- 'mock', 'xendit', 'paymongo', 'dragonpay', … Deliberately a VARCHAR and
  -- not an ENUM: adding a gateway should be a new adapter file, not a schema
  -- migration on a table holding payment history.
  provider VARCHAR(32) NOT NULL,
  -- What we sent the gateway as our own reference — the invoice number. It is
  -- what comes back on the webhook and how the payment finds its invoice again.
  reference VARCHAR(64) NOT NULL,
  -- The gateway's id for this attempt. NULL only in the moment between
  -- inserting the row and the API answering.
  providerRef VARCHAR(128) NULL,
  amount DECIMAL(12,2) NOT NULL,
  paymentUrl VARCHAR(512) NULL,
  status ENUM('pending','paid','failed','expired','cancelled') NOT NULL DEFAULT 'pending',
  expiresAt DATETIME NULL,
  failureReason VARCHAR(255) NULL,
  -- The gateway's create response, verbatim. When a link misbehaves months
  -- later this is the only record of what it actually returned.
  rawResponse JSON NULL,
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  UNIQUE KEY uq_payment_attempts_ref (provider, providerRef),
  INDEX idx_payment_attempts_invoice (invoiceId, status),
  INDEX idx_payment_attempts_tenant (companyId, branchId, dateCreated),
  CONSTRAINT fk_payment_attempts_company FOREIGN KEY (companyId) REFERENCES companies(companyId),
  CONSTRAINT fk_payment_attempts_branch  FOREIGN KEY (branchId)  REFERENCES branches(branchId),
  CONSTRAINT fk_payment_attempts_invoice FOREIGN KEY (invoiceId) REFERENCES invoices(invoiceId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Webhook events ──────────────────────────────────────────────────────────
--
-- Every callback a gateway sends us, recorded before it is acted on.
--
-- `UNIQUE(provider, eventId)` is the replay guard, and it is an index rather
-- than a check-then-insert because gateways retry on any non-2xx and two
-- retries can arrive in the same millisecond. Only one can win a unique key.
--
-- The subtlety that makes this table work: a duplicate is NOT the same as
-- "already handled". If a previous attempt recorded the event and then crashed,
-- `processedAt` is still NULL and the gateway's retry must be allowed through —
-- otherwise the row written for safety permanently blocks the retry that would
-- have fixed it.
--
-- No tenant columns and no foreign keys: a callback can arrive for an invoice
-- that does not exist, from a provider we no longer use, or fail verification
-- entirely. All three still need recording. This is an operations log, and it
-- must be able to hold the evidence of things going wrong.
CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  webhookEventId VARCHAR(50) NOT NULL UNIQUE,
  provider VARCHAR(32) NOT NULL,
  -- The gateway's own event or payment id, whatever it gives us to deduplicate
  -- on. 190 chars so the composite unique key fits in utf8mb4.
  eventId VARCHAR(190) NOT NULL,
  eventType VARCHAR(80) NULL,
  -- Our invoice number as it came back, before it is resolved to an invoice.
  reference VARCHAR(64) NULL,
  invoiceId VARCHAR(50) NULL,
  -- Recorded, not enforced: a rejected callback is exactly the event worth
  -- keeping, because a run of them is either a misconfiguration or somebody
  -- probing the endpoint.
  signatureVerified TINYINT(1) NOT NULL DEFAULT 0,
  payload JSON NULL,
  processedAt DATETIME NULL,
  processError TEXT NULL,
  dateCreated DATETIME NOT NULL,
  UNIQUE KEY uq_webhook_events_event (provider, eventId),
  INDEX idx_webhook_events_unprocessed (processedAt, dateCreated),
  INDEX idx_webhook_events_reference (reference)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
