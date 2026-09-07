import { useState } from "react";
import { CircleAlert, Filter, GitBranch, Plus, Split } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useSplittersData } from "./hooks";
import SplitterFormDrawer from "./components/SplitterFormDrawer";
import PageHeader from "../../../../components/PageHeader";
import PaginationFooter from "../../../../components/PaginationFooter";
import StatCard from "../../../../components/StatCard";
import RefreshButton from "../../../../components/RefreshButton";
import SearchInput from "../../../../components/SearchInput";
import DataTable from "../../../../components/DataTable";

const SplittersPage = () => {
  const {
    data,
    pagination,
    filters,
    parentOptions,
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
    selectedSplitter,
    handleCreate,
    handleDrawerClose,
  } = useSplittersData();

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const totalSplitters = pagination?.total || 0;
  const cascaded = data?.filter((s) => s.parentType === "splitter").length || 0;
  const napsFed = data?.reduce((sum, s) => sum + (Number(s.napCount) || 0), 0) || 0;

  const hasActiveFilters = Boolean(filters.search || filters.status);
  const isEmpty = !isLoading && (data?.length || 0) === 0;

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading splitters</AlertTitle>
          <AlertDescription>
            {error.response?.data?.message || error.message || "Failed to load splitters."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="Splitters"
        subtitle="Passive optical splits between the OLT and the field boxes."
        actions={
          canWrite && (
            <Button onClick={handleCreate}>
              <Plus />
              Add splitter
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <StatCard
          title="Total splitters"
          value={totalSplitters}
          change="all branches you can see"
          icon={<Split className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Cascaded"
          value={cascaded}
          change="fed by another splitter"
          icon={<GitBranch className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="NAPs fed"
          value={napsFed}
          change="on this page"
          icon={<GitBranch className="w-4.25 h-4.25" strokeWidth={1.8} />}
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
            placeholder="Search label or location…"
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

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <p style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>
              No splitters found
            </p>
            {canWrite && (
              <Button onClick={handleCreate}>
                <Plus />
                Add splitter
              </Button>
            )}
          </div>
        ) : (
          <>
            <DataTable
              dataSource={data}
              columns={columns}
              rowKey="splitterId"
              loading={isLoading}
              scroll={{ x: 950 }}
            />
            <PaginationFooter
              pagination={pagination}
              onChange={handleTableChange}
              noun="splitter"
            />
          </>
        )}
      </div>

      <SplitterFormDrawer
        open={drawerOpen}
        entity={selectedSplitter}
        parentOptions={parentOptions}
        onClose={handleDrawerClose}
        onSuccess={handleDrawerClose}
      />
    </div>
  );
};

export default SplittersPage;
