# Table Page Hooks Pattern

When creating or editing a `hooks.jsx` file for any table/list page, follow this pattern exactly.

---

## Purpose

Every table page module has a `hooks.jsx` that exports a single custom hook. This hook encapsulates **all** logic: API calls, table columns, pagination, filters, row selection, drawer/modal state, and action handlers. The `index.jsx` page is purely presentational — it calls the hook and renders.

---

## File location

```
src/pages/[Portal]/[Module]/hooks.jsx
src/pages/[Portal]/[Module]/[SubModule]/hooks.jsx
```

---

## Naming convention

| Module        | Hook name              |
| ------------- | ---------------------- |
| Users         | `useUserHooks`         |
| Roles         | `useRolesData`         |
| Dashboard     | `useDashboardHooks`    |
| Companies | `useCompanyHooks` |

Pattern: `use[Entity]Hooks` or `use[Entity]Data`. Pick one per project — `useXHooks` is preferred.

---

## Complete structure

```jsx
import { useState, useCallback, useMemo } from "react";
import { Button, Dropdown, Tag, Avatar } from "antd";
import { MoreVertical, Edit, Trash2, Eye } from "lucide-react";
import { useDebounce } from "../../../../hooks/useDebounce";
import { usePermissions } from "../../../../hooks/usePermissions";
import {
  useGetItems,
  useDeleteItem,
} from "../../../../services/requests/admin/items";

export const useItemHooks = () => {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("module_name", "submodule", "write");

  // ─── Pagination State ──────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ─── Filter State ──────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  // Add more filters as needed

  const debouncedSearch = useDebounce(search, 500);

  // ─── Row Selection ─────────────────────────────────────────────────
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // ─── Drawer/Modal State ────────────────────────────────────────────
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // ─── API Hooks ─────────────────────────────────────────────────────
  const { data, isLoading, error, refetch, isFetching } = useGetItems({
    page: currentPage,
    limit: pageSize,
    search: debouncedSearch,
    status: statusFilter,
  });

  const deleteItemMutation = useDeleteItem();

  // ─── Action Handlers ───────────────────────────────────────────────
  const handleEdit = useCallback((record) => {
    setEditingItem(record);
  }, []);

  const handleDelete = useCallback(
    async (record) => {
      try {
        await deleteItemMutation.mutateAsync(record.id);
        setSelectedRowKeys((prev) => prev.filter((key) => key !== record.id));
      } catch (err) {
        console.error("Delete error:", err);
      }
    },
    [deleteItemMutation],
  );

  const handleBulkDelete = useCallback(async () => {
    try {
      await Promise.all(
        selectedRowKeys.map((id) => deleteItemMutation.mutateAsync(id)),
      );
      setSelectedRowKeys([]);
    } catch (err) {
      console.error("Bulk delete error:", err);
    }
  }, [selectedRowKeys, deleteItemMutation]);

  // ─── Drawer Handlers ───────────────────────────────────────────────
  const handleOpenCreateDrawer = useCallback(() => {
    setIsCreateDrawerOpen(true);
  }, []);

  const handleCloseCreateDrawer = useCallback(() => {
    setIsCreateDrawerOpen(false);
  }, []);

  const handleCloseEditDrawer = useCallback(() => {
    setEditingItem(null);
  }, []);

  // ─── Table Action Menu ─────────────────────────────────────────────
  const getActionItems = useCallback(
    (record) => [
      {
        key: "view",
        label: "View Details",
        icon: <Eye className="w-4 h-4" />,
        onClick: () => {
          /* handle view */
        },
      },
      {
        key: "edit",
        label: "Edit",
        icon: <Edit className="w-4 h-4" />,
        onClick: () => handleEdit(record),
      },
      { type: "divider" },
      {
        key: "delete",
        label: "Delete",
        icon: <Trash2 className="w-4 h-4" />,
        danger: true,
        onClick: () => handleDelete(record),
      },
    ],
    [handleEdit, handleDelete],
  );

  // ─── Columns ───────────────────────────────────────────────────────
  const columns = useMemo(
    () => [
      {
        title: "Name",
        dataIndex: "name",
        key: "name",
        fixed: "left",
        width: 250,
        render: (text, record) => (
          <div className="min-w-0">
            <div
              className="font-semibold truncate"
              style={{ color: "var(--color-text-primary)" }}
            >
              {record.name}
            </div>
            <div
              className="text-xs truncate"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {record.subtitle}
            </div>
          </div>
        ),
      },
      // ... more columns
      {
        title: "",
        key: "actions",
        fixed: "right",
        width: 60,
        render: (_, record) => (
          <Dropdown
            menu={{ items: getActionItems(record) }}
            trigger={["click"]}
            placement="bottomRight"
          >
            <Button
              type="text"
              icon={<MoreVertical className="w-4 h-4" />}
              className="hover:bg-gray-100"
            />
          </Dropdown>
        ),
      },
    ],
    [getActionItems],
  );

  // ─── Row Selection Config ──────────────────────────────────────────
  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  // ─── Pagination Handler ────────────────────────────────────────────
  const handleTableChange = useCallback((pagination) => {
    setCurrentPage(pagination.current);
    setPageSize(pagination.pageSize);
  }, []);

  // ─── Filter Handlers ───────────────────────────────────────────────
  const handleClearFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("");
    setCurrentPage(1);
  }, []);

  const isSearching = search !== debouncedSearch;

  // ─── Return ────────────────────────────────────────────────────────
  return {
    // Data
    data,
    isLoading,
    isFetching,
    error,
    refetch,

    // Permissions
    canWrite,

    // Columns
    columns,

    // Pagination
    currentPage,
    pageSize,
    handleTableChange,

    // Row selection
    selectedRowKeys,
    rowSelection,
    handleBulkDelete,

    // Drawers
    isCreateDrawerOpen,
    handleOpenCreateDrawer,
    handleCloseCreateDrawer,
    editingItem,
    handleCloseEditDrawer,

    // Filters
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    handleClearFilters,
    isSearching,
  };
};
```

---

## Rules

1. **One hook per file.** Export a single named hook function.
2. **All state lives in the hook.** The `index.jsx` page has zero `useState` calls (except `isFilterVisible` for the filter panel toggle).
3. **Columns are `useMemo`'d.** Depend on `getActionItems` (which is `useCallback`'d).
4. **All handlers are `useCallback`'d.** Include proper dependency arrays.
5. **Use `useDebounce`** for search inputs. Always 500ms delay.
6. **Derive `canWrite`** from `usePermissions` — pass it in the return so the page can gate UI.
7. **Refetch after mutations.** Call `refetch()` in drawer close handlers and after delete.
8. **Action items use Lucide icons** (`w-4 h-4`) — never Ant icons in dropdown menus.
9. **Actions column** is always last, `fixed: "right"`, `width: 60–80`, uses `<Dropdown>` with `<MoreVertical>`.
10. **Return shape** is flat — no nesting except for the raw `data` from React Query.

---

## Stat cards in hooks

For pages with stat cards, define them in the hook and return them:

`StatCard` is flat: `{ title, value, change, icon }`. There are no `color` / `bgColor` /
`textColor` props — the card takes no accent.

```jsx
const statCards = useMemo(
  () => [
    {
      title: "Total items",
      value: data?.pagination?.total || 0,
      change: "all time", // the unit / caption beside the value
      icon: <Package className="w-4.25 h-4.25" strokeWidth={1.8} />,
    },
    // ...
  ],
  [data],
);

return { ...otherStuff, statCards };
```

---

## Dashboard hooks (non-table pages)

For pages without a table (like Dashboard), the hook is simpler — just data fetching and computed values:

```jsx
export const useDashboardHooks = () => {
  const { data: stats, isLoading } = useGetDashboardStats();

  const statCards = useMemo(
    () => [
      /* ... */
    ],
    [stats],
  );

  return { statCards, isLoading };
};
```

---

## Do / Don't

**Do:**

- Wrap columns in `useMemo` and handlers in `useCallback`
- Reset `currentPage` to 1 when filters change
- Clear `selectedRowKeys` after bulk delete
- Use the `useDebounce` hook from `src/hooks/useDebounce.js`
- Include `isSearching` in the return (for the yellow border indicator)

**Don't:**

- Don't put `useState` in `index.jsx` for anything the hook should own
- Don't import React Query hooks directly in `index.jsx` — always go through the page hook
- Don't use inline column definitions in `index.jsx` — define them in the hook
- Don't forget to `refetch()` after drawer close (create or edit)
- Don't use `moment` — always use `dayjs` for date formatting

---

## Permission Gating in Hooks

### Rule: Derive `canWrite` once at the top, return it, use it everywhere

```js
export const useItemHooks = () => {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("module", "submodule", "write");

  // Gate action items
  const getActionItems = (record) => {
    if (!canWrite) return [];
    return [
      { key: "edit", label: "Edit", onClick: () => handleEdit(record) },
      {
        key: "delete",
        label: "Delete",
        danger: true,
        onClick: () => handleDelete(record),
      },
    ];
  };

  // Gate row selection
  const rowSelection = canWrite
    ? { selectedRowKeys, onChange: setSelectedRowKeys }
    : null;

  return { ...otherStuff, canWrite };
};
```

### Rules

1. One permission per page — use the page's own module/submodule for ALL actions
2. `read` = view only. `write` = view + create/edit/delete
3. Never invent permissions that don't exist in the database
4. SuperAdmin pages do NOT use permission gating (full access)
5. The page component uses `canWrite` from the hook to gate buttons: `{canWrite && <Button>Create</Button>}`

---

## Status Filter in Hooks

Every table page with a status column includes "Deleted" in the filter dropdown:

```js
const statusOptions = [
  { label: "All", value: "" }, // Default — hides Deleted
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
  { label: "Suspended", value: "Suspended" },
  { label: "Deleted", value: "Deleted" }, // Shows soft-deleted records
];
```

When "Deleted" is selected, hide action buttons (edit/delete) for those records.
