import { useState, useCallback } from "react";
import {
  keepPreviousData,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { message, Button, Dropdown } from "antd";
import { Key, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { getRoles, deleteRole } from "../../../../services/api/admin/roles";
import { usePermissions } from "../../../../hooks/usePermissions";
import { decodeHTML } from "../../../../utils/decode-html";

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

  // Fetch roles
  const { data, isLoading, error, refetch } = useQuery({
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
      message.success("Role deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to delete role");
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

  // ⋮ menu: primary action, Edit, divider, Delete (danger)
  const getActionItems = useCallback(
    (record, onEdit, onManagePermissions, onDelete) => {
      const items = [];

      if (canWrite) {
        items.push(
          {
            key: "permissions",
            label: "Manage permissions",
            icon: <Key className="w-4 h-4" />,
            onClick: () => onManagePermissions(record),
          },
          {
            key: "edit",
            label: "Edit role",
            icon: <Pencil className="w-4 h-4" />,
            onClick: () => onEdit(record),
          },
          { type: "divider" },
          {
            key: "delete",
            label: "Delete role",
            icon: <Trash2 className="w-4 h-4" />,
            danger: true,
            onClick: () => onDelete(record),
          },
        );
      }

      return items;
    },
    [canWrite],
  );

  // # (mono) · initial-avatar + name · secondary text · status dot · ⋮
  const getColumns = useCallback(
    (onEdit, onManagePermissions, onDelete) => [
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
          <span style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
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
        render: (_, record) => (
          <Dropdown
            menu={{
              items: getActionItems(
                record,
                onEdit,
                onManagePermissions,
                onDelete,
              ),
            }}
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

  return {
    data: data?.data?.roles || [],
    pagination: {
      ...pagination,
      total: data?.data?.pagination?.total || 0,
    },
    filters,
    isLoading,
    error,
    refetch,
    canWrite,
    handleTableChange,
    handleSearch,
    handleStatusFilter,
    handleDelete,
    getActionItems,
    getColumns,
  };
};
