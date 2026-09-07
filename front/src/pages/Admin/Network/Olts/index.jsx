import { useState } from "react";
import { CircleAlert, Filter, KeyRound, Plus, Server, Wifi } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useOltsData } from "./hooks";
import OltFormDrawer from "./components/OltFormDrawer";
import PageHeader from "../../../../components/PageHeader";
import PaginationFooter from "../../../../components/PaginationFooter";
import StatCard from "../../../../components/StatCard";
import RefreshButton from "../../../../components/RefreshButton";
import SearchInput from "../../../../components/SearchInput";
import DataTable from "../../../../components/DataTable";

const OltsPage = () => {
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
    selectedOlt,
    handleCreate,
    handleDrawerClose,
  } = useOltsData();

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const totalOlts = pagination?.total || 0;
  const totalPonPorts =
    data?.reduce((sum, o) => sum + (Number(o.ponPortCount) || 0), 0) || 0;
  // A device with no stored credentials cannot be reached, so this is the
  // number that says "this many OLTs are inventory, not yet operable".
  const missingCredentials = data?.filter((o) => !o.hasCredentials).length || 0;

  const hasActiveFilters = Boolean(filters.search || filters.status);
  const isEmpty = !isLoading && (data?.length || 0) === 0;

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading OLTs</AlertTitle>
          <AlertDescription>
            {error.response?.data?.message || error.message || "Failed to load OLTs."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="OLTs"
        subtitle="Head-end devices this system connects to in order to suspend and restore service."
        actions={
          canWrite && (
            <Button onClick={handleCreate}>
              <Plus />
              Add OLT
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <StatCard
          title="Total OLTs"
          value={totalOlts}
          change="all branches you can see"
          icon={<Server className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="PON ports"
          value={totalPonPorts}
          change="on this page"
          icon={<Wifi className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Missing credentials"
          value={missingCredentials}
          change="cannot be reached"
          icon={<KeyRound className="w-4.25 h-4.25" strokeWidth={1.8} />}
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
            placeholder="Search name, host, site…"
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
                  <SelectItem value="Maintenance">Maintenance</SelectItem>
                  <SelectItem value="Retired">Retired</SelectItem>
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
            <p style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>No OLTs found</p>
            {canWrite && (
              <Button onClick={handleCreate}>
                <Plus />
                Add OLT
              </Button>
            )}
          </div>
        ) : (
          <>
            <DataTable
              dataSource={data}
              columns={columns}
              rowKey="oltId"
              loading={isLoading}
              scroll={{ x: 1050 }}
            />
            <PaginationFooter pagination={pagination} onChange={handleTableChange} noun="OLT" />
          </>
        )}
      </div>

      <OltFormDrawer
        open={drawerOpen}
        entity={selectedOlt}
        onClose={handleDrawerClose}
        onSuccess={handleDrawerClose}
      />
    </div>
  );
};

export default OltsPage;
