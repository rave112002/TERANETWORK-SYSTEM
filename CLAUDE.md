#Full-Stack Multi-Tenant Template

A multi-tenant admin platform with two portals: **SuperAdmin** (manages brands/organizations across
the whole platform) and **Admin** (manages users, roles, and resources scoped to a single brand +
branch). Tenancy is enforced by scoping every Admin query to the authenticated user's `brandId` /
`branchId`; SuperAdmin operates across all brands.

## Repository layout

| Path     | What it is                                                             | Conventions live in                                |
| -------- | ---------------------------------------------------------------------- | -------------------------------------------------- |
| `front/` | React 19 + Vite client (Ant Design, Tailwind v4, Zustand, React Query) | [front/CLAUDE.md](front/CLAUDE.md) → `front/docs/` |
| `back/`  | Node + Express API (MySQL via `mysql2`, Passport JWT, Zod)             | [back/CLAUDE.md](back/CLAUDE.md) → `back/docs/`    |

When working inside `front/` or `back/`, the directory's own `CLAUDE.md` and its imported `docs/`
apply — read them before writing code. They are the source of truth for the project's patterns
(naming, folder structure, API/DB access, auth, permissions, UI). Treat the rules in those docs as
**non-negotiable** unless the user says otherwise.

## Cross-cutting facts

- **Backend response envelope:** every endpoint replies via `res.sendSuccess()` →
  `{ success, message, data: { ... } }`. The frontend unwraps `apiData?.data?.<entity>`.
- **Permissions are shared front-to-back:** a page's `<ProtectedRoute module/submodule>` uses the
  same permission the backend's `checkPermission()` enforces for that route group.
- **Soft deletes everywhere:** rows are never physically deleted — set `status = 'Deleted'` and
  filter with `status != 'Deleted'`.
- **Business IDs, not numeric IDs:** APIs, URLs, and FKs use the `varchar` business ID
  (`accountId`, `brandId`, `roleId`, …), never the internal auto-increment `id`.
