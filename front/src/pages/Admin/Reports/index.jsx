import { CircleAlert, Download } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { REPORTS, useReportsData } from "./hooks";
import PageHeader from "../../../components/PageHeader";
import StatCard from "../../../components/StatCard";
import RefreshButton from "../../../components/RefreshButton";
import DataTable from "../../../components/DataTable";
import { formatPeso } from "../../../utils/currency";

const ReportsPage = () => {
  const {
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
    rowKey,
    isLoading,
    isFetching,
    error,
    refetch,
    handleExport,
  } = useReportsData();

  const meta = REPORTS.find((r) => r.key === report);

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading the report</AlertTitle>
          <AlertDescription>
            {error.response?.data?.message || error.message || "Failed to load."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isEmpty = !isLoading && rows.length === 0;

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="Reports"
        subtitle={meta.subtitle}
        actions={
          <Button onClick={handleExport} disabled={isEmpty}>
            <Download />
            Export CSV
          </Button>
        }
      />

      {/* Headline figures, computed by the database over the whole report —
          not summed from the rows on screen. */}
      {report === "aging" && totals && (
        // Three across, not six: a peso value plus a caption does not fit in a
        // sixth of the width, and at six columns the captions were clipped
        // mid-word and spilling past the card border.
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <StatCard
            title="Total owed"
            value={formatPeso(totals.totalOwed, "₱0.00")}
            change={`${totals.customers} customer${totals.customers === 1 ? "" : "s"}`}
          />
          <StatCard title="Current" value={formatPeso(totals.current, "₱0.00")} change="not yet due" />
          {/* The bucket cards carry no caption: their titles already say what
              they are, and "late" under all four was noise. */}
          <StatCard title="1–30 days late" value={formatPeso(totals.days1to30, "₱0.00")} />
          <StatCard title="31–60 days late" value={formatPeso(totals.days31to60, "₱0.00")} />
          <StatCard title="61–90 days late" value={formatPeso(totals.days61to90, "₱0.00")} />
          <StatCard title="90+ days late" value={formatPeso(totals.days90plus, "₱0.00")} />
        </div>
      )}

      {report === "collections" && totals && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <StatCard
            title="Collected"
            value={formatPeso(totals.collected, "₱0.00")}
            change={`${totals.payments} payment${totals.payments === 1 ? "" : "s"}`}
          />
          {/* How the money arrived — what decides whether a gateway's fees are
              worth the volume going through it. */}
          {byChannel.slice(0, 3).map((c) => (
            <StatCard
              key={c.channel}
              title={c.channel}
              value={formatPeso(c.collected, "₱0.00")}
              change={`${c.payments} payment${c.payments === 1 ? "" : "s"}`}
            />
          ))}
        </div>
      )}

      {report === "subscribers" && totals && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <StatCard title="Subscriptions" value={totals.subscriptions} change="matching this filter" />
          <StatCard
            title="Monthly recurring"
            value={formatPeso(totals.monthlyRecurring, "₱0.00")}
            change="active subscriptions only"
          />
        </div>
      )}

      <div
        className="bg-surface overflow-hidden"
        style={{
          border: "1px solid var(--color-line)",
          borderRadius: "var(--radius-card)",
        }}
      >
        <div
          className="flex items-center justify-between gap-3 flex-wrap px-4.5 py-3.5"
          style={{ borderBottom: "1px solid var(--color-line)" }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            {REPORTS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setReport(r.key)}
                className="h-8 px-3 text-[13px] cursor-pointer transition-colors"
                style={{
                  borderRadius: 8,
                  border: "1px solid var(--color-line)",
                  background:
                    report === r.key ? "var(--color-surface-sunken)" : "transparent",
                  color:
                    report === r.key
                      ? "var(--color-text-dark)"
                      : "var(--color-text-secondary)",
                  fontWeight: report === r.key ? 600 : 400,
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-3 flex-wrap">
            {report === "collections" && (
              <>
                <Input
                  type="date"
                  className="h-9 w-40"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
                <Input
                  type="date"
                  className="h-9 w-40"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </>
            )}

            {report === "subscribers" && (
              <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
                <SelectTrigger className="h-9 w-44">
                  <SelectValue placeholder="Any status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            )}

            <RefreshButton onRefresh={refetch} isFetching={isFetching} />
          </div>
        </div>

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>
              {report === "aging"
                ? "Nobody owes anything"
                : report === "collections"
                  ? "No payments in this period"
                  : "No subscriptions match this filter"}
            </p>
            {report === "aging" && (
              <p style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
                Which is the answer you want.
              </p>
            )}
          </div>
        ) : (
          <DataTable
            dataSource={rows}
            columns={columns}
            rowKey={rowKey}
            loading={isLoading}
            scroll={{ x: 1000 }}
          />
        )}
      </div>

      {/* Reports are not paginated: they are meant to be read whole and
          exported whole, and a page-at-a-time export is not a report. */}
      {!isEmpty && (
        <p className="m-0" style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
          Showing all {rows.length} {meta.noun}
          {rows.length === 1 ? "" : "s"}. Export gives you exactly these rows.
        </p>
      )}
    </div>
  );
};

export default ReportsPage;
