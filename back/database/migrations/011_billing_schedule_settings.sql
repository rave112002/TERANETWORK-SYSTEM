-- ============================================================================
-- 011 — The billing schedule becomes configurable
--
-- Statement day, due day, the reminder lead time and the hours the jobs run at
-- were constants in code (`STATEMENT_DAY = 15`) or cron expressions in `.env`.
-- They are business rules an admin should be able to change without a deploy,
-- so they move into `system_settings` alongside GRACE_DAYS.
--
-- ── The real values, confirmed by the client 2026-09-10 ─────────────────────
--
--   period      the calendar month, 1st to last day
--   issued      the 25th          (was 15 in code — a genuine mismatch)
--   due         the 2nd of the following month
--   reminder    2 days before due, which lands on the last day of the month
--               every month: Sep 30, Oct 31, Feb 28
--   cut off     20:00 on the due date, no grace
--
-- ── The invariant these settings must not break ─────────────────────────────
--
-- STATEMENT_DAY must fall AFTER DUE_DAY + GRACE_DAYS. That ordering is what
-- makes "a suspended customer accrues nothing" fall out of the ordinary skip
-- rule: the cycle runs after the disconnection, so a suspended subscription is
-- simply passed over. Set the statement day to the 1st with a due day of the
-- 2nd and every reconnected customer is billed twice.
--
-- The settings validator enforces it. The comment is here because the database
-- outlives the validator.
-- ============================================================================

INSERT INTO system_settings (companyId, settingKey, settingValue, description, dateCreated, dateUpdated)
SELECT c.companyId, d.settingKey, d.settingValue, d.description,
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
FROM companies c
CROSS JOIN (
  SELECT 'STATEMENT_DAY' AS settingKey, '25' AS settingValue,
         'Day of the month invoices are issued' AS description
  UNION ALL SELECT 'DUE_DAY', '2',
         'Day of the following month payment falls due'
  UNION ALL SELECT 'REMINDER_DAYS_BEFORE', '2',
         'Days before the due date a reminder is sent'
  UNION ALL SELECT 'CYCLE_HOUR', '9',
         'Hour of day (0-23) the monthly billing run starts'
  UNION ALL SELECT 'DAILY_HOUR', '8',
         'Hour of day (0-23) overdue invoices are swept and reminders sent'
  UNION ALL SELECT 'DUNNING_HOUR', '20',
         'Hour of day (0-23) unpaid accounts are disconnected'
) AS d
WHERE c.status != 'Deleted'
  AND NOT EXISTS (
    SELECT 1 FROM system_settings ss
    WHERE ss.companyId = c.companyId AND ss.settingKey = d.settingKey
  );

-- ── Correct GRACE_DAYS to the client's actual rule ──────────────────────────
--
-- Due on the 2nd, cut off at 20:00 on the 2nd, is zero grace. The code's
-- fallback was 3, and because no settings row existed for this company the
-- system had been behaving as 3 — three days later than the business intends.
--
-- Guarded on the current value so a deliberate change made after this migration
-- was written is not silently reverted.
UPDATE system_settings
   SET settingValue = '0',
       description = 'Days after the due date before service is suspended (0 = same day)',
       dateUpdated = CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
 WHERE settingKey = 'GRACE_DAYS'
   AND settingValue IN ('3', '');
