import { Button, Dropdown, Tag, Avatar, Badge } from "antd";
import { useCallback, useMemo, useState } from "react";
import { useDebounce } from "../../../hooks/useDebounce";
import {
  Building2,
  MapPin,
  Users,
  CheckCircle,
  XCircle,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Clock,
  AlertCircle,
} from "lucide-react";
import {
  useGetOrganizations,
  useDeleteOrganization,
} from "../../../services/requests/superadmin/organizations";
import { formatAddressByCode } from "../../../utils/address";
import { getImageUrl } from "../../../utils/upload";

export const useOrganizationHooks = () => {
  // State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [editingOrganization, setEditingOrganization] = useState(null);
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [viewingOrganization, setViewingOrganization] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Filter state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [subscriptionFilter, setSubscriptionFilter] = useState("");

  // Debounced search to prevent excessive API calls
  const debouncedSearch = useDebounce(search, 500);

  // API calls
  const {
    data: apiData,
    isLoading,
    error,
    refetch,
  } = useGetOrganizations({
    page: currentPage,
    pageSize,
    search: debouncedSearch,
    status: statusFilter,
    subscriptionPlan: subscriptionFilter,
  });

  // Mutations
  const deleteOrganizationMutation = useDeleteOrganization();

  // Transform API data to match component structure
  const transformedData = useMemo(() => {
    if (!apiData?.data?.data) return { organizations: [], pagination: {} };

    const organizations = apiData.data.data.map((org) => ({
      id: org.brandId,
      name: org.name,
      logo: org.logoUrl ? getImageUrl(org.logoUrl) : null,
      address: formatAddressByCode({
        address1: org.address,
        brgy: org.brgyCode,
        city: org.citymunCode,
        province: org.provCode,
        region: org.regCode,
        zipCode: org.zipCode,
      }),
      email: org.email,
      phone: org.phone,
      website: org.website,
      branches: org.branchCount || 0,
      staff: org.staff || 0,
      status: org.status,
      subscriptionPlan: org.subscriptionPlan,
      createdAt: org.dateCreated,
      // Keep original data for editing
      brandId: org.brandId,
      regCode: org.regCode,
      provCode: org.provCode,
      citymunCode: org.citymunCode,
      brgyCode: org.brgyCode,
      zipCode: org.zipCode,
    }));

    return {
      organizations,
      pagination: apiData.data.pagination || {},
    };
  }, [apiData]);

  // Action handlers
  const handleView = useCallback((record) => {
    setViewingOrganization(record);
    setIsViewModalVisible(true);
  }, []);

  const handleEdit = useCallback((record) => {
    setEditingOrganization(record);
  }, []);

  const handleDelete = useCallback(
    async (record) => {
      try {
        await deleteOrganizationMutation.mutateAsync(record.id);
        setSelectedRowKeys((prev) => prev.filter((key) => key !== record.id));
      } catch (err) {
        console.error("Delete error:", err);
      }
    },
    [deleteOrganizationMutation],
  );

  const handleBulkDelete = useCallback(async () => {
    try {
      for (const id of selectedRowKeys) {
        await deleteOrganizationMutation.mutateAsync(id);
      }
      setSelectedRowKeys([]);
    } catch (err) {
      console.error("Bulk delete error:", err);
    }
  }, [selectedRowKeys, deleteOrganizationMutation]);

  // Modal handlers
  const handleCloseEditModal = useCallback(() => {
    setEditingOrganization(null);
    refetch();
  }, [refetch]);

  const handleViewModalCancel = useCallback(() => {
    setIsViewModalVisible(false);
    setViewingOrganization(null);
  }, []);

  const handleOpenCreateModal = useCallback(() => {
    setIsCreateModalOpen(true);
  }, []);

  const handleCloseCreateModal = useCallback(() => {
    setIsCreateModalOpen(false);
    refetch();
  }, [refetch]);

  // Dropdown menu items for actions
  const getActionItems = useCallback(
    (record) => [
      {
        key: "view",
        label: "View Details",
        icon: <Eye className="w-4 h-4" />,
        onClick: () => handleView(record),
      },
      {
        key: "edit",
        label: "Edit Organization",
        icon: <Edit className="w-4 h-4" />,
        onClick: () => handleEdit(record),
      },
      {
        type: "divider",
      },
      {
        key: "delete",
        label: "Delete Organization",
        icon: <Trash2 className="w-4 h-4" />,
        danger: true,
        onClick: () => handleDelete(record),
      },
    ],
    [handleView, handleEdit, handleDelete],
  );

  // Columns with optimized rendering
  const columns = useMemo(
    () => [
      {
        title: "Organization",
        dataIndex: "name",
        key: "name",
        fixed: "left",
        width: 300,
        render: (text, record) => (
          <div className="flex items-center gap-3">
            <Avatar
              src={record.logo}
              size={40}
              className="shrink-0"
              icon={<Building2 className="w-5 h-5" />}
            />
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 truncate">{text}</div>
              <div className="text-sm text-gray-500 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span className="truncate">{record.address}</span>
              </div>
            </div>
          </div>
        ),
      },
      {
        title: "Contact",
        dataIndex: "email",
        key: "email",
        width: 200,
        render: (text, record) => (
          <div>
            <div className="font-medium text-gray-900">{text}</div>
            <div className="text-sm text-gray-500">{record.phone}</div>
          </div>
        ),
      },
      {
        title: "Branches",
        dataIndex: "branches",
        key: "branches",
        width: 100,
        align: "center",
        render: (count) => (
          <Badge
            count={count}
            showZero
            style={{
              backgroundColor: "#9333ea",
            }}
          />
        ),
      },
      {
        title: "Staff",
        dataIndex: "staff",
        key: "staff",
        width: 100,
        align: "center",
        render: (count) => (
          <div className="flex items-center justify-center gap-1">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="font-medium">{count}</span>
          </div>
        ),
      },
      {
        title: "Subscription",
        dataIndex: "subscriptionPlan",
        key: "subscriptionPlan",
        width: 120,
        render: (plan) => {
          if (!plan) return <Tag>None</Tag>;
          const colors = {
            Basic: "default",
            Standard: "blue",
            Premium: "purple",
            Enterprise: "gold",
          };
          return <Tag color={colors[plan]}>{plan}</Tag>;
        },
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 120,
        render: (status) => {
          const statusConfig = {
            Active: { icon: CheckCircle, color: "success", text: "Active" },
            Inactive: { icon: XCircle, color: "default", text: "Inactive" },
            Suspended: {
              icon: AlertCircle,
              color: "warning",
              text: "Suspended",
            },
            Pending: { icon: Clock, color: "processing", text: "Pending" },
          };
          const config = statusConfig[status] || statusConfig.Inactive;
          const Icon = config.icon;

          return (
            <Tag icon={<Icon className="w-3 h-3" />} color={config.color}>
              {config.text}
            </Tag>
          );
        },
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
  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  // Pagination handlers
  const handleTableChange = useCallback((pagination) => {
    setCurrentPage(pagination.current);
    setPageSize(pagination.pageSize);
  }, []);

  // Filter handlers
  const handleClearFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("");
    setSubscriptionFilter("");
    setCurrentPage(1);
  }, []);

  // Check if search is being debounced
  const isSearching = search !== debouncedSearch;

  return {
    // Data
    data: transformedData,
    isLoading,
    error,
    refetch,

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

    // Modal states
    editingOrganization,
    handleCloseEditModal,
    isViewModalVisible,
    viewingOrganization,
    handleViewModalCancel,
    isCreateModalOpen,
    handleOpenCreateModal,
    handleCloseCreateModal,

    // Filter state
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    subscriptionFilter,
    setSubscriptionFilter,
    handleClearFilters,
    isSearching,
  };
};
