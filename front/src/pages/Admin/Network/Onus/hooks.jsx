import { useCallback, useMemo, useState } from "react";
import { Pencil, PowerOff, RefreshCw, ScrollText, Trash2, Zap } from "lucide-react";

import RowActions from "../../../../components/RowActions";
import { usePermissions } from "../../../../hooks/usePermissions";
import {
  useDeleteOnu,
  useGetOnus,
} from "../../../../services/requests/admin/network/onus";
import { useGetNaps } from "../../../../services/requests/admin/network/naps";
import { useProvisionOnu } from "../../../../services/requests/admin/network/provisioning";
import { useGetOlts } from "../../../../services/requests/admin/network/olts";
import { confirm } from "../../../../store/confirmStore";
import { decodeHTML } from "../../../../utils/decode-html";

/**
 * Provisioning state is the device's real condition at the OLT, written only by
 * the provisioning worker after a confirmed command. `suspended` in particular
 * means a customer currently has no internet, so it reads red.
 */
export const PROVISIONING_STATE = {
  unprovisioned: { label: "Unprovisioned", color: "var(--color-text-muted)" },
  active: { label: "Active", color: "var(--color-success)" },
  suspended: { label: "Suspended", color: "var(--color-error)" },
  offline: { label: "Offline", color: "var(--color-warning)" },
};

export const useOnusData = () => {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("network", "onus", "write");
  // Separate from editing the inventory record: this is the power to take a
  // customer offline.
  const canProvision = hasPermission("network", "provisioning", "write");

  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [filters, setFilters] = useState({
    search: "",
    recordStatus: "",
    provisioningState: "",
    oltId: "",
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedOnu, setSelectedOnu] = useState(null);
  const [logsOnu, setLogsOnu] = useState(null);

  const { data, isLoading, isFetching, error, refetch } = useGetOnus({
    page: pagination.current,
    pageSize: pagination.pageSize,
    search: filters.search,
    recordStatus: filters.recordStatus,
    provisioningState: filters.provisioningState,
    oltId: filters.oltId,
  });

  const { data: oltsData } = useGetOlts({ page: 1, pageSize: 100, status: "Active" });
  const oltOptions = useMemo(
    () =>
      (oltsData?.data?.olts || []).map((o) => ({
        value: o.oltId,
        label: decodeHTML(o.name),
      })),
    [oltsData],
  );

  const { data: napsData } = useGetNaps({ page: 1, pageSize: 100, status: "Active" });
  const napOptions = useMemo(
    () =>
      (napsData?.data?.naps || []).map((n) => ({
        value: n.napId,
        label: decodeHTML(n.label),
        totalPorts: Number(n.totalPorts) || 0,
        usedPorts: Number(n.usedPorts) || 0,
      })),
    [napsData],
  );

  const deleteMutation = useDeleteOnu();
  const provisionMutation = useProvisionOnu();

  const handleTableChange = useCallback((next) => {
    setPagination({ current: next.current, pageSize: next.pageSize });
  }, []);

  const handleSearch = useCallback((value) => {
    setFilters((prev) => ({ ...prev, search: value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ search: "", recordStatus: "", provisioningState: "", oltId: "" });
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleCreate = useCallback(() => {
    setSelectedOnu(null);
    setDrawerOpen(true);
  }, []);

  const handleEdit = useCallback((record) => {
    setSelectedOnu(record);
    setDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    setSelectedOnu(null);
  }, []);

  const handleViewLogs = useCallback((record) => setLogsOnu(record), []);
  const handleCloseLogs = useCallback(() => setLogsOnu(null), []);

  /**
   * Suspending is the one action here that takes a real customer offline, so it
   * names them and says plainly that the modem stays bound — this is a
   * suspension, not a removal.
   */
  const handleProvision = useCallback(
    async (record, action) => {
      const identifier = record.mac || record.serialNo || "this modem";

      if (action === "deactivate") {
        const ok = await confirm({
          title: "Suspend this connection?",
          description: `${identifier} will be blacklisted at the OLT and lose service. The modem stays bound, so restoring it later is immediate.`,
          confirmText: "Suspend",
          cancelText: "Cancel",
          danger: true,
        });
        if (!ok) return;
      }

      if (action === "activate") {
        const ok = await confirm({
          title: "Restore this connection?",
          description: `${identifier} will be removed from the OLT blacklist and service should return within seconds.`,
          confirmText: "Restore",
          cancelText: "Cancel",
        });
        if (!ok) return;
      }

      provisionMutation.mutate({ onuId: record.onuId, action, reason: "manual" });
    },
    [provisionMutation],
  );

  const handleDeleteRequest = useCallback(
    async (record) => {
      const identifier = record.mac || record.serialNo || "this ONU";
      const ok = await confirm({
        title: "Delete ONU",
        description: `Delete ${identifier}? A modem that is active or suspended at the OLT must be deprovisioned first.`,
        confirmText: "Delete",
        cancelText: "Cancel",
        danger: true,
      });
      if (ok) deleteMutation.mutate(record.onuId);
    },
    [deleteMutation],
  );

  const getActionItems = useCallback(
    (record) => {
      const items = [];

      // The history is readable by anyone who can see ONUs — auditing a
      // disconnection should not require the power to cause one.
      items.push({
        key: "logs",
        label: "Device history",
        icon: <ScrollText className="w-4 h-4" />,
        onClick: () => handleViewLogs(record),
      });

      if (canProvision && record.oltId) {
        items.push({
          key: "status",
          label: "Check status now",
          icon: <RefreshCw className="w-4 h-4" />,
          onClick: () => handleProvision(record, "status"),
        });

        // Only ever one of these, and only when it would actually change
        // something — offering "restore" on a live connection invites a
        // pointless command to a device that tolerates one session at a time.
        if (record.provisioningState === "suspended") {
          items.push({
            key: "activate",
            label: "Restore service",
            icon: <Zap className="w-4 h-4" />,
            onClick: () => handleProvision(record, "activate"),
          });
        } else if (record.provisioningState === "active") {
          items.push({
            key: "deactivate",
            label: "Suspend service",
            icon: <PowerOff className="w-4 h-4" />,
            danger: true,
            onClick: () => handleProvision(record, "deactivate"),
          });
        }
      }

      if (canWrite) {
        items.push(
          { type: "divider" },
          {
            key: "edit",
            label: "Edit ONU",
            icon: <Pencil className="w-4 h-4" />,
            onClick: () => handleEdit(record),
          },
          {
            key: "delete",
            label: "Delete ONU",
            icon: <Trash2 className="w-4 h-4" />,
            danger: true,
            onClick: () => handleDeleteRequest(record),
          },
        );
      }

      return items;
    },
    [canWrite, canProvision, handleViewLogs, handleProvision, handleEdit, handleDeleteRequest],
  );

  const columns = useMemo(
    () => [
      {
        title: "Modem",
        key: "modem",
        render: (_, record) => (
          <div className="min-w-0">
            {/* MAC first: on EPON it is the device's identity, and it is what
                staff match against the OLT's own listing. */}
            <div className="font-mono truncate" style={{ fontSize: 13, color: "var(--color-text-dark)" }}>
              {record.mac || record.serialNo || "—"}
            </div>
            <div className="truncate" style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
              {decodeHTML(record.model) || "Unknown model"}
              {record.onuIndex ? ` · ${record.onuIndex}` : ""}
            </div>
          </div>
        ),
      },
      {
        title: "Placement",
        key: "placement",
        width: 210,
        ellipsis: true,
        render: (_, record) => (
          <div className="min-w-0">
            <div className="truncate" style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
              {decodeHTML(record.napLabel) || "Not seated"}
              {record.napPort ? ` · port ${record.napPort}` : ""}
            </div>
            <div className="truncate" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {decodeHTML(record.oltName) || "No OLT resolved"}
            </div>
          </div>
        ),
      },
      {
        title: "Service",
        dataIndex: "provisioningState",
        key: "provisioningState",
        width: 150,
        render: (state) => {
          const meta = PROVISIONING_STATE[state] || PROVISIONING_STATE.unprovisioned;
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
                  background: meta.color,
                  boxShadow:
                    state === "active"
                      ? "0 0 8px color-mix(in srgb, var(--color-success) 50%, transparent)"
                      : "none",
                }}
              />
              {meta.label}
            </span>
          );
        },
      },
      {
        title: "Optical",
        key: "optical",
        width: 130,
        render: (_, record) =>
          record.lastRxDbm === null || record.lastRxDbm === undefined ? (
            <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>—</span>
          ) : (
            <span className="font-mono" style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
              {Number(record.lastRxDbm).toFixed(2)} dBm
            </span>
          ),
      },
      {
        title: "Record",
        dataIndex: "recordStatus",
        key: "recordStatus",
        width: 120,
        render: (status) => (
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{status}</span>
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
    data: data?.data?.onus || [],
    pagination: { ...pagination, total: data?.data?.pagination?.total || 0 },
    filters,
    oltOptions,
    napOptions,
    isLoading,
    isFetching,
    error,
    refetch,
    canWrite,
    canProvision,
    columns,
    handleTableChange,
    handleSearch,
    handleFilterChange,
    handleClearFilters,
    drawerOpen,
    selectedOnu,
    handleCreate,
    handleDrawerClose,
    logsOnu,
    handleCloseLogs,
  };
};
