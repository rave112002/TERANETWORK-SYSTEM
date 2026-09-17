# Migration Decision Log

**Created:** 2026-09-07
Decisions made by the system owner during the migration. These override anything in the old docs or
either old codebase. Newest at the bottom.

---

## D1 — Tenancy & authorization model

> ⚠️ **Partly superseded by [D7](#d7--one-branch-per-installation) (2026-09-16).** Production is
> **one server + one database per branch**, with no central server. Everything below about a
> Superadmin operating *across* branches, users assigned to *several* branches, and
> `branchId IN (...)` scoping describes what S0 built — that code still exists and is harmless —
> but it is **not** the production model and must not be extended. The role list and the "one
> company, branch is the scoping unit" framing still stand. Read D7 before touching tenancy.

**Decided:** 2026-09-07, Phase 1 exit.
**Supersedes:** the ISP docs' single-tenant, four-fixed-role model (`super_admin` / `billing` /
`noc` / `auditor`) as built in V1 and V2.

**TERANETWORK is the single company.** Do **not** build independent multi-tenancy between different
companies. The target's multi-tenant structure is kept as the *organizational foundation* — the
company row exists, but there is exactly one, and the real scoping unit is the **branch**.

```
Company (TERANETWORK)
  └─ Branches (New Lower Bicutan – Taguig, Bagumbayan – Taguig, …)
       └─ Users, scoped to their assigned branch(es)
```

### Roles

Three operational roles, plus a separate owner portal:

| Role | Portal | Scope |
| --- | --- | --- |
| **Superadmin** | SuperAdmin portal | Unrestricted, company-wide, across all branches |
| **Admin** | Admin portal | Assigned branch(es) only |
| **Billing** | Admin portal | Assigned branch(es) only |
| **Technician** | Admin portal | Assigned branch(es) only |

Mapping from the old docs: `noc` → **Technician**; `auditor` → **dropped**; `super_admin` →
**Superadmin** (now its own portal, not just a role).

### Superadmin can

- Manage all branches
- Create / edit / deactivate users
- Change user roles
- Assign and reassign users to branches
- Read and operate on data across all branches
- Manage company-wide settings
- Update TERANETWORK company info (logo, phone, email, …)
- Control system-level settings branch users cannot reach

### Branch users (Admin / Billing / Technician) must

- Have every query and mutation scoped to their **assigned branches**
- Be unable to read or modify another branch's data unless explicitly assigned to it

### ⚠️ Schema consequence — users are many-to-many with branches

The template today puts a single `branchId` column on `users`, i.e. one branch per user. The owner
requires a user to be assignable to **one or several** branches ("a technician may be assigned only
to New Lower Bicutan, while another user may have access to both").

This needs a **`user_branches` join table**, and every tenant-scoped query changes from
`WHERE branchId = ?` to `WHERE branchId IN (<user's assigned branches>)`. Existing modules
(users, roles, audit trail, settings) that assume the single-column form have to be revisited.
Detailed in the Phase 2 audit and planned in Phase 3.

### Scalability requirement

Adding further TERANETWORK branches later must not require restructuring — branch is a data row,
never a code branch.

---

## D2 — Working mode

**Decided:** 2026-09-07, Phase 1 exit.

Phases 2–8 run **autonomously**, with a check-in and a written deliverable at each phase boundary.
The pair-programming pacing of `BUILD-WITH-ME-Junior-Dev-Mode.md` does not apply to this migration.

---

## D3 — Service plans are company-wide, not branch-scoped

**Decided:** 2026-09-07, during stage S2. **Reversible** — changing it later is a migration
(add `branchId`, backfill), not a rewrite.

`plans` carries `companyId` but **no `branchId`**, and its queries deliberately do not use
`branchScope()`. Every other ISP table that holds tenant data is branch-scoped; this is the
exception, so it is recorded here rather than left to be inferred from the schema.

**Why:** TERANETWORK is one ISP with one price list. Both Taguig branches sell the same tiers, so
a branch-scoped catalogue would mean a duplicate row per branch and turn "change the price of
Fiber 50" into a multi-row edit that can go half-done. Revenue stays attributable per branch
because `customers`, and later `subscriptions` and `invoices`, all carry `branchId`.

**If the client ever wants per-branch pricing:** add a nullable `branchId` to `plans`
(`NULL` = available everywhere) and change the predicate to
`(branchId IS NULL OR branchId IN (...))`. Existing rows keep working untouched.

---

## D4 — Auth pages use V1's split-screen layout

**Decided:** 2026-09-07, during stage S3, at the owner's request.

The login (and every other auth page) adopts the **layout** of
`OLD/TERANETWORK/frontend/src/pages/Login.jsx`: a full-bleed brand panel on the left, hidden below
`lg`, with the form column on the right.

Implemented in the shared `front/src/components/AuthLayout.jsx` rather than per page, so all six
auth screens — login, forgot-password and reset-password across both portals — move together.

**What was taken from V1:** the split proportions (`lg:w-1/2 xl:w-3/5` / `xl:w-2/5`), the
full-bleed background with the wordmark top-left, the wordmark reappearing above the form on small
screens, and the "Welcome back" heading with a one-line subtitle.

**What was not:**

- **Ant Design components** — the form stays shadcn/ui + react-hook-form, per `front/CLAUDE.md`.
- **Hardcoded palette classes** (`text-jet`, `bg-b-secondary`, `text-b-muted`) — every colour is a
  Modern token, so the form column flips with the theme. The brand panel is the one exception: its
  backdrop is a dark image in both themes, so the type over it is white unconditionally.
- **The "Remember me" checkbox** — the auth layer has no remember-me, and a checkbox that does
  nothing is worse than no checkbox.
- **The dead `<a href="#">` forgot-password link** — the target already routes to a real
  forgot-password page.

**Brand assets** were re-encoded on the way across: the originals totalled **5.08 MB** (a
6596×3696 PNG backdrop alone was 4.3 MB). Resized and converted to WebP they come to **49 KB**.
Both colourways of the wordmark ship, because the app has a dark theme and a CSS invert on a
coloured logo does not survive contact with brand guidelines.

---

## D5 — Subscriptions have no per-row billing anchor

**Decided:** 2026-09-07, during stage S4.

The original spec gave each subscription a `statement_day` (1–28), letting every subscriber sit on
their own billing anchor. The **`subscriptions` table has no such column.**

**Why:** the client's corrected billing model
(`docs/reference/PENDING-Billing-Model-Corrections.md`) bills *everyone* on the **15th** for the
calendar month, with a second end-of-month batch for post-15th signups. A per-row anchor would be
config that nothing reads — and worse, config that could silently disagree with the cron and make
the billing date look configurable when it is not.

**If per-subscriber anchors are ever wanted again**, that is a migration plus a change to the cycle
engine's selection query — not a column left lying around in the hope.

---

## D6 — Suspension and restoration are not staff actions

**Decided:** 2026-09-07, during stage S4.

`POST /subscriptions/:id/status` accepts exactly two actions: **`activate`** and **`terminate`**.
The other two edges of the lifecycle are absent by design:

```
pending   → active       staff          (this endpoint)
active    → suspended    dunning worker (after the OLT confirms the cut)
suspended → active       payment path   (after the OLT confirms restore)
any       → terminated   staff          (this endpoint)
```

**Why:** `suspended` is not an opinion, it is a claim about what a device is doing right now. It is
written by the provisioning worker in the same transaction as the ONU's own state, only after a
confirmed device response. A staff button that set it directly would let the database assert a
customer is cut off — or reconnected — when the hardware disagrees, and the dunning sweep reads
exactly this column to decide who to disconnect next.

The UI reflects this: a suspended subscription offers no "restore" action, because service comes
back when the customer pays, not when someone clicks.

**Consequence for S6:** the provisioning worker writes `subscriptions.status` directly, not through
this controller. That is the intended path, not a workaround.

---

## D7 — One branch per installation

**Decided:** 2026-09-16, by the client. **Supersedes** the cross-branch parts of [D1](#d1--tenancy--authorization-model).

**Every TERANETWORK branch runs its own, locally deployed instance of this system** — its own
server, its own MySQL database, its own worker. There is **no central server**, no combined
dashboard or report across branches, and no Superadmin that manages more than one branch's
database.

```
New Lower Bicutan  →  server A  +  database A   (1 company row, 1 branch row)
Bagumbayan         →  server B  +  database B   (1 company row, 1 branch row)
                      nothing connects A and B
```

**Treat every installation as a single-branch ISP system.** A production database holds exactly
one `companies` row and exactly one `branches` row.

### What this means for code

| Topic | Rule |
| --- | --- |
| **Scoping** | `WHERE companyId = ? AND branchId = ?` from `req.user` is correct and sufficient, as the `backend-conventions` skill teaches. |
| **`branchScope()`, `user_branches`, `req.user.branchIds`** | **Keep, do not extend.** Built in S0 for the superseded model. With one branch they return exactly the rows `branchId = ?` does, so they are harmless, and removing them from ~26 files buys nothing. New code may use either form. |
| **Do not build** | Cross-branch dashboards or reports, assigning a user to several branches, branch switchers, or anything that assumes two branches share a database. |
| **Setup** | `npm run db:setup` creates the company, **this installation's one branch** (`BRANCH_NAME`), and its Owner / Admin / Billing / Technician roles. It never creates a second branch. |
| **SuperAdmin portal** | Still exists, and on each installation manages **that installation only** — creating the branch Owner login, company profile, system settings. The branch-assignment drawer from S0 is vestigial. |
| **`branches.paymentProvider`** (S14) | Redundant — each installation has its own `.env`. Harmless; leave NULL. |

### What this means for operations

- **Everything is per installation:** backups, migrations, upgrades, the worker, `DRY_RUN`, the
  billing schedule settings, SMTP and payment configuration. The runbooks describe one
  installation; repeat them for each branch.
- **Business numbers are unique only within an installation.** `counters` are keyed by
  `companyId`, so both branches will issue `ACC-000001` and `INV-2026-000001`. Harmless while
  nothing is consolidated. **If the client ever combines branch data — accounting, a BIR report, a
  merged export — numbers will collide.** A branch prefix in the numbering is the fix; it is not
  built. Raise it with the client before any consolidation is discussed.

### Development databases

A dev database created before this decision may hold both Taguig branches. `db:setup` and
`db:seed:dev` then require `BRANCH_NAME` and touch only that branch. For a production-shaped
database: `npm run db:setup:clean` with `BRANCH_NAME` set, then `npm run db:seed:dev`.

---

## D8 — GCash Business merchant QR on the invoice ("Option A"); HitPay parked

**Decided:** 2026-09-16, by the client. **Supersedes** the payment direction in S14 and P5.

The client has applied for **GCash for Business**, and it is the acting payment method. **HitPay
is parked** — the adapter, its tests and per-branch routing stay in the codebase, unused, for when
the client adopts it. Nothing HitPay-related is deleted.

### The flow

The client's current process is **GCash → Google Sheets → MikroTik**. **This system replaces
Google Sheets entirely:**

```
invoice (carries the client's GCash Business merchant QR)
  → sent to the subscriber by email / SMS
  → subscriber scans the QR in the GCash app and pays
  → money lands in the ISP's GCash Business account
  → this system obtains the GCash transaction information
  → matches the payment to the customer and invoice
  → updates payment and invoice status
  → applies the service action (reconnection), including MikroTik where applicable
```

### Rules

| | |
| --- | --- |
| **One reusable merchant QR** | The client's GCash Business merchant QR goes on every invoice. **No unique QR per subscriber or per invoice** is generated. The system identifies the payment from the transaction data, not from the QR. |
| **No public endpoint by default** | This is a locally deployed system. A public HTTPS endpoint, webhook, Cloudflare Tunnel or port-forward is **not** a requirement — it becomes one **only** if the GCash Business product the client receives documents that GCash must call us from the internet. |
| **Do not build the integration blind** | How transactions are retrieved — an API, a report export, manual entry — is decided from the client's actual GCash Business product documentation and credentials. Nothing about GCash's API is assumed or invented before then. |
| **Keep it flexible** | Retrieval (how transactions arrive) and matching (which invoice a transaction settles) are separate concerns. Settlement already exists — `settleInvoice()` — and is what a matched GCash payment goes through. |

Design, open questions for the client, and what not to do:
**[docs/gcash-payment-flow.md](../gcash-payment-flow.md)**.
