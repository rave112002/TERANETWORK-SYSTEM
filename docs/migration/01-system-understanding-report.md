# System Understanding Report — Phase 1

**Created:** 2026-09-07
**Phase:** 1 of 8 (Understand) — per [Claude Code Final Version Migration Prompt.md](../Claude%20Code%20Final%20Version%20Migration%20Prompt.md)
**Sources read:** all 16 files in `OLD/TERANETWORK-ADMIN-BILLING-SYSTEM/docs/`, both old codebases
(file-level inventory + reading of every domain-logic module), `front/CLAUDE.md`, `back/CLAUDE.md`,
`back/database/schema.sql`, and the four `package.json` files.
**Constraint honoured:** nothing under `front/` or `back/` was modified.

---

## 1. System purpose

**Tera Network Admin & Billing System** — a production ISP administration platform for a Philippine
fiber (FTTH/EPON) provider. It fuses two normally-separate domains:

- **OSS (network side)** — model the physical fiber plant (OLT → PON port → splitter → NAP → ONU),
  and **remotely deactivate/reactivate a subscriber's modem at the OLT**.
- **BSS (billing side)** — customers, plans, subscriptions, monthly invoicing, email delivery with a
  Pay-Now link + QR, online payment via **Xendit**, reconciliation, and an **automated dunning
  engine** that disconnects non-payers and reconnects them the moment they pay.

The defining characteristic: **this software can cut off real customers' internet.** Every automated
network action must be logged, reversible, idempotent, and guarded. That single fact drives most of
the architecture — the job queue, the audit log, the dry-run kill switch, and the rule that DB state
only changes *after* a confirmed device response.

**Deployment is local/on-premise**: one on-site box on the same LAN as the OLT and MikroTik. The
*only* internet exposure is inbound `/webhook/xendit`; the admin UI stays LAN-only. Outbound is
limited to Xendit + email.

---

## 2. Main modules / features

| Module | What it does | Built in V1 | Built in V2 |
| --- | --- | --- | --- |
| Auth + RBAC | JWT RS256 access + hashed refresh tokens, argon2id, 4 fixed roles | ✅ | ✅ |
| Audit log | Append-only, written **in the same transaction** as every mutation | ✅ | ✅ |
| Credential encryption | Envelope AES-256-GCM for OLT/MikroTik credentials | ✅ | ✅ |
| Customers / Plans / Subscriptions | CRUD + subscription lifecycle state machine | ✅ | ✅ |
| Network inventory | OLTs, PON ports, splitters (polymorphic parent), NAPs, ONUs + capacity | ✅ | ✅ |
| Topology + map | OLT→…→ONU tree; react-leaflet NAP map | ✅ | ✅ |
| OLT driver layer | `activateOnu`/`deactivateOnu`/`getOnuStatus`/`listOnus`; Mock + HSGQ | ✅ | ✅ (bench-corrected) |
| Job queue + worker | Durable queue, retries/backoff/dead-letter/cancel | ✅ (BullMQ/Redis) | ✅ (MySQL `jobs` table) |
| DRY_RUN kill switch | Global "log, don't execute" flag | ✅ | ✅ |
| Device Discovery | Read OLT ONUs + MikroTik PPPoE → stage → matched/new/orphaned → explicit import | ❌ | ✅ |
| Billing cycle engine | Monthly invoice generation, proration, install fee, sequential numbering | ✅ | ✅ |
| PDF + QR | Branded invoice PDF, QR encoding `/pay/<token>` | ✅ (pdfkit) | ✅ (@react-pdf/renderer) |
| Email pipeline | `sendEmail()` interface + queued email jobs + `email_events` | ✅ | ✅ |
| Public pay page | `/pay/<token>` read-only invoice + live Pay button | ✅ | ✅ |
| Xendit | Payment creation, verified idempotent webhook, polling reconciliation | ✅ (axios) | ✅ (`xendit-node` v7, **live-verified**) |
| Dunning engine | Nightly sweep, exemptions, suspension/reconnection emails, race safety | ✅ | ✅ (steps 1–5 of 8) |
| Dashboards | Admin + network KPI dashboards | ✅ | ❌ |
| Reports / CSV export | Invoices, payments, reconciliation, action logs | ✅ | ❌ |
| Users admin UI | Staff account management screen | ✅ | ❌ (API stub only, 8 lines) |
| Audit-log viewer UI | Browse the audit trail | ✅ | ❌ |
| Ops runbooks | 5 failure-mode runbooks + DB backup script | ✅ | ❌ |

**Not built anywhere yet:** outage credits, 60-day blacklist/revocation, automatic outage detection,
the real MikroTik `RouterOsClient`, alerting (dead-letter/OLT-unreachable/sweep failure), and the
full unattended lifecycle e2e test.

---

## 3. Frontend architecture

### V1 and V2 (both old versions)
React 19 + Vite + **Ant Design 5** + Tailwind (layout only) + React Query 5 + Zustand + axios +
react-router. Self-hosted **Satoshi** variable font, monochrome jet/onyx/graphite/ash/platinum
palette. Auth state in a Zustand store persisted to sessionStorage; axios interceptor attaches the
token. Pages are `pages/CMS/*.jsx`, one file per resource, each an Ant `Table` + create/edit
`Modal`. Maps via `react-leaflet`; topology via Ant `Tree`.

The two differ in service-layer strategy:
- **V2** — one file per resource per concern: `services/api/<res>Api.js` +
  `services/query/use<Res>Query.js` + `services/mutation/use<Res>Mutation.js` (≈45 files).
- **V1** — a **generic** `services/api/resources.js` + `useResourceQuery.js` + `useResourceMutations.js`
  (3 files total) driving a shared `<ResourceTable>` component. Far less code, and it is the
  cleaner design of the two.

### Target `front/`
React 19 + Vite + **shadcn/ui** (Radix + Tailwind v4) + React Query + Zustand + **react-hook-form +
zod** + sonner + @tanstack/react-table + recharts + lucide-react. Type is Onest + JetBrains Mono.
Design system "Modern": monochrome surfaces, hairline borders, one green accent, **no shadows**,
every colour a token in `src/index.css`.

Structure is a per-module folder — `pages/<Portal>/<Module>/{index.jsx, hooks.jsx, components/}` —
with the table page's data/state contract living in `hooks.jsx` and forms in a Sheet drawer. Two
portals exist today: **SuperAdmin** (companies, branches, users) and **Admin** (users, roles,
permissions, audit trail, settings, dashboard). Reference implementation:
[Roles](../../front/src/pages/Admin/UserManagement/Roles/).

> **The old frontends cannot be migrated as code.** Ant Design → shadcn/ui is a total rewrite of
> every screen. What carries over is the *screen inventory, the data contracts, and the UX decisions*
> (e.g. "the dunning candidates preview is the most important screen"), not the JSX.

---

## 4. Backend architecture

### Shared lineage — the good news
V1, V2 and the target `back/` are all **the same Express template family**. All three use:

- ES modules, Express, a custom `Database` class wrapping `mysql2/promise` injected as **`req.db`**
- **`res.sendSuccess()`** → `{ success, message, data }` envelope via `wrapResponses`
- `catchAsync` + `validateBody`/`validateParams`/`validateQuery` with **Zod**
- Passport JWT (RS256, keys generated by a script), argon2id hashing
- The same `utils/` (APIError, security, rateLimiterService, piiSanitizer, file uploads, …)
- Controllers that *are* `express.Router()` instances, mounted in `routes/v1/*`

So backend migration is **pattern-compatible** — far more mechanical than the frontend.

### V2's shape (the primary source)
```
server/src/
  controllers/v1/{auth,cms,billing,dunning,public,webhooks}/   ~3,750 LOC
  lib/{billing,dunning,xendit,jobs,olt-drivers,mikrotik,discovery,email,pdf,scheduler,settings}/  ~9,400 LOC
  middlewares/, routes/v1/, utils/
server/bin/{www.js, worker.js}       ← API and worker are separate entry points
```
Cleanly layered: **controllers are thin** (validate → call a `lib/` service → respond); all business
logic and all device I/O live in `lib/`. `node-cron` (in the API process, gated by `RUN_CRON`) only
*enqueues* rows into the MySQL `jobs` table; a separate worker loop claims them with
`SELECT … FOR UPDATE SKIP LOCKED` and owns retries/backoff/dead-letter/cancellation.

Four crons: billing cycle, daily maintenance (reminders + overdue), dunning sweep, hourly Xendit
reconciliation.

### V1's shape
Same skeleton, but `services/` instead of `lib/`, **BullMQ + Redis** for the queue, a
`utils/crudFactory.js` that generates an audited CRUD router from a table config (which is why V1's
controllers are 36–80 lines where V2's are 230–340), and a `worker/` with three processors
(provisioning, email, billing).

### Target `back/`
Same template, **but a different problem domain**: multi-tenant SaaS scaffolding. `req.user` carries
`companyId`/`branchId` and every query is scoped to them; authorization is **dynamic permission rows**
(`permissions` / `role_permissions` / `user_permissions`) checked by `checkPermission(module,
submodule, action)`, not fixed role names. Validators live in a separate `server/src/validators/`
folder rather than inline in the controller. Migrations are `database/schema.sql` (the baseline)
plus numbered `.sql` files run by `scripts/migrate.js` — **no Sequelize**.

Present today: auth, users, roles, permissions, user-permissions, audit-trail, settings, dashboards,
companies, branches, superadmin users, upload. **Zero ISP domain.**

---

## 5. Database structure

The ISP data model (identical in intent across the docs, V1 and V2) is ~28 tables in six clusters:

1. **Staff & auth** — `users`, `refresh_tokens`, `idempotency_keys`
2. **Billing entities** — `customers`, `plans`, `subscriptions`
3. **Network/OSS** — `olts`, `pon_ports`, `splitters` (polymorphic parent), `naps`, `onus`
4. **Billing documents** — `invoice_counters`, `invoices`, `invoice_lines`, `payments`,
   `pending_charges`, `email_events`, `webhook_events`
5. **Automation** — `jobs`, `network_action_logs`, `dunning_exemptions`, `system_settings`
6. **Discovery** — `discovery_runs`, `discovered_items`
7. **Audit** — `audit_logs` (INSERT-only by policy)

**Non-negotiable constraints** carried in the docs and honoured by both codebases:

- `UNIQUE(subscription_id, billing_period_start)` — the guard that makes invoice generation idempotent
- `UNIQUE(payments.xendit_payment_id)` and `UNIQUE(webhook_events.provider, event_id)` — webhook idempotency
- `UNIQUE(onus.serial_no)`, `UNIQUE(onus.mac)`, `UNIQUE(onus.nap_id, nap_port)`
- Money is **`DECIMAL(12,2)`**, never float; compared in integer centavos
- Timestamps stored UTC; statement/due/disconnect dates computed in **Asia/Manila**
- `statement_day` clamped 1–28
- On EPON the ONU's identity is its **MAC**, not a GPON serial; `onu_index` holds `pon/onu-id` (e.g. `1/27`)

**Three incompatible conventions across the three codebases** — this is the single biggest migration
decision (see §8.1):

| | V1 | V2 | Target `back/` |
| --- | --- | --- | --- |
| Column case | `camelCase` | `snake_case` | `camelCase` |
| Primary/foreign key | auto-inc `customerId` | auto-inc `id` | auto-inc `id` **+ business `varchar` ID used everywhere** |
| Deletes | mixed | mixed (`is_active`, retire) | soft-delete `status = 'Deleted'` |
| Migrations | Sequelize CLI `.cjs` | Sequelize CLI `.cjs` | `schema.sql` + numbered `.sql` |
| Tenancy | none | none | `companyId` + `branchId` on every row |

---

## 6. Important workflows

**W1 — Provision a customer.** Create customer → subscription binds plan + free NAP port + ONU →
activate ONU at the OLT → status `active`.

**W2 — Monthly billing.** Cron on the **15th, 02:00 Asia/Manila** → for each active subscription, in
one transaction: allocate `invoice_no` from `invoice_counters`, generate a 128-bit `public_token`,
insert invoice + lines (plan charge, proration, install fee, carried `pending_charges`), status
`issued`, and enqueue the invoice email **in the same transaction**. The billing period is the
**calendar month**; due date is the **2nd of the next month**.

> The 15th is load-bearing, not cosmetic. It is what makes "a suspended customer accrues nothing"
> fall out naturally: the cycle runs *after* the 2nd-of-month disconnection, so a suspended
> subscription is skipped and never billed. On a 1st-of-month statement the customer would wrongly
> owe two months. **Do not "simplify" this back to the 1st.**

**W3 — Invoice delivery.** Worker claims the `email` job → renders QR (of `/pay/<token>`) + PDF →
sends via `sendEmail()` → writes an `email_events` row.

**W4 — Customer pays.** Xendit → `POST /webhook/xendit` (mounted *before* the security stack, with
its own `express.raw()` parser) → timing-safe `x-callback-token` check (401 on failure, **fails
closed** when unconfigured) → insert `webhook_events` (duplicate ⇒ 200 and stop) → settlement
transaction: amount must equal the invoice total exactly → payment row → invoice `paid` → cancel any
queued `deactivate` job for that ONU → enqueue `activate` if suspended.

**W5 — Customer doesn't pay.** Cron at **20:00 Asia/Manila on the due date** (`GRACE_DAYS = 0`) →
sweep selects subscriptions with an unpaid `issued`/`overdue` invoice past due, still `active`, with
no live exemption, that have an ONU → inserts one `deactivate` job per ONU with
`dedupe_key = deactivate:onu:<id>` → worker re-checks preconditions → runs the device command →
**only then**, in one transaction, flips ONU + subscription to `suspended`, writes
`network_action_logs`, writes `audit_logs`, and enqueues the suspension email.

**W6 — Failure path.** OLT unreachable → 5 attempts with exponential backoff + jitter → dead-letter +
NOC alert, and **DB state stays unchanged**. This was proven live during the Phase 4 sandbox run
against a genuinely unreachable OLT: the system refused to claim a customer was reconnected when the
device had not confirmed it.

**W7 — Bootstrap discovery.** Read-only sweep of the OLT (`show onu-info all` per EPON port) and the
MikroTik (PPPoE secrets + active sessions) → stage into `discovered_items` → bucket as
**matched / new / orphaned**, joining ONU↔account by **MAC** → staff review and **explicitly import**.
Nothing is ever created silently. Built to onboard the ~200 ONUs already bound on the target OLT
from a prior ISP deployment; the previous operator's free-text ONU `description`
(e.g. `"Jacqueline-Rebancos PON 2 NAP 1 PORT 5"`) is parsed into suggested name/NAP/port.

---

## 7. Key dependencies

| Concern | Locked choice | Present in `back/`? |
| --- | --- | --- |
| Payments | **`xendit-node` v7** (sole gateway; SDK requests camelCase, webhooks snake_case) | ❌ |
| Scheduler | `node-cron`, Asia/Manila, gated by `RUN_CRON` | ❌ |
| Queue | **MySQL `jobs` table** — explicitly *not* Redis/BullMQ | ❌ (env still mentions Redis) |
| PDF | `@react-pdf/renderer` (pure JS, no headless Chromium) | ❌ |
| QR | `qrcode` | ❌ |
| Money | `decimal.js` (V1 had it; V2 uses integer-centavo comparison) | ❌ |
| Email | Nodemailer + SMTP behind a single `sendEmail()` | ✅ (`lib/mailer/`) |
| OLT transport | raw `net` telnet today, swappable to `ssh2` once SSH is enabled | ❌ |
| MikroTik | `node-routeros` (RouterOS API) — **still unimplemented** | ❌ |
| Map | `leaflet` + `react-leaflet` | ❌ (front) |
| Tests | `vitest` | ❌ |

Everything else the domain needs (mysql2, argon2, passport-jwt, zod, winston, helmet, multer,
sharp, moment-timezone) is already in `back/`.

---

## 8. Observations & risks

### 8.1 🔴 The target is a multi-tenant SaaS template; the ISP system is single-tenant
`back/` scopes every query to `companyId` + `branchId` and gates every route on dynamic permission
rows. The ISP docs specify one ISP, one site, and **four fixed roles** (`super_admin`, `billing`,
`noc`, `auditor`). These are genuinely different authorization models, and **every migrated table
and controller is affected**. Three viable paths — this needs a decision in Phase 2/3 before any
code moves:

- **(a) Adopt tenancy fully** — add `companyId`/`branchId` to all ISP tables, map the four roles onto
  permission rows. Most work, but keeps the target's conventions intact and leaves room for the
  platform to host more than one ISP later.
- **(b) Single-tenant with a fixed company** — keep the columns, seed one company/branch, scope
  everything to it. Cheap, honest, reversible; the tenancy machinery costs nothing and the code
  stays uniform.
- **(c) Strip tenancy for ISP tables** — least migration work, but breaks the target's stated
  conventions and forks the codebase's mental model in two.

My recommendation is **(b)**, with the four ISP roles seeded as roles + permission rows so
`checkPermission()` remains the single authorization mechanism. But it is the user's call.

### 8.2 🔴 The frontend is a rewrite, not a migration
Ant Design → shadcn/ui touches every screen. Budget for it explicitly. Two capability gaps have no
shadcn equivalent and need a library decision: the **NAP map** (`react-leaflet` — straightforward to
add) and the **topology tree** (Ant `Tree` has no shadcn counterpart; needs a headless tree or a
hand-rolled recursive component).

### 8.3 🟠 The prompt's "V2 is more complete" is true in *depth*, not in *breadth*
V2 (Jul 20 – Aug 11) is deeper: 193 tests, bench-verified HSGQ commands, a live-verified Xendit
integration, Device Discovery, and the MySQL job queue that replaced Redis by client decision. But
V1 (Jul 8–9) reached further across the roadmap and holds several things V2 never got:
**dashboards, CSV reports, the users admin UI, the audit-log viewer, 5 ops runbooks, a DB backup
script, `utils/crudFactory.js`, and the generic `ResourceTable`/`useResourceQuery` frontend
abstraction.** V1's camelCase columns are also closer to the target's conventions than V2's
snake_case. Phase 2 must mine V1 deliberately rather than treating it as superseded.

### 8.4 🟠 V1's vendor transcripts are fabricated; V2's are bench-derived
`OLD/TERANETWORK/backend/docs/vendor-transcripts/` is dated 7 July — *before* the bench validation —
and its `show onu-info all` column layout (`ID / MAC / AuthState / ConfigState / OnlineState /
Description`) does not match the hardware. The real layout, from
[HSGQ-XE04I-CLI-Validation.md](../../OLD/TERANETWORK-ADMIN-BILLING-SYSTEM/docs/vendor-transcripts/hsgq-xe04i/HSGQ-XE04I-CLI-Validation.md),
is `PON/ONU / Mac-Address / Status / Auth / Cfg / Reg-time / ONU-Name / ONU-Desc`. **Take the HSGQ
driver and parsers from V2, never V1.** Likewise the suspend mechanism: `blacklist add mac <MAC>` +
`onu-deregister <id>` + `copy running-config startup-config`; reconnect is
`blacklist delete mac <MAC>` alone. `onu-authorize` is a *global* auth-mode command, not a per-ONU
action — a natural-looking mistake that would silently fail to reconnect anyone.

### 8.5 🟠 Corrected business rules that contradict the older code
[PENDING-Billing-Model-Corrections.md](../../OLD/TERANETWORK-ADMIN-BILLING-SYSTEM/docs/phases/pending/PENDING-Billing-Model-Corrections.md)
supersedes the earlier decisions. The final values are: statement day **15**, grace **0 days**,
dunning sweep **20:00**, **no reconnection fee**, no partial payments, VAT 0% (behind a flippable
setting), install fee ₱1,000 on the first invoice, full-month billing after reconnection. V1 and
parts of V2 still encode the old values (1st of month, 3-day grace, ₱2,000 reconnection fee).
**Anything copied forward must be re-checked against this document, not against the code.**

### 8.6 🟡 Two known traps worth carrying forward verbatim
- **`parseInt(raw, 10) || 3`** — with `GRACE_DAYS = 0`, `0 || 3` silently restores a 3-day grace and
  the sweep appears broken with no error anywhere. V2 fixed this with a `getGraceDays()` helper that
  treats 0 as valid. This bug class will reappear wherever a numeric setting can legitimately be 0.
- **Xendit casing** — the SDK takes **camelCase** (`externalId`), webhooks arrive **snake_case**
  (`external_id`). Reading `payload.externalId` in the webhook yields `undefined`, which does not
  throw; it just silently matches no invoice. Also: PHP amounts are **whole pesos** — never `* 100`.

### 8.7 🟡 Unfinished work inherited from V2
Phase 5 steps 6–8 (race-safety test, alerting, unattended lifecycle e2e), the real MikroTik
`RouterOsClient` (stub throws 501), HSGQ multi-PON discovery sweep, and Phase 6 in its entirety
(dashboards, reports, observability, security pass, backups, runbooks, data-protection endpoints).
Plus two unbuilt features: **outage credits** (maths and workflow fully specified, needs
`outage_events` + a per-customer impact table) and **60-day blacklist/revocation** (six open
questions the client has not answered — see §C of the PENDING doc).

### 8.8 🟡 Hardware verification is still open
The HSGQ driver has never run a live deactivate→reconnect cycle on the bench ONU (Huawei EG8145V5 at
`1/27`); the MikroTik's IP, RouterOS version, API port and read-only credentials have not been
gathered. Both block go-live but neither blocks migration work. One ops note worth keeping: **GUI
reboot hangs on firmware `HSGQ-XE04I_I_V3.3.6C_Rel`** and needed a manual power cycle — treat OLT
reboots as an on-site manual operation.

### 8.9 🟡 Production hardening not yet done
Inbound is still a temporary Cloudflare tunnel; it must become a router NAT/port-forward exposing
**only** `/webhook/xendit` over HTTPS with the admin UI LAN-only. `back/.env.example` still carries
Redis settings that the locked "no Redis" decision makes misleading. And `npm run lint` was broken
repo-wide in V2 (`eslint.config.js` imports `globals`, which is not in devDependencies).

### 8.10 ⚪ Working-style note
`BUILD-WITH-ME-Junior-Dev-Mode.md` states the user is learning this stack and wants explanation
before code, small steps, readable-over-clever, and no premature abstraction. That conflicts to a
degree with the migration prompt's autonomous phase-by-phase mode. Worth confirming which mode
applies to the migration itself — my default will be to work in phases but explain decisions as I go
and check in at phase boundaries.

---

## 9. Phase 1 exit check

| Deliverable item | Status |
| --- | --- |
| System purpose | ✅ §1 |
| Main modules / features | ✅ §2 |
| Frontend architecture | ✅ §3 |
| Backend architecture | ✅ §4 |
| Database structure | ✅ §5 |
| Important workflows | ✅ §6 |
| Key dependencies | ✅ §7 |
| Observations / risks | ✅ §8 |
| `front/` and `back/` unmodified | ✅ |

**Blocking decision before Phase 3 (plan) is finalised:** the tenancy/authorization model (§8.1).
Phase 2 (V1 vs V2 audit) can proceed without it.
