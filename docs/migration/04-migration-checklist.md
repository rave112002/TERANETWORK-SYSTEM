# Migration Checklist — Phase 4

**Created:** 2026-09-07
**Phase:** 4 of 8 (Migrate) — running the stages defined in
[the migration plan §2](03-final-migration-plan.md)
**Legend:** ✅ done · 🟡 in progress · ⬜ pending · ⏭️ skipped (with reason) · ⚠️ needs attention

---

## Stage progress

| Stage | Name | Status |
| --- | --- | --- |
| **S0** | Branch scoping foundation | ✅ complete — applied and verified against MySQL |
| **S1** | Platform prerequisites | ✅ complete |
| **S2** | BSS masters — Plans, Customers | ✅ complete |
| **S3** | Network inventory | ✅ complete |
| **S4** | Subscriptions | ✅ complete |
| **S5** | Settings + jobs queue + worker | ✅ complete |
| **S6** | OLT drivers + provisioning | ✅ complete |
| **S7** | Billing | ✅ complete |
| **S8** | Payment gateway | 🟡 port complete — adapter pending the client's choice |
| **S9** | Dunning | ✅ complete |
| **S10** | Discovery | ✅ complete — OLT half; the router half is blocked on M22/P4 |
| S11 | Phase-6 surface | ⬜ |

---

## S0 — Branch scoping foundation ✅

Implements decision [D1](00-decisions.md#d1--tenancy--authorization-model): TERANETWORK is one
company with several branches; a user works in one **or more** of them.

### Built

| # | Item | File | Status |
| --- | --- | --- | --- |
| 1 | `user_branches` join table | `back/database/schema.sql` | ✅ |
| 2 | Company profile columns (`address`, `tin`) | `back/database/schema.sql` | ✅ |
| 3 | Migration for existing databases, incl. backfill | `back/database/migrations/001_user_branches_and_company_profile.sql` | ✅ |
| 4 | Branch scoping helper | `back/server/src/utils/branchScope.js` | ✅ |
| 5 | `req.user.branchIds` on the JWT strategy | `back/server/src/middlewares/passport.jwt.config.js` | ✅ |
| 6 | Company profile API (`GET`/`PUT /companies/profile`) | `back/server/src/controllers/v1/superadmin/companies.controller.js` | ✅ |
| 7 | Branch assignment API (`GET`/`PUT /users/:accountId/branches`) | `back/server/src/controllers/v1/superadmin/users.controller.js` | ✅ |
| 8 | Company Profile page | `front/src/pages/SuperAdmin/CompanyProfile/index.jsx` | ✅ |
| 9 | Branch assignment drawer | `front/src/pages/SuperAdmin/Users/components/UserBranchesDrawer.jsx` | ✅ |
| 10 | Service layers for both | `front/src/services/{api,requests}/superadmin/*` | ✅ |
| 11 | Route + sidebar registration | `front/src/routes/pageRoutes/SuperAdminRoute.jsx` | ✅ |

### Re-based onto multi-branch scoping

Every read below moved from `branchId = ?` to `branchId IN (...)` via the shared helper.

| File | Change |
| --- | --- |
| `admin/users.controller.js` | list, detail, create, update, delete |
| `admin/roles.controller.js` | list, detail + a `findScopedRole()` guard on update/delete/permissions |
| `admin/dashboard.controller.js` | all six metric queries |
| `admin/audit-trail.controller.js` | list/export filter + detail |
| `admin/settings.controller.js` | deliberately left on the home branch (documented in the file) |
| `upload.controller.js` | deliberately left on the home branch — uploads are filed where the user works |
| `auditTrail.middleware.js` | deliberately left on the home branch — it records where the actor works |

### Security holes closed on the way through

These were pre-existing and are not caused by the branch change — they were found while rescoping
and are worth calling out.

| Endpoint | Was | Now |
| --- | --- | --- |
| `GET /admin/users/:userId` | `WHERE accountId = ?` — **any** authenticated admin could read **any** company's user by ID | company + branch scoped |
| `PUT /admin/users/:userId` | unscoped update | company + branch scoped |
| `DELETE /admin/users/:userId` | unscoped soft-delete | company + branch scoped |
| `PUT /admin/roles/:roleId` | unscoped update | `findScopedRole()` guard |
| `DELETE /admin/roles/:roleId` | unscoped delete | `findScopedRole()` guard |
| `GET/POST /admin/roles/:roleId/permissions` | unscoped read/write of any role's permissions | `findScopedRole()` guard |

All six now return a plain `404` rather than `403`, so IDs cannot be probed for existence.

### Design decisions taken during S0

| Decision | Rationale |
| --- | --- |
| **Scope vs home branch are separate ideas.** `req.user.branchIds` (from `user_branches`) is what a user may READ; `req.user.branchId` stays their home branch — where records they create are filed and uploads are stored. | One column cannot mean both, and conflating them is how "create in branch A while viewing branch B" bugs start. |
| **Empty scope fails closed** (`AND 1 = 0`). | A user with no assignment must see nothing. The opposite default — seeing everything — is the failure mode that matters. |
| **Migration 001 backfills every existing user.** | Without it, a pre-migration user would have no `user_branches` rows and the `IN (...)` predicate would lock them out of their own data. |
| **At least one branch is required** on assignment. | A zero-branch user is a broken account, not a restricted one. Deactivate the account instead. |
| **Assignments are retired, never deleted** (`status = 'Inactive'`). | Who had access to which branch, and when, is worth keeping. |
| **Settings stay per-home-branch.** | `settings` is keyed `(companyId, branchId, settingKey)`, so a multi-branch user reading "the" settings is necessarily reading one specific branch's. Editing another branch's settings is a SuperAdmin action. |
| **Companies module kept; Company Profile added alongside** (owner's call, 2026-09-07). | Non-destructive. The profile page owns branding/contact only and deliberately cannot change subscription plan or status. |
| **Logo upload goes through the shared upload endpoint**, then the path is saved as JSON. | Avoids a second multer config on a route that has no `companyId` URL param to build an upload path from. |

### Verification run

| Check | Result |
| --- | --- |
| `cd back && npm run lint` | ✅ **0 errors**, 21 warnings (all pre-existing style warnings) |
| `cd front && npm run lint` | ✅ **0 errors**, 13 warnings (12 pre-existing; 0 introduced) |
| `cd front && npm run build` | ✅ built in ~8s |
| `branchScope` behaviour, exercised directly in node | ✅ multi-branch → `IN (?, ?)`; SuperAdmin → unrestricted; **no branches → `AND 1 = 0`**; `assertBranchInScope` rejects out-of-scope with 403; a column name carrying `; DROP TABLE users--` is rejected |
| `npm run db:migrate` | ✅ applied and re-verified — see "Database verification" |

**Lint errors fixed to get the gate green** (all pre-existing, none of my code):
`checkPermission.middleware.js` (2 × `prefer-const`), `rateLimiterService.js` (unused import),
`settings.controller.js` (`== null` → explicit null/undefined check),
`auth.controller.js` (unused caught error).

**A bug found and fixed in my own S0 code before it shipped:** `UserBranchesDrawer` called
`useGetBranches({ pageSize: 0 })` while closed. The backend's `queryInt` has `min: 1`, so that
request 400s — and React Query would have fired it on every render of the SuperAdmin Users page.
`useGetBranches` now takes an `options` argument and the drawer gates the fetch with
`enabled: open && !!user?.companyId`.

---

## S1 — Platform prerequisites ✅

### Dependencies installed

| Package | Where | Version | For |
| --- | --- | --- | --- |
| `node-cron` | back | ^4.2.1 | Scheduler (S5) |
| `xendit-node` | back | ^7.0.0 | Payments (S8) |
| `@react-pdf/renderer` | back | ^4.9.0 | Invoice PDF (S7) — pure JS, no headless Chromium on the on-site box |
| `qrcode` | back | ^1.5.4 | Pay-link QR (S7) |
| `decimal.js` | back | ^10.6.0 | Money (C2) |
| `vitest` (dev) | back | ^2.1.9 | Test harness |
| `leaflet` + `react-leaflet` | front | ^1.9.4 / ^5.0.0 | NAP map (S3) |

**`node-cron` went in at v4, not the planned v3.** v3.0.3 depends on a `uuid` version carrying
GHSA-w5hq-g745-h8pq. v4 drops that dependency chain, and since the scheduler is written fresh in
S5 there is no v3 API to migrate. `npm audit --omit=dev` on the backend went from 3 findings to 1.

**Frontend audit is clean** — `npm audit fix` (non-breaking, no `--force`) resolved the two
transitive dev-tooling advisories. 0 vulnerabilities.

`eslint` + `globals` were already in `back` devDependencies, so the lint breakage V2 documented
does not exist here.

### Configuration — `back/.env.example`

| Change | Detail |
| --- | --- |
| **Removed** `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `ENABLE_EMAIL_WORKER` | There is no Redis in this architecture. Leaving the keys implied one. |
| **Removed** `RATE_LIMIT_REDIS_*`; narrowed the store options | Single process on one on-site box → `memory`. `redis` is no longer offered as an option. |
| **Added** `RUN_CRON`, `RUN_WORKER` | Replaces `ENABLE_EMAIL_WORKER`. Documented: run exactly one API instance with cron on, or every schedule fires twice. |
| **Added** the four cron expressions | `BILLING_CYCLE_CRON=0 2 15 * *`, `DUNNING_CRON=0 20 * * *`, `DAILY_BILLING_CRON`, `RECONCILIATION_CRON` — with a comment pointing at the PENDING doc, because the 15th and 20:00 are business rules, not preferences. |
| **Added** `CREDENTIAL_MASTER_KEY` | Wraps the per-record data keys for OLT/MikroTik credentials. Noted that rotating it makes every stored credential unreadable. |
| **Added** `XENDIT_SECRET_KEY`, `XENDIT_CALLBACK_TOKEN`, `XENDIT_INVOICE_DURATION` | Noted that callback verification **fails closed** when the token is unset. |
| **Added** `VAT_RATE`, `PAY_BASE_URL` | Noted that every emailed link and QR encodes `PAY_BASE_URL/<token>`, never a raw gateway URL. |
| **Added** `MOCK_OLT_LATENCY_MS`, `MOCK_OLT_FAILURE_RATE` | Rehearse retry/dead-letter without hardware. |

Runtime-tunable values (`GRACE_DAYS`, `DRY_RUN`) deliberately stay in `system_settings`, not env —
they must be changeable without a restart.

### Code

| # | Item | File |
| --- | --- | --- |
| 1 | Money helpers — exact decimal arithmetic | `back/server/src/lib/money/money.js` |
| 2 | In-transaction audit helper (decision C3) | `back/server/src/utils/audit.js` |
| 3 | Vitest config — unit tests only, no DB or network | `back/vitest.config.js` |
| 4 | `npm test` / `npm run test:watch` | `back/package.json` |

**Money.** The pool runs `decimalNumbers: true`, so a `DECIMAL(12,2)` column arrives as a
JavaScript number — safe to read, never safe to do arithmetic on. `money()` wraps before any
arithmetic and `toAmount()` produces the string to store. `formatAmount` groups thousands by slicing
rather than a lookahead regex, because `(\d{3})+(?!\d)` is a nested quantifier that backtracks
badly (caught by `eslint-plugin-security`).

**Audit.** `writeAudit(conn, …)` takes the caller's *transaction* connection, so the change and its
audit row commit or roll back together — a route-level middleware logging after the response can
record a change a rollback undid. Ordinary CRUD keeps the existing middleware; both write to the
same `audit_trail` table. Secrets are stripped centrally (`credentialsEnc`, `password_hash`,
`totpSecret`, callback tokens…) rather than at each call site, and binary blobs are recorded as
`[binary N bytes]`. System actions get `accountId = "system:dunning"` and the like, because
"who disconnected this customer?" must never answer with a blank cell.

### Verification run

| Check | Result |
| --- | --- |
| `cd back && npm test` | ✅ **54 tests, 3 files, 444ms** — no database, no network |
| `cd back && npm run lint` | ✅ 0 errors, 22 warnings (pre-existing style) |
| `cd front && npm run lint` | ✅ 0 errors, 13 warnings |
| `cd front && npm run build` | ✅ built in ~8s |
| `npm audit --omit=dev` (back) | 1 finding — `sharp` (pre-existing, see ⚠️ A4) |
| `npm audit` (front) | ✅ 0 vulnerabilities |
| Dependency smoke test | ✅ `node-cron` validates `0 2 15 * *` and rejects junk · Xendit exposes `createInvoice`/`getInvoiceById`/`getInvoices` · `qrcode` emits a data URL · `decimal.js` gives `0.1 + 0.2 = 0.30` · `@react-pdf/renderer` exports `renderToBuffer` |

**Mutation-tested, not just passing.** Flipping `branchScope`'s empty-scope branch from
`AND 1 = 0` to `""` — i.e. making an unassigned user see *everything* instead of nothing — failed
exactly the two tests written to catch it ("FAILS CLOSED for a user with no branches" and "returns
nothing for an unassigned user"). The guarantee is genuinely pinned, then restored.

### Test suites now in place

| Suite | Tests | Guards |
| --- | --- | --- |
| `lib/money/money.test.js` | 18 | Float traps (`0.1 + 0.2`), half-up rounding, **round-once-at-the-end** (16/31 days of ₱1,200 = ₱619.35, not ₱619.36), exact-amount settlement, signed credits |
| `utils/branchScope.test.js` | 20 | **Branch isolation** — the highest-value new test in the plan. Fail-closed on empty scope, SuperAdmin unrestricted, injection rejected in the column reference, params never interpolated |
| `utils/audit.test.js` | 16 | Uses the caller's connection, id from MySQL not JS, secrets redacted by substring, binary blobs never serialised, system actor named |

### Deferred from the S1 plan, deliberately

**The empty `lib/` folder skeleton was not created.** Directories arrive with the code that fills
them (`lib/money/` exists because money.js does). Empty placeholder folders do not survive git and
tell a reader nothing.

---

## S2 — BSS masters: Plans and Customers ✅

The first two real ISP modules, built end to end through the `new-module` contract.

### Built

| # | Item | File |
| --- | --- | --- |
| 1 | `plans`, `customers`, `counters` tables | `back/database/schema.sql` |
| 2 | Migration + permission rows + Owner grants | `back/database/migrations/002_create_plans_and_customers.sql` |
| 3 | Permissions in the fresh-install seed | `back/scripts/setup-database.js` |
| 4 | Money / latitude / longitude validator helpers | `back/server/src/validators/_helpers.js` |
| 5 | Sequence generator for `ACC-000123` | `back/server/src/lib/counters/counters.js` |
| 6 | Validators | `back/server/src/validators/{plans,customers}.validator.js` |
| 7 | Controllers | `back/server/src/controllers/v1/admin/{plans,customers}.controller.js` |
| 8 | Route wiring with `auditTrail()` | `back/server/src/routes/v1/admin/index.js` |
| 9 | API + React Query layers | `front/src/services/{api,requests}/admin/{plans,customers}.js` |
| 10 | Peso / speed display helpers | `front/src/utils/currency.js` |
| 11 | Plans module (hooks + page + drawer) | `front/src/pages/Admin/Plans/` |
| 12 | Customers module (hooks + page + drawer) | `front/src/pages/Admin/Customers/` |
| 13 | "Subscribers" sidebar group + routes | `front/src/routes/pageRoutes/AdminRoute.jsx` |

### Design decisions taken during S2

| Decision | Rationale |
| --- | --- |
| **Plans are company-wide** — recorded as [D3](00-decisions.md#d3--service-plans-are-company-wide-not-branch-scoped). | One ISP, one price list. A branch-scoped catalogue would mean duplicate rows and a multi-row edit to change one price. Reversible. |
| **Customers are branch-scoped** through `branchScope()`. | A technician assigned to one branch must not read the other branch's subscriber list. |
| **The branch filter narrows, it cannot widen.** | It is applied *on top of* the scope clause, so an out-of-scope `branchId` matches nothing rather than escaping the boundary. |
| **Account numbers come from a `counters` row**, not `MAX(...) + 1`. | Two staff creating a subscriber at the same moment would read the same MAX and collide on the UNIQUE constraint. `LAST_INSERT_ID(nextValue)` allocates atomically under the UPDATE's own row lock. The same table serves invoice numbering in S7. |
| **The sequence is allocated on the caller's transaction.** | A number allocated on another connection would survive a rollback of the row it was for — harmless for accounts, but a gap in an invoice sequence is what an auditor asks about. |
| **Money and speed validation live in `_helpers.js`.** | `money()` caps at the real `DECIMAL(12,2)` limit and rejects a third decimal place rather than silently rounding someone's bill. |
| **Mutations write an in-transaction audit row** via `writeAudit`, on top of the route middleware. | A price change or a subscriber edit has to be answerable months later, and the audit row must roll back with the change. |
| **Delete is refused while dependents exist.** | Deleting a plan still on subscriptions would leave the billing cycle unable to price a subscriber; deleting a customer with a live subscription leaves an active ONU nobody is billing for. Both guards tolerate `subscriptions` not existing yet (S4) and start enforcing the moment it does. |
| **`accountNo` and `branchId` are not editable.** | The account number is quoted on invoices already sent; moving a subscriber between branches would strand their ONU, subscription and invoice history. Both belong to a dedicated transfer flow if ever needed. |
| **`customers.email` is NOT NULL.** | Invoices are delivered by email only — a subscriber without one cannot be billed. The form says so rather than just marking the field required. |

### Verification run

| Check | Result |
| --- | --- |
| `cd back && npm run lint` | ✅ 0 errors, 26 warnings (pre-existing style) |
| `cd back && npm test` | ✅ **64 tests, 4 files** |
| `cd front && npm run lint` | ✅ 0 errors, **13 warnings — one fewer than before S2** |
| `cd front && npm run build` | ✅ built in ~8s |
| Controller route smoke test | ✅ both routers expose GET / · GET /:id · POST / · PUT /:id · DELETE /:id |
| Validator helper behaviour | ✅ `money()` accepts `1999` and `"1999.50"`, rejects `1999.555`, `-1` and `1e11`; coordinates reject out-of-range; `""` reads as absent |
| `npm run db:migrate` | ✅ applied and re-verified — see "Database verification" |

**Two bugs caught before they shipped:** a JSX nesting error in `PlanFormDrawer` (an extra
`</Sheet>` with the `</Form>` close missing — the build would have failed), and an identifier
collision in `AdminRoute.jsx` where the lucide `Users` icon clashed with the lazily-loaded `Users`
page (a parse error; the sidebar icon is now `UsersRound`).

**A pre-existing warning fixed:** the Company Profile page from S0 set three pieces of state inside
its data effect, which cascades a render every time the query resolves. The logo preview is now
derived from the server value with `undefined` meaning "untouched" and `null` meaning "removed", so
no state is set from the effect at all.

---

## S3 — Network inventory 🟡 (backend complete, frontend pending)

The OSS half of the system: OLT → PON port → splitter → NAP → ONU.

### Built — backend

| # | Item | File |
| --- | --- | --- |
| 1 | Envelope encryption for device credentials | `back/server/src/lib/crypto/credentialCrypto.js` (+ 19 tests) |
| 2 | Five tables, in FK order | `back/database/schema.sql` |
| 3 | Migration + six `network/*` permissions + Owner grants | `back/database/migrations/003_create_network_inventory.sql` |
| 4 | Permissions in the fresh-install seed | `back/scripts/setup-database.js` |
| 5 | Validators for all five entities | `back/server/src/validators/network.validator.js` |
| 6 | Scoped parent lookups + topology resolution | `back/server/src/lib/network/network.helpers.js` |
| 7 | Five controllers | `back/server/src/controllers/v1/admin/{olts,pon-ports,splitters,naps,onus}.controller.js` |
| 8 | Route wiring under `/api/v1/admin/network/*` | `back/server/src/routes/v1/admin/index.js` |

### Design decisions taken during S3

| Decision | Rationale |
| --- | --- |
| **`branchId` is denormalised onto all five levels**, not walked up the chain (resolves P2). | Scoping stays uniform (`branchScope()` on one column), lists need no three-deep join, and equipment does not move between branches — a relocation is a decommission-and-reinstall. |
| **Envelope encryption, not a single key.** | Each OLT gets its own random data key, wrapped by the master key. Rotating the master re-wraps N small keys instead of re-encrypting every blob, and the master never encrypts two plaintexts — which is what makes an IV-reuse mistake catastrophic under AES-GCM. |
| **Credentials are never returned, not even redacted.** | Responses carry a boolean `hasCredentials`. There is no API path that reads a device password back, so there is nothing to leak. Omitting the column from the shared `OLT_COLUMNS` is the safeguard. |
| **Omitting `credentials` on update keeps the stored ones.** | An edit form that cannot display a password must not be able to erase one by not sending it. |
| **Deleting an OLT clears its credentials.** | A retired device's login has no reason to stay recoverable. |
| **`provisioningState` is not editable through the API.** | It is owned by the provisioning worker (S6) and only moves after a confirmed device response. If staff could set it, the database would claim a customer is connected when the OLT disagrees — and the dunning engine reads this column to decide who to cut off. Inventory state lives in a separate `recordStatus`. |
| **An ONU's `oltId`/`ponPortId` are derived from its NAP, never accepted from the client.** | They are the shortcut the worker uses to resolve ONU → driver in one query. A client-supplied value could point a disconnect at the wrong device. |
| **MAC is normalised to one spelling.** | Devices report three forms — `30:c5:…`, `30-c5-…`, and the Cisco-style `30c5.0fd8.7f2c` the HSGQ prints. On EPON the MAC *is* the ONU's identity and the join key against MikroTik sessions, so storing three spellings would silently break discovery matching. |
| **Splitter re-parenting is allowed but cycle-checked.** | Plant does get re-wired, but a loop would make the chain walk, the topology tree and driver resolution for every ONU below it spin forever. |
| **Delete guards at every level.** | An OLT with PON ports, a port with splitters or ONUs, a splitter with NAPs or children, a NAP with ONUs, an ONU that is active/suspended at the OLT — each refuses with a 409 explaining what to remove first. |

### Verification run — 41 checks, 41 passed

Against the live API and database, building the full chain then attacking it.

| Area | Verified |
| --- | --- |
| **Credential secrecy** | The OLT password appears in **no** response — detail or list — and `credentialsEnc` is never serialised; `hasCredentials` reports the fact instead; editing without sending credentials keeps them |
| **Derived topology** | An ONU created against a NAP two splitters deep resolved **both** `oltId` and `ponPortId` by walking the cascade |
| **MAC normalisation** | `30c5.…` dotted input stored as colon form, and the **same address in a different spelling was still caught as a duplicate** |
| **Worker-owned state** | Posting `provisioningState: "active"` left the ONU `unprovisioned` |
| **Topology integrity** | A splitter cannot be its own parent, and cannot be moved under its own descendant |
| **Delete guards** | All four refusals fired, plus a NAP shrink |
| **Branch isolation** | A branch-2 owner got **404 on all five** entity types, and could neither attach a PON port to branch 1's OLT nor hang a NAP off its splitter |

**🐛 A real bug the test caught.** The NAP shrink guard compared the *count* of connected ONUs
against the new port count. One modem on port 5 therefore passed a shrink to 2 ports — the count
was 1. The blocker is the **highest port number in use**, not how many there are; fixed and
re-verified.

Two failures along the way were the test harness, not the app: a hardcoded MAC that collided with
the previous run (which incidentally proved the duplicate guard works across runs), and the
`accessToken`-object mistake carried over from the S2 script.

### Also fixed during S3

**🐛 Every `invalid_type_error` in the backend was silently ignored.** The backend runs **Zod 4**,
which renamed that option to `error`; ten of them across `_helpers.js`, `plans.validator.js` and
`network.validator.js` were producing raw messages like *"Invalid input: expected number, received
NaN"* instead of *"Latitude is required"*. The **frontend is on Zod 3**, where `invalid_type_error`
is correct — so the two sides genuinely need different spellings, and only the backend was wrong.

A ReDoS-prone pattern in the PON `portIndex` validator (`^[0-9]+(\/[0-9]+)*$` — a repeated group
wrapping a repeated class) was replaced with a per-segment check, the same fix applied earlier in
`branchScope`.

### Built — frontend

| # | Item | File |
| --- | --- | --- |
| 9 | Ten service files (api + requests) | `front/src/services/{api,requests}/admin/network/*.js` |
| 10 | OLTs module | `front/src/pages/Admin/Network/Olts/` |
| 11 | PON Ports module | `front/src/pages/Admin/Network/PonPorts/` |
| 12 | Splitters module | `front/src/pages/Admin/Network/Splitters/` |
| 13 | NAPs module, table + map views | `front/src/pages/Admin/Network/Naps/` |
| 14 | ONUs module | `front/src/pages/Admin/Network/Onus/` |
| 15 | NAP map (`react-leaflet`) | `front/src/components/NetworkMap.jsx` |
| 16 | Topology tree + recursive node | `front/src/pages/Admin/Network/Topology/` |
| 17 | "Network" sidebar group, six routes | `front/src/routes/pageRoutes/AdminRoute.jsx` |

### Frontend design decisions

| Decision | Rationale |
| --- | --- |
| **The topology tree is hand-rolled, not a library.** | shadcn has no tree primitive, and adding one would put a second component vocabulary into a codebase whose conventions forbid exactly that. A recursive component over a disclosure button is ~40 lines. It follows the ARIA tree pattern (`role="tree"`/`treeitem`, `aria-expanded`, `aria-level`) so depth is announced, not just indented. |
| **The tree is assembled in the browser from five list calls.** | The endpoints already exist, already enforce branch scoping, and are already cached — so the tree is free when the user arrives from an inventory page. The seam for a server-built `/topology` endpoint is one function, if the plant outgrows it. |
| **Cycle guard in the tree walk.** | The API refuses to create a loop, but a tree that hangs on bad data fails worse than one that shows it. A repeated splitter on one path renders as "cycle detected" rather than recursing. |
| **The tree says when it is showing part of the plant.** | Each list is capped at one page; exceeding it raises a banner naming which levels are truncated, instead of quietly presenting a partial network as complete. |
| **`CircleMarker`, not Leaflet's default pin.** | The default marker is a PNG loaded by URL — the well-known "markers vanish in production" bundler bug. A drawn circle has no asset to lose, takes theme tokens directly, and scales better where boxes cluster on one street. |
| **Map fill encodes capacity** (green has room / amber nearly full / red full). | A technician looking at the map is asking "where can I connect someone?". Colour is never the only signal — the popup states the numbers. |
| **NAPs with unusable coordinates are skipped and counted**, not plotted. | A row with a bad latitude would otherwise appear in the Gulf of Guinea. The footer says how many were left out. |
| **The map fetches its own unpaginated set**, gated to when the map view is showing. | Panning around should not reveal half the plant missing because the table was on page 1. |
| **Pasting "lat, lng" into the latitude box fills both fields.** | Field techs copy the pair straight out of a phone map app; the common error is pasting both into one box. |
| **The ONU form cannot set `provisioningState`.** | It mirrors the API rule. The record-status field explains the distinction in place, so nobody goes looking for the missing control. |
| **OLT credentials are never pre-filled on edit**, and the drawer states which case it is in. | A blank field that looks pre-filled makes "leave blank to keep" ambiguous. Username and password are validated as a pair — one without the other is a device that fails at connect time. |

### Verification run

| Check | Result |
| --- | --- |
| `cd front && npm run lint` | ✅ 0 errors, 14 warnings (13 pre-existing + 1 known `form.watch` React Compiler notice, same as the existing `CreateUserDrawer`) |
| `cd front && npm run build` | ✅ built; leaflet bundled, per-module chunks emitted for all six screens |
| Vite transform of every new module | ✅ 200 on all nine files, including `AdminRoute.jsx` |

⚠️ **Not visually verified.** There is no browser tooling in this environment, so the rendering of
these screens — and the map in particular — has not been seen. `cd front && npm run dev`.

---

## S4 — Subscriptions ✅

The binding that makes a customer billable: customer + plan + ONU, plus the lifecycle the billing
cycle and dunning sweep both read.

### Built

| # | Item | File |
| --- | --- | --- |
| 1 | `subscriptions` table | `back/database/schema.sql` |
| 2 | Migration + permission + Owner grant | `back/database/migrations/004_create_subscriptions.sql` |
| 3 | Permission in the fresh-install seed | `back/scripts/setup-database.js` |
| 4 | Validators, incl. the transition schema | `back/server/src/validators/subscriptions.validator.js` |
| 5 | Controller with `POST /:id/status` | `back/server/src/controllers/v1/admin/subscriptions.controller.js` |
| 6 | Route wiring | `back/server/src/routes/v1/admin/index.js` |
| 7 | API + React Query layers | `front/src/services/{api,requests}/admin/subscriptions.js` |
| 8 | Subscriptions module | `front/src/pages/Admin/Subscriptions/` |
| 9 | Route in the Subscribers group | `front/src/routes/pageRoutes/AdminRoute.jsx` |

### Design decisions

| Decision | Rationale |
| --- | --- |
| **No `statementDay` column** — [D5](00-decisions.md#d5--subscriptions-have-no-per-row-billing-anchor). | The corrected model bills everyone on the 15th. A per-row anchor would be config nothing reads, that could silently disagree with the cron. |
| **Only `activate` and `terminate` are exposed** — [D6](00-decisions.md#d6--suspension-and-restoration-are-not-staff-actions). | `suspended` is a claim about what a device is doing. The worker writes it after a confirmed response; a staff button would let the database contradict the hardware. |
| **Subscriptions start `pending`.** | Selling a connection and switching it on are different events, and proration reads the activation date, not the creation date. |
| **Activation requires an attached ONU.** | There is nothing to provide service through otherwise — and the dunning worker resolves the OLT via the ONU. |
| **An active subscription cannot have its modem detached.** | It would leave a live service the worker cannot suspend. |
| **Terminate releases the ONU but says the device is still up.** | Deprovisioning is a worker job (S6). The audit line says so rather than implying the modem went dark. |
| **A terminated subscription cannot be edited.** | Invoices point at it; editing would rewrite the past. |
| **Delete only works if it was never activated.** | Anything that has been live may have invoices against it. Terminate those instead — the record-vs-lifecycle split is the same one `onus.recordStatus` uses. |
| **MRR counts suspended subscriptions.** | They are still customers, just currently cut off for non-payment. |

### Verification run — 34 checks, 34 passed

Full chain built against the live API — company → branch → customer → plan → OLT → PON → splitter
→ NAP → ONU → subscription — then the rules attacked.

| Area | Verified |
| --- | --- |
| **Creation** | Starts `pending`, `activatedAt` null, joins in customer and plan, inherits the customer's branch, unknown plan → 404 |
| **Activation** | Refused without a modem; succeeds with one; **`activatedAt` stamped** (what proration reads); activating twice → 409 |
| **Worker-owned edges** | `suspend`, `restore` and `reactivate` are all **rejected as invalid actions (400)**, and sending `status: "suspended"` to the edit endpoint leaves the row `active` |
| **ONU binding** | A modem on a live subscription cannot be reused; an active subscription cannot have its modem detached; a free modem attaches |
| **Guards written in S2/S3 now fire** | Plan in use → 409, customer with a live subscription → 409, bound ONU → 409 — the `information_schema` guards written before this table existed activated correctly |
| **Delete vs terminate** | A once-active subscription cannot be deleted; a never-activated one can |
| **Termination** | Status and `terminatedAt` set, **ONU released**, terminated row not editable, and the released modem binds to a new subscription |
| **Audit** | Changes recorded, the activation named, and the **termination reason preserved** in metadata |

Notably this run confirmed the forward-declared guards from earlier stages: the `subscriptions`
table did not exist when the plans, customers and ONUs controllers were written, and their
`information_schema`-gated checks started enforcing the moment migration 004 created it.

### Verification

| Check | Result |
| --- | --- |
| `cd back && npm run lint` | ✅ 0 errors |
| `cd back && npm test` | ✅ 83 tests |
| `cd front && npm run lint` | ✅ 0 errors, 15 warnings (14 pre-existing + 1 known `form.watch` notice) |
| `cd front && npm run build` | ✅ built |
| Migration 004 | ✅ applied; test data removed afterwards |

⚠️ Frontend **not visually verified** — no browser tooling available.

---

## S5 — Settings, the jobs queue and the worker ✅

The machinery every automated stage from S6 onward runs on.

### Built

| # | Item | File |
| --- | --- | --- |
| 1 | `system_settings` + `jobs` tables | `back/database/schema.sql` |
| 2 | Migration, permission, and seeded defaults per company | `back/database/migrations/005_create_settings_and_jobs.sql` |
| 3 | Settings service, incl. `getGraceDays()` | `back/server/src/lib/settings/settings.service.js` (+ 24 tests) |
| 4 | The queue — enqueue / claim / complete / fail / cancel / reclaim | `back/server/src/lib/jobs/jobs.queue.js` (+ 23 tests) |
| 5 | Worker loop with pluggable processors | `back/server/src/lib/jobs/worker.js` |
| 6 | Worker process entry point | `back/server/bin/worker.js` (`npm run worker`) |
| 7 | Settings + queue API | `back/server/src/controllers/v1/admin/system.controller.js` |
| 8 | Validators | `back/server/src/validators/system.validator.js` |
| 9 | System page — kill switch, billing rules, live queue | `front/src/pages/Admin/System/` |
| 10 | Service layers + route registration | `front/src/services/{api,requests}/admin/system.js`, `AdminRoute.jsx` |

### Design decisions

| Decision | Rationale |
| --- | --- |
| **The queue is a MySQL table, not Redis.** | Client decision, and it earns it: retries, backoff, dead-lettering and cancellation are columns, the whole system stays on one datastore, and the queue can be read with a `SELECT` — which is what makes the System page possible at all. |
| **`FOR UPDATE SKIP LOCKED` is the whole mechanism.** | It is what lets several workers run without a broker. Proven against real MySQL, not just asserted. |
| **The worker runs one job at a time.** | Not a simplification to fix later — the lab OLT has a 250 MHz CPU and tolerates one CLI session. Scaling means a per-device lock, and `olts.maxConcurrentSessions` already records what each device will take. |
| **Backoff carries jitter.** | When an OLT goes unreachable every queued job for it fails in the same second. Without jitter they would all retry in the same second too, arriving as a synchronised wave the device has no chance of absorbing. |
| **`dead` is a state a human looks at.** | Not "failed quietly". It logs with a 🚨 prefix and raises a banner on the System page, because a dead job means a customer is in a state nobody intended and nothing further is coming. |
| **Cancel touches queued jobs only.** | A worker mid-command cannot be interrupted safely; the processor's own precondition re-check is the backstop for anything already in flight. |
| **Stale locks are reclaimed on age, and the spent attempt still counts.** | A killed worker leaves a row `processing` with no lock to expire — nothing in the database knows the holder is gone. Preserving the attempt means a job that reliably kills its worker still reaches the dead letter rather than cycling forever. |
| **The placeholder processors throw rather than no-op.** | A `deactivate` that quietly reported success would tell the system a customer was disconnected when nothing touched the device — the exact lie every invariant here exists to prevent. |
| **Settings are stored in the database, not the environment.** | `DRY_RUN` is a switch someone reaches for while a disconnect is going wrong; it cannot need a restart. |
| **Turning dry-run OFF asks for confirmation; turning it ON does not.** | Off is the direction that starts cutting people off. On is a safety move, and a confirmation there is friction in an emergency. |

### 🐛 The `0 || 3` bug, pinned permanently

The previous build read the grace period as `parseInt(raw, 10) || 3` in four places. `parseInt("0")`
is `0`, and `0 || 3` is `3` — so setting a zero-day grace silently gave every customer three extra
days, the sweep looked broken, and nothing logged an error.

The client's corrected model sets **GRACE_DAYS to 0**, so zero is the configured value, not an edge
case. `getGraceDays()` treats it as valid and falls back to 3 only on junk, negatives or absurd
values — erring toward *more* grace, because that only delays a disconnection while erring the
other way cuts off paying customers early. A test named for the bug asserts it.

### Verification

| Check | Result |
| --- | --- |
| `cd back && npm test` | ✅ **130 tests** (7 files) — up from 83 |
| `cd back && npm run lint` | ✅ 0 errors |
| `cd front && npm run lint` / `build` | ✅ 0 errors; built |
| Migration 005 | ✅ applied |
| Worker process | ✅ starts, connects, registers all four job types, polls, shuts down cleanly |
| Vite transform of the new frontend files | ✅ 200 on all four |

**Queue integration test against real MySQL — 33 checks, 33 passed.** The unit tests prove the SQL
is shaped correctly with a fake connection; they cannot prove `SKIP LOCKED` does what it claims,
because that is a property of the database. So it was exercised for real:

| Area | Verified |
| --- | --- |
| **Concurrency** | Three workers claiming simultaneously each got a **different** job; a fourth correctly found nothing; each row records its holder |
| **Dedupe** | A second job for a live key is skipped and returns the existing id; only one row exists; unkeyed work still repeats freely |
| **Retry** | First failure requeues with a ≥60s backoff, `nextRunAt` pushed forward, lock released, error recorded — and the job is **not claimable** until due |
| **Dead-letter** | Exhausted attempts park the job as `dead`, holding no lock, with no retry scheduled |
| **Cancel** | A queued job cancels with its reason kept, no longer blocks its dedupe key — and a job **already `processing` is left alone** |
| **Stale reclaim** | A row held by a stopped worker is released and becomes claimable, with the spent attempt preserved |

One failure during that run was the test's own fault: it assumed `claim()` would return the job it
had just enqueued, when `claim()` correctly takes the **oldest** due job. Fixed by setting the
in-flight state directly, which is what the assertion was actually about.

⚠️ Frontend **not visually verified** — no browser tooling available.

---

## S6 — OLT drivers and provisioning ✅

The stage where the queue starts doing something to real hardware — and where
the system's central invariant is finally enforced end to end.

### Built

| # | Item | File |
| --- | --- | --- |
| 1 | Driver contract + `describe()` | `back/server/src/lib/olt-drivers/driver.interface.js` |
| 2 | MockOltDriver | `back/server/src/lib/olt-drivers/mock.driver.js` |
| 3 | HSGQ driver: commands, parsers, telnet, driver | `back/server/src/lib/olt-drivers/hsgq/` (+ 27 tests) |
| 4 | `resolveDriver()` | `back/server/src/lib/olt-drivers/index.js` |
| 5 | `network_action_logs` — the device black box | `back/database/schema.sql`, migration `006` |
| 6 | Provisioning processor | `back/server/src/lib/jobs/processors/provisioning.processor.js` |
| 7 | Processor registration | `back/server/bin/worker.js` |
| 8 | Provisioning + action-log API | `back/server/src/controllers/v1/admin/provisioning.controller.js` |
| 9 | Provision actions on the ONU page | `front/src/pages/Admin/Network/Onus/hooks.jsx` |
| 10 | Device history drawer | `front/src/pages/Admin/Network/Onus/components/ActionLogsDrawer.jsx` |
| 11 | Vendor transcripts + bench report | `docs/vendor-transcripts/hsgq-xe04i/` |

### Ported at high fidelity, as the plan required

The HSGQ driver came across from V2 essentially unchanged — it is the only
bench-verified artefact in either old codebase, tested in July 2026 against
firmware `HSGQ-XE04I_I_V3.3.6C_Rel`. The command sequences are not guesses:

| Action | Commands | Why |
| --- | --- | --- |
| Suspend | `blacklist add mac <MAC>` **then** `onu-deregister <id>`, then save | A bare deregister is **not** a suspension — the bench showed the ONU re-registering via MPCP in ~33 s. The blacklist holds it down, and the save is what makes it survive a reboot. |
| Restore | `blacklist delete mac <MAC>`, then save | The ONU re-registers on its own once un-blacklisted. |
| — | **Never `onu-authorize`** | It is a *global* auth-mode command, not a per-ONU action. Using it would silently fail to reconnect anyone while appearing to succeed. A test asserts it never appears. |

### Design decisions

| Decision | Rationale |
| --- | --- |
| **`describe()` added to the driver contract.** | Dry-run must log the *real* command. A kill switch that logged "would deactivate ONU 1/27" tells you nothing about whether the command is right — which is the entire thing you are rehearsing before pointing this at live customers. HSGQ's `describe()` uses the same builders the live path uses, so the two cannot drift. |
| **Four gates before anything is sent.** | The ONU still exists; it is not already in the target state; the reason still holds; dry-run is off. |
| **The precondition re-check is the backstop for the payment race.** | Cancellation cannot touch a job once it is `processing`, so the processor re-checks as late as possible. A disconnect whose subscription is no longer `active` is skipped — and the decision *not* to disconnect is written to the log, because that is a result someone will want to point at. |
| **State and log are written in one transaction, only after success.** | No path marks a customer suspended without a matching successful command, and none logs a command whose state write rolled back. A failure is "nothing happened", never "half happened". |
| **The subscription is flipped here, not through its own controller.** | This is the only place that has seen the OLT confirm it — the other half of decision [D6](00-decisions.md#d6--suspension-and-restoration-are-not-staff-actions). |
| **A status read never resurrects a suspended ONU.** | It is offline because we put it there; only an explicit activate may undo that. Encoded in the `CASE` on the update. |
| **Timestamps are server-side, never the device's.** | The bench XE04I reports the year 2000 until NTP is configured, which would make the log useless for exactly the disputes it exists to settle. |
| **`provisioning` and `action_logs` are separate permissions.** | Auditing a disconnection should not require the power to cause one. |
| **The API returns 202 and the UI says "queued".** | Nothing has reached the device yet. A toast saying "suspended" would claim something no device has confirmed. |
| **The ⋮ menu offers only the transition that would change something.** | Offering "restore" on a live connection invites a pointless command to a device that tolerates one session at a time. |

### Verification

| Check | Result |
| --- | --- |
| `cd back && npm test` | ✅ **157 tests** (8 files) — up from 130 |
| `cd back && npm run lint` | ✅ 0 errors |
| `cd front && npm run lint` / `build` | ✅ 0 errors; built |
| Migration 006 | ✅ applied |
| Parsers against the bench transcript | ✅ 3 rows read, including the previous operator's free-text description |
| Worker | ✅ registers the provisioning processor for all three device job types |

**End-to-end against real MySQL + the mock OLT — 32 checks, 32 passed.** The whole chain: enqueue →
worker → device → database.

| Scenario | Verified |
| --- | --- |
| **Dry run** | Job succeeds, a `dry_run` row is logged **with the real command**, no device response — and the ONU and subscription are **unchanged** |
| **Live disconnect** | ONU → `suspended` **and** the subscription follows in the same transaction; the log holds the command, the verbatim reply, the duration, and `system:dunning` as the actor |
| **Idempotency** | Re-disconnecting an already-suspended ONU is skipped and sends **no second command** |
| **Restore** | ONU and subscription return to `active`, attributed to `system:payment` |
| **The payment race** | A disconnect whose subscription is no longer active is **skipped, not executed**, and the decision is recorded |
| **Device failure** | Job requeues with backoff; **the ONU and subscription are untouched**; the failed attempt is still on record; the job remembers why |
| **Status read** | Succeeds, is logged as a read, and **does not resurrect a suspended ONU** |

⚠️ **Still not verified on real hardware.** Everything above ran against the mock driver. The HSGQ
driver has never opened a telnet session to the actual XE04I — that is blocker **M24** and needs
bench access. The commands themselves are bench-verified; what is untested is this codebase
sending them.

⚠️ Frontend **not visually verified** — no browser tooling available.

---

## Database verification — 2026-09-07

The owner supplied `back/.env`, which unblocked A1. Everything below ran against real MySQL
8.0.45 on an empty `teranetwork_system` database.

### Migrations

| Step | Result |
| --- | --- |
| `npm run db:migrate` on an empty database | ✅ `schema.sql`, `001`, `002` all applied |
| Re-run | ✅ all three reported "already applied" — no drift, no duplicate objects |
| Tables created | ✅ 19, including `user_branches`, `counters`, `plans`, `customers` |
| `companies.address` / `companies.tin` | ✅ present — the `INFORMATION_SCHEMA`-guarded `ALTER` works on a database that already had them from the baseline |
| `npm run db:setup` re-run | ✅ idempotent — "All permissions already present", superadmin skipped, **0 duplicate permissions** |

### 🐛 A defect found by running it, and fixed

`setup-database.js` seeded permissions all-or-nothing on `COUNT(*) > 0`. That guard broke the
moment a migration started inserting permissions of its own: `runMigrations()` runs **first**, so
migration 002 inserted `plans` and `customers`, the seeder then saw a non-empty table and skipped
**all five base permissions** — leaving a fresh install with no dashboard, users, settings or
audit-trail access, and no error to say so.

The `new-module` skill warns about the reverse case (a seeded install never picking up a new
permission) but not this one. Fixed by checking per row instead of per table, which is what the
migration already does. Verified: the first run seeded 5 and skipped the 2 already present; the
second run inserted nothing and created no duplicates.

### End-to-end run — 35 checks, 35 passed

A full vertical slice against the live API and database: superadmin login → company → two Taguig
branches → owner users → admin login → plans → subscribers → branch isolation → audit → delete
guards.

| Area | Verified |
| --- | --- |
| **S0 — company profile** | `GET /companies/profile` resolves the single company without an ID; `PUT` saves branding; address and TIN persist; **phone normalised to `0917 1112 233`** by `optionalPhone()` before the controller saw it |
| **S0 — branch assignment** | Creating an Owner writes exactly one `user_branches` row, mirroring the home branch |
| **S0 — branch isolation** | A branch-2 owner **cannot** list branch-1 subscribers; a direct read of one returns **404, not 403**; and passing `?branchId=<branch 1>` returns **zero rows** — the filter narrows within scope, it cannot widen it |
| **S2 — plans** | Create, list (correct `{ plans, pagination }` envelope), duplicate name → **409**, three-decimal price → **400**, `monthlyPrice` round-trips exactly as `4999.00` |
| **S2 — customers** | Create, list, duplicate email → **409**, missing email → **400**, phone stored as `09XX XXXX XXX` |
| **S2 — account numbering** | Allocated server-side in `ACC-000001` form and advancing per subscriber |
| **D3 — plans are company-wide** | The branch-2 owner sees the branch-1 owner's plan — shared catalogue, as designed |
| **C3 — in-transaction audit** | Plan and customer mutations produce `audit_trail` rows carrying before/after state |
| **Delete guards** | Plan deletes while unused; the soft-deleted plan then returns 404 |

One failure along the way was **my test harness, not the app**: the login payload exposes both
`token` (the bearer string) and `accessToken` (an object `{token, expiresAt, expiresIn}`), and the
script picked the object, sending `Bearer [object Object]`. Worth knowing for any future client.

### Environment notes

- **Port 3000 is occupied by a different project of yours** (`PROJECTS/EWSS/OVERWATCHV2`), so
  `npm start` fails with "Port 3000 is already in use". The test ran on `PORT=3100`; that other
  process was left untouched.
- The **auth rate limiter is real and strict** — 15-minute lockout per IP. Repeated logins during
  testing tripped it; the run used `RATE_LIMIT_AUTH_POINTS=500` as a one-off env override, no file
  changed.
- **All e2e data was removed afterwards.** The database now holds the schema, 7 permissions and
  the seeded superadmin, and no tenant data.

---

## S7 — Billing ✅

The stage the whole system exists to serve. Every rule here was ported from V2
rather than reinvented, because the arithmetic had already been argued over with
the client once and the tests that pin it are worth more than the code.

### Built

| # | Item | File |
| --- | --- | --- |
| 1 | Billing date math — the 15th and the 2nd | `back/server/src/lib/billing/billing.dates.js` (+ 15 tests) |
| 2 | Pure invoice arithmetic on `money.js` | `back/server/src/lib/billing/invoice.calc.js` (+ 24 tests) |
| 3 | The cycle engine | `back/server/src/lib/billing/cycle.service.js` |
| 4 | Settlement, reconnection, voiding | `back/server/src/lib/billing/settlement.service.js` |
| 5 | Overdue sweep + due reminders | `back/server/src/lib/billing/reminders.service.js` |
| 6 | Invoice loading, PDF generation, storage | `back/server/src/lib/billing/invoice.render.js` |
| 7 | Invoice PDF renderer | `back/server/src/lib/pdf/invoicePdf.js` |
| 8 | Pay-link QR | `back/server/src/lib/qr/payQr.js` |
| 9 | SMTP transport + `email_events` | `back/server/src/lib/email/email.service.js` |
| 10 | Four customer-facing templates | `back/server/src/lib/email/templates/invoiceEmails.js` |
| 11 | Email job processor | `back/server/src/lib/jobs/processors/email.processor.js` |
| 12 | Cycle + daily schedules | `back/server/src/lib/scheduler/scheduler.js` |
| 13 | Five tables + four permissions | `back/database/schema.sql`, migration `007` |
| 14 | Invoices API | `back/server/src/controllers/v1/admin/invoices.controller.js` |
| 15 | Payments API | `back/server/src/controllers/v1/admin/payments.controller.js` |
| 16 | Adjustments API | `back/server/src/controllers/v1/admin/adjustments.controller.js` |
| 17 | Public pay-link API | `back/server/src/controllers/v1/public/pay.controller.js` |
| 18 | Invoices page + detail, payment and cycle drawers | `front/src/pages/Admin/Billing/Invoices/` |
| 19 | Payments ledger | `front/src/pages/Admin/Billing/Payments/` |
| 20 | Adjustments queue + form | `front/src/pages/Admin/Billing/Adjustments/` |
| 21 | The customer's payment page | `front/src/pages/Public/PayInvoice.jsx`, route `/pay/:token` |

### Decisions worth knowing before touching this code

| Rule | Why |
| --- | --- |
| **Statements issue on the 15th, not the 1st.** | It is what makes "a suspended customer accrues nothing" fall out of the ordinary skip rule. The cycle runs *after* the 2nd-of-month disconnection, so a suspended subscription is skipped and never billed. On a 1st-of-month statement the June invoice would be generated the day before the June 2 disconnection and the customer would wrongly owe two months. `billing.dates.test.js` pins both constants. |
| **A suspension does not reduce the bill.** | Client decision: a customer cut off on Aug 5 for non-payment and reconnected on Aug 12 still owes the full month, because the downtime was their own late payment. Both obvious "fixes" — subtracting suspended days, re-anchoring to the payment date — need a fifth parameter on `serviceDaysInPeriod`, so a test pins `.length === 4`. |
| **Proration comes from the unrounded daily rate.** | 16 days of a ₱1,200 month is ₱619.35 exactly; rounding the daily rate to ₱38.71 first gives ₱619.36. One centavo, every prorated invoice, forever. |
| **`UNIQUE(subscriptionId, billingPeriodStart)` is the double-billing guard.** | The cycle is a scheduled job and scheduled jobs get run twice. The engine catches `ER_DUP_ENTRY` and reports a skip rather than pre-checking and hoping. |
| **`settleInvoice()` is the only way an invoice becomes paid.** | The cash endpoint and (in S8) the Xendit webhook call the same function, so the two paths cannot drift on idempotency, the exact-amount rule, or reconnection. |
| **No partial payments.** | Client rule, compared at 2dp through `decimal.js`. A float comparison either rejects a correct payment or accepts one a centavo short, and both end with somebody's internet in the wrong state. |
| **Reconnection rides on the payment transaction.** | Per decision D6, restoring service is not a staff action. The `activate` job is enqueued in the same transaction as the payment — and only when *nothing* is still owed, so paying one of three overdue invoices does not buy back service the next dunning sweep would cut again. |
| **Adjustments queue rather than edit.** | A customer complaining on the 20th is complaining about a document already in their inbox. The correction lands on the *next* invoice as its own line, so their copy and ours never disagree. `appliedInvoiceId IS NULL`, read `FOR UPDATE`, is the guard; voiding an invoice releases its charges back. |
| **The sign comes from the `kind`, not the caller.** | The API takes a positive amount and negates credits and discounts. A stray minus in a form cannot turn a goodwill credit into a charge. |
| **Voiding needs a written reason and keeps the row.** | Invoice numbers are sequential; "why is INV-2026-000412 missing?" has to be answerable a year later by someone who was not here. |
| **PDFs live in `back/storage/`, not `public/`.** | An invoice carries a name, an address and what somebody owes, and invoice numbers are guessable. Nothing serves that directory statically; the only ways in are the permission-checked admin endpoint and the invoice's own `publicToken`. |
| **The QR encodes our `/pay/<token>`, never a gateway URL.** | Gateway links expire in about a day; an invoice issued on the 15th is due on the 2nd and will be scanned on the 30th. Our page stays valid and can say "already paid" or "voided" — a dead gateway URL can say neither. |
| **The public page is a bearer credential, bounded deliberately.** | 128 random bits, rate-limited, an identical 404 for a wrong token and a malformed one, and a response carrying only what a person needs to recognise their own bill — no customer id, subscription id, branch, or address. |
| **Invoice numbers reuse the S2 `counters` table.** | It already allocates gap-free sequences atomically. V2 had a second `invoice_counters` table doing the same job; one mechanism is easier to trust than two. |
| **The scheduler runs in the worker, not the API.** | The API may run several instances behind a load balancer and each would fire the same cron. `RUN_SCHEDULER=false` disables it on additional workers if that ever gets scaled out. |

### Ported from V2, and what changed

| V2 file | Change |
| --- | --- |
| `lib/billing/billing.dates.js` | Near-verbatim. The date math works unchanged under collision C1 (Manila-local storage), and its two UTC-boundary tests were re-based to prove that. |
| `lib/billing/invoice.calc.js` | Rewritten onto `money.js`. V2's float `round2` is gone; amounts are now 2dp strings that go into DECIMAL columns unchanged. |
| `lib/billing/cycle.service.js` | Re-based onto business IDs, `SELECT UUID()`, `getCurrentTimestampLocal()`, in-transaction `writeAudit`, and the shared `counters` table. Now branch-scopeable and reports `failed` separately from `skipped`. |
| `lib/billing/settlement.service.js` | Same idempotency and exact-amount rules; gained the reconnection enqueue and `voidInvoice`. |
| `lib/billing/reminders.service.js` | Same sweep; `enqueue` now takes a real connection because the dedupe check is a locking read. |
| `lib/pdf/invoicePdf.js` | Ported. Amounts now format through `money.js` rather than `Intl.NumberFormat`, so the figure on the PDF is the string the invoice was computed with. Company branding comes from the company profile; paid and void are said in words. |
| `lib/qr/qrcode_generate.js` | **Discarded.** It was event-badge code from an unrelated project, importing `canvas` and `mime`. Replaced by `lib/qr/payQr.js` on the `qrcode` dependency already present. |
| `lib/email/*` | Consolidated into one service and one template module. All interpolation now goes through `escapeHtml` — V2 interpolated customer names raw. |

### Verified

**196 unit tests** across 10 files (39 of them new: 15 date, 24 arithmetic).

**127 e2e assertions, all passing**, against the running API on port 3100 — fixtures through the
real endpoints, so permissions, branch scoping and validators all ran:

| Area | What it proved |
| --- | --- |
| Generation | prorated first invoice with install fee; second month full and without it; period, statement and due dates; the year-stamped sequential number |
| Idempotency | re-running the same period creates nothing and says `already_billed`; a different month bills again; re-running the whole cycle creates 0 and skips |
| PDF | renders, is served as `application/pdf`, starts with `%PDF-`, and is served from storage on the second request |
| Public link | readable with no login; leaks no customer, subscription, branch or address; an unknown token and a malformed one give the *same* 404 |
| Payment | short and over payments both refused with the amount named; unknown channel rejected; exact amount settles; paying twice refused; `amountPaid` and `paidAt` stamped |
| Voiding | a paid invoice cannot be voided; a reason is required; the row survives; voiding twice refused; a voided invoice cannot be paid or emailed |
| Adjustments | credits stored negative, debits positive, a negative input rejected; both land as lines on the next invoice; totals to ₱1,983.87; an applied one cannot be deleted; voiding the invoice releases them |
| Branch isolation | the Bagumbayan owner gets 404 — not 403 — on read, PDF, void, pay, adjust, resend, and sees nothing in a list |

**Email pipeline verified live** by draining the queue with the real worker: the invoice email
sent with its PDF attached, `email_events` recorded `sent`, and a job for a voided invoice
correctly reported *"invoice INV-2026-000002 is void — not sending invoice_issued"* rather than
chasing a cancelled bill.

### One thing that is not real yet

The public page shows the invoice, the amount, the due date and a PDF download — but **no "Pay
now" button**, because there is no gateway behind it until S8. It says so plainly and points at
the office and the company's email instead. A button that opened nothing would be worse than no
button.

---

## S8 — Payment gateway (port complete, adapter pending) 🟡

The client asked to evaluate Philippine gateways other than Xendit before
committing, so this stage built everything that does **not** depend on which one
they pick. The provider-specific half is one file whenever the answer arrives.

### What changed about the plan

The plan named this stage "Xendit". That was an assumption, and migration 007
had already baked it into four column names. Since the tables were empty, the
first thing S8 did was un-name the vendor — free now, a data migration against
live payment history later.

### Built

| # | Item | File |
| --- | --- | --- |
| 1 | The port contract, drawn against three providers | `back/server/src/lib/payment-gateways/gateway.interface.js` |
| 2 | Currency-unit conversion | `back/server/src/lib/payment-gateways/amounts.js` (+ 15 tests) |
| 3 | Mock gateway — a working gateway, not a stub | `back/server/src/lib/payment-gateways/mock.gateway.js` (+ 28 tests) |
| 4 | Resolver, registry and status | `back/server/src/lib/payment-gateways/index.js` |
| 5 | Adapter-writing guide | `back/server/src/lib/payment-gateways/README.md` |
| 6 | Checkout creation and attempt reuse | `back/server/src/lib/payments/payment.service.js` |
| 7 | Callback processing, replay guard, reconnection | `back/server/src/lib/payments/webhook.service.js` |
| 8 | Webhook endpoint, one per provider slug | `back/server/src/controllers/v1/public/webhooks.controller.js` |
| 9 | `POST /pay` and the mock simulator | `back/server/src/controllers/v1/public/pay.controller.js` |
| 10 | Raw-body capture for signature verification | `back/server/config/express.js` |
| 11 | Un-named columns, `payment_attempts`, `webhook_events` | `back/database/schema.sql`, migration `008` |
| 12 | Gateway status for the settings screen | `back/server/src/controllers/v1/admin/system.controller.js` |
| 13 | The Pay button, and the mock checkout | `front/src/pages/Public/components/PaymentSection.jsx` |

### The five things that differ between gateways

The contract was drawn against Xendit, PayMongo and Dragonpay together, because
a port shaped around one vendor inherits that vendor's model and stops fitting
the second. They disagree in every place a naive interface would assume
agreement:

| | Xendit | PayMongo | Dragonpay |
| --- | --- | --- | --- |
| Amount unit | whole pesos (`1200`) | centavos (`120000`) | decimal string (`"1200.00"`) |
| Callback body | JSON, snake_case | JSON, JSON:API nesting | **form-encoded** |
| Authentication | static header token | HMAC-SHA256 over `` `${t}.${rawBody}` `` | SHA1 digest of concatenated fields |
| Paid status | `PAID` / `SETTLED` | `link.payment.paid` | `S` |
| Our reference | `externalId` | `remarks` / metadata | `txnid` |

Three consequences the contract had to carry:

1. **Verification receives the raw bytes.** A signature is computed over exactly
   what was sent, and this app's `sanitizeMiddleware` rewrites `req.body` before
   any controller sees it. `express.js` now stashes the untouched buffer.
2. **Adapters normalise statuses** into `paid` / `failed` / `expired` /
   `pending` / `unknown`. Nothing outside an adapter ever compares a provider's
   string.
3. **Amount conversion happens at the boundary**, through `amounts.js`, never in
   billing code.

### Decisions worth knowing before touching this code

| Rule | Why |
| --- | --- |
| **Never write `* 100`.** | Xendit takes whole pesos, PayMongo takes centavos — a hundredfold error in opposite directions, and nothing downstream catches it. `settleInvoice()` requires an exact match, so an underpaid invoice stays unpaid and the customer stays disconnected *after paying*. `toWholePesos()` throws on a fraction rather than rounding, because rounding hides exactly that mistake. |
| **Idempotency lives in `payment_attempts`, not in the adapter.** | Xendit can be asked "did I already create this?"; PayMongo cannot; Dragonpay keys on a txnid we choose. Relying on the provider would put the guarantee at the mercy of whoever is collecting this month. An open attempt is reused, which works identically for all three. |
| **`verifyWebhook` fails closed.** | With no key configured it rejects everything. "We haven't set it up yet" is precisely when an endpoint that accepts unsigned callbacks becomes a reconnect-yourself-for-free button. |
| **Signatures compare in constant time.** | `===` returns as soon as two bytes differ — measurably faster for a wrong first byte, which is enough to recover a signature one byte at a time. Both sides are hashed first, which also guarantees the equal lengths `timingSafeEqual` demands, so a malformed header cannot crash the endpoint. |
| **Rejected callbacks are recorded before being rejected.** | A run of failures is either a misconfiguration or somebody probing, and neither is visible if rejected callbacks leave no trace. |
| **A duplicate event is not the same as a handled one.** | If an earlier attempt recorded an event then crashed, `processedAt` is still NULL and the retry must be allowed through — otherwise the row written for safety permanently blocks the retry that fixes it. |
| **The status code is a control signal, not a formality.** | 200 = stop sending, 401 = signature failed, stop sending, 500 = we failed, please resend. Answering 200 on an internal error loses the payment silently and nothing ever asks again. |
| **The gateway is called before the attempt row is written.** | A row claiming a checkout that was never opened would be reused forever, handing the customer a dead link every time. A gateway session with no row is merely wasted. Of the two ways to be inconsistent, only one is recoverable. |
| **Credentials come from the environment, not `system_settings`.** | A callback arrives before we know whose it is. Verifying it needs the secret, finding the company needs the invoice, finding the invoice needs the verified payload — circular. The usual escape, trying every tenant's key, is an oracle that tells an attacker when they have guessed a valid one. |
| **The invoice's cached payment-link columns were dropped.** | They were a copy of the newest attempt, and a copy is a second thing that can be wrong once a link expires or the gateway changes. One indexed read cannot disagree with itself. |
| **Two gateways can run at once.** | `payments.provider` records which one took each payment. Changing provider does not have to mean migrating — point new subscribers at the new gateway and let the old one drain. |

### The mock is a working gateway, not a stub

It keeps its money in memory, and otherwise behaves like an awkward real
provider: it speaks **centavos** (so a conversion bug fails on a laptop rather
than against a live card), signs its callbacks with HMAC-SHA256 over the raw
body (so the raw-body plumbing is exercised rather than assumed), fails closed
without a secret, and refuses to open a second session for a reference that
already has a live one.

Its simulator does not settle anything itself. It builds the callback a gateway
would send, signature and all, and the page POSTs that at the *real* webhook
endpoint — so a simulated payment travels through verification, the replay
guard, settlement and reconnection rather than around them. A shortcut that set
`status = 'paid'` directly would prove nothing.

The simulate endpoint returns 404 unless the mock is the active provider, so it
cannot exist in a deployment taking real money.

### Verified

**239 unit tests** across 12 files (43 new: 15 amount-conversion, 28 port).

**44 e2e assertions, all passing**, against the running API with the mock active:

| Area | What it proved |
| --- | --- |
| Payability | the server decides whether a Pay button exists, names the provider, and flags test mode |
| Checkout | opens; a second click reuses the same session rather than opening a second one; an unknown token cannot open one |
| Rejection | unsigned, wrongly signed and tampered callbacks all rejected 401; unknown provider 404; **none of them settled anything** |
| Payment | a properly signed callback settles the invoice, records the payment attributed to the provider with its payment id and the channel used, and the public page flips to paid and stops offering to pay |
| Replay | a repeated callback returns 200 and records **no second payment** |
| Ledger | the payment appears named by provider, with no staff member attached |

The audit tables were inspected afterwards: three `signature_failed` rows with
`signatureVerified = 0` and `processedAt` NULL, one verified event processed,
and exactly one `payment_attempts` row despite two Pay clicks.

### What is left for the real adapter

One file implementing five methods, one line in `index.js`, and its env keys.
`README.md` in that folder is the checklist — the comparison table above, the
rules, and the test cases to copy. Roughly a day once sandbox credentials exist.

The remaining Xendit-specific knowledge worth keeping from V2, now recorded in
`amounts.js`: `amount: 4999` with `currency: 'PHP'` renders as PHP 4,999.00 on a
live Xendit checkout — confirmed against a real sandbox invoice, and not
inferable from their docs, whose examples are all IDR.

---

## S9 — Dunning ✅

The join of billing, payments and provisioning, and the stage where a bug costs
the most: the failure mode is cutting off a customer who has paid.

### Built

| # | Item | File |
| --- | --- | --- |
| 1 | The sweep, the candidate query, the eligibility re-check, the at-risk view | `back/server/src/lib/dunning/dunning.service.js` (+ 25 tests) |
| 2 | The payment re-check wired into the worker's Gate 3 | `back/server/src/lib/jobs/processors/provisioning.processor.js` |
| 3 | `dunning_exemptions` + the `billing/dunning` permission | `back/database/schema.sql`, migration `009` |
| 4 | At-risk, sweep, exemption grant and revoke | `back/server/src/controllers/v1/admin/dunning.controller.js` |
| 5 | Validators, including the 365-day cap | `back/server/src/validators/dunning.validator.js` |
| 6 | The nightly 20:00 sweep | `back/server/src/lib/scheduler/scheduler.js` |
| 7 | The Dunning screen | `front/src/pages/Admin/Billing/Dunning/` |

### The safety design, which is the whole point of this stage

**The sweep does not disconnect anybody.** It reads invoices and writes job
tickets. The provisioning worker does the device work, re-checks the debt
immediately beforehand, honours DRY_RUN, and is the only thing that ever flips a
subscription to `suspended` — in the same transaction as the device's confirmed
reply.

That split is what makes the system safe to be wrong in. A sweep that
disconnected directly would have to be correct at the instant it runs. This one
only has to be right about who is *worth asking about*, and the worker asks
again.

**The candidate query is a list of reasons not to disconnect somebody.** Every
condition exists because of a specific failure:

| Condition | Prevents |
| --- | --- |
| `i.status IN ('issued','overdue')` | disconnecting somebody who has paid |
| `i.dueDate <= today - grace` | disconnecting on the due date itself |
| `s.status = 'active'` | re-disconnecting the already-suspended |
| `NOT EXISTS (live exemption)` | overriding a staff decision to wait |
| `s.onuId IS NOT NULL` | queuing device work with no device |

### The race, and the guard that was missing

Before this stage the worker's precondition check only asked whether the
subscription was still `active`. It never re-checked whether the customer had
**paid**. That left a real window open:

```
20:00:00  the sweep queues a disconnect
20:00:05  the worker claims it — status is now 'processing'
20:00:30  the customer pays; the webhook's cancel finds nothing to cancel,
          because cancellation can only touch jobs still 'queued'
20:01:00  the worker reaches the device
```

The payment path's cancel and this re-check cover **different moments**, and only
together do they cover the whole window. `isStillEligibleForDisconnect()` now
runs immediately before the device call, and deliberately re-uses the sweep's own
query rather than a copy of it — so there is exactly one definition of "deserves
disconnection" in the system, and the two can never drift.

It reads the grace period **fresh** rather than carrying it on the job, so staff
changing the setting between the sweep and the worker takes effect at once.

**`dunning` and `manual` disconnects are checked differently.** A dunning
disconnect is only justified while the debt stands. A staff member suspending a
line by hand has a reason the system does not know about — abuse, a move-out, a
customer request — so requiring an overdue invoice there would make the button
silently refuse to work.

### Decisions worth knowing

| Rule | Why |
| --- | --- |
| **Exemptions require both a reason and an end date, and neither is a formality.** | "Why is this account four months overdue and still connected?" is asked months later by somebody who was not in the room; a blank reason is indistinguishable from a mistake. And an exemption with no end is not an exemption — it is a silent permanent discount nobody revisits. |
| **365-day cap on an exemption.** | Not a business rule — a guard against a mistyped year becoming indefinite free service. A clerk aiming for 2026 and hitting 2062 should be stopped by the form, not found by an auditor. |
| **Exemptions are revoked, never deleted.** | "This customer was shielded for six weeks, by whom, and why" is exactly what an audit asks, and a deleted row cannot answer it. |
| **Revoking does not disconnect anybody.** | It removes the shield; the next sweep decides. The UI says so in those words, because a confirm dialog that reads like a kill switch gets clicked differently. |
| **One live exemption per subscription, enforced under `FOR UPDATE`.** | Two clerks granting one at the same moment would otherwise both pass a check before either inserted. |
| **The at-risk view is deliberately wider than the sweep.** | It includes people still inside their grace period, with the days remaining, because the point of the screen is to let staff act *before* a disconnection rather than explain one afterwards. A customer phoned on day two is worth more than one cut off on day three. |
| **An empty branch scope selects nothing, not everything.** | Reading `branchIds: []` as "no filter" would let a user with no branch assignments disconnect the entire estate. |
| **`cutoffDate` inverts the comparison.** | `today - grace` is computed once in Asia/Manila rather than `dueDate + grace` per row in SQL, keeping date arithmetic in the tested JavaScript helpers and off a database server whose session timezone may be eight hours out. |
| **Queuing a disconnect logs at warning level.** | It is not routine bookkeeping. A run that queues an unexpected number is the thing worth noticing in a log at eight in the evening. |
| **The sweep runs at 20:00.** | Late enough that the day's payments have landed, early enough that somebody is still awake when it goes wrong. |

### A parameter-binding bug caught before it shipped

The first draft of `findDisconnectCandidates` bound `now` and `cutoff` in the
opposite order to the placeholders. MySQL compares a DATE against a DATETIME
string without complaining, so this would not have thrown — it would have
returned a **plausible wrong answer about who to cut off**. Both queries now
build their parameters as a single list in placeholder order, and a test pins
the order explicitly.

### Verified

**264 unit tests** across 13 files (25 new), and **55 e2e assertions, all
passing**, driving the real API plus the worker in-process against the mock OLT.

Four customers, chosen so the interesting assertions are about people who must
**not** lose service:

| | Situation | Expected | Result |
| --- | --- | --- | --- |
| Deadbeat | 10 days overdue | disconnected | ✅ suspended, device confirmed |
| Recent | 1 day overdue | untouched, still in grace | ✅ never queued |
| Payer | 10 days overdue, pays after the job is queued | **not** disconnected | ✅ still active |
| Shielded | 10 days overdue, holds an exemption | **not** queued at all | ✅ excluded |

The payer's case is the one that matters, and it passes for the right reason:
the skip is recorded in that modem's device history as *"the account is no
longer overdue — it has been paid, or exempted"*, marked as a **successful**
outcome rather than a failure. Deciding not to disconnect somebody is a correct
result, and it needs to be something a person can point at.

Also proven: the sweep disconnects nobody by itself; re-running it queues
nothing new; one job per customer rather than one per unpaid invoice; a revoked
exemption makes the account eligible again on the next sweep; paying while
suspended queues a reconnection automatically and the modem comes back; and
another branch can neither see, exempt, nor revoke any of it.

---

## S10 — Discovery ✅

Asking an OLT what it can see, and putting that next to what we think we have.
Deliberately last of the ported work, so it could not block the money path.

### Built

| # | Item | File |
| --- | --- | --- |
| 1 | MAC normalisation and description parsing | `back/server/src/lib/discovery/reconcile.helpers.js` |
| 2 | The reconciliation engine — pure, no DB, no devices | `back/server/src/lib/discovery/reconcile.js` (+ 29 tests) |
| 3 | Sweep, stage, and the audited import path | `back/server/src/lib/discovery/discovery.service.js` |
| 4 | `discovery_runs`, `discovered_items`, the `network/discovery` permission | `back/database/schema.sql`, migration `010` |
| 5 | Sweep, runs, items and import endpoints | `back/server/src/controllers/v1/admin/discovery.controller.js` |
| 6 | Validators | `back/server/src/validators/discovery.validator.js` |
| 7 | The Discovery screen, sweep drawer and import form | `front/src/pages/Admin/Network/Discovery/` |

### Scope: the OLT half only

The reconciler accepts MikroTik accounts and sessions and nothing produces
them. There is no RouterOS client (blocker M22) and the router's address and
credentials are still open (P4). Sweeping only the OLT is the honest half; the
bucketing rules for the router side are written and tested so adding it later
does not mean rewriting the OLT path around it.

### Three buckets, and what each one asks of a person

| Bucket | Meaning | What happens |
| --- | --- | --- |
| `matched` | on the device and in our records | nothing — this is the healthy state |
| `new` | on the device, not in our records | a candidate to import, one at a time |
| `orphaned` | in our records, the device did not report it | **flagged, never deleted** |

**An orphan is only ever a flag.** The obvious next step from "this modem is
gone" is to delete the row, and it is wrong. An ONU drops off a sweep because
the fibre is cut, because it is unplugged while the family is away, because a
PON card is being swapped, or because the sweep read one port and not another.
Deleting on that evidence destroys a billable subscription's link to its
hardware over a temporary fault.

### Decisions worth knowing

| Rule | Why |
| --- | --- |
| **A sweep creates nothing.** | It reads the device, stages a comparison, and stops. A sweep of a four-hundred-modem OLT would otherwise create four hundred inventory records out of free text typed by whoever installed them, and unpicking that is worse than typing it. Importing is a separate, audited call with staff-confirmed values. |
| **Nothing is flagged orphaned when the OLT was not swept.** | A run that read no ONUs must not conclude that every modem in the database has vanished. `oltOnus.length > 0` guards the whole orphan pass, and a test pins it. |
| **Every MAC is normalised before comparison.** | An OLT reports lowercase, a MikroTik uppercase, Cisco-style kit uses dots. Reading two spellings of one address as two modems is how a customer ends up with duplicate hardware on file. |
| **`provisioningState` is derived, not submitted.** | A modem the OLT reported online is `active`; anything else is `unprovisioned`. The import form cannot assert it — letting it would let somebody record a device as carrying service when nothing confirmed that, and the dunning sweep reads this column to decide who is already disconnected. |
| **The parsed description is a suggestion, shown next to the original.** | "Jacqueline-Rebancos PON 2 NAP 1 PORT 5" is often the only record of who a modem belongs to, and it is also years old and inconsistent. The parse pre-fills the form; the raw text sits above it so a bad reading is visible rather than silently saved. |
| **`failed` is a distinct run status.** | A sweep that could not reach the device and one that reached it and found nothing produce the same empty list and mean opposite things. A failed run says so on the screen, and says that it is not evidence any modem is missing. |
| **The run keeps the command and the device's verbatim reply.** | Same reason as the provisioning action log: a sweep that returned nothing is a mystery without it. |
| **Runs are kept, not overwritten.** | "The modem was there in August and gone in September" is a question about two runs — and it is the question asked when a customer says their connection vanished. |
| **A staged item is stamped `matched` on import, not deleted.** | It is the record of where that ONU came from, and re-running the sweep should now legitimately find it as matched. |
| **The existing-ONU query is branch-scoped.** | A sweep of the Bicutan OLT must not report Bagumbayan's modems as orphaned merely because this device cannot see them. |

### Verified

**293 unit tests** across 14 files (29 new, all on the pure reconciler — the
part that decides whether two records are the same modem).

**52 e2e assertions, all passing**, against the running API and a mock OLT:

| Area | What it proved |
| --- | --- |
| First sweep | finds the device's modems, all `new`, none matched, none orphaned; keeps the command, the raw reply, the duration and who ran it |
| Staging | descriptions parsed into name/NAP/port hints with the original text kept beside them; **and the sweep created zero inventory rows** |
| Import | uses the discovered values, derives `provisioningState` from the device, keeps the original description, refuses a second import of the same item, stamps the staged row `matched` pointing at the new ONU |
| Second sweep | the imported modem is now `matched` and the rest still `new` — the import is what moved it |
| Orphans | a modem on file the OLT cannot see is flagged, named, **not deleted**, and cannot be imported |
| Refusals | unknown OLT 404, missing `oltId` 400, unknown run 404 |
| Branch isolation | another branch cannot sweep the OLT, read the run, see its items, import from it, or find it in a list |

---

## ⚠️ Needs attention

| # | Item | Detail |
| --- | --- | --- |
| ~~A1~~ | ~~The migration has not been applied to any database~~ | ✅ **Resolved 2026-09-07.** The owner supplied `back/.env`; `schema.sql`, `001` and `002` all applied cleanly to MySQL 8.0.45, and re-running is a verified no-op. See "Database verification" below. |
| **A2** | **The company, branches and roles still need creating** | Admin / Billing / Technician are created through the SuperAdmin portal at runtime, not by `setup-database.js` (which seeds only permissions + the superadmin account). The three D1 roles have to be created per branch before users can be assigned to them. Their **permission rows** arrive with each ISP module in S2–S10, per the `new-module` contract. |
| **A3** | **`users.branchId` is now a home-branch pointer, not an access boundary** | Any future query that scopes on `users.branchId` directly instead of going through `branchScope()` will silently under- or over-report. The helper is the only correct entry point. |
| **A4** | **`sharp` carries a high-severity advisory** | `sharp <0.35.0` inherits four libvips CVEs. The fix is a **breaking** major bump on a dependency the template already uses for image compression, so it is not something to change mid-migration. Belongs to the Phase 6 security pass (M14). |

---

## Pending decisions carried forward

| # | Decision | Needed by |
| --- | --- | --- |
| ~~P1~~ | ~~Whether `plans` are company-wide or per-branch~~ | ✅ resolved in S2 — [D3](00-decisions.md#d3--service-plans-are-company-wide-not-branch-scoped) |
| P2 | Which ISP tables store `branchId` vs inherit it through a parent | Partly resolved: `customers` stores it, `plans` has none. Network inventory decided in S3. |
| P3 | 60-day blacklist/revocation — six open client questions | Phase 7 (parked) |
| P4 | MikroTik router IP, RouterOS version, API port, read-only credentials | Phase 7 (parked) |
| **P5** | **Which payment gateway.** Xendit was the first choice; the client wants to evaluate others available in PH. The S8 port makes this a one-file change, and two gateways can run at once — so the practical constraint is not the code but **saved payment methods**: autodebit mandates and card tokens do not transfer between providers, so switching gets expensive only once subscribers start enrolling. Recommendation: pick a primary and start collecting, but hold off pushing autodebit enrolment until they are confident. | before go-live |
