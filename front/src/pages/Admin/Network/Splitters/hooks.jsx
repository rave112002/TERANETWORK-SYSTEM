import { useCallback, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import RowActions from "../../../../components/RowActions";
import { usePermissions } from "../../../../hooks/usePermissions";
import {
  useDeleteSplitter,
  useGetSplitters,
} from "../../../../services/requests/admin/network/splitters";
import { useGetPonPorts } from "../../../../services/requests/admin/network/pon-ports";
import { confirm } from "../../../../store/confirmStore";
import { decodeHTML } from "../../../../utils/decode-html";

export const useSplittersData = () => {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("network", "splitters", "write");

  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [filters, setFilters] = useState({ search: "", status: "" });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSplitter, setSelectedSplitter] = useState(null);

  const { data, isLoading, isFetching, error, refetch } = useGetSplitters({
    page: pagination.current,
    pageSize: pagination.pageSize,
    search: filters.search,
    status: filters.status,
  });

  // The drawer's parent picker offers both kinds, because a splitter hangs off
  // a PON port or off another splitter.
  const { data: portsData } = useGetPonPorts({ page: 1, pageSize: 100, status: "Active" });
  const { data: allSplittersData } = useGetSplitters({
    page: 1,
    pageSize: 100,
    status: "Active",
  });

  const parentOptions = useMemo(() => {
    const ports = (portsData?.data?.ponPorts || []).map((p) => ({
      value: p.ponPortId,
      type: "pon_port",
      label: `${decodeHTML(p.oltName) || "OLT"} · port ${p.portIndex}`,
    }));
    const splitters = (allSplittersData?.data?.splitters || []).map((s) => ({
      value: s.splitterId,
      type: "splitter",
      label: `${decodeHTML(s.label)} (${s.ratio})`,
    }));
    return { ports, splitters };
  }, [portsData, allSplittersData]);

  const deleteMutation = useDeleteSplitter();

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
    setSelectedSplitter(null);
    setDrawerOpen(true);
  }, []);

  const handleEdit = useCallback((record) => {
    setSelectedSplitter(record);
    setDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    setSelectedSplitter(null);
  }, []);

  const handleDeleteRequest = useCallback(
    async (record) => {
      const ok = await confirm({
        title: "Delete splitter",
        description: `Delete "${decodeHTML(record.label)}"? Any NAPs or child splitters below it must be removed first.`,
        confirmText: "Delete",
        cancelText: "Cancel",
        danger: true,
      });
      if (ok) deleteMutation.mutate(record.splitterId);
    },
    [deleteMutation],
  );

  const getActionItems = useCallback(
    (record) => {
      if (!canWrite) return [];
      return [
        {
          key: "edit",
          label: "Edit splitter",
          icon: <Pencil className="w-4 h-4" />,
          onClick: () => handleEdit(record),
        },
        { type: "divider" },
        {
          key: "delete",
          label: "Delete splitter",
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
        title: "Splitter",
        key: "splitter",
        render: (_, record) => (
          <div className="min-w-0">
            <div
              className="truncate"
              style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-dark)" }}
            >
              {decodeHTML(record.label)}
            </div>
            <div className="truncate" style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
              {decodeHTML(record.location) || "No location noted"}
            </div>
          </div>
        ),
      },
      {
        title: "Ratio",
        dataIndex: "ratio",
        key: "ratio",
        width: 100,
        render: (ratio) => (
          <span
            className="font-mono inline-flex items-center"
            style={{
              fontSize: 12.5,
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-line)",
              borderRadius: 6,
              padding: "2px 8px",
            }}
          >
            {ratio}
          </span>
        ),
      },
      {
        title: "Fed from",
        key: "parent",
        width: 240,
        ellipsis: true,
        render: (_, record) => (
          <div className="min-w-0">
            <div className="truncate" style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
              {decodeHTML(record.parentLabel) || "—"}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {record.parentType === "pon_port" ? "PON port" : "Splitter"}
            </div>
          </div>
        ),
      },
      {
        title: "Feeds",
        key: "children",
        width: 150,
        render: (_, record) => {
          const naps = Number(record.napCount) || 0;
          const children = Number(record.childSplitterCount) || 0;
          return (
            <span style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
              {naps} NAP{naps === 1 ? "" : "s"}
              {children > 0 ? ` · ${children} splitter${children === 1 ? "" : "s"}` : ""}
            </span>
          );
        },
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 130,
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
    data: data?.data?.splitters || [],
    pagination: { ...pagination, total: data?.data?.pagination?.total || 0 },
    filters,
    parentOptions,
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
    selectedSplitter,
    handleCreate,
    handleDrawerClose,
  };
};
