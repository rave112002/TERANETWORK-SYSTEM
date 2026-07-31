# Full-Stack Multi-Tenant Template

A production-style starter for multi-tenant admin platforms. It ships two portals out of the box —
a **SuperAdmin** portal that manages companies across the whole platform, and an **Admin**
portal scoped to a single company + branch — with role-based access control, an audit trail,
file uploads, and a hardened Express API.

The repository is a **monorepo of two independent apps**:

| Path               | App                         | Stack                                                                                          |
| ------------------ | --------------------------- | ---------------------------------------------------------------------------------------------- |
| [`front/`](front/) | React SPA (the two portals) | React 19 · Vite · shadcn/ui (Radix + Tailwind) · Tailwind CSS v4 · Zustand · TanStack Query · react-hook-form + zod · React Router v7 |
| [`back/`](back/)   | REST API server             | Node · Express · MySQL (`mysql2`) · Passport JWT · Zod                                         |

> Coding conventions live in the [`frontend-conventions`](.claude/skills/frontend-conventions/SKILL.md)
> and [`backend-conventions`](.claude/skills/backend-conventions/SKILL.md) skills — 14 topic docs
> that are the source of truth for the project's patterns. This README is the high-level map. See
> [Working with Claude Code](#working-with-claude-code).

---

## Table of contents

- [Architecture at a glance](#architecture-at-a-glance)
- [Core concepts](#core-concepts)
- [Repository structure](#repository-structure)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Backend](#backend)
- [Frontend](#frontend)
- [API overview](#api-overview)
- [Database schema](#database-schema)
- [Working with Claude Code](#working-with-claude-code)
- [Conventions & further reading](#conventions--further-reading)

---

## Architecture at a glance

```
                         ┌─────────────────────────────┐
   Browser               │  front/  (Vite SPA)         │
   ┌───────────────┐     │  /admin/*     Admin portal  │
   │ SuperAdmin UI │◀───▶│  /superadmin/* SuperAdmin   │
   │ Admin UI      │     │  Zustand · Query · shadcn/ui│
   └───────────────┘     └──────────────┬──────────────┘
                                         │  HTTPS + JWT (Bearer) + CSRF
                                         ▼
                         ┌─────────────────────────────┐
                         │  back/  (Express API)        │
                         │  /api/v1/admin/*             │
                         │  /api/v1/superadmin/*        │
                         │  /api/v1/upload/*            │
                         │  Passport JWT · RBAC · Zod   │
                         │  audit trail · rate limiting │
                         └──────────────┬──────────────┘
                                         │  mysql2 pool (req.db)
                                         ▼
                                ┌─────────────────┐
                                │   MySQL 8        │
                                │  14 tables       │
                                └─────────────────┘
```

- **Tenancy:** every Admin-portal query is scoped to the authenticated user's `companyId` / `branchId`.
  SuperAdmin operates across all companies.
- **Auth:** stateless JWT (RS256). The token carries a `userId`; the Passport strategy loads the full
  user (including `roleId`) onto `req.user` per request.
- **Authorization:** a `module / submodule / accessLevel` permission model, enforced on the backend by
  `checkPermission` middleware and mirrored on the frontend by `ProtectedRoute` + `usePermissions`.

---

## Core concepts

| Concept               | What it means                                                                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Two portals**       | `SuperAdmin` (platform owner — manages companies/branches/owners) and `Admin` (a company's own users, roles, settings).                                                                                  |
| **Multi-tenancy**     | Data isolation by `companyId` (company) + `branchId` (location). Admin endpoints filter by the values on `req.user`; never trust client-sent scope.                                                      |
| **RBAC**              | Permissions are `module` + optional `submodule` + `accessLevel` (`none < read < write`). Per-user overrides take precedence over role permissions.                                                          |
| **Business IDs**      | Every row has an internal `id BIGINT` (never exposed) and a `varchar(50)` business ID (`accountId`, `companyId`, `roleId`, …) used in all APIs, URLs, and foreign keys. Generated with MySQL `SELECT UUID()`. |
| **Soft deletes**      | Rows are never physically deleted — `status` is set to `'Deleted'` and queries filter `status != 'Deleted'`.                                                                                                |
| **Response envelope** | Every endpoint replies via `res.sendSuccess(message, data, status?)` → `{ success, message, data }`. The frontend unwraps `apiData.data.<entity>`.                                                          |
| **Audit trail**       | Middleware auto-logs successful `CREATE/UPDATE/DELETE`s (with sanitized metadata) on the audited admin routes; viewable in the Admin → Audit Trail page.                                                    |

---

## Repository structure

```
.
├── README.md                  ← you are here
├── CLAUDE.md                  ← project map for AI agents
├── .claude/skills/            ← Claude Code skills (checked in)
│   ├── frontend-conventions/  ← 8 frontend topic docs, loaded on demand
│   ├── backend-conventions/   ← 6 backend topic docs, loaded on demand
│   └── new-module/            ← scaffolds a CRUD module end to end
├── front/                     ← React SPA
│   ├── CLAUDE.md              ← stack + pointer to frontend-conventions
│   └── src/
│       ├── pages/             ← Admin/ and SuperAdmin/ portal modules
│       │   └── <Module>/      ← index.jsx (view) · hooks.jsx (logic) · components/
│       ├── components/        ← shared UI (PageHeader, StatCard, PaginationFooter,
│       │                        SectionLabel, StatusToggle, ProtectedRoute, layout, …)
│       ├── hooks/             ← usePermissions, useDebounce, …
│       ├── routes/            ← portal route trees + auth guards
│       ├── services/
│       │   ├── api/           ← raw axios calls (per portal/module)
│       │   └── requests/      ← TanStack Query hooks (mirror api/)
│       ├── store/             ← Zustand (authStore, themeStore)
│       └── index.css          ← Tailwind v4 + Modern design tokens (shadcn token bridge)
└── back/                      ← Express API
    ├── CLAUDE.md              ← stack + pointer to backend-conventions
    ├── .env.example
    ├── database/              ← schema.sql (the baseline) + migrations/ (empty until needed)
    ├── scripts/               ← keys / db:setup / db:reset / db:check
    ├── auth-keys/             ← RS256 JWT keypair (generate with `npm run keys`; gitignored)
    └── server/
        ├── bin/www.js         ← entrypoint (boot, health check, listen)
        ├── config/            ← express.js (middleware chain) · database.js (pool)
        └── src/
            ├── routes/        ← /api/v1/{admin,superadmin,upload} mounts
            ├── controllers/   ← v1/{admin,superadmin,auth,upload}/*.controller.js
            ├── middlewares/   ← passport JWT, checkPermission, auditTrail, csrf, rateLimiter, …
            ├── validators/    ← Zod schemas
            └── utils/         ← catchAsync, responses, dateUtils, hashing, file, …
```

---

## Getting started

### Prerequisites

- **Node.js** 18+ and **npm**
- **MySQL** 8 (a reachable database/schema)

### 1. Backend

```bash
cd back
npm install

# Configure environment
cp .env.example .env          # then edit DB_*, ISSUER, AUDIENCE, CSRF_SECRET, LOG_SALT, …

# Generate the RS256 JWT keypair referenced by .env (jwtAuthPrivatePath / jwtAuthPublicPath).
# Refuses to overwrite existing keys; pass --force to regenerate.
npm run keys

# Build the schema: applies the baseline + any pending migrations, then seeds the
# permission set and a default SuperAdmin. Additive and re-runnable — existing
# tables and data are left untouched, and seeds are skipped when already present.
npm run db:setup

npm run dev                   # nodemon on http://localhost:3000  (API under /api/v1)
```

**Required env vars** (see [`back/.env.example`](back/.env.example) for the full annotated list):

| Group    | Keys                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------- |
| App      | `NODE_ENV`, `PORT`                                                                              |
| Database | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_DATABASE` (+ optional `DB_POOL_SIZE`, timeouts) |
| JWT      | `jwtAuthPrivatePath`, `jwtAuthPublicPath`, `ISSUER`, `AUDIENCE`, `EXPIRY`                       |
| Security | `CSRF_SECRET`, `LOG_SALT`                                                                       |
| CORS     | `FRONTEND_URL`, `ALLOWED_ORIGINS` (comma-separated)                                             |

Rate-limiting, Redis, SendGrid, SSL, and file-validation knobs are all optional and documented in the
example file.

### 2. Frontend

```bash
cd front
npm install

cp .env.example .env          # set VITE_API_URL to the backend (default http://localhost:3000)

npm run dev                   # Vite dev server (http://localhost:5173)
```

Frontend env (`front/.env`): `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_APP_NAME`, `VITE_APP_ENV`,
`VITE_APP_VERSION`, `VITE_SENTRY_DSN`. Make sure the backend's `FRONTEND_URL` / `ALLOWED_ORIGINS`
include the Vite origin so CORS + CSRF allow it.

The Admin portal lives at `/admin/*` and the SuperAdmin portal at `/superadmin/*`.

### 3. Where to start

`npm run db:setup` seeds the permission set and a default SuperAdmin (the script prints the
login). Sign in to the **SuperAdmin portal** at `/superadmin` with:

- **Email:** `superadmin@template.com`
- **Password:** `superadmin123` _(change this before any real use)_

That SuperAdmin is the **only** account seeded — there is no sample company or Admin user. Follow
the chain below to create your first Admin login; each step unlocks the next:

1. **Create a company** — SuperAdmin → **Companies** → _New_. This creates the company (tenant).
   `POST /api/v1/superadmin/companies`
2. **Create a branch** under that company — SuperAdmin → **Branches**. This also auto-provisions
   an **Owner** role with full permissions for that company + branch.
   `POST /api/v1/superadmin/branches`
3. **Create a user** (the branch Owner) — SuperAdmin → **Users**. One Owner per branch; they receive
   the Owner role and login credentials.
   `POST /api/v1/superadmin/users`

That Owner can now sign in to the **Admin portal** at `/admin` and manage their own company's
users, roles, permissions, and settings.

---

## Scripts

### Backend (`back/`)

| Script                                                       | Action                                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `npm run dev`                                                | Start with nodemon (auto-reload)                                             |
| `npm start`                                                  | Start the server (`server/bin/www.js`)                                       |
| `npm run keys`                                               | Generate the RS256 JWT keypair into `auth-keys/` (`-- --force` to overwrite) |
| `npm run db:migrate`                                         | Apply the baseline + any pending migrations. Additive, safe                   |
| `npm run db:setup`                                           | Migrate, **then** seed permissions + SuperAdmin. Additive, re-runnable, safe  |
| `npm run db:setup:clean`                                     | ⚠️ **Drops all tables**, re-migrates from scratch, seeds permissions + SuperAdmin |
| `npm run db:reset`                                           | ⚠️ Nuclear: drops the whole **database** and recreates it empty (no tables)  |
| `npm run db:check`                                           | Verify DB connectivity / list tables + row counts (read-only, safe)          |
| `npm run lint` · `lint:fix`                                  | ESLint                                                                       |
| `npm run format` · `format:check`                            | Prettier                                                                     |
| `npm run pm2:start` · `pm2:prod` · `pm2:reload` · `pm2:stop` | PM2 process management ([`ecosystem.config.cjs`](back/ecosystem.config.cjs)) |

### Frontend (`front/`)

| Script                      | Action                       |
| --------------------------- | ---------------------------- |
| `npm run dev`               | Vite dev server              |
| `npm run build`             | Production build (`dist/`)   |
| `npm run build:analyze`     | Build with bundle analysis   |
| `npm run preview`           | Preview the production build |
| `npm run lint` · `lint:fix` | ESLint                       |

---

## Backend

### Request lifecycle

Configured in [`back/server/config/express.js`](back/server/config/express.js), middleware runs roughly in this order:

1. **Logging** (morgan → Winston) and a per-request **request ID** for tracing.
2. **Security headers** + **bot/empty-User-Agent blocking**.
3. Body parsing (`json`/`urlencoded`, 2 MB limit), cookies, **gzip compression**.
4. **Input sanitization** (XSS/injection) and static file serving under `/public`.
5. **Passport JWT** init; a response-wrapper that adds `res.sendSuccess` / `res.sendError`.
6. `req.db` (the shared `Database` pool) is attached, then the **API router** (`/api/...`).
7. CSRF error handler → global error handlers → final error formatter (4xx messages shown,
   5xx hidden in production; everything logged with masked sensitive fields).

### Data access — the `Database` class

[`back/server/config/database.js`](back/server/config/database.js) wraps a `mysql2/promise` pool (UTC, `utf8mb4`,
keep-alive, slow-query logging) and is injected as `req.db`:

- `req.db.query(sql, params)` → returns **rows directly** (pooled, no transaction).
- `req.db.beginTransaction()` → a connection; use `conn.execute(...)` (returns `[rows, fields]`), then
  `req.db.commit(conn)` / `req.db.rollback(conn)`. See [`db-patterns.md`](.claude/skills/backend-conventions/references/db-patterns.md).

### Auth & RBAC

- **Authentication** — [`passport.jwt.config.js`](back/server/src/middlewares/passport.jwt.config.js) verifies RS256
  tokens and loads the user (admin/staff _or_ superadmin) onto `req.user` (`accountId`, `companyId`,
  `branchId`, `roleId`, `type`, …).
- **Authorization** — `checkPermission(module, submodule?, accessLevel?)` resolves the user's effective
  level (user override → role permission), enforcing `GET = read`, `POST/PUT/DELETE = write`.
  SuperAdmin routes skip permission checks by design. See [`permission-gating.md`](.claude/skills/backend-conventions/references/permission-gating.md).

### Validation, uploads, audit

- **Validation** — Zod schemas applied via `validateBody` / `validateQuery` / `validateParams`
  ([`validators.md`](.claude/skills/backend-conventions/references/validators.md)).
- **Uploads** — stored under `public/uploads/{portal}/...`, tenant-scoped by `companyId`/`branchId`/`accountId`
  ([`file-uploads.md`](.claude/skills/backend-conventions/references/file-uploads.md)).
- **Audit trail** — [`auditTrail.middleware.js`](back/server/src/middlewares/auditTrail.middleware.js) intercepts
  successful state-changing responses on audited routes and writes a sanitized record to `audit_trail`.

---

## Frontend

- **Routing & portals** — [`routes/pageRoutes/AdminRoute.jsx`](front/src/routes/pageRoutes/AdminRoute.jsx) and
  `SuperAdminRoute.jsx` define each portal's routes + sidebar navigation. `<Auth>` / `<UnAuth>` guards
  gate access; `<ProtectedRoute module … accessLevel>` gates individual pages.
- **State** — Zustand for auth (`useAdminAuthStore`, `useSuperAdminAuthStore`, persisted to
  `localStorage`) and theme; **TanStack Query** for all server state. Tokens attach via an axios
  interceptor. See [`auth-state.md`](.claude/skills/frontend-conventions/references/auth-state.md).
- **Page module pattern** — each page is a folder: `index.jsx` (presentational), `hooks.jsx` (a single
  hook owning data, columns, filters, pagination, and actions), and `components/`. See
  [`hooks-pattern.md`](.claude/skills/frontend-conventions/references/hooks-pattern.md) and [`folder-structure.md`](.claude/skills/frontend-conventions/references/folder-structure.md).
- **Data layer** — `services/api/` holds raw axios calls; `services/requests/` holds the matching
  React Query hooks (list queries use `placeholderData: keepPreviousData` for smooth paging). See
  [`api-guide.md`](.claude/skills/frontend-conventions/references/api-guide.md).
- **UI system — "Modern"** — monochrome surfaces + hairline borders + one green accent used sparingly;
  structure comes from borders, not shadows, and the primary button is inverted monochrome (never the
  accent, never a gradient). Every color is a token in `src/index.css` (light/dark); type is **Onest**
  + **JetBrains Mono** (micro-data only), shadcn/ui components, Tailwind v4, `lucide-react` icons. The
  copy-paste spec is [`modern-module-pattern.md`](.claude/skills/frontend-conventions/references/modern-module-pattern.md) and
  `front/src/pages/Admin/UserManagement/Roles/` is the reference implementation. See
  [`ui-design-system.md`](.claude/skills/frontend-conventions/references/ui-design-system.md) and [`ui-form-design.md`](.claude/skills/frontend-conventions/references/ui-form-design.md).

---

## API overview

All routes are under `/api/v1`. Protected routes require `Authorization: Bearer <jwt>`; admin
resource routes additionally require the matching permission.

| Group                      | Base path                                       | Endpoints                                                                                             |
| -------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Auth (per portal)          | `/api/v1/admin/auth`, `/api/v1/superadmin/auth` | `GET /csrf-token` · `POST /login` · `POST /refresh` · `POST /logout` · `GET /me`                      |
| Admin · Users              | `/api/v1/admin/users`                           | `GET /` · `GET /:userId` · `POST /` · `PUT /:userId` · `DELETE /:userId`                              |
| Admin · Roles              | `/api/v1/admin/roles`                           | CRUD + `GET/POST /:roleId/permissions`                                                                |
| Admin · Permissions        | `/api/v1/admin/permissions`                     | `GET /` · `GET /modules` · `GET /user` · `POST /check`                                                |
| Admin · User permissions   | `/api/v1/admin/user-permissions`                | `GET /:accountId` · `POST /:accountId` · `POST /:accountId/bulk` · `DELETE /:accountId/:permissionId` |
| Admin · Audit trail        | `/api/v1/admin/audit-trail`                     | `GET /` (paginated + filterable)                                                                      |
| SuperAdmin · Companies | `/api/v1/superadmin/companies`              | CRUD (companies)                                                                                         |
| SuperAdmin · Branches      | `/api/v1/superadmin/branches`                   | CRUD (+ auto-creates an Owner role)                                                                   |
| SuperAdmin · Users         | `/api/v1/superadmin/users`                      | `GET /` · `POST /` (branch Owner)                                                                     |
| Uploads                    | `/api/v1/upload`                                | `POST /logo` · `POST /avatar` · `POST /image` · `DELETE /file`                                        |

List endpoints accept `page`, `pageSize`, `search`, `status`, and `sortBy` / `sortOrder` (where
applicable) and return `{ items, pagination }` inside the response envelope.

---

## Database schema

Full DDL: [`back/database/schema.sql`](back/database/schema.sql) — the baseline, applied by
`npm run db:migrate`. [`back/database/migrations/`](back/database/migrations/) is empty until you
need an incremental change on top of it. Fourteen tables:

| Table                   | Business ID        | Purpose                                             |
| ----------------------- | ------------------ | --------------------------------------------------- |
| `companies`             | `companyId`        | Company (the tenant)                                |
| `branches`              | `branchId`         | Physical location under a company                   |
| `superadmins`           | `accountId`        | Platform-level admins                               |
| `credentials`           | `accountId`        | Auth credentials (shared across portals via `type`) |
| `users`                 | `accountId`        | Admin/staff users (belong to a company + branch)    |
| `roles`                 | `roleId`           | Permission roles (scoped to company + branch)       |
| `permissions`           | `permissionId`     | Master permission definitions                       |
| `role_permissions`      | —                  | Maps roles → permissions                            |
| `user_permissions`      | `userPermissionId` | Per-user permission overrides                       |
| `refresh_tokens`        | `jti`              | Issued refresh tokens (rotation/revocation)         |
| `password_reset_tokens` | `tokenHash`        | Single-use forgot/reset-password tokens             |
| `settings`              | —                  | Key/value store scoped to a company + branch        |
| `audit_trail`           | `auditId`          | Activity log                                        |
| `idempotency_keys`      | `idempotencyKey`   | Cached responses for idempotent mutations           |

Every table has `id BIGINT AUTO_INCREMENT` (internal), `dateCreated` / `dateUpdated`
(`DATETIME`, Asia/Manila local), and — where applicable — a `status` enum used for soft deletes.
Foreign keys reference business IDs, not the numeric `id`.
See [`schema-conventions.md`](.claude/skills/backend-conventions/references/schema-conventions.md).

---

## Working with Claude Code

The project's conventions are packaged as three checked-in
[Claude Code](https://claude.com/claude-code) skills under [`.claude/skills/`](.claude/skills/),
so an agent loads only the docs a task actually needs instead of ~22k tokens of conventions in
every session. Clone the repo and they work — no setup.

| Skill | How it runs | Covers |
| ----- | ----------- | ------ |
| [`frontend-conventions`](.claude/skills/frontend-conventions/SKILL.md) | Automatic | Anything under `front/src` — code style, folder structure + route registration, the `hooks.jsx` contract, the API service layers, auth & permissions, the Modern design system, the Sheet form pattern. 8 topic docs. |
| [`backend-conventions`](.claude/skills/backend-conventions/SKILL.md)   | Automatic | Anything under `back/server` or `back/database` — `req.user` and tenant scoping, query/transaction patterns, schema & ID rules, validators, permission gating, upload paths. 6 topic docs. |
| [`new-module`](.claude/skills/new-module/SKILL.md)                     | `/new-module` | A whole CRUD module end to end. Drives the other two in the right order. |

### The two convention skills fire on their own

Just describe the work — Claude matches the task and reads only the relevant topic docs:

> Add a status filter to the Users table
>
> Why is the roles list returning 403 for a user with the right role?

You can also aim one at existing code: _"Use frontend-conventions to review
`src/pages/Admin/Inventory/hooks.jsx`."_

### `/new-module` scaffolds a vertical slice

It builds in dependency order — table + migration → permission row → validator → controller →
route wiring → `api/` + `requests/` services → `hooks.jsx` → form drawer → page → sidebar entry —
then runs lint and build.

```
/new-module Suppliers — fields: name (varchar 100, required), contactPerson (varchar 100,
optional), phone (optional), email (optional). Admin portal, permission `suppliers`, icon Truck.
```

It **stops and asks for the field list** if you don't give one — it won't guess your columns. It
also never runs `db:migrate` on its own; the migration waits until you say so. Partial work is
supported: _"just the backend for Suppliers"_, or _"add a `taxId` field to the existing Suppliers
module."_

### Adding a convention

Put the new topic doc in the relevant skill's `references/` as `kebab-case.md`, then add a row to
that skill's routing table in its `SKILL.md` — a doc that isn't in the table won't get read.
Cross-cutting facts that apply to both sides belong in [`CLAUDE.md`](CLAUDE.md) at the root.

---

## Conventions & further reading

The 14 topic docs behind those skills, if you want to read them directly. They're plain Markdown —
useful to a human even without an agent.

**Project map:** [`CLAUDE.md`](CLAUDE.md) (root) · [`front/CLAUDE.md`](front/CLAUDE.md) ·
[`back/CLAUDE.md`](back/CLAUDE.md)

### Frontend — [`.claude/skills/frontend-conventions/references/`](.claude/skills/frontend-conventions/references/)

| Doc | Covers |
| --- | ------ |
| [`code-conventions.md`](.claude/skills/frontend-conventions/references/code-conventions.md) | Naming, import order, the `@/` alias, mandated libraries, error handling, ESLint rules. Read first. |
| [`folder-structure.md`](.claude/skills/frontend-conventions/references/folder-structure.md) | Where pages/modules/components/services live, and how to register a route. |
| [`hooks-pattern.md`](.claude/skills/frontend-conventions/references/hooks-pattern.md) | The `hooks.jsx` contract every list page follows. |
| [`api-guide.md`](.claude/skills/frontend-conventions/references/api-guide.md) | `api/` + `requests/` layers, the response envelope, query keys & invalidation. |
| [`auth-state.md`](.claude/skills/frontend-conventions/references/auth-state.md) | Zustand auth stores, login/logout, `usePermissions`, `<ProtectedRoute>`. |
| [`ui-design-system.md`](.claude/skills/frontend-conventions/references/ui-design-system.md) | The Modern system — tokens, dark mode, list-page skeleton, table columns. |
| [`modern-module-pattern.md`](.claude/skills/frontend-conventions/references/modern-module-pattern.md) | The canonical copy-paste spec for a module's list page + drawer. |
| [`ui-form-design.md`](.claude/skills/frontend-conventions/references/ui-form-design.md) | The Sheet form pattern — react-hook-form + zod, the props contract. |

### Backend — [`.claude/skills/backend-conventions/references/`](.claude/skills/backend-conventions/references/)

| Doc | Covers |
| --- | ------ |
| [`auth-context.md`](.claude/skills/backend-conventions/references/auth-context.md) | `req.user` fields and the multi-tenant scoping rules. |
| [`db-patterns.md`](.claude/skills/backend-conventions/references/db-patterns.md) | `req.db.query` vs `conn.execute` return shapes, transactions, soft-delete filtering. |
| [`schema-conventions.md`](.claude/skills/backend-conventions/references/schema-conventions.md) | Table structure, business IDs, UUIDs, timestamps, phone columns, FKs, migrations. |
| [`validators.md`](.claude/skills/backend-conventions/references/validators.md) | Zod schemas, the `_helpers.js` optional-field wrappers, `optionalPhone()`. |
| [`permission-gating.md`](.claude/skills/backend-conventions/references/permission-gating.md) | One permission per route group, the access hierarchy, the Owner-role rules. |
| [`file-uploads.md`](.claude/skills/backend-conventions/references/file-uploads.md) | The portal-prefixed, tenant-scoped `public/uploads/` path convention. |
