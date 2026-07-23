# Implementation Checklist

Working checklist for [IMPROVEMENTS.md](IMPROVEMENTS.md) — same six phases, broken into
check-off-able tasks. Each task references the section of the audit it comes from
(e.g. *[§1.1]*). Work top to bottom; phases 1–3 are ordered dependencies, 4–6 are
parallelizable.

---

## Phase 1 — Security patch

### SuperAdmin route guard *[§1.1]* 🔴

- [x] Create `back/server/src/middlewares/requireSuperAdmin.middleware.js` — reject with 403 unless `req.user.type === 'SUPERADMIN'`
- [x] Apply it in `back/server/src/routes/v1/superadmin/index.js` right after `requireAuth`
- [ ] Manually verify: an ADMIN token against `GET /api/v1/superadmin/companies` must get 403 *(verified: no-token → 401, SUPERADMIN → 200; the ADMIN → 403 case needs a seeded admin account to exercise)*

### Refresh-token rotation & revocation *[§1.2]*

- [x] Add a `refresh_tokens` table to `back/database/schema.sql` (setup scripts read `schema.sql`, so no separate change needed)
- [x] Persist the `jti` when issuing a refresh token (done in `auth.controller.js` login/refresh — `jwt.js` already returned the `jti`)
- [x] `POST /refresh`: reject unknown/revoked/expired `jti`, revoke the presented token, issue a new pair (`auth.controller.js`)
- [x] `POST /logout`: revoke the presented refresh token (replace the no-op at `auth.controller.js:238-247`)
- [x] On refresh-token **reuse** (revoked jti presented again), revoke the whole account's tokens
- [x] Update the misleading docstring on `/refresh`
- ✅ *End-to-end verified against a running server: rotation, old-token reuse → 401, reuse cascade revokes the new token, logout → refresh 401.*

### Frontend token refresh + 401 handling *[§1.3]*

- [x] Add a 401 response interceptor in `front/src/services/api/axios.js`: attempt one `/refresh`, queue concurrent requests while refreshing, retry originals on success
- [x] On refresh failure: `reset()` the matching auth store (the `<Auth>` guard redirects to the portal login on token clear)
- [x] Store the rotated refresh token returned by `/refresh` (also fixed `refreshTokenApi` sending `{ token }` instead of `{ refreshToken }`, and logout now sends the refresh token for server-side revocation)
- [ ] Verify: expire an access token manually → app recovers without logout; revoke refresh → clean redirect to login *(needs a browser session)*

### Remove auto-filled demo credentials *[§1.4]*

- [x] Delete the live auto-fill `useEffect` in `front/src/pages/SuperAdmin/Login.jsx:12-18`
- [x] Delete the commented-out counterpart in `front/src/pages/Admin/Login.jsx:13-18`
- [x] Remove the now-unused `useEffect` import in `front/src/pages/Admin/Login.jsx:3`

### Fix graceful shutdown *[§1.5]*

- [x] Remove the `emailWorker` reference at `back/server/bin/www.js:170` (declaration is commented out at `:96-107`)
- [x] Remove the unused `getRateLimiterStats` import (`www.js:12`)
- [x] Verify: `kill -TERM <pid>` drains the DB pool and rate limiter, exits 0 — *log shows "Graceful shutdown completed successfully"*

### JWT issuer/audience alignment *[§1.9]*

- [x] Replace the `"rotary-discon-*"` defaults in `back/server/src/utils/jwt.js` with exported `JWT_ISSUER`/`JWT_AUDIENCE` constants (`template-api` / `template-client` defaults)
- [x] `passport.jwt.config.js` now imports those same constants so sign and verify can't diverge
- [x] `.env.example`: `ISSUER`/`AUDIENCE` were already present; removed dead `EXPIRY`, added `JWT_ACCESS_EXPIRES_IN`/`JWT_REFRESH_EXPIRES_IN`, fixed malformed `ALLOW_CROSS_SITE_CSRF`/`COOKIE_SECURE` lines

### Broken forgot-password link *[§1.8]*

- [x] Removed the `/forgot-password` NavLinks in both login pages (restore when the flow ships in Phase 4)

---

## Phase 2 — Cleanup sweep

### Backend dependencies *[§3.1]*

- [x] `npm rm express-validator uniqid @paralleldrive/cuid2 lodash lodash-es qrcode html-entities xss validator` (zero imports)
- [x] `npm rm bcrypt @sendgrid/mail canvas mime opossum axios` (dead modules deleted first)
- [x] `npm rm moment` — `back/server/src/utils/file/uploads.js:1` now imports from `moment-timezone`
- [x] Bonus find: `npm rm passport-google-oauth20` (zero imports — missed by the audit)
- [x] `npm install` + server booted and e2e-tested — nothing broke

### Backend dead modules *[§3.2]*

- [x] Deleted `lib/sendgrid/` (broken import + event-app email templates), `lib/xendit/`, `lib/qr/` (badge PNGs/fonts)
- [x] Deleted `utils/circuitBreaker.js`, `middlewares/ssrf.middleware.js`
- [x] **Idempotency: IMPLEMENTED** (user decision) — middleware rewritten (Stripe-style opt-in: no header → pass-through; multipart skipped; camelCase columns; UTC timestamps; cache key scoped by Authorization header so one user can never replay another's cached response), `idempotency_keys` table added to `schema.sql`, mounted on the API router for all mutations, and the frontend interceptors now **reuse** the key on internal retries instead of overwriting it. E2E-verified: replay returned the cached response (same `companyId`, exactly one row created); same key + different body → 409.
- [x] Deleted `utils/file/fileIntegrity.js`, `utils/crypto.js`, `utils/hashing/bcryptHash.js`
- [x] Deleted `back/.sequelizerc` and `back/server/config/config.cjs`
- [x] Bonus fix: `scripts/setup-database.js` claimed to be additive but **dropped every table first** (identical to `db:setup:clean`) — now genuinely additive and re-runnable (seeds skip when already present)

### Frontend dependencies & dead code *[§3.3]*

- [x] Realtime **out** for now (no backend socket server; Phase 5 revisits): removed `socket.io-client`, deleted `src/config/socket.js` + `src/contexts/SocketContext.jsx`
- [x] `npm rm react-error-boundary`
- [x] Kept `@vitejs/plugin-react` (in use); removed `@vitejs/plugin-react-swc`
- [x] Moved `@tailwindcss/vite`, `tailwindcss`, `@vitejs/plugin-react` to `devDependencies`
- [x] Deleted `src/hooks/useUsers.js`, `src/utils/formatDate.js`, `src/utils/itemFormat.js`
- [x] Deleted `src/assets/address/all.json` (6.3 MB)
- [x] `npm run build` passes; `npm run lint` fully clean (also fixed two pre-existing errors: useless regex escapes in `utils/validation.js:7`, undefined `process` in `vite.config.js`)

### Config & repo hygiene *[§3.4]*

- [x] Root `.gitignore` added; `.DS_Store` untracked
- [x] Workflow moved to `/.github/workflows/security-audit.yml` — and rewritten: it referenced a non-existent `frontend/` dir and Node 20; now audits **both** `front/` and `back/` on Node 22 via a matrix
- [x] `back/.env.example` fixed (done in Phase 1)
- [x] `front/index.html`: real title, description + theme-color meta (light/dark), new design-system favicon (`public/favicon.svg`); `vite.svg` removed
- [x] Commented-out blocks deleted: apiLimiter lines (kept **disabled** — no dev bypass, and 100 req/15 min would throttle a React Query SPA; enable deliberately with a saner default if wanted), email-worker block, pool-stats interval, ecosystem clustering lines

### Consistency *[§3.5]*

- [x] `console.*` → winston logger: `csrf.middleware.js` (17× — debug chatter now `logger.debug`, warnings/errors at proper levels), `checkPermission.middleware.js`, `rateLimiter.js`, `auditTrail.middleware.js` (the `requestId.middleware.js` hit was only a JSDoc example)
- [x] Error envelope standardized: every error response now carries a machine-readable `code` — validation 400s (`VALIDATION_FAILED`), permission 401/403s (`TOKEN_INVALID`/`FORBIDDEN`, keeping the `required`/`current` extras), 500s (`INTERNAL_ERROR`), `requireSuperAdmin`. Frontend only reads `message` and `code === "CSRF_VALIDATION_FAILED"` — unaffected.
- [x] Roles refactored: all drawer/selection state + handlers (incl. the delete confirm) moved into `hooks.jsx`; page keeps only `isFilterVisible`; columns are `useMemo`'d per the documented contract
- [x] `argonHash.js` verify cleaned (dropped ignored `type`/`salt` options; `comparePassword` is now 2-arg; login no longer selects `c.salt`). Column drop stays in Phase 3.
- [x] `console.warn` contradiction resolved in `front/docs/code-conventions.md` (axios-interceptor diagnostics explicitly allowed; stale socket mention removed); `api-guide.md` gained an idempotency-key section

---

## Phase 3 — Data-layer hardening

### Validators (9 missing) *[§1.6]*

All created and wired (`validateBody` on every mutation, `validateQuery` on every list). Shared `_helpers.js` (`emptyToUndefined`/`optionalString`/`optionalEmail`) handles `""` from Ant/multipart forms; multipart routes place `validateBody` after multer. Errors return `400 { code: "VALIDATION_FAILED", errors[] }` — e2e-verified.

> 🐞 **Regression found in use and fixed** (reported: `/superadmin/companies?…&status=&subscriptionPlan=` → 400).
> Two compounding bugs from this phase:
> 1. **Query schemas rejected `""`.** A query string can't express "absent" for a rendered
>    param — axios serialises `{ status: "" }` as `?status=`. Bare `z.enum().optional()`
>    rejects that, so the **default page load** of Companies, Branches, SuperAdmin Users,
>    Admin Users, Roles and Audit Trail all 400'd. Added `queryEnum`/`queryEnumDefault`/
>    `queryInt` helpers and applied them across all 6 list schemas (incl. the audit date
>    regexes, which also rejected `""`).
> 2. **`validateQuery`'s write-back never worked.** `req.query` is a getter in Express 5,
>    so the per-key copy silently did nothing and controllers kept reading raw strings —
>    an empty `?page=` stayed `""`, dodged the `= 1` destructuring default (only fires on
>    `undefined`), and `Number("")` yielded **page 0** with a `LIMIT 0` query. Now shadows
>    the getter via `Object.defineProperty`, so coercions and defaults actually apply.
>
> Verified (15/15) against the exact frontend URLs on every list endpoint, including empty
> `page`/`pageSize`/`sortBy`/`sortOrder`, while confirming invalid enums, over-max
> pageSize, and malformed dates are **still** rejected. No regressions: Phase 3, 4 (17/17),
> 5 (23/23) and the CSV-injection suite all still pass.

- [x] `admin-users.validator.js`
- [x] `roles.validator.js` (incl. the `permissions[]` array on `POST /:roleId/permissions`)
- [x] `permissions.validator.js` (incl. `POST /check`)
- [x] `user-permissions.validator.js`
- [x] `audit-trail.validator.js` (query params)
- [x] `companies.validator.js` (multipart — `validateBody` after `logoUpload`/`compressImage`)
- [x] `branches.validator.js`
- [x] `superadmin-users.validator.js`
- [x] `upload.validator.js`

### Timezone convention *[§1.7]* — **revised: Asia/Manila local storage (user decision)**

> Phase 3 first standardized on UTC storage. The user chose **Manila-local storage**
> instead (single-region app; wants timestamps to stay Manila regardless of deploy
> server). The important fix — the ~8h skew from storing Manila time under a UTC pool —
> is resolved either way; this just makes Manila the *intended* convention, consistently.

- [x] Pool set to `timezone: '+08:00'` + `dateStrings: true` (naive strings, **no driver conversion**) so stored == API == displayed value, independent of server/browser TZ
- [x] All writes use `getCurrentTimestampLocal()` (all controllers + `auditTrail.middleware.js` + idempotency middleware + both seed scripts + `migrate.js`); `companies` create uses `getTodayDateLocal()` instead of `UTC_DATE()` (server-clock-independent)
- [x] Token/idempotency expiry: JWT UTC `exp` stored via `toTimestampLocal()`; TTL checks compare naive Manila strings lexicographically (`stored.expiresAt <= now`)
- [x] Frontend needs no change — dayjs formats the naive Manila string as-is (verified no UTC/ISO reliance in `front/src`)
- [x] `dateUtils.js` gained `toTimestampLocal` + `addMinutesLocal`; UTC helpers kept for explicit needs but documented as not-for-storage
- [x] Docs + all schema/migration/`.env.example` comments flipped UTC→Manila; `schema-conventions.md` documents the convention and how to switch back to UTC for multi-region
- ✅ *Re-verified after the switch: DB check shows Manila storage; auth-rotation (10/10), forgot/reset + profile + settings (17/17), and idempotency/FK/validators (11/11) all pass.*

### Migrations *[§2.3]*

- [x] Plain-SQL runner (`scripts/migrate.js`, `_migrations` tracking table) + `npm run db:migrate`; idempotent (re-run = "already up to date")
- [x] `001_baseline.sql` = the schema; `002_hardening.sql` = indexes/FKs/salt-drop. `setup-database.js` / `setup-database-clean.js` now run migrations then seed. `schema.sql` kept as an end-state reference snapshot (header points to migrations as source of truth).
- [x] Bonus: hardened the direct-run guard in `migrate.js` (safe when imported)

### Indexes & FKs *[§4.2]* (in `002_hardening.sql`)

- [x] Composite `(companyId, branchId, status)` on `users`, `roles`; `(companyId, status)` on `branches`
- [x] Secondary indexes on `companies` (`status`, `subscriptionPlan`)
- [x] Index `roles.roleName`
- [x] 10 FOREIGN KEYs on the tenant hierarchy + permission mappings (verified live); polymorphic `accountId` FKs (credentials/refresh_tokens/audit_trail) deliberately omitted and documented
- [x] Argon2 `memoryCost` → 19456 KiB (19 MiB) in `argonHash.js` + both seed scripts + login dummy-hash string; **redundant `credentials.salt` column dropped** (Argon2 embeds the salt) — `hashPassword` now returns the hash string and all inserts updated

---

## Phase 4 — Core missing features

### Email service *[§2.1]*

- [x] `nodemailer` mail module (`lib/mailer/mailer.js`) + templates (`templates.js`): reset-password (wired), verify-email + invite (ready for future flows)
- [x] Env-gated: no `SMTP_HOST` → dev JSON transport logs the email (incl. the reset link) to the console/winston log, so the template runs with zero keys. `.env.example` updated (SMTP block replaces the dead `SENDGRID_API_KEY`; added `APP_NAME`/`APP_URL`).

### Forgot / reset password *[§2.1, §1.8]*

- [x] `POST /auth/forgot-password` — always 200 (no enumeration; also portal-type-scoped), single-use SHA-256-hashed token, 30-min TTL, `passwordResetLimiter` (`RATE_LIMIT_PWRESET_*`). Migration `003_password_reset_tokens.sql`.
- [x] `POST /auth/reset-password` — validates unused/unexpired token in a `FOR UPDATE` transaction, sets the new Argon2 hash, marks the token used, and revokes all of the account's refresh tokens
- [x] Frontend `pages/Auth/ForgotPassword.jsx` + `ResetPassword.jsx` (portal-aware, one component each for both portals), routes added under both portals, login links restored (`/admin/forgot-password`, `/superadmin/forgot-password`)
- ✅ *E2E-verified: generic 200 for unknown emails, reset link emitted, single-use enforced, login works with the reset password.*

### Self-service profile *[§2.1, §2.2]*

- [x] Backend (auth controller, now JWT-gated): `GET /me`, `PUT /me` (branches superadmins/users table; accepts imageUrl for avatar), `PUT /me/password` (verifies current password, revokes other sessions)
- [x] Wired `ProfileSection` + `PasswordSection` to the real portal-aware `/me` APIs (store kept in sync after profile save); `NotificationSection` now persists to localStorage per-portal (no notification-delivery backend exists yet) instead of faking a server save
- ✅ *E2E-verified: profile update reflected in GET /me; wrong current-password → 401; change-password succeeds.*

### Small wins

- [x] `GET /health` (app-level, no auth/CSRF) returns `{ status, uptime, checks: { database } }` via `db.healthCheck()`, 503 when DB is down — verified 200
- [x] Styled `components/NotFound.jsx`; bare divs replaced in both route files (with per-portal `homePath`)
- [x] Settings module: `settings` table (migration `004`), `admin/settings.controller.js` (GET/PUT, `settings` permission, curated key set, defaults-merged), validator. Admin Settings page is now a functional form; SuperAdmin "System Settings" replaced with a live read-only page backed by a new `GET /superadmin/system-info`. — *E2E-verified: defaults, persistence, validation 400.*

---

## Phase 5 — Dashboards & polish

### Real dashboards *[§2.2]*

- [x] `GET /admin/dashboard/stats` (tenant-scoped: user/role/audit totals, 14-day user-growth + activity series, recent activity) and `GET /superadmin/dashboard/stats` (platform totals, plan breakdown, 14-day growth, newest companies). Both return **gap-free** daily series (empty days filled server-side).
- [x] `recharts` installed; chart components built per the **dataviz** procedure — see the colour note below
- [x] Mock data gone from both dashboards; `useDashboardHooks` implemented and actually called in both portals
- [x] **Address bundle fixed** — see the note below; eager `index` chunk **5,083 kB → 480 kB**

> **Chart colour (validated, not eyeballed).** The design system's accent
> `--color-secondary-color: #4ade80` is specced for ticks/chips and **failed** the
> validator for chart marks (OKLCH L 0.80 outside the band; only **1.7:1** on white —
> unreadable as a line/area). Added a dedicated, validated `--chart-series-1`:
> `#16a34a` light / `#1eb055` dark (a *selected* dark step, not an automatic flip).
> Both pass all checks against their own surface. Charts read the token at runtime
> (`useChartTheme`) so they follow light/dark; all series are **single-series**, so
> the card title names them and no legend box is needed.

> **Address fix.** Root cause was worse than "heavy import": companies have **no
> address columns at all** (`address`/`regCode`/… live on `branches`), so
> `formatAddressByCode()` was fed all-undefined and always returned `""` — the full
> 6.6 MB of PH reference JSON was parsed to render nothing. Removed the dead call
> and its always-false UI, and converted `utils/address.js` to **lazy** (`await
> import()`) so a future branch address picker code-splits it instead.

### Audit trail *[§2.1]*

- [x] `GET /audit-trail/:auditId` (adds `userAgent`, which the list omits) + `GET /audit-trail/export` (CSV, UTF-8 BOM for Excel, 10k-row cap, filter-aware). `/export` is declared **before** `/:auditId` so it isn't swallowed by the param route — e2e-covered.
- [x] 🔒 **CSV formula injection fixed** (flagged by security review). Exported rows carry user-controlled text (`firstName`/`lastName`, `description`, `metadata`), and RFC4180 quoting does **not** stop Excel evaluating a leading `= + - @ TAB CR` — so a user named `=HYPERLINK(...)` could attack whoever opens the export. `csvCell` now prefixes such values with `'`. Verified with real payloads: no cell begins with a raw trigger, and the data stays readable.
- [x] Extracted a shared `buildAuditFilter()` so list and export can never drift
- [x] Frontend: detail modal now fetches full detail on open (shows `userAgent`); **Export CSV** button added to the toolbar and exports exactly the active filter selection

### Realtime decision *[§2.1, §2.2]* — **decided: OUT**

- [x] Confirmed the Phase 2 removal is complete: zero `socket.io` / `SocketProvider` / `useSocket` references in `front/src` or `back/server`, and `socket.io-client` is absent from `package.json`. No notifications bell/inbox was built (it would need the server half first). Revisit by adding a socket.io server + re-adding the client together.

### Frontend perf/a11y pass *[§4.1]*

- [x] Prod sourcemaps now `sourcemap: "hidden"` — `.map` files are emitted for Sentry upload but carry **no** `sourceMappingURL` comment, so they're never advertised to browsers (verified: 54 maps, 0 references). Upload + delete in CI.
- [x] Redundant Google Fonts `<link>` removed from `index.html` (fonts are self-hosted; verified absent from the built HTML)
- [x] `build:analyze` wired to `rollup-plugin-visualizer` → writes/opens `dist/stats.html`
- [x] `loading="lazy"` + `width`/`height` + `decoding="async"` on all 6 avatar/logo `<img>`s
- [x] `SuperAdmin/Dashboard/index.jsx` split **690 → 88 lines** (`RecentCompanies` extracted). `Sidebar.jsx` left alone — not touched this phase, so splitting it stays deferred.
- [x] `:focus-visible` ring for hand-rolled buttons/links + a global `prefers-reduced-motion` block (charts also skip their mount animation)

- ✅ *E2E-verified (23/23): both stats endpoints incl. 14-day series shape and plan breakdown, audit detail (with `userAgent`), unknown-id 404, and the CSV export's status/content-type/attachment/header/rows. Frontend lint clean, build green.*

---

## Phase 6 — Infra

### Tests *[§2.3]*

- [ ] Backend: Vitest/Jest + Supertest — auth flow (login/refresh/rotation/logout), `checkPermission`, **tenancy scoping** (admin A cannot read company B), `requireSuperAdmin`
- [ ] Frontend: Vitest + React Testing Library — `usePermissions`, `ProtectedRoute`, axios 401/refresh interceptor, one table-page hook
- [ ] `npm test` script in both packages

### CI *[§2.3]*

- [ ] Root `.github/workflows/ci.yml`: lint + build + test for both packages (path-filtered)
- [ ] Fold in the relocated security-audit workflow

### Docker *[§2.3]*

- [ ] `docker-compose.yml`: MySQL 8 + API + front (dev), with migration/seed on first boot
- [ ] Production Dockerfiles (multi-stage; front served statically)

### Seed & docs *[§2.3, §2.1]*

- [ ] Demo tenant seed: 1 company + branch + roles + a few users with varied permissions
- [ ] OpenAPI spec (generate from Zod schemas once Phase 3 lands) + Swagger UI in dev

---

## Done criteria

- [ ] All Phase 1 items verified by hand (403s, refresh rotation, shutdown exit 0)
- [ ] `npm run lint` + `npm run build` clean in `front/`; `npm run lint` clean in `back/`
- [ ] Fresh clone → `.env` from examples → `db:setup` → both apps boot with zero manual fixes
- [ ] IMPROVEMENTS.md findings re-audited: every 🔴/🟠 item closed or consciously deferred
