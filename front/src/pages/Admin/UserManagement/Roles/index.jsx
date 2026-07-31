import { useState } from "react";
import { CheckCircle, CircleAlert, Filter, Key, Plus, Shield } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRolesData } from "./hooks";
import RoleFormDrawer from "./components/RoleFormDrawer";
import PermissionsDrawer from "./components/PermissionsDrawer";
import PageHeader from "../../../../components/PageHeader";
import PaginationFooter from "../../../../components/PaginationFooter";
import StatCard from "../../../../components/StatCard";
import RefreshButton from "../../../../components/RefreshButton";
import SearchInput from "../../../../components/SearchInput";
import DataTable from "../../../../components/DataTable";

const RolesPage = () => {
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
    permissionsDrawerOpen,
    selectedRole,
    handleCreate,
    handleDrawerClose,
    handlePermissionsDrawerClose,
  } = useRolesData();

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const totalRoles = pagination?.total || 0;
  const activeRoles = data?.filter((r) => r.status === "Active").length || 0;
  const totalPermissions =
    data?.reduce((sum, role) => sum + (role.permissionCount || 0), 0) || 0;

  const hasActiveFilters = Boolean(filters.search || filters.status);
  const isEmpty = !isLoading && (data?.length || 0) === 0;

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading roles</AlertTitle>
          <AlertDescription>
            {error.message || "Failed to load roles data. Please try again."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      {/* 1. HEADER */}
      <PageHeader
        title="Roles"
        subtitle="Manage roles and the permissions attached to them."
        actions={
          canWrite && (
            <Button onClick={handleCreate}>
              <Plus />
              New role
            </Button>
          )
        }
      />

      {/* 2. STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <StatCard
          title="Total roles"
          value={totalRoles}
          change="all time"
          icon={<Shield className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Active roles"
          value={activeRoles}
          change="on this page"
          icon={<CheckCircle className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Permissions granted"
          value={totalPermissions}
          change="on this page"
          icon={<Key className="w-4.25 h-4.25" strokeWidth={1.8} />}
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
            placeholder="Filter roles…"
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

        {/* Table + custom pagination footer */}
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <p style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>
              No roles found
            </p>
            {canWrite && (
              <Button onClick={handleCreate}>
                <Plus />
                New role
              </Button>
            )}
          </div>
        ) : (
          <>
            <DataTable
              dataSource={data}
              columns={columns}
              rowKey="roleId"
              loading={isLoading}
              scroll={{ x: 900 }}
            />
            <PaginationFooter
              pagination={pagination}
              onChange={handleTableChange}
              noun="role"
            />
          </>
        )}
      </div>

      {/* 4. DRAWERS */}
      <RoleFormDrawer
        open={drawerOpen}
        entity={selectedRole}
        onClose={handleDrawerClose}
        onSuccess={handleDrawerClose}
      />

      <PermissionsDrawer
        open={permissionsDrawerOpen}
        role={selectedRole}
        onClose={handlePermissionsDrawerClose}
      />
    </div>
  );
};

export default RolesPage;
