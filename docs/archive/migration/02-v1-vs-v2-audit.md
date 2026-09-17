# V1 vs V2 Audit — Phase 2

**Created:** 2026-09-07
**Phase:** 2 of 8 (Audit & Compare)
**Inputs:** [Phase 1 report](01-system-understanding-report.md), [decision log](00-decisions.md)
**Rule applied:** V2 is the primary source, but V1 is mined deliberately — neither is copied blindly.

- **V1** = `OLD/TERANETWORK` — 8–9 Jul 2026, 4 commits. Reached across the whole roadmap fast.
- **V2** = `OLD/TERANETWORK-ADMIN-BILLING-SYSTEM` — 20 Jul – 11 Aug 2026, 10 commits. Rebuilt from a
  fresh template with tests, docs and hardware verification. Stopped mid-Phase-5.
- **Target** = `front/` + `back/` — a multi-tenant admin template with **zero ISP domain**.

---

## 1. Comparison by area

| Area | V1 | V2 | Final decision | Reason |
| --- | --- | --- | --- | --- |
| **Architecture** | Express modular monolith + `worker/` with 3 processors. Queue = **BullMQ + Redis**. Layers: `services/` for domain, `lib/` for integrations. | Same monolith, `bin/worker.js` single entry. Queue = **MySQL `jobs` table** (client decision, no Redis). All domain logic under `lib/`. | **V2's shape.** API and worker as separate `bin/` entries; `node-cron` only enqueues; worker claims with `FOR UPDATE SKIP LOCKED`. Keep V1's *idea* of separate typed processors as functions inside V2's dispatcher. | The no-Redis decision is locked by the client and V2 is the only implementation of it. V2's job table is inspectable by SQL, which matters on an unattended on-prem box. |
| **Frontend** | React 19 + **Ant Design** + a *generic* resource layer (`resources.js` + `useResourceQuery` + `<ResourceTable>` = 3 files driving every page; Plans page is 67 lines). | React 19 + **Ant Design** + per-resource `api`/`query`/`mutation` triplets (~45 files). Pages are large and hand-written. | **Rewrite both.** Target `front/` is shadcn/ui with a mandated `pages/<Portal>/<Module>/{index.jsx, hooks.jsx, components/}` layout and `services/api/` + `services/requests/` split. Neither old service layer survives. | Ant Design → shadcn/ui is a total rewrite of the view layer, and the target already has a better-specified answer than either old version. V1's generic layer is elegant but conflicts with the mandated `hooks.jsx` contract. |
| **Backend** | Thin controllers via `utils/crudFactory.js` (36–80 LOC each). camelCase columns. Broad but shallow — 8 test files, 453 LOC of tests. | Thick explicit controllers (230–340 LOC each). snake_case columns. Deep — 193 tests across 9 files, ~2,700 LOC. Bench-verified drivers, live-verified Xendit. | **V2's logic, target's controller shape.** Port V2's `lib/*` services almost verbatim; rewrite its controllers to the target's pattern (thin router + `server/src/validators/*.validator.js` + `checkPermission`). | Business logic is where the 193 tests live and where the money and disconnect risk sit. Controllers are the cheap part and must match `back/CLAUDE.md`. |
| **Database** | Sequelize CLI `.cjs`, camelCase columns, auto-inc business-ish PKs (`customerId`). | Sequelize CLI `.cjs`, snake_case columns, plain auto-inc `id`. More tables (jobs, discovery, webhook_events, pending_charges). | **Rebuild against the target's conventions.** V2's *table set and constraints* are the spec; the physical shape becomes target-style: `id BIGINT` + business `varchar` ID, camelCase columns, `status='Deleted'` soft delete, `branchId` scoping, `schema.sql` + numbered `.sql` migrations (no Sequelize). | `back/` records `schema.sql` as applied and never re-runs it; adopting Sequelize would fork the migration story in two. Constraint semantics (the idempotency uniques) are what actually matter and they port cleanly. |
| **Features** | Has Phase 6 breadth V2 never reached: dashboards, CSV reports, users admin UI, audit-log viewer, data export/anonymize, 5 runbooks, backup script, alerts + Sentry hook. | Has depth V1 never reached: Device Discovery, bench-correct HSGQ driver, live-verified Xendit, `pending_charges`, dunning exemptions UI, corrected billing calendar. | **Merge — V2 as the base, V1 for the Phase 6 surface.** | This is the single most important finding: treating V2 as strictly superior would silently drop ~8 finished features. |
| **Configuration** | `.env` with Redis/BullMQ, `BILLING_CYCLE_CRON` on the 1st, `GRACE_DAYS=3`, ₱2,000 reconnection fee. | `.env` with no Redis, crons already corrected (`0 2 15 * *`, `0 20 * * *`), `GRACE_DAYS=0`, reconnection fee disabled. | **V2's values, verified against the PENDING doc.** Strip Redis from `back/.env.example`. | V1's config encodes business rules the client has since corrected. Copying it forward would reintroduce known-wrong behaviour. |

---

## 2. Keep from V1

Each of these exists only in V1 and is worth carrying forward. All need re-basing onto the target's
conventions (camelCase already matches; `requireRole` → `checkPermission`; add branch scoping).

| Item | Path in V1 | Note |
| --- | --- | --- |
| **Money helpers** (`decimal.js`) | `server/src/utils/money.js` | V2 does float `round2` + integer-centavo comparison. Both docs say "use a decimal library — never float arithmetic on prices". V1 is the one that actually complies. |
| **Admin + network dashboards** | `controllers/v1/cms/dashboard.controller.js` (221 LOC) | `/summary`, `/billing` (collections, aging receivables, recent payments/disconnects), `/network`. Spec §3.9, Phase 6 step 1–2. |
| **CSV reports** | `controllers/v1/cms/reports.controller.js` + `utils/csv.js` | Invoices, payments, network-action log exports. Spec §3.9. |
| **Audit-log viewer API** | `controllers/v1/cms/auditLogs.controller.js` | V2 writes audit rows but gives staff no way to read them. |
| **Staff user management** | `controllers/v1/cms/users.controller.js` (268 LOC) | V2's equivalent is an 8-line empty stub. *Largely superseded by the target's own users/roles module — mine it only for ISP-specific bits.* |
| **NOC alerting hook** | `utils/alerts.js` + `lib/observability.js` | Phase 5 step 7, which V2 left unbuilt. Central `notifyNoc()` choke point + Sentry capture. |
| **Data export / anonymize** | `controllers/v1/cms/customers.data.controller.js` | Phase 6 step 7: subject-access export and PII scrub that retains financial records for PH BIR. |
| **Ops runbooks** | `backend/docs/runbooks/*.md` (5 files) | OLT-unreachable, webhook outage/replay, mass reconnect, dry-run driver rollout, backup/restore. Phase 6 exit criteria require one runbook per failure mode. |
| **DB backup script** | `backend/scripts/backup-db.sh` | Phase 6 step 6. |
| **Frontend screen inventory** | `pages/CMS/{Reports,settings/AuditLog,settings/System,settings/Users,network/ActionLogs,billing/Payments,billing/Reconciliation}.jsx` | Not the code — the *list of screens* V2 never built. |

---

## 3. Keep from V2

The core of the migration. These port with light edits.

| Item | Path in V2 | Why V2's version wins |
| --- | --- | --- |
| **HSGQ OLT driver** | `lib/olt-drivers/hsgq/{commands,parsers,telnet,driver}.js` | Bench-corrected against real hardware. V1's is pre-bench guesswork with a wrong column layout and uses `onu-authorize` (a *global* command) for reconnect. |
| **Driver contract + MockOltDriver** | `lib/olt-drivers/{driver.interface,mock.driver,index}.js` | Richer mock (configurable latency/failure rate, HSGQ-flavoured transcripts, seeded lab ONU) — it is the backbone of every e2e test. |
| **MySQL job queue + worker** | `lib/jobs/{jobs.queue,processJob,worker,dispatch,emailProcessor}.js` | Implements the locked no-Redis decision. Retries/backoff/dead-letter/cancel as table columns, behind an `enqueue/claim/complete/fail/cancel` interface. |
| **Billing date math** | `lib/billing/billing.dates.js` | Encodes the corrected calendar (15th / due 2nd) *with the reasoning inline*, plus tests pinning the Manila↔UTC midnight boundary. |
| **Invoice computation** | `lib/billing/invoice.calc.js` | Client-confirmed proration rule (`monthly ÷ days-in-month × service days`). V1 uses the spec's placeholder `× 12 ÷ 365`, which the client superseded. |
| **Cycle engine** | `lib/billing/cycle.service.js` | Transactional, idempotent via `UNIQUE(subscription_id, billing_period_start)`, enqueues the email in the same transaction. |
| **Settlement** | `lib/billing/settlement.service.js` | One shared `settleInvoice()` used by the webhook, the poller and manual payments — they cannot drift. 22 tests. |
| **Reminders / overdue** | `lib/billing/reminders.service.js` | Due−2 reminder + `issued → overdue` transition. |
| **Xendit integration** | `lib/xendit/{xendit.client,payment.service,xendit.webhook.service,reconciliation.service}.js` | Uses `xendit-node` v7 and is the only version **verified live** (real GCash test payment, 2026-08-04). Encodes the camelCase/snake_case split, whole-peso amounts, timing-safe token compare, and the status-embedded dedupe key. V1 hand-rolls axios calls. |
| **Webhook route mounting** | `controllers/v1/webhooks/xendit.webhook.js` + its position in `config/express.js` | Mounted *before* the security stack with its own `express.raw()`. Three production-only landmines documented (CORS no-Origin, User-Agent gate, body sanitiser) and proven live. |
| **Dunning engine** | `lib/dunning/dunning.service.js` + tests | Selection query where every clause is a reason *not* to disconnect; grace computed in JS (Manila) not SQL (UTC); dedupe key matched to what payment settlement cancels. |
| **Service notifications** | `lib/email/serviceNotifications.js` | Queued inside the same transaction as the state flip; per-invoice-and-kind dedupe key. |
| **Device Discovery** | `lib/discovery/*` + `controllers/v1/cms/discovery.controller.js` | Does not exist in V1 at all. The bootstrap path for the ~200 existing ONUs. |
| **MikroTik seam** | `lib/mikrotik/*` | Interface + mock + a stub for the real client. Not functional, but the right shape. |
| **PDF + QR** | `lib/pdf/invoicePdf.js`, `lib/qr/qrcode_generate.js` | `@react-pdf/renderer` — pure JS, no headless Chromium to install on the on-site box. V1 uses pdfkit. |
| **Scheduler** | `lib/scheduler/scheduler.js` | Four crons with the corrected times, gated by `RUN_CRON`. |
| **Settings service** | `lib/settings/settings.service.js` | Contains the `getGraceDays()` fix for the `0 \|\| 3` bug class. |
| **Test suite** | 9 `*.test.js` files, 193 tests, no DB or network needed | Runs in <2s. Several tests exist specifically to make a business decision fail loudly if someone "tidies" it. |
| **Vendor transcripts + bench report** | `docs/vendor-transcripts/hsgq-xe04i/` | The only hardware truth in either repo. |

---

## 4. Merge (take from both)

| Concern | Base | Merge in | Result |
| --- | --- | --- | --- |
| **Money arithmetic** | V2's `invoice.calc.js` logic and tests | V1's `utils/money.js` (`decimal.js`) | Same computation, exact decimal arithmetic. Re-run V2's 34 calc tests against it — they pin the unrounded-daily-rate behaviour (₱619.35, not ₱619.36) and will catch any drift. |
| **Worker** | V2's `worker.js` + `dispatch.js` | V1's per-type processor separation (`provisioning`/`email`/`billing`) | One claim loop, three clearly separated handlers. Easier to reason about than V2's growing dispatcher. |
| **Observability** | V2's structured logging | V1's `lib/observability.js` + `utils/alerts.js` | `notifyNoc()` wired to dead-letter, OLT-unreachable streaks and sweep failures — Phase 5 step 7, which neither version finished. |
| **Invoice service** | V2's split (`cycle` / `invoice.calc` / `settlement`) | Nothing — V1's 495-LOC `invoice.service.js` is a monolith | Keep V2's split; note V1's file only as a checklist of endpoints it exposed. |
| **Runbooks** | V1's 5 runbooks | V2's corrected facts (grace 0, sweep 20:00, blacklist-based suspend, dedupe keys) | Runbooks that describe the system we are actually shipping. |

---

## 5. Rewrite (do not port the code; rebuild against target conventions)

| Item | Why |
| --- | --- |
| **Every frontend screen** | Ant Design → shadcn/ui. Rebuild each as `pages/<Portal>/<Module>/{index.jsx, hooks.jsx, components/}` per `frontend-conventions`. Keep the screen list and UX decisions; discard the JSX. |
| **Every backend controller** | V2's controllers embed their Zod schemas and use `requireRole`. Target wants a thin router + `server/src/validators/<x>.validator.js` + `checkPermission(module, submodule, action)`. Mechanical but touches all 19. |
| **All migrations** | Sequelize `.cjs` → `database/schema.sql` + numbered `.sql`, with target-style columns, business IDs, soft deletes and `branchId`. |
| **Auth** | Target's auth (two portals, `credentials` table, permission rows, refresh + password-reset tokens) already exceeds both old versions. Do not port V1/V2 auth; extend the target's. |
| **RBAC** | `requireRole(super_admin\|billing\|noc\|auditor)` → permission rows for the D1 roles (Admin / Billing / Technician) + a Superadmin portal. Every ISP route needs a `permissions` row seeded. |
| **Topology tree** | Ant `Tree` has no shadcn equivalent — needs a headless tree library or a hand-rolled recursive component. |

---

## 6. Discard

| Item | Where | Why |
| --- | --- | --- |
| **BullMQ / Redis queue** | V1 `lib/queue/index.js`, `bullmq` dep, `REDIS_*` in `back/.env.example` | Client decision: MySQL `jobs` table, no Redis. The env vars in the target are misleading leftovers. |
| **V1 vendor transcripts** | `TERANETWORK/backend/docs/vendor-transcripts/` | Fabricated (dated before the bench test, wrong `show onu-info all` layout). Actively dangerous — they would validate a broken parser. |
| **V1 HSGQ driver** | `lib/olt/drivers/hsgq/*` | Pre-bench guesswork; uses the global `onu-authorize` for per-ONU reconnect. |
| **V1 proration rule** | `utils/proration.js` (`× 12 ÷ 365`) | Superseded by the client-confirmed `÷ days-in-month` rule. Keep the file only as a reference for `money.js`. |
| **V1 `crudFactory.js`** | `utils/crudFactory.js` | Elegant, but generates controllers that don't match `back/CLAUDE.md`'s mandated shape and hide the tenant scoping that now has to be explicit. |
| **V1/V2 generic frontend resource layer** | `resources.js`, `useResourceQuery.js`, `ResourceTable.jsx`, and V2's 45 api/query/mutation files | The target's `hooks.jsx` + `DataTable` contract replaces both. |
| **SendGrid template dump** | Both: `lib/sendgrid/` (450 LOC + 7 unrelated HTML emails) | Dead template code from a different project (visitor confirmations, merchandise orders). `back/lib/mailer/` already covers sending. |
| **`lib/xendit/invoice.js`** | V2 (already flagged in its own Phase 4 doc) | Unused dead template file with a misleading hardcoded channel list. |
| **`dist/` build output** | Both frontends | Build artifacts. |
| **V2 sample/demo scaffolding** | `authSampleApi.js`, `sampleApi.js`, `useSampleStore.js`, `pages/CMS/{Feature,Home,Accounts}.jsx` | Template leftovers, unreferenced. |
| **`express-validator`, `bcrypt`, `passport-google-oauth20`, `lodash`, `uniqid`, `validator`, `xss`, `canvas`** | Both backends' `package.json` | Unused or superseded (Zod, argon2, no OAuth). `canvas` in particular is a native build the on-site box does not need. |
| **`@ant-design/*`, `antd`, `react-highlight-words`, `he`** | Both frontends | Replaced by shadcn/ui + lucide-react. |

---

## 7. Missing / to build

Nothing below exists in a usable form in V1, V2 **or** the target.

### 7.1 From decision D1 — branch scoping (new, not in any old version)

| # | Item | Note |
| --- | --- | --- |
| M1 | **`user_branches` join table** | The template puts a single `branchId` on `users`; D1 requires one user → many branches. |
| M2 | **Branch-aware scoping helper** | Every tenant query changes from `WHERE branchId = ?` to `WHERE branchId IN (…assigned)`. Needs one shared helper, not 40 hand-written `IN` clauses. |
| M3 | **Existing modules re-based onto M1/M2** | users, roles, audit-trail, settings all assume the single-column form today. |
| M4 | **Branch assignment UI** (Superadmin) | Assign/reassign users to branches. |
| M5 | **`branchId` on every ISP table** | Customers, subscriptions, invoices, OLTs, NAPs, ONUs, jobs, dunning rows. Decide per table whether branch is *inherited* (invoice ← subscription) or *stored* (denormalised for query speed). |
| M6 | **Company-info management** (Superadmin) | TERANETWORK logo, phone, email — and the invoice PDF/email templates must read from it instead of hardcoded branding. |
| M7 | **Permission rows for every ISP module** | ~15 modules × read/write, seeded and mapped to Admin / Billing / Technician. |

### 7.2 Unfinished in V2 (Phase 5 steps 6–8)

| # | Item |
| --- | --- |
| M8 | Race-safety test — payment landing between enqueue and worker claim asserts no disconnect |
| M9 | Alerting — dead-letter, OLT-unreachable streaks, sweep failures → NOC email + structured log |
| M10 | Full unattended lifecycle e2e against MockOltDriver |

### 7.3 Phase 6 (V1 has partial answers, nothing is finished)

| # | Item |
| --- | --- |
| M11 | Dashboards — admin KPIs + aging receivables, network health/capacity *(port from V1)* |
| M12 | CSV/PDF exports *(port from V1)* |
| M13 | Observability — request IDs, `/healthz` + `/readyz`, `jobs`-depth metrics + dead-count alert |
| M14 | Security pass — helmet/CORS/rate limits review, dependency audit, DB least-privilege (no UPDATE/DELETE on audit) |
| M15 | Backups + restore drill *(script from V1)* |
| M16 | Runbooks *(port from V1, corrected)* |
| M17 | Data export / anonymize *(port from V1)* |

### 7.4 Never built anywhere — new features

| # | Item | Status |
| --- | --- | --- |
| M18 | **Outage credits** — `outage_events` + per-customer impact table, 4-hour floor, hourly-rate maths, staff approval, auto-exclusion of self-suspended customers | Fully specified in the PENDING doc. Buildable now. |
| M19 | **60-day blacklist / revocation** — permanent MAC blacklist, work order for modem + drop-line recovery, NAP port release | **Blocked** — six open client questions (auto vs confirmed, reinstatement, modem ownership, 60-days-from-what, port release timing, status naming). |
| M20 | **End-of-month second invoice batch** — for customers who signed up after the 15th, prorated | Specified in the PENDING billing calendar. |
| M21 | **Automatic outage detection** — MikroTik PPPoE session polling, many-on-one-NAP heuristic, "no data ≠ everyone online" | Deliberately deferred to Phase 6 by the client. |
| M22 | **Real MikroTik `RouterOsClient`** | **Blocked** — needs router IP, RouterOS version, API port, read-only credentials, sample output. |
| M23 | **`/auth/refresh` endpoint for the ISP portals** | Target has refresh-token infrastructure; V1/V2 never wired it. |

### 7.5 Hardware / operations blockers (do not block migration)

| # | Item |
| --- | --- |
| M24 | Live HSGQ deactivate → >10 min down → reactivate cycle on the lab ONU (Huawei EG8145V5 @ `1/27`), 5× for idempotency |
| M25 | Real multi-row `show onu-info all` capture to finalise parser spacing |
| M26 | `show optical-info` with multiple ONUs online |
| M27 | SSH migration (`ssh-server enable`, transport 23 → 22, disable telnet) |
| M28 | Production inbound route — router NAT/port-forward exposing **only** `/webhook/xendit`, replacing the Cloudflare tunnel |

---

## 8. Risk register carried into Phase 3

| Risk | Mitigation in the plan |
| --- | --- |
| Branch scoping is bolted on late and leaks data between branches | Build M1/M2 **first**, before any ISP table exists. One shared scoping helper, and a test that asserts a branch user cannot read another branch's invoice. |
| Corrected business rules get lost during the port | Every billing/dunning constant is re-checked against `PENDING-Billing-Model-Corrections.md`, never against V1/V2 code. Port V2's regression tests *with* the code. |
| The `0 \|\| 3` bug class reappears | Port `getGraceDays()` and audit every numeric setting read for the same falsy-zero pattern. |
| Xendit casing / whole-peso trap | Port `xendit.webhook.service.js` and its 28 tests unmodified; never "clean up" the amount handling. |
| Money drifts to float | Adopt `money.js` (decimal.js) at the start of billing work, not after. |
| ONU state marked without device confirmation | Preserve V2's invariant exactly: state flip and `network_action_logs` insert in one transaction, only after a confirmed device response. |
| Frontend rewrite balloons | Build the module list from the audit, and use the Roles module as the template for every one. Map + tree are the only two genuinely new components. |

---

## 9. Phase 2 exit check

| Deliverable item | Status |
| --- | --- |
| Area comparison table (Architecture / Frontend / Backend / Database / Features / Configuration) | ✅ §1 |
| Keep from V1 | ✅ §2 |
| Keep from V2 | ✅ §3 |
| Merge | ✅ §4 |
| Rewrite | ✅ §5 |
| Discard | ✅ §6 |
| Missing / to build | ✅ §7 |
| `front/` and `back/` unmodified | ✅ |

**Two items are blocked on client input and are excluded from Phase 3's critical path:** M19
(blacklist/revocation) and M22 (real MikroTik client). Everything else is plannable now.
