import {
  FilterOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Empty,
  Input,
  Select,
  Spin,
  Table,
  Typography,
} from "antd";
import { useState } from "react";
import { Search, MapPin } from "lucide-react";
import { useBranchHooks } from "./hooks";
import CreateBranchDrawer from "./components/CreateBranchDrawer";

const { Title, Text } = Typography;

const BranchesPage = () => {
  const {
    data,
    isLoading,
    error,
    refetch,
    columns,
    currentPage,
    pageSize,
    handleTableChange,
    isCreateDrawerOpen,
    handleOpenCreateDrawer,
    handleCloseCreateDrawer,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    brandFilter,
    setBrandFilter,
    handleClearFilters,
    isSearching,
    orgOptions,
  } = useBranchHooks();

  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const hasActiveFilters = statusFilter || brandFilter || search;

  if (error) {
    return (
      <div className="p-6">
        <Alert
          message="Error Loading Branches"
          description={error.message || "Failed to load branches."}
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* PAGE HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <Title level={2} className="mb-1! flex items-center gap-3">
            <div
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl shadow-md"
              style={{ background: "var(--gradient-primary)" }}
            >
              <MapPin className="w-5 h-5 text-white" />
            </div>
            Branches
          </Title>
          <Text
            style={{ color: "var(--color-text-secondary)" }}
            className="text-sm"
          >
            Manage branches across all organizations
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreateDrawer}
          size="large"
          style={{ background: "var(--gradient-primary)", border: "none" }}
        >
          Add Branch
        </Button>
      </div>

      {/* ACTION BAR */}
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
        </Button>
      </div>

      {/* FILTER PANEL */}
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
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Search
              </label>
              <Input
                placeholder="Search branches..."
                prefix={<Search className="w-3.5 h-3.5 text-gray-400" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                size="middle"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Organization
              </label>
              <Select
                value={brandFilter || undefined}
                onChange={setBrandFilter}
                placeholder="All organizations"
                allowClear
                className="w-full"
                size="middle"
                options={orgOptions}
                showSearch
                optionFilterProp="label"
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
                  { value: "Deleted", label: "Deleted" },
                ]}
              />
            </div>
            <div className="flex flex-col">
              <span className="block text-xs font-semibold text-transparent mb-1.5">
                &nbsp;
              </span>
              <button
                onClick={handleClearFilters}
                className="text-sm hover:underline cursor-pointer font-medium h-8 flex items-center"
                style={{ color: "var(--color-primary-color)" }}
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TABLE */}
      <div
        className="rounded-2xl bg-white ring-1 ring-gray-100 overflow-hidden"
        style={{ boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)" }}
      >
        {!isLoading && (data?.branches?.length || 0) === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Empty description="No Branches Found" />
          </div>
        ) : (
          <Table
            dataSource={data?.branches}
            columns={columns}
            loading={{
              spinning: isLoading,
              indicator: <Spin size="large" style={{ marginTop: 50 }} />,
            }}
            rowKey="branchId"
            pagination={{
              current: currentPage,
              pageSize,
              total: data?.pagination?.total || 0,
              showSizeChanger: true,
              showTotal: (total, range) =>
                `${range[0]}–${range[1]} of ${total} branches`,
              pageSizeOptions: ["10", "20", "50"],
            }}
            onChange={handleTableChange}
            scroll={{ x: 900 }}
            size="middle"
          />
        )}
      </div>

      {/* DRAWERS */}
      <CreateBranchDrawer
        open={isCreateDrawerOpen}
        onClose={handleCloseCreateDrawer}
        onSuccess={handleCloseCreateDrawer}
      />
    </div>
  );
};

export default BranchesPage;
