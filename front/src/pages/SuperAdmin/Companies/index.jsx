import { useState } from "react";
import { Building2, CheckCircle, CircleAlert, Filter, Plus, Trash2, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { confirm } from "../../../store/confirmStore";
import { useCompanyHooks } from "./hooks";
import CompanyFormDrawer from "./components/CompanyFormDrawer";
import ViewCompanyModal from "./components/ViewCompanyModal";
import PageHeader from "../../../components/PageHeader";
import PaginationFooter from "../../../components/PaginationFooter";
import StatCard from "../../../components/StatCard";
import RefreshButton from "../../../components/RefreshButton";
import SearchInput from "../../../components/SearchInput";
import DataTable from "../../../components/DataTable";

const Companies = () => {
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    columns,
    pagination,
    handleTableChange,
    selectedRowKeys,
    rowSelection,
    handleBulkDelete,
    editingCompany,
    handleCloseEditModal,
    isViewModalVisible,
    viewingCompany,
    handleViewModalCancel,
    handleEditFromView,
    isCreateModalOpen,
    handleOpenCreateModal,
    handleCloseCreateModal,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    subscriptionFilter,
    setSubscriptionFilter,
    handleClearFilters,
  } = useCompanyHooks();

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const companies = data?.companies || [];
  const totalCompanies = pagination?.total || 0;
  const activeCompanies = companies.filter((c) => c.status === "Active").length;
  const inactiveCompanies = companies.length - activeCompanies;

  const hasSelectedRows = selectedRowKeys.length > 0;
  const hasActiveFilters = Boolean(
    search || statusFilter || subscriptionFilter,
  );
  const isEmpty = !isLoading && companies.length === 0;

  const requestBulkDelete = async () => {
    const ok = await confirm({
      title: "Delete selected companies",
      description: `Delete ${selectedRowKeys.length} ${
        selectedRowKeys.length === 1 ? "company" : "companies"
      }? This can't be undone.`,
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
          <AlertTitle>Error loading companies</AlertTitle>
          <AlertDescription>
            {error.message ||
              "Failed to load companies data. Please try again."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      {/* 1. HEADER */}
      <PageHeader
        title="Companies"
        subtitle="Manage every company on the platform and their information."
        actions={
          <Button onClick={handleOpenCreateModal}>
            <Plus />
            New company
          </Button>
        }
      />

      {/* 2. STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <StatCard
          title="Total companies"
          value={totalCompanies}
          change="all time"
          icon={<Building2 className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Active companies"
          value={activeCompanies}
          change="on this page"
          icon={<CheckCircle className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Inactive companies"
          value={inactiveCompanies}
          change="on this page"
          icon={<XCircle className="w-4.25 h-4.25" strokeWidth={1.8} />}
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
            placeholder="Filter companies…"
          />
          <div className="flex items-center gap-2">
            {hasSelectedRows && (
              <Button
                variant="destructive"
                size="sm"
                onClick={requestBulkDelete}
              >
                <Trash2 />
                Delete ({selectedRowKeys.length})
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
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Deleted">Deleted</SelectItem>
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
                Subscription
              </span>
              <Select
                value={subscriptionFilter || "all"}
                onValueChange={(v) =>
                  setSubscriptionFilter(v === "all" ? "" : v)
                }
              >
                <SelectTrigger className="h-10 w-[200px]">
                  <SelectValue placeholder="All plans" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plans</SelectItem>
                  <SelectItem value="Basic">Basic</SelectItem>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Premium">Premium</SelectItem>
                  <SelectItem value="Enterprise">Enterprise</SelectItem>
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
              No companies found
            </p>
            <Button onClick={handleOpenCreateModal}>
              <Plus />
              New company
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              dataSource={companies}
              columns={columns}
              rowSelection={rowSelection}
              rowKey="id"
              loading={isLoading}
              scroll={{ x: 1150 }}
            />
            <PaginationFooter
              pagination={pagination}
              onChange={handleTableChange}
              noun="company"
              nounPlural="companies"
            />
          </>
        )}
      </div>

      {/* 4. DRAWERS & MODALS */}
      <CompanyFormDrawer
        open={isCreateModalOpen || !!editingCompany}
        entity={editingCompany}
        onClose={editingCompany ? handleCloseEditModal : handleCloseCreateModal}
        onSuccess={
          editingCompany ? handleCloseEditModal : handleCloseCreateModal
        }
      />

      <ViewCompanyModal
        open={isViewModalVisible}
        onClose={handleViewModalCancel}
        company={viewingCompany}
        onEdit={handleEditFromView}
      />
    </div>
  );
};

export default Companies;
