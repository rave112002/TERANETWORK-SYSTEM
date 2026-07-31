import { useState } from "react";
import {
  CheckCircle,
  CircleAlert,
  Filter,
  Plus,
  Trash2,
  Users,
  UserX,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { confirm } from "../../../../store/confirmStore";
import { useUserHooks } from "./hooks";
import UserFormDrawer from "./components/UserFormDrawer";
import UserViewModal from "./components/UserViewModal";
import UserPermissionsDrawer from "./components/UserPermissionsDrawer";
import PageHeader from "../../../../components/PageHeader";
import PaginationFooter from "../../../../components/PaginationFooter";
import StatCard from "../../../../components/StatCard";
import RefreshButton from "../../../../components/RefreshButton";
import SearchInput from "../../../../components/SearchInput";
import DataTable from "../../../../components/DataTable";

const UsersPage = () => {
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    canWrite,
    columns,
    pagination,
    handleTableChange,
    selectedRowKeys,
    rowSelection,
    handleBulkDelete,
    editingUser,
    handleCloseEditDrawer,
    isViewModalVisible,
    viewingUser,
    handleViewModalCancel,
    isCreateDrawerOpen,
    handleOpenCreateDrawer,
    handleCloseCreateDrawer,
    isPermissionsDrawerOpen,
    permissionsUser,
    handleClosePermissionsDrawer,
    search,
    handleSearch,
    statusFilter,
    handleStatusFilter,
    handleClearFilters,
  } = useUserHooks();

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const users = data?.users || [];
  const totalUsers = pagination?.total || 0;
  const activeUsers = users.filter((u) => u.status === "Active").length;
  const inactiveUsers = users.length - activeUsers;

  const hasSelectedRows = selectedRowKeys.length > 0;
  const hasActiveFilters = Boolean(search || statusFilter);
  const isEmpty = !isLoading && users.length === 0;

  const requestBulkDelete = async () => {
    const ok = await confirm({
      title: "Delete selected users",
      description: `Delete ${selectedRowKeys.length} user(s)? This can't be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      danger: true,
    });
    if (ok) handleBulkDelete();
  };

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading users</AlertTitle>
          <AlertDescription>
            {error.message || "Failed to load users data. Please try again."}
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
        subtitle="Manage team members, their roles and their permissions."
        actions={
          canWrite && (
            <Button onClick={handleOpenCreateDrawer}>
              <Plus />
              New user
            </Button>
          )
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
          icon={<CheckCircle className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Inactive users"
          value={inactiveUsers}
          change="on this page"
          icon={<UserX className="w-4.25 h-4.25" strokeWidth={1.8} />}
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
            onChange={handleSearch}
            placeholder="Filter users…"
          />
          <div className="flex items-center gap-2">
            {hasSelectedRows && canWrite && (
              <Button
                variant="destructive"
                size="sm"
                onClick={requestBulkDelete}
              >
                <Trash2 />
                Delete selected ({selectedRowKeys.length})
              </Button>
            )}
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
                value={statusFilter || "all"}
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
              No users found
            </p>
            {canWrite && (
              <Button onClick={handleOpenCreateDrawer}>
                <Plus />
                New user
              </Button>
            )}
          </div>
        ) : (
          <>
            <DataTable
              dataSource={users}
              columns={columns}
              rowSelection={rowSelection}
              rowKey="accountId"
              loading={isLoading}
              scroll={{ x: 1000 }}
            />
            <PaginationFooter
              pagination={pagination}
              onChange={handleTableChange}
              noun="user"
            />
          </>
        )}
      </div>

      {/* 4. DRAWERS & MODALS */}
      {/* Form owns its Sheet; entity=null → create, entity set → edit */}
      <UserFormDrawer
        open={isCreateDrawerOpen || !!editingUser}
        entity={editingUser}
        onClose={editingUser ? handleCloseEditDrawer : handleCloseCreateDrawer}
        onSuccess={
          editingUser ? handleCloseEditDrawer : handleCloseCreateDrawer
        }
      />

      <UserViewModal
        open={isViewModalVisible}
        onClose={handleViewModalCancel}
        user={viewingUser}
      />

      <UserPermissionsDrawer
        open={isPermissionsDrawerOpen}
        user={permissionsUser}
        onClose={handleClosePermissionsDrawer}
      />
    </div>
  );
};

export default UsersPage;
