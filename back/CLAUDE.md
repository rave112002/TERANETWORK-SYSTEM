# Backend — (Node + Express + MySQL)

Conventions for the multi-tenant API server. These are **non-negotiable** patterns — follow them
when creating or editing any controller, route, validator, migration, or upload handler. Each
section below is imported from `docs/`; read the relevant one before writing code in that area.

## Stack

Node + Express · MySQL via a custom `Database` class wrapping `mysql2/promise` (`server/config/database.js`,
injected as `req.db`) · Passport JWT auth · Zod validators · multi-tenant scoping by `companyId`/`branchId`.

## Convention docs

- **Authenticated user context** — `req.user` fields and the rules for multi-tenant scoping (never trust client-sent company/branch/account IDs).
  @docs/auth-context.md
- **Database query & transaction patterns** — `req.db.query` vs `conn.execute` return shapes, the transaction template, race-safe check-then-insert, soft-delete filtering.
  @docs/db-patterns.md
- **Schema & ID conventions** — table structure (`id` + business ID), UUIDs via `SELECT UUID()`, timestamps via `getCurrentTimestampLocal()`, soft deletes, FK references.
  @docs/schema-conventions.md
- **Validators** — every POST/PUT/PATCH gets a Zod schema applied via `validateBody`/`validateQuery`/`validateParams` middleware.
  @docs/validators.md
- **Permission gating** — one module/submodule permission per route group; GET = read, mutations = write; the Owner-role rules; SuperAdmin skips checks.
  @docs/permission-gating.md
- **File uploads** — the `public/uploads/{portal}/...` path convention and tenant-scoped folder structure.
  @docs/file-uploads.md
