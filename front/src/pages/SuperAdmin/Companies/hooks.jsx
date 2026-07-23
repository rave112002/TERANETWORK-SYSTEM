import { App, Button, Dropdown } from "antd";
import { useCallback, useMemo, useState } from "react";
import { Eye, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useDebounce } from "../../../hooks/useDebounce";
import {
  useGetCompanies,
  useDeleteCompany,
} from "../../../services/requests/superadmin/companies";
import { getImageUrl } from "../../../utils/upload";
import { decodeHTML } from "../../../utils/decode-html";
import { formatPhoneDisplay } from "../../../utils/phoneFormat";

// Status → dot colour. Everything that isn't live reads as muted.
const STATUS_DOT = {
  Active: "var(--color-success)",
  Pending: "var(--color-warning)",
  Suspended: "var(--color-warning)",
  Inactive: "var(--color-text-muted)",
  Deleted: "var(--color-text-muted)",
};

export const useCompanyHooks = () => {
  const { modal } = App.useApp();

  // State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [editingCompany, setEditingCompany] = useState(null);
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [viewingCompany, setViewingCompany] = useState(null);
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
    isFetching,
    error,
    refetch,
  } = useGetCompanies({
    page: currentPage,
    pageSize,
    search: debouncedSearch,
    status: statusFilter,
    subscriptionPlan: subscriptionFilter,
  });

  // Mutations
  const deleteCompanyMutation = useDeleteCompany();

  // Transform API data to match component structure
  const transformedData = useMemo(() => {
    if (!apiData?.data?.data) return { companies: [], pagination: {} };

    const companies = apiData.data.data.map((org) => ({
      id: org.companyId,
      name: org.name,
      logo: org.logoUrl ? getImageUrl(org.logoUrl) : null,
      // NOTE: companies have no address columns (address/regCode/... live on
      // `branches`), so the old formatAddressByCode() call here always resolved
      // to "" while statically pulling ~6.6 MB of PH reference JSON into this
      // chunk. Address lookups now live behind the async helpers in
      // utils/address.js and load on demand.
      email: org.email,
      phone: org.phone,
      website: org.website,
      branches: org.branchCount || 0,
      staff: org.staff || 0,
      status: org.status,
      subscriptionPlan: org.subscriptionPlan,
      createdAt: org.dateCreated,
      // Keep original data for editing
      companyId: org.companyId,
      regCode: org.regCode,
      provCode: org.provCode,
      citymunCode: org.citymunCode,
      brgyCode: org.brgyCode,
      zipCode: org.zipCode,
    }));

    return {
      companies,
      pagination: apiData.data.pagination || {},
    };
  }, [apiData]);

  // Action handlers
  const handleView = useCallback((record) => {
    setViewingCompany(record);
    setIsViewModalVisible(true);
  }, []);

  const handleEdit = useCallback((record) => {
    setEditingCompany(record);
  }, []);

  const handleDelete = useCallback(
    async (record) => {
      try {
        await deleteCompanyMutation.mutateAsync(record.id);
        setSelectedRowKeys((prev) => prev.filter((key) => key !== record.id));
      } catch (err) {
        console.error("Delete error:", err);
      }
    },
    [deleteCompanyMutation],
  );

  // Destructive action gets an explicit confirm step.
  const handleDeleteRequest = useCallback(
    (record) => {
      modal.confirm({
        title: "Delete company",
        content: `Delete "${decodeHTML(record.name)}"? This can't be undone.`,
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
      for (const id of selectedRowKeys) {
        await deleteCompanyMutation.mutateAsync(id);
      }
      setSelectedRowKeys([]);
    } catch (err) {
      console.error("Bulk delete error:", err);
    }
  }, [selectedRowKeys, deleteCompanyMutation]);

  // Modal handlers
  const handleCloseEditModal = useCallback(() => {
    setEditingCompany(null);
    refetch();
  }, [refetch]);

  const handleViewModalCancel = useCallback(() => {
    setIsViewModalVisible(false);
    setViewingCompany(null);
  }, []);

  // View → Edit: close the detail modal and hand the record to the form drawer.
  const handleEditFromView = useCallback((record) => {
    setIsViewModalVisible(false);
    setViewingCompany(null);
    setEditingCompany(record);
  }, []);

  const handleOpenCreateModal = useCallback(() => {
    setIsCreateModalOpen(true);
  }, []);

  const handleCloseCreateModal = useCallback(() => {
    setIsCreateModalOpen(false);
    refetch();
  }, [refetch]);

  // ⋮ menu: primary action, Edit, divider, Delete (danger)
  const getActionItems = useCallback(
    (record) => [
      {
        key: "view",
        label: "View details",
        icon: <Eye className="w-4 h-4" />,
        onClick: () => handleView(record),
      },
      {
        key: "edit",
        label: "Edit company",
        icon: <Pencil className="w-4 h-4" />,
        onClick: () => handleEdit(record),
      },
      { type: "divider" },
      {
        key: "delete",
        label: "Delete company",
        icon: <Trash2 className="w-4 h-4" />,
        danger: true,
        onClick: () => handleDeleteRequest(record),
      },
    ],
    [handleView, handleEdit, handleDeleteRequest],
  );

  // # (mono) · logo/initial avatar + name · secondary text · status dot · ⋮
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
        title: "Company",
        dataIndex: "name",
        key: "name",
        width: 280,
        render: (text, record) => {
          const label = decodeHTML(text) || "";
          const initial = (label.trim().charAt(0) || "?").toUpperCase();
          return (
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="overflow-hidden"
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
                {record.logo ? (
                  <img
                    src={record.logo}
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
                  {label}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        title: "Contact",
        dataIndex: "email",
        key: "email",
        width: 220,
        render: (email, record) => (
          <div className="min-w-0">
            <div
              className="truncate"
              style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
            >
              {email || "-"}
            </div>
            {record.phone && (
              <div
                className="truncate"
                style={{ fontSize: 12, color: "var(--color-text-muted)" }}
              >
                {formatPhoneDisplay(record.phone)}
              </div>
            )}
          </div>
        ),
      },
      {
        title: "Subscription",
        dataIndex: "subscriptionPlan",
        key: "subscriptionPlan",
        width: 130,
        render: (plan) => (
          <span
            style={{
              fontSize: 13,
              color: plan
                ? "var(--color-text-secondary)"
                : "var(--color-text-muted)",
            }}
          >
            {plan || "None"}
          </span>
        ),
      },
      {
        title: "Branches",
        dataIndex: "branches",
        key: "branches",
        width: 100,
        align: "center",
        render: (count) => (
          <span
            className="font-mono"
            style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}
          >
            {count ?? 0}
          </span>
        ),
      },
      {
        title: "Staff",
        dataIndex: "staff",
        key: "staff",
        width: 100,
        align: "center",
        render: (count) => (
          <span
            className="font-mono"
            style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}
          >
            {count ?? 0}
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
                  background: STATUS_DOT[status] || "var(--color-text-muted)",
                  boxShadow: active ? "0 0 8px rgba(34,197,94,.5)" : "none",
                }}
              />
              {status || "Unknown"}
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
    isFetching,
    error,
    refetch,

    // Columns
    columns,

    // Pagination — shape consumed by <PaginationFooter />
    pagination: {
      current: currentPage,
      pageSize,
      total: transformedData.pagination?.total || 0,
    },
    handleTableChange,

    // Row selection
    selectedRowKeys,
    rowSelection,
    handleBulkDelete,

    // Modal states
    editingCompany,
    handleCloseEditModal,
    isViewModalVisible,
    viewingCompany,
    handleViewModalCancel,
    handleEditFromView,
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
