import { useState, useCallback, useMemo } from "react";
import { App, Button, Dropdown } from "antd";
import { Eye, MoreVertical, Pencil, Trash2, UserCog } from "lucide-react";
import { useDebounce } from "../../../../hooks/useDebounce";
import { usePermissions } from "../../../../hooks/usePermissions";
import { decodeHTML } from "../../../../utils/decode-html";
import { formatPhoneDisplay } from "../../../../utils/phoneFormat";
import {
  useGetUsers,
  useDeleteUser,
} from "../../../../services/requests/admin/user";

export const useUserHooks = () => {
  const { modal } = App.useApp();
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("users", "list", "write");

  // State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [isPermissionsDrawerOpen, setIsPermissionsDrawerOpen] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState(null);

  // Filter state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Debounced search
  const debouncedSearch = useDebounce(search, 500);

  // Fetch users from API
  const { data, isLoading, error, refetch } = useGetUsers({
    page: currentPage,
    pageSize,
    search: debouncedSearch,
    status: statusFilter,
  });

  // Delete user mutation
  const deleteUserMutation = useDeleteUser();

  // Action handlers
  const handleView = useCallback((record) => {
    setViewingUser(record);
    setIsViewModalVisible(true);
  }, []);

  const handleEdit = useCallback((record) => {
    setEditingUser(record);
  }, []);

  const handleManagePermissions = useCallback((record) => {
    setPermissionsUser(record);
    setIsPermissionsDrawerOpen(true);
  }, []);

  const handleClosePermissionsDrawer = useCallback(() => {
    setIsPermissionsDrawerOpen(false);
    setPermissionsUser(null);
  }, []);

  const handleDelete = useCallback(
    async (record) => {
      try {
        await deleteUserMutation.mutateAsync(record.accountId);
        setSelectedRowKeys((prev) =>
          prev.filter((key) => key !== record.accountId),
        );
      } catch (err) {
        console.error("Delete error:", err);
      }
    },
    [deleteUserMutation],
  );

  // Destructive action gets an explicit confirm step.
  const handleDeleteRequest = useCallback(
    (record) => {
      const label =
        `${decodeHTML(record.firstName) || ""} ${decodeHTML(record.lastName) || ""}`.trim() ||
        decodeHTML(record.email);
      modal.confirm({
        title: "Delete user",
        content: `Delete "${label}"? This can't be undone.`,
        okText: "Delete",
        okButtonProps: { danger: true },
        cancelText: "Cancel",
        onOk: () => handleDelete(record),
      });
    },
    [modal, handleDelete],
  );

  const handleBulkDelete = useCallback(async () => {
    try {
      await Promise.all(
        selectedRowKeys.map((accountId) =>
          deleteUserMutation.mutateAsync(accountId),
        ),
      );
      setSelectedRowKeys([]);
    } catch (err) {
      console.error("Bulk delete error:", err);
    }
  }, [selectedRowKeys, deleteUserMutation]);

  // Modal/Drawer handlers
  const handleCloseEditDrawer = useCallback(() => {
    setEditingUser(null);
  }, []);

  const handleViewModalCancel = useCallback(() => {
    setIsViewModalVisible(false);
    setViewingUser(null);
  }, []);

  const handleOpenCreateDrawer = useCallback(() => {
    setIsCreateDrawerOpen(true);
  }, []);

  const handleCloseCreateDrawer = useCallback(() => {
    setIsCreateDrawerOpen(false);
  }, []);

  // ⋮ menu: primary action, Edit, divider, Delete (danger)
  const getActionItems = useCallback(
    (record) => {
      const items = [
        {
          key: "view",
          label: "View details",
          icon: <Eye className="w-4 h-4" />,
          onClick: () => handleView(record),
        },
      ];

      if (canWrite) {
        items.push(
          {
            key: "edit",
            label: "Edit user",
            icon: <Pencil className="w-4 h-4" />,
            onClick: () => handleEdit(record),
          },
          {
            key: "permissions",
            label: "Manage permissions",
            icon: <UserCog className="w-4 h-4" />,
            onClick: () => handleManagePermissions(record),
          },
          { type: "divider" },
          {
            key: "delete",
            label: "Delete user",
            icon: <Trash2 className="w-4 h-4" />,
            danger: true,
            onClick: () => handleDeleteRequest(record),
          },
        );
      }

      return items;
    },
    [
      canWrite,
      handleView,
      handleEdit,
      handleManagePermissions,
      handleDeleteRequest,
    ],
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
            {String((currentPage - 1) * pageSize + index + 1).padStart(2, "0")}
          </span>
        ),
      },
      {
        title: "User",
        dataIndex: "firstName",
        key: "user",
        width: 260,
        render: (_, record) => {
          const name = `${decodeHTML(record.firstName) || ""} ${
            decodeHTML(record.lastName) || ""
          }`.trim();
          const initial = (name.charAt(0) || "?").toUpperCase();
          return (
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="overflow-hidden"
                style={{
                  width: 34,
                  height: 34,
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
                {record.imageUrl ? (
                  <img
                    src={record.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                                      width={30}
                    height={30}
                    loading="lazy"
                    decoding="async"
/>
                ) : (
                  initial
                )}
              </span>
              <div className="min-w-0">
                <div
                  className="truncate"
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--color-text-dark)",
                  }}
                >
                  {name}
                </div>
                <div
                  className="truncate"
                  style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
                >
                  {decodeHTML(record.email)}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        title: "Role",
        dataIndex: "roleName",
        key: "role",
        width: 170,
        ellipsis: true,
        render: (roleName) => (
          <span style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
            {decodeHTML(roleName) || "No role"}
          </span>
        ),
      },
      {
        title: "Phone",
        dataIndex: "phone",
        key: "phone",
        width: 150,
        render: (phone) => (
          <span style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
            {formatPhoneDisplay(decodeHTML(phone)) || "-"}
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
            menu={{ items: getActionItems(record) }}
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
    [getActionItems, currentPage, pageSize],
  );

  // Row selection configuration
  const rowSelection = canWrite
    ? { selectedRowKeys, onChange: setSelectedRowKeys }
    : null;

  // Pagination handlers
  const handleTableChange = useCallback((pagination) => {
    setCurrentPage(pagination.current);
    setPageSize(pagination.pageSize);
  }, []);

  // Filter handlers
  const handleClearFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("");
    setCurrentPage(1);
  }, []);

  const handleSearch = useCallback((value) => {
    setSearch(value);
    setCurrentPage(1);
  }, []);

  const handleStatusFilter = useCallback((value) => {
    setStatusFilter(value || "");
    setCurrentPage(1);
  }, []);

  // Check if search is being debounced
  const isSearching = search !== debouncedSearch;

  const users = data?.data?.users || [];

  return {
    // Data
    data: {
      users,
      pagination: data?.data?.pagination || { total: 0, page: 1, pageSize: 10 },
    },
    isLoading,
    error,
    refetch,

    // Permissions
    canWrite,

    // Columns
    columns,

    // Pagination — shaped for <PaginationFooter />
    pagination: {
      current: currentPage,
      pageSize,
      total: data?.data?.pagination?.total || 0,
    },
    handleTableChange,

    // Row selection
    selectedRowKeys,
    rowSelection,
    handleBulkDelete,

    // Drawer/Modal states
    editingUser,
    handleCloseEditDrawer,
    isViewModalVisible,
    viewingUser,
    handleViewModalCancel,
    isCreateDrawerOpen,
    handleOpenCreateDrawer,
    handleCloseCreateDrawer,
    isPermissionsDrawerOpen,
    permissionsUser,
    handleManagePermissions,
    handleClosePermissionsDrawer,

    // Filter state
    search,
    setSearch,
    handleSearch,
    statusFilter,
    setStatusFilter,
    handleStatusFilter,
    handleClearFilters,
    isSearching,
  };
};
