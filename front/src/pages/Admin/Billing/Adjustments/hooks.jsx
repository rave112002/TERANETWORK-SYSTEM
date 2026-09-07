import { useCallback, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import dayjs from "dayjs";

import RowActions from "../../../../components/RowActions";
import { usePermissions } from "../../../../hooks/usePermissions";
import {
  useDeleteAdjustment,
  useGetAdjustments,
} from "../../../../services/requests/admin/billing";
import { confirm } from "../../../../store/confirmStore";
import { decodeHTML } from "../../../../utils/decode-html";
import { formatPeso } from "../../../../utils/currency";

/**
 * Adjustments — credits, discounts and one-off charges waiting for an invoice.
 *
 * ── Why they are a queue rather than an edit ────────────────────────────────
 *
 * A customer complaining on the 20th is complaining about an invoice already
 * issued and already in their inbox. Editing that document would leave their
 * copy and ours disagreeing. So the correction is recorded here and lands on
 * the next invoice as its own line, with its own description, on a document
 * that has never said anything else.
 */
export const ADJUSTMENT_KIND = {
  credit: { label: "Credit", reducesBill: true },
  discount: { label: "Discount", reducesBill: true },
  debit: { label: "Charge", reducesBill: false },
  reconnection_fee: { label: "Reconnection fee", reducesBill: false },
  install_fee: { label: "Installation fee", reducesBill: false },
};

export const useAdjustmentsData = () => {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("billing", "adjustments", "write");

  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  // Defaults to what is still waiting. The applied ones are history; the open
  // ones are the reason somebody opened this screen.
  const [filters, setFilters] = useState({ search: "", kind: "", applied: "open" });

  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, isLoading, isFetching, error, refetch } = useGetAdjustments({
    page: pagination.current,
    pageSize: pagination.pageSize,
    search: filters.search,
    kind: filters.kind,
    applied: filters.applied,
  });

  const deleteMutation = useDeleteAdjustment();

  const handleTableChange = useCallback((next) => {
    setPagination({ current: next.current, pageSize: next.pageSize });
  }, []);

  const handleSearch = useCallback((value) => {
    setFilters((prev) => ({ ...prev, search: value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ search: "", kind: "", applied: "open" });
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleCreate = useCallback(() => setDrawerOpen(true), []);
  const handleDrawerClose = useCallback(() => setDrawerOpen(false), []);

  const handleDeleteRequest = useCallback(
    async (record) => {
      const ok = await confirm({
        title: "Remove this adjustment?",
        description: `"${decodeHTML(record.description)}" (${formatPeso(record.amount)}) will not appear on any invoice.`,
        confirmText: "Remove",
        cancelText: "Keep it",
        danger: true,
      });
      if (ok) deleteMutation.mutate(record.pendingChargeId);
    },
    [deleteMutation]
  );

  const getActionItems = useCallback(
    (record) => {
      // Only while it is still unapplied. Once it is a line on an invoice the
      // customer has, removing it here would change what they were charged
      // without changing the document that says so.
      if (!canWrite || record.appliedInvoiceId) return [];

      return [
        {
          key: "delete",
          label: "Remove",
          icon: <Trash2 className="w-4 h-4" />,
          danger: true,
          onClick: () => handleDeleteRequest(record),
        },
      ];
    },
    [canWrite, handleDeleteRequest]
  );

  const columns = useMemo(
    () => [
      {
        title: "Customer",
        key: "customer",
        ellipsis: true,
        render: (_, record) => (
          <div className="min-w-0">
            <div
              className="truncate"
              style={{ fontSize: 13.5, color: "var(--color-text-dark)" }}
            >
              {decodeHTML(record.customerName) || "—"}
            </div>
            <div className="truncate" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {record.accountNo}
            </div>
          </div>
        ),
      },
      {
        title: "Adjustment",
        key: "description",
        ellipsis: true,
        render: (_, record) => (
          <div className="min-w-0">
            <div
              className="truncate"
              style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
            >
              {decodeHTML(record.description)}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {ADJUSTMENT_KIND[record.kind]?.label ?? record.kind}
              {record.createdByName ? ` · ${decodeHTML(record.createdByName)}` : ""}
            </div>
          </div>
        ),
      },
      {
        title: "Amount",
        dataIndex: "amount",
        key: "amount",
        width: 140,
        align: "right",
        render: (amount) => (
          <span
            className="font-mono"
            style={{
              fontSize: 13,
              // Green for anything that reduces the bill. The sign is already
              // on the number; the colour is so it reads at a glance.
              color: Number(amount) < 0 ? "var(--color-success)" : "var(--color-text-dark)",
            }}
          >
            {formatPeso(amount)}
          </span>
        ),
      },
      {
        title: "Applied",
        key: "applied",
        width: 190,
        render: (_, record) =>
          record.appliedInvoiceId ? (
            <div className="min-w-0">
              <div className="font-mono truncate" style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
                {record.appliedInvoiceNo}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {record.appliedAt ? dayjs(record.appliedAt).format("MMM D, YYYY") : ""}
              </div>
            </div>
          ) : (
            <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
              on the next invoice
            </span>
          ),
      },
      {
        title: "",
        key: "actions",
        width: 60,
        align: "right",
        render: (_, record) => {
          const items = getActionItems(record);
          return items.length > 0 ? <RowActions items={items} /> : null;
        },
      },
    ],
    [getActionItems]
  );

  return {
    data: data?.data?.adjustments || [],
    pagination: { ...pagination, total: data?.data?.pagination?.total || 0 },
    filters,
    isLoading,
    isFetching,
    error,
    refetch,
    canWrite,
    columns,
    handleTableChange,
    handleSearch,
    handleFilterChange,
    handleClearFilters,
    drawerOpen,
    handleCreate,
    handleDrawerClose,
  };
};
