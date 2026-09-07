import { useState } from "react";
import { CheckCircle, CircleAlert, Filter, Gauge, Plus, Wallet } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { usePlansData } from "./hooks";
import PlanFormDrawer from "./components/PlanFormDrawer";
import PageHeader from "../../../components/PageHeader";
import PaginationFooter from "../../../components/PaginationFooter";
import StatCard from "../../../components/StatCard";
import RefreshButton from "../../../components/RefreshButton";
import SearchInput from "../../../components/SearchInput";
import DataTable from "../../../components/DataTable";
import { formatPeso } from "../../../utils/currency";

const PlansPage = () => {
  const {
    data,
    pagination,
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
    drawerOpen,
    selectedPlan,
    handleCreate,
    handleDrawerClose,
  } = usePlansData();

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const totalPlans = pagination?.total || 0;
  const activePlans = data?.filter((p) => p.status === "Active").length || 0;
  // Cheapest active tier — the "from ₱X" figure staff quote on the phone.
  const entryPrice = data
    ?.filter((p) => p.status === "Active")
    .reduce(
      (min, p) => (min === null ? Number(p.monthlyPrice) : Math.min(min, Number(p.monthlyPrice))),
      null,
    );

  const hasActiveFilters = Boolean(filters.search || filters.status);
  const isEmpty = !isLoading && (data?.length || 0) === 0;

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading plans</AlertTitle>
          <AlertDescription>
            {error.response?.data?.message ||
              error.message ||
              "Failed to load plans. Please try again."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      {/* 1. HEADER */}
      <PageHeader
        title="Service Plans"
        subtitle="Speed tiers and pricing, shared across every branch."
        actions={
          canWrite && (
            <Button onClick={handleCreate}>
              <Plus />
              New plan
            </Button>
          )
        }
      />

      {/* 2. STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <StatCard
          title="Total plans"
          value={totalPlans}
          change="all time"
          icon={<Gauge className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Active plans"
          value={activePlans}
          change="on this page"
          icon={<CheckCircle className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Entry price"
          value={entryPrice === null || entryPrice === undefined ? "—" : formatPeso(entryPrice)}
          change="cheapest active tier"
          icon={<Wallet className="w-4.25 h-4.25" strokeWidth={1.8} />}
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
          className="flex items-center justify-between gap-3 flex-wrap px-4.5 py-3.5"
          style={{ borderBottom: "1px solid var(--color-line)" }}
        >
          <SearchInput
            value={filters.search}
            onChange={handleSearch}
            placeholder="Filter plans…"
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

        {/* Filter row */}
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
                onValueChange={(v) => handleStatusFilter(v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-10 w-50">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
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

        {/* Table + pagination */}
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <p style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>No plans found</p>
            {canWrite && (
              <Button onClick={handleCreate}>
                <Plus />
                New plan
              </Button>
            )}
          </div>
        ) : (
          <>
            <DataTable
              dataSource={data}
              columns={columns}
              rowKey="planId"
              loading={isLoading}
              scroll={{ x: 900 }}
            />
            <PaginationFooter
              pagination={pagination}
              onChange={handleTableChange}
              noun="plan"
            />
          </>
        )}
      </div>

      {/* 4. DRAWERS */}
      <PlanFormDrawer
        open={drawerOpen}
        entity={selectedPlan}
        onClose={handleDrawerClose}
        onSuccess={handleDrawerClose}
      />
    </div>
  );
};

export default PlansPage;
