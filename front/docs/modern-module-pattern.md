# Modern Module Pattern

How to build any admin module's **list page** and **create/edit form** to match the "Modern"
design (Onest + monochrome surfaces + green accent, hairline borders, no shadows). The Roles
submodule (`src/pages/Admin/UserManagement/Roles/`) is the reference implementation — copy its
shape. UI primitives are **shadcn/ui** (`@/components/ui/*`), with lucide-react icons.

> Everything visual is driven by central tokens. **Never hardcode hex colors** in a page — use the
> CSS variables below so light/dark and future re-brands "just work". The form pattern lives in
> **`ui-form-design.md`** (Sheet + react-hook-form + zod); this doc covers the list page and the
> shared chrome.

---

## 1. The design system (already global — don't re-declare)

- **Fonts** — `Onest` (UI + headings) and `JetBrains Mono` (row `#`, ⌘K, ids). Self-hosted via
  `@fontsource-variable/*` (imported in `src/main.jsx`). Stacks live in `--font-sans` /
  `--font-mono` (`index.css`). Body weight **400**, headings **600**.
- **Accent** — green: `--color-secondary-color` (`#4ade80`) for bars/focus/chips, `--color-link`
  (`#16a34a`) for text links. Used **sparingly** — never on buttons.
- **Primary buttons are INVERTED** — the default shadcn `<Button>` variant is dark-on-light /
  light-on-dark (via the token bridge). Just use `<Button>`; never add an inline `background`.
  `variant="outline"` = secondary (Cancel), `variant="destructive"` = danger.
- **Cards/panels** — plain `<div>` with `1px solid var(--color-line)`, `border-radius: 14`,
  **no shadow**. There is no Card component.

### Token cheat-sheet

| Token                                     | Use                                              |
| ----------------------------------------- | ------------------------------------------------ |
| `--color-canvas`                          | page background                                  |
| `--color-surface`                         | cards, table, sheet body                         |
| `--color-surface-sunken`                  | wells, hover, segmented-toggle track             |
| `--color-line`                            | hairline borders                                 |
| `--color-line-soft`                       | row dividers                                     |
| `--color-text-dark`                       | primary text / values                            |
| `--color-text2`                           | `#27272A` — mid text (expanded-parent nav label) |
| `--color-text-secondary`                  | body / labels                                    |
| `--color-text-muted`                      | captions, icons, `#`, units                      |
| `--color-secondary-color`                 | accent (bars, ticks, focus, chips)               |
| `--radius-card` 14 · `--radius-control` 9 | radii                                            |

shadcn's semantic tokens are bridged onto these in the `@theme inline` block of `index.css`.
Shared components: `PageHeader`, `StatCard`, `SearchInput`, `DataTable`, `RowActions`,
`PaginationFooter`, `SectionLabel`, `StatusToggle` (see `ui-design-system.md` for the full list).

---

## 2. List page skeleton

Structure: **PageHeader → stat cards → one table card** that contains the toolbar, an optional
filter row, the `DataTable`, and the custom pagination footer. Root padding is `p-8`.

```jsx
import { Plus, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "…/components/PageHeader";
import StatCard from "…/components/StatCard";
import SearchInput from "…/components/SearchInput";
import DataTable from "…/components/DataTable";
import PaginationFooter from "…/components/PaginationFooter";
import RefreshButton from "…/components/RefreshButton";

return (
  <div className="p-8 space-y-5">
    {/* 1. HEADER — plain title + subtitle + inverted primary action */}
    <PageHeader
      title="Roles"
      subtitle="Manage roles and the permissions attached to them."
      actions={canWrite && (
        <Button onClick={handleCreate}><Plus />New role</Button>
      )}
    />

    {/* 2. STAT CARDS — CSS grid, 3 equal columns */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
      <StatCard title="Total roles" value={totalRoles} change="all time"
        icon={<Shield className="w-4.25 h-4.25" strokeWidth={1.8} />} />
      {/* …two more… */}
    </div>

    {/* 3. TABLE CARD */}
    <div className="bg-surface overflow-hidden"
      style={{ border: "1px solid var(--color-line)", borderRadius: "var(--radius-card)" }}>
      {/* Toolbar: SearchInput (left) + Refresh / Filters (right) */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-[18px] py-3.5"
        style={{ borderBottom: "1px solid var(--color-line)" }}>
        <SearchInput value={filters.search} onChange={handleSearch} placeholder="Filter roles…" />
        <div className="flex items-center gap-2">
          <RefreshButton onRefresh={refetch} isFetching={isFetching} />
          <Button
            variant={isFilterVisible || hasActiveFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setIsFilterVisible(!isFilterVisible)}
          >
            <Filter />Filters
          </Button>
        </div>
      </div>

      {/* Optional filter row — shadcn <Select> + Clear all, same padding.
          Use a "all" sentinel value mapped to "" (Radix SelectItem can't be empty). */}
      {isFilterVisible && (/* …status Select + Clear all… */)}

      {/* DataTable (no built-in pager) + custom footer (§4) */}
      {isEmpty ? <EmptyState /> : (
        <>
          <DataTable dataSource={data} columns={columns} rowKey="roleId"
            loading={isLoading} scroll={{ x: 900 }} />
          <PaginationFooter pagination={pagination} onChange={handleTableChange} noun="role" />
        </>
      )}
    </div>

    {/* 4. FORM DRAWERS (Sheet) at the bottom */}
  </div>
);
```

Rules:

- The toolbar lives **inside** the card (not a floating action bar).
- `DataTable` has no pager — the `<PaginationFooter />` below replaces it. Pass `rowSelection`
  `{ selectedRowKeys, onChange }` only when the page supports bulk actions.
- No `boxShadow` on the card; hairline border only.
- Empty state: a centered message + the primary create button (see `Roles/index.jsx`).

---

## 3. Table columns (in the module's `hooks.jsx`)

`DataTable` accepts the **same column shape** the app has always used
(`title`/`dataIndex`/`key`/`render`/`width`/`align`/`fixed`/`sorter`/`ellipsis`). Five columns:
`#` (mono) · primary (initial-avatar + name) · secondary text · status dot · `⋮`.

```jsx
import RowActions from "…/components/RowActions";

const columns = useMemo(() => [
  {
    title: "#", key: "index", width: 56,
    render: (_, __, index) => (
      <span className="font-mono" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
        {String((pagination.current - 1) * pagination.pageSize + index + 1).padStart(2, "0")}
      </span>
    ),
  },
  {
    title: "Role name", dataIndex: "roleName", key: "roleName",
    render: (name) => {
      const label = decodeHTML(name) || "";
      const initial = (label.trim().charAt(0) || "?").toUpperCase();
      return (
        <div className="flex items-center gap-3 min-w-0">
          <span style={{
            width: 30, height: 30, borderRadius: 8, display: "flex", flex: "none",
            alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600,
            background: "var(--color-surface-sunken)", border: "1px solid var(--color-line)",
            color: "var(--color-text-secondary)",
          }}>{initial}</span>
          <span className="truncate" style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-dark)" }}>
            {label}
          </span>
        </div>
      );
    },
  },
  {
    title: "Status", dataIndex: "status", key: "status", width: 130,
    render: (status) => {
      const active = status === "Active";
      return (
        <span className="inline-flex items-center gap-2" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: active ? "var(--color-success)" : "var(--color-text-muted)",
            boxShadow: active ? "0 0 8px rgba(34,197,94,.5)" : "none",
          }} />
          {status}
        </span>
      );
    },
  },
  {
    title: "", key: "actions", width: 60, align: "right",
    render: (_, record) => <RowActions items={getActionItems(record)} />,
  },
], [getActionItems, pagination]);
```

`getActionItems(record)` returns `{ key, label, icon, onClick, danger?, disabled? }` with
`{ type: "divider" }` separators — primary action, Edit, divider, Delete (danger). `RowActions`
renders the ⋮ shadcn `DropdownMenu` from it. Decode API strings with `decodeHTML()`.

---

## 4. Custom pagination footer

Use the shared **`<PaginationFooter pagination onChange noun nounPlural />`** component — it renders
the "Showing X–Y of N" caption, the prev/active/next controls (`.pager-*` classes), and the
page-size `DropdownMenu`. `onChange` is the hook's `handleTableChange`, called with
`{ current, pageSize }`. Only the noun changes per module (`noun="role"`,
`nounPlural="companies"` for irregulars).

---

## 5. Create / edit form (Sheet + RHF + zod)

Full pattern in **`ui-form-design.md`**; reference `RoleFormDrawer.jsx`. In short:

- The form file owns a shadcn `<Sheet>` (`side="right"`, `sm:max-w-[800px]`, `showCloseButton={false}`
  — we render our own bordered X). Props are exactly `{ open, onClose, onSuccess, entity? }`.
- State is `react-hook-form` with a `zod` schema via `zodResolver`; hydrate with `form.reset()`,
  dirty-check with `formState.isDirty`, submit with `form.handleSubmit(onSubmit)`.
- **Header** — accent gradient chip + title + subtitle + bordered X (copy switches on `isEditMode`).
- **Sections** — `<SectionLabel>` per group (uppercase + accent tick), not a divider.
- **Fields** — `<FormField>` + shadcn `<Input>`/`<Textarea>`/`<Select>` at `h-10`; icon prefix via a
  relative wrapper outside `<FormControl>`; phone via `phoneFormat` helpers; passwords via
  `PasswordInput`. Required fields render an explicit `*`.
- **Segmented toggle** — `<StatusToggle value={field.value} onChange={field.onChange} />` for
  on/off choices (not a Select).
- **Footer** (inside the `<form>`) — hairline top border; Cancel (`variant="outline"`) + inverted
  primary (`type="submit"`, default variant, `+` icon), dirty-check disable + tooltip.

Read-only **detail views** use a `<Dialog>` + `DescriptionList` at `sm:max-w-[640px]` (see
`UserViewModal.jsx`).

---

## 6. Conversion checklist (per module)

**List page (`index.jsx`)**

- [ ] Root `p-8 space-y-5`
- [ ] `<PageHeader title subtitle actions={<Button><Plus/>New …</Button>} />`
- [ ] Stat cards in a CSS grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5`) of `<StatCard title value change icon />`
- [ ] One bordered table card (1px line, radius 14, no shadow)
- [ ] Toolbar inside the card: `<SearchInput>` left; `<RefreshButton>` + Filters (`variant` toggles) right
- [ ] `<DataTable>` + `<PaginationFooter>` (no built-in pager)
- [ ] Filter `<Select>` uses an `"all"` sentinel mapped to `""`
- [ ] Remove any legacy: gradient buttons, `shadow-*`, pastel tints, `bg-primary-pale`

**Columns (`hooks.jsx`)**

- [ ] `#` mono · initial-avatar + name · secondary text · status dot · `⋮`
- [ ] Sentence-case header titles ("Role name")
- [ ] Actions column renders `<RowActions items={getActionItems(record)} />`
- [ ] `getActionItems`: primary action, Edit, divider, Delete (danger)

**Form (`components/…FormDrawer.jsx`)** — see `ui-form-design.md`

- [ ] Owns a `<Sheet>`; props `{ open, onClose, onSuccess, entity? }`; `sr-only` `<SheetTitle>`
- [ ] `useForm({ resolver: zodResolver(schema) })`; `form.reset()` to hydrate; `isDirty` dirty-check
- [ ] Header chip + bordered X; `SectionLabel` per group
- [ ] `<FormField>` fields; `StatusToggle` for on/off; phone/password via shared helpers
- [ ] Footer: Cancel + inverted primary (`type="submit"`, `+` icon), dirty disable + tooltip

**Never**

- [ ] Pull in another component or icon library (shadcn/ui + lucide only)
- [ ] Hardcode a hex — use tokens
- [ ] Inline a `background` on the primary button
- [ ] Add a shadow, gradient, or pastel chip (except the form header chip)
- [ ] Use a raw `<table>` instead of `DataTable`
