import {
  FilterOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Col,
  Drawer,
  Empty,
  Input,
  Row,
  Select,
  Spin,
  Table,
  Typography,
} from "antd";
import { useState } from "react";
import { Search, Shield, Users, CheckCircle, Key } from "lucide-react";
import { useRolesData } from "./hooks";
import RoleFormDrawer from "./components/RoleFormDrawer";
import PermissionsDrawer from "./components/PermissionsDrawer";
import StatCard from "../../../../components/StatCard";

const { Title, Text } = Typography;

const RolesPage = () => {
  const {
    data,
    pagination,
    filters,
    isLoading,
    error,
    refetch,
    canWrite,
    handleTableChange,
    handleSearch,
    handleStatusFilter,
    handleDelete,
    getColumns,
  } = useRolesData();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [permissionsDrawerOpen, setPermissionsDrawerOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const handleCreate = () => {
    setSelectedRole(null);
    setDrawerOpen(true);
  };

  const handleEdit = (record) => {
    setSelectedRole(record);
    setDrawerOpen(true);
  };

  const handleManagePermissions = (record) => {
    setSelectedRole(record);
    setPermissionsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setSelectedRole(null);
    refetch?.();
  };

  const handlePermissionsDrawerClose = () => {
    setPermissionsDrawerOpen(false);
    setSelectedRole(null);
    refetch?.();
  };

  const handleClearFilters = () => {
    handleSearch("");
    handleStatusFilter("");
  };

  const columns = getColumns(handleEdit, handleManagePermissions, handleDelete);

  const totalRoles = data?.length || 0;
  const activeRoles = data?.filter((r) => r.status === "Active").length || 0;
  const totalUsers =
    data?.reduce((sum, role) => sum + (role.userCount || 0), 0) || 0;
  const totalPermissions =
    data?.reduce((sum, role) => sum + (role.permissionCount || 0), 0) || 0;

  const hasActiveFilters = filters.search || filters.status;

  if (error) {
    return (
      <div className="p-6">
        <Alert
          message="Error Loading Roles"
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
    <div className="p-6 space-y-5">
      {/* 1. PAGE HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <Title level={2} className="mb-1! flex items-center gap-3">
            <div
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl shadow-md"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Shield className="w-5 h-5 text-white" />
            </div>
            Roles Management
          </Title>
          <Text
            style={{ color: "var(--color-text-secondary)" }}
            className="text-sm"
          >
            Manage user roles and permissions
          </Text>
        </div>
        {canWrite && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            size="large"
            style={{
              background: "var(--gradient-primary)",
              border: "none",
              boxShadow:
                "0 4px 12px color-mix(in srgb, var(--color-primary-color) 35%, transparent)",
            }}
          >
            Create Role
          </Button>
        )}
      </div>

      {/* 2. STAT CARDS */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Total Roles"
            value={totalRoles}
            icon={<Shield className="w-5 h-5" />}
            color="from-primary-color to-secondary-color"
            bgColor="bg-primary-pale"
            textColor="text-primary-color"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Active Roles"
            value={activeRoles}
            icon={<CheckCircle className="w-5 h-5" />}
            color="from-emerald-400 to-emerald-600"
            bgColor="bg-emerald-100"
            textColor="text-emerald-600"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Total Users"
            value={totalUsers}
            icon={<Users className="w-5 h-5" />}
            color="from-secondary-color to-secondary-dark"
            bgColor="bg-secondary-pale"
            textColor="text-secondary-color"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Permissions"
            value={totalPermissions}
            icon={<Key className="w-5 h-5" />}
            color="from-amber-400 to-amber-600"
            bgColor="bg-amber-100"
            textColor="text-amber-600"
          />
        </Col>
      </Row>

      {/* 3. ACTION BAR */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          icon={<ReloadOutlined />}
          onClick={() => refetch?.()}
          loading={isLoading}
          size="middle"
          style={{
            borderColor: "var(--color-primary-color)",
            color: "var(--color-primary-color)",
          }}
        >
          Refresh
        </Button>
        <Button
          icon={<FilterOutlined />}
          onClick={() => setIsFilterVisible(!isFilterVisible)}
          size="middle"
          style={
            isFilterVisible || hasActiveFilters
              ? {
                  borderColor: "var(--color-primary-color)",
                  color: "var(--color-primary-color)",
                  background: "var(--color-primary-pale)",
                }
              : {
                  borderColor: "var(--color-primary-color)",
                  color: "var(--color-primary-color)",
                }
          }
        >
          Filters
          {hasActiveFilters && (
            <span
              className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[10px] font-bold"
              style={{ background: "var(--color-primary-color)" }}
            >
              !
            </span>
          )}
        </Button>
      </div>

      {/* 4. FILTER PANEL */}
      {isFilterVisible && (
        <div
          className="rounded-xl p-4"
          style={{
            background:
              "color-mix(in srgb, var(--color-primary-pale) 50%, white)",
            border: "1px solid var(--color-primary-pale)",
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Search
              </label>
              <Input
                placeholder="Search roles..."
                prefix={<Search className="w-3.5 h-3.5 text-gray-400" />}
                value={filters.search}
                onChange={(e) => handleSearch(e.target.value)}
                size="middle"
                allowClear
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Status
              </label>
              <Select
                value={filters.status || undefined}
                onChange={handleStatusFilter}
                placeholder="All statuses"
                allowClear
                className="w-full"
                size="middle"
                options={[
                  { value: "Active", label: "Active" },
                  { value: "Inactive", label: "Inactive" },
                ]}
              />
            </div>
            <div className="flex flex-col">
              <span className="block text-xs font-semibold text-transparent mb-1.5 uppercase tracking-wide select-none">
                &nbsp;
              </span>
              <button
                onClick={handleClearFilters}
                className="text-sm hover:underline cursor-pointer transition-colors font-medium h-8 flex items-center"
                style={{ color: "var(--color-primary-color)" }}
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. TABLE */}
      <div
        className="rounded-2xl bg-white ring-1 ring-gray-100 overflow-hidden"
        style={{
          boxShadow:
            "0 4px 6px -1px rgba(0,0,0,0.07), 0 10px 15px -3px rgba(0,0,0,0.07)",
        }}
      >
        {!isLoading && totalRoles === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Empty description="No Roles Found">
              {canWrite && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleCreate}
                  className="mt-4"
                  style={{
                    background: "var(--gradient-primary)",
                    border: "none",
                  }}
                >
                  Create First Role
                </Button>
              )}
            </Empty>
          </div>
        ) : (
          <Table
            dataSource={data}
            columns={columns}
            loading={{
              spinning: isLoading,
              indicator: <Spin size="large" style={{ marginTop: 50 }} />,
            }}
            rowKey="roleId"
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}–${range[1]} of ${total} roles`,
              pageSizeOptions: ["10", "20", "50", "100"],
              size: "default",
              responsive: true,
              className: "px-6 py-3",
            }}
            onChange={handleTableChange}
            scroll={{ x: 1000 }}
            size="middle"
            className="border-none"
            rowClassName="hover:bg-primary-pale/30 transition-colors"
          />
        )}
      </div>

      {/* 6. DRAWERS */}
      {/* Form owns its Drawer; entity=null → create, entity set → edit */}
      <RoleFormDrawer
        open={drawerOpen}
        entity={selectedRole}
        onClose={handleDrawerClose}
        onSuccess={handleDrawerClose}
      />

      <Drawer
        title={
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Key className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2
                className="text-lg font-bold"
                style={{ color: "var(--color-text-dark)" }}
              >
                Manage Permissions
              </h2>
              <p
                className="text-sm"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Configure access levels for this role
              </p>
            </div>
          </div>
        }
        placement="right"
        onClose={handlePermissionsDrawerClose}
        open={permissionsDrawerOpen}
        width={1000}
        styles={{ body: { paddingBottom: 0 } }}
        footer={null}
      >
        <PermissionsDrawer
          role={selectedRole}
          onClose={handlePermissionsDrawerClose}
        />
      </Drawer>
    </div>
  );
};

export default RolesPage;
