import { useCallback, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import RowActions from "../../../components/RowActions";
import { usePermissions } from "../../../hooks/usePermissions";
import {
  useDeleteCustomer,
  useGetCustomers,
} from "../../../services/requests/admin/customers";
import { confirm } from "../../../store/confirmStore";
import { decodeHTML } from "../../../utils/decode-html";
import { formatPhoneDisplay } from "../../../utils/phoneFormat";

/**
 * Subscribers.
 *
 * The list is already restricted server-side to the branches the signed-in user
 * is assigned to. The branch filter here narrows within that — it cannot widen
 * it, so it is a convenience for multi-branch staff, not an access control.
 */
export const useCustomersData = () => {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("customers", null, "write");

  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [filters, setFilters] = useState({ search: "", status: "", branchId: "" });

  // ─── Drawer/Selection State ────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const { data, isLoading, isFetching, error, refetch } = useGetCustomers({
    page: pagination.current,
    pageSize: pagination.pageSize,
    search: filters.search,
    status: filters.status,
    branchId: filters.branchId,
  });

  const deleteMutation = useDeleteCustomer();

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

  const handleBranchFilter = useCallback((value) => {
    setFilters((prev) => ({ ...prev, branchId: value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ search: "", status: "", branchId: "" });
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  // ─── Drawer Handlers ───────────────────────────────────────────────
  const handleCreate = useCallback(() => {
    setSelectedCustomer(null);
    setDrawerOpen(true);
  }, []);

  const handleEdit = useCallback((record) => {
    setSelectedCustomer(record);
    setDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    setSelectedCustomer(null);
  }, []);

  const handleDeleteRequest = useCallback(
    async (record) => {
      const ok = await confirm({
        title: "Delete subscriber",
        description: `Delete ${record.accountNo} — ${decodeHTML(record.name)}? Their invoice history is kept.`,
        confirmText: "Delete",
        cancelText: "Cancel",
        danger: true,
      });
      if (ok) deleteMutation.mutate(record.customerId);
    },
    [deleteMutation],
  );

  const getActionItems = useCallback(
    (record) => {
      if (!canWrite) return [];
      return [
        {
          key: "edit",
          label: "Edit subscriber",
          icon: <Pencil className="w-4 h-4" />,
          onClick: () => handleEdit(record),
        },
        { type: "divider" },
        {
          key: "delete",
          label: "Delete subscriber",
          icon: <Trash2 className="w-4 h-4" />,
          danger: true,
          onClick: () => handleDeleteRequest(record),
        },
      ];
    },
    [canWrite, handleEdit, handleDeleteRequest],
  );

  const columns = useMemo(
    () => [
      {
        title: "Account",
        dataIndex: "accountNo",
        key: "accountNo",
        width: 130,
        // Monospaced because it is an identifier staff read out on the phone.
        render: (accountNo) => (
          <span className="font-mono" style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
            {accountNo}
          </span>
        ),
      },
      {
        title: "Subscriber",
        key: "subscriber",
        render: (_, record) => {
          const name = decodeHTML(record.name) || "";
          const initial = (name.trim().charAt(0) || "?").toUpperCase();
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
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                }}
              >
                {initial}
              </span>
              <div className="min-w-0">
                <div
                  className="truncate"
                  style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-dark)" }}
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
        title: "Branch",
        dataIndex: "branchName",
        key: "branchName",
        width: 180,
        ellipsis: true,
        render: (branchName) => (
          <span style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
            {decodeHTML(branchName) || "—"}
          </span>
        ),
      },
      {
        title: "Phone",
        dataIndex: "phone",
        key: "phone",
        width: 160,
        render: (phone) => (
          <span className="font-mono" style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
            {phone ? formatPhoneDisplay(phone) : "—"}
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
                  background: active ? "var(--color-success)" : "var(--color-text-muted)",
                  boxShadow: active
                    ? "0 0 8px color-mix(in srgb, var(--color-success) 50%, transparent)"
                    : "none",
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
    [getActionItems],
  );

  return {
    data: data?.data?.customers || [],
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
    handleBranchFilter,
    handleClearFilters,

    // Drawer
    drawerOpen,
    selectedCustomer,
    handleCreate,
    handleDrawerClose,
  };
};
