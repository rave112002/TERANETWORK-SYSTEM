import {
  FilterOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Alert, Button, Col, Empty, Input, Row, Select, Spin, Table } from "antd";
import { useState } from "react";
import { Building2, Search, UserCheck, Users } from "lucide-react";
import { useUserHooks } from "./hooks";
import CreateUserDrawer from "./components/CreateUserDrawer";
import PageHeader from "../../../components/PageHeader";
import PaginationFooter from "../../../components/PaginationFooter";
import StatCard from "../../../components/StatCard";

const SuperAdminUsers = () => {
  const {
    data,
    pagination,
    isLoading,
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
    isSearching,
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
        <Alert
          message="Error loading users"
          description={
            error.message || "Failed to load users. Please try again."
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
        title="Users"
        subtitle="Manage company owners and admin users."
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreateDrawer}
          >
            New owner
          </Button>
        }
      />

      {/* 2. STAT CARDS */}
      <Row gutter={[14, 14]}>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Total users"
            value={totalUsers}
            change="all time"
            icon={<Users className="w-4.25 h-4.25" strokeWidth={1.8} />}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Active users"
            value={activeUsers}
            change="on this page"
            icon={<UserCheck className="w-4.25 h-4.25" strokeWidth={1.8} />}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Companies represented"
            value={companiesOnPage}
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
            placeholder="Filter users…"
            prefix={
              <Search
                className="w-[15px] h-[15px]"
                style={{ color: "var(--color-text-muted)" }}
              />
            }
            suffix={isSearching ? <Spin size="small" /> : null}
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
                showSearch
                optionFilterProp="label"
                style={{ width: 220 }}
                options={orgOptions}
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
            <Empty description="No users found">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleOpenCreateDrawer}
              >
                New owner
              </Button>
            </Empty>
          </div>
        ) : (
          <>
            <Table
              dataSource={data}
              columns={columns}
              rowKey="accountId"
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
