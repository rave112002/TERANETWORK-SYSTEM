import { useCallback, useMemo, useState } from "react";
import dayjs from "dayjs";

import {
  downloadReportCsv,
  useGetAgingReport,
  useGetCollectionsReport,
  useGetSubscriberReport,
} from "../../../services/requests/admin/reports";
import { decodeHTML } from "../../../utils/decode-html";
import { formatPeso } from "../../../utils/currency";

/**
 * The three reports, behind one screen.
 *
 * ── Why one page and not three ──────────────────────────────────────────────
 *
 * They are the same act — "show me the numbers, then give me the file" — and
 * splitting them across three sidebar entries buries the two that get used less
 * often. A tab strip keeps them together and keeps the export button in one
 * place.
 *
 * Only the selected report is fetched. The other two would otherwise run their
 * queries on every visit, and the subscriber roster is the most expensive query
 * in the system.
 */

export const REPORTS = [
  {
    key: "aging",
    label: "Aging",
    title: "Aging",
    subtitle: "Who owes what, and for how long. Bucketed from the due date.",
    noun: "customer",
  },
  {
    key: "collections",
    label: "Collections",
    title: "Collections",
    subtitle: "Money actually received in a period — not what was billed in it.",
    noun: "payment",
  },
  {
    key: "subscribers",
    label: "Subscribers",
    title: "Subscribers",
    subtitle: "The roster, with plan, modem and what each one owes.",
    noun: "subscription",
  },
];

const money = (value) => (
  <span className="font-mono" style={{ fontSize: 13, color: "var(--color-text-dark)" }}>
    {formatPeso(value)}
  </span>
);

/** A bucket cell reads dimmer when it is zero, so the non-zero ones carry. */
const bucket = (value) => {
  const amount = Number(value) || 0;
  return (
    <span
      className="font-mono"
      style={{
        fontSize: 12.5,
        color: amount > 0 ? "var(--color-text-dark)" : "var(--color-text-muted)",
      }}
    >
      {amount > 0 ? formatPeso(amount) : "—"}
    </span>
  );
};

export const useReportsData = () => {
  const [report, setReport] = useState("aging");

  const [from, setFrom] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [status, setStatus] = useState("");

  // Only the visible report runs. `enabled` rather than three unconditional
  // queries: the subscriber roster is the most expensive query here and does
  // not need to run because somebody opened Aging.
  const aging = useGetAgingReport({}, { enabled: report === "aging" });
  const collections = useGetCollectionsReport(
    { from, to },
    { enabled: report === "collections" }
  );
  const subscribers = useGetSubscriberReport(
    status ? { status } : {},
    { enabled: report === "subscribers" }
  );

  const active = { aging, collections, subscribers }[report];

  const handleExport = useCallback(() => {
    const filters =
      report === "collections" ? { from, to } : report === "subscribers" && status ? { status } : {};
    downloadReportCsv(report, filters);
  }, [report, from, to, status]);

  const agingColumns = useMemo(
    () => [
      {
        title: "Customer",
        key: "customer",
        ellipsis: true,
        render: (_, row) => (
          <div className="min-w-0">
            <div className="truncate" style={{ fontSize: 13.5, color: "var(--color-text-dark)" }}>
              {decodeHTML(row.customerName)}
            </div>
            <div className="truncate" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {row.accountNo}
              {row.customerPhone ? ` · ${row.customerPhone}` : ""}
            </div>
          </div>
        ),
      },
      {
        title: "Oldest due",
        key: "oldestDueDate",
        width: 150,
        render: (_, row) => (
          <div className="min-w-0">
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              {dayjs(row.oldestDueDate).format("MMM D, YYYY")}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {/* Negative days past due means not yet due — say that in words
                  rather than showing "-23 days". */}
              {Number(row.daysPastDue) > 0
                ? `${row.daysPastDue} days late`
                : "not due yet"}
            </div>
          </div>
        ),
      },
      { title: "Current", key: "current", width: 120, align: "right", render: (_, r) => bucket(r.current) },
      { title: "1–30", key: "days1to30", width: 110, align: "right", render: (_, r) => bucket(r.days1to30) },
      { title: "31–60", key: "days31to60", width: 110, align: "right", render: (_, r) => bucket(r.days31to60) },
      { title: "61–90", key: "days61to90", width: 110, align: "right", render: (_, r) => bucket(r.days61to90) },
      { title: "90+", key: "days90plus", width: 110, align: "right", render: (_, r) => bucket(r.days90plus) },
      {
        title: "Total owed",
        key: "totalOwed",
        width: 130,
        align: "right",
        render: (_, r) => money(r.totalOwed),
      },
    ],
    []
  );

  const collectionsColumns = useMemo(
    () => [
      {
        title: "Received",
        key: "paidAt",
        width: 160,
        render: (_, row) => (
          <div className="min-w-0">
            <div style={{ fontSize: 13, color: "var(--color-text-dark)" }}>
              {dayjs(row.paidAt).format("MMM D, YYYY")}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {dayjs(row.paidAt).format("HH:mm")}
            </div>
          </div>
        ),
      },
      {
        title: "Customer",
        key: "customer",
        ellipsis: true,
        render: (_, row) => (
          <div className="min-w-0">
            <div className="truncate" style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
              {decodeHTML(row.customerName) || "—"}
            </div>
            <div className="truncate font-mono" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {row.invoiceNo}
            </div>
          </div>
        ),
      },
      {
        title: "Method",
        key: "channel",
        width: 170,
        render: (_, row) => (
          <div className="min-w-0">
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{row.channel}</div>
            <div className="truncate" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {row.provider
                ? `online · ${row.provider}`
                : decodeHTML(row.recordedByName) || "recorded by hand"}
            </div>
          </div>
        ),
      },
      {
        title: "Amount",
        key: "amount",
        width: 140,
        align: "right",
        render: (_, row) => (
          <span className="font-mono" style={{ fontSize: 13, color: "var(--color-success)" }}>
            {formatPeso(row.amount)}
          </span>
        ),
      },
    ],
    []
  );

  const subscriberColumns = useMemo(
    () => [
      {
        title: "Customer",
        key: "customer",
        ellipsis: true,
        render: (_, row) => (
          <div className="min-w-0">
            <div className="truncate" style={{ fontSize: 13.5, color: "var(--color-text-dark)" }}>
              {decodeHTML(row.customerName)}
            </div>
            <div className="truncate" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {row.accountNo}
              {row.branchName ? ` · ${decodeHTML(row.branchName)}` : ""}
            </div>
          </div>
        ),
      },
      {
        title: "Plan",
        key: "plan",
        width: 190,
        render: (_, row) => (
          <div className="min-w-0">
            <div className="truncate" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              {decodeHTML(row.planName)}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {formatPeso(row.monthlyPrice)} · {row.downMbps}/{row.upMbps} Mbps
            </div>
          </div>
        ),
      },
      {
        title: "Service",
        key: "serviceStatus",
        width: 140,
        render: (_, row) => (
          <div className="min-w-0">
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              {row.serviceStatus}
            </div>
            <div className="truncate" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {row.provisioningState ?? "no modem"}
            </div>
          </div>
        ),
      },
      {
        title: "Modem",
        key: "onuMac",
        width: 190,
        render: (_, row) => (
          <div className="min-w-0">
            <div className="font-mono truncate" style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
              {row.onuMac || "—"}
            </div>
            <div className="truncate" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {decodeHTML(row.napLabel) || "not seated"}
            </div>
          </div>
        ),
      },
      {
        title: "Owes",
        key: "amountOwed",
        width: 130,
        align: "right",
        render: (_, row) =>
          Number(row.amountOwed) > 0 ? (
            money(row.amountOwed)
          ) : (
            <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>—</span>
          ),
      },
    ],
    []
  );

  const columns = { aging: agingColumns, collections: collectionsColumns, subscribers: subscriberColumns }[
    report
  ];

  const rows = active?.data?.data?.rows ?? [];
  const totals = active?.data?.data?.totals ?? null;
  const byChannel = collections?.data?.data?.byChannel ?? [];

  return {
    report,
    setReport,
    from,
    setFrom,
    to,
    setTo,
    status,
    setStatus,
    rows,
    totals,
    byChannel,
    columns,
    rowKey: { aging: "customerId", collections: "paymentId", subscribers: "subscriptionId" }[report],
    isLoading: active?.isLoading ?? false,
    isFetching: active?.isFetching ?? false,
    error: active?.error ?? null,
    refetch: active?.refetch ?? (() => {}),
    handleExport,
  };
};
