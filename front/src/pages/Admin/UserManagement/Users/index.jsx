import {
  DeleteOutlined,
  FilterOutlined,
  PlusOutlined,
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
import { CheckCircle, Search, UserX, Users } from "lucide-react";
import { useUserHooks } from "./hooks";
import UserFormDrawer from "./components/UserFormDrawer";
import UserViewModal from "./components/UserViewModal";
import UserPermissionsDrawer from "./components/UserPermissionsDrawer";
import PageHeader from "../../../../components/PageHeader";
import PaginationFooter from "../../../../components/PaginationFooter";
import StatCard from "../../../../components/StatCard";
import RefreshButton from "../../../../components/RefreshButton";

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

  if (error) {
    return (
      <div className="p-8">
        <Alert
          message="Error loading users"
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
    <div className="p-8 space-y-5">
      {/* 1. HEADER */}
      <PageHeader
        title="Users"
        subtitle="Manage team members, their roles and their permissions."
        actions={
          canWrite && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreateDrawer}
            >
              New user
            </Button>
          )
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
            icon={<CheckCircle className="w-4.25 h-4.25" strokeWidth={1.8} />}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Inactive users"
            value={inactiveUsers}
            change="on this page"
            icon={<UserX className="w-4.25 h-4.25" strokeWidth={1.8} />}
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
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            allowClear
            style={{ width: 280 }}
          />
          <div className="flex items-center gap-2">
            {hasSelectedRows && canWrite && (
              <Popconfirm
                title="Delete selected users"
                description={`Delete ${selectedRowKeys.length} user(s)? This can't be undone.`}
                onConfirm={handleBulkDelete}
                okText="Delete"
                okType="danger"
                cancelText="Cancel"
              >
                <Button danger icon={<DeleteOutlined />} loading={isLoading}>
                  Delete selected ({selectedRowKeys.length})
                </Button>
              </Popconfirm>
            )}
            <RefreshButton onRefresh={refetch} isFetching={isFetching} />
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
            <Empty description="No users found">
              {canWrite && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleOpenCreateDrawer}
                >
                  New user
                </Button>
              )}
            </Empty>
          </div>
        ) : (
          <>
            <Table
              dataSource={users}
              columns={columns}
              rowSelection={rowSelection}
              rowKey="accountId"
              pagination={false}
              loading={{
                spinning: isLoading,
                indicator: <Spin size="large" style={{ marginTop: 50 }} />,
              }}
              onChange={handleTableChange}
              scroll={{ x: 1000 }}
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

      {/* 4. DRAWERS & MODALS */}
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

      <UserPermissionsDrawer
        open={isPermissionsDrawerOpen}
        user={permissionsUser}
        onClose={handleClosePermissionsDrawer}
      />
    </div>
  );
};

export default UsersPage;
