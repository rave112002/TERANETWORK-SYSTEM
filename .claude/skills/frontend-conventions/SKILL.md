---
name: frontend-conventions
description: The non-negotiable conventions for this repo's React 19 + Vite client (front/) — code style and library choices, folder structure and route registration, the table-page hooks.jsx contract, the api/ + requests/ service layers and React Query keys, Zustand auth stores and permission gating, the "Modern" design system tokens, and the Sheet form-drawer pattern. Load BEFORE writing or editing anything under front/src — any page, hook, component, form, service, store, or route. Also load when reviewing frontend code, answering how the client is structured, or deciding where a new file goes.
---

# Frontend conventions (`front/`)

> **SuperAdmin is no longer part of the branch app** ([D10](../../../docs/decisions.md#d10--one-central-superadmin-over-tailscale)).
> The branch app has one portal: **Admin**. The central SuperAdmin is a separate app: `front` built with
> `--mode superadmin` (pages in `src/pages/SuperAdminConsole/`, routes in `src/routes/superadmin.jsx`) plus
> `superadmin-server/`. It reaches a branch only through the key-protected `/api/v1/manage/*`
> (`server/src/controllers/v1/manage/`, contract in `shared/manage-contract/`). Anything in these docs about
> `/api/v1/superadmin/*`, `SuperAdminRoute.jsx`, `pages/SuperAdmin/` or `useSuperAdminAuthStore` describes
> the removed template portal: **do not build on it.**

React 19 (hooks only) · JavaScript, no TypeScript · Vite · **shadcn/ui** (`@/components/ui/*`) ·
Tailwind v4 · Zustand · TanStack React Query · react-hook-form + zod · sonner · TanStack Table via
the shared `DataTable` · axios · react-router v7 · lucide-react · dayjs.

These rules are **non-negotiable** unless the user says otherwise. Reference implementation:
`front/src/pages/Admin/UserManagement/Roles/` — copy its shape.

## Read the doc for the area you're touching

Read it **before** writing code, not after. Read more than one when the work spans areas
(a new module page touches folder-structure + hooks-pattern + api-guide + modern-module-pattern +
ui-form-design).

| Doc | Read it when |
| --- | --- |
| [code-conventions.md](references/code-conventions.md) | **Always read first.** Naming, import order, the `@/` alias, mandated libraries, error handling, dates, null handling, ESLint rules. |
| [folder-structure.md](references/folder-structure.md) | Creating any page/module/component, or deciding where a file goes. Includes the **route-registration** steps — a page not registered in `routes/pageRoutes/*Route.jsx` is unreachable. |
| [hooks-pattern.md](references/hooks-pattern.md) | Writing or editing a table/list page's `hooks.jsx` — the full state/columns/actions/return contract. |
| [api-guide.md](references/api-guide.md) | Touching `services/api/` or `services/requests/`. Has the backend envelope shape and the two-`.data`-hop unwrap rule, query keys, invalidation. |
| [auth-state.md](references/auth-state.md) | Auth stores, login/logout, `usePermissions`, `<ProtectedRoute>`, adding a permission. |
| [ui-design-system.md](references/ui-design-system.md) | Any page markup — the "Modern" tokens, dark mode, list-page skeleton, table columns, shared components. |
| [modern-module-pattern.md](references/modern-module-pattern.md) | The canonical copy-paste spec for a module's list page + drawer. Read with `ui-design-system.md`. |
| [ui-form-design.md](references/ui-form-design.md) | Any create/edit form — the Sheet + react-hook-form + zod pattern. |

## Rules that are violated most often

Load the relevant doc for the detail; these are the ones worth knowing cold.

- **shadcn/ui + lucide-react only.** Import primitives from `@/components/ui/*`. Never rewrite a
  shadcn import to a relative path — `npx shadcn add` will fight you. No second component or icon
  library.
- **Never hardcode a hex.** Every colour is a token in `src/index.css`. No `bg-white`,
  `bg-gray-*`, `text-slate-*` — they don't flip in dark mode.
- **The primary button is inverted monochrome** — the default `<Button>` variant. Never an inline
  `background`, never the green accent, never a gradient. The accent is for bars, ticks, focus
  rings and chips only.
- **Structure comes from hairline borders, not shadows.** `shadow-*` belongs only on genuinely
  floating layers (dropdown, dialog, sheet), which the shadcn primitives already handle.
- **Two `.data` hops.** `apiData?.data?.users` — one for axios, one for the backend envelope.
  `apiData?.data` alone is the wrapper `{ users, pagination }`, not the array.
- **The page is presentational.** All state, columns and handlers live in `hooks.jsx`;
  `index.jsx` has no `useState` except the filter-panel toggle and imports no React Query hook
  directly.
- **The form file owns its `<Sheet>`.** Props are exactly `{ open, onClose, onSuccess, entity? }`.
  The parent just holds `open` state.
- **Required-ness matches the backend.** A `NULL` column is not `.min(1)` in the zod schema —
  validate shape-not-presence with `.refine((v) => v === "" || …)`. Check `schema.sql`.
- **React Query v5** — mutations expose `isPending`, not `isLoading`;
  `invalidateQueries({ queryKey })` object syntax; `placeholderData: keepPreviousData`.
- **Phone is always `09XX XXXX XXX`** — `zPhone`, `formatPhoneOnChange`, `PHONE_PLACEHOLDER`,
  `formatPhoneDisplay` from `src/utils/phoneFormat.js`. The hint is the concrete example
  `0912 3456 789`, never the `09XX…` mask.
- **Tailwind v4 syntax** — `bg-linear-to-r`, not `bg-gradient-to-r`.
- **No barrel exports.** Import directly from the file.

## Related

- Building a whole new CRUD module? Use the **`new-module`** skill — it drives this one plus the
  backend half in the right order.
- Backend conventions live in the **`backend-conventions`** skill.
- Cross-cutting facts (response envelope, business IDs, soft deletes, phone format) are in the
  repo-root `CLAUDE.md`.
