# Template Improvements, Optimization & Cleanup

Audit date: 2026-07-22. Findings are based on a full sweep of `front/`, `back/`, and the repo
root. Every item cites the file it was found in. Sections: [Critical fixes](#1-critical-fixes),
[Missing features](#2-missing-features--what-the-template-needs), [Cleanup](#3-cleanup),
[Optimization](#4-optimization), [Suggested order of attack](#5-suggested-order-of-attack).

---

## 1. Critical fixes

These are bugs or security holes in what already exists — fix before adding anything new.

### 1.1 SuperAdmin routes have no SuperAdmin guard 🔴 (security, HIGH)

`back/server/src/routes/v1/superadmin/index.js` applies only `requireAuth`. Nothing anywhere
checks `req.user.type === 'SUPERADMIN'`. Any authenticated **Admin/User** with a valid JWT can
call `/api/v1/superadmin/companies`, `/branches`, `/users` and read or modify **every tenant's
data** — a cross-tenant privilege escalation. The docs say "SuperAdmin skips permission checks,"
but there is no positive assertion that the caller *is* a SuperAdmin.

**Fix:** add a `requireSuperAdmin` middleware (`if (req.user.type !== 'SUPERADMIN') return 403`)
to the superadmin router, right after `requireAuth`.

### 1.2 No refresh-token rotation, revocation, or real logout 🔴 (security, HIGH)

- `POST /refresh` (`back/.../auth/auth.controller.js:170-228`) issues a new token pair but never
  invalidates the presented refresh token — the docstring claims it does, the code doesn't.
- `POST /logout` (`auth.controller.js:238-247`) is a no-op. A `jti` is generated
  (`utils/jwt.js:66`) but never persisted, so there is nothing to blacklist against.
- Refresh TTL is **30 days**, access TTL **8 hours** — a leaked refresh token works for a month
  with no server-side kill switch.

**Fix:** persist refresh-token `jti`s (a `refresh_tokens` table fits the existing schema
conventions), rotate on every `/refresh`, revoke on `/logout`, reject reuse.

### 1.3 Frontend never refreshes tokens and has no 401 handling 🔴

`refreshTokenApi` exists (`front/src/services/api/admin/auth.js:16`, `superadmin/auth.js:16`)
and the refresh token is stored, but **nothing ever calls it**. On an auth failure the axios
response interceptor (`front/src/services/api/axios.js:220-234`) only shows a
`message.warning` — it does not `reset()` the store or redirect to login. After the 8-hour
access token expires, the app just fails on every request until the user manually logs out.

**Fix:** add a 401 interceptor that attempts one `/refresh` (queueing concurrent requests),
and on failure resets the store and redirects to login.

### 1.4 SuperAdmin login auto-fills live demo credentials 🔴

`front/src/pages/SuperAdmin/Login.jsx:12-18` — an active (not commented) `useEffect` pre-fills
`superadmin@template.com` / `superadmin123` into the form. Its Admin counterpart is commented
out (`front/src/pages/Admin/Login.jsx:13-18`, leaving an unused `useEffect` import at line 3).

**Fix:** delete both blocks (or gate behind `import.meta.env.DEV`).

### 1.5 Graceful shutdown crashes before draining anything 🔴

`back/server/bin/www.js:170` references `emailWorker`, whose declaration is commented out
(`www.js:96-107`). On SIGTERM/SIGINT this throws `ReferenceError` **before** the `db.close()`
and `closeRateLimiter()` tasks are registered (`www.js:180-192`), so the pool and rate limiter
are never drained and the process force-exits with code 1.

**Fix:** remove the `emailWorker` reference (and the unused `getRateLimiterStats` import at
`www.js:12`).

### 1.6 Validators exist on 1 of 10 controllers 🟠

Only `auth.validator.js` exists. **No Zod validation** on: `admin/users`, `admin/roles`,
`admin/permissions`, `admin/user-permissions`, `admin/audit-trail`, `superadmin/companies`,
`superadmin/branches`, `superadmin/users`, `upload`. Handlers read `req.body` directly (e.g.
`users.controller.js:146`, `roles.controller.js:111`, `companies.controller.js:150`), and
`POST /:roleId/permissions` trusts a raw `permissions[]` array (`roles.controller.js:243`).
This contradicts the project's own `back/docs/validators.md` ("every POST/PUT/PATCH MUST have
a Zod schema").

**Fix:** add the nine missing `*.validator.js` files per the documented template.

### 1.7 Timestamps store Manila local time labeled as UTC 🟠

The pool runs in UTC (`back/server/config/database.js:42`, `timezone: "Z"`), but every write
uses `getCurrentTimestampLocal()` (`utils/dateUtils.js:36-38`), which formats in
`Asia/Manila` — so `dateCreated`/`dateUpdated` are skewed ~8h from what the driver assumes.
`getCurrentTimestampUTC()` exists but is never used.

**Fix:** decide one convention (UTC storage is the safe default), switch writes to it, and
update `back/docs/schema-conventions.md` to match.

### 1.8 Broken "Forgot password?" link 🟠

Both login pages render `<NavLink to="/forgot-password">` (`front/src/pages/Admin/Login.jsx:161`,
`SuperAdmin/Login.jsx:161`) but no such route exists — clicking it silently redirects to `/`.
Either build the flow (see §2) or remove the link until it exists.

### 1.9 JWT issuer/audience mismatch risk 🟠

`back/server/src/utils/jwt.js:98-99,137-138,187-188,230-231` default issuer/audience to
`"rotary-discon-api"` / `"rotary-discon-client"` (leftover branding from another project), while
`passport.jwt.config.js:15-16` reads `process.env.ISSUER`/`AUDIENCE` **with no fallback**. If
those env vars are unset, tokens are signed with the rotary defaults but verified against
`undefined`. Align both sides on one env-var pair with one shared default.

---

## 2. Missing features — what the template needs

### 2.1 Backend

| Feature | Notes |
| --- | --- |
| **Forgot / reset password** | `.env.example` already defines `RATE_LIMIT_PWRESET_*` but no endpoint exists. Pairs with 1.8. |
| **Working email service** | `lib/sendgrid/email.js` is dead *and* broken (`email.js:6` imports a path that doesn't exist). Password reset, email verification, and invites all need this first. |
| **Email verification** | Nothing exists. |
| **Self-service profile API** | `PUT /me`, change-password, avatar upload. The frontend AccountSettings UI already exists but every section is a TODO stub (see 2.2). |
| **Refresh rotation / logout revocation** | See 1.2. |
| **2FA (TOTP)** | `qrcode` is installed but never imported. Either build it or drop the dep (§3). |
| **`GET /health` endpoint** | `db.healthCheck()` exists and the rate limiter already whitelists `/health,/ready,/live` (`rateLimiter.js:175`) — but no route is defined; `/health` 404s today. Trivial win, needed for Docker/orchestration. |
| **Settings module** | Referenced in `back/docs/permission-gating.md` table; no controller/route exists. Frontend Settings pages are placeholders. |
| **Audit trail: detail + export** | Only list `GET /` exists; the frontend already has a detail modal. |
| **API docs (OpenAPI/Swagger)** | Nothing. Even a generated spec from the Zod schemas (once §1.6 is done) would do. |
| **Realtime server** | Frontend ships `socket.io-client`; the backend has **no socket server at all**. Either add one (notifications are the natural first use) or remove the client stack (§3). |

### 2.2 Frontend

| Feature | Notes |
| --- | --- |
| **Forgot/reset password pages** | Pairs with the backend flow. |
| **Real dashboards with charts** | Both dashboards are 100 % hardcoded mock data (`Admin/Dashboard/index.jsx:8-24`, `SuperAdmin/Dashboard/index.jsx:76-262`); the `useDashboardHooks` files are empty TODO stubs that the pages don't even call. `recharts` and `framer-motion` are the documented library choices but **aren't installed**. Needs backend stats endpoints + chart components. |
| **Wire up AccountSettings** | `ProfileSection.jsx:51`, `PasswordSection.jsx:21`, `NotificationSection.jsx:46` all fake success without calling any API. |
| **Styled 404 page** | Both portals render a bare `<div>Page Not Found</div>` (`AdminRoute.jsx:210`, `SuperAdminRoute.jsx:195`). |
| **Global search / ⌘K palette** | The design system already reserves JetBrains Mono for "⌘K hints" — the feature doesn't exist. |
| **Notifications inbox/bell** | Only a preferences toggle panel exists. Natural pairing with the realtime decision. |
| **Session-expired UX** | Pairs with 1.3. |

### 2.3 Infrastructure (applies to both)

| Missing | Notes |
| --- | --- |
| **Tests** | Zero test files, zero test runners in either package. Highest-leverage addition for a template: Vitest + React Testing Library (front), Vitest/Jest + Supertest (back), starting with auth, permissions, and tenancy-scoping — the things every derived project relies on. |
| **CI** | No repo-root `.github/`. Note `front/.github/workflows/security-audit.yml` **can never run** — GitHub only executes workflows from the repo root. Move it to `/.github/workflows/` and add lint + build + test jobs. |
| **Docker** | No Dockerfile/compose. A `docker-compose.yml` (MySQL + API + front) would make template onboarding one command. |
| **DB migrations** | One `schema.sql` + setup scripts only. The `.sequelizerc` migration config is dead (Sequelize isn't installed). Adopt a real migration tool (e.g. `db-migrate`, Knex migrations, or plain SQL files with a runner) so derived projects can evolve schema. |
| **Demo seed data** | Setup seeds one superadmin only. A demo tenant (company + branch + roles + users) would make the template explorable immediately. |

---

## 3. Cleanup

### 3.1 Backend: remove unused dependencies

Verified by grepping all imports across `server/` and `scripts/`:

| Package | Evidence |
| --- | --- |
| `express-validator` | 0 imports (Zod is the validator) |
| `uniqid` | 0 imports |
| `@paralleldrive/cuid2` | 0 imports (IDs come from `SELECT UUID()`) |
| `lodash` | 0 imports |
| `lodash-es` | 0 imports |
| `qrcode` | 0 imports (the QR path uses `canvas`, and that path is dead too) |
| `html-entities` | 0 imports |
| `xss` | 0 imports (`sanitize-html` is used instead) |
| `validator` | 0 imports |
| `bcrypt` | only in `utils/hashing/bcryptHash.js`, which nothing imports; also broken (reads undefined `process.env.saltRounds`). Auth uses Argon2. |
| `@sendgrid/mail` | only in dead+broken `lib/sendgrid/email.js` |
| `canvas` | heavy native dep; only in `lib/qr/qrcode_generate.js`, reachable only from the broken email module (event-badge leftover from another app) |
| `mime` | same dead QR chain |
| `opossum` | only in `utils/circuitBreaker.js`, which nothing imports |
| `axios` | only in dead `circuitBreaker.js` and dead `lib/xendit/invoice.js` |
| `moment` | redundant — `moment-timezone` bundles it. `utils/file/uploads.js:1` imports plain `moment`; switch to `moment-timezone` and drop the extra dep. (Longer term, migrate to dayjs to match the frontend convention.) |

### 3.2 Backend: delete dead modules

Wired to nothing; several are broken on load:

- `lib/sendgrid/email.js` (+ its templates) — broken import at line 6 (`../lib/qrcode_generate.js` doesn't exist)
- `lib/xendit/invoice.js` — abandoned payment-gateway integration
- `lib/qr/*` — event-badge QR renderer from a different app
- `utils/circuitBreaker.js`, `middlewares/ssrf.middleware.js` (only imported by circuitBreaker)
- `middlewares/idempotency.middleware.js` (never mounted — note the frontend *sends* idempotency keys, so either mount it or delete both sides deliberately)
- `utils/file/fileIntegrity.js`, `utils/crypto.js`, `utils/hashing/bcryptHash.js`
- `.sequelizerc` + `server/config/config.cjs` — point to `server/database/{models,migrations,seeders}` which don't exist; Sequelize isn't a dependency

### 3.3 Frontend: remove unused dependencies & dead code

| Item | Evidence |
| --- | --- |
| `socket.io-client` + `src/config/socket.js` + `src/contexts/SocketContext.jsx` | `SocketProvider`/`useSocket` are never imported or mounted anywhere; contains the app's only `console.log`s (`SocketContext.jsx:22,27`). Remove — or actually build realtime (§2.1). |
| `react-error-boundary` | never imported; the app uses a hand-rolled class boundary (`components/ErrorBoundary.jsx`) |
| `@vitejs/plugin-react-swc` | `vite.config.js:2` uses the Babel `@vitejs/plugin-react`; the SWC plugin is dead. (Or switch *to* SWC and drop the Babel one — pick one.) |
| `src/hooks/useUsers.js` | entire file dead **and** wrong-pattern: hits `/users` on a token-less axios instance, bypassing the documented `services/api` + `services/requests` layers. The real implementation lives in `services/requests/admin/user.js`. |
| `src/utils/formatDate.js`, `src/utils/itemFormat.js` | zero imports anywhere |
| `src/assets/address/all.json` | **6.3 MB**, imported nowhere — pure repo bloat |
| Dependency placement | `@tailwindcss/vite`, `tailwindcss`, `@vitejs/plugin-react` are build-time tools sitting in `"dependencies"`; move to `"devDependencies"` |
| `front/src/pages/Admin/Login.jsx:3` | unused `useEffect` import (leftover from the commented auto-fill block) |

### 3.4 Config drift & leftovers

| Item | Detail |
| --- | --- |
| `back/.env.example` drift | `EXPIRY=24h` (line 28) is read by nothing — the code reads `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` (`jwt.js:53,57`), which are **absent** from the example. Lines 57-58 (`ALLOW_CROSS_SITE_CSRF`, `COOKIE_SECURE`) are malformed (no `=value`). |
| "rotary-discon" branding | Default JWT issuer/audience in `jwt.js` (see 1.9). |
| Root `.gitignore` missing | `.DS_Store` is committed at the repo root. Add a root `.gitignore` and `git rm --cached .DS_Store`. |
| Misplaced CI workflow | `front/.github/workflows/security-audit.yml` never runs from a subdirectory — move to repo-root `.github/workflows/`. |
| `index.html` | Title is generic `"Template"`, favicon is still `/vite.svg`, no description/OG/theme-color meta. Also loads Google Fonts redundantly (see 4.1). |
| Commented-out code | `back`: `express.js:21-22,189` (apiLimiter never applied — decide and delete or enable), `www.js:94-107` (email worker), `www.js:297-304` (pool stats), `ecosystem.config.cjs:6-7` (clustering). |

### 3.5 Consistency debt

- **`console.*` instead of the winston logger** in backend middleware/infra (25 occurrences):
  `csrf.middleware.js` (17), `checkPermission.middleware.js` (2), `rateLimiter.js` (2),
  `idempotency.middleware.js` (2), `requestId.middleware.js` (1), `auditTrail.middleware.js:51`.
  Controllers are clean.
- **Four divergent error response shapes** for the same API: `responses.js` success/error,
  `catchAsync.js:16,48,73` validation errors (no `code`), `checkPermission.middleware.js` 403s
  (`required`/`current`, no `code`), bot blocks in `express.js:116,130`. Standardize on one
  envelope so the frontend can handle errors uniformly.
- **The documented "reference implementation" violates its own docs:** `Roles/index.jsx:33-63`
  keeps drawer/selection state in the page, while `front/docs/hooks-pattern.md` mandates zero
  `useState` in `index.jsx`. Since every new module copies Roles, fix Roles (or amend the doc).
- **Argon2 verify smell:** `argonHash.js:29` passes `type: argon2.argon2d` and a `salt` to
  `argon2.verify` — both ignored (verify reads them from the encoded hash), but misleading; and
  the `credentials.salt` column (`schema.sql:60`) is redundant since Argon2 embeds the salt.
- **Docs contradiction:** `front/docs/code-conventions.md` says "never use `console.warn`" yet
  blesses the two `console.warn`s in `axios.js:62,157`. Pick one rule.

---

## 4. Optimization

### 4.1 Frontend

| Priority | Finding | Fix |
| --- | --- | --- |
| 🔴 High | **~6.6 MB of Philippine address JSON is statically bundled** into the Companies chunk: `assets/address/index.js` imports `refbrgy.json` (6.3 MB) + city/province/region files, pulled in via `utils/address.js` → `SuperAdmin/Companies/hooks.jsx:9`, just to format an address string by code. | Resolve address names on the backend, or lazy-`import()` the JSON on demand, or at minimum drop `refbrgy` from the static barrel. Also delete the dead 6.3 MB `all.json` (§3.3). |
| 🟠 Med | **Sentry is enabled in production but sourcemaps are dev-only** (`config/sentry.js:25` vs `vite.config.js` `sourcemap: mode === "development"`) — prod stack traces arrive minified. | Generate prod sourcemaps and upload to Sentry (don't serve them publicly). |
| 🟠 Med | **Fonts double-load:** `index.html:19-24` fetches Onest + JetBrains Mono from Google Fonts on every prod load even though `main.jsx:8-9` self-hosts the same fonts via `@fontsource-variable`. | Remove the `<link>` (or strip it at build time). |
| 🟡 Low | `build:analyze` script is a no-op — no visualizer plugin handles `--mode analyze` in `vite.config.js`. | Wire up `rollup-plugin-visualizer` or delete the script. |
| 🟡 Low | Oversized components: `layout/Sidebar.jsx` (723 lines), `SuperAdmin/Dashboard/index.jsx` (690, with unmemoized inline columns/data), `CreateUserDrawer.jsx` (511). | Split when next touched; memoize Dashboard columns when real data lands. |
| 🟡 Low | All `<img>` usages (avatars/logos in Sidebar, Companies, user modals) lack `loading="lazy"`, `width`/`height`, `decoding`. | Add attributes to prevent layout shift. |
| 🟡 Low | Accessibility gaps: no `:focus-visible` styles for custom buttons, no `prefers-reduced-motion`, no skip-link, icon-only buttons without labels on the SuperAdmin dashboard. | Address as a pass when building the real dashboards. |

### 4.2 Backend

| Priority | Finding | Fix |
| --- | --- | --- |
| 🔴 High | **No composite indexes for the universal query pattern** `WHERE companyId=? AND branchId=? AND status != 'Deleted'` — `schema.sql` has single-column indexes only; no `status` index anywhere; `companies` has no secondary index at all despite list filters on `status`/`subscriptionPlan`/search; `roles.roleName` unindexed despite constant `!= 'Owner'` filtering. | Add `(companyId, branchId, status)` composites on tenant tables + the missing single indexes. |
| 🟠 Med | **No FOREIGN KEY constraints** in `schema.sql`, though the docs describe FK relationships. | Add FKs on the business-ID columns (they're `UNIQUE`, so MySQL allows it) — or document the deliberate omission. |
| 🟠 Med | **Copy-pasted list/pagination block in 7 controllers** (page/pageSize/search/sort whitelist → `Promise.all([COUNT, rows])` → totalPages) and the **transaction skeleton in ~9 handlers**. | Extract `buildListQuery()` / `withTransaction()` helpers — this is a template; every derived module inherits the duplication. |
| 🟠 Med | **Argon2 memory cost below OWASP guidance:** `argonHash.js:10` uses `memoryCost: 4096` (4 MiB); OWASP recommends ≥ 19 MiB for Argon2id. | Raise `memoryCost` (also in the seed scripts). |
| 🟡 Low | Query timeout races a `setTimeout` but never cancels the underlying MySQL statement (`database.js:168-213`) — the connection stays busy after "timeout". | Use `connection.destroy()` on timeout or MySQL's `max_execution_time` hint. |
| 🟡 Low | Dev CORS allows **all** origins (`security.js:164-167`). | Acceptable for a template, but worth a comment/env flag. |

**Already good (keep):** RS256 JWTs with lazy key loading, CSRF double-submit, helmet with
HSTS/frameguard, rate limiting with per-route profiles, login-enumeration mitigation via dummy
Argon2 compare, parameterized queries + sort whitelisting everywhere, `multipleStatements`
disabled, audit metadata stripping sensitive fields, secrets properly gitignored
(`auth-keys/private.pem` is chmod 600 and untracked).

---

## 5. Suggested order of attack

| Phase | Work | Why first |
| --- | --- | --- |
| **1. Security patch** | 1.1 SuperAdmin guard · 1.2 refresh rotation + logout · 1.3 frontend 401/refresh · 1.4 remove auto-filled creds · 1.5 shutdown crash · 1.9 JWT issuer/audience | Actual vulnerabilities/bugs in shipped code; small diffs. |
| **2. Cleanup sweep** | §3 in full — drop ~16 backend deps + dead modules, 4 frontend deps + dead files, config drift, root `.gitignore` | Shrinks install/build, removes broken code paths, makes the codebase honest before feature work. |
| **3. Data-layer hardening** | 1.6 validators ×9 · 1.7 timezone convention · 4.2 indexes + FKs · migration system | Everything later builds on the schema and validation layer. |
| **4. Core missing features** | Email service → forgot/reset password → email verification · profile/change-password API + wire AccountSettings · `GET /health` · 404 page · settings module | The gaps users of the template hit on day one. |
| **5. Dashboards & polish** | Real stats endpoints + recharts dashboards · audit-trail detail/export · global search · notifications (+ decide socket.io in vs. out) | Feature depth. |
| **6. Infra** | Tests (auth/permissions/tenancy first) · repo-root CI · Docker compose · demo seed data · OpenAPI docs | Makes the template production-credible and safely forkable. |

---

*Generated from a code audit — every finding above was verified against the source, not inferred
from docs. Line numbers reflect the tree at commit `ed8a6f8`.*
