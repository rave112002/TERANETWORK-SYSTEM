# TERANETWORK System

Billing and network administration for **TERANETWORK**, an internet provider: subscribers and
subscriptions, the fibre plant (OLTs, NAPs, ONUs), monthly invoicing, GCash payments with a
statement check, and automatic disconnection and reconnection.

> **Where the project stands:** [docs/STATUS.md](docs/STATUS.md) (one page, kept current).
> **Why things are the way they are:** [docs/decisions.md](docs/decisions.md).
> **How it is deployed:** [docs/isp-invoice-generator-deployment-multibranch.md](docs/isp-invoice-generator-deployment-multibranch.md).

Built on an internal multi-tenant template; the coding conventions live in the
[`frontend-conventions`](.claude/skills/frontend-conventions/SKILL.md) and
[`backend-conventions`](.claude/skills/backend-conventions/SKILL.md) skills. This README is the
high-level map. See [Working with Claude Code](#working-with-claude-code).

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

**Every branch is its own installation**: its own Windows PC, Express server and MySQL database
([D7](docs/decisions.md#d7--one-branch-per-installation)). **One central SuperAdmin**, on the
developer's PC, manages every branch over Tailscale through each branch's key-protected
management API ([D10](docs/decisions.md#d10--one-central-superadmin-over-tailscale)).

```
DEVELOPER PC                                     BRANCH PC (one per branch)
┌─────────────────────────────┐                  ┌──────────────────────────────┐
│ SuperAdmin web app          │                  │ Admin portal (front, /admin) │
│  (front: build:superadmin)  │                  │        │ JWT + CSRF          │
│        │                    │    Tailscale     │        ▼                     │
│ superadmin-server/          │ ───────────────▶ │ back/  /api/v1/admin/*       │
│  Express + SQLite           │  x-manage-key    │        /api/v1/manage/*      │
│  (logins, branch list)      │                  │        │                     │
└─────────────────────────────┘                  │        ▼                     │
                                                 │     MySQL (branch data)      │
                                                 └──────────────────────────────┘
```

- **Branch app:** staff (Owner, Admin, Billing, Technician) use the Admin portal. Every query is
  scoped to the user's `companyId` / `branchId`; an installation holds exactly one of each.
- **Central SuperAdmin:** branch health, company profile, Owner/Admin logins and system settings,
  one branch at a time. It never touches a branch database and holds no business data. See
  [superadmin-server/README.md](superadmin-server/README.md).
- **Auth:** stateless JWT (RS256) for the Admin portal; a per-branch `MANAGE_API_KEY` for the
  management API; the SuperAdmin app has its own login.
- **Authorization:** a `module / submodule / accessLevel` permission model, enforced on the backend by
  `checkPermission` middleware and mirrored on the frontend by `ProtectedRoute` + `usePermissions`.

---

## Core concepts

| Concept | What it means |
| --- | --- |
| **Branch = installation** | One server + one database per branch. No central business database; branches never share data. |
| **Central SuperAdmin** | One app on the developer's PC (`front` SuperAdmin build + `superadmin-server/`). Talks to branches only through `/api/v1/manage/*`; the contract is in `shared/manage-contract/`. |
| **Scoping** | Admin endpoints filter by `companyId` + `branchId` from `req.user`; never trust client-sent scope. |
| **RBAC** | Permissions are `module` + optional `submodule` + `accessLevel` (`none < read < write`). Per-user overrides take precedence over role permissions. |
| **Business IDs** | Every row has an internal `id BIGINT` (never exposed) and a `varchar(50)` business ID (`accountId`, `companyId`, `roleId`, …) used in all APIs, URLs and foreign keys. Generated with MySQL `SELECT UUID()`. |
| **Soft deletes** | Rows are never physically deleted: `status` is set to `'Deleted'` and queries filter `status != 'Deleted'`. |
| **Response envelope** | Every endpoint replies via `res.sendSuccess(message, data, status?)` → `{ success, message, data }`. The frontend unwraps `apiData.data.<entity>`. |
| **Audit trail** | Every change is audited. Changes made from SuperAdmin are recorded on the branch as `system:superadmin:<username>`. |

---

## Repository structure

```
.
├── README.md                  ← you are here
├── CLAUDE.md                  ← project map for AI agents
├── docs/                      ← STATUS.md, decisions.md, payments.md, runbooks.md, archive/
├── .claude/skills/            ← Claude Code skills (checked in)
├── shared/manage-contract/    ← the management API's version and shapes (back/ and superadmin-server/)
├── superadmin-server/         ← central SuperAdmin server (Express + built-in SQLite), developer PC only
├── front/                     ← React SPA, two builds
│   └── src/
│       ├── pages/Admin/              ← the branch app's Admin portal
│       ├── pages/SuperAdminConsole/  ← the central SuperAdmin app (SuperAdmin build only)
│       ├── routes/                   ← index.jsx (branch) · superadmin.jsx (SuperAdmin build)
│       ├── services/api/, requests/  ← axios calls + TanStack Query hooks (admin/, superadmin-console/)
│       └── components/, hooks/, store/, index.css
└── back/                      ← branch API server
    ├── database/              ← schema.sql (baseline) + numbered migrations/
    ├── scripts/               ← keys / db:setup / db:migrate / gcash:inspect / …
    └── server/src/
        ├── routes/            ← /api/v1/{admin,manage,public,upload} mounts
        ├── controllers/       ← v1/{admin,manage,auth,public,upload}/*.controller.js
        ├── lib/               ← billing, payments, dunning, jobs, OLT drivers, manage/, settings/, …
        ├── middlewares/       ← passport JWT, checkPermission, requireManageKey, auditTrail, csrf, …
        ├── validators/        ← Zod schemas
        └── utils/
```

---

## Getting started

### Prerequisites

- **Node.js** 22.13+ and **npm**
- **MySQL** 8

### 1. A branch (backend + Admin portal)

```bash
cd back
npm install
cp .env.example .env          # DB_*, ISSUER, AUDIENCE, CSRF_SECRET, LOG_SALT, COMPANY_EMAIL, BRANCH_NAME, …
npm run keys                  # RS256 JWT keypair (refuses to overwrite; --force to regenerate)
npm run db:setup              # migrations + permissions + the company, this branch and its roles
npm run dev                   # http://localhost:3000  (API under /api/v1)

cd ../front
npm install
cp .env.example .env          # VITE_API_URL → the backend
npm run dev                   # http://localhost:5173/admin
```

`db:setup` creates **no login**. The branch's first Owner login comes from the central SuperAdmin
(the setup output repeats these steps):

1. Put a random key (32+ characters) in `back/.env` as `MANAGE_API_KEY` and restart the server.
2. In the central SuperAdmin: **Branches → Add branch** with this server's address and that key.
3. **Users → Add login → Owner.** That Owner then signs in to the Admin portal at `/admin`.

### 2. The central SuperAdmin (developer PC only)

```bash
cd superadmin-server
npm install
cp .env.example .env          # SUPERADMIN_SECRET
npm run user -- --username <you>
cd ../front && npm run build:superadmin
cd ../superadmin-server && npm start     # http://127.0.0.1:8788
```

Details: [superadmin-server/README.md](superadmin-server/README.md).

---

## Scripts

### Backend (`back/`)

| Script                                                       | Action                                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `npm run dev`                                                | Start with nodemon (auto-reload)                                             |
| `npm start`                                                  | Start the server (`server/bin/www.js`)                                       |
| `npm run keys`                                               | Generate the RS256 JWT keypair into `auth-keys/` (`-- --force` to overwrite) |
| `npm run db:migrate`                                         | Apply the baseline + any pending migrations. Additive, safe                   |
| `npm run db:setup`                                           | Migrate, **then** seed permissions, the company, this branch and its roles. Additive, re-runnable, safe |
| `npm run db:setup:clean`                                     | ⚠️ **Drops all tables**, re-migrates from scratch, then seeds as `db:setup`   |
| `npm run db:reset`                                           | ⚠️ Nuclear: drops the whole **database** and recreates it empty (no tables)  |
| `npm run db:check`                                           | Verify DB connectivity / list tables + row counts (read-only, safe)          |
| `npm run lint` · `lint:fix`                                  | ESLint                                                                       |
| `npm run format` · `format:check`                            | Prettier                                                                     |
| `npm run pm2:start` · `pm2:prod` · `pm2:reload` · `pm2:stop` | PM2 process management ([`ecosystem.config.cjs`](back/ecosystem.config.cjs)) |

### Frontend (`front/`)

| Script                      | Action                       |
| --------------------------- | ---------------------------- |
| `npm run dev`               | Vite dev server              |
| `npm run build`             | Branch app build (`dist/`), checked to contain no SuperAdmin code |
| `npm run build:superadmin`  | Central SuperAdmin build (`dist-superadmin/`) |
| `npm run dev:superadmin`    | SuperAdmin dev server (proxies `/api` to superadmin-server) |
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
  tokens and loads the admin/staff user onto `req.user` (`accountId`, `companyId`,
  `branchId`, `roleId`, `type`, …).
- **Authorization** — `checkPermission(module, submodule?, accessLevel?)` resolves the user's effective
  level (user override → role permission), enforcing `GET = read`, `POST/PUT/DELETE = write`.
- **Management API** — `/api/v1/manage/*`, for the central SuperAdmin only, gated by
  `requireManageKey` (the branch's `MANAGE_API_KEY`) instead of a user session. See [`permission-gating.md`](.claude/skills/backend-conventions/references/permission-gating.md).

### Validation, uploads, audit

- **Validation** — Zod schemas applied via `validateBody` / `validateQuery` / `validateParams`
  ([`validators.md`](.claude/skills/backend-conventions/references/validators.md)).
- **Uploads** — stored under `public/uploads/{portal}/...`, tenant-scoped by `companyId`/`branchId`/`accountId`
  ([`file-uploads.md`](.claude/skills/backend-conventions/references/file-uploads.md)).
- **Audit trail** — [`auditTrail.middleware.js`](back/server/src/middlewares/auditTrail.middleware.js) intercepts
  successful state-changing responses on audited routes and writes a sanitized record to `audit_trail`.

---

## Frontend

- **Two builds** — `vite.config.js` points `@app-routes` at `routes/index.jsx` (the branch app's
  Admin portal, [`AdminRoute.jsx`](front/src/routes/pageRoutes/AdminRoute.jsx)) or, with
  `--mode superadmin`, at `routes/superadmin.jsx` (the central SuperAdmin app).
  `scripts/check-build.mjs` fails the branch build if SuperAdmin code gets into it. `<Auth>` /
  `<UnAuth>` guards gate access; `<ProtectedRoute module … accessLevel>` gates Admin pages.
- **State** — Zustand for auth (`useAdminAuthStore` for the Admin portal, `useSuperAdminConsoleStore`
  for the SuperAdmin app, persisted to `localStorage`) and theme; **TanStack Query** for all server state. Tokens attach via an axios
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
| Auth                       | `/api/v1/admin/auth`                            | `GET /csrf-token` · `POST /login` · `POST /refresh` · `POST /logout` · `GET /me`                      |
| Admin · Users              | `/api/v1/admin/users`                           | `GET /` · `GET /:userId` · `POST /` · `PUT /:userId` · `DELETE /:userId`                              |
| Admin · Roles              | `/api/v1/admin/roles`                           | CRUD + `GET/POST /:roleId/permissions`                                                                |
| Admin · Permissions        | `/api/v1/admin/permissions`                     | `GET /` · `GET /modules` · `GET /user` · `POST /check`                                                |
| Admin · User permissions   | `/api/v1/admin/user-permissions`                | `GET /:accountId` · `POST /:accountId` · `POST /:accountId/bulk` · `DELETE /:accountId/:permissionId` |
| Admin · Audit trail        | `/api/v1/admin/audit-trail`                     | `GET /` (paginated + filterable)                                                                      |
| Management (SuperAdmin)    | `/api/v1/manage` (`x-manage-key`)               | `GET /health` · `/company-profile` (+ `/logo`) · `/users` · `/system-settings`                        |
| Uploads                    | `/api/v1/upload`                                | `POST /avatar` · `POST /image` · `DELETE /file`                                                       |

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
| `superadmins`           | `accountId`        | Retired in-branch SuperAdmin logins (all Inactive, migration 016) |
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
