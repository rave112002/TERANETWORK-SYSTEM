import { useCallback, useMemo, useState } from "react";
import dayjs from "dayjs";

import { useGetPayments } from "../../../../services/requests/admin/billing";
import { decodeHTML } from "../../../../utils/decode-html";
import { formatPeso } from "../../../../utils/currency";

/**
 * The money that came in.
 *
 * ── Read-only, deliberately ─────────────────────────────────────────────────
 *
 * There is no "record payment" button here and no row actions. A payment is
 * always recorded against a specific invoice, from that invoice — which is what
 * makes the exact-amount check meaningful. A standalone "add payment" form
 * would need the clerk to pick an invoice from a list, and picking the wrong
 * one is both easy and, once the invoice is marked paid, awkward to undo.
 *
 * This screen answers the other question: what was taken, by whom, and when.
 */
export const usePaymentsData = () => {
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [filters, setFilters] = useState({
    search: "",
    channel: "",
    paidFrom: "",
    paidTo: "",
  });

  const { data, isLoading, isFetching, error, refetch } = useGetPayments({
    page: pagination.current,
    pageSize: pagination.pageSize,
    search: filters.search,
    channel: filters.channel,
    paidFrom: filters.paidFrom,
    paidTo: filters.paidTo,
  });

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
    setFilters({ search: "", channel: "", paidFrom: "", paidTo: "" });
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const columns = useMemo(
    () => [
      {
        title: "Received",
        dataIndex: "paidAt",
        key: "paidAt",
        width: 170,
        render: (paidAt) => (
          <div className="min-w-0">
            <div style={{ fontSize: 13.5, color: "var(--color-text-dark)" }}>
              {dayjs(paidAt).format("MMM D, YYYY")}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {dayjs(paidAt).format("HH:mm")}
            </div>
          </div>
        ),
      },
      {
        title: "Customer",
        key: "customer",
        ellipsis: true,
        render: (_, record) => (
          <div className="min-w-0">
            <div
              className="truncate"
              style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
            >
              {decodeHTML(record.customerName) || "—"}
            </div>
            <div
              className="truncate font-mono"
              style={{ fontSize: 12, color: "var(--color-text-muted)" }}
            >
              {record.invoiceNo}
            </div>
          </div>
        ),
      },
      {
        title: "Method",
        key: "channel",
        width: 190,
        render: (_, record) => (
          <div className="min-w-0">
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              {record.channel}
            </div>
            <div className="truncate" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {/* A gateway payment has no staff member behind it, and saying
                  "online" is more honest than leaving the column blank. */}
              {record.xenditPaymentId
                ? "online"
                : decodeHTML(record.recordedByName) || "recorded by hand"}
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
              color: Number(amount) < 0 ? "var(--color-error)" : "var(--color-success)",
            }}
          >
            {formatPeso(amount)}
          </span>
        ),
      },
      {
        title: "Note",
        dataIndex: "notes",
        key: "notes",
        ellipsis: true,
        render: (notes) => (
          <span className="truncate" style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
            {decodeHTML(notes) || "—"}
          </span>
        ),
      },
    ],
    []
  );

  return {
    data: data?.data?.payments || [],
    summary: data?.data?.summary ?? { collected: 0 },
    pagination: { ...pagination, total: data?.data?.pagination?.total || 0 },
    filters,
    isLoading,
    isFetching,
    error,
    refetch,
    columns,
    handleTableChange,
    handleSearch,
    handleFilterChange,
    handleClearFilters,
  };
};
