import {
  FilterOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Alert, App, Button, Col, Empty, Input, Row, Select, Spin, Table } from "antd";
import { useState } from "react";
import { Building2, CheckCircle, MapPin, Search } from "lucide-react";
import { useBranchHooks } from "./hooks";
import CreateBranchDrawer from "./components/CreateBranchDrawer";
import PageHeader from "../../../../components/PageHeader";
import PaginationFooter from "../../../../components/PaginationFooter";
import StatCard from "../../../../components/StatCard";

const BranchesPage = () => {
  const {
    data,
    isLoading,
    error,
    refetch,
    getColumns,
    pagination,
    handleTableChange,
    isCreateDrawerOpen,
    handleOpenCreateDrawer,
    handleCloseCreateDrawer,
    handleEdit,
    handleDelete,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    companyFilter,
    setCompanyFilter,
    handleClearFilters,
    orgOptions,
  } = useBranchHooks();

  const { modal } = App.useApp();
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  // Destructive action gets an explicit confirm step.
  const handleDeleteRequest = (record) => {
    modal.confirm({
      title: "Delete branch",
      content: `Delete "${record.name}"? This can't be undone.`,
      okText: "Delete",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: () => handleDelete(record),
    });
  };

  const columns = getColumns(handleEdit, handleDeleteRequest);

  const branches = data?.branches || [];
  const totalBranches = pagination?.total || 0;
  const activeBranches = branches.filter((b) => b.status === "Active").length;
  const mainBranches = branches.filter((b) => b.isMainBranch).length;

  const hasActiveFilters = Boolean(search || statusFilter || companyFilter);
  const isEmpty = !isLoading && branches.length === 0;

  if (error) {
    return (
      <div className="p-8">
        <Alert
          message="Error loading branches"
          description={error.message || "Failed to load branches."}
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
        title="Branches"
        subtitle="Manage branches across all companies."
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreateDrawer}
          >
            New branch
          </Button>
        }
      />

      {/* 2. STAT CARDS */}
      <Row gutter={[14, 14]}>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Total branches"
            value={totalBranches}
            change="all time"
            icon={<MapPin className="w-4.25 h-4.25" strokeWidth={1.8} />}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Active branches"
            value={activeBranches}
            change="on this page"
            icon={<CheckCircle className="w-4.25 h-4.25" strokeWidth={1.8} />}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Main branches"
            value={mainBranches}
            change="on this page"
            icon={<Building2 className="w-4.25 h-4.25" strokeWidth={1.8} />}
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
            placeholder="Filter branches…"
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
                Company
              </span>
              <Select
                value={companyFilter || undefined}
                onChange={setCompanyFilter}
                placeholder="All companies"
                allowClear
                style={{ width: 220 }}
                options={orgOptions}
                showSearch
                optionFilterProp="label"
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
                  { value: "Deleted", label: "Deleted" },
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
            <Empty description="No branches found">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleOpenCreateDrawer}
              >
                New branch
              </Button>
            </Empty>
          </div>
        ) : (
          <>
            <Table
              dataSource={branches}
              columns={columns}
              rowKey="branchId"
              pagination={false}
              loading={{
                spinning: isLoading,
                indicator: <Spin size="large" style={{ marginTop: 50 }} />,
              }}
              onChange={handleTableChange}
              scroll={{ x: 900 }}
              size="middle"
              className="border-none"
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

      {/* 4. DRAWERS */}
      <CreateBranchDrawer
        open={isCreateDrawerOpen}
        onClose={handleCloseCreateDrawer}
        onSuccess={handleCloseCreateDrawer}
      />
    </div>
  );
};

export default BranchesPage;
