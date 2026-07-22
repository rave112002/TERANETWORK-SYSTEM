-- ============================================================================
-- 002 — Data-layer hardening
-- Composite indexes for the universal tenant query path, secondary indexes,
-- foreign keys on the tenant hierarchy + permission mappings, and removal of
-- the redundant credentials.salt column (Argon2 embeds the salt in the hash).
-- ============================================================================

-- Composite index for the universal filter: WHERE companyId = ? AND branchId = ?
-- AND status != 'Deleted'. (Single-column indexes below remain for the FKs.)
ALTER TABLE users   ADD INDEX idx_users_tenant   (companyId, branchId, status);
ALTER TABLE roles   ADD INDEX idx_roles_tenant   (companyId, branchId, status);
ALTER TABLE branches ADD INDEX idx_branches_tenant (companyId, status);

-- SuperAdmin company list filters by status / subscriptionPlan / name search.
ALTER TABLE companies ADD INDEX idx_companies_status (status);
ALTER TABLE companies ADD INDEX idx_companies_subscriptionPlan (subscriptionPlan);

-- Roles are constantly filtered by `roleName != 'Owner'` and looked up by name.
ALTER TABLE roles ADD INDEX idx_roles_roleName (roleName);

-- ── Foreign keys ────────────────────────────────────────────────────────────
-- On the tenant hierarchy and permission mappings. All reference the business
-- ID (a UNIQUE column), never the surrogate `id`. Default ON DELETE RESTRICT is
-- intentional: rows are soft-deleted (status = 'Deleted'), never physically
-- removed, so a RESTRICT never fires in normal operation but blocks accidental
-- hard deletes that would orphan children.
--
-- Deliberately NOT constrained (polymorphic or would force insert reordering):
--   credentials.accountId, superadmins.accountId, users.accountId → credentials
--     (accountId is shared across superadmins + users; profile row is inserted
--      before its credential row in the seed/controllers)
--   refresh_tokens.accountId (superadmin OR user)
--   audit_trail.companyId/branchId/accountId (audit rows must outlive their
--     referents; accountId is polymorphic)
ALTER TABLE branches
  ADD CONSTRAINT fk_branches_company FOREIGN KEY (companyId) REFERENCES companies(companyId);

ALTER TABLE roles
  ADD CONSTRAINT fk_roles_company FOREIGN KEY (companyId) REFERENCES companies(companyId),
  ADD CONSTRAINT fk_roles_branch  FOREIGN KEY (branchId)  REFERENCES branches(branchId);

ALTER TABLE users
  ADD CONSTRAINT fk_users_company FOREIGN KEY (companyId) REFERENCES companies(companyId),
  ADD CONSTRAINT fk_users_branch  FOREIGN KEY (branchId)  REFERENCES branches(branchId),
  ADD CONSTRAINT fk_users_role    FOREIGN KEY (roleId)    REFERENCES roles(roleId);

ALTER TABLE role_permissions
  ADD CONSTRAINT fk_rp_role       FOREIGN KEY (roleId)       REFERENCES roles(roleId),
  ADD CONSTRAINT fk_rp_permission FOREIGN KEY (permissionId) REFERENCES permissions(permissionId);

ALTER TABLE user_permissions
  ADD CONSTRAINT fk_up_user       FOREIGN KEY (accountId)    REFERENCES users(accountId),
  ADD CONSTRAINT fk_up_permission FOREIGN KEY (permissionId) REFERENCES permissions(permissionId);

-- ── Drop redundant salt column ──────────────────────────────────────────────
-- Argon2's encoded hash string already embeds the salt; the separate column was
-- never used for verification. See utils/hashing/argonHash.js.
ALTER TABLE credentials DROP COLUMN salt;
