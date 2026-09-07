import { useState } from "react";
import { CheckCircle, CircleAlert, Filter, MapPin, Plus, Users } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useCustomersData } from "./hooks";
import CustomerFormDrawer from "./components/CustomerFormDrawer";
import PageHeader from "../../../components/PageHeader";
import PaginationFooter from "../../../components/PaginationFooter";
import StatCard from "../../../components/StatCard";
import RefreshButton from "../../../components/RefreshButton";
import SearchInput from "../../../components/SearchInput";
import DataTable from "../../../components/DataTable";
import { decodeHTML } from "../../../utils/decode-html";

const CustomersPage = () => {
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
    handleBranchFilter,
    handleClearFilters,
    drawerOpen,
    selectedCustomer,
    handleCreate,
    handleDrawerClose,
  } = useCustomersData();

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const totalCustomers = pagination?.total || 0;
  const activeCustomers = data?.filter((c) => c.status === "Active").length || 0;
  const mappedCustomers = data?.filter((c) => c.gpsLat && c.gpsLng).length || 0;

  // Branch options come from the rows themselves: the list is already limited
  // to the branches this user may see, so the filter cannot offer one they
  // cannot read.
  const branchOptions = Array.from(
    new Map(
      (data || [])
        .filter((c) => c.branchId)
        .map((c) => [c.branchId, decodeHTML(c.branchName) || c.branchId]),
    ),
  );

  const hasActiveFilters = Boolean(filters.search || filters.status || filters.branchId);
  const isEmpty = !isLoading && (data?.length || 0) === 0;

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading subscribers</AlertTitle>
          <AlertDescription>
            {error.response?.data?.message ||
              error.message ||
              "Failed to load subscribers. Please try again."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      {/* 1. HEADER */}
      <PageHeader
        title="Subscribers"
        subtitle="Account holders in the branches you have access to."
        actions={
          canWrite && (
            <Button onClick={handleCreate}>
              <Plus />
              New subscriber
            </Button>
          )
        }
      />

      {/* 2. STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <StatCard
          title="Total subscribers"
          value={totalCustomers}
          change="all branches you can see"
          icon={<Users className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Active"
          value={activeCustomers}
          change="on this page"
          icon={<CheckCircle className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Mapped"
          value={mappedCustomers}
          change="with GPS coordinates"
          icon={<MapPin className="w-4.25 h-4.25" strokeWidth={1.8} />}
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
            placeholder="Search name, email, account no…"
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

            {branchOptions.length > 1 && (
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
                  Branch
                </span>
                <Select
                  value={filters.branchId || "all"}
                  onValueChange={(v) => handleBranchFilter(v === "all" ? "" : v)}
                >
                  <SelectTrigger className="h-10 w-50">
                    <SelectValue placeholder="All branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branchOptions.map(([branchId, branchName]) => (
                      <SelectItem key={branchId} value={branchId}>
                        {branchName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
            <p style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>
              No subscribers found
            </p>
            {canWrite && (
              <Button onClick={handleCreate}>
                <Plus />
                New subscriber
              </Button>
            )}
          </div>
        ) : (
          <>
            <DataTable
              dataSource={data}
              columns={columns}
              rowKey="customerId"
              loading={isLoading}
              scroll={{ x: 1000 }}
            />
            <PaginationFooter
              pagination={pagination}
              onChange={handleTableChange}
              noun="subscriber"
            />
          </>
        )}
      </div>

      {/* 4. DRAWERS */}
      <CustomerFormDrawer
        open={drawerOpen}
        entity={selectedCustomer}
        onClose={handleDrawerClose}
        onSuccess={handleDrawerClose}
      />
    </div>
  );
};

export default CustomersPage;
