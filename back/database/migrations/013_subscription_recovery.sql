-- ============================================================================
-- 013 — Revocation and modem recovery
--
-- A customer who stops paying is suspended the evening their invoice falls due.
-- Until now there was nothing after that: the subscription sat 'suspended'
-- forever, the modem stayed on their wall, and the NAP port stayed occupied by
-- a connection nobody was paying for.
--
-- The client's rule, confirmed 2026-09-10:
--
--   60 days suspended  →  staff confirm  →  technician pulls the modem out
--
-- ── Why 'for_recovery' is a status and not a reason on 'terminated' ─────────
--
-- The tempting shortcut is `status = 'terminated'` plus a `reason` column. It
-- is wrong, because the two states differ in what the system is allowed to do:
--
--   for_recovery   the modem is still on the customer's wall, the NAP port is
--                  still occupied, and there is field work outstanding
--   terminated     nothing of ours is at that address any more
--
-- Every query that asks "is this port free?" or "what does the technician have
-- left to collect?" needs to tell those apart. A reason column cannot be
-- indexed into that answer without every caller remembering to check it, and
-- the one that forgets hands a NAP port to two customers at once.
--
-- ── The three timestamps ────────────────────────────────────────────────────
--
-- suspendedAt     starts the 60-day clock. The client counts from the
--                 disconnection, not from the last payment or the due date.
-- forRecoveryAt   when staff confirmed the pull-out. Ages the technician queue,
--                 so a job nobody has done in three weeks is visible as such.
-- terminatedAt    already existed; now also set when a recovery closes.
--
-- ── Why the outcome is recorded ─────────────────────────────────────────────
--
-- A modem that came back goes into stock and can serve someone else. One that
-- did not is out in the world on somebody's shelf, and must stay blacklisted at
-- the OLT so it cannot be plugged in and used. Those are opposite handling, so
-- "did we get it back?" has to be an answer the system holds rather than
-- something in a technician's head.
-- ============================================================================

ALTER TABLE subscriptions
  MODIFY COLUMN status
    ENUM('pending','active','suspended','for_recovery','terminated')
    NOT NULL DEFAULT 'pending';

ALTER TABLE subscriptions
  ADD COLUMN suspendedAt DATETIME NULL AFTER activatedAt,
  ADD COLUMN forRecoveryAt DATETIME NULL AFTER suspendedAt,
  ADD COLUMN recoveryOutcome ENUM('recovered','not_recovered') NULL AFTER forRecoveryAt;

-- The recovery queue is read by "suspended longest first", and the eligibility
-- query filters on status and suspendedAt together.
CREATE INDEX idx_subscriptions_recovery ON subscriptions (status, suspendedAt);

-- ── Backfill ────────────────────────────────────────────────────────────────
--
-- Anything already suspended has no suspendedAt, and a NULL there means the
-- 60-day clock never starts — the account would sit suspended forever, which is
-- the exact problem this migration exists to end.
--
-- `dateUpdated` is the best available approximation: for a suspended row the
-- last write was almost always the suspension itself, because nothing else
-- touches a cut-off subscription. It is an approximation and it is stated as
-- one; it is applied now, before the client's data is imported, so the only
-- rows it can touch are test rows.
UPDATE subscriptions
   SET suspendedAt = dateUpdated
 WHERE status = 'suspended' AND suspendedAt IS NULL;

-- ── How long before a pull-out is suggested ─────────────────────────────────
--
-- 60 days is the client's rule today. It sits in settings rather than in code
-- for the same reason the billing schedule does: it is a business decision, and
-- changing it should not need a deploy. Nothing happens automatically when the
-- clock runs out — the account joins a list a person reviews.
INSERT INTO system_settings (companyId, settingKey, settingValue, description, dateCreated, dateUpdated)
SELECT c.companyId, 'RECOVERY_AFTER_DAYS', '60',
       'Days suspended before an account is suggested for modem pull-out',
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
FROM companies c
WHERE c.status != 'Deleted'
  AND NOT EXISTS (
    SELECT 1 FROM system_settings ss
    WHERE ss.companyId = c.companyId AND ss.settingKey = 'RECOVERY_AFTER_DAYS'
  );
