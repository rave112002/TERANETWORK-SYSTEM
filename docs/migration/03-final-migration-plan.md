# Final Migration Plan — Phase 3

**Created:** 2026-09-07
**Phase:** 3 of 8 (Create Migration Plan)
**Inputs:** [Phase 1 report](01-system-understanding-report.md) · [Phase 2 audit](02-v1-vs-v2-audit.md) ·
[decision log](00-decisions.md) · `back/CLAUDE.md` + `backend-conventions` · `front/CLAUDE.md` +
`frontend-conventions` · `new-module` skill
**Status:** documentation only — `front/` and `back/` still unmodified.

> **Source-of-truth order when documents disagree:**
> 1. The decision log (`00-decisions.md`) — the owner's live decisions
> 2. `PENDING-Billing-Model-Corrections.md` — corrected business rules
> 3. `back/CLAUDE.md` / `front/CLAUDE.md` + their skills — how code must be written here
> 4. The ISP master spec + implementation plan — what to build
> 5. V2 code, then V1 code — reference implementations, never authority

---

## 1. Resolved convention collisions

Six places where the old system and the target template genuinely disagree. Each is settled here so
Phase 4 never has to stop and think.

### C1 — Timestamps: UTC vs Asia/Manila local ✅ resolved in the target's favour

The ISP docs say "store UTC, compute in Asia/Manila". The target stores **Manila-local `DATETIME`**
with `timezone: "+08:00"` and `dateStrings: true`, so the driver performs no conversion and stored
values equal displayed values.

**Decision: follow the target.** This is not a compromise — it is strictly better here. The system
is single-site, in one timezone, forever. V2's `billing.dates.js` works **unchanged**: with
`dateStrings: true` a column returns the naive string `"2026-07-15 02:00:00"`, and
`moment.tz(naiveString, "Asia/Manila")` interprets it as Manila, which is exactly what the billing
math wants. The UTC↔Manila midnight boundary — the thing two of V2's tests exist to pin — stops
being a hazard because the conversion no longer happens.

**Consequence:** the two boundary tests in `billing.dates.test.js` must be re-based (they assert
UTC-storage behaviour that no longer applies). Everything else in that suite ports as-is.
All application timestamps come from `getCurrentTimestampLocal()` — never `NOW()`, `new Date()`
or `moment()` inline.

### C2 — Money: `decimalNumbers: true` makes the decimal library mandatory ✅

The target's pool returns `DECIMAL` columns as JS **numbers**. Safe to read, never safe to do
arithmetic on. V1's `money.js` comment says precisely this.

**Decision:** adopt `back/server/src/lib/money/money.js` (from V1, `decimal.js`) on day one of
billing work, and refactor V2's `invoice.calc.js` onto it. V2's 34 calc tests are the safety net —
they pin the unrounded-daily-rate result (₱619.35, not ₱619.36) and will catch any drift.

### C3 — Audit: route middleware vs in-transaction before/after ✅ both, one table

The target has `audit_trail` + an `auditTrail("module")` route middleware that logs **after** the
response. The ISP spec requires an immutable before/after record written **inside the same
transaction** as the change — non-negotiable given the disconnect capability.

**Decision:** keep one table. Add `back/server/src/utils/audit.js` exporting
`writeAudit(conn, { accountId, companyId, branchId, module, action, before, after })` that inserts
into `audit_trail` with `metadata = { before, after }`, using the caller's transaction connection.
Ordinary CRUD keeps the existing middleware; every **sensitive** mutation (disconnect, reconnect,
void, adjustment, payment, exemption, settings change, discovery import, outage-credit approval)
calls `writeAudit` in-transaction. Grant the app DB user no `UPDATE`/`DELETE` on `audit_trail`.

### C4 — IDs: numeric `id` vs business `varchar` ✅ target wins

V1/V2 pass numeric `id` in URLs and FKs. The target mandates a business `varchar` ID everywhere and
`SELECT UUID()` from MySQL for generation.

**Decision:** every ISP table gets `id BIGINT AUTO_INCREMENT` + a business ID
(`customerId`, `planId`, `subscriptionId`, `oltId`, `ponPortId`, `splitterId`, `napId`, `onuId`,
`invoiceId`, `paymentId`, `jobId`, …). Human-readable identifiers stay as separate columns:
`accountNo` (`ACC-000123`), `invoiceNo` (`INV-2026-000123`), `publicToken`.

⚠️ **Job dedupe keys change shape.** V2 uses `deactivate:onu:<numericId>`. It becomes
`deactivate:onu:<onuId>`. The sweep's key and the key payment settlement cancels **must** stay
byte-identical — V2 has a test asserting exactly this; port it.

### C5 — Deletes: soft-delete everywhere ✅ target wins

V2 mixes `is_active` flags, "retire" actions and hard deletes.

**Decision:** every ISP table carries `status ENUM(...,'Deleted')`; list queries filter
`status != 'Deleted'` unless an explicit `?status=` was passed. Domain lifecycle states stay in
their own column where they already exist and mean something different — `subscriptions.status`
(`pending|active|suspended|terminated`), `onus.provisioningState`, `invoices.status`. Those tables
get a **separate** `recordStatus` column for the soft delete so lifecycle and deletion never collide.

### C6 — Authorization: fixed roles vs permission rows ✅ target wins (per D1)

**Decision:** `requireRole(...)` disappears. Every ISP route group is gated by
`checkPermission(module, submodule, action)` — `read` for GET, `write` for POST/PUT/DELETE — using
the same module/submodule the frontend's `<ProtectedRoute>` uses. See the taxonomy in §6.3.

---

## 2. Migration order

Eleven stages. The ordering rule: **nothing that stores tenant data is built before branch scoping
exists**, and no table is created before the tables it references.

| Stage | Name | Why here | Gate to pass before moving on |
| --- | --- | --- | --- |
| **S0** | Branch scoping foundation | Every subsequent table stores `branchId`. Retrofitting isolation is how data leaks between branches. | A branch user provably cannot read another branch's row; existing modules still green. |
| **S1** | Platform prerequisites | Deps, env, `lib/` skeleton, money helpers, audit helper, test harness. | `npm run lint` + `npm test` green on both sides. |
| **S2** | BSS masters — Plans, Customers | No FK dependencies; smallest end-to-end proof of the whole pattern. | Both modules pass the `new-module` checklist. |
| **S3** | Network inventory — OLTs → PON ports → Splitters → NAPs → ONUs | Strict FK order. Credentials encryption lands with OLTs. | Topology tree + NAP map render seeded data. |
| **S4** | Subscriptions | Binds customer + plan + ONU; needs all three. | Lifecycle state machine enforced; terminate frees the ONU. |
| **S5** | Settings + jobs queue + worker | Everything automated depends on the queue and `DRY_RUN`. | A job enqueues, is claimed, completes, retries, dead-letters. |
| **S6** | OLT drivers + provisioning | Needs ONUs (S3) and the queue (S5). | Manual activate/deactivate via MockOltDriver, logged; DRY_RUN blocks execution. |
| **S7** | Billing | Needs subscriptions (S4) and the queue for email jobs (S5). | Cycle run twice produces exactly one invoice; email has PDF + QR + pay link. |
| **S8** | Xendit | Needs issued invoices (S7). | Test payment settles; replay is a no-op; bad token 401s. |
| **S9** | Dunning | Needs billing (S7), payments (S8) and provisioning (S6) — it is the join of all three. | Full lifecycle unattended against the mock driver; race test green. |
| **S10** | Discovery | Independent of billing; deliberately last of the ported work so it can't block the money path. | Mock sweep buckets matched/new/orphaned; import creates rows once, audited. |
| **S11** | Phase-6 surface | Dashboards, reports, observability, runbooks — needs real data from S2–S9. | Spec §10 acceptance criteria demonstrable end to end. |

S0–S10 are migration-prompt **Phase 4**; the integration/validation gates are **Phases 5–6**;
S11 plus the new features in §8 are **Phase 7**.

---

## 3. Files to migrate (copy with edits)

Source paths are relative to `OLD/TERANETWORK-ADMIN-BILLING-SYSTEM/backend/server/src/`
(V2) or `OLD/TERANETWORK/backend/server/src/` (V1). Destination paths are relative to
`back/server/src/`.

Legend for **Edit**: **L** = light (imports, ID/column renames) · **M** = medium (rescope to
branches, swap `requireRole` → `checkPermission`) · **H** = heavy (restructure).

### 3.1 Domain services — the core of the migration

| # | From | To | Edit | Notes |
| --- | --- | --- | --- | --- |
| 1 | V1 `utils/money.js` | `lib/money/money.js` | L | Adopt first; `decimal.js` dep. |
| 2 | V2 `lib/billing/billing.dates.js` | `lib/billing/billing.dates.js` | L | Works as-is under C1. Keep the 15th-of-month comment block verbatim. |
| 3 | V2 `lib/billing/invoice.calc.js` | `lib/billing/invoice.calc.js` | M | Refactor float `round2` onto `money.js`. |
| 4 | V2 `lib/billing/cycle.service.js` | `lib/billing/cycle.service.js` | M | Business IDs, `getCurrentTimestampLocal()`, branch attribution. |
| 5 | V2 `lib/billing/settlement.service.js` | `lib/billing/settlement.service.js` | M | Single settlement path — webhook, poller and manual payment all call it. |
| 6 | V2 `lib/billing/reminders.service.js` | `lib/billing/reminders.service.js` | M | |
| 7 | V2 `lib/dunning/dunning.service.js` | `lib/dunning/dunning.service.js` | M | Keep the JS-side grace computation (C1 makes it simpler, not obsolete). |
| 8 | V2 `lib/xendit/xendit.client.js` | `lib/xendit/xendit.client.js` | L | **Do not "improve" the casing or amount handling.** |
| 9 | V2 `lib/xendit/payment.service.js` | `lib/xendit/payment.service.js` | M | |
| 10 | V2 `lib/xendit/xendit.webhook.service.js` | `lib/xendit/xendit.webhook.service.js` | L | Port with its 28 tests, unmodified logic. |
| 11 | V2 `lib/xendit/reconciliation.service.js` | `lib/xendit/reconciliation.service.js` | M | |
| 12 | V2 `lib/jobs/jobs.queue.js` | `lib/jobs/jobs.queue.js` | M | `FOR UPDATE SKIP LOCKED` via `req.db.beginTransaction()`/`conn.execute`. |
| 13 | V2 `lib/jobs/processJob.js` | `lib/jobs/processing/provisioning.processor.js` | M | Split per §4-merge; keep the precondition re-check + DRY_RUN branch exactly. |
| 14 | V2 `lib/jobs/emailProcessor.js` | `lib/jobs/processing/email.processor.js` | M | |
| 15 | V2 `lib/jobs/{worker,dispatch}.js` | `lib/jobs/worker.js` | M | One claim loop, three typed handlers. |
| 16 | V2 `lib/olt-drivers/**` (7 files) | `lib/olt-drivers/**` | L | **Highest-fidelity port in the plan.** Bench-verified; change nothing but imports and ID types. |
| 17 | V2 `lib/mikrotik/**` (4 files) | `lib/mikrotik/**` | L | Interface + mock + stub. Real client is M22 (blocked). |
| 18 | V2 `lib/discovery/**` (3 files) | `lib/discovery/**` | H | Import path must create branch-scoped rows and use business IDs. |
| 19 | V2 `lib/email/serviceNotifications.js` | `lib/notifications/serviceNotifications.js` | M | Enqueue inside the state-flip transaction — preserve exactly. |
| 20 | V2 `lib/email/templates/*.js` (3) | `lib/mailer/templates/` | M | Merge into the target's existing `lib/mailer/`; branding from company settings (M6), not hardcoded. |
| 21 | V2 `lib/pdf/invoicePdf.js` | `lib/pdf/invoicePdf.js` | M | Same — branding from company settings. |
| 22 | V2 `lib/qr/qrcode_generate.js` | `lib/qr/qrcode.js` | L | Drop the unused badge templates and font files. |
| 23 | V2 `lib/scheduler/scheduler.js` | `lib/scheduler/scheduler.js` | L | Corrected crons already in place; keep `RUN_CRON` gate. |
| 24 | V2 `lib/settings/settings.service.js` | `lib/settings/settings.service.js` | M | **Keep `getGraceDays()`** — the `0 \|\| 3` fix. |
| 25 | V1 `lib/observability.js` + `utils/alerts.js` | `lib/observability/{index,alerts}.js` | M | `notifyNoc()` choke point for M9. |
| 26 | V1 `utils/csv.js` | `utils/csv.js` | L | For S11 reports. |

### 3.2 Tests — port with the code they cover

All nine V2 `*.test.js` files move alongside their subject. 193 tests, no DB or network, <2s.
Several exist specifically to make a business decision fail loudly if someone "tidies" it — notably
`serviceDaysInPeriod` taking no suspension parameter (asserted via `.length === 4`), and the sweep's
dedupe key matching what settlement cancels. **Port those assertions unchanged.**

### 3.3 Documentation and ops assets

| From | To |
| --- | --- |
| V2 `docs/vendor-transcripts/hsgq-xe04i/**` (3 files) | `docs/vendor-transcripts/hsgq-xe04i/` |
| V2 `docs/ISP-Admin-Billing-System-Prompt.md` + `ISP-Platform-Implementation-Plan.md` | `docs/reference/` (historical spec) |
| V2 `docs/phases/pending/PENDING-Billing-Model-Corrections.md` | `docs/reference/` — **live business rules, not history** |
| V1 `backend/docs/runbooks/*.md` (5) | `docs/runbooks/` — corrected per §5 of the audit |
| V1 `backend/scripts/backup-db.sh` | `back/scripts/backup-db.sh` |

---

## 4. Files to rebuild instead of copy

| What | Count | Rebuilt as |
| --- | --- | --- |
| **All V2 controllers** | 19 | Thin router in `controllers/v1/{admin,superadmin,public,webhooks}/`, Zod moved out to `validators/<entities>.validator.js`, `checkPermission` gating, tenant scope from `req.user`. |
| **All migrations** | 26 Sequelize `.cjs` | `back/database/schema.sql` (baseline) + numbered `back/database/migrations/NNN_*.sql`. No Sequelize, no `sequelize-cli`. |
| **All frontend screens** | ~18 pages | `front/src/pages/<Portal>/<Module>/{index.jsx, hooks.jsx, components/}` per `modern-module-pattern.md`. |
| **All frontend services** | ~45 V2 files / 3 V1 files | `services/api/admin/<entities>.js` (raw axios) + `services/requests/admin/<entities>.js` (React Query hooks + toasts + invalidation). |
| **Auth** | — | Not ported at all. The target's two-portal auth already exceeds V1 and V2. Extend it. |
| **Topology tree** | — | New component; Ant `Tree` has no shadcn equivalent. Hand-rolled recursive component over `@/components/ui/collapsible` — no new dependency. |
| **Dashboards** | V1's queries | Port the **SQL**; rebuild the pages with `recharts` (already a target dep) + `StatCard`. |

---

## 5. Dependencies

### 5.1 Install — `back/`

| Package | For | Notes |
| --- | --- | --- |
| `node-cron` | Scheduler | Four crons, gated by `RUN_CRON`. |
| `xendit-node` **v7** | Payments | Pin exactly; the version is part of the verified behaviour. |
| `@react-pdf/renderer` | Invoice PDF | Pure JS — deliberately not Puppeteer; the on-site box gets no headless Chromium. |
| `qrcode` | Pay-link QR | |
| `decimal.js` | Money (C2) | |
| `vitest` (dev) | Tests | The 193 ported tests need a runner. |
| `eslint`, `globals` (dev) | Lint | V2's lint was broken repo-wide for exactly this reason. Verify `back`'s config first. |

Deferred until unblocked: `node-routeros` (M22), `ssh2` (M27).
Not needed: telnet transport uses the built-in `net` module.

### 5.2 Install — `front/`

| Package | For |
| --- | --- |
| `leaflet` + `react-leaflet` | NAP / customer map |

Everything else is already present: `recharts` (dashboards), `@tanstack/react-table` (DataTable),
`react-hook-form` + `zod` + `@hookform/resolvers` (forms), `sonner`, `dayjs`, `lucide-react`.

### 5.3 Remove / clean up — `back/.env.example`

| Item | Action |
| --- | --- |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | **Delete.** The no-Redis decision is locked; leaving them implies an architecture we rejected. |
| `RATE_LIMIT_STORE` + `RATE_LIMIT_REDIS_*` | Set `RATE_LIMIT_STORE=memory`, delete the Redis trio. Single process, single box. |
| `ENABLE_EMAIL_WORKER` | Replace with `RUN_CRON` + `RUN_WORKER`. |

### 5.4 Add — `back/.env.example`

`RUN_CRON`, `RUN_WORKER`, `TIMEZONE=Asia/Manila`, `BILLING_CYCLE_CRON=0 2 15 * *`,
`DAILY_BILLING_CRON=0 8 * * *`, `DUNNING_CRON=0 20 * * *`, `RECONCILIATION_CRON=15 * * * *`,
`CREDENTIAL_MASTER_KEY`, `XENDIT_SECRET_KEY`, `XENDIT_CALLBACK_TOKEN`, `XENDIT_INVOICE_DURATION`,
`PAY_BASE_URL`, `VAT_RATE=0`, `MOCK_OLT_LATENCY_MS`, `MOCK_OLT_FAILURE_RATE`.

### 5.5 Never introduced

`antd`, `@ant-design/*`, `bullmq`, `redis`, `sequelize`, `sequelize-cli`, `express-validator`,
`bcrypt`, `passport-google-oauth20`, `lodash`, `uniqid`, `validator`, `xss`, `canvas`, `pdfkit`,
`puppeteer`, `@sendgrid/mail`, `he`, `react-highlight-words`.

---

## 6. Database changes

### 6.1 Changes to existing tables (S0)

| # | Change | Why |
| --- | --- | --- |
| 1 | **New `user_branches`** — `id`, `userBranchId`, `accountId` FK→`users.accountId`, `branchId` FK→`branches.branchId`, `status`, `dateCreated`, `dateUpdated`, `UNIQUE(accountId, branchId)` | D1: a user belongs to one *or several* branches. |
| 2 | `users.branchId` kept as the **primary/home branch** | Backwards-compatible; existing queries keep working while `user_branches` becomes the authority for access. |
| 3 | **New `companyProfile` fields** on `companies` or a settings namespace — logo, phone, email, address, TIN | D1/M6: invoice PDF and emails must read branding from here, not from hardcoded strings. |
| 4 | Seed the D1 roles — **Admin**, **Billing**, **Technician** — plus all §6.3 permission rows | Without a permission row a page is invisible and its API 403s. |

⚠️ **`user_branches` changes the scoping predicate everywhere.** Every tenant query moves from
`WHERE branchId = ?` to `WHERE branchId IN (…)`. That is **14 existing files** (branches 26
occurrences, superadmin users 16, roles 11, upload 8, admin users 8, settings 8, dashboard 8,
auditTrail middleware 6, audit-trail controller 6, plus 5 with 1–2 each). Build **one** helper —
`getScopedBranchIds(req)` returning the caller's branch list (Superadmin ⇒ all) — and a
`branchScope()` SQL fragment builder. Do not hand-write 40 `IN` clauses.

### 6.2 New ISP tables

All follow the target shape: `id BIGINT AUTO_INCREMENT` + business `varchar` ID, camelCase columns,
`DATETIME` Manila-local `dateCreated`/`dateUpdated`, `utf8mb4`, InnoDB, FKs on business IDs.

| Stage | Table | Branch attribution | Key constraints to preserve |
| --- | --- | --- | --- |
| S2 | `plans` | `companyId` + **nullable `branchId`** (NULL = available to all branches) | money `DECIMAL(12,2)` |
| S2 | `customers` | `companyId` + `branchId` | `UNIQUE(accountNo)`; `email` NOT NULL |
| S3 | `olts` | `companyId` + `branchId` | `UNIQUE(name)`; `credentialsEnc VARBINARY(2048)` |
| S3 | `ponPorts` | inherit via `oltId` | `UNIQUE(oltId, portIndex)` |
| S3 | `splitters` | inherit | polymorphic `parentType`/`parentId`, validated in the service layer |
| S3 | `naps` | inherit | GPS NOT NULL |
| S3 | `onus` | `branchId` denormalised | `UNIQUE(serialNo)`, `UNIQUE(mac)`, `UNIQUE(napId, napPort)` |
| S4 | `subscriptions` | `branchId` denormalised | `UNIQUE(onuId)`; `statementDay` 1–28 |
| S5 | `systemSettings` | company-wide | `DRY_RUN`, `GRACE_DAYS`, `VAT_RATE`, `RECONNECTION_FEE_ENABLED` |
| S5 | `jobs` | `branchId` for filtering | `idx_jobs_claim(status, nextRunAt, id)`, `idx_jobs_dedupe(dedupeKey, status)` |
| S6 | `networkActionLogs` | inherit via `onuId` | append-only; server-side timestamps only (device clock is unreliable) |
| S7 | `invoiceCounters` | company-wide | per-year sequence |
| S7 | `invoices` | `branchId` denormalised | **`UNIQUE(subscriptionId, billingPeriodStart)`**, `UNIQUE(invoiceNo)`, `UNIQUE(publicToken)`, `idx(status, dueDate)` |
| S7 | `invoiceLines` | inherit | signed `amount`; `kind` enum |
| S7 | `payments` | inherit | **`UNIQUE(xenditPaymentId)`** |
| S7 | `pendingCharges` | inherit | `appliedInvoiceId IS NULL` is the idempotency guard |
| S7 | `emailEvents` | inherit | |
| S8 | `webhookEvents` | company-wide | **`UNIQUE(provider, eventId)`** |
| S9 | `dunningExemptions` | inherit | `reason` and `expiresAt` both NOT NULL, deliberately |
| S10 | `discoveryRuns` | `branchId` | |
| S10 | `discoveredItems` | inherit | `idx(runId, matchStatus)`, `idx(externalKey)` |

**The four uniques in bold are the system's idempotency guarantees** — no double-billing, no
double-settlement, no double-webhook. They are not optimisations; losing one is a money bug.

### 6.3 Permission taxonomy

Seeded into `permissions` **and** `back/scripts/setup-database.js`, each granted to Owner + the
roles below.

| module | submodule | Admin | Billing | Technician |
| --- | --- | --- | --- | --- |
| `dashboard` | — | rw | r | r |
| `customers` | — | rw | rw | r |
| `plans` | — | rw | rw | — |
| `subscriptions` | — | rw | rw | r |
| `network` | `topology` | rw | r | rw |
| `network` | `olts` | rw | — | rw |
| `network` | `pon_ports` | rw | — | rw |
| `network` | `splitters` | rw | — | rw |
| `network` | `naps` | rw | — | rw |
| `network` | `onus` | rw | r | rw |
| `network` | `provisioning` | rw | — | rw |
| `network` | `action_logs` | r | r | r |
| `network` | `discovery` | rw | — | rw |
| `billing` | `invoices` | rw | rw | — |
| `billing` | `payments` | rw | rw | — |
| `billing` | `dunning` | rw | rw | r |
| `billing` | `exemptions` | rw | rw | — |
| `billing` | `reconciliation` | rw | rw | — |
| `reports` | — | rw | rw | r |
| `outages` | — | rw | rw | rw |
| `users` / `settings` / `audit_trail` | existing | rw | — | — |

The `auditor` role from the old docs is **dropped** (D1). Read-only access is now expressed by
granting `read` without `write`.

---

## 7. Frontend / backend integration tasks

### 7.1 Admin portal — module map

| Sidebar group | Page | Route | Permission | Source |
| --- | --- | --- | --- | --- |
| — | Dashboard | `/admin/dashboard` | `dashboard` | V1 SQL, new page |
| Customers | Customers | `/admin/customers/customers` | `customers` | rebuild |
| | Subscriptions | `/admin/customers/subscriptions` | `subscriptions` | rebuild |
| | Plans | `/admin/customers/plans` | `plans` | rebuild |
| Network | Topology | `/admin/network/topology` | `network`/`topology` | **new component** |
| | OLTs | `/admin/network/olts` | `network`/`olts` | rebuild |
| | PON Ports | `/admin/network/pon-ports` | `network`/`pon_ports` | rebuild |
| | Splitters | `/admin/network/splitters` | `network`/`splitters` | rebuild |
| | NAPs | `/admin/network/naps` | `network`/`naps` | rebuild (+ map) |
| | ONUs | `/admin/network/onus` | `network`/`onus` | rebuild (+ provision actions, logs drawer) |
| | Discovery | `/admin/network/discovery` | `network`/`discovery` | rebuild |
| | Action Logs | `/admin/network/action-logs` | `network`/`action_logs` | V1 screen, new page |
| Billing | Invoices | `/admin/billing/invoices` | `billing`/`invoices` | rebuild |
| | Payments | `/admin/billing/payments` | `billing`/`payments` | V1 screen, new page |
| | Dunning | `/admin/billing/dunning` | `billing`/`dunning` | rebuild |
| | Reconciliation | `/admin/billing/reconciliation` | `billing`/`reconciliation` | V1 screen, new page |
| | Reports | `/admin/billing/reports` | `reports` | V1 screen, new page |
| System | Settings / Audit Trail | existing | existing | extend |

Registration is one array in `front/src/routes/pageRoutes/AdminRoute.jsx` — lazy import + nav entry
+ `<ProtectedRoute>` per the `new-module` step 12.

### 7.2 SuperAdmin portal (per D1)

| Task | Note |
| --- | --- |
| **Company profile page** | Single-company edit: TERANETWORK logo, phone, email, address. The existing Companies *list* becomes a single-company view — confirm with the owner whether to keep the list UI or collapse it to one detail page. |
| **Branch management** | Exists; verify it covers create/edit/deactivate for the two Taguig branches and any future ones. |
| **User + branch assignment** | Extend the existing SuperAdmin Users page with a multi-select branch assignment writing `user_branches`. |
| **System settings** | `DRY_RUN` toggle (+ the global warning banner), `GRACE_DAYS`, `VAT_RATE` — Superadmin only. |

### 7.3 Public surface (no auth)

| Task | Note |
| --- | --- |
| `GET /api/v1/public/invoices/:token` | Rate-limited, customer-safe fields only, 404 on bad token. |
| `front` route `/pay/:token` | Outside both portal guards, registered in `routes/index.jsx` alongside `/`. |
| `POST /webhook/xendit` | **Mounted before the security stack** in `config/express.js` with its own `express.raw()`. Three production-only landmines this avoids — CORS rejecting no-Origin requests, the User-Agent gate, and the body sanitiser destroying the raw payload — are documented in V2's Phase 4 notes. Preserve the mounting position exactly. |
| `GET /webhook/xendit` | Reachability check for the port-forward; reveals nothing. |

### 7.4 Cross-cutting integration

- **Worker entry point** — `back/server/bin/worker.js` beside `www.js`; `npm run worker` /
  `worker:dev`; graceful shutdown; gated by `RUN_WORKER`.
- **Response envelope** — every ISP endpoint returns
  `res.sendSuccess(message, { <entities>, pagination })`; the frontend unwraps
  `apiData?.data?.<entities>`.
- **Phone fields** — customers use `optionalPhone()` server-side and `zPhone` +
  `formatPhoneOnChange` + `PHONE_PLACEHOLDER` client-side. Format is `09XX XXXX XXX`.
- **DRY_RUN banner** — global, visible to every user when on.

---

## 8. Remaining development tasks (Phase 7)

Ordered by value, per the PENDING doc's suggested sequence.

| # | Task | Blocked? |
| --- | --- | --- |
| M8 | Race-safety test — payment lands between enqueue and claim, assert no disconnect | no |
| M9 | Alerting — dead-letter, OLT-unreachable streaks, sweep failures → NOC email + structured log | no |
| M10 | Full unattended lifecycle e2e against MockOltDriver | no |
| M20 | End-of-month second invoice batch for post-15th signups, prorated | no |
| M18 | **Outage credits** — `outageEvents` + per-customer impact table; `hourlyRate = monthlyPrice ÷ daysInMonth ÷ 24`; **4-hour minimum per outage** (not per month); month-boundary outages use the starting month's rate; self-suspended customers auto-excluded but **shown in a separate "excluded" list**; credits applied only on staff approval via `pendingCharges` with a negative amount | no |
| M11–M17 | Phase-6 surface — dashboards, exports, observability, security pass, backups, runbooks, data export/anonymize | no |
| M23 | `/auth/refresh` for the ISP portals | no |
| M21 | Automatic outage detection — MikroTik session polling, many-on-one-NAP heuristic. **"No monitoring data" must read as *unknown*, never as *everyone was online*** | deferred by client |
| M22 | Real MikroTik `RouterOsClient` | **blocked** — needs router IP, RouterOS version, API/port, read-only user, sample output |
| M19 | 60-day blacklist / revocation + work order | **blocked** — six unanswered questions |
| M24–M28 | Hardware + production-route verification | **blocked** — needs bench access |

---

## 9. Validation & testing requirements

### 9.1 Per-stage gate (every stage)

```bash
cd back  && npm run lint && npm test
cd front && npm run lint && npm run build
```

Plus the `new-module` `references/checklist.md` for each CRUD module built.

### 9.2 Test suites to have green before Phase 6 exits

| Suite | Count | Source |
| --- | --- | --- |
| `billing.dates` | 18 | V2 (2 boundary tests re-based per C1) |
| `invoice.calc` | 34 | V2 (re-based onto `money.js`) |
| `settlement.service` | 22 | V2 |
| `xendit.webhook.service` | 28 | V2 |
| `payment.service` | 18 | V2 |
| `reconciliation.service` | 21 | V2 |
| `dunning.service` | 25 | V2 |
| `serviceNotifications` | 12 | V2 |
| `settings.service` | 15 | V2 (`getGraceDays()` regressions) |
| **`branchScope`** | new | **A branch user must not read another branch's customer, invoice, ONU or job.** Highest-value new test in the plan. |
| `hsgq.commands` / `hsgq.parsers` | new | Against the real bench transcripts |
| `money` | new | Rounding, sums, `amountsEqual` |

### 9.3 End-to-end acceptance (spec §10 — the definition of done)

1. Subscriber fully provisioned; appears in the topology tree and on the NAP map.
2. On the statement date an invoice is auto-generated and emailed with a working Pay-Now link and a
   scannable QR resolving to the same payment.
3. Paying via Xendit marks the invoice paid within seconds and reconnects a suspended ONU.
4. A subscriber unpaid past `dueDate + GRACE_DAYS` is deactivated at the OLT — with a logged device
   command and response and a suspension email — and reactivated automatically on later payment.
5. Every disconnect/reconnect is permission-gated, idempotent, retried, alertable and audited.
6. Dry-run mode and MockOltDriver demonstrate the entire flow without hardware.

### 9.4 Invariants to assert, not assume

- **State only after confirmation** — no ONU or subscription is ever marked `suspended`/`active`
  without a successful device response, in the same transaction as the `networkActionLogs` insert.
  Proven live in V2 against a genuinely unreachable OLT; keep it provable.
- **Reruns are free** — the billing cycle, the dunning sweep, webhook delivery and discovery import
  can all run twice with no second effect.
- **Grace of 0 means 0** — a regression test on `getGraceDays()`.
- **Suspension does not reduce the bill** — `serviceDaysInPeriod` takes no suspension parameter.
- **Whole pesos to Xendit** — never `* 100`.
- **Branch isolation holds** — §9.2's `branchScope` suite.

---

## 10. Risks and how the order mitigates them

| Risk | Mitigation |
| --- | --- |
| Branch isolation leaks | S0 is first; one shared scoping helper; a dedicated test suite. |
| Corrected business rules lost in the port | Constants re-checked against the PENDING doc, never against V1/V2 code; V2's pinning tests ported with the code. |
| Money drifts to float | `money.js` adopted in S1, before any billing code exists. |
| Xendit casing / amount trap | Port `xendit.webhook.service.js` and its 28 tests verbatim; explicit "do not improve" note in §3.1. |
| Dedupe key divergence after the ID change (C4) | The sweep key and the settlement-cancel key change together, with the existing test asserting they match. |
| Frontend rewrite balloons | Every page follows `Roles` as the template; only the map and the tree are genuinely new. |
| Scope creep into blocked features | M19/M22 parked explicitly; not on any stage's critical path. |

---

## 11. Phase 3 exit check

| Deliverable item | Status |
| --- | --- |
| 1. Migration order | ✅ §2 |
| 2. Files / components / services to migrate | ✅ §3 |
| 3. Files to rebuild instead of copy | ✅ §4 |
| 4. Dependencies to install / remove | ✅ §5 |
| 5. Database changes | ✅ §6 |
| 6. Frontend / backend integration tasks | ✅ §7 |
| 7. Remaining development tasks | ✅ §8 |
| 8. Validation / testing requirements | ✅ §9 |
| Convention conflicts resolved before coding | ✅ §1 |
| `front/` and `back/` unmodified | ✅ |

**One open question for the owner, needed before S0 finishes:** whether the SuperAdmin *Companies*
list page stays as a list (with exactly one row) or collapses into a single "Company Profile" detail
page (§7.2). Everything else in S0–S10 is decided.
