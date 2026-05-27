# Frontend — (React 19 + Vite)

Conventions for the admin/superadmin frontend. These are **non-negotiable** patterns — follow
them when creating or editing any page, hook, component, API service, or form. Each section below
is imported from `docs/`; read the relevant one before writing code in that area.

## Stack

React 19 (function components, hooks only) · JavaScript (no TypeScript) · Vite · Ant Design v5 ·
Tailwind CSS v4 · Zustand · TanStack React Query · axios · react-router v7 · lucide-react · dayjs.

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
- **UI design system** — theme tokens, dark mode, page skeleton, table/drawer/card patterns, styling rules.
  @docs/ui-design-system.md
- **UI form design** — the Gradient Drawer Form pattern (the form owns its `<Drawer>`; props are `{ open, onClose, onSuccess, entity? }`).
  @docs/ui-form-design.md
