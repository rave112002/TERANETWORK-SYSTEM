# Modern Module Pattern

How to build any admin module's **list page** and **create/edit drawer** to match the
"Modern" design (Onest + monochrome surfaces + green accent, hairline borders, no
shadows). The Roles submodule
(`src/pages/Admin/UserManagement/Roles/`) is the reference implementation — copy its
shape.

> Everything visual is driven by central tokens. **Never hardcode hex colors** in a
> page — use the CSS variables below so light/dark and future re-brands "just work".

---

## 1. The design system (already global — don't re-declare)

- **Fonts** — `Onest` (UI + headings) and `JetBrains Mono` (row `#`, ⌘K, ids).
  **Self-hosted** via `@fontsource-variable/onest` + `@fontsource-variable/jetbrains-mono`,
  imported in `src/main.jsx` (offline-safe in production). A Google Fonts `<link>` in
  `index.html` is kept as a **fallback** so the font also renders in dev without a Vite
  restart. The stacks list the bundled family first (`"Onest Variable"`,
  `"JetBrains Mono Variable"`) then the plain CDN name (`"Onest"`), in `--font-sans` /
  `--font-mono` (`index.css`) and `antdTheme.js`. Body weight is **400** (light),
  headings **600**.
- **Accent** — green: `--color-secondary-color` (`#4ade80`) for bars/focus/chips,
  `--color-link` (`#16a34a`) for text links. Ant's `colorPrimary` is `#22c55e`.
  Used **sparingly** — never on buttons.
- **Primary buttons are INVERTED** (`type="primary"` → dark button/light text in light
  mode, light/dark in dark mode). Handled by the `.ant-btn-primary` override — just use
  `type="primary"`, never add an inline `background`.
- **Cards/panels** — `1px solid var(--color-line)`, `border-radius: 14`, **no shadow**.

### Token cheat-sheet

| Token                                     | Use                                              |
| ----------------------------------------- | ------------------------------------------------ |
| `--color-canvas`                          | page background                                  |
| `--color-surface`                         | cards, table, drawer body                        |
| `--color-surface-sunken`                  | wells, hover, segmented-toggle track             |
| `--color-line`                            | hairline borders                                 |
| `--color-line-soft`                       | row dividers                                     |
| `--color-text-dark`                       | primary text / values                            |
| `--color-text2`                           | `#27272A` — mid text (expanded-parent nav label) |
| `--color-text-secondary`                  | body / labels                                    |
| `--color-text-muted`                      | captions, icons, `#`, units                      |
| `--color-secondary-color`                 | accent (bars, ticks, focus, chips)               |
| `--radius-card` 14 · `--radius-control` 9 | radii                                            |

Shared components: `components/PageHeader.jsx`, `components/StatCard.jsx`. Shared CSS
classes (in `index.css`): `.pager-btn`, `.pager-active`, `.pager-size`, plus global
`.ant-table-thead > tr > th` (11.5px/500) and `.ant-card` (flat).

---

## 2. List page skeleton

Structure: **PageHeader → stat cards → one table card** that contains the toolbar, an
optional filter row, the table, and a custom pagination footer. Root padding is `p-8`.

```jsx
return (
  <div className="p-8 space-y-5">
    {/* 1. HEADER — plain title + subtitle + inverted primary action */}
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

    {/* 2. STAT CARDS — 3 equal columns; StatCard = label + dim icon + value + unit */}
    <Row gutter={[14, 14]}>
      <Col xs={24} sm={12} lg={8}>
        <StatCard
          title="Total roles"
          value={totalRoles}
          change="all time"
          icon={<Shield className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
      </Col>
      {/* …two more… */}
    </Row>

    {/* 3. TABLE CARD */}
    <div
      className="bg-surface overflow-hidden"
      style={{ border: "1px solid var(--color-line)", borderRadius: 14 }}
    >
      {/* Toolbar: filter input (left) + Refresh / Filters (right) */}
      <div
        className="flex items-center justify-between gap-3 flex-wrap px-[18px] py-3.5"
        style={{ borderBottom: "1px solid var(--color-line)" }}
      >
        <Input
          placeholder="Filter roles…"
          prefix={<Search className="w-[15px] h-[15px] text-text-muted" />}
          value={filters.search}
          onChange={(e) => handleSearch(e.target.value)}
          allowClear
          style={{ width: 280 }}
        />
        <div className="flex items-center gap-2">
          <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading}>
            Refresh
          </Button>
          <Button
            icon={<FilterOutlined />}
            onClick={() => setIsFilterVisible(!isFilterVisible)}
            type={isFilterVisible || hasActiveFilters ? "primary" : "default"}
          >
            Filters
          </Button>
        </div>
      </div>

      {/* Optional filter row (Select + Clear all) — same left/right padding */}
      {isFilterVisible && (/* …status Select + Clear all… */)}

      {/* Table (Ant pager OFF) + custom footer (see §4) */}
      {empty ? <EmptyState /> : (
        <>
          <Table
            dataSource={data}
            columns={columns}
            rowKey="roleId"
            pagination={false}
            onChange={handleTableChange}
            size="middle"
            className="border-none"
          />
          <PaginationFooter />
        </>
      )}
    </div>

    {/* 4. DRAWERS at the bottom */}
  </div>
);
```

Rules:

- The toolbar lives **inside** the card (not a floating action bar).
- `Table pagination={false}` — the footer below replaces Ant's pager.
- No `boxShadow` on the card; hairline border only.

---

## 3. Table columns (in the module's `hooks.jsx` `getColumns`)

Five columns: `#` (mono) · primary (initial-avatar + name) · secondary text · status
dot · `⋮`. Header cells auto-shrink to 11.5px via the global CSS.

```jsx
const getColumns = useCallback(
  (onEdit, onManage, onDelete) => [
    {
      title: "#",
      key: "index",
      width: 56,
      render: (_, __, index) => (
        <span
          className="font-mono"
          style={{ fontSize: 12, color: "var(--color-text-muted)" }}
        >
          {String(
            (pagination.current - 1) * pagination.pageSize + index + 1,
          ).padStart(2, "0")}
        </span>
      ),
    },
    {
      title: "Role name",
      dataIndex: "roleName",
      key: "roleName",
      render: (name) => {
        const label = heDecode(name) || "";
        const initial = (label.trim().charAt(0) || "?").toUpperCase();
        return (
          <div className="flex items-center gap-3 min-w-0">
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "var(--color-surface-sunken)",
                border: "1px solid var(--color-line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "none",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--color-text-secondary)",
              }}
            >
              {initial}
            </span>
            <span
              className="truncate"
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "var(--color-text-dark)",
              }}
            >
              {label}
            </span>
          </div>
        );
      },
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (d) => (
        <span style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
          {heDecode(d)}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (status) => {
        const active = status === "Active";
        return (
          <span
            className="inline-flex items-center gap-2"
            style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: active ? "#22c55e" : "var(--color-text-muted)",
                boxShadow: active ? "0 0 8px rgba(34,197,94,.5)" : "none",
              }}
            />
            {status}
          </span>
        );
      },
    },
    {
      title: "",
      key: "actions",
      width: 60,
      align: "right",
      render: (_, record) => (
        <Dropdown
          menu={{ items: getActionItems(record, onEdit, onManage, onDelete) }}
          trigger={["click"]}
          placement="bottomRight"
        >
          <Button
            type="text"
            icon={<MoreVertical className="w-4 h-4" />}
            className="hover:bg-(--color-surface-sunken)"
          />
        </Dropdown>
      ),
    },
  ],
  [getActionItems, pagination],
);
```

Swap `roleName`/`description`/`status` for the module's fields. Keep the shape.
`⋮` menu items: primary action, Edit, divider, Delete (danger).

---

## 4. Custom pagination footer

Compute values in the page body, then render the footer inside the table card. Styles
come from the shared `.pager-*` classes.

```jsx
// in the component body:
const pgCurrent = pagination?.current || 1;
const pgSize = pagination?.pageSize || 10;
const pgTotal = pagination?.total || 0;
const pgTotalPages = Math.max(1, Math.ceil(pgTotal / pgSize));
const pgStart = pgTotal === 0 ? 0 : (pgCurrent - 1) * pgSize + 1;
const pgEnd = Math.min(pgCurrent * pgSize, pgTotal);
const goPage = (p) =>
  handleTableChange({
    current: Math.min(Math.max(1, p), pgTotalPages),
    pageSize: pgSize,
  });
```

```jsx
<div className="flex items-center justify-between gap-3 flex-wrap px-5 py-3">
  <span className="text-[12.5px]" style={{ color: "var(--color-text-muted)" }}>
    {pgTotal === 0
      ? "No results"
      : `Showing ${pgStart}${pgEnd > pgStart ? `–${pgEnd}` : ""} of ${pgTotal} role${pgTotal === 1 ? "" : "s"}`}
  </span>
  <div className="flex items-center gap-2.5">
    <div className="flex items-center gap-1">
      <button
        onClick={() => goPage(pgCurrent - 1)}
        disabled={pgCurrent <= 1}
        className="pager-btn"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <div className="pager-active">{pgCurrent}</div>
      <button
        onClick={() => goPage(pgCurrent + 1)}
        disabled={pgCurrent >= pgTotalPages}
        className="pager-btn"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
    <Dropdown
      trigger={["click"]}
      menu={{
        items: [10, 20, 50, 100].map((n) => ({
          key: String(n),
          label: `${n} / page`,
          onClick: () => handleTableChange({ current: 1, pageSize: n }),
        })),
      }}
    >
      <button className="pager-size">
        {pgSize} / page{" "}
        <ChevronsUpDown
          className="w-3 h-3"
          style={{ color: "var(--color-text-muted)" }}
        />
      </button>
    </Dropdown>
  </div>
</div>
```

Only the noun ("role") changes per module.

---

## 5. Create / edit drawer

Follow `Roles/components/RoleFormDrawer.jsx`. Props are exactly
`{ open, onClose, onSuccess, entity? }`; the form owns its `<Drawer>`. Width `480`,
`closable={false}` (we render our own X). All the create/update mutation + dirty-check
logic stays as-is — only the chrome below is the pattern.

**Header** — accent chip + title + subtitle + bordered X:

```jsx
<div className="flex items-start justify-between gap-3 mb-7">
  <div className="flex items-center gap-3 min-w-0">
    <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
      <Shield className="w-[22px] h-[22px] text-white" />
    </span>
    <div className="min-w-0">
      <h2
        className="m-0 font-semibold leading-tight"
        style={{ fontSize: 19, color: "var(--color-text-dark)" }}
      >
        {isEditMode ? "Edit Role" : "Create New Role"}
      </h2>
      <p
        className="m-0 mt-0.5"
        style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
      >
        {isEditMode
          ? "Update role information"
          : "Define a new role for your school"}
      </p>
    </div>
  </div>
  <button
    onClick={handleClose}
    aria-label="Close"
    className="inline-flex items-center justify-center shrink-0 transition-colors hover:bg-(--color-surface-sunken)"
    style={{
      width: 32,
      height: 32,
      borderRadius: 8,
      border: "1px solid var(--color-line)",
      color: "var(--color-text-secondary)",
    }}
  >
    <X className="w-[18px] h-[18px]" />
  </button>
</div>
```

**Section label** — reusable helper (uppercase + accent tick):

```jsx
const SectionLabel = ({ children }) => (
  <div className="flex items-center gap-2 mb-4">
    <span
      style={{
        width: 3,
        height: 14,
        borderRadius: 2,
        background: "var(--color-secondary-color)",
      }}
    />
    <span
      className="uppercase"
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        color: "var(--color-text-muted)",
      }}
    >
      {children}
    </span>
  </div>
);
```

**Fields** — Ant `Form` `layout="vertical"` `requiredMark`; `size="large"` inputs; icon
prefix where it clarifies; `showCount maxLength` on textareas. Sections separated by
`<div className="mt-7"><SectionLabel/>…</div>`, not a `<Divider>`.

**Segmented toggle** (for status / on-off choices) — a controlled component usable
inside `Form.Item`; the selected option is a white pill:

```jsx
const StatusToggle = ({ value, onChange }) => {
  const opts = [
    { v: "Active", dot: "#22c55e" },
    { v: "Inactive", dot: "var(--color-text-muted)" },
  ];
  return (
    <div
      className="grid grid-cols-2 gap-1 p-1"
      style={{
        background: "var(--color-surface-sunken)",
        border: "1px solid var(--color-line)",
        borderRadius: 12,
      }}
    >
      {opts.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange?.(o.v)}
            className="flex items-center justify-center gap-2 transition-colors"
            style={{
              height: 40,
              borderRadius: 9,
              fontSize: 13.5,
              fontWeight: 500,
              border: "none",
              cursor: "pointer",
              background: active ? "var(--color-surface)" : "transparent",
              color: active
                ? "var(--color-text-dark)"
                : "var(--color-text-secondary)",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,.06)" : "none",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: o.dot,
              }}
            />
            {o.v}
          </button>
        );
      })}
    </div>
  );
};
// usage: <Form.Item name="status" label="Status" ...><StatusToggle /></Form.Item>
```

**Footer** — hairline top border; Cancel (outline) + inverted primary with a `+` icon;
keep the dirty-check disable + tooltip:

```jsx
<div
  className="mt-8 pt-5 flex justify-end gap-3"
  style={{
    borderTop: "1px solid var(--color-line)",
    paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
  }}
>
  <Button onClick={handleClose} size="large">
    Cancel
  </Button>
  <Tooltip title={saveDisabled ? "No changes to save yet" : undefined}>
    <span>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={handleSubmit}
        disabled={saveDisabled}
        loading={createMutation.isPending || updateMutation.isPending}
        size="large"
      >
        {isEditMode ? "Update Role" : "Create Role"}
      </Button>
    </span>
  </Tooltip>
</div>
```

Never put an inline `background` on the primary button — the inverted style is global.

---

## 6. Conversion checklist (per module)

**List page (`index.jsx`)**

- [ ] Root `p-8 space-y-5`
- [ ] `<PageHeader title subtitle actions={<Button type="primary" icon={<PlusOutlined/>}>New …</Button>} />`
- [ ] Stat cards in a `Row gutter={[14,14]}` of `Col lg={8}` `<StatCard title value change icon />`
- [ ] One bordered table card (1px line, radius 14, no shadow)
- [ ] Toolbar row inside the card: filter `Input` (280px) left; Refresh + Filters right
- [ ] `Table pagination={false}` + the custom pagination footer
- [ ] Remove any legacy: gradient buttons, `shadow-*`, pastel tints, `bg-primary-pale`

**Columns (`hooks.jsx`)**

- [ ] `#` mono · initial-avatar + name · secondary text · status dot · `⋮`
- [ ] Sentence-case header titles ("Role name")
- [ ] `getActionItems`: primary action, Edit, divider, Delete (danger)

**Drawer (`components/…FormDrawer.jsx`)**

- [ ] Props `{ open, onClose, onSuccess, entity? }`; owns its `<Drawer width={800} closable={false}>`
- [ ] Header: accent chip + title + subtitle + bordered X
- [ ] `SectionLabel` (uppercase + tick) for each group
- [ ] Vertical form, `size="large"`, `showCount` on textareas
- [ ] `StatusToggle` for on/off choices (not a Select)
- [ ] Footer: Cancel + inverted primary (`+` icon), dirty-check disable + tooltip

**Never**

- [ ] Hardcode a hex — use tokens
- [ ] Inline a `background` on `type="primary"`
- [ ] Add a shadow, gradient, or pastel chip
- [ ] Leave Ant's default pager on a list table
