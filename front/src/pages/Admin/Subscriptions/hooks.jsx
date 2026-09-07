import { useCallback, useMemo, useState } from "react";
import { CirclePlay, CircleStop, Pencil, Trash2 } from "lucide-react";
import dayjs from "dayjs";

import RowActions from "../../../components/RowActions";
import { usePermissions } from "../../../hooks/usePermissions";
import {
  useDeleteSubscription,
  useGetSubscriptions,
  useTransitionSubscription,
} from "../../../services/requests/admin/subscriptions";
import { useGetCustomers } from "../../../services/requests/admin/customers";
import { useGetPlans } from "../../../services/requests/admin/plans";
import { useGetOnus } from "../../../services/requests/admin/network/onus";
import { confirm } from "../../../store/confirmStore";
import { decodeHTML } from "../../../utils/decode-html";
import { formatPeso } from "../../../utils/currency";

/**
 * `suspended` reads red because it means a real customer has no internet right
 * now — it is the only status on this screen that describes an outage.
 */
export const SUBSCRIPTION_STATUS = {
  pending: { label: "Pending", color: "var(--color-text-muted)" },
  active: { label: "Active", color: "var(--color-success)" },
  suspended: { label: "Suspended", color: "var(--color-error)" },
  terminated: { label: "Terminated", color: "var(--color-text-muted)" },
};

export const useSubscriptionsData = () => {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("subscriptions", null, "write");

  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [filters, setFilters] = useState({ search: "", status: "", planId: "" });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState(null);

  const { data, isLoading, isFetching, error, refetch } = useGetSubscriptions({
    page: pagination.current,
    pageSize: pagination.pageSize,
    search: filters.search,
    status: filters.status,
    planId: filters.planId,
  });

  const { data: customersData } = useGetCustomers({ page: 1, pageSize: 100, status: "Active" });
  const customerOptions = useMemo(
    () =>
      (customersData?.data?.customers || []).map((c) => ({
        value: c.customerId,
        label: `${c.accountNo} — ${decodeHTML(c.name)}`,
      })),
    [customersData],
  );

  const { data: plansData } = useGetPlans({ page: 1, pageSize: 100, status: "Active" });
  const planOptions = useMemo(
    () =>
      (plansData?.data?.plans || []).map((p) => ({
        value: p.planId,
        label: `${decodeHTML(p.name)} — ${formatPeso(p.monthlyPrice)}`,
      })),
    [plansData],
  );

  // Any ONU can be offered; the API is what rejects one already bound to a live
  // subscription, so the two can never disagree about what "free" means.
  const { data: onusData } = useGetOnus({ page: 1, pageSize: 100, recordStatus: "Active" });
  const onuOptions = useMemo(
    () =>
      (onusData?.data?.onus || []).map((o) => ({
        value: o.onuId,
        label: `${o.mac || o.serialNo}${o.napLabel ? ` · ${decodeHTML(o.napLabel)}` : ""}`,
      })),
    [onusData],
  );

  const deleteMutation = useDeleteSubscription();
  const transitionMutation = useTransitionSubscription();

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
    setFilters({ search: "", status: "", planId: "" });
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleCreate = useCallback(() => {
    setSelectedSubscription(null);
    setDrawerOpen(true);
  }, []);

  const handleEdit = useCallback((record) => {
    setSelectedSubscription(record);
    setDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    setSelectedSubscription(null);
  }, []);

  const handleActivate = useCallback(
    async (record) => {
      const ok = await confirm({
        title: "Activate subscription",
        description: `Start service for ${decodeHTML(record.customerName)}? Billing runs from today, and the first invoice covers this calendar month.`,
        confirmText: "Activate",
        cancelText: "Cancel",
      });
      if (ok) {
        transitionMutation.mutate({ subscriptionId: record.subscriptionId, action: "activate" });
      }
    },
    [transitionMutation],
  );

  const handleTerminate = useCallback(
    async (record) => {
      const ok = await confirm({
        title: "Terminate subscription",
        description: `End service for ${decodeHTML(record.customerName)}? This cannot be undone. The ONU is released for reuse, but the modem still needs deprovisioning at the OLT.`,
        confirmText: "Terminate",
        cancelText: "Cancel",
        danger: true,
      });
      if (ok) {
        transitionMutation.mutate({ subscriptionId: record.subscriptionId, action: "terminate" });
      }
    },
    [transitionMutation],
  );

  const handleDeleteRequest = useCallback(
    async (record) => {
      const ok = await confirm({
        title: "Delete subscription",
        description: "Remove this record? Only possible because it was never activated.",
        confirmText: "Delete",
        cancelText: "Cancel",
        danger: true,
      });
      if (ok) deleteMutation.mutate(record.subscriptionId);
    },
    [deleteMutation],
  );

  const getActionItems = useCallback(
    (record) => {
      if (!canWrite) return [];
      const items = [];

      // Only the staff-owned transitions appear. A suspended subscription shows
      // no "restore" — that happens when the customer pays, and offering a
      // button would imply staff can turn service back on without the device.
      if (record.status === "pending") {
        items.push({
          key: "activate",
          label: "Activate",
          icon: <CirclePlay className="w-4 h-4" />,
          onClick: () => handleActivate(record),
        });
      }

      if (record.status !== "terminated") {
        items.push({
          key: "edit",
          label: "Edit subscription",
          icon: <Pencil className="w-4 h-4" />,
          onClick: () => handleEdit(record),
        });
      }

      if (["pending", "active", "suspended"].includes(record.status)) {
        items.push(
          { type: "divider" },
          {
            key: "terminate",
            label: "Terminate",
            icon: <CircleStop className="w-4 h-4" />,
            danger: true,
            onClick: () => handleTerminate(record),
          },
        );
      }

      if (record.status === "pending" && !record.activatedAt) {
        items.push({
          key: "delete",
          label: "Delete record",
          icon: <Trash2 className="w-4 h-4" />,
          danger: true,
          onClick: () => handleDeleteRequest(record),
        });
      }

      return items;
    },
    [canWrite, handleActivate, handleEdit, handleTerminate, handleDeleteRequest],
  );

  const columns = useMemo(
    () => [
      {
        title: "Subscriber",
        key: "subscriber",
        render: (_, record) => (
          <div className="min-w-0">
            <div
              className="truncate"
              style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-dark)" }}
            >
              {decodeHTML(record.customerName) || "—"}
            </div>
            <div className="font-mono truncate" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {record.accountNo || "—"}
            </div>
          </div>
        ),
      },
      {
        title: "Plan",
        key: "plan",
        width: 200,
        render: (_, record) => (
          <div className="min-w-0">
            <div className="truncate" style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
              {decodeHTML(record.planName) || "—"}
            </div>
            <div className="font-mono" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {formatPeso(record.monthlyPrice)}/mo
            </div>
          </div>
        ),
      },
      {
        title: "Modem",
        key: "onu",
        width: 190,
        render: (_, record) =>
          record.onuId ? (
            <div className="min-w-0">
              <div className="font-mono truncate" style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
                {record.onuMac || record.onuSerialNo}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {record.provisioningState || "—"}
              </div>
            </div>
          ) : (
            <span style={{ fontSize: 12.5, color: "var(--color-warning)" }}>Not attached</span>
          ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 150,
        render: (status, record) => {
          const meta = SUBSCRIPTION_STATUS[status] || SUBSCRIPTION_STATUS.pending;
          return (
            <div className="min-w-0">
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
                      status === "active"
                        ? "0 0 8px color-mix(in srgb, var(--color-success) 50%, transparent)"
                        : "none",
                  }}
                />
                {meta.label}
              </span>
              {record.activatedAt && (
                <div style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>
                  since {dayjs(record.activatedAt).format("MMM D, YYYY")}
                </div>
              )}
            </div>
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
    data: data?.data?.subscriptions || [],
    pagination: { ...pagination, total: data?.data?.pagination?.total || 0 },
    filters,
    customerOptions,
    planOptions,
    onuOptions,
    isLoading,
    isFetching,
    error,
    refetch,
    canWrite,
    columns,
    handleTableChange,
    handleSearch,
    handleFilterChange,
    handleClearFilters,
    drawerOpen,
    selectedSubscription,
    handleCreate,
    handleDrawerClose,
  };
};
