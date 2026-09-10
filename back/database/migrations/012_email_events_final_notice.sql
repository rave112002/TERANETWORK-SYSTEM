-- ============================================================================
-- 012 — `final` becomes a kind of email the system can record
--
-- Migration 011 made the billing schedule configurable, and with it came a
-- third notice: the last warning, sent on the morning of the cut-off day. With
-- no grace period the previous two notices left a hole — nothing on the due
-- date, a disconnection at 20:00, and an "your invoice is past due" email the
-- following morning, after the fact.
--
-- ── Why this is a migration and not just application code ───────────────────
--
-- `email_events.type` is an ENUM. Sending a notice whose kind is not in it
-- fails on INSERT, and it fails at the worst possible moment: the row is
-- written AFTER the message is handed to the mail server. So the customer would
-- receive the email, the insert would throw, the job would retry, and they
-- would receive it again — up to five times before the job dead-lettered.
--
-- ── suspension and reconnection ─────────────────────────────────────────────
--
-- Those two values are in the ENUM already and nothing sends them yet. They are
-- kept: they are the notices to send when service actually goes off and comes
-- back, which is a gap worth leaving named.
-- ============================================================================

ALTER TABLE email_events
  MODIFY COLUMN type ENUM(
    'invoice_issued',
    'reminder',
    'final',
    'overdue',
    'suspension',
    'reconnection',
    'payment_received'
  ) NOT NULL;
