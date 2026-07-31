# Full-Stack Multi-Tenant Template

A multi-tenant admin platform with two portals: **SuperAdmin** (manages companies across the whole
platform) and **Admin** (manages users, roles, and resources scoped to a single company + branch).
Tenancy is enforced by scoping every Admin query to the authenticated user's `companyId` /
`branchId`; SuperAdmin operates across all companies.

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
