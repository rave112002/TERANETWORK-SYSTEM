# UI Design System — "Modern"

When building or editing any page component, follow this system.

> The canonical, copy-paste reference is **`modern-module-pattern.md`** (this directory), and
> **`src/pages/Admin/UserManagement/Roles/`** is the reference implementation. This doc is
> the rules; that folder is the shape.

---

## The idea

Monochrome surfaces + hairline borders + **one green accent used sparingly**. Structure comes
from **borders, not shadows**. The primary button is **inverted monochrome** — never the accent,
never a gradient. No pastel tints, no gradient icon chips, no emoji.

---

## Theme Configuration

All colors are CSS custom properties in **`src/index.css`** (`@theme` block, with a `.dark`
override). To re-theme, change the values there — everything follows.

**Never hardcode a hex in a page.** Reference the token.

### Token cheat-sheet

| Token                       | Use                                              |
| --------------------------- | ------------------------------------------------ |
| `--color-canvas`            | page background                                  |
| `--color-surface`           | cards, table, drawer body                        |
| `--color-surface-sunken`    | wells, hover, segmented-toggle track             |
| `--color-line`              | hairline borders                                 |
| `--color-line-soft`         | row dividers                                     |
| `--color-text-dark`         | primary text / values                            |
| `--color-text2`             | mid text (expanded-parent nav label)             |
| `--color-text-secondary`    | body / labels                                    |
| `--color-text-muted`        | captions, icons, `#`, units                      |
| `--color-secondary-color`   | accent (bars, ticks, focus, chips) — `#4ade80`   |
| `--color-link`              | text links — `#16a34a`                           |
| `--color-success` / `--color-warning` / `--color-error` | status, constant across themes |
| `--radius-card` 14 · `--radius-control` 9 | radii                              |

shadcn's semantic tokens (`--background`, `--card`, `--primary`, `--border`, `--ring`, …) are
bridged onto these Modern tokens in the `@theme inline` block of `src/index.css`, so shadcn
components inherit the design in both themes with no per-component theming. To re-theme, change
the Modern token values here — the bridge follows.

### Type

- **Onest** — all UI text, headings, numbers. **JetBrains Mono** — row `#`, ⌘K hints, ids only
  (mono is a *signal*, used tinily, never for body).
- Self-hosted via `@fontsource-variable/*` (imported in `src/main.jsx`); the Google Fonts `<link>`
  in `index.html` is only a dev/CDN fallback. Stacks live in `--font-sans` / `--font-mono`.
- Body weight **400**, headings **600**. Scale: page title `26px/600` (`-.5px` tracking),
  stat number `30px/600`, body `13.5–14px`, labels `11.5–13px`.

### Dark mode

Class-based: a `.dark` class on `<html>` swaps the semantic tokens (the bridged shadcn tokens
follow automatically). State lives in `src/store/themeStore.js`; drop in `<ThemeToggle />`
anywhere, and `<Toaster theme={mode} />` in `App.jsx` keeps toasts in sync. Because every
surface/text color is a token, dark mode needs no per-page work — **just don't hardcode**.

---

## RULES — follow these exactly

1. Root wrapper is `<div className="p-8 space-y-5">`.
2. Page header is `<PageHeader title subtitle actions />` — a plain title + subtitle. No gradient
   tile, no icon chip, no colored banner.
3. Cards/panels/table card: `background: var(--color-surface)`, `1px solid var(--color-line)`,
   `borderRadius: var(--radius-card)` — **no shadow**. Build them as plain `<div>`s with these
   tokens (there is no Card component).
4. **Never** put an inline `background` on the primary button. The default shadcn `<Button>`
   variant *is* the inverted monochrome primary (via the token bridge); `variant="outline"` is
   the secondary and `variant="destructive"` is danger.
5. The accent is for bars, ticks, focus rings and chips — **never a button fill**.
6. The list table's toolbar lives **inside** the card, not in a floating action bar.
7. `Table pagination={false}` — always use `<PaginationFooter />`.
8. All icons come from `lucide-react`, as button/label children
   (`<Button><Plus />New</Button>`). lucide-react only.
9. **Never hardcode a hex** on a themed surface — use tokens.
10. Shadows only on genuinely floating layers (dropdown-menu, dialog, sheet) — the shadcn
    primitives provide those.
11. Never `rounded-full` on layout containers — only pills/dots.

---

## Shared components

| Component | Import | Purpose |
| --------- | ------ | ------- |
| `PageHeader` | `components/PageHeader.jsx` | `<PageHeader title subtitle actions />` |
| `StatCard` | `components/StatCard.jsx` | `<StatCard title value change icon />` — label + dim icon, big value + unit. Flat. |
| `DataTable` | `components/DataTable.jsx` | the list table (TanStack + shadcn). Takes `columns`/`dataSource`/`rowKey`/`rowSelection`/`loading`/`scroll`; pagination stays external |
| `SearchInput` | `components/SearchInput.jsx` | the 280px toolbar filter input (search icon + clear) — the `Input allowClear` replacement |
| `RowActions` | `components/RowActions.jsx` | the ⋮ row-actions menu; takes the `getActionItems` array |
| `PaginationFooter` | `components/PaginationFooter.jsx` | `<PaginationFooter pagination onChange noun nounPlural />` |
| `SectionLabel` | `components/SectionLabel.jsx` | uppercase micro-label + accent tick (form groups) |
| `StatusToggle` | `components/StatusToggle.jsx` | segmented on/off control (use instead of a Select) |
| `PasswordInput` | `components/PasswordInput.jsx` | password field + show/hide toggle (the `Input.Password` replacement) |
| `DescriptionList` | `components/DescriptionList.jsx` | bordered label/value list for read-only view dialogs (the `Descriptions` replacement) |
| `Spinner` | `components/Spinner.jsx` | centered loading spinner (the `Spin` replacement) |
| `ResultState` | `components/ResultState.jsx` | 403/404/500/error state panel (the `Result` replacement) |
| `ConfirmDialog` + `confirm()` | `store/confirmStore.js` | imperative confirm — `const ok = await confirm({ title, description, danger })` (the `Modal.confirm` replacement) |

Shared CSS classes (in `index.css`): `.pager-btn`, `.pager-active`, `.pager-size`, `.nav-item`,
`.icon-btn`. (There are no component-library overrides — table-header type and card flatness live
in `DataTable` and page markup.)

> `StatCard` no longer takes `color` / `bgColor` / `textColor`. It's flat by design.

---

## List page skeleton

**PageHeader → stat cards → one table card** (toolbar + optional filter row + table + pager).

```jsx
<div className="p-8 space-y-5">
  <PageHeader
    title="Roles"
    subtitle="Manage roles and the permissions attached to them."
    actions={
      canWrite && (
        <Button onClick={handleCreate}>
          <Plus />
          New role
        </Button>
      )
    }
  />

  {/* stat cards — CSS grid, not Row/Col */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
    <StatCard
      title="Total roles"
      value={totalRoles}
      change="all time"
      icon={<Shield className="w-4.25 h-4.25" strokeWidth={1.8} />}
    />
    {/* …two more — 3 equal columns… */}
  </div>

  <div
    className="bg-surface overflow-hidden"
    style={{ border: "1px solid var(--color-line)", borderRadius: "var(--radius-card)" }}
  >
    {/* Toolbar: <SearchInput> (280px) left · <RefreshButton> + Filters right */}
    {/* Optional filter row (shadcn <Select>) */}
    {/* <DataTable loading={isLoading} scroll={{ x }} /> + <PaginationFooter noun="role" /> */}
  </div>

  {/* Form drawers (Sheet) at the bottom */}
</div>
```

Full markup: `modern-module-pattern.md` §2 and `Roles/index.jsx`. The default `<Button>` variant is
the inverted primary; the Filters toggle uses `variant={active ? "default" : "outline"}`.

---

## Table columns (in the module's `hooks.jsx`)

Five columns: `#` (mono) · initial-avatar + name · secondary text · status dot · `⋮`.
Sentence-case headers ("Role name"). `⋮` menu = primary action, Edit, divider, Delete (danger).

```jsx
// # — mono, muted, zero-padded
<span className="font-mono" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
  {String((pagination.current - 1) * pagination.pageSize + index + 1).padStart(2, "0")}
</span>

// status — glowing dot + label
<span className="inline-flex items-center gap-2" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
  <span style={{
    width: 7, height: 7, borderRadius: "50%",
    background: active ? "var(--color-success)" : "var(--color-text-muted)",
    boxShadow: active ? "0 0 8px rgba(34,197,94,.5)" : "none",
  }} />
  {status}
</span>
```

Decode API strings with `decodeHTML()` from `utils/decode-html.js`.

Full column spec: `modern-module-pattern.md` §3.

---

## Error state

```jsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CircleAlert } from "lucide-react";

if (error) {
  return (
    <div className="p-8">
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>Error loading roles</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    </div>
  );
}
```

---

## Do / Don't

**Do** — hairline borders; one accent, used sparingly; mono for micro-data only; token every
color; separate destructive actions (divider + `danger`); confirm before delete.

**Don't** — gradient buttons/headers/icon chips; `shadow-*` on static surfaces; pastel tints or
`bg-primary-pale`; `bg-white` / `bg-gray-*` / `text-slate-*` (they don't theme); a colored primary
button; an inline `background` on the primary button; a raw `<table>` instead of `DataTable`;
pulling in another component library.
