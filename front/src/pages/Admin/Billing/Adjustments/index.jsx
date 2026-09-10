import { useState } from "react";
import { CircleAlert, Filter, Plus } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAdjustmentsData } from "./hooks";
import AdjustmentFormDrawer from "./components/AdjustmentFormDrawer";
import PageHeader from "../../../../components/PageHeader";
import PaginationFooter from "../../../../components/PaginationFooter";
import RefreshButton from "../../../../components/RefreshButton";
import SearchInput from "../../../../components/SearchInput";
import DataTable from "../../../../components/DataTable";

const AdjustmentsPage = () => {
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
    handleFilterChange,
    handleClearFilters,
    drawerOpen,
    handleCreate,
    handleDrawerClose,
  } = useAdjustmentsData();

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  // "open" is the default, so it does not count as a filter the user set.
  const hasActiveFilters = Boolean(
    filters.search || filters.kind || filters.applied !== "open"
  );
  const isEmpty = !isLoading && (data?.length || 0) === 0;

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading adjustments</AlertTitle>
          <AlertDescription>
            {error.response?.data?.message || error.message || "Failed to load adjustments."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="Adjustments"
        subtitle="Credits and one-off charges. Each appears as its own line on the customer's next invoice."
        actions={
          canWrite && (
            <Button onClick={handleCreate}>
              <Plus />
              Add adjustment
            </Button>
          )
        }
      />

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
            placeholder="Search description, customer…"
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
                State
              </span>
              <Select
                value={filters.applied || "all"}
                onValueChange={(v) => handleFilterChange("applied", v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-10 w-52">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Waiting for an invoice</SelectItem>
                  <SelectItem value="applied">Already applied</SelectItem>
                  <SelectItem value="all">All</SelectItem>
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
                Kind
              </span>
              <Select
                value={filters.kind || "all"}
                onValueChange={(v) => handleFilterChange("kind", v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-10 w-48">
                  <SelectValue placeholder="Any kind" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any kind</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="discount">Discount</SelectItem>
                  <SelectItem value="debit">Charge</SelectItem>
                  <SelectItem value="reconnection_fee">Reconnection fee</SelectItem>
                  <SelectItem value="install_fee">Installation fee</SelectItem>
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

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <p style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>
              {filters.applied === "open" && !filters.search && !filters.kind
                ? "Nothing is waiting to be applied"
                : "No adjustments match these filters"}
            </p>
            {canWrite && (
              <Button onClick={handleCreate}>
                <Plus />
                Add adjustment
              </Button>
            )}
          </div>
        ) : (
          <>
            <DataTable
              dataSource={data}
              columns={columns}
              rowKey="pendingChargeId"
              loading={isLoading}
              scroll={{ x: 900 }}
            />
            <PaginationFooter
              pagination={pagination}
              onChange={handleTableChange}
              noun="adjustment"
            />
          </>
        )}
      </div>

      <AdjustmentFormDrawer
        open={drawerOpen}
        onClose={handleDrawerClose}
        onSuccess={handleDrawerClose}
      />
    </div>
  );
};

export default AdjustmentsPage;
