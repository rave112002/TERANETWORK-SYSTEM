import { useCallback, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import RowActions from "../../../components/RowActions";
import { usePermissions } from "../../../hooks/usePermissions";
import { useDeletePlan, useGetPlans } from "../../../services/requests/admin/plans";
import { confirm } from "../../../store/confirmStore";
import { decodeHTML } from "../../../utils/decode-html";
import { formatPeso, formatSpeed } from "../../../utils/currency";

/**
 * Service plans — the speed/price catalogue.
 *
 * Company-wide rather than branch-scoped (decision D3), so there is no branch
 * filter here: both branches sell the same plans.
 */
export const usePlansData = () => {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("plans", null, "write");

  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [filters, setFilters] = useState({ search: "", status: "" });

  // ─── Drawer/Selection State ────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const { data, isLoading, isFetching, error, refetch } = useGetPlans({
    page: pagination.current,
    pageSize: pagination.pageSize,
    search: filters.search,
    status: filters.status,
  });

  const deleteMutation = useDeletePlan();

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

  const handleClearFilters = useCallback(() => {
    setFilters({ search: "", status: "" });
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  // ─── Drawer Handlers ───────────────────────────────────────────────
  const handleCreate = useCallback(() => {
    setSelectedPlan(null);
    setDrawerOpen(true);
  }, []);

  const handleEdit = useCallback((record) => {
    setSelectedPlan(record);
    setDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    setSelectedPlan(null);
  }, []);

  // Deleting a plan is refused server-side while subscriptions still use it,
  // so the confirm is about intent, not consequences.
  const handleDeleteRequest = useCallback(
    async (record) => {
      const ok = await confirm({
        title: "Delete plan",
        description: `Delete "${decodeHTML(record.name)}"? Subscribers already on this plan must be moved first.`,
        confirmText: "Delete",
        cancelText: "Cancel",
        danger: true,
      });
      if (ok) deleteMutation.mutate(record.planId);
    },
    [deleteMutation],
  );

  const getActionItems = useCallback(
    (record) => {
      if (!canWrite) return [];
      return [
        {
          key: "edit",
          label: "Edit plan",
          icon: <Pencil className="w-4 h-4" />,
          onClick: () => handleEdit(record),
        },
        { type: "divider" },
        {
          key: "delete",
          label: "Delete plan",
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
        title: "Plan",
        key: "plan",
        render: (_, record) => (
          <div className="min-w-0">
            <div
              className="truncate"
              style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-dark)" }}
            >
              {decodeHTML(record.name)}
            </div>
            <div
              className="truncate"
              style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
            >
              {decodeHTML(record.description) || "No description"}
            </div>
          </div>
        ),
      },
      {
        title: "Speed",
        key: "speed",
        width: 150,
        render: (_, record) => (
          <span className="font-mono" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            {formatSpeed(record.downMbps, record.upMbps)}
          </span>
        ),
      },
      {
        title: "Monthly",
        dataIndex: "monthlyPrice",
        key: "monthlyPrice",
        width: 140,
        align: "right",
        sorter: (a, b) => Number(a.monthlyPrice) - Number(b.monthlyPrice),
        render: (price) => (
          <span
            className="font-mono"
            style={{ fontSize: 13.5, fontWeight: 500, color: "var(--color-text-dark)" }}
          >
            {formatPeso(price)}
          </span>
        ),
      },
      {
        title: "Install fee",
        dataIndex: "installFee",
        key: "installFee",
        width: 130,
        align: "right",
        render: (fee) => (
          <span className="font-mono" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            {Number(fee) > 0 ? formatPeso(fee) : "—"}
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
    [getActionItems, pagination],
  );

  return {
    data: data?.data?.plans || [],
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

    // Drawer
    drawerOpen,
    selectedPlan,
    handleCreate,
    handleDrawerClose,
  };
};
