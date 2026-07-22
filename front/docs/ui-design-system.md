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

The accent also lives in `src/theme/antdTheme.js` as `COMPANY_PRIMARY` (`#22c55e`) because Ant
Design needs a JS value. Keep the two in sync.

### Type

- **Onest** — all UI text, headings, numbers. **JetBrains Mono** — row `#`, ⌘K hints, ids only
  (mono is a *signal*, used tinily, never for body).
- Self-hosted via `@fontsource-variable/*` (imported in `src/main.jsx`); the Google Fonts `<link>`
  in `index.html` is only a dev/CDN fallback. Stacks live in `--font-sans` / `--font-mono`.
- Body weight **400**, headings **600**. Scale: page title `26px/600` (`-.5px` tracking),
  stat number `30px/600`, body `13.5–14px`, labels `11.5–13px`.

### Dark mode

Class-based: a `.dark` class on `<html>` swaps the semantic tokens. Ant switches via
`darkAlgorithm`. State lives in `src/store/themeStore.js`; drop in `<ThemeToggle />` anywhere.
Because every surface/text color is a token, dark mode needs no per-page work — **just don't
hardcode**.

---

## RULES — follow these exactly

1. Root wrapper is `<div className="p-8 space-y-5">`.
2. Page header is `<PageHeader title subtitle actions />` — a plain title + subtitle. No gradient
   tile, no icon chip, no colored banner.
3. Cards/panels/table card: `background: var(--color-surface)`, `1px solid var(--color-line)`,
   `borderRadius: var(--radius-card)` — **no shadow**. Ant `<Card>` is globally flattened.
4. **Never** put an inline `background` on `type="primary"`. The inverted style is global
   (`.ant-btn-primary` in `index.css`).
5. The accent is for bars, ticks, focus rings and chips — **never a button fill**.
6. The list table's toolbar lives **inside** the card, not in a floating action bar.
7. `Table pagination={false}` — always use `<PaginationFooter />`.
8. All icons come from `lucide-react`. Ant `*Outlined` icons are allowed **only** inside
   `<Button icon={...}>`.
9. **Never hardcode a hex** on a themed surface — use tokens.
10. Shadows only on genuinely floating layers (dropdown, modal, drawer) — Ant provides those.
11. Never `rounded-full` on layout containers — only pills/dots.

---

## Shared components

| Component | Import | Purpose |
| --------- | ------ | ------- |
| `PageHeader` | `components/PageHeader.jsx` | `<PageHeader title subtitle actions />` |
| `StatCard` | `components/StatCard.jsx` | `<StatCard title value change icon />` — label + dim icon, big value + unit. Flat. |
| `PaginationFooter` | `components/PaginationFooter.jsx` | `<PaginationFooter pagination onChange noun nounPlural />` |
| `SectionLabel` | `components/SectionLabel.jsx` | uppercase micro-label + accent tick (form groups) |
| `StatusToggle` | `components/StatusToggle.jsx` | segmented on/off control (use instead of a Select) |

Shared CSS classes (in `index.css`): `.pager-btn`, `.pager-active`, `.pager-size`, `.nav-item`,
`.icon-btn`, plus global `.ant-table-thead > tr > th` (11.5px/500) and flat `.ant-card`.

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
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          New role
        </Button>
      )
    }
  />

  <Row gutter={[14, 14]}>
    <Col xs={24} sm={12} lg={8}>
      <StatCard
        title="Total roles"
        value={totalRoles}
        change="all time"
        icon={<Shield className="w-4.25 h-4.25" strokeWidth={1.8} />}
      />
    </Col>
    {/* …two more — 3 equal columns… */}
  </Row>

  <div
    className="bg-surface overflow-hidden"
    style={{ border: "1px solid var(--color-line)", borderRadius: "var(--radius-card)" }}
  >
    {/* Toolbar: filter Input (280px) left · Refresh + Filters right */}
    {/* Optional filter row */}
    {/* <Table pagination={false} /> + <PaginationFooter noun="role" /> */}
  </div>

  {/* Drawers at the bottom */}
</div>
```

Full markup: `modern-module-pattern.md` §2 and `Roles/index.jsx`.

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
if (error) {
  return (
    <div className="p-8">
      <Alert message="Error loading roles" description={error.message} type="error" showIcon />
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
button; an inline `background` on `type="primary"`; Ant's default pager on a list table.
