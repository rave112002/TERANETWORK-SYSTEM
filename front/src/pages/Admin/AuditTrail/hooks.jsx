import { useState, useCallback, useMemo } from "react";
import { App, Button, Dropdown } from "antd";
import dayjs from "dayjs";
import { Eye, MoreVertical } from "lucide-react";
import { useDebounce } from "../../../hooks/useDebounce";
import {
  useGetAuditTrail,
  useGetAuditDetail,
} from "../../../services/requests/admin/audit-trail";
import { exportAuditTrailApi } from "../../../services/api/admin/audit-trail";
import { decodeHTML } from "../../../utils/decode-html";

// Action verb → status-dot token. Tokens only, never a hardcoded hex.
export const ACTION_DOT = {
  CREATE: "var(--color-success)",
  UPDATE: "var(--color-warning)",
  DELETE: "var(--color-error)",
};

// Modules that are currently audited (see backend route middleware: auditTrail("..."))
const MODULE_OPTIONS = [
  { value: "users", label: "Users" },
  { value: "roles", label: "Roles" },
  { value: "user-permissions", label: "User Permissions" },
];

export const useAuditTrailHooks = () => {
  const { message } = App.useApp();

  // ─── Pagination ───────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isExporting, setIsExporting] = useState(false);

  // ─── Filters ──────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [dateRange, setDateRange] = useState(null); // [startDayjs, endDayjs] | null

  const debouncedSearch = useDebounce(search, 500);

  // ─── Detail modal ─────────────────────────────────────────────────
  const [selectedLog, setSelectedLog] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // ─── Data ─────────────────────────────────────────────────────────
  // Filters shared by the list query and the CSV export, so an export always
  // reflects exactly what the user is looking at.
  const activeFilters = useMemo(
    () => ({
      search: debouncedSearch,
      module: moduleFilter,
      startDate: dateRange?.[0]
        ? dayjs(dateRange[0]).format("YYYY-MM-DD")
        : undefined,
      endDate: dateRange?.[1]
        ? dayjs(dateRange[1]).format("YYYY-MM-DD")
        : undefined,
    }),
    [debouncedSearch, moduleFilter, dateRange],
  );

  const { data, isLoading, isFetching, error, refetch } = useGetAuditTrail({
    page: currentPage,
    pageSize,
    ...activeFilters,
  });

  // Full detail (adds userAgent, which the list query omits) for the open row
  const { data: detailData, isLoading: isDetailLoading } = useGetAuditDetail(
    isDetailOpen ? selectedLog?.auditId : null,
  );
  // Show the row immediately, then enrich it once the detail lands
  const detailLog = detailData?.data?.log
    ? { ...selectedLog, ...detailData.data.log }
    : selectedLog;

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const response = await exportAuditTrailApi(activeFilters);
      const url = URL.createObjectURL(
        new Blob([response.data], { type: "text/csv" }),
      );
      // Prefer the server's filename when it sends one
      const match = /filename="?([^"]+)"?/.exec(
        response.headers?.["content-disposition"] || "",
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = match?.[1] || "audit-trail.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      message.success("Audit trail exported");
    } catch (err) {
      message.error(
        err.response?.data?.message || "Failed to export audit trail",
      );
    } finally {
      setIsExporting(false);
    }
  }, [activeFilters, message]);

  // ─── Handlers ─────────────────────────────────────────────────────
  const handleViewDetails = useCallback((record) => {
    setSelectedLog(record);
    setIsDetailOpen(true);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setIsDetailOpen(false);
    setSelectedLog(null);
  }, []);

  const handleTableChange = useCallback((pagination) => {
    setCurrentPage(pagination.current);
    setPageSize(pagination.pageSize);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setModuleFilter("");
    setDateRange(null);
    setCurrentPage(1);
  }, []);

  // ⋮ menu — Audit Trail is read-only, so viewing is the only action.
  const getActionItems = useCallback(
    (record) => [
      {
        key: "view",
        label: "View details",
        icon: <Eye className="w-4 h-4" />,
        onClick: () => handleViewDetails(record),
      },
    ],
    [handleViewDetails],
  );

  // ─── Columns ──────────────────────────────────────────────────────
  // # (mono) · initial-avatar + user · action dot · module · description · ⋮
  const columns = useMemo(
    () => [
      {
        title: "#",
        key: "index",
        width: 56,
        render: (_, __, index) => (
          <span
            className="font-mono"
            style={{ fontSize: 12, color: "var(--color-text-muted)" }}
          >
            {String((currentPage - 1) * pageSize + index + 1).padStart(2, "0")}
          </span>
        ),
      },
      {
        title: "User",
        key: "user",
        width: 220,
        render: (_, record) => {
          const label =
            decodeHTML(
              [record.firstName, record.lastName].filter(Boolean).join(" "),
            ) ||
            record.accountId ||
            "—";
          const initial = (label.trim().charAt(0) || "?").toUpperCase();
          return (
            <div className="flex items-center gap-3 min-w-0">
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: "var(--color-surface-sunken)",
                  border: "1px solid var(--color-line)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                }}
              >
                {initial}
              </span>
              <span
                className="truncate"
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--color-text-dark)",
                }}
              >
                {label}
              </span>
            </div>
          );
        },
      },
      {
        title: "Action",
        dataIndex: "action",
        key: "action",
        width: 130,
        render: (action) => (
          <span
            className="inline-flex items-center gap-2"
            style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                flex: "none",
                background: ACTION_DOT[action] || "var(--color-text-muted)",
              }}
            />
            {action || "—"}
          </span>
        ),
      },
      {
        title: "Module",
        dataIndex: "module",
        key: "module",
        width: 160,
        render: (module) => (
          <span
            style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
          >
            {module || "—"}
          </span>
        ),
      },
      {
        title: "Description",
        dataIndex: "description",
        key: "description",
        ellipsis: true,
        render: (description) => (
          <span
            style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
          >
            {decodeHTML(description) || "—"}
          </span>
        ),
      },
      {
        title: "Date & time",
        dataIndex: "dateCreated",
        key: "dateCreated",
        width: 180,
        render: (date) => (
          <div className="min-w-0">
            <div style={{ fontSize: 13.5, color: "var(--color-text-dark)" }}>
              {dayjs(date).format("MMM D, YYYY")}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {dayjs(date).format("h:mm:ss A")}
            </div>
          </div>
        ),
      },
      {
        title: "IP address",
        dataIndex: "ipAddress",
        key: "ipAddress",
        width: 150,
        render: (ip) => (
          <span
            className="font-mono"
            style={{ fontSize: 12, color: "var(--color-text-muted)" }}
          >
            {ip || "—"}
          </span>
        ),
      },
      {
        title: "",
        key: "actions",
        width: 60,
        align: "right",
        render: (_, record) => (
          <Dropdown
            menu={{ items: getActionItems(record) }}
            trigger={["click"]}
            placement="bottomRight"
          >
            <Button
              type="text"
              icon={<MoreVertical className="w-4 h-4" />}
              className="hover:bg-(--color-surface-sunken)"
            />
          </Dropdown>
        ),
      },
    ],
    [getActionItems, currentPage, pageSize],
  );

  const isSearching = search !== debouncedSearch;

  return {
    // Data
    logs: data?.data?.logs || [],
    pagination: data?.data?.pagination || { total: 0, page: 1, pageSize: 10 },
    isLoading,
    isFetching,
    error,
    refetch,

    // Columns
    columns,

    // Pagination
    currentPage,
    pageSize,
    handleTableChange,

    // Filters
    search,
    setSearch,
    moduleFilter,
    setModuleFilter,
    dateRange,
    setDateRange,
    moduleOptions: MODULE_OPTIONS,
    handleClearFilters,
    isSearching,

    // Detail modal
    selectedLog: detailLog,
    isDetailOpen,
    isDetailLoading,
    handleViewDetails,
    handleCloseDetails,
    getActionItems,

    // Export
    handleExport,
    isExporting,
  };
};
