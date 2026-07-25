import { useState } from "react";
import { Building2, CheckCircle, CircleAlert, Filter, MapPin, Plus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBranchHooks } from "./hooks";
import BranchFormDrawer from "./components/BranchFormDrawer";
import ViewBranchModal from "./components/ViewBranchModal";
import PageHeader from "../../../../components/PageHeader";
import PaginationFooter from "../../../../components/PaginationFooter";
import StatCard from "../../../../components/StatCard";
import RefreshButton from "../../../../components/RefreshButton";
import SearchInput from "../../../../components/SearchInput";
import DataTable from "../../../../components/DataTable";

const BranchesPage = () => {
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    columns,
    pagination,
    handleTableChange,
    isCreateDrawerOpen,
    handleOpenCreateDrawer,
    handleCloseCreateDrawer,
    editingBranch,
    handleCloseEditDrawer,
    viewingBranch,
    isViewModalOpen,
    handleCloseView,
    handleEditFromView,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    companyFilter,
    setCompanyFilter,
    handleClearFilters,
    orgOptions,
  } = useBranchHooks();

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const branches = data?.branches || [];
  const totalBranches = pagination?.total || 0;
  const activeBranches = branches.filter((b) => b.status === "Active").length;
  const mainBranches = branches.filter((b) => b.isMainBranch).length;

  const hasActiveFilters = Boolean(search || statusFilter || companyFilter);
  const isEmpty = !isLoading && branches.length === 0;

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading branches</AlertTitle>
          <AlertDescription>
            {error.message || "Failed to load branches."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      {/* 1. HEADER */}
      <PageHeader
        title="Branches"
        subtitle="Manage branches across all companies."
        actions={
          <Button onClick={handleOpenCreateDrawer}>
            <Plus />
            New branch
          </Button>
        }
      />

      {/* 2. STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <StatCard
          title="Total branches"
          value={totalBranches}
          change="all time"
          icon={<MapPin className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Active branches"
          value={activeBranches}
          change="on this page"
          icon={<CheckCircle className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Main branches"
          value={mainBranches}
          change="on this page"
          icon={<Building2 className="w-4.25 h-4.25" strokeWidth={1.8} />}
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
            placeholder="Filter branches…"
          />
          <div className="flex items-center gap-2">
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
              <span
                className="uppercase"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  color: "var(--color-text-muted)",
                }}
              >
                Company
              </span>
              <Select
                value={companyFilter || "all"}
                onValueChange={(v) => setCompanyFilter(v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-10 w-[220px]">
                  <SelectValue placeholder="All companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All companies</SelectItem>
                  {orgOptions.map((o) => (
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
                value={statusFilter || "all"}
                onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-10 w-[200px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                  <SelectItem value="Deleted">Deleted</SelectItem>
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

        {/* Table + custom pagination footer */}
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <p style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>
              No branches found
            </p>
            <Button onClick={handleOpenCreateDrawer}>
              <Plus />
              New branch
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              dataSource={branches}
              columns={columns}
              rowKey="branchId"
              loading={isLoading}
              scroll={{ x: 900 }}
            />
            <PaginationFooter
              pagination={pagination}
              onChange={handleTableChange}
              noun="branch"
              nounPlural="branches"
            />
          </>
        )}
      </div>

      {/* 4. DRAWERS + MODALS */}
      <BranchFormDrawer
        open={isCreateDrawerOpen}
        onClose={handleCloseCreateDrawer}
        onSuccess={handleCloseCreateDrawer}
      />

      {/* Edit uses the same form; `entity` flips it into edit mode. */}
      <BranchFormDrawer
        open={!!editingBranch}
        entity={editingBranch}
        onClose={handleCloseEditDrawer}
        onSuccess={handleCloseEditDrawer}
      />

      <ViewBranchModal
        open={isViewModalOpen}
        branch={viewingBranch}
        onClose={handleCloseView}
        onEdit={handleEditFromView}
      />
    </div>
  );
};

export default BranchesPage;
