import { useCallback, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import RowActions from "../../../../components/RowActions";
import { usePermissions } from "../../../../hooks/usePermissions";
import {
  useDeleteNap,
  useGetNaps,
} from "../../../../services/requests/admin/network/naps";
import { useGetSplitters } from "../../../../services/requests/admin/network/splitters";
import { confirm } from "../../../../store/confirmStore";
import { decodeHTML } from "../../../../utils/decode-html";

export const useNapsData = () => {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("network", "naps", "write");

  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [view, setView] = useState("table");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedNap, setSelectedNap] = useState(null);

  const { data, isLoading, isFetching, error, refetch } = useGetNaps({
    page: pagination.current,
    pageSize: pagination.pageSize,
    search: filters.search,
    status: filters.status,
  });

  // The map needs every box at once, not one page of them — a technician
  // panning around should not find half the plant missing. Fetched separately
  // and only while the map is showing.
  const { data: mapData, isLoading: mapLoading } = useGetNaps(
    { page: 1, pageSize: 100, search: filters.search, status: filters.status },
    { enabled: view === "map" },
  );

  const { data: splittersData } = useGetSplitters({
    page: 1,
    pageSize: 100,
    status: "Active",
  });
  const splitterOptions = useMemo(
    () =>
      (splittersData?.data?.splitters || []).map((s) => ({
        value: s.splitterId,
        label: `${decodeHTML(s.label)} (${s.ratio})`,
      })),
    [splittersData],
  );

  const deleteMutation = useDeleteNap();

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
    setSelectedNap(null);
    setDrawerOpen(true);
  }, []);

  const handleEdit = useCallback((record) => {
    setSelectedNap(record);
    setDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    setSelectedNap(null);
  }, []);

  const handleDeleteRequest = useCallback(
    async (record) => {
      const ok = await confirm({
        title: "Delete NAP",
        description: `Delete "${decodeHTML(record.label)}"? Any ONUs connected to it must be disconnected first.`,
        confirmText: "Delete",
        cancelText: "Cancel",
        danger: true,
      });
      if (ok) deleteMutation.mutate(record.napId);
    },
    [deleteMutation],
  );

  const getActionItems = useCallback(
    (record) => {
      if (!canWrite) return [];
      return [
        {
          key: "edit",
          label: "Edit NAP",
          icon: <Pencil className="w-4 h-4" />,
          onClick: () => handleEdit(record),
        },
        { type: "divider" },
        {
          key: "delete",
          label: "Delete NAP",
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
        title: "NAP",
        key: "nap",
        render: (_, record) => (
          <div className="min-w-0">
            <div
              className="truncate"
              style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-dark)" }}
            >
              {decodeHTML(record.label)}
            </div>
            <div className="truncate" style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
              {decodeHTML(record.address) || "No address noted"}
            </div>
          </div>
        ),
      },
      {
        title: "Fed from",
        dataIndex: "splitterLabel",
        key: "splitterLabel",
        width: 200,
        ellipsis: true,
        render: (label, record) => (
          <span style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
            {decodeHTML(label) || "—"}
            {record.splitterRatio ? ` (${record.splitterRatio})` : ""}
          </span>
        ),
      },
      {
        title: "Ports",
        key: "ports",
        width: 180,
        render: (_, record) => {
          const used = Number(record.usedPorts) || 0;
          const total = Number(record.totalPorts) || 0;
          const free = total - used;
          const color =
            free <= 0
              ? "var(--color-error)"
              : free / (total || 1) <= 0.2
                ? "var(--color-warning)"
                : "var(--color-success)";
          return (
            <span className="inline-flex items-center gap-2">
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
              <span className="font-mono" style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
                {used} / {total}
              </span>
              <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {free <= 0 ? "full" : `${free} free`}
              </span>
            </span>
          );
        },
      },
      {
        title: "Coordinates",
        key: "coords",
        width: 190,
        render: (_, record) => (
          <span className="font-mono" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            {Number(record.gpsLat).toFixed(5)}, {Number(record.gpsLng).toFixed(5)}
          </span>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 120,
        render: (status) => {
          const active = status === "Active";
          return (
            <span
              className="inline-flex items-center gap-2"
              style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: active ? "var(--color-success)" : "var(--color-text-muted)",
                }}
              />
              {status}
            </span>
          );
        },
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
    data: data?.data?.naps || [],
    mapNaps: mapData?.data?.naps || [],
    mapLoading,
    pagination: { ...pagination, total: data?.data?.pagination?.total || 0 },
    filters,
    splitterOptions,
    view,
    setView,
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
    selectedNap,
    handleCreate,
    handleEdit,
    handleDrawerClose,
  };
};
