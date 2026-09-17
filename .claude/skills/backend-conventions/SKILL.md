---
name: backend-conventions
description: The non-negotiable conventions for this repo's Node + Express + MySQL API (back/) — the authenticated req.user context and multi-tenant scoping, req.db query vs conn.execute return shapes and the transaction template, table/business-ID/UUID/timestamp schema rules and migrations, Zod validators and the _helpers.js optional-field wrappers, permission gating via checkPermission, and the tenant-scoped upload path convention. Load BEFORE writing or editing anything under back/server or back/database — any controller, route, validator, middleware, migration, schema change, or upload handler. Also load when reviewing backend code or answering how the API is structured.
---

# Backend conventions (`back/`)

Node + Express · MySQL via a custom `Database` class wrapping `mysql2/promise`
(`server/config/database.js`, injected as `req.db`) · Passport JWT · Zod validators ·
multi-tenant scoping by `companyId`/`branchId`.

**Production is one branch per installation** (decision D7 in `docs/migration/00-decisions.md`):
each database holds one company and one branch. Scope by `req.user.companyId` / `branchId`.
`branchScope()` and `user_branches` exist from an earlier multi-branch design — harmless, usable,
but never extend them into cross-branch features.

These rules are **non-negotiable** unless the user says otherwise. Reference implementation:
`server/src/controllers/v1/admin/roles.controller.js`.

## Read the doc for the area you're touching

Read it **before** writing code. A new endpoint typically needs auth-context + db-patterns +
validators + permission-gating; a schema change needs schema-conventions.

| Doc | Read it when |
| --- | --- |
| [auth-context.md](references/auth-context.md) | Any protected endpoint — the `req.user` fields and the multi-tenant scoping rules. |
| [db-patterns.md](references/db-patterns.md) | Any query. The `req.db.query` vs `conn.execute` return shapes, the transaction template, race-safe check-then-insert, soft-delete filtering. |
| [schema-conventions.md](references/schema-conventions.md) | Adding or changing a table/column — table structure, business IDs, `SELECT UUID()`, timestamps, phone columns, FKs, soft deletes, migrations. |
| [validators.md](references/validators.md) | Any POST/PUT/PATCH, or a GET with query filters. Schema naming, the `_helpers.js` wrappers, `optionalPhone()`. |
| [permission-gating.md](references/permission-gating.md) | Any route group — one module/submodule permission per group, GET = read / mutations = write, the Owner-role rules. |
| [file-uploads.md](references/file-uploads.md) | Anything writing to `public/uploads/` — the portal-prefixed, tenant-scoped path convention. |

## Rules that are violated most often

Load the relevant doc for the detail; these are the ones worth knowing cold.

- **Return shapes differ.** `req.db.query(...)` gives **rows directly**;
  `conn.execute(...)` gives **`[rows, fields]`** — always `const [rows] = …`. Mixing them silently
  hands you a `FieldPacket` where you expected a row.
- **Never `req.db.query` inside a transaction** — it takes a different connection and isn't part
  of it. Use `conn.execute`.
- **Transaction template:** `let conn;` *before* the `try` (or rollback hits a ReferenceError),
  `req.db.rollback(conn)` in the `catch`, `req.db.commit(conn)` before success, and **never** a
  manual `conn.release()` — commit and rollback both release.
- **Check-then-insert needs one transaction with `FOR UPDATE`**, or two concurrent requests both
  pass the check before either inserts.
- **Never trust client-sent `companyId` / `branchId` / `accountId`.** Scope from `req.user`.
  SuperAdmin has neither — don't assume they're present.
- **IDs come from MySQL** — `SELECT UUID()`, never `crypto.randomUUID()`, `uuidv4()`, or
  `role_${Date.now()}`. Generate inside the transaction with `conn.execute`.
- **Timestamps come from `getCurrentTimestampLocal()`** (Asia/Manila) — never `NOW()`,
  `new Date()`, or `moment()`. Set both `dateCreated` and `dateUpdated` on INSERT, and
  `dateUpdated` on every UPDATE.
- **Soft delete only.** `status = 'Deleted'`, never `DELETE FROM`. No status filter →
  `WHERE status != 'Deleted'`; an explicit `?status=Deleted` shows them.
- **Business IDs, not `id`.** The auto-increment `id` never leaves the database; FKs reference the
  business ID column.
- **Validation is middleware, never inline** — `validateBody`/`validateQuery`/`validateParams`
  before the handler, so a 400 returns before touching the database.
- **Optional fields need a `_helpers.js` wrapper.** Clients send `""` (HTML forms), `null` (JSON),
  or omit the key for the same "no value"; a bare `.optional().nullable()` rejects the `""`. Query
  filters use `queryEnum` / `queryEnumDefault` / `queryInt` or a cleared filter 400s the whole
  list. Every phone uses `optionalPhone()`, which also normalises to `09XX XXXX XXX` before the
  controller sees it — controllers never format a phone.
- **One permission per route group.** Sub-actions reuse the parent's. GET = `read`, mutations =
  `write`. Middleware order is `checkPermission` → `validate*` → `catchAsync`. SuperAdmin routes
  get no permission middleware.
- **Never invent a permission** that isn't in the `permissions` table.
- **Whitelist any interpolated sort column** — it isn't a bound parameter.
- **Every response goes through `res.sendSuccess(message, data, status)` / `res.sendError`.** Both
  accept a number in the second slot as the status code.
- **Schema changes are two edits:** `database/schema.sql` (the baseline, for fresh provisions)
  **and** a new numbered migration (for databases that already recorded the baseline). Never edit
  an applied migration.

## Related

- Building a whole new CRUD module? Use the **`new-module`** skill — it drives this one plus the
  frontend half in the right order.
- Frontend conventions live in the **`frontend-conventions`** skill.
- Cross-cutting facts (response envelope, business IDs, soft deletes, phone format) are in the
  repo-root `CLAUDE.md`.
