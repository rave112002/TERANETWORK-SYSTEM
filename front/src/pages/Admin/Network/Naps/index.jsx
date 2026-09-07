import { useState } from "react";
import { Box, CircleAlert, Filter, List, Map as MapIcon, Plus } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useNapsData } from "./hooks";
import NapFormDrawer from "./components/NapFormDrawer";
import PageHeader from "../../../../components/PageHeader";
import PaginationFooter from "../../../../components/PaginationFooter";
import StatCard from "../../../../components/StatCard";
import RefreshButton from "../../../../components/RefreshButton";
import SearchInput from "../../../../components/SearchInput";
import DataTable from "../../../../components/DataTable";
import NetworkMap from "../../../../components/NetworkMap";
import Spinner from "../../../../components/Spinner";

const NapsPage = () => {
  const {
    data,
    mapNaps,
    mapLoading,
    pagination,
    filters,
    splitterOptions,
    view,
    setView,
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
    selectedNap,
    handleCreate,
    handleEdit,
    handleDrawerClose,
  } = useNapsData();

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const totalNaps = pagination?.total || 0;
  const totalPorts = data?.reduce((sum, n) => sum + (Number(n.totalPorts) || 0), 0) || 0;
  const usedPorts = data?.reduce((sum, n) => sum + (Number(n.usedPorts) || 0), 0) || 0;
  const freePorts = totalPorts - usedPorts;

  const hasActiveFilters = Boolean(filters.search || filters.status);
  const isEmpty = !isLoading && (data?.length || 0) === 0;

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading NAPs</AlertTitle>
          <AlertDescription>
            {error.response?.data?.message || error.message || "Failed to load NAPs."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="Network Access Points"
        subtitle="Field boxes where subscriber drop cables terminate."
        actions={
          canWrite && (
            <Button onClick={handleCreate}>
              <Plus />
              Add NAP
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <StatCard
          title="Total NAPs"
          value={totalNaps}
          change="all branches you can see"
          icon={<Box className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Ports in use"
          value={`${usedPorts} / ${totalPorts}`}
          change="on this page"
          icon={<List className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Free ports"
          value={freePorts}
          change="room for new connections"
          icon={<MapIcon className="w-4.25 h-4.25" strokeWidth={1.8} />}
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
            placeholder="Search label or address…"
          />
          <div className="flex items-center gap-2">
            {/* Table or map — the same rows, two ways of asking "where is there
                room?". The map fetches its own unpaginated set. */}
            <div
              className="inline-flex"
              style={{ border: "1px solid var(--color-line)", borderRadius: 8, padding: 2 }}
            >
              <Button
                variant={view === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("table")}
              >
                <List />
                Table
              </Button>
              <Button
                variant={view === "map" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("map")}
              >
                <MapIcon />
                Map
              </Button>
            </div>
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

        {view === "map" ? (
          <div className="p-4.5">
            {mapLoading ? (
              <div className="flex items-center justify-center py-20">
                <Spinner size="large" />
              </div>
            ) : (
              <NetworkMap naps={mapNaps} onSelect={canWrite ? handleEdit : undefined} />
            )}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <p style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>No NAPs found</p>
            {canWrite && (
              <Button onClick={handleCreate}>
                <Plus />
                Add NAP
              </Button>
            )}
          </div>
        ) : (
          <>
            <DataTable
              dataSource={data}
              columns={columns}
              rowKey="napId"
              loading={isLoading}
              scroll={{ x: 950 }}
            />
            <PaginationFooter pagination={pagination} onChange={handleTableChange} noun="NAP" />
          </>
        )}
      </div>

      <NapFormDrawer
        open={drawerOpen}
        entity={selectedNap}
        splitterOptions={splitterOptions}
        onClose={handleDrawerClose}
        onSuccess={handleDrawerClose}
      />
    </div>
  );
};

export default NapsPage;
