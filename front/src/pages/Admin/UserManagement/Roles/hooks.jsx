import { useState, useCallback, useMemo } from "react";
import {
  keepPreviousData,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { Key, Pencil, Trash2 } from "lucide-react";
import RowActions from "../../../../components/RowActions";
import { getRoles, deleteRole } from "../../../../services/api/admin/roles";
import { usePermissions } from "../../../../hooks/usePermissions";
import { decodeHTML } from "../../../../utils/decode-html";
import { confirm } from "../../../../store/confirmStore";

export const useRolesData = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("users", "roles", "write");

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
  });
  const [filters, setFilters] = useState({
    search: "",
    status: "",
  });

  // ─── Drawer/Selection State ────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [permissionsDrawerOpen, setPermissionsDrawerOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);

  // Fetch roles
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["roles", pagination.current, pagination.pageSize, filters],
    queryFn: () =>
      getRoles({
        page: pagination.current,
        pageSize: pagination.pageSize,
        search: filters.search,
        status: filters.status,
      }),
    placeholderData: keepPreviousData, // v5 API; `keepPreviousData: true` was a no-op here
  });

  // Delete role mutation
  const deleteMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      toast.success("Role deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to delete role");
    },
  });

  const handleTableChange = useCallback((newPagination) => {
    setPagination({
      current: newPagination.current,
      pageSize: newPagination.pageSize,
    });
  }, []);

  const handleSearch = useCallback((value) => {
    setFilters((prev) => ({ ...prev, search: value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleStatusFilter = useCallback((value) => {
    setFilters((prev) => ({ ...prev, status: value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleDelete = useCallback(
    (roleId) => {
      deleteMutation.mutate(roleId);
    },
    [deleteMutation],
  );

  const handleClearFilters = useCallback(() => {
    setFilters({ search: "", status: "" });
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  // ─── Drawer Handlers ───────────────────────────────────────────────
  const handleCreate = useCallback(() => {
    setSelectedRole(null);
    setDrawerOpen(true);
  }, []);

  const handleEdit = useCallback((record) => {
    setSelectedRole(record);
    setDrawerOpen(true);
  }, []);

  const handleManagePermissions = useCallback((record) => {
    setSelectedRole(record);
    setPermissionsDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    setSelectedRole(null);
    refetch?.();
  }, [refetch]);

  const handlePermissionsDrawerClose = useCallback(() => {
    setPermissionsDrawerOpen(false);
    setSelectedRole(null);
    refetch?.();
  }, [refetch]);

  // Destructive action gets an explicit confirm step.
  const handleDeleteRequest = useCallback(
    async (record) => {
      const ok = await confirm({
        title: "Delete role",
        description: `Delete "${record.roleName}"? This can't be undone.`,
        confirmText: "Delete",
        cancelText: "Cancel",
        danger: true,
      });
      if (ok) handleDelete(record.roleId);
    },
    [handleDelete],
  );

  // ⋮ menu: primary action, Edit, divider, Delete (danger)
  const getActionItems = useCallback(
    (record) => {
      const items = [];

      if (canWrite) {
        items.push(
          {
            key: "permissions",
            label: "Manage permissions",
            icon: <Key className="w-4 h-4" />,
            onClick: () => handleManagePermissions(record),
          },
          {
            key: "edit",
            label: "Edit role",
            icon: <Pencil className="w-4 h-4" />,
            onClick: () => handleEdit(record),
          },
          { type: "divider" },
          {
            key: "delete",
            label: "Delete role",
            icon: <Trash2 className="w-4 h-4" />,
            danger: true,
            onClick: () => handleDeleteRequest(record),
          },
        );
      }

      return items;
    },
    [canWrite, handleManagePermissions, handleEdit, handleDeleteRequest],
  );

  // # (mono) · initial-avatar + name · secondary text · status dot · ⋮
  const columns = useMemo(
    () => [
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
        sorter: (a, b) => a.roleName.localeCompare(b.roleName),
        render: (name) => {
          const label = decodeHTML(name) || "";
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
          <span
            style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
          >
            {decodeHTML(d)}
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
                  background: active
                    ? "var(--color-success)"
                    : "var(--color-text-muted)",
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

  return {
    data: data?.data?.roles || [],
    pagination: {
      ...pagination,
      total: data?.data?.pagination?.total || 0,
    },
    filters,
    isLoading,
    isFetching,
    error,
    refetch,
    canWrite,
    columns,
    handleTableChange,
    handleSearch,
    handleStatusFilter,
    handleClearFilters,

    // Drawers
    drawerOpen,
    permissionsDrawerOpen,
    selectedRole,
    handleCreate,
    handleDrawerClose,
    handlePermissionsDrawerClose,
  };
};
