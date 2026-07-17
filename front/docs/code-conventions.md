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

// 2. Third-party libraries (antd, lucide, tanstack, dayjs, etc.)
import { Button, Table, Input, Select } from "antd";
import { Users, Search, MoreVertical } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";

// 3. Internal — components, hooks, utils, services (relative paths)
import StatCard from "../../../../components/StatCard";
import { usePermissions } from "../../../../hooks/usePermissions";
import { useGetUsers } from "../../../../services/requests/admin/user";
```

---

## Import Paths

- **Always use relative paths.** No `@/` alias is configured in this project.
- Keep paths as short as possible by referencing from the current file's location.

```jsx
// ✅ Correct
import StatCard from "../../../components/StatCard";

// ❌ Wrong — no alias configured
import StatCard from "@/components/StatCard";
```

---

## Library Choices (non-negotiable)

| Purpose        | Use                     | Never use                      |
| -------------- | ----------------------- | ------------------------------ |
| Dates          | `dayjs`                 | `moment`, `date-fns`           |
| Icons          | `lucide-react`          | Ant icons in page UI           |
| State (global) | `zustand`               | Redux, Context for state       |
| Server state   | `@tanstack/react-query` | SWR, manual fetching           |
| HTTP           | `axios`                 | fetch (except in tests)        |
| UI components  | `antd` v5               | Material UI, Chakra            |
| Styling        | Tailwind CSS v4         | Styled-components, CSS modules |
| Routing        | `react-router` v7       | Reach Router, Next.js          |
| Animation      | `framer-motion`         | react-spring                   |
| Charts         | `recharts`              | Chart.js, D3 directly          |

### Ant Design Icons Exception

Ant Design `*Outlined` icons (`PlusOutlined`, `FilterOutlined`, `ReloadOutlined`, `DeleteOutlined`) may **only** be used inside Ant `<Button icon={...}>` slots — because Ant button styling expects them. Everywhere else (page UI, table cells, dropdown menus, headers), use `lucide-react`.

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
4. **Form state** → Ant Design `Form.useForm()`
5. **Cross-component UI state** → React Context (sparingly — only for things like socket)

Never put server data in Zustand. Never use React Query for auth tokens.

---

## Error Handling

- **API errors:** Let React Query handle via `onError` in mutations. Show `message.error(...)`.
- **Page-level errors:** Return early with `<Alert type="error">` (see UI Design System).
- **Form validation:** Use Ant Form `rules` — never manual validation.
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
- `console.log` — for socket connection status (keep in dev)
- Never leave `console.log` for debugging in committed code
- Never use `console.warn` — use Sentry for production warnings

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
- **No inline styles for colors** — use CSS variables. Exception: Ant button `background` gradient.
- **Debounce search inputs** — always 500ms via `useDebounce` hook.
- **Prefer `useCallback`** for handlers passed to memoized children or used in dependency arrays.
- **Prefer `useMemo`** for expensive computations, column definitions, and stat card arrays.
