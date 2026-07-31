import { useState } from "react";
import { Building2, CircleAlert, Filter, Plus, UserCheck, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserHooks } from "./hooks";
import CreateUserDrawer from "./components/CreateUserDrawer";
import PageHeader from "../../../components/PageHeader";
import PaginationFooter from "../../../components/PaginationFooter";
import StatCard from "../../../components/StatCard";
import RefreshButton from "../../../components/RefreshButton";
import SearchInput from "../../../components/SearchInput";
import DataTable from "../../../components/DataTable";

const SuperAdminUsers = () => {
  const {
    data,
    pagination,
    isLoading,
    isFetching,
    error,
    refetch,
    columns,
    handleTableChange,
    isCreateDrawerOpen,
    handleOpenCreateDrawer,
    handleCloseCreateDrawer,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    companyFilter,
    setCompanyFilter,
    handleClearFilters,
    orgOptions,
  } = useUserHooks();

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const totalUsers = pagination?.total || 0;
  const activeUsers = data?.filter((u) => u.status === "Active").length || 0;
  const companiesOnPage = new Set(
    (data || []).map((u) => u.companyId).filter(Boolean),
  ).size;

  const hasActiveFilters = Boolean(search || statusFilter || companyFilter);
  const isEmpty = !isLoading && (data?.length || 0) === 0;

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading users</AlertTitle>
          <AlertDescription>
            {error.message || "Failed to load users. Please try again."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      {/* 1. HEADER */}
      <PageHeader
        title="Users"
        subtitle="Manage company owners and admin users."
        actions={
          <Button onClick={handleOpenCreateDrawer}>
            <Plus />
            New owner
          </Button>
        }
      />

      {/* 2. STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <StatCard
          title="Total users"
          value={totalUsers}
          change="all time"
          icon={<Users className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Active users"
          value={activeUsers}
          change="on this page"
          icon={<UserCheck className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Companies represented"
          value={companiesOnPage}
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
          className="flex items-center justify-between gap-3 flex-wrap px-4.5 py-3.5"
          style={{ borderBottom: "1px solid var(--color-line)" }}
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Filter users…"
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
                Company
              </span>
              <Select
                value={companyFilter || "all"}
                onValueChange={(v) => setCompanyFilter(v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-10 w-55">
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
                <SelectTrigger className="h-10 w-50">
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
              No users found
            </p>
            <Button onClick={handleOpenCreateDrawer}>
              <Plus />
              New owner
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              dataSource={data}
              columns={columns}
              rowKey="accountId"
              loading={isLoading}
              scroll={{ x: 900 }}
            />
            <PaginationFooter
              pagination={pagination}
              onChange={handleTableChange}
              noun="user"
            />
          </>
        )}
      </div>

      {/* 4. DRAWERS */}
      <CreateUserDrawer
        open={isCreateDrawerOpen}
        onClose={handleCloseCreateDrawer}
        onSuccess={handleCloseCreateDrawer}
      />
    </div>
  );
};

export default SuperAdminUsers;
