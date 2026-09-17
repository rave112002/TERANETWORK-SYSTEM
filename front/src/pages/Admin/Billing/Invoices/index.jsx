import { useState } from "react";
import { CalendarClock, CircleAlert, CircleDollarSign, Filter, TriangleAlert, Wallet } from "lucide-react";

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

import { useInvoicesData } from "./hooks";
import InvoiceDetailDrawer from "./components/InvoiceDetailDrawer";
import InvoicePdfDrawer from "./components/InvoicePdfDrawer";
import RecordPaymentDrawer from "./components/RecordPaymentDrawer";
import RunCycleDrawer from "./components/RunCycleDrawer";
import PageHeader from "../../../../components/PageHeader";
import PaginationFooter from "../../../../components/PaginationFooter";
import StatCard from "../../../../components/StatCard";
import RefreshButton from "../../../../components/RefreshButton";
import SearchInput from "../../../../components/SearchInput";
import DataTable from "../../../../components/DataTable";
import { formatPeso } from "../../../../utils/currency";

const InvoicesPage = () => {
  const {
    data,
    summary,
    pagination,
    filters,
    isLoading,
    isFetching,
    error,
    refetch,
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
  } = useInvoicesData();

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const hasActiveFilters = Boolean(filters.search || filters.status || filters.periodStart);
  const isEmpty = !isLoading && (data?.length || 0) === 0;

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading invoices</AlertTitle>
          <AlertDescription>
            {error.response?.data?.message || error.message || "Failed to load invoices."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="Invoices"
        subtitle="Statements go out on the 15th and fall due on the 2nd of the following month."
        actions={
          canRunCycle && (
            <Button onClick={handleOpenCycle}>
              <CalendarClock />
              Run billing
            </Button>
          )
        }
      />

      {/* Totals for the whole filtered set, not this page — "what is owed" is
          the question this screen exists to answer. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <StatCard
          title="Outstanding"
          value={formatPeso(summary.outstanding, "₱0.00")}
          change="issued and overdue"
          icon={<Wallet className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Overdue"
          value={formatPeso(summary.overdue, "₱0.00")}
          change="past the due date"
          icon={<TriangleAlert className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Collected"
          value={formatPeso(summary.collected, "₱0.00")}
          change="matching these filters"
          icon={<CircleDollarSign className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
      </div>

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
          <SearchInput
            value={filters.search}
            onChange={handleSearch}
            placeholder="Search invoice no, customer…"
          />
          <div className="flex items-center gap-2">
            <RefreshButton onRefresh={refetch} isFetching={isFetching} />
            <Button
              variant={isFilterVisible || hasActiveFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setIsFilterVisible(!isFilterVisible)}
            >
              <Filter />
              Filters
            </Button>
          </div>
        </div>

        {isFilterVisible && (
          <div
            className="flex items-end gap-3 flex-wrap px-4.5 py-3.5"
            style={{ borderBottom: "1px solid var(--color-line)" }}
          >
            <div className="flex flex-col gap-1.5">
              <span
                className="uppercase"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  color: "var(--color-text-muted)",
                }}
              >
                Status
              </span>
              <Select
                value={filters.status || "all"}
                onValueChange={(v) => handleFilterChange("status", v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-10 w-44">
                  <SelectValue placeholder="Any status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any status</SelectItem>
                  <SelectItem value="issued">Issued</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span
                className="uppercase"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  color: "var(--color-text-muted)",
                }}
              >
                Billing month
              </span>
              {/* A month picker rather than a free date: the period always
                  starts on the 1st, so any other day would find nothing. */}
              <Input
                type="month"
                className="h-10 w-48"
                value={filters.periodStart ? filters.periodStart.slice(0, 7) : ""}
                onChange={(e) =>
                  handleFilterChange("periodStart", e.target.value ? `${e.target.value}-01` : "")
                }
              />
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="h-8 text-[13px] cursor-pointer hover:underline"
                style={{ color: "var(--color-link)" }}
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <p style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>
              {hasActiveFilters ? "No invoices match these filters" : "No invoices yet"}
            </p>
            {!hasActiveFilters && canRunCycle && (
              <Button onClick={handleOpenCycle}>
                <CalendarClock />
                Run billing
              </Button>
            )}
          </div>
        ) : (
          <>
            <DataTable
              dataSource={data}
              columns={columns}
              rowKey="invoiceId"
              loading={isLoading}
              scroll={{ x: 900 }}
            />
            <PaginationFooter pagination={pagination} onChange={handleTableChange} noun="invoice" />
          </>
        )}
      </div>

      <InvoiceDetailDrawer
        open={!!detailInvoice}
        invoice={detailInvoice}
        onClose={handleCloseDetail}
        onRecordPayment={handlePay}
        onPreviewPdf={handlePreviewPdf}
      />
      <InvoicePdfDrawer open={!!pdfInvoice} invoice={pdfInvoice} onClose={handleClosePdf} />
      <RecordPaymentDrawer open={!!payInvoice} invoice={payInvoice} onClose={handleClosePay} />
      <RunCycleDrawer open={cycleOpen} onClose={handleCloseCycle} />
    </div>
  );
};

export default InvoicesPage;
