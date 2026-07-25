# Frontend — (React 19 + Vite)

Conventions for the admin/superadmin frontend. These are **non-negotiable** patterns — follow
them when creating or editing any page, hook, component, API service, or form. Each section below
is imported from `docs/`; read the relevant one before writing code in that area.

## Stack

React 19 (function components, hooks only) · JavaScript (no TypeScript) · Vite ·
**shadcn/ui** (Radix primitives + Tailwind, in `src/components/ui/`) · Tailwind CSS v4 · Zustand ·
TanStack React Query · **react-hook-form + zod** (forms) · **sonner** (toasts) ·
**@tanstack/react-table** (tables, via the shared `DataTable`) · axios · react-router v7 ·
lucide-react · dayjs. Type is **Onest** (UI) + **JetBrains Mono** (micro-data only), self-hosted
via `@fontsource-variable`.

> All UI primitives are **shadcn/ui** — import them from `@/components/ui/*` (the `@/` alias →
> `src/`) and use lucide-react for icons. Don't introduce another component or icon library.

## Design system — "Modern"

Monochrome surfaces + hairline borders + **one green accent used sparingly**. Structure comes from
borders, **not shadows**; the primary button is **inverted monochrome** (never the accent, never a
gradient) — that's the shadcn `<Button>` default variant, which the token bridge maps to the
inverted colours. Every color is a token in `src/index.css` — **never hardcode a hex**.

shadcn's semantic tokens (`--background`, `--card`, `--primary`, `--border`, `--ring`, …) are
bridged onto the Modern tokens in `src/index.css` (the `@theme inline` block), so shadcn
components inherit this design in light and dark with no per-component theming.

- **`docs/modern-module-pattern.md`** — the canonical, copy-paste spec for a module's
  list page + create/edit drawer. Read it before building either.
- **`src/pages/Admin/UserManagement/Roles/`** — the reference implementation. Copy its shape.
- Shared building blocks: `components/PageHeader.jsx`, `StatCard.jsx`, `DataTable.jsx`,
  `SearchInput.jsx`, `RowActions.jsx`, `PaginationFooter.jsx`, `SectionLabel.jsx`,
  `StatusToggle.jsx`, `PasswordInput.jsx`, `DescriptionList.jsx`, `Spinner.jsx`, `ResultState.jsx`.

## Convention docs

- **Code conventions** — naming, import order/style, library choices, error handling, ESLint rules. Read first.
  @docs/code-conventions.md
- **Folder structure** — where pages/modules/components/services live, and how to register a new route.
  @docs/folder-structure.md
- **Table page hooks pattern** — the `hooks.jsx` contract every list page follows (state, columns, actions, return shape).
  @docs/hooks-pattern.md
- **API service guide** — `api/` + `requests/` layers, backend response shape, React Query keys & invalidation.
  @docs/api-guide.md
- **Auth & state** — Zustand auth stores, login/logout flow, `usePermissions`, `<ProtectedRoute>`.
  @docs/auth-state.md
- **UI design system** — the Modern system: tokens, dark mode, inverted primary, flat cards, the list-page skeleton, table columns, pagination footer.
  @docs/ui-design-system.md
- **UI form design** — the Modern Sheet Form pattern (react-hook-form + zod; the form owns its `<Sheet>`; props are `{ open, onClose, onSuccess, entity? }`).
  @docs/ui-form-design.md
