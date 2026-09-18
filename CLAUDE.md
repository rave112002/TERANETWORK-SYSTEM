# TERANETWORK System

Billing and network administration for TERANETWORK, an internet provider, built on an internal
multi-tenant template. **Each branch runs its own copy** (the Admin portal + API + MySQL); **one
central SuperAdmin** on the developer's PC manages every branch through a key-protected management
API. Every Admin query is scoped to the authenticated user's `companyId` / `branchId`.

## Repository layout

| Path              | What it is                                                            | Conventions live in                                                          |
| ----------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `front/`          | React 19 + Vite client (shadcn/ui, Tailwind v4, Zustand, React Query) | [front/CLAUDE.md](front/CLAUDE.md) → `frontend-conventions` skill             |
| `back/`           | Node + Express API (MySQL via `mysql2`, Passport JWT, Zod)            | [back/CLAUDE.md](back/CLAUDE.md) → `backend-conventions` skill                |
| `docs/`           | Repo-level Markdown not tied to `front/` or `back/`                   | [docs/README.md](docs/README.md)                                             |
| `.claude/skills/` | Claude Code skills checked into the repo                              | [.claude/skills/](.claude/skills/)                                           |

### Skills

The convention docs are packaged as skills so they load on demand instead of costing ~22k tokens
in every session. **Load the relevant skill before writing code** — the rules in it are
**non-negotiable** unless the user says otherwise.

| Skill | Use it for |
| ----- | ---------- |
| [`frontend-conventions`](.claude/skills/frontend-conventions/SKILL.md) | Anything under `front/src` — pages, hooks, components, forms, services, stores, routes. 8 topic docs. |
| [`backend-conventions`](.claude/skills/backend-conventions/SKILL.md) | Anything under `back/server` or `back/database` — controllers, routes, validators, migrations, uploads. 6 topic docs. |
| [`new-module`](.claude/skills/new-module/SKILL.md) | A whole new CRUD module end to end: table + migration, permission row, validator, controller, routes, services, list page, form drawer, sidebar registration. Drives the other two in the right order. |

## Where new Markdown goes

- **Cross-cutting `.md` — plans, checklists, RFCs, notes, decisions** that aren't specific to the
  client or the API → put it in **[`docs/`](docs/)**, not at the repo root and not inside
  `front/` / `back/`. See [docs/README.md](docs/README.md) for what belongs there and the naming
  convention.
- **Coding conventions** for a side live in that side's skill:
  `.claude/skills/frontend-conventions/references/` and
  `.claude/skills/backend-conventions/references/`. One topic per file, `kebab-case.md`; add the
  new file to the skill's routing table so it gets read.
- The repo root keeps only its map files (`README.md`, `CLAUDE.md`).

## Cross-cutting facts

- **Production is ONE BRANCH PER INSTALLATION.** Each TERANETWORK branch runs its own locally
  deployed server + MySQL database; there is no central business server and no cross-branch
  dashboard or report (the central SuperAdmin below manages branches but holds no business
  data). A production database holds one company row and
  one branch row, so `companyId`/`branchId` scoping from `req.user` is sufficient. Existing
  multi-branch code (`branchScope()`, `user_branches`) is kept because it is harmless — **do not
  extend it or build multi-branch features.** See decision D7 in
  [docs/decisions.md](docs/decisions.md).
- **SuperAdmin is ONE central app on the developer's PC** (D10), not part of a branch: `front`
  built with `npm run build:superadmin` + `superadmin-server/` (Express + built-in SQLite). It
  reaches each branch only through that branch's key-protected `/api/v1/manage/*` over
  Tailscale — never its database — and shows health and management, not business numbers. The
  management API's version and shapes live in `shared/manage-contract/`; change both sides in
  the same commit. The old in-branch `/superadmin` portal and `/api/v1/superadmin/*` were
  **removed** (2026-09-18); don't reintroduce them. `db:setup` creates no login: a branch's first
  Owner login is made from the central SuperAdmin (Users).
- **Payments: TERANETWORK's personal GCash account.** Customers send money to it and send proof
  to the Facebook page; staff record each payment with its reference number; the downloaded
  GCash transaction-history PDF is uploaded to **Billing → GCash Check** to catch typos, fakes and
  unrecorded payments. The PDF and its password are **never stored**. **HitPay and GCash for
  Business are both parked, not removed** — don't build on either, and don't add a public
  payment endpoint. See D9 in [docs/decisions.md](docs/decisions.md) and
  [docs/payments.md](docs/payments.md).
- **Where the project stands:** [docs/STATUS.md](docs/STATUS.md) — one page, kept current.

- **Backend response envelope:** every endpoint replies via `res.sendSuccess()` →
  `{ success, message, data: { ... } }`. The frontend unwraps `apiData?.data?.<entity>`.
- **Permissions are shared front-to-back:** a page's `<ProtectedRoute module/submodule>` uses the
  same permission the backend's `checkPermission()` enforces for that route group.
- **Soft deletes everywhere:** rows are never physically deleted — set `status = 'Deleted'` and
  filter with `status != 'Deleted'`.
- **Business IDs, not numeric IDs:** APIs, URLs, and FKs use the `varchar` business ID
  (`accountId`, `companyId`, `roleId`, …), never the internal auto-increment `id`.
- **Phone number format:** every phone is stored and sent as **`09XX XXXX XXX`** — a
  Philippine mobile number, 11 digits grouped **4-4-3** with single spaces (e.g.
  `0912 3456 789`). In the UI the placeholder/hint is the concrete example
  **`0912 3456 789`**, never the `09XX…` mask.
  - **Frontend:** use the shared helpers in `front/src/utils/phoneFormat.js` —
    `PHONE_PLACEHOLDER` for the placeholder, `zPhone` in the form's zod schema, and
    `formatPhoneOnChange` on the field's `onChange` so the spaces are typed in for the user
    (`onChange={(e) => field.onChange(formatPhoneOnChange(e.target.value))}`). Render stored
    values with `formatPhoneDisplay()`.
  - **Backend:** use `phone: optionalPhone()` from `server/src/validators/_helpers.js`. It
    accepts the grouped form, bare `09XXXXXXXXX`, and `+63`/`63`/`9…` variants, then
    **normalises to `09XX XXXX XXX` before it reaches the controller** — so the DB only ever
    holds the canonical form. Phone columns are `VARCHAR(20) NULL`; phone is optional
    everywhere, so `""`/`null`/omitted all mean "no number".
