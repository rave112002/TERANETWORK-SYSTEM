-- ============================================================================
-- 005 — companies.phone
-- The Create/Edit Company form has always collected a phone number, the list
-- mapped `org.phone` and ViewCompanyModal rendered it — but the column never
-- existed, so the value was silently discarded on every save. Add it, matching
-- the phone column on branches/users/superadmins.
--
-- Stored in the canonical format `09XX XXXX XXX` (see the repo-root CLAUDE.md).
-- ============================================================================

ALTER TABLE companies ADD COLUMN phone VARCHAR(20) NULL AFTER email;
