# Frontend templates — steps 7–12

Placeholders from SKILL.md Step 1. Examples use `Product` / `Products` / `productId`.
Relative-import depth (`../../../../`) depends on nesting — count it from the actual file, or use
the `@/` alias for cross-tree imports.

---

## 7. API service `front/src/services/api/{{portal-lower}}/{{entities}}.js`

Raw axios only — no hooks, no state, **no try/catch** (errors must reach React Query).

```js
import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.admin);

export const get{{Entities}}Api = async (params = {}) => {
  const { data } = await api.get("{{apiBase}}", { params });
  return data;
};

export const get{{Entity}}ByIdApi = async ({{entityId}}) => {
  const { data } = await api.get(`{{apiBase}}/${{{entityId}}}`);
  return data;
};

export const create{{Entity}}Api = async ({{entity}}Data) => {
  const { data } = await api.post("{{apiBase}}", {{entity}}Data);
  return data;
};

export const update{{Entity}}Api = async ({{entityId}}, {{entity}}Data) => {
  const { data } = await api.put(`{{apiBase}}/${{{entityId}}}`, {{entity}}Data);
  return data;
};

export const delete{{Entity}}Api = async ({{entityId}}) => {
  const { data } = await api.delete(`{{apiBase}}/${{{entityId}}}`);
  return data;
};
```

`userTypeAuth.superadmin` for the SuperAdmin portal. If the module uploads files, also create
`const apiMultipart = createAxiosInstanceWithInterceptor("multipart", userTypeAuth.admin)` and
pick per call with `data instanceof FormData` — never set `Content-Type` by hand.

---

## 8. React Query hooks `front/src/services/requests/{{portal-lower}}/{{entities}}.js`

Mirrors the `api/` folder structure. Toasts and invalidation live here, not in components.

```js
import { toast } from "sonner";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  get{{Entities}}Api,
  get{{Entity}}ByIdApi,
  create{{Entity}}Api,
  update{{Entity}}Api,
  delete{{Entity}}Api,
} from "../../api/admin/{{entities}}";

export const useGet{{Entities}} = (filters = {}) =>
  useQuery({
    queryKey: ["{{entities}}", filters],
    queryFn: () => get{{Entities}}Api(filters),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData, // keep rows visible while paginating/filtering
  });

export const useGet{{Entity}}ById = ({{entityId}}) =>
  useQuery({
    queryKey: ["{{entities}}", {{entityId}}],
    queryFn: () => get{{Entity}}ByIdApi({{entityId}}),
    enabled: !!{{entityId}},
    staleTime: 10 * 60 * 1000,
  });

export const useCreate{{Entity}} = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: create{{Entity}}Api,
    onSuccess: () => {
      toast.success("{{Entity}} created successfully");
      queryClient.invalidateQueries({ queryKey: ["{{entities}}"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to create {{entity}}");
    },
  });
};

export const useUpdate{{Entity}} = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ {{entityId}}, {{entity}}Data }) => update{{Entity}}Api({{entityId}}, {{entity}}Data),
    onSuccess: (data, variables) => {
      toast.success("{{Entity}} updated successfully");
      queryClient.invalidateQueries({ queryKey: ["{{entities}}"] });
      queryClient.invalidateQueries({ queryKey: ["{{entities}}", variables.{{entityId}}] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to update {{entity}}");
    },
  });
};

export const useDelete{{Entity}} = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: delete{{Entity}}Api,
    onSuccess: () => {
      toast.success("{{Entity}} deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["{{entities}}"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to delete {{entity}}");
    },
  });
};
```

Invalidate only what changed. Never invalidate `["userPermissions"]` broadly.

---

## 9. Page hooks `front/src/pages/{{portal}}/{{Entities}}/hooks.jsx`

One named hook per file holding **all** state, columns, and handlers. `index.jsx` gets a flat
return shape and keeps zero `useState` except the filter-panel toggle.

```jsx
import { useState, useCallback, useMemo } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import RowActions from "../../../components/RowActions";
import { useDebounce } from "../../../hooks/useDebounce";
import { usePermissions } from "../../../hooks/usePermissions";
import { decodeHTML } from "../../../utils/decode-html";
import { formatPhoneDisplay } from "../../../utils/phoneFormat";
import { confirm } from "../../../store/confirmStore";
import {
  useGet{{Entities}},
  useDelete{{Entity}},
} from "../../../services/requests/admin/{{entities}}";

export const use{{Entity}}Hooks = () => {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("{{module}}", null, "write");

  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [filters, setFilters] = useState({ search: "", status: "" });
  const debouncedSearch = useDebounce(filters.search, 500);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected{{Entity}}, setSelected{{Entity}}] = useState(null);

  const { data: apiData, isLoading, isFetching, error, refetch } = useGet{{Entities}}({
    page: pagination.current,
    pageSize: pagination.pageSize,
    search: debouncedSearch,
    status: filters.status,
  });

  const deleteMutation = useDelete{{Entity}}();

  // ─── Handlers ──────────────────────────────────────────────────────
  const handleTableChange = useCallback((next) => {
    setPagination({ current: next.current, pageSize: next.pageSize });
  }, []);

  const handleSearch = useCallback((value) => {
    setFilters((prev) => ({ ...prev, search: value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleStatusFilter = useCallback((value) => {
    setFilters((prev) => ({ ...prev, status: value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ search: "", status: "" });
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleCreate = useCallback(() => {
    setSelected{{Entity}}(null);
    setDrawerOpen(true);
  }, []);

  const handleEdit = useCallback((record) => {
    setSelected{{Entity}}(record);
    setDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    setSelected{{Entity}}(null);
  }, []);

  // Destructive actions get an explicit confirm step.
  const handleDeleteRequest = useCallback(
    async (record) => {
      const ok = await confirm({
        title: "Delete {{entity}}",
        description: `Delete "${record.name}"? This can't be undone.`,
        confirmText: "Delete",
        cancelText: "Cancel",
        danger: true,
      });
      if (ok) deleteMutation.mutate(record.{{entityId}});
    },
    [deleteMutation],
  );

  // ⋮ menu: primary action, Edit, divider, Delete (danger)
  const getActionItems = useCallback(
    (record) => {
      if (!canWrite || record.status === "Deleted") return [];
      return [
        {
          key: "edit",
          label: "Edit {{entity}}",
          icon: <Pencil className="w-4 h-4" />,
          onClick: () => handleEdit(record),
        },
        { type: "divider" },
        {
          key: "delete",
          label: "Delete {{entity}}",
          icon: <Trash2 className="w-4 h-4" />,
          danger: true,
          onClick: () => handleDeleteRequest(record),
        },
      ];
    },
    [canWrite, handleEdit, handleDeleteRequest],
  );

  // # (mono) · initial-avatar + name · secondary text · status dot · ⋮
  const columns = useMemo(
    () => [
      {
        title: "#",
        key: "index",
        width: 56,
        render: (_, __, index) => (
          <span className="font-mono" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            {String((pagination.current - 1) * pagination.pageSize + index + 1).padStart(2, "0")}
          </span>
        ),
      },
      {
        title: "{{Entity}} name",
        dataIndex: "name",
        key: "name",
        render: (name) => {
          const label = decodeHTML(name) || "";
          const initial = (label.trim().charAt(0) || "?").toUpperCase();
          return (
            <div className="flex items-center gap-3 min-w-0">
              <span
                style={{
                  width: 30, height: 30, borderRadius: 8, flex: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 600,
                  background: "var(--color-surface-sunken)",
                  border: "1px solid var(--color-line)",
                  color: "var(--color-text-secondary)",
                }}
              >
                {initial}
              </span>
              <span
                className="truncate"
                style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-dark)" }}
              >
                {label}
              </span>
            </div>
          );
        },
      },
      {
        title: "Phone",
        dataIndex: "phone",
        key: "phone",
        width: 160,
        render: (phone) => (
          <span style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
            {formatPhoneDisplay(phone) || "-"}
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
                  width: 7, height: 7, borderRadius: "50%",
                  background: active ? "var(--color-success)" : "var(--color-text-muted)",
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
        render: (_, record) => <RowActions items={getActionItems(record)} />,
      },
    ],
    [getActionItems, pagination],
  );

  const statCards = useMemo(
    () => [
      {
        title: "Total {{entities}}",
        value: apiData?.data?.pagination?.total || 0,
        change: "all time",
        icon: <{{Icon}} className="w-4.25 h-4.25" strokeWidth={1.8} />,
      },
      // …two more — 3 equal columns…
    ],
    [apiData],
  );

  return {
    // apiData = { success, message, data: { {{entities}}, pagination } }
    data: apiData?.data?.{{entities}} || [],
    pagination: { ...pagination, total: apiData?.data?.pagination?.total || 0 },
    filters,
    isLoading,
    isFetching,
    error,
    refetch,
    canWrite,
    columns,
    statCards,
    handleTableChange,
    handleSearch,
    handleStatusFilter,
    handleClearFilters,
    drawerOpen,
    selected{{Entity}},
    handleCreate,
    handleDrawerClose,
  };
};
```

Two `.data` hops: axios's, then the backend envelope's. `apiData?.data` alone is the wrapper
object, not the array. SuperAdmin pages skip `usePermissions`/`canWrite` entirely.

---

## 10. Form drawer `front/src/pages/{{portal}}/{{Entities}}/components/{{Entity}}FormDrawer.jsx`

**The form file owns the `<Sheet>`. The parent is dumb.** Props are exactly
`{ open, onClose, onSuccess, entity? }` — `entity` presence flips edit mode internally.

```jsx
import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Plus, X, {{Icon}} } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import SectionLabel from "../../../../components/SectionLabel";
import StatusToggle from "../../../../components/StatusToggle";
import {
  PHONE_MAX_LENGTH, PHONE_PLACEHOLDER, formatPhoneOnChange, zPhone,
} from "../../../../utils/phoneFormat";
import {
  useCreate{{Entity}},
  useUpdate{{Entity}},
} from "../../../../services/requests/admin/{{entities}}";

// Required-ness mirrors the DB: `description` is TEXT NULL, so validate shape,
// not presence — empty passes, typed text must meet the length rule.
const {{entity}}Schema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Name must be at least 3 characters")
    .max(100, "Name must not exceed 100 characters"),
  description: z
    .string()
    .max(500, "Description must not exceed 500 characters")
    .refine((v) => v === "" || v.length >= 10, "Description must be at least 10 characters"),
  phone: zPhone,
  status: z.enum(["Active", "Inactive"]),
});

const EMPTY = { name: "", description: "", phone: "", status: "Active" };

const {{Entity}}FormDrawer = ({ open, onClose, onSuccess, entity = null }) => {
  const isEditMode = !!entity;
  const req = <span style={{ color: "var(--color-error)" }}>*</span>;

  const form = useForm({ resolver: zodResolver({{entity}}Schema), defaultValues: EMPTY });
  const { formState: { isDirty } } = form;

  // Hydrate on open; map fields explicitly (API responses carry extra keys).
  // form.reset() sets the baseline the dirty check diffs against.
  useEffect(() => {
    if (!open) return;
    form.reset(
      entity
        ? {
            name: entity.name ?? "",
            description: entity.description ?? "",
            phone: entity.phone ?? "",
            status: entity.status ?? "Active",
          }
        : EMPTY,
    );
  }, [open, entity, form]);

  const createMutation = useCreate{{Entity}}();
  const updateMutation = useUpdate{{Entity}}();

  const isPending = createMutation.isPending || updateMutation.isPending;
  const saveDisabled = isEditMode && !isDirty; // create mode: validation gates it

  const handleClose = () => {
    form.reset(EMPTY);
    onClose();
  };

  // RHF runs validation first and focuses the first invalid field itself.
  const onSubmit = async (values) => {
    // Map explicitly; empty optionals become null where the API expects it.
    const payload = {
      name: values.name,
      description: values.description || null,
      phone: values.phone || null,
      status: values.status,
    };
    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({
          {{entityId}}: entity.{{entityId}},
          {{entity}}Data: payload,
        });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onSuccess?.();
    } catch (error) {
      // the mutation's onError already surfaced a toast
      console.error("Form submission error:", error);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 p-0 sm:max-w-200"
        style={{ background: "var(--color-surface)" }}
      >
        <SheetTitle className="sr-only">
          {isEditMode ? "Edit {{Entity}}" : "Create New {{Entity}}"}
        </SheetTitle>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            autoComplete="off"
            className="flex h-full flex-col"
          >
            <div className="flex-1 overflow-y-auto p-6">
              {/* Header — accent chip + title + subtitle + bordered X */}
              <div className="flex items-start justify-between gap-3 mb-7">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
                    <{{Icon}} className="w-5.5 h-5.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      className="m-0 font-semibold leading-tight"
                      style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                    >
                      {isEditMode ? "Edit {{Entity}}" : "Create New {{Entity}}"}
                    </h2>
                    <p
                      className="m-0 mt-0.5"
                      style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                    >
                      {isEditMode ? "Update {{entity}} information" : "Add a new {{entity}}"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close"
                  className="inline-flex items-center justify-center shrink-0 transition-colors hover:bg-(--color-surface-sunken)"
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    border: "1px solid var(--color-line)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <SectionLabel>{{Entity}} details</SectionLabel>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>{{Entity}} name {req}</FormLabel>
                    {/* icon-prefix: the relative wrapper sits OUTSIDE FormControl so the
                        id/aria wiring lands on the <input>, not the wrapper div */}
                    <div className="relative">
                      <{{Icon}}
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                        style={{ color: "var(--color-text-muted)" }}
                      />
                      <FormControl>
                        <Input placeholder="e.g., …" className="h-10 pl-9" {...field} />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={4}
                        maxLength={500}
                        placeholder="Describe this {{entity}}"
                        className="min-h-24 resize-none"
                        {...field}
                      />
                    </FormControl>
                    <div className="flex items-center justify-between gap-3">
                      <FormMessage />
                      <span
                        className="ml-auto shrink-0 text-xs"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {field.value?.length || 0}/500
                      </span>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={PHONE_PLACEHOLDER}
                        className="h-10"
                        maxLength={PHONE_MAX_LENGTH}
                        {...field}
                        onChange={(e) => field.onChange(formatPhoneOnChange(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="mt-7">
                <SectionLabel>Status</SectionLabel>
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status {req}</FormLabel>
                      {/* custom control — no FormControl wrapper */}
                      <StatusToggle value={field.value} onChange={field.onChange} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Footer — inside the <form>, so the primary is type="submit" */}
            <div
              className="flex justify-end gap-3 p-6 pt-5"
              style={{
                borderTop: "1px solid var(--color-line)",
                paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
              }}
            >
              <Button type="button" variant="outline" size="lg" onClick={handleClose}>
                Cancel
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* span keeps the tooltip alive while the button is disabled */}
                  <span className="inline-flex">
                    <Button type="submit" size="lg" disabled={saveDisabled || isPending}>
                      {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                      {isEditMode ? "Update {{Entity}}" : "Create {{Entity}}"}
                    </Button>
                  </span>
                </TooltipTrigger>
                {saveDisabled && <TooltipContent>No changes to save yet</TooltipContent>}
              </Tooltip>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default {{Entity}}FormDrawer;
```

Field variants: `Select` → bind `value={field.value || undefined}` + `onValueChange={field.onChange}`
with `SelectTrigger className="h-10 w-full"` (Radix rejects empty `SelectItem` values — use an
`"all"` sentinel mapped to `""`). Passwords → `PasswordInput` + `zStrongPassword(8)` from
`utils/validation`, wrapped in `{!isEditMode && …}` with a `useMemo`'d schema so the field is only
validated in create mode. Identifier fields (email/username) get `disabled={isEditMode}`. Very
short forms (1–2 sections) may swap `<Sheet>` for `<Dialog className="sm:max-w-130">` and be
named `{{Entity}}FormModal`.

---

## 11. Page `front/src/pages/{{portal}}/{{Entities}}/index.jsx`

Presentational only: `PageHeader` → stat cards → one bordered table card (toolbar, optional filter
row, `DataTable`, `PaginationFooter`) → drawers. Root is `p-8 space-y-5`.

```jsx
import { useState } from "react";
import { CircleAlert, Filter, Plus, {{Icon}} } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { use{{Entity}}Hooks } from "./hooks";
import {{Entity}}FormDrawer from "./components/{{Entity}}FormDrawer";
import PageHeader from "../../../components/PageHeader";
import PaginationFooter from "../../../components/PaginationFooter";
import StatCard from "../../../components/StatCard";
import RefreshButton from "../../../components/RefreshButton";
import SearchInput from "../../../components/SearchInput";
import DataTable from "../../../components/DataTable";

const {{Entities}}Page = () => {
  const {
    data, pagination, filters, isLoading, isFetching, error, refetch,
    canWrite, columns, statCards,
    handleTableChange, handleSearch, handleStatusFilter, handleClearFilters,
    drawerOpen, selected{{Entity}}, handleCreate, handleDrawerClose,
  } = use{{Entity}}Hooks();

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const hasActiveFilters = Boolean(filters.search || filters.status);
  const isEmpty = !isLoading && (data?.length || 0) === 0;

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading {{entities}}</AlertTitle>
          <AlertDescription>
            {error.message || "Failed to load {{entities}} data. Please try again."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="{{Entities}}"
        subtitle="<one line on what this module manages>"
        actions={
          canWrite && (
            <Button onClick={handleCreate}>
              <Plus />
              New {{entity}}
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {statCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      <div
        className="bg-surface overflow-hidden"
        style={{ border: "1px solid var(--color-line)", borderRadius: "var(--radius-card)" }}
      >
        {/* Toolbar — inside the card, never a floating action bar */}
        <div
          className="flex items-center justify-between gap-3 flex-wrap px-4.5 py-3.5"
          style={{ borderBottom: "1px solid var(--color-line)" }}
        >
          <SearchInput
            value={filters.search}
            onChange={handleSearch}
            placeholder="Filter {{entities}}…"
          />
          <div className="flex items-center gap-2">
            <RefreshButton onRefresh={refetch} isFetching={isFetching} />
            <Button
              variant={isFilterVisible || hasActiveFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setIsFilterVisible(!isFilterVisible)}
            >
              <Filter />
              Filters
            </Button>
          </div>
        </div>

        {isFilterVisible && (
          <div
            className="flex items-end gap-3 flex-wrap px-4.5 py-3.5"
            style={{ borderBottom: "1px solid var(--color-line)" }}
          >
            <div className="flex flex-col gap-1.5">
              <span
                className="uppercase"
                style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
                  color: "var(--color-text-muted)",
                }}
              >
                Status
              </span>
              {/* "all" sentinel — Radix SelectItem values can't be empty strings */}
              <Select
                value={filters.status || "all"}
                onValueChange={(v) => handleStatusFilter(v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-10 w-50">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Deleted">Deleted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="h-8 text-[13px] cursor-pointer hover:underline"
                style={{ color: "var(--color-link)" }}
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <p style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>
              No {{entities}} found
            </p>
            {canWrite && (
              <Button onClick={handleCreate}>
                <Plus />
                New {{entity}}
              </Button>
            )}
          </div>
        ) : (
          <>
            <DataTable
              dataSource={data}
              columns={columns}
              rowKey="{{entityId}}"
              loading={isLoading}
              scroll={{ x: 900 }}
            />
            <PaginationFooter
              pagination={pagination}
              onChange={handleTableChange}
              noun="{{entity}}"
            />
          </>
        )}
      </div>

      <{{Entity}}FormDrawer
        open={drawerOpen}
        entity={selected{{Entity}}}
        onClose={handleDrawerClose}
        onSuccess={handleDrawerClose}
      />
    </div>
  );
};

export default {{Entities}}Page;
```

Irregular plurals need `nounPlural` on `PaginationFooter` (`noun="company" nounPlural="companies"`).

---

## 12. Route registration `front/src/routes/pageRoutes/{{portal}}Route.jsx`

**A page that isn't registered here is unreachable.** The `navigations` array drives both the
sidebar and the routes.

```jsx
// 1. lazy import, with the others at the top
const {{Entities}} = lazy(() => import("../../pages/{{portal}}/{{Entities}}"));

// 2. navigation entry — top-level module
{
  route: "{{route}}",
  name: "{{Entities}}",
  label: "{{Entities}}",
  icon: <{{Icon}} className="h-5 w-5" />,
  component: (
    <Suspense fallback={<ComponentLoader />}>
      <ProtectedRoute module="{{module}}" accessLevel="read">
        <{{Entities}} />
      </ProtectedRoute>
    </Suspense>
  ),
  permission: { module: "{{module}}", submodule: null, accessLevel: "read" },
  isFilter: true,
  isShow: true,
}
```

- `accessLevel="read"` for page access — never `"write"`. Write actions are gated by `canWrite`
  inside the page.
- Under an existing parent: add to that entry's `children` with
  `permission: { module, submodule, accessLevel: "read" }`, and add the submodule to the parent's
  `permission.anyOf` array so the parent shows when the user has any child.
- `section: "system"` puts the item below the sidebar divider (Settings, Audit Trail). Omit it
  otherwise.
- The `module`/`submodule` here **must** be the exact strings seeded in step 3 and checked by
  `checkPermission` in the controller. A mismatch is a silent 403.
