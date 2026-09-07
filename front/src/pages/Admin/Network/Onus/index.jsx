import { useState } from "react";
import { CircleAlert, Filter, Plus, Router, Wifi, WifiOff } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useOnusData } from "./hooks";
import OnuFormDrawer from "./components/OnuFormDrawer";
import ActionLogsDrawer from "./components/ActionLogsDrawer";
import PageHeader from "../../../../components/PageHeader";
import PaginationFooter from "../../../../components/PaginationFooter";
import StatCard from "../../../../components/StatCard";
import RefreshButton from "../../../../components/RefreshButton";
import SearchInput from "../../../../components/SearchInput";
import DataTable from "../../../../components/DataTable";

const OnusPage = () => {
  const {
    data,
    pagination,
    filters,
    oltOptions,
    napOptions,
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
    selectedOnu,
    handleCreate,
    handleDrawerClose,
    logsOnu,
    handleCloseLogs,
  } = useOnusData();

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const totalOnus = pagination?.total || 0;
  const activeOnus = data?.filter((o) => o.provisioningState === "active").length || 0;
  // The number that matters operationally: these customers have no internet.
  const suspendedOnus = data?.filter((o) => o.provisioningState === "suspended").length || 0;

  const hasActiveFilters = Boolean(
    filters.search || filters.recordStatus || filters.provisioningState || filters.oltId,
  );
  const isEmpty = !isLoading && (data?.length || 0) === 0;

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading ONUs</AlertTitle>
          <AlertDescription>
            {error.response?.data?.message || error.message || "Failed to load ONUs."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="ONUs"
        subtitle="Subscriber modems. Service state is written by the provisioning worker, never by hand."
        actions={
          canWrite && (
            <Button onClick={handleCreate}>
              <Plus />
              Add ONU
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <StatCard
          title="Total ONUs"
          value={totalOnus}
          change="all branches you can see"
          icon={<Router className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Active"
          value={activeOnus}
          change="on this page"
          icon={<Wifi className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Suspended"
          value={suspendedOnus}
          change="no service right now"
          icon={<WifiOff className="w-4.25 h-4.25" strokeWidth={1.8} />}
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
            placeholder="Search MAC, serial, model, description…"
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
                Service state
              </span>
              <Select
                value={filters.provisioningState || "all"}
                onValueChange={(v) => handleFilterChange("provisioningState", v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-10 w-50">
                  <SelectValue placeholder="Any state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any state</SelectItem>
                  <SelectItem value="unprovisioned">Unprovisioned</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
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
                OLT
              </span>
              <Select
                value={filters.oltId || "all"}
                onValueChange={(v) => handleFilterChange("oltId", v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-10 w-60">
                  <SelectValue placeholder="All OLTs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All OLTs</SelectItem>
                  {oltOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
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
                Record
              </span>
              <Select
                value={filters.recordStatus || "all"}
                onValueChange={(v) => handleFilterChange("recordStatus", v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-10 w-44">
                  <SelectValue placeholder="All records" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All records</SelectItem>
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
            <p style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>No ONUs found</p>
            {canWrite && (
              <Button onClick={handleCreate}>
                <Plus />
                Add ONU
              </Button>
            )}
          </div>
        ) : (
          <>
            <DataTable
              dataSource={data}
              columns={columns}
              rowKey="onuId"
              loading={isLoading}
              scroll={{ x: 1000 }}
            />
            <PaginationFooter pagination={pagination} onChange={handleTableChange} noun="ONU" />
          </>
        )}
      </div>

      <OnuFormDrawer
        open={drawerOpen}
        entity={selectedOnu}
        napOptions={napOptions}
        onClose={handleDrawerClose}
        onSuccess={handleDrawerClose}
      />
      <ActionLogsDrawer open={!!logsOnu} onu={logsOnu} onClose={handleCloseLogs} />
    </div>
  );
};

export default OnusPage;
