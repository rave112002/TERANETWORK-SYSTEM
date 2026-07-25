import { useState } from "react";
import dayjs from "dayjs";
import { Activity, CircleAlert, Download, Filter, Loader2, Trash2, Users } from "lucide-react";
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
import { useAuditTrailHooks } from "./hooks";
import AuditDetailModal from "./components/AuditDetailModal";
import PageHeader from "../../../components/PageHeader";
import PaginationFooter from "../../../components/PaginationFooter";
import StatCard from "../../../components/StatCard";
import RefreshButton from "../../../components/RefreshButton";
import SearchInput from "../../../components/SearchInput";
import DataTable from "../../../components/DataTable";

// Uppercase micro-label above a filter control.
const FilterLabel = ({ children }) => (
  <span
    className="uppercase"
    style={{
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.08em",
      color: "var(--color-text-muted)",
    }}
  >
    {children}
  </span>
);

const AuditTrailPage = () => {
  const {
    logs,
    pagination,
    isLoading,
    isFetching,
    error,
    refetch,
    columns,
    currentPage,
    pageSize,
    handleTableChange,
    search,
    setSearch,
    moduleFilter,
    setModuleFilter,
    dateRange,
    setDateRange,
    moduleOptions,
    handleClearFilters,
    selectedLog,
    isDetailOpen,
    handleCloseDetails,
    handleExport,
    isExporting,
  } = useAuditTrailHooks();

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const hasActiveFilters = !!(
    search ||
    moduleFilter ||
    (dateRange && (dateRange[0] || dateRange[1]))
  );
  const isEmpty = !isLoading && logs.length === 0;

  const totalEvents = pagination?.total || 0;
  const uniqueUsers = new Set(logs.map((l) => l.accountId).filter(Boolean))
    .size;
  const deletions = logs.filter((l) => l.action === "DELETE").length;

  const fromStr = dateRange?.[0] ? dayjs(dateRange[0]).format("YYYY-MM-DD") : "";
  const toStr = dateRange?.[1] ? dayjs(dateRange[1]).format("YYYY-MM-DD") : "";
  const setRange = (from, to) => {
    if (!from && !to) return setDateRange(null);
    setDateRange([from ? dayjs(from) : null, to ? dayjs(to) : null]);
  };

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading audit trail</AlertTitle>
          <AlertDescription>
            {error.message || "Failed to load audit logs. Please try again."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      {/* 1. HEADER — read-only module, so no primary action */}
      <PageHeader
        title="Audit Trail"
        subtitle="View system activity logs and audit history."
      />

      {/* 2. STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <StatCard
          title="Total events"
          value={totalEvents}
          change="all time"
          icon={<Activity className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Users involved"
          value={uniqueUsers}
          change="on this page"
          icon={<Users className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Deletions"
          value={deletions}
          change="on this page"
          icon={<Trash2 className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
      </div>

      {/* 3. TABLE CARD */}
      <div
        className="bg-surface overflow-hidden"
        style={{
          border: "1px solid var(--color-line)",
          borderRadius: "var(--radius-card)",
        }}
      >
        {/* Toolbar */}
        <div
          className="flex items-center justify-between gap-3 flex-wrap px-[18px] py-3.5"
          style={{ borderBottom: "1px solid var(--color-line)" }}
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Filter events…"
          />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Download />
              )}
              Export CSV
            </Button>
            <RefreshButton onRefresh={refetch} isFetching={isFetching} />
            <Button
              variant={
                isFilterVisible || hasActiveFilters ? "default" : "outline"
              }
              size="sm"
              onClick={() => setIsFilterVisible(!isFilterVisible)}
            >
              <Filter />
              Filters
            </Button>
          </div>
        </div>

        {/* Filter row */}
        {isFilterVisible && (
          <div
            className="flex items-end gap-3 flex-wrap px-[18px] py-3.5"
            style={{ borderBottom: "1px solid var(--color-line)" }}
          >
            <div className="flex flex-col gap-1.5">
              <FilterLabel>Module</FilterLabel>
              <Select
                value={moduleFilter || "all"}
                onValueChange={(v) => setModuleFilter(v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-10 w-[200px]">
                  <SelectValue placeholder="All modules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All modules</SelectItem>
                  {moduleOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <FilterLabel>Date range</FilterLabel>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={fromStr}
                  max={toStr || undefined}
                  onChange={(e) => setRange(e.target.value, toStr)}
                  className="h-10 w-[150px]"
                />
                <span style={{ color: "var(--color-text-muted)" }}>–</span>
                <Input
                  type="date"
                  value={toStr}
                  min={fromStr || undefined}
                  onChange={(e) => setRange(fromStr, e.target.value)}
                  className="h-10 w-[150px]"
                />
              </div>
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

        {/* Table + custom pagination footer */}
        {isEmpty ? (
          <div className="flex items-center justify-center py-20 text-center">
            <p style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>
              No audit logs found
            </p>
          </div>
        ) : (
          <>
            <DataTable
              dataSource={logs}
              columns={columns}
              rowKey="auditId"
              loading={isLoading}
              scroll={{ x: 1100 }}
            />
            <PaginationFooter
              pagination={{
                current: currentPage,
                pageSize,
                total: totalEvents,
              }}
              onChange={handleTableChange}
              noun="event"
            />
          </>
        )}
      </div>

      {/* 4. DETAIL MODAL */}
      <AuditDetailModal
        open={isDetailOpen}
        onClose={handleCloseDetails}
        log={selectedLog}
      />
    </div>
  );
};

export default AuditTrailPage;
