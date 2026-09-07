import { useCallback, useMemo, useState } from "react";
import { KeyRound, Pencil, Trash2 } from "lucide-react";

import RowActions from "../../../../components/RowActions";
import { usePermissions } from "../../../../hooks/usePermissions";
import {
  useDeleteOlt,
  useGetOlts,
} from "../../../../services/requests/admin/network/olts";
import { confirm } from "../../../../store/confirmStore";
import { decodeHTML } from "../../../../utils/decode-html";

/** Device status is a lifecycle, not a binary — each needs its own dot. */
const STATUS_DOT = {
  Active: "var(--color-success)",
  Maintenance: "var(--color-warning)",
  Retired: "var(--color-text-muted)",
  Deleted: "var(--color-error)",
};

export const useOltsData = () => {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("network", "olts", "write");

  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [filters, setFilters] = useState({ search: "", status: "" });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedOlt, setSelectedOlt] = useState(null);

  const { data, isLoading, isFetching, error, refetch } = useGetOlts({
    page: pagination.current,
    pageSize: pagination.pageSize,
    search: filters.search,
    status: filters.status,
  });

  const deleteMutation = useDeleteOlt();

  const handleTableChange = useCallback((next) => {
    setPagination({ current: next.current, pageSize: next.pageSize });
  }, []);

  const handleSearch = useCallback((value) => {
    setFilters((prev) => ({ ...prev, search: value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleStatusFilter = useCallback((value) => {
    setFilters((prev) => ({ ...prev, status: value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ search: "", status: "" });
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleCreate = useCallback(() => {
    setSelectedOlt(null);
    setDrawerOpen(true);
  }, []);

  const handleEdit = useCallback((record) => {
    setSelectedOlt(record);
    setDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    setSelectedOlt(null);
  }, []);

  const handleDeleteRequest = useCallback(
    async (record) => {
      const ok = await confirm({
        title: "Delete OLT",
        description: `Delete "${decodeHTML(record.name)}"? Its stored credentials are erased, and any PON ports must be removed first.`,
        confirmText: "Delete",
        cancelText: "Cancel",
        danger: true,
      });
      if (ok) deleteMutation.mutate(record.oltId);
    },
    [deleteMutation],
  );

  const getActionItems = useCallback(
    (record) => {
      if (!canWrite) return [];
      return [
        {
          key: "edit",
          label: "Edit OLT",
          icon: <Pencil className="w-4 h-4" />,
          onClick: () => handleEdit(record),
        },
        { type: "divider" },
        {
          key: "delete",
          label: "Delete OLT",
          icon: <Trash2 className="w-4 h-4" />,
          danger: true,
          onClick: () => handleDeleteRequest(record),
        },
      ];
    },
    [canWrite, handleEdit, handleDeleteRequest],
  );

  const columns = useMemo(
    () => [
      {
        title: "Device",
        key: "device",
        render: (_, record) => (
          <div className="min-w-0">
            <div
              className="truncate"
              style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-dark)" }}
            >
              {decodeHTML(record.name)}
            </div>
            <div
              className="truncate"
              style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
            >
              {decodeHTML(record.vendor)?.toUpperCase()}
              {record.model ? ` · ${decodeHTML(record.model)}` : ""}
              {` · ${decodeHTML(record.ponTechnology)?.toUpperCase()}`}
            </div>
          </div>
        ),
      },
      {
        title: "Management",
        key: "management",
        width: 220,
        // Monospaced: an address staff copy into a terminal.
        render: (_, record) => (
          <div className="min-w-0">
            <div className="font-mono truncate" style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
              {record.host}:{record.port}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {String(record.protocol || "").toUpperCase()}
            </div>
          </div>
        ),
      },
      {
        title: "Credentials",
        key: "credentials",
        width: 140,
        render: (_, record) =>
          record.hasCredentials ? (
            <span
              className="inline-flex items-center gap-1.5"
              style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}
            >
              <KeyRound className="w-3.5 h-3.5" style={{ color: "var(--color-success)" }} />
              Stored
            </span>
          ) : (
            <span style={{ fontSize: 12.5, color: "var(--color-warning)" }}>Not set</span>
          ),
      },
      {
        title: "PON ports",
        dataIndex: "ponPortCount",
        key: "ponPortCount",
        width: 110,
        align: "right",
        render: (count) => (
          <span className="font-mono" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            {Number(count) || 0}
          </span>
        ),
      },
      {
        title: "Branch",
        dataIndex: "branchName",
        key: "branchName",
        width: 170,
        ellipsis: true,
        render: (name) => (
          <span style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
            {decodeHTML(name) || "—"}
          </span>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 140,
        render: (status) => (
          <span
            className="inline-flex items-center gap-2"
            style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: STATUS_DOT[status] || "var(--color-text-muted)",
                boxShadow:
                  status === "Active"
                    ? "0 0 8px color-mix(in srgb, var(--color-success) 50%, transparent)"
                    : "none",
              }}
            />
            {status}
          </span>
        ),
      },
      {
        title: "",
        key: "actions",
        width: 60,
        align: "right",
        render: (_, record) => <RowActions items={getActionItems(record)} />,
      },
    ],
    [getActionItems],
  );

  return {
    data: data?.data?.olts || [],
    pagination: { ...pagination, total: data?.data?.pagination?.total || 0 },
    filters,
    isLoading,
    isFetching,
    error,
    refetch,
    canWrite,
    columns,
    handleTableChange,
    handleSearch,
    handleStatusFilter,
    handleClearFilters,
    drawerOpen,
    selectedOlt,
    handleCreate,
    handleDrawerClose,
  };
};
