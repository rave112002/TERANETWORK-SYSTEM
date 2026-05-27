# UI Design System

When building or editing any page component, follow the UI Design System.

---

## Theme Configuration

All colors are defined in **`src/index.css`** as design tokens. To rebrand, change the values there — everything else follows automatically. Tokens come in two tiers:

- **Brand** (`--color-primary-*`, `--color-secondary-*`, `--gradient-*`) — your accent identity. Mostly constant across light/dark.
- **Semantic** (`--color-canvas`, `--color-surface`, `--color-surface-sunken`, `--color-text-dark`, `--color-text-secondary`, `--color-text-muted`, `--color-border`) — surfaces / text / borders that **flip in dark mode**.

> The brand primary also lives in `src/theme/antdTheme.js` as `BRAND_PRIMARY` (Ant Design needs a JS value). Keep the two in sync when rebranding.

---

## Dark Mode & Theming

Dark mode is **class-based**: a `.dark` class on `<html>` swaps the semantic token values (see the `.dark` block in `src/index.css`). Ant Design components switch via `darkAlgorithm` in `src/theme/antdTheme.js`.

- **State** — `src/store/themeStore.js` (Zustand, persisted to `localStorage`, defaults to the OS preference). A no-flash inline script in `index.html` applies the class before first paint.
- **Toggle** — drop `<ThemeToggle />` (`src/components/ThemeToggle.jsx`) anywhere.
- **Writing dark-ready UI** — use semantic tokens, never hardcoded surface/text colors:
  | Use this (adapts) | Not this (light-only) |
  | ----------------- | --------------------- |
  | `bg-surface` / `var(--color-surface)` | `bg-white` |
  | `var(--color-canvas)` | `bg-slate-50`, `bg-gray-50` |
  | `var(--color-surface-sunken)` | `bg-gray-100` |
  | `var(--color-text-dark)` | `text-slate-800`, `text-gray-900` |
  | `var(--color-text-secondary)` | `text-gray-500` |
  | `border-(--color-border)` / `var(--color-border)` | `ring-gray-100`, `border-gray-200` |

  Ant Design components (`Table`, `Card`, `Input`, `Drawer`, `Modal`, `Tag`…) adapt automatically — no extra work needed.

---

## RULES — follow these exactly, no exceptions

1. Root wrapper is always `<div className="p-6 space-y-5">` — never add `min-h-screen`, `mx-12`, or background gradients on the root.
2. Page header is always a flat `flex items-center justify-between` row — never a colored banner or card.
3. Stat cards are plain `<div>` elements — never Ant Design `<Card>`.
4. Section content cards use Ant Design `<Card className="shadow-lg border-0">` — never `shadow-sm`, never add a border color.
5. The table is wrapped in a plain `<div>` with `rounded-2xl overflow-hidden`, `bg-surface`, a `1px solid var(--color-border)` border, and `box-shadow: var(--shadow-raised)` — never inside a `<Card>`, never `bg-white` or `ring-gray-100` (those don't adapt to dark mode).
6. Search input inside the filter panel always uses Ant Design `<Input prefix={...}>` — never a raw `<input>`.
7. "Clear all" is always a plain `<button>` text link — never an Ant Design `<Button>`.
8. All icons are from `lucide-react` only.
9. Font is **Poppins** — do not override it anywhere.
10. Never use `rounded-3xl` or `rounded-full` on layout containers — only on tags/badges.
11. **Never hardcode color hex values in inline styles.** Always use CSS variables via `var(--color-*)` or `var(--gradient-*)`.

---

## Reusable Components

### StatCard — `src/components/StatCard.jsx`

**Always import from the shared component — never define it inline.**

```jsx
import StatCard from "../../../../components/StatCard";
```

Props:

| Prop        | Type            | Required | Description                                                                      |
| ----------- | --------------- | -------- | -------------------------------------------------------------------------------- |
| `title`     | `string`        | ✓        | Label above the value (truncates if too long)                                    |
| `value`     | `string/number` | ✓        | The big number                                                                   |
| `icon`      | `ReactNode`     | ✓        | Lucide icon, e.g. `<Users className="w-5 h-5" />`                                |
| `color`     | `string`        | ✓        | Tailwind gradient for bottom bar, e.g. `"from-primary-color to-secondary-color"` |
| `bgColor`   | `string`        | ✓        | Icon box background, e.g. `"bg-primary-pale"`                                    |
| `textColor` | `string`        | ✓        | Icon color, e.g. `"text-primary-color"`                                          |
| `change`    | `string`        | —        | Optional caption below the value                                                 |

Usage example:

```jsx
<Row gutter={[16, 16]}>
  <Col xs={24} sm={12} lg={6}>
    <StatCard
      title="Total Users"
      value={42}
      icon={<Users className="w-5 h-5" />}
      color="from-primary-color to-secondary-color"
      bgColor="bg-primary-pale"
      textColor="text-primary-color"
      change="+5 this month"
    />
  </Col>
</Row>
```

---

## Tech Stack

- React + Ant Design + Tailwind CSS + lucide-react
- Font: Poppins (all weights)
- Theme: CSS variables in `src/index.css`

---

## Complete Page Skeleton

This is the exact structure every page follows. Replace the placeholder comments with real content.

```jsx
import {
  DeleteOutlined,
  FilterOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Col,
  Drawer,
  Empty,
  Input,
  Popconfirm,
  Row,
  Select,
  Spin,
  Table,
  Typography,
} from "antd";
import { Search, SomeLucideIcon } from "lucide-react";
import { useState } from "react";
import StatCard from "../../../../components/StatCard";

const { Title, Text } = Typography;

const MyPage = () => {
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const hasActiveFilters = false; // derive from filter state

  if (error) {
    return (
      <div className="p-6">
        <Alert
          message="Error Loading Data"
          description={
            error.message || "Failed to load data. Please try again."
          }
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* 1. PAGE HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <Title level={2} className="mb-1! flex items-center gap-3">
            <div
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl shadow-md"
              style={{ background: "var(--gradient-primary)" }}
            >
              <SomeLucideIcon className="w-5 h-5 text-white" />
            </div>
            Page Title
          </Title>
          <Text
            style={{ color: "var(--color-text-secondary)" }}
            className="text-sm"
          >
            Subtitle / description
          </Text>
        </div>
        {canWrite && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {}}
            size="large"
            style={{
              background: "var(--gradient-primary)",
              border: "none",
              boxShadow:
                "0 4px 12px color-mix(in srgb, var(--color-primary-color) 35%, transparent)",
            }}
          >
            Add Item
          </Button>
        )}
      </div>

      {/* 2. STAT CARDS */}
      <Row gutter={[16, 16]}>
        {statCards.map((card, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <StatCard {...card} />
          </Col>
        ))}
      </Row>

      {/* 3. ACTION BAR */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          icon={<ReloadOutlined />}
          onClick={() => refetch?.()}
          loading={isFetching}
          size="middle"
          style={{
            borderColor: "var(--color-primary-color)",
            color: "var(--color-primary-color)",
          }}
        >
          Refresh
        </Button>
        <Button
          icon={<FilterOutlined />}
          onClick={() => setIsFilterVisible(!isFilterVisible)}
          size="middle"
          style={
            isFilterVisible || hasActiveFilters
              ? {
                  borderColor: "var(--color-primary-color)",
                  color: "var(--color-primary-color)",
                  background: "var(--color-primary-pale)",
                }
              : {
                  borderColor: "var(--color-primary-color)",
                  color: "var(--color-primary-color)",
                }
          }
        >
          Filters
          {hasActiveFilters && (
            <span
              className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[10px] font-bold"
              style={{ background: "var(--color-primary-color)" }}
            >
              !
            </span>
          )}
        </Button>
        {hasSelectedRows && canWrite && (
          <Popconfirm
            title="Delete Selected Items"
            description={`Are you sure you want to delete ${selectedRowKeys.length} item(s)?`}
            onConfirm={handleBulkDelete}
            okText="Delete"
            okType="danger"
            cancelText="Cancel"
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={isLoading}
              size="middle"
            >
              Delete Selected ({selectedRowKeys.length})
            </Button>
          </Popconfirm>
        )}
      </div>

      {/* 4. FILTER PANEL */}
      {isFilterVisible && (
        <div
          className="rounded-xl p-4"
          style={{
            background:
              "color-mix(in srgb, var(--color-primary-pale) 50%, white)",
            border: "1px solid var(--color-primary-pale)",
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Search
              </label>
              <Input
                placeholder="Search..."
                prefix={<Search className="w-3.5 h-3.5 text-gray-400" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                size="middle"
                className={isSearching ? "bg-yellow-50 border-yellow-300" : ""}
              />
            </div>
            <div className="flex flex-col">
              <span className="block text-xs font-semibold text-transparent mb-1.5 uppercase tracking-wide select-none">
                &nbsp;
              </span>
              <button
                onClick={handleClearFilters}
                className="text-sm hover:underline cursor-pointer transition-colors font-medium h-8 flex items-center"
                style={{ color: "var(--color-primary-color)" }}
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. TABLE */}
      <div
        className="rounded-2xl overflow-hidden bg-surface"
        style={{
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-raised)",
        }}
      >
        {!isLoading && !data?.items?.length ? (
          <div className="flex items-center justify-center py-20">
            <Empty description="No items found">
              {canWrite && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {}}
                  className="mt-4"
                  style={{
                    background: "var(--gradient-primary)",
                    border: "none",
                  }}
                >
                  Add First Item
                </Button>
              )}
            </Empty>
          </div>
        ) : (
          <Table
            dataSource={data?.items}
            columns={columns}
            rowSelection={canWrite ? rowSelection : null}
            loading={{
              spinning: isLoading,
              indicator: <Spin size="large" style={{ marginTop: 50 }} />,
            }}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: data?.pagination?.total || 0,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}–${range[1]} of ${total} items`,
              pageSizeOptions: ["10", "20", "50", "100"],
              size: "default",
              responsive: true,
              className: "px-6 py-3",
            }}
            onChange={handleTableChange}
            scroll={{ x: 1200 }}
            size="middle"
            className="border-none"
            rowClassName="hover:bg-primary-pale/30 transition-colors"
          />
        )}
      </div>

      {/* 6. DRAWERS & MODALS (at the bottom of the component) */}
    </div>
  );
};

export default MyPage;
```

---

## Stat Card Color Themes

| Theme     | `color` (bottom bar)                     | `bgColor`           | `textColor`            |
| --------- | ---------------------------------------- | ------------------- | ---------------------- |
| Primary   | `from-primary-color to-secondary-color`  | `bg-primary-pale`   | `text-primary-color`   |
| Secondary | `from-secondary-color to-secondary-dark` | `bg-secondary-pale` | `text-secondary-color` |
| Success   | `from-emerald-400 to-emerald-600`        | `bg-emerald-100`    | `text-emerald-600`     |
| Warning   | `from-orange-400 to-orange-600`          | `bg-orange-100`     | `text-orange-600`      |
| Amber     | `from-amber-400 to-amber-600`            | `bg-amber-100`      | `text-amber-600`       |
| Rose      | `from-rose-400 to-rose-600`              | `bg-rose-100`       | `text-rose-600`        |

---

## Header Icon Gradient

Always use `var(--gradient-primary)` via inline style on the `w-10 h-10` container:

```jsx
<div
  className="inline-flex items-center justify-center w-10 h-10 rounded-xl shadow-md"
  style={{ background: "var(--gradient-primary)" }}
>
  <LucideIcon className="w-5 h-5 text-white" />
</div>
```

---

## Filter Panel — Select Filter Template

```jsx
<div>
  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
    Label
  </label>
  <Select
    value={filterValue || undefined}
    onChange={setFilterValue}
    placeholder="All items"
    allowClear
    className="w-full"
    size="middle"
    options={[
      { value: "Option1", label: "Option 1" },
      { value: "Option2", label: "Option 2" },
    ]}
  />
</div>
```

---

## Filter Panel — Grid Sizing

| Filters (incl. search + clear) | Grid classes                                               |
| ------------------------------ | ---------------------------------------------------------- |
| 3–4 items                      | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`                |
| 5–6 items                      | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6` |

---

## Table Column Patterns

```jsx
// ID — monospace, muted
{ title: "ID", render: (id) => <span className="font-mono text-sm font-semibold text-text-muted">{id}</span> }

// Primary + sub-text stacked
{
  title: "Name",
  render: (_, r) => (
    <div className="min-w-0">
      <div className="font-semibold text-text-dark truncate">{r.name}</div>
      <div className="text-xs text-text-secondary mt-0.5">{r.subtitle}</div>
    </div>
  ),
}

// Status tag (plain)
{ title: "Status", render: (s) => <Tag color={s === "Active" ? "success" : "default"}>{s}</Tag> }

// Status tag (with icon) — icons come from lucide-react; the icon + label stay
// on one line automatically (see "Tags with icons" gotcha below).
{
  title: "Status",
  render: (status) => {
    const cfg = {
      Active:    { icon: CheckCircle, color: "success" },
      Inactive:  { icon: XCircle,     color: "default" },
      Suspended: { icon: AlertCircle, color: "warning" },
      Pending:   { icon: Clock,       color: "processing" },
    }[status] || { icon: XCircle, color: "default" };
    const Icon = cfg.icon;
    return (
      <Tag icon={<Icon className="w-3 h-3" />} color={cfg.color}>
        {status}
      </Tag>
    );
  },
}

// Actions dropdown
{
  title: "Actions", key: "actions", fixed: "right", width: 80,
  render: (_, r) => (
    <Dropdown menu={{ items: getActionItems(r) }} trigger={["click"]}>
      <Button type="text" icon={<MoreVertical className="w-4 h-4" />} className="hover:bg-gray-100" />
    </Dropdown>
  ),
}
```

### Gotcha — Tags with icons (icon stacks above the label)

Tailwind's Preflight sets `svg { display: block }`. Because an Ant `<Tag>` is `inline-block`, a block-level icon drops onto its own line and the label wraps underneath it.

**You do not need to fix this per tag.** `src/index.css` lays every `.ant-tag` out as a centered inline row (`display: inline-flex; align-items: center; gap: 4px`), so `<Tag icon={...}>Label</Tag>` always renders on one line. Just use the `icon` prop with a lucide icon as shown above — do **not** add per-tag flex/`whitespace-nowrap` workarounds, and do not remove the global rule.

---

## Drawer Pattern

```jsx
<Drawer
  title={
    <div className="flex items-center gap-3">
      <div
        className="p-2.5 rounded-xl"
        style={{ background: "var(--gradient-primary)" }}
      >
        <LucideIcon className="w-5 h-5 text-white" />
      </div>
      <div>
        <h2
          className="text-lg font-bold"
          style={{ color: "var(--color-text-dark)" }}
        >
          Drawer Title
        </h2>
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Drawer subtitle
        </p>
      </div>
    </div>
  }
  placement="right"
  onClose={handleClose}
  open={isOpen}
  width={720}
  styles={{ body: { paddingBottom: 0 } }}
  footer={null}
>
  {/* Content */}
</Drawer>
```

**Drawer width guidelines:**

| Content type          | Width |
| --------------------- | ----- |
| Standard form         | 720   |
| Wide content / tables | 1000  |

---

## Section Cards (non-table content)

```jsx
<Card
  title={
    <div className="flex items-center gap-2">
      <LucideIcon className="w-5 h-5 text-primary-color" />
      <span>Section Title</span>
    </div>
  }
  className="shadow-lg border-0"
>
  {/* content */}
</Card>
```

---

## Typography

| Element       | Code                                                                             |
| ------------- | -------------------------------------------------------------------------------- |
| Page title    | `<Title level={2} className="mb-1! flex items-center gap-3">`                    |
| Section title | `<Title level={4}>` or `<span>` inside Card `title` prop                         |
| Body          | `<Text>` (Ant Design)                                                            |
| Subtitle      | `<Text className="text-sm" style={{ color: "var(--color-text-secondary)" }}>`    |
| Stat value    | `<p className="text-3xl font-bold" style={{ color: "var(--color-text-dark)" }}>` |
| Meta / label  | `<p className="text-xs" style={{ color: "var(--color-text-muted)" }}>`           |

---

## Spacing & Sizing Cheatsheet

| Thing                  | Value                  |
| ---------------------- | ---------------------- |
| Page padding           | `p-6`                  |
| Section gap            | `space-y-5`            |
| Grid gutter            | `gutter={[16, 16]}`    |
| Header icon container  | `w-10 h-10 rounded-xl` |
| Header icon            | `w-5 h-5`              |
| Stat card icon box     | `p-3 rounded-xl`       |
| Card title icon        | `w-5 h-5`              |
| List item icon         | `w-4 h-4`              |
| Action dropdown icon   | `w-4 h-4`              |
| Item row corners       | `rounded-xl`           |
| Card / wrapper corners | `rounded-2xl`          |
| Drawer icon container  | `p-2.5 rounded-xl`     |

---

## Color Usage Rules

**Always use CSS variables for colors in inline styles:**

```jsx
// ✅ Correct
style={{ color: "var(--color-primary-color)" }}
style={{ background: "var(--gradient-primary)" }}
style={{ borderColor: "var(--color-primary-color)" }}

// ❌ Wrong — never hardcode hex
style={{ color: "#3b82f6" }}
style={{ background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)" }}
```

**For Tailwind classes, use your `@theme` custom colors:**

```jsx
// ✅ Correct — references @theme variables
className = "text-primary-color";
className = "bg-primary-pale";
className = "border-primary-color";

// ❌ Avoid when possible — hardcoded Tailwind palette
className = "text-blue-600";
className = "bg-blue-50";
```

**Box shadow with theme color:**

```jsx
style={{
  boxShadow: "0 4px 12px color-mix(in srgb, var(--color-primary-color) 35%, transparent)",
}}
```

---

## Button Style Reference

| Button type       | Style                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Primary action    | `style={{ background: "var(--gradient-primary)", border: "none", boxShadow: "0 4px 12px color-mix(in srgb, var(--color-primary-color) 35%, transparent)" }}` |
| Refresh / outline | `style={{ borderColor: "var(--color-primary-color)", color: "var(--color-primary-color)" }}`                                                                 |
| Filter active     | `style={{ borderColor: "var(--color-primary-color)", color: "var(--color-primary-color)", background: "var(--color-primary-pale)" }}`                        |
| Danger / delete   | Use Ant Design `danger` prop on `<Button>`                                                                                                                   |

---

## Table Box Shadow

Always use the theme-aware shadow token on the table wrapper (it deepens automatically in dark mode):

```jsx
style={{ boxShadow: "var(--shadow-raised)" }}
```

---

## Permission-Gated UI Pattern

Wrap write-only actions with a permission check:

```jsx
{
  canWrite && (
    <Button
      type="primary"
      icon={<PlusOutlined />}
      onClick={handleCreate}
      style={{
        background: "var(--gradient-primary)",
        border: "none",
        boxShadow:
          "0 4px 12px color-mix(in srgb, var(--color-primary-color) 35%, transparent)",
      }}
    >
      Add Item
    </Button>
  );
}
```

Apply to: Header "Add" button, Bulk delete button, Empty state "Add First" button, Row selection (`rowSelection={canWrite ? rowSelection : null}`).

---

## Error State Pattern

Always handle error state with an early return before the main layout:

```jsx
if (error) {
  return (
    <div className="p-6">
      <Alert
        message="Error Loading Data"
        description={error.message || "Failed to load data. Please try again."}
        type="error"
        showIcon
      />
    </div>
  );
}
```
