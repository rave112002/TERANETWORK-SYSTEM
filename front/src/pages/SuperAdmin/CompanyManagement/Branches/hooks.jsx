import { useCallback, useMemo, useState } from "react";
import { confirm } from "../../../../store/confirmStore";
import { Eye, Pencil, Trash2 } from "lucide-react";
import RowActions from "../../../../components/RowActions";
import { useDebounce } from "../../../../hooks/useDebounce";
import { decodeHTML } from "../../../../utils/decode-html";
import {
  useGetBranches,
  useDeleteBranch,
} from "../../../../services/requests/superadmin/branches";
import { useGetCompanies } from "../../../../services/requests/superadmin/companies";
import { formatPhoneDisplay } from "../../../../utils/phoneFormat";

export const useBranchHooks = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ─── Drawer / modal state ─────────────────────────────────────────
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [viewingBranch, setViewingBranch] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");

  const debouncedSearch = useDebounce(search, 500);

  const {
    data: apiData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetBranches({
    page: currentPage,
    pageSize,
    search: debouncedSearch,
    status: statusFilter || undefined,
    companyId: companyFilter || undefined,
  });

  const deleteMutation = useDeleteBranch();

  // Get companies for filter
  const { data: orgsData } = useGetCompanies({ pageSize: 100 });

  const orgOptions = useMemo(() => {
    if (!orgsData?.data?.data) return [];
    return orgsData.data.data.map((org) => ({
      value: org.companyId,
      label: org.name,
    }));
  }, [orgsData]);

  const transformedData = useMemo(() => {
    if (!apiData?.data?.data) return { branches: [], pagination: {} };

    const branches = apiData.data.data.map((branch) => ({
      branchId: branch.branchId,
      companyId: branch.companyId,
      name: branch.name,
      email: branch.email,
      phone: branch.phone,
      address: branch.address,
      isMainBranch: branch.isMainBranch,
      status: branch.status,
      dateCreated: branch.dateCreated,
      companyName: branch.companyName,
    }));

    return {
      branches,
      pagination: apiData.data.pagination || {},
    };
  }, [apiData]);

  // ─── Handlers ─────────────────────────────────────────────────────
  const handleView = useCallback((record) => {
    setViewingBranch(record);
    setIsViewModalOpen(true);
  }, []);

  const handleCloseView = useCallback(() => {
    setIsViewModalOpen(false);
    setViewingBranch(null);
  }, []);

  const handleEdit = useCallback((record) => {
    setEditingBranch(record);
  }, []);

  // View → Edit: close the detail modal and hand the record to the form drawer.
  const handleEditFromView = useCallback((record) => {
    setIsViewModalOpen(false);
    setViewingBranch(null);
    setEditingBranch(record);
  }, []);

  const handleDelete = useCallback(
    async (record) => {
      await deleteMutation.mutateAsync(record.branchId);
    },
    [deleteMutation],
  );

  // Destructive action gets an explicit confirm step.
  const handleDeleteRequest = useCallback(
    async (record) => {
      const ok = await confirm({
        title: "Delete branch",
        description: `Delete "${decodeHTML(record.name)}"? This can't be undone.`,
        confirmText: "Delete",
        cancelText: "Cancel",
        danger: true,
      });
      if (ok) handleDelete(record);
    },
    [handleDelete],
  );

  const handleOpenCreateDrawer = useCallback(() => {
    setIsCreateDrawerOpen(true);
  }, []);

  const handleCloseCreateDrawer = useCallback(() => {
    setIsCreateDrawerOpen(false);
    refetch?.();
  }, [refetch]);

  const handleCloseEditDrawer = useCallback(() => {
    setEditingBranch(null);
    refetch?.();
  }, [refetch]);

  // ⋮ menu: primary action, Edit, divider, Delete (danger).
  // The main branch can't be deleted.
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
        label: "Edit branch",
        icon: <Pencil className="w-4 h-4" />,
        onClick: () => handleEdit(record),
      },
      { type: "divider" },
      {
        key: "delete",
        label: "Delete branch",
        icon: <Trash2 className="w-4 h-4" />,
        danger: true,
        onClick: () => handleDeleteRequest(record),
        disabled: record.isMainBranch,
      },
    ],
    [handleView, handleEdit, handleDeleteRequest],
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
        title: "Branch name",
        key: "name",
        render: (_, record) => {
          const label = decodeHTML(record.name) || "";
          const initial = (label.trim().charAt(0) || "?").toUpperCase();
          const address = decodeHTML(record.address);
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
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
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
                  {record.isMainBranch ? (
                    <span
                      className="shrink-0"
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        lineHeight: 1.6,
                        padding: "0 6px",
                        borderRadius: 5,
                        border: "1px solid var(--color-line)",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      MAIN
                    </span>
                  ) : null}
                </div>
                <div
                  className="truncate"
                  style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
                >
                  {address || "—"}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        title: "Company",
        dataIndex: "companyName",
        key: "companyName",
        width: 180,
        ellipsis: true,
        render: (text) => (
          <span
            style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
          >
            {decodeHTML(text) || "—"}
          </span>
        ),
      },
      {
        title: "Contact",
        key: "contact",
        width: 200,
        render: (_, record) => (
          <div className="min-w-0">
            <div
              className="truncate"
              style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
            >
              {decodeHTML(record.email) || "—"}
            </div>
            <div
              className="truncate"
              style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
            >
              {formatPhoneDisplay(decodeHTML(record.phone)) || "—"}
            </div>
          </div>
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
    [getActionItems, currentPage, pageSize],
  );

  const handleTableChange = useCallback((pagination) => {
    setCurrentPage(pagination.current);
    setPageSize(pagination.pageSize);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("");
    setCompanyFilter("");
    setCurrentPage(1);
  }, []);

  const isSearching = search !== debouncedSearch;

  return {
    data: transformedData,
    isLoading,
    isFetching,
    error,
    refetch,
    columns,
    pagination: {
      current: currentPage,
      pageSize,
      total: transformedData.pagination?.total || 0,
    },
    currentPage,
    pageSize,
    handleTableChange,

    // Create / edit drawer
    isCreateDrawerOpen,
    handleOpenCreateDrawer,
    handleCloseCreateDrawer,
    editingBranch,
    handleCloseEditDrawer,

    // View modal
    viewingBranch,
    isViewModalOpen,
    handleCloseView,
    handleEditFromView,

    // Filters
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    companyFilter,
    setCompanyFilter,
    handleClearFilters,
    isSearching,
    orgOptions,
  };
};
