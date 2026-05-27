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
  Typography,
} from "antd";
import { useState } from "react";
import { Search, Building2 } from "lucide-react";
import { useOrganizationHooks } from "./hooks";
import OrganizationFormDrawer from "./components/OrganizationFormDrawer";
import ViewOrganizationModal from "./components/ViewOrganizationModal";
import StatCard from "../../../components/StatCard";

const { Title, Text } = Typography;

const Organizations = () => {
  const {
    data,
    isLoading,
    error,
    refetch,
    columns,
    currentPage,
    pageSize,
    handleTableChange,
    selectedRowKeys,
    rowSelection,
    handleBulkDelete,
    editingOrganization,
    handleCloseEditModal,
    isViewModalVisible,
    viewingOrganization,
    handleViewModalCancel,
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
    isSearching,
  } = useOrganizationHooks();

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const totalOrganizations = data?.organizations?.length || 0;
  const activeOrganizations =
    data?.organizations?.filter((c) => c.status === "Active").length || 0;
  const inactiveOrganizations = totalOrganizations - activeOrganizations;
  const hasSelectedRows = selectedRowKeys.length > 0;
  const hasActiveFilters = statusFilter || subscriptionFilter || search;

  if (error) {
    return (
      <div className="p-6">
        <Alert
          message="Error Loading Organizations"
          description={
            error.message ||
            "Failed to load organizations data. Please try again."
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
              <Building2 className="w-5 h-5 text-white" />
            </div>
            Organization Management
          </Title>
          <Text
            style={{ color: "var(--color-text-secondary)" }}
            className="text-sm"
          >
            Manage all organizations and their information
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreateModal}
          size="large"
          style={{
            background: "var(--gradient-primary)",
            border: "none",
            boxShadow:
              "0 4px 12px color-mix(in srgb, var(--color-primary-color) 35%, transparent)",
          }}
        >
          Add Organization
        </Button>
      </div>

      {/* 2. STAT CARDS */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Total Organizations"
            value={totalOrganizations}
            icon={<Building2 className="w-5 h-5" />}
            color="from-primary-color to-secondary-color"
            bgColor="bg-primary-pale"
            textColor="text-primary-color"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Active"
            value={activeOrganizations}
            icon={<Building2 className="w-5 h-5" />}
            color="from-emerald-400 to-emerald-600"
            bgColor="bg-emerald-100"
            textColor="text-emerald-600"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Inactive"
            value={inactiveOrganizations}
            icon={<Building2 className="w-5 h-5" />}
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
              icon={<Building2 className="w-5 h-5" />}
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
        {hasSelectedRows && (
          <Popconfirm
            title="Delete Selected Organizations"
            description={`Are you sure you want to delete ${selectedRowKeys.length} organization(s)?`}
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
                placeholder="Search organizations..."
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
                  { value: "Suspended", label: "Suspended" },
                  { value: "Pending", label: "Pending" },
                  { value: "Deleted", label: "Deleted" },
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Subscription
              </label>
              <Select
                value={subscriptionFilter || undefined}
                onChange={setSubscriptionFilter}
                placeholder="All plans"
                allowClear
                className="w-full"
                size="middle"
                options={[
                  { value: "Basic", label: "Basic" },
                  { value: "Standard", label: "Standard" },
                  { value: "Premium", label: "Premium" },
                  { value: "Enterprise", label: "Enterprise" },
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
        {!isLoading && totalOrganizations === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Empty description="No Organizations Found">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleOpenCreateModal}
                className="mt-4"
                style={{
                  background: "var(--gradient-primary)",
                  border: "none",
                }}
              >
                Add First Organization
              </Button>
            </Empty>
          </div>
        ) : (
          <Table
            dataSource={data?.organizations}
            columns={columns}
            rowSelection={rowSelection}
            loading={{
              spinning: isLoading,
              indicator: <Spin size="large" style={{ marginTop: 50 }} />,
            }}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: data?.pagination?.total || 0,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}–${range[1]} of ${total} organizations`,
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
      <OrganizationFormDrawer
        open={isCreateModalOpen || !!editingOrganization}
        entity={editingOrganization}
        onClose={
          editingOrganization ? handleCloseEditModal : handleCloseCreateModal
        }
        onSuccess={
          editingOrganization ? handleCloseEditModal : handleCloseCreateModal
        }
      />

      <ViewOrganizationModal
        open={isViewModalVisible}
        onClose={handleViewModalCancel}
        organization={viewingOrganization}
      />
    </div>
  );
};

export default Organizations;
