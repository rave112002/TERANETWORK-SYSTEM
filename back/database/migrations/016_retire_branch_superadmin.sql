-- ============================================================================
-- 016 — Retire the in-branch SuperAdmin login
--
-- SuperAdmin is now one central app on the developer's PC that manages each
-- branch through its key-protected management API (docs/decisions.md D10).
-- The in-branch /superadmin portal and its API were removed, and db:setup no
-- longer creates a SuperAdmin account.
--
-- Every installation set up before this still has the account db:setup used to
-- create — with a password printed in the setup output and the source code.
-- Nothing can log in with it any more (the route is gone), but a login with a
-- known password should not stay switched on, in case a future change ever
-- mounts a SUPERADMIN login again. So it is deactivated here, not deleted:
-- rows are never deleted in this system.
--
-- Data only, no schema change: fresh installs never create these rows.
-- ============================================================================

UPDATE credentials
   SET status = 'Inactive'
 WHERE type = 'SUPERADMIN' AND status = 'Active';

UPDATE superadmins
   SET status = 'Inactive'
 WHERE status = 'Active';
