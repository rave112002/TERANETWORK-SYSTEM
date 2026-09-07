# Migration Decision Log

**Created:** 2026-09-07
Decisions made by the system owner during the migration. These override anything in the old docs or
either old codebase. Newest at the bottom.

---

## D1 — Tenancy & authorization model

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
