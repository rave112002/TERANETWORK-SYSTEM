import {
  FilterOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Alert, Button, Col, Empty, Input, Row, Select, Spin, Table } from "antd";
import { useState } from "react";
import { CheckCircle, Key, Search, Shield } from "lucide-react";
import { useRolesData } from "./hooks";
import RoleFormDrawer from "./components/RoleFormDrawer";
import PermissionsDrawer from "./components/PermissionsDrawer";
import PageHeader from "../../../../components/PageHeader";
import PaginationFooter from "../../../../components/PaginationFooter";
import StatCard from "../../../../components/StatCard";

const RolesPage = () => {
  const {
    data,
    pagination,
    filters,
    isLoading,
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
        <Alert
          message="Error loading roles"
          description={
            error.message || "Failed to load roles data. Please try again."
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
        title="Roles"
        subtitle="Manage roles and the permissions attached to them."
        actions={
          canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              New role
            </Button>
          )
        }
      />

      {/* 2. STAT CARDS */}
      <Row gutter={[14, 14]}>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Total roles"
            value={totalRoles}
            change="all time"
            icon={<Shield className="w-4.25 h-4.25" strokeWidth={1.8} />}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Active roles"
            value={activeRoles}
            change="on this page"
            icon={<CheckCircle className="w-4.25 h-4.25" strokeWidth={1.8} />}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Permissions granted"
            value={totalPermissions}
            change="on this page"
            icon={<Key className="w-4.25 h-4.25" strokeWidth={1.8} />}
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
            placeholder="Filter roles…"
            prefix={
              <Search
                className="w-[15px] h-[15px]"
                style={{ color: "var(--color-text-muted)" }}
              />
            }
            value={filters.search}
            onChange={(e) => handleSearch(e.target.value)}
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
                Status
              </span>
              <Select
                value={filters.status || undefined}
                onChange={handleStatusFilter}
                placeholder="All statuses"
                allowClear
                style={{ width: 200 }}
                options={[
                  { value: "Active", label: "Active" },
                  { value: "Inactive", label: "Inactive" },
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
            <Empty description="No roles found">
              {canWrite && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleCreate}
                >
                  New role
                </Button>
              )}
            </Empty>
          </div>
        ) : (
          <>
            <Table
              dataSource={data}
              columns={columns}
              rowKey="roleId"
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
