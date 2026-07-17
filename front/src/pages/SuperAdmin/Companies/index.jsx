import {
  DeleteOutlined,
  FilterOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Col,
  Empty,
  Input,
  Popconfirm,
  Row,
  Select,
  Spin,
  Table,
} from "antd";
import { useState } from "react";
import { Building2, CheckCircle, Search, XCircle } from "lucide-react";
import { useCompanyHooks } from "./hooks";
import CompanyFormDrawer from "./components/CompanyFormDrawer";
import ViewCompanyModal from "./components/ViewCompanyModal";
import PageHeader from "../../../components/PageHeader";
import PaginationFooter from "../../../components/PaginationFooter";
import StatCard from "../../../components/StatCard";

const Companies = () => {
  const {
    data,
    isLoading,
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
  const hasActiveFilters = Boolean(search || statusFilter || subscriptionFilter);
  const isEmpty = !isLoading && companies.length === 0;

  if (error) {
    return (
      <div className="p-8">
        <Alert
          message="Error loading companies"
          description={
            error.message || "Failed to load companies data. Please try again."
          }
          type="error"
          showIcon
        />
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
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreateModal}
          >
            New company
          </Button>
        }
      />

      {/* 2. STAT CARDS */}
      <Row gutter={[14, 14]}>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Total companies"
            value={totalCompanies}
            change="all time"
            icon={<Building2 className="w-4.25 h-4.25" strokeWidth={1.8} />}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Active companies"
            value={activeCompanies}
            change="on this page"
            icon={<CheckCircle className="w-4.25 h-4.25" strokeWidth={1.8} />}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Inactive companies"
            value={inactiveCompanies}
            change="on this page"
            icon={<XCircle className="w-4.25 h-4.25" strokeWidth={1.8} />}
          />
        </Col>
      </Row>

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
          <Input
            placeholder="Filter companies…"
            prefix={
              <Search
                className="w-[15px] h-[15px]"
                style={{ color: "var(--color-text-muted)" }}
              />
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 280 }}
          />
          <div className="flex items-center gap-2">
            {hasSelectedRows && (
              <Popconfirm
                title="Delete selected companies"
                description={`Delete ${selectedRowKeys.length} ${
                  selectedRowKeys.length === 1 ? "company" : "companies"
                }? This can't be undone.`}
                onConfirm={handleBulkDelete}
                okText="Delete"
                okType="danger"
                cancelText="Cancel"
              >
                <Button danger icon={<DeleteOutlined />} loading={isLoading}>
                  Delete ({selectedRowKeys.length})
                </Button>
              </Popconfirm>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetch?.()}
              loading={isLoading}
            >
              Refresh
            </Button>
            <Button
              icon={<FilterOutlined />}
              onClick={() => setIsFilterVisible(!isFilterVisible)}
              type={isFilterVisible || hasActiveFilters ? "primary" : "default"}
            >
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
                value={statusFilter || undefined}
                onChange={setStatusFilter}
                placeholder="All statuses"
                allowClear
                style={{ width: 200 }}
                options={[
                  { value: "Active", label: "Active" },
                  { value: "Inactive", label: "Inactive" },
                  { value: "Suspended", label: "Suspended" },
                  { value: "Pending", label: "Pending" },
                  { value: "Deleted", label: "Deleted" },
                ]}
              />
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
                value={subscriptionFilter || undefined}
                onChange={setSubscriptionFilter}
                placeholder="All plans"
                allowClear
                style={{ width: 200 }}
                options={[
                  { value: "Basic", label: "Basic" },
                  { value: "Standard", label: "Standard" },
                  { value: "Premium", label: "Premium" },
                  { value: "Enterprise", label: "Enterprise" },
                ]}
              />
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
          <div className="flex items-center justify-center py-20">
            <Empty description="No companies found">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleOpenCreateModal}
              >
                New company
              </Button>
            </Empty>
          </div>
        ) : (
          <>
            <Table
              dataSource={companies}
              columns={columns}
              rowSelection={rowSelection}
              rowKey="id"
              pagination={false}
              loading={{
                spinning: isLoading,
                indicator: <Spin size="large" style={{ marginTop: 50 }} />,
              }}
              onChange={handleTableChange}
              scroll={{ x: 1150 }}
              size="middle"
              className="border-none"
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
      {/* Form owns its Drawer; entity=null → create, entity set → edit */}
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
