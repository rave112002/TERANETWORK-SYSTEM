import { useState } from "react";
import { CircleAlert, Filter, HandCoins } from "lucide-react";

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

import { usePaymentsData } from "./hooks";
import PageHeader from "../../../../components/PageHeader";
import PaginationFooter from "../../../../components/PaginationFooter";
import StatCard from "../../../../components/StatCard";
import RefreshButton from "../../../../components/RefreshButton";
import SearchInput from "../../../../components/SearchInput";
import DataTable from "../../../../components/DataTable";
import { formatPeso } from "../../../../utils/currency";

const CHANNELS = [
  { value: "CASH", label: "Cash" },
  { value: "GCASH", label: "GCash" },
  { value: "MAYA", label: "Maya" },
  { value: "QRPH", label: "QR Ph" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CARD", label: "Card" },
  { value: "OTHER", label: "Other" },
];

const PaymentsPage = () => {
  const {
    data,
    summary,
    pagination,
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
  } = usePaymentsData();

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const hasActiveFilters = Boolean(
    filters.search || filters.channel || filters.paidFrom || filters.paidTo
  );
  const isEmpty = !isLoading && (data?.length || 0) === 0;

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading payments</AlertTitle>
          <AlertDescription>
            {error.response?.data?.message || error.message || "Failed to load payments."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="Payments"
        subtitle="Money received. Payments are recorded against an invoice, from that invoice."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <StatCard
          title="Collected"
          value={formatPeso(summary.collected, "₱0.00")}
          change="matching these filters"
          icon={<HandCoins className="w-4.25 h-4.25" strokeWidth={1.8} />}
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
            placeholder="Search invoice number, customer, account no…"
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
                Method
              </span>
              <Select
                value={filters.channel || "all"}
                onValueChange={(v) => handleFilterChange("channel", v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-10 w-44">
                  <SelectValue placeholder="Any method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any method</SelectItem>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
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
                From
              </span>
              <Input
                type="date"
                className="h-10 w-44"
                value={filters.paidFrom}
                onChange={(e) => handleFilterChange("paidFrom", e.target.value)}
              />
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
                To
              </span>
              <Input
                type="date"
                className="h-10 w-44"
                value={filters.paidTo}
                onChange={(e) => handleFilterChange("paidTo", e.target.value)}
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
              {hasActiveFilters ? "No payments match these filters" : "No payments recorded yet"}
            </p>
            {!hasActiveFilters && (
              <p style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
                Record one from the invoice it pays.
              </p>
            )}
          </div>
        ) : (
          <>
            <DataTable
              dataSource={data}
              columns={columns}
              rowKey="paymentId"
              loading={isLoading}
              scroll={{ x: 900 }}
            />
            <PaginationFooter pagination={pagination} onChange={handleTableChange} noun="payment" />
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentsPage;
