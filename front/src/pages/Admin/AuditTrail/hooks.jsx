import { useState, useCallback, useMemo } from "react";
import { Button, Tag, Tooltip } from "antd";
import dayjs from "dayjs";
import { Eye, Plus, Pencil, Trash2, User as UserIcon } from "lucide-react";
import { useDebounce } from "../../../hooks/useDebounce";
import { useGetAuditTrail } from "../../../services/requests/admin/audit-trail";

// Action verb → tag color + icon
const ACTION_CONFIG = {
  CREATE: { color: "success", icon: Plus },
  UPDATE: { color: "processing", icon: Pencil },
  DELETE: { color: "error", icon: Trash2 },
};

// Modules that are currently audited (see backend route middleware: auditTrail("..."))
const MODULE_OPTIONS = [
  { value: "users", label: "Users" },
  { value: "roles", label: "Roles" },
  { value: "user-permissions", label: "User Permissions" },
];

export const useAuditTrailHooks = () => {
  // ─── Pagination ───────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ─── Filters ──────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [dateRange, setDateRange] = useState(null); // [startDayjs, endDayjs] | null

  const debouncedSearch = useDebounce(search, 500);

  // ─── Detail modal ─────────────────────────────────────────────────
  const [selectedLog, setSelectedLog] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // ─── Data ─────────────────────────────────────────────────────────
  const { data, isLoading, isFetching, error, refetch } = useGetAuditTrail({
    page: currentPage,
    pageSize,
    search: debouncedSearch,
    module: moduleFilter,
    startDate: dateRange?.[0]
      ? dayjs(dateRange[0]).format("YYYY-MM-DD")
      : undefined,
    endDate: dateRange?.[1]
      ? dayjs(dateRange[1]).format("YYYY-MM-DD")
      : undefined,
  });

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

  // ─── Columns ──────────────────────────────────────────────────────
  const columns = useMemo(
    () => [
      {
        title: "Date & Time",
        dataIndex: "dateCreated",
        key: "dateCreated",
        fixed: "left",
        width: 180,
        render: (date) => (
          <div className="min-w-0">
            <div
              className="font-medium"
              style={{ color: "var(--color-text-dark)" }}
            >
              {dayjs(date).format("MMM D, YYYY")}
            </div>
            <div
              className="text-xs"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {dayjs(date).format("h:mm:ss A")}
            </div>
          </div>
        ),
      },
      {
        title: "User",
        key: "user",
        width: 200,
        render: (_, record) => {
          const name = [record.firstName, record.lastName]
            .filter(Boolean)
            .join(" ");
          return (
            <div className="flex items-center gap-2 min-w-0">
              <UserIcon className="w-4 h-4 text-gray-400 shrink-0" />
              <span
                className="truncate"
                style={{ color: "var(--color-text-dark)" }}
              >
                {name || record.accountId || "—"}
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
        render: (action) => {
          const cfg = ACTION_CONFIG[action] || { color: "default", icon: null };
          const Icon = cfg.icon;
          return (
            <Tag
              icon={Icon ? <Icon className="w-3 h-3" /> : null}
              color={cfg.color}
            >
              {action}
            </Tag>
          );
        },
      },
      {
        title: "Module",
        dataIndex: "module",
        key: "module",
        width: 160,
        render: (module) => <Tag>{module}</Tag>,
      },
      {
        title: "Description",
        dataIndex: "description",
        key: "description",
        render: (description) => (
          <span
            className="truncate"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {description || "—"}
          </span>
        ),
      },
      {
        title: "IP Address",
        dataIndex: "ipAddress",
        key: "ipAddress",
        width: 150,
        render: (ip) => (
          <span
            className="font-mono text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            {ip || "—"}
          </span>
        ),
      },
      {
        title: "",
        key: "actions",
        fixed: "right",
        width: 60,
        render: (_, record) => (
          <Tooltip title="View details">
            <Button
              type="text"
              icon={<Eye className="w-4 h-4" />}
              onClick={() => handleViewDetails(record)}
              className="hover:bg-gray-100"
            />
          </Tooltip>
        ),
      },
    ],
    [handleViewDetails],
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
    selectedLog,
    isDetailOpen,
    handleViewDetails,
    handleCloseDetails,
  };
};
