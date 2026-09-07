import { useCallback, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import RowActions from "../../../../components/RowActions";
import { usePermissions } from "../../../../hooks/usePermissions";
import {
  useDeletePonPort,
  useGetPonPorts,
} from "../../../../services/requests/admin/network/pon-ports";
import { useGetOlts } from "../../../../services/requests/admin/network/olts";
import { confirm } from "../../../../store/confirmStore";
import { decodeHTML } from "../../../../utils/decode-html";

const STATUS_DOT = {
  Active: "var(--color-success)",
  Down: "var(--color-error)",
  Reserved: "var(--color-warning)",
  Deleted: "var(--color-text-muted)",
};

export const usePonPortsData = () => {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("network", "pon_ports", "write");

  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [filters, setFilters] = useState({ search: "", status: "", oltId: "" });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPonPort, setSelectedPonPort] = useState(null);

  const { data, isLoading, isFetching, error, refetch } = useGetPonPorts({
    page: pagination.current,
    pageSize: pagination.pageSize,
    search: filters.search,
    status: filters.status,
    oltId: filters.oltId,
  });

  // Drives the OLT filter and the drawer's parent picker. One page of devices is
  // plenty — an ISP with more than 100 OLTs is not this deployment.
  const { data: oltsData } = useGetOlts({ page: 1, pageSize: 100, status: "Active" });
  const oltOptions = useMemo(
    () =>
      (oltsData?.data?.olts || []).map((o) => ({
        value: o.oltId,
        label: decodeHTML(o.name),
      })),
    [oltsData],
  );

  const deleteMutation = useDeletePonPort();

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

  const handleOltFilter = useCallback((value) => {
    setFilters((prev) => ({ ...prev, oltId: value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ search: "", status: "", oltId: "" });
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleCreate = useCallback(() => {
    setSelectedPonPort(null);
    setDrawerOpen(true);
  }, []);

  const handleEdit = useCallback((record) => {
    setSelectedPonPort(record);
    setDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    setSelectedPonPort(null);
  }, []);

  const handleDeleteRequest = useCallback(
    async (record) => {
      const ok = await confirm({
        title: "Delete PON port",
        description: `Delete port ${record.portIndex} on ${decodeHTML(record.oltName)}? Any splitters or ONUs on it must be removed first.`,
        confirmText: "Delete",
        cancelText: "Cancel",
        danger: true,
      });
      if (ok) deleteMutation.mutate(record.ponPortId);
    },
    [deleteMutation],
  );

  const getActionItems = useCallback(
    (record) => {
      if (!canWrite) return [];
      return [
        {
          key: "edit",
          label: "Edit port",
          icon: <Pencil className="w-4 h-4" />,
          onClick: () => handleEdit(record),
        },
        { type: "divider" },
        {
          key: "delete",
          label: "Delete port",
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
        title: "Port",
        key: "port",
        width: 190,
        render: (_, record) => (
          <div className="min-w-0">
            <div className="font-mono" style={{ fontSize: 13.5, fontWeight: 500, color: "var(--color-text-dark)" }}>
              {record.portIndex}
            </div>
            <div className="truncate" style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
              {decodeHTML(record.oltName) || "—"}
            </div>
          </div>
        ),
      },
      {
        title: "Description",
        dataIndex: "description",
        key: "description",
        ellipsis: true,
        render: (description) => (
          <span style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
            {decodeHTML(description) || "—"}
          </span>
        ),
      },
      {
        title: "Capacity",
        key: "capacity",
        width: 200,
        // The number staff actually read: where is there room for the next
        // subscriber. Rendered as a bar because "18 / 64" alone is hard to scan.
        render: (_, record) => {
          const used = Number(record.usedPorts) || 0;
          const capacity = Number(record.capacity) || 0;
          const pct = capacity > 0 ? Math.min(100, (used / capacity) * 100) : 0;
          const full = pct >= 90;
          return (
            <div className="min-w-0">
              <div
                className="font-mono mb-1.5"
                style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}
              >
                {used} / {capacity}
              </div>
              <div
                style={{
                  height: 4,
                  borderRadius: 999,
                  background: "var(--color-surface-sunken)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: full ? "var(--color-warning)" : "var(--color-link)",
                  }}
                />
              </div>
            </div>
          );
        },
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 130,
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
    data: data?.data?.ponPorts || [],
    pagination: { ...pagination, total: data?.data?.pagination?.total || 0 },
    filters,
    oltOptions,
    isLoading,
    isFetching,
    error,
    refetch,
    canWrite,
    columns,
    handleTableChange,
    handleSearch,
    handleStatusFilter,
    handleOltFilter,
    handleClearFilters,
    drawerOpen,
    selectedPonPort,
    handleCreate,
    handleDrawerClose,
  };
};
