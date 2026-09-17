import { useCallback, useMemo, useState } from "react";
import { Ban, Download, Eye, FileText, HandCoins, Send } from "lucide-react";
import dayjs from "dayjs";

import RowActions from "../../../../components/RowActions";
import { usePermissions } from "../../../../hooks/usePermissions";
import {
  downloadInvoicePdf,
  useGetInvoices,
  useResendInvoice,
} from "../../../../services/requests/admin/billing";
import { decodeHTML } from "../../../../utils/decode-html";
import { formatPeso } from "../../../../utils/currency";

/**
 * Invoice status, and what each one means to the person reading the row.
 *
 * `overdue` is the only one that reads red. It is not a worse kind of `issued`
 * — it is the state that leads to a customer being disconnected, and the whole
 * reason anybody opens this screen before the 2nd of the month.
 */
export const INVOICE_STATUS = {
  draft: { label: "Draft", color: "var(--color-text-muted)" },
  issued: { label: "Issued", color: "var(--color-text-secondary)" },
  paid: { label: "Paid", color: "var(--color-success)" },
  overdue: { label: "Overdue", color: "var(--color-error)" },
  void: { label: "Void", color: "var(--color-text-muted)" },
};

export const useInvoicesData = () => {
  const { hasPermission } = usePermissions();
  const canWriteInvoices = hasPermission("billing", "invoices", "write");
  // Separate from editing an invoice: this is the power to mark money received.
  const canRecordPayment = hasPermission("billing", "payments", "write");
  // And separate again: the power to bill every customer at once.
  const canRunCycle = hasPermission("billing", "cycle", "write");

  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [filters, setFilters] = useState({ search: "", status: "", periodStart: "" });

  const [detailInvoice, setDetailInvoice] = useState(null);
  const [payInvoice, setPayInvoice] = useState(null);
  const [pdfInvoice, setPdfInvoice] = useState(null);
  const [cycleOpen, setCycleOpen] = useState(false);

  const { data, isLoading, isFetching, error, refetch } = useGetInvoices({
    page: pagination.current,
    pageSize: pagination.pageSize,
    search: filters.search,
    status: filters.status,
    periodStart: filters.periodStart,
  });

  const resendMutation = useResendInvoice();

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
    setFilters({ search: "", status: "", periodStart: "" });
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleView = useCallback((record) => setDetailInvoice(record), []);
  const handleCloseDetail = useCallback(() => setDetailInvoice(null), []);
  const handlePay = useCallback((record) => setPayInvoice(record), []);
  const handleClosePay = useCallback(() => setPayInvoice(null), []);
  const handlePreviewPdf = useCallback((record) => setPdfInvoice(record), []);
  const handleClosePdf = useCallback(() => setPdfInvoice(null), []);
  const handleOpenCycle = useCallback(() => setCycleOpen(true), []);
  const handleCloseCycle = useCallback(() => setCycleOpen(false), []);

  const handleDownload = useCallback((record) => {
    downloadInvoicePdf(record.invoiceId, record.invoiceNo);
  }, []);

  const handleResend = useCallback(
    (record) => resendMutation.mutate(record.invoiceId),
    [resendMutation]
  );

  const getActionItems = useCallback(
    (record) => {
      const items = [
        {
          key: "view",
          label: "View invoice",
          icon: <Eye className="w-4 h-4" />,
          onClick: () => handleView(record),
        },
        {
          key: "preview",
          label: "View PDF",
          icon: <FileText className="w-4 h-4" />,
          onClick: () => handlePreviewPdf(record),
        },
        {
          key: "pdf",
          label: "Download PDF",
          icon: <Download className="w-4 h-4" />,
          onClick: () => handleDownload(record),
        },
      ];

      // Offered only where it would do something. "Record payment" on an
      // already-paid invoice is an invitation to take money twice.
      const isOpen = record.status === "issued" || record.status === "overdue";

      if (canRecordPayment && isOpen) {
        items.push({
          key: "pay",
          label: "Record payment",
          icon: <HandCoins className="w-4 h-4" />,
          onClick: () => handlePay(record),
        });
      }

      if (canWriteInvoices && record.status !== "void") {
        items.push({
          key: "resend",
          label: "Email to customer",
          icon: <Send className="w-4 h-4" />,
          onClick: () => handleResend(record),
        });
      }

      if (canWriteInvoices && isOpen) {
        items.push(
          { type: "divider" },
          {
            key: "void",
            label: "Void invoice",
            icon: <Ban className="w-4 h-4" />,
            danger: true,
            // Voiding needs a written reason, so it opens the invoice rather
            // than firing from the menu.
            onClick: () => handleView(record),
          }
        );
      }

      return items;
    },
    [
      canWriteInvoices,
      canRecordPayment,
      handleView,
      handlePreviewPdf,
      handleDownload,
      handlePay,
      handleResend,
    ]
  );

  const columns = useMemo(
    () => [
      {
        title: "Invoice",
        key: "invoice",
        width: 200,
        render: (_, record) => (
          <div className="min-w-0">
            <div
              className="font-mono truncate"
              style={{ fontSize: 13, color: "var(--color-text-dark)" }}
            >
              {record.invoiceNo}
            </div>
            <div className="truncate" style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
              {dayjs(record.billingPeriodStart).format("MMMM YYYY")}
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
            <div className="truncate" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {record.accountNo}
              {record.planName ? ` · ${decodeHTML(record.planName)}` : ""}
            </div>
          </div>
        ),
      },
      {
        title: "Due",
        dataIndex: "dueDate",
        key: "dueDate",
        width: 140,
        render: (dueDate, record) => {
          // Days remaining matter only while payment is still expected — on a
          // paid invoice it is noise, and on a void one it is misleading.
          const open = record.status === "issued" || record.status === "overdue";
          const days = dayjs(dueDate).diff(dayjs().startOf("day"), "day");

          return (
            <div className="min-w-0">
              <div style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
                {dayjs(dueDate).format("MMM D, YYYY")}
              </div>
              {open && (
                <div
                  style={{
                    fontSize: 12,
                    color: days < 0 ? "var(--color-error)" : "var(--color-text-muted)",
                  }}
                >
                  {days < 0
                    ? `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} late`
                    : days === 0
                      ? "due today"
                      : `in ${days} day${days === 1 ? "" : "s"}`}
                </div>
              )}
            </div>
          );
        },
      },
      {
        title: "Amount",
        dataIndex: "total",
        key: "total",
        width: 140,
        align: "right",
        render: (total, record) => (
          <span
            className="font-mono"
            style={{
              fontSize: 13,
              color: "var(--color-text-dark)",
              textDecoration: record.status === "void" ? "line-through" : "none",
            }}
          >
            {formatPeso(total)}
          </span>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 130,
        render: (status) => {
          const meta = INVOICE_STATUS[status] ?? INVOICE_STATUS.issued;
          return (
            <span
              className="inline-flex items-center gap-2"
              style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
            >
              <span
                style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color }}
              />
              {meta.label}
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
    [getActionItems]
  );

  const summary = data?.data?.summary ?? { outstanding: 0, overdue: 0, collected: 0 };

  return {
    data: data?.data?.invoices || [],
    summary,
    pagination: { ...pagination, total: data?.data?.pagination?.total || 0 },
    filters,
    isLoading,
    isFetching,
    error,
    refetch,
    canWriteInvoices,
    canRecordPayment,
    canRunCycle,
    columns,
    handleTableChange,
    handleSearch,
    handleFilterChange,
    handleClearFilters,
    detailInvoice,
    handleCloseDetail,
    payInvoice,
    handlePay,
    handleClosePay,
    pdfInvoice,
    handlePreviewPdf,
    handleClosePdf,
    cycleOpen,
    handleOpenCycle,
    handleCloseCycle,
  };
};
