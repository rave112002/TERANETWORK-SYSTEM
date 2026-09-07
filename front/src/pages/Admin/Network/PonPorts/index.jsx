import { useState } from "react";
import { CircleAlert, Filter, Gauge, Plus, Wifi } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { usePonPortsData } from "./hooks";
import PonPortFormDrawer from "./components/PonPortFormDrawer";
import PageHeader from "../../../../components/PageHeader";
import PaginationFooter from "../../../../components/PaginationFooter";
import StatCard from "../../../../components/StatCard";
import RefreshButton from "../../../../components/RefreshButton";
import SearchInput from "../../../../components/SearchInput";
import DataTable from "../../../../components/DataTable";

const PonPortsPage = () => {
  const {
    data,
    pagination,
    filters,
    oltOptions,
    isLoading,
    isFetching,
    error,
    refetch,
    canWrite,
    columns,
    handleTableChange,
    handleSearch,
    handleStatusFilter,
    handleOltFilter,
    handleClearFilters,
    drawerOpen,
    selectedPonPort,
    handleCreate,
    handleDrawerClose,
  } = usePonPortsData();

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const totalPorts = pagination?.total || 0;
  const totalCapacity = data?.reduce((sum, p) => sum + (Number(p.capacity) || 0), 0) || 0;
  const totalUsed = data?.reduce((sum, p) => sum + (Number(p.usedPorts) || 0), 0) || 0;
  const utilisation = totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0;

  const hasActiveFilters = Boolean(filters.search || filters.status || filters.oltId);
  const isEmpty = !isLoading && (data?.length || 0) === 0;

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading PON ports</AlertTitle>
          <AlertDescription>
            {error.response?.data?.message || error.message || "Failed to load PON ports."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="PON Ports"
        subtitle="Each port feeds one tree of subscribers. Capacity is where the next connection can go."
        actions={
          canWrite && (
            <Button onClick={handleCreate}>
              <Plus />
              Add port
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <StatCard
          title="Total ports"
          value={totalPorts}
          change="all branches you can see"
          icon={<Wifi className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Connected ONUs"
          value={`${totalUsed} / ${totalCapacity}`}
          change="on this page"
          icon={<Gauge className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Utilisation"
          value={`${utilisation}%`}
          change="of capacity on this page"
          icon={<Gauge className="w-4.25 h-4.25" strokeWidth={1.8} />}
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
            placeholder="Search port, OLT, description…"
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
                OLT
              </span>
              <Select
                value={filters.oltId || "all"}
                onValueChange={(v) => handleOltFilter(v === "all" ? "" : v)}
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
                  <SelectItem value="Down">Down</SelectItem>
                  <SelectItem value="Reserved">Reserved</SelectItem>
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
              No PON ports found
            </p>
            {canWrite && (
              <Button onClick={handleCreate}>
                <Plus />
                Add port
              </Button>
            )}
          </div>
        ) : (
          <>
            <DataTable
              dataSource={data}
              columns={columns}
              rowKey="ponPortId"
              loading={isLoading}
              scroll={{ x: 900 }}
            />
            <PaginationFooter pagination={pagination} onChange={handleTableChange} noun="port" />
          </>
        )}
      </div>

      <PonPortFormDrawer
        open={drawerOpen}
        entity={selectedPonPort}
        oltOptions={oltOptions}
        onClose={handleDrawerClose}
        onSuccess={handleDrawerClose}
      />
    </div>
  );
};

export default PonPortsPage;
