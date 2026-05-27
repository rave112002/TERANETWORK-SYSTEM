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
  Drawer,
  Empty,
  Input,
  Popconfirm,
  Row,
  Select,
  Spin,
  Table,
  Typography,
} from "antd";
import { useState } from "react";
import { Search, Users } from "lucide-react";
import { useUserHooks } from "./hooks";
import UserFormDrawer from "./components/UserFormDrawer";
import UserViewModal from "./components/UserViewModal";
import UserPermissionsDrawer from "./components/UserPermissionsDrawer";
import StatCard from "../../../../components/StatCard";

const { Title, Text } = Typography;

const UsersPage = () => {
  const {
    data,
    isLoading,
    error,
    canWrite,
    columns,
    currentPage,
    pageSize,
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
    setSearch,
    statusFilter,
    setStatusFilter,
    handleClearFilters,
    isSearching,
  } = useUserHooks();

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const totalUsers = data?.users?.length || 0;
  const activeUsers =
    data?.users?.filter((u) => u.status === "Active").length || 0;
  const inactiveUsers = totalUsers - activeUsers;
  const hasSelectedRows = selectedRowKeys.length > 0;
  const hasActiveFilters = search || statusFilter;

  if (error) {
    return (
      <div className="p-6">
        <Alert
          message="Error Loading Users"
          description={
            error.message || "Failed to load users data. Please try again."
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
              <Users className="w-5 h-5 text-white" />
            </div>
            User Management
          </Title>
          <Text
            style={{ color: "var(--color-text-secondary)" }}
            className="text-sm"
          >
            Manage team members and their permissions
          </Text>
        </div>
        {canWrite && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreateDrawer}
            size="large"
            style={{
              background: "var(--gradient-primary)",
              border: "none",
              boxShadow:
                "0 4px 12px color-mix(in srgb, var(--color-primary-color) 35%, transparent)",
            }}
          >
            Add New User
          </Button>
        )}
      </div>

      {/* 2. STAT CARDS */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Total Users"
            value={totalUsers}
            icon={<Users className="w-5 h-5" />}
            color="from-primary-color to-secondary-color"
            bgColor="bg-primary-pale"
            textColor="text-primary-color"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Active"
            value={activeUsers}
            icon={<Users className="w-5 h-5" />}
            color="from-emerald-400 to-emerald-600"
            bgColor="bg-emerald-100"
            textColor="text-emerald-600"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Inactive"
            value={inactiveUsers}
            icon={<Users className="w-5 h-5" />}
            color="from-orange-400 to-orange-600"
            bgColor="bg-orange-100"
            textColor="text-orange-600"
          />
        </Col>
        {hasSelectedRows && (
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="Selected"
              value={selectedRowKeys.length}
              icon={<Users className="w-5 h-5" />}
              color="from-amber-400 to-amber-600"
              bgColor="bg-amber-100"
              textColor="text-amber-600"
            />
          </Col>
        )}
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
        {hasSelectedRows && canWrite && (
          <Popconfirm
            title="Delete Selected Users"
            description={`Are you sure you want to delete ${selectedRowKeys.length} user(s)?`}
            onConfirm={handleBulkDelete}
            okText="Delete"
            okType="danger"
            cancelText="Cancel"
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={isLoading}
              size="middle"
            >
              Delete Selected ({selectedRowKeys.length})
            </Button>
          </Popconfirm>
        )}
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
                placeholder="Search users..."
                prefix={<Search className="w-3.5 h-3.5 text-gray-400" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                size="middle"
                className={isSearching ? "bg-yellow-50 border-yellow-300" : ""}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Status
              </label>
              <Select
                value={statusFilter || undefined}
                onChange={setStatusFilter}
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
        {!isLoading && totalUsers === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Empty description="No Users Found">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleOpenCreateDrawer}
                className="mt-4"
                style={{
                  background: "var(--gradient-primary)",
                  border: "none",
                }}
              >
                Add First User
              </Button>
            </Empty>
          </div>
        ) : (
          <Table
            dataSource={data?.users}
            columns={columns}
            rowSelection={rowSelection}
            loading={{
              spinning: isLoading,
              indicator: <Spin size="large" style={{ marginTop: 50 }} />,
            }}
            rowKey="accountId"
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: data?.pagination?.total || 0,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}–${range[1]} of ${total} users`,
              pageSizeOptions: ["10", "20", "50", "100"],
              size: "default",
              responsive: true,
              className: "px-6 py-3",
            }}
            onChange={handleTableChange}
            scroll={{ x: 1400 }}
            size="middle"
            className="border-none"
            rowClassName="hover:bg-primary-pale/30 transition-colors"
          />
        )}
      </div>

      {/* 6. DRAWERS & MODALS */}
      {/* Form owns its Drawer; entity=null → create, entity set → edit */}
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

      <Drawer
        title={
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Users className="w-5 h-5 text-white" />
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
                Configure user access levels
              </p>
            </div>
          </div>
        }
        placement="right"
        onClose={handleClosePermissionsDrawer}
        open={isPermissionsDrawerOpen}
        width={1000}
        styles={{ body: { padding: 0 } }}
        footer={null}
      >
        <UserPermissionsDrawer
          user={permissionsUser}
          onClose={handleClosePermissionsDrawer}
        />
      </Drawer>
    </div>
  );
};

export default UsersPage;
