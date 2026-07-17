# Full-Stack Multi-Tenant Template

A production-style starter for multi-tenant admin platforms. It ships two portals out of the box —
a **SuperAdmin** portal that manages companies across the whole platform, and an **Admin**
portal scoped to a single company + branch — with role-based access control, an audit trail,
file uploads, and a hardened Express API.

The repository is a **monorepo of two independent apps**:

| Path               | App                         | Stack                                                                                          |
| ------------------ | --------------------------- | ---------------------------------------------------------------------------------------------- |
| [`front/`](front/) | React SPA (the two portals) | React 19 · Vite · Ant Design v5 · Tailwind CSS v4 · Zustand · TanStack Query · React Router v7 |
| [`back/`](back/)   | REST API server             | Node · Express · MySQL (`mysql2`) · Passport JWT · Zod                                         |

> Conventions for each side are documented in [`front/CLAUDE.md`](front/CLAUDE.md) → [`front/docs/`](front/docs/)
> and [`back/CLAUDE.md`](back/CLAUDE.md) → [`back/docs/`](back/docs/). Those are the source of truth for
> coding patterns; this README is the high-level map.

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
- [Conventions & further reading](#conventions--further-reading)

---

## Architecture at a glance

```
                         ┌─────────────────────────────┐
   Browser               │  front/  (Vite SPA)         │
   ┌───────────────┐     │  /admin/*     Admin portal  │
   │ SuperAdmin UI │◀───▶│  /superadmin/* SuperAdmin   │
   │ Admin UI      │     │  Zustand · React Query · AntD│
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
                                │  10 tables       │
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
├── front/                     ← React SPA
│   ├── CLAUDE.md  · docs/     ← frontend conventions (7 topic docs)
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
│       └── theme/ · index.css ← Ant theme + Tailwind v4 design tokens
└── back/                      ← Express API
    ├── CLAUDE.md  · docs/     ← backend conventions (6 topic docs)
    ├── .env.example
    ├── database/schema.sql    ← full DDL (10 tables)
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

# ⚠️  Build the schema — this DROPS every existing table, then recreates them and
#     seeds the permission set + a default SuperAdmin. Destructive: never run it
#     against a database you care about.
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
| `npm run db:setup`                                           | ⚠️ **Drops all tables**, recreates the schema, seeds permissions + SuperAdmin |
| `npm run db:setup:clean`                                     | ⚠️ **Drops all tables**, recreates the schema, seeds SuperAdmin only         |
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
  `req.db.commit(conn)` / `req.db.rollback(conn)`. See [`back/docs/db-patterns.md`](back/docs/db-patterns.md).

### Auth & RBAC

- **Authentication** — [`passport.jwt.config.js`](back/server/src/middlewares/passport.jwt.config.js) verifies RS256
  tokens and loads the user (admin/staff _or_ superadmin) onto `req.user` (`accountId`, `companyId`,
  `branchId`, `roleId`, `type`, …).
- **Authorization** — `checkPermission(module, submodule?, accessLevel?)` resolves the user's effective
  level (user override → role permission), enforcing `GET = read`, `POST/PUT/DELETE = write`.
  SuperAdmin routes skip permission checks by design. See [`back/docs/permission-gating.md`](back/docs/permission-gating.md).

### Validation, uploads, audit

- **Validation** — Zod schemas applied via `validateBody` / `validateQuery` / `validateParams`
  ([`back/docs/validators.md`](back/docs/validators.md)).
- **Uploads** — stored under `public/uploads/{portal}/...`, tenant-scoped by `companyId`/`branchId`/`accountId`
  ([`back/docs/file-uploads.md`](back/docs/file-uploads.md)).
- **Audit trail** — [`auditTrail.middleware.js`](back/server/src/middlewares/auditTrail.middleware.js) intercepts
  successful state-changing responses on audited routes and writes a sanitized record to `audit_trail`.

---

## Frontend

- **Routing & portals** — [`routes/pageRoutes/AdminRoute.jsx`](front/src/routes/pageRoutes/AdminRoute.jsx) and
  `SuperAdminRoute.jsx` define each portal's routes + sidebar navigation. `<Auth>` / `<UnAuth>` guards
  gate access; `<ProtectedRoute module … accessLevel>` gates individual pages.
- **State** — Zustand for auth (`useAdminAuthStore`, `useSuperAdminAuthStore`, persisted to
  `localStorage`) and theme; **TanStack Query** for all server state. Tokens attach via an axios
  interceptor. See [`front/docs/auth-state.md`](front/docs/auth-state.md).
- **Page module pattern** — each page is a folder: `index.jsx` (presentational), `hooks.jsx` (a single
  hook owning data, columns, filters, pagination, and actions), and `components/`. See
  [`front/docs/hooks-pattern.md`](front/docs/hooks-pattern.md) and [`front/docs/folder-structure.md`](front/docs/folder-structure.md).
- **Data layer** — `services/api/` holds raw axios calls; `services/requests/` holds the matching
  React Query hooks (list queries use `placeholderData: keepPreviousData` for smooth paging). See
  [`front/docs/api-guide.md`](front/docs/api-guide.md).
- **UI system — "Modern"** — monochrome surfaces + hairline borders + one green accent used sparingly;
  structure comes from borders, not shadows, and the primary button is inverted monochrome (never the
  accent, never a gradient). Every color is a token in `src/index.css` (light/dark); type is **Onest**
  + **JetBrains Mono** (micro-data only), Ant Design v5, Tailwind v4, `lucide-react` icons. The
  copy-paste spec is [`modern-module-pattern.md`](modern-module-pattern.md) and
  `front/src/pages/Admin/UserManagement/Roles/` is the reference implementation. See
  [`front/docs/ui-design-system.md`](front/docs/ui-design-system.md) and [`front/docs/ui-form-design.md`](front/docs/ui-form-design.md).

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

Full DDL: [`back/database/schema.sql`](back/database/schema.sql). Ten tables:

| Table              | Business ID        | Purpose                                             |
| ------------------ | ------------------ | --------------------------------------------------- |
| `companies`           | `companyId`          | Company (the tenant)                           |
| `branches`         | `branchId`         | Physical location under a company                     |
| `superadmins`      | `accountId`        | Platform-level admins                               |
| `credentials`      | `accountId`        | Auth credentials (shared across portals via `type`) |
| `users`            | `accountId`        | Admin/staff users (belong to a company + branch)      |
| `roles`            | `roleId`           | Permission roles (scoped to company + branch)         |
| `permissions`      | `permissionId`     | Master permission definitions                       |
| `role_permissions` | —                  | Maps roles → permissions                            |
| `user_permissions` | `userPermissionId` | Per-user permission overrides                       |
| `audit_trail`      | `auditId`          | Activity log                                        |

Every table has `id BIGINT AUTO_INCREMENT` (internal), `dateCreated` / `dateUpdated` (`DATETIME`, UTC),
and — where applicable — a `status` enum used for soft deletes. Foreign keys reference business IDs,
not the numeric `id`. See [`back/docs/schema-conventions.md`](back/docs/schema-conventions.md).

---

## Conventions & further reading

The detailed, enforced coding patterns live next to the code:

- **Project map (for AI agents):** [`CLAUDE.md`](CLAUDE.md)
- **Design spec:** [`modern-module-pattern.md`](modern-module-pattern.md) — the canonical, copy-paste
  reference for a module's list page + create/edit drawer.
- **Frontend:** [`front/CLAUDE.md`](front/CLAUDE.md) → [`front/docs/`](front/docs/) — code conventions, folder
  structure, the table-page hook pattern, API/React-Query usage, auth & state, the UI design system,
  and the Modern drawer form pattern.
- **Backend:** [`back/CLAUDE.md`](back/CLAUDE.md) → [`back/docs/`](back/docs/) — authenticated-user context,
  DB/transaction patterns, schema & ID conventions, validators, permission gating, and file uploads.
