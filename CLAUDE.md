# Full-Stack Multi-Tenant Template

A multi-tenant admin platform with two portals: **SuperAdmin** (manages companies across the whole
platform) and **Admin** (manages users, roles, and resources scoped to a single company + branch).
Tenancy is enforced by scoping every Admin query to the authenticated user's `companyId` /
`branchId`; SuperAdmin operates across all companies.

## Repository layout

| Path     | What it is                                                             | Conventions live in                                |
| -------- | ---------------------------------------------------------------------- | -------------------------------------------------- |
| `front/` | React 19 + Vite client (shadcn/ui, Tailwind v4, Zustand, React Query) | [front/CLAUDE.md](front/CLAUDE.md) → `front/docs/` |
| `back/`  | Node + Express API (MySQL via `mysql2`, Passport JWT, Zod)             | [back/CLAUDE.md](back/CLAUDE.md) → `back/docs/`    |
| `docs/`  | Repo-level Markdown not tied to `front/` or `back/`                    | [docs/README.md](docs/README.md)                   |

When working inside `front/` or `back/`, the directory's own `CLAUDE.md` and its imported `docs/`
apply — read them before writing code. They are the source of truth for the project's patterns
(naming, folder structure, API/DB access, auth, permissions, UI). Treat the rules in those docs as
**non-negotiable** unless the user says otherwise.

## Where new Markdown goes

- **Cross-cutting `.md` — plans, checklists, RFCs, notes, decisions** that aren't specific to the
  client or the API → put it in **[`docs/`](docs/)**, not at the repo root and not inside
  `front/` / `back/`. See [docs/README.md](docs/README.md) for what belongs there and the naming
  convention.
- **Coding conventions** for a side stay next to that side's code: `front/docs/` and `back/docs/`.
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
