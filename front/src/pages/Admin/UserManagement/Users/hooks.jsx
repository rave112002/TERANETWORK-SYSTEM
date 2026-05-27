import { useState, useCallback, useMemo } from "react";
import { Button, Dropdown, Tag, Avatar } from "antd";
import { useDebounce } from "../../../../hooks/useDebounce";
import { usePermissions } from "../../../../hooks/usePermissions";
import {
  User,
  Mail,
  Phone,
  MapPin,
  CheckCircle,
  XCircle,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  UserCog,
  Shield,
} from "lucide-react";
import {
  useGetUsers,
  useDeleteUser,
} from "../../../../services/requests/admin/user";

export const useUserHooks = () => {
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

  // Dropdown menu items for actions
  const getActionItems = useCallback(
    (record) => {
      const items = [
        {
          key: "view",
          label: "View Details",
          icon: <Eye className="w-4 h-4" />,
          onClick: () => handleView(record),
        },
      ];

      if (canWrite) {
        items.push(
          {
            key: "edit",
            label: "Edit User",
            icon: <Edit className="w-4 h-4" />,
            onClick: () => handleEdit(record),
          },
          {
            key: "permissions",
            label: "Manage Permissions",
            icon: <UserCog className="w-4 h-4" />,
            onClick: () => handleManagePermissions(record),
          },
          { type: "divider" },
          {
            key: "delete",
            label: "Delete User",
            icon: <Trash2 className="w-4 h-4" />,
            danger: true,
            onClick: () => handleDelete(record),
          },
        );
      }

      return items;
    },
    [canWrite, handleView, handleEdit, handleManagePermissions, handleDelete],
  );

  // Columns with optimized rendering
  const columns = useMemo(
    () => [
      {
        title: "User",
        dataIndex: "firstName",
        key: "user",
        fixed: "left",
        width: 250,
        render: (text, record) => (
          <div className="flex items-center gap-3">
            <Avatar
              src={record.imageUrl}
              size={40}
              className="shrink-0"
              icon={<User className="w-5 h-5" />}
            />
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 truncate">
                {record.firstName} {record.lastName}
              </div>
              <div className="text-sm text-gray-500 flex items-center gap-1">
                <Mail className="w-3 h-3" />
                <span className="truncate">{record.email}</span>
              </div>
            </div>
          </div>
        ),
      },
      {
        title: "Phone",
        dataIndex: "phone",
        key: "phone",
        width: 150,
        render: (phone) => (
          <div className="flex items-center gap-1 text-gray-700">
            <Phone className="w-3 h-3 text-gray-400" />
            <span>{phone || "-"}</span>
          </div>
        ),
      },
      {
        title: "Role",
        dataIndex: "roleName",
        key: "role",
        width: 150,
        render: (roleName) => (
          <div className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-gray-400" />
            <span className="text-gray-700">{roleName || "No Role"}</span>
          </div>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 120,
        render: (status) => (
          <Tag
            icon={
              status === "Active" ? (
                <CheckCircle className="w-3 h-3" />
              ) : (
                <XCircle className="w-3 h-3" />
              )
            }
            color={status === "Active" ? "success" : "default"}
          >
            {status}
          </Tag>
        ),
      },
      {
        title: "Actions",
        key: "actions",
        fixed: "right",
        width: 80,
        render: (_, record) => (
          <Dropdown
            menu={{ items: getActionItems(record) }}
            trigger={["click"]}
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

  // Check if search is being debounced
  const isSearching = search !== debouncedSearch;

  return {
    // Data
    data: {
      users: data?.data?.users || [],
      pagination: data?.data?.pagination || { total: 0, page: 1, pageSize: 10 },
    },
    isLoading,
    error,

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
    statusFilter,
    setStatusFilter,
    handleClearFilters,
    isSearching,
  };
};
