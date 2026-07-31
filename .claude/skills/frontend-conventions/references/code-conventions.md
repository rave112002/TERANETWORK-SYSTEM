# Code Conventions

General coding standards for this project. Follow these everywhere.

---

## Language & Framework

- React 19 with hooks (functional components only — no classes)
- JavaScript (`.jsx` / `.js`) — no TypeScript
- ES modules (`import`/`export`) — never CommonJS
- Vite as bundler

---

## File & Folder Naming

| Item                | Convention                                                | Example                         |
| ------------------- | --------------------------------------------------------- | ------------------------------- |
| Page/component file | PascalCase                                                | `UserForm.jsx`, `Dashboard.jsx` |
| Hook file           | camelCase                                                 | `hooks.jsx`, `useDebounce.js`   |
| Utility file        | camelCase                                                 | `filterNavigation.js`           |
| API service file    | camelCase                                                 | `user.js`, `roles.js`           |
| Store file          | camelCase                                                 | `authStore.js`                  |
| Folder              | PascalCase (pages/components), camelCase (utils/services) | `UserManagement/`, `services/`  |
| CSS/config file     | camelCase                                                 | `index.css`, `eslint.config.js` |

---

## Import Order

Group imports in this order, separated by blank lines:

```jsx
// 1. React & core libraries
import { useState, useCallback, useMemo, useEffect } from "react";

// 2. Third-party libraries (lucide, tanstack, dayjs, etc.)
import { Users, Search, MoreVertical } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import dayjs from "dayjs";

// 3. shadcn/ui primitives (always via the @/ alias)
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// 4. Internal — components, hooks, utils, services (relative paths)
import StatCard from "../../../../components/StatCard";
import { usePermissions } from "../../../../hooks/usePermissions";
import { useGetUsers } from "../../../../services/requests/admin/user";
```

---

## Import Paths

- A `@/` alias → `src/` is configured (in `vite.config.js` and `jsconfig.json`). It was
  added for shadcn/ui, whose generated components import via `@/components/ui/…` and
  `@/lib/utils`.
- **Use `@/` for shadcn/ui imports** (`@/components/ui/*`, `@/lib/utils`) — never rewrite
  those to relative paths, or `npx shadcn add` will fight you.
- **App code may use either**, but prefer `@/` for cross-tree imports and relative paths
  for near neighbours (`./`, `../`). Keep paths short.

```jsx
// ✅ shadcn/ui — always the alias
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ✅ app code — alias or relative both fine
import StatCard from "@/components/StatCard";
import StatCard from "../../../components/StatCard";
```

---

## Library Choices (non-negotiable)

| Purpose        | Use                     | Never use                      |
| -------------- | ----------------------- | ------------------------------ |
| Dates          | `dayjs`                 | `moment`, `date-fns`           |
| Icons          | `lucide-react`          | other icon packs               |
| State (global) | `zustand`               | Redux, Context for state       |
| Server state   | `@tanstack/react-query` | SWR, manual fetching           |
| HTTP           | `axios`                 | fetch (except in tests)        |
| UI components  | `shadcn/ui` (`@/components/ui/*`) | Material UI, Chakra, other kits |
| Forms          | `react-hook-form` + `zod` (`zodResolver`) | Formik, manual state |
| Toasts         | `sonner` (`toast.*`)    | `alert()`, custom toasts       |
| Confirm dialogs | `confirm()` (`src/store/confirmStore`) | `window.confirm`, ad-hoc modals |
| Tables         | `@tanstack/react-table` via the shared `DataTable` | raw `<table>`, other grids |
| Styling        | Tailwind CSS v4         | Styled-components, CSS modules |
| Routing        | `react-router` v7       | Reach Router, Next.js          |
| Charts         | `recharts`              | Chart.js, D3 directly          |

### shadcn/ui only

Every UI primitive is shadcn/ui from `@/components/ui/*`, with lucide-react icons everywhere —
don't pull in another component or icon library. If a shadcn component you need isn't in
`src/components/ui/` yet, add it with `npx shadcn@latest add <name>` (run from `front/`).

---

## Component Patterns

### Export style

- **Pages:** `export default` (required for React.lazy)
- **Hooks:** Named export (`export const useXHooks = () => {}`)
- **Shared components:** `export default`
- **API functions:** Named exports (`export const getItemsApi = async () => {}`)

### Component declaration

```jsx
// ✅ Arrow function + default export
const Dashboard = () => {
  return <div>...</div>;
};

export default Dashboard;
```

Never use `function` keyword for components. Never use `React.FC` or `React.memo` unless you have a proven perf issue.

---

## Tailwind CSS v4

This project uses Tailwind v4. Key syntax differences from v3:

| v3 (wrong)          | v4 (correct)      |
| ------------------- | ----------------- |
| `bg-gradient-to-r`  | `bg-linear-to-r`  |
| `bg-gradient-to-br` | `bg-linear-to-br` |

All CSS variables/tokens live in `src/index.css` under `@theme`. Reference them via:

- Inline styles: `style={{ color: "var(--color-text-secondary)" }}` — the usual form
- Tailwind classes generated from `@theme`: `font-mono`, `bg-surface`

**Never hardcode a hex** on a themed surface, and never use `bg-white` / `bg-gray-*` /
`text-slate-*` (they don't flip in dark mode). See [ui-design-system.md](./ui-design-system.md)
for the token cheat-sheet.

---

## State Management Rules

1. **Global auth state** → Zustand stores (`src/store/authStore.js`)
2. **Server state** → React Query (via `src/services/requests/`)
3. **Page-level UI state** → In the page's `hooks.jsx` (useState)
4. **Form state** → `react-hook-form` (`useForm({ resolver: zodResolver(schema) })`)
5. **Cross-component UI state** → React Context (sparingly — only for things like socket)

Never put server data in Zustand. Never use React Query for auth tokens.

---

## Error Handling

- **API errors:** Let React Query handle via `onError` in mutations. Show
  `toast.error(...)` (`import { toast } from "sonner"`).
- **Page-level errors:** Return early with a shadcn `<Alert variant="destructive">` (icon +
  `<AlertTitle>` + `<AlertDescription>`) — see UI Design System.
- **Form validation:** Use a `zod` schema via `zodResolver` — never manual validation. Field
  errors render through shadcn `<FormMessage />`.
- **Unhandled errors:** Caught by `<ErrorBoundary>` at the app root.
- **No try/catch in API files** — errors propagate to React Query naturally.

---

## Date Formatting

```jsx
import dayjs from "dayjs";

// Format for display
dayjs(date).format("MMM D, YYYY"); // "Jan 5, 2025"
dayjs(date).format("YYYY-MM-DD"); // "2025-01-05" (for API)
dayjs(date).format("MMM D, YYYY h:mm A"); // "Jan 5, 2025 2:30 PM"

// Relative time (if plugin is added)
dayjs(date).fromNow(); // "3 hours ago"
```

---

## Null/Empty Handling

```jsx
// ✅ Use optional chaining + fallback
{
  record.phone || "-";
}
{
  data?.items?.length;
}
{
  userData?.email;
}

// ✅ Nullish coalescing for defaults
const total = data?.pagination?.total ?? 0;

// ❌ Don't use && for rendering numbers (0 renders as "0" text)
{
  count && <span>{count}</span>;
} // Bad — 0 won't render

// ✅ Explicit check
{
  count > 0 && <span>{count}</span>;
}
```

---

## Console Usage

- `console.error` — for caught errors in handlers (keep for debugging)
- `console.warn` — only in the axios interceptors (`services/api/axios.js`) for
  missing-token/CSRF diagnostics; nowhere else
- Never leave `console.log` for debugging in committed code
- For production warnings, use Sentry

---

## ESLint Rules (enforced)

- `no-unused-vars` — error (but PascalCase and UPPER_CASE vars are ignored)
- `react-hooks/rules-of-hooks` — error
- `react-hooks/exhaustive-deps` — warn
- `react-refresh/only-export-components` — warn

---

## Misc Conventions

- **No barrel exports** (`index.js` re-exports). Import directly from the file.
- **No prop spreading for forms** — always explicit field mapping.
- **One component per file.** Tiny internal helpers (like a styled wrapper) are okay.
- **No inline styles for colors** — use CSS variables. Exception: the drawer header accent-chip gradient (`--gradient-primary`).
- **Debounce search inputs** — always 500ms via `useDebounce` hook.
- **Prefer `useCallback`** for handlers passed to memoized children or used in dependency arrays.
- **Prefer `useMemo`** for expensive computations, column definitions, and stat card arrays.
