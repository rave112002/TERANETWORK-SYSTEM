import { FilterOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  DatePicker,
  Empty,
  Input,
  Select,
  Spin,
  Table,
  Typography,
} from "antd";
import { useState } from "react";
import { FileText, Search } from "lucide-react";
import { useAuditTrailHooks } from "./hooks";
import AuditDetailModal from "./components/AuditDetailModal";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const AuditTrailPage = () => {
  const {
    logs,
    pagination,
    isLoading,
    isFetching,
    error,
    refetch,
    columns,
    currentPage,
    pageSize,
    handleTableChange,
    search,
    setSearch,
    moduleFilter,
    setModuleFilter,
    dateRange,
    setDateRange,
    moduleOptions,
    handleClearFilters,
    isSearching,
    selectedLog,
    isDetailOpen,
    handleCloseDetails,
  } = useAuditTrailHooks();

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const hasActiveFilters = !!(
    search ||
    moduleFilter ||
    (dateRange && (dateRange[0] || dateRange[1]))
  );

  if (error) {
    return (
      <div className="p-6">
        <Alert
          message="Error Loading Audit Trail"
          description={
            error.message || "Failed to load audit logs. Please try again."
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
              <FileText className="w-5 h-5 text-white" />
            </div>
            Audit Trail
          </Title>
          <Text
            style={{ color: "var(--color-text-secondary)" }}
            className="text-sm"
          >
            View system activity logs and audit history
          </Text>
        </div>
      </div>

      {/* 2. ACTION BAR */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          icon={<ReloadOutlined />}
          onClick={() => refetch()}
          loading={isFetching}
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

      {/* 3. FILTER PANEL */}
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
                placeholder="Search action or description..."
                prefix={<Search className="w-3.5 h-3.5 text-gray-400" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                size="middle"
                className={isSearching ? "bg-yellow-50 border-yellow-300" : ""}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Module
              </label>
              <Select
                value={moduleFilter || undefined}
                onChange={(value) => setModuleFilter(value || "")}
                placeholder="All modules"
                allowClear
                className="w-full"
                size="middle"
                options={moduleOptions}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Date Range
              </label>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                className="w-full"
                size="middle"
                allowClear
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

      {/* 4. TABLE */}
      <div
        className="rounded-2xl bg-white ring-1 ring-gray-100 overflow-hidden"
        style={{
          boxShadow:
            "0 4px 6px -1px rgba(0,0,0,0.07), 0 10px 15px -3px rgba(0,0,0,0.07)",
        }}
      >
        {!isLoading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Empty description="No audit logs found" />
          </div>
        ) : (
          <Table
            dataSource={logs}
            columns={columns}
            loading={{
              spinning: isLoading,
              indicator: <Spin size="large" style={{ marginTop: 50 }} />,
            }}
            rowKey="auditId"
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: pagination?.total || 0,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}–${range[1]} of ${total} events`,
              pageSizeOptions: ["10", "20", "50", "100"],
              size: "default",
              responsive: true,
              className: "px-6 py-3",
            }}
            onChange={handleTableChange}
            scroll={{ x: 1100 }}
            size="middle"
            className="border-none"
            rowClassName="hover:bg-primary-pale/30 transition-colors"
          />
        )}
      </div>

      {/* 5. DETAIL MODAL */}
      <AuditDetailModal
        open={isDetailOpen}
        onClose={handleCloseDetails}
        log={selectedLog}
      />
    </div>
  );
};

export default AuditTrailPage;
