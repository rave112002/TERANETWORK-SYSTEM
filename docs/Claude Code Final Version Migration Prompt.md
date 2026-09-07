# Final Version Migration & Development

We are building the **final deployable version** of the Tera Network Admin Billing System.

## Existing Projects

Old versions:

- `/OLD/TERANETWORK` — Version 1
- `/OLD/TERANETWORK-ADMIN-BILLING-SYSTEM` — Version 2

Target project:

- `/front` — Frontend
- `/back` — Backend

## Primary Documentation

First read:

`/OLD/TERANETWORK-ADMIN-BILLING-SYSTEM/docs`

Use this as the primary reference for understanding the system, requirements, modules, workflows, and intended architecture.

Before modifying either target project, read:

- `/front/CLAUDE.md`
- `/back/CLAUDE.md`

Follow those instructions throughout the entire process.

---

# Phased Migration Workflow

## Phase 1 — Understand

- Read all relevant documentation in `/docs`.
- Inspect **every file and folder** in both V1 and V2.
- Understand the architecture, features, database structure, APIs, components, services, and workflows.
- Do not modify `/front` or `/back` yet.

### Deliverable
Create a concise **System Understanding Report** containing:

- System purpose
- Main modules/features
- Frontend architecture
- Backend architecture
- Database structure
- Important workflows
- Key dependencies
- Important observations or risks

---

## Phase 2 — Audit & Compare

Compare V1 and V2.

- V2 is the primary source because it contains more complete progress.
- Check V1 for simpler, cleaner, or more efficient implementations.
- Identify what should be migrated, improved, discarded, or rebuilt.
- Identify missing, duplicated, obsolete, broken, or incomplete functionality.

Do **not** blindly copy either project.

### Deliverable
Create a **V1 vs V2 Audit** containing:

| Area | V1 | V2 | Final Decision | Reason |
|---|---|---|---|---|
| Architecture | | | | |
| Frontend | | | | |
| Backend | | | | |
| Database | | | | |
| Features | | | | |
| Configuration | | | | |

Also produce a list of:

- **Keep from V1**
- **Keep from V2**
- **Merge**
- **Rewrite**
- **Discard**
- **Missing / To Build**

---

## Phase 3 — Create Migration Plan

Before making major changes, create a migration plan covering:

- Frontend files/features to migrate
- Backend files/features to migrate
- Database/schema requirements
- Dependencies/configuration
- V1 features worth preserving
- V2 features worth preserving
- Missing functionality
- Required refactoring

Use the documentation and actual code as the source of truth.

### Deliverable
Create a **Final Migration Plan** with:

1. Migration order
2. Files/components/services to migrate
3. Files to rebuild instead of copy
4. Dependencies to install/remove
5. Database changes
6. Frontend/backend integration tasks
7. Remaining development tasks
8. Validation/testing requirements

**Do not begin major implementation until this plan is clear.**

---

## Phase 4 — Migrate

Gradually transfer the required code into:

- `/front`
- `/back`

Follow `/front/CLAUDE.md` and `/back/CLAUDE.md`.

Prefer clean, maintainable implementations over simply preserving old code.

Do not migrate:

- Unnecessary files
- Deprecated code
- Duplicate implementations
- Build artifacts
- Old configurations
- Unused dependencies

### Deliverable
A working `/front` and `/back` containing the selected and consolidated code from V1/V2.

Also maintain a **Migration Checklist** showing:

- Migrated items
- Rebuilt items
- Skipped items
- Items still pending
- Any migration decisions that require attention

---

## Phase 5 — Integrate & Fix

After migration:

- Resolve dependency conflicts.
- Fix imports and paths.
- Connect frontend and backend correctly.
- Verify API contracts.
- Verify database integration.
- Fix broken or incomplete functionality.
- Ensure authentication, authorization, billing, payments, notifications, and other documented workflows work together correctly.

### Deliverable
A **Functionally Integrated System** where the frontend, backend, database, and major documented workflows work together.

Provide a concise list of:

- Issues found
- Issues fixed
- Remaining issues
- Technical decisions made

---

## Phase 6 — Validate

Perform a thorough review of the resulting system.

Check for:

- Build/runtime errors
- Broken routes
- Broken API endpoints
- Database issues
- Missing environment variables
- Incorrect configurations
- Duplicate/unused code
- Security issues
- Inconsistent frontend/backend behavior
- Incomplete documented features

Fix issues you discover rather than simply reporting them when practical.

### Deliverable
Create a **Validation Report** containing:

- Build status
- Test status
- Frontend validation
- Backend validation
- Database validation
- API validation
- Security/configuration checks
- Documentation requirements completed
- Remaining problems

Do not mark the system production-ready while known critical issues remain.

---

## Phase 7 — Final Development

Once migration is stable, implement remaining functionality required by the documentation.

Improve the system where necessary, but **do not unnecessarily rewrite working code**.

The goal is a clean, scalable, maintainable, and production-ready system.

### Deliverable
A **Feature Completion Checklist** showing every documented requirement as:

- ✅ Complete
- ⚠️ Partially complete
- ❌ Missing
- 🚫 Not applicable

Implement all reasonable missing functionality before proceeding.

---

## Phase 8 — Final Production Review

Treat `/front` and `/back` as the **final production codebase**.

Before considering the work complete:

- Confirm documented requirements are implemented.
- Confirm V1/V2 useful functionality has been properly consolidated.
- Remove obsolete migration leftovers.
- Verify production configuration.
- Verify frontend/backend integration.
- Verify database and critical workflows.
- Ensure the project is ready for deployment.

### Deliverable

Create a final **Production Readiness Report** containing:

- Final architecture summary
- Completed features
- V1/V2 migration summary
- Test/validation results
- Known limitations
- Required environment/configuration
- Deployment prerequisites
- Final blockers, if any

Only consider the project complete when there are **no unresolved critical blockers**.

---

# Important Rules

**Do not start coding immediately.**

First understand the documentation and inspect both old versions.

**Do not blindly copy V2.**

V2 is the primary source, but V1 may contain better and simpler implementations.

**Do not rewrite everything.**

Preserve working functionality and improve only where necessary.

**Do not migrate blindly.**

Every migrated piece should have a purpose in the final system.

**Do not stop at migration.**

Continue through integration, validation, missing functionality, and production review.

**Do not treat this as another version.**

`/front` and `/back` are the **final production codebase**.

At the end of each phase, verify its deliverable before proceeding to the next phase.