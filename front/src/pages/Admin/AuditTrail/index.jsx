import { DownloadOutlined, FilterOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Col,
  DatePicker,
  Empty,
  Input,
  Row,
  Select,
  Spin,
  Table,
} from "antd";
import { useState } from "react";
import { Activity, Search, Trash2, Users } from "lucide-react";
import { useAuditTrailHooks } from "./hooks";
import AuditDetailModal from "./components/AuditDetailModal";
import PageHeader from "../../../components/PageHeader";
import PaginationFooter from "../../../components/PaginationFooter";
import StatCard from "../../../components/StatCard";

const { RangePicker } = DatePicker;

// Uppercase micro-label above a filter control.
const FilterLabel = ({ children }) => (
  <span
    className="uppercase"
    style={{
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.08em",
      color: "var(--color-text-muted)",
    }}
  >
    {children}
  </span>
);

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
    selectedLog,
    isDetailOpen,
    handleCloseDetails,
    handleExport,
    isExporting,
  } = useAuditTrailHooks();

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const hasActiveFilters = !!(
    search ||
    moduleFilter ||
    (dateRange && (dateRange[0] || dateRange[1]))
  );
  const isEmpty = !isLoading && logs.length === 0;

  const totalEvents = pagination?.total || 0;
  const uniqueUsers = new Set(logs.map((l) => l.accountId).filter(Boolean)).size;
  const deletions = logs.filter((l) => l.action === "DELETE").length;

  if (error) {
    return (
      <div className="p-8">
        <Alert
          message="Error loading audit trail"
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
    <div className="p-8 space-y-5">
      {/* 1. HEADER — read-only module, so no primary action */}
      <PageHeader
        title="Audit Trail"
        subtitle="View system activity logs and audit history."
      />

      {/* 2. STAT CARDS */}
      <Row gutter={[14, 14]}>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Total events"
            value={totalEvents}
            change="all time"
            icon={<Activity className="w-4.25 h-4.25" strokeWidth={1.8} />}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Users involved"
            value={uniqueUsers}
            change="on this page"
            icon={<Users className="w-4.25 h-4.25" strokeWidth={1.8} />}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Deletions"
            value={deletions}
            change="on this page"
            icon={<Trash2 className="w-4.25 h-4.25" strokeWidth={1.8} />}
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
            placeholder="Filter events…"
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
              icon={<DownloadOutlined />}
              onClick={handleExport}
              loading={isExporting}
            >
              Export CSV
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetch()}
              loading={isFetching}
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
              <FilterLabel>Module</FilterLabel>
              <Select
                value={moduleFilter || undefined}
                onChange={(value) => setModuleFilter(value || "")}
                placeholder="All modules"
                allowClear
                style={{ width: 200 }}
                options={moduleOptions}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <FilterLabel>Date range</FilterLabel>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                allowClear
                style={{ width: 260 }}
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
            <Empty description="No audit logs found" />
          </div>
        ) : (
          <>
            <Table
              dataSource={logs}
              columns={columns}
              rowKey="auditId"
              pagination={false}
              loading={{
                spinning: isLoading,
                indicator: <Spin size="large" style={{ marginTop: 50 }} />,
              }}
              onChange={handleTableChange}
              scroll={{ x: 1100 }}
              size="middle"
              className="border-none"
            />
            <PaginationFooter
              pagination={{ current: currentPage, pageSize, total: totalEvents }}
              onChange={handleTableChange}
              noun="event"
            />
          </>
        )}
      </div>

      {/* 4. DETAIL MODAL */}
      <AuditDetailModal
        open={isDetailOpen}
        onClose={handleCloseDetails}
        log={selectedLog}
      />
    </div>
  );
};

export default AuditTrailPage;
