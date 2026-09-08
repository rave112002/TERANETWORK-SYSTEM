import { useCallback, useMemo, useState } from "react";
import { ShieldOff, ShieldPlus } from "lucide-react";
import dayjs from "dayjs";

import RowActions from "../../../../components/RowActions";
import { usePermissions } from "../../../../hooks/usePermissions";
import {
  useGetAtRisk,
  useGetExemptions,
  useRevokeExemption,
} from "../../../../services/requests/admin/billing";
import { confirm } from "../../../../store/confirmStore";
import { decodeHTML } from "../../../../utils/decode-html";
import { formatPeso } from "../../../../utils/currency";

/**
 * The four states an overdue account can be in, and how each should read.
 *
 * `eligible` is the only one that reads red, and it means "will be cut off by
 * the next sweep". `in_grace` is amber — there is still time to phone them.
 * `suspended` is past tense: it already happened.
 */
export const RISK_STATE = {
  eligible: {
    label: "Eligible now",
    color: "var(--color-error)",
    hint: "will be disconnected by the next sweep",
  },
  in_grace: {
    label: "In grace",
    color: "var(--color-warning)",
    hint: "still inside the grace period",
  },
  exempt: {
    label: "Exempt",
    color: "var(--color-link)",
    hint: "shielded by a staff decision",
  },
  suspended: {
    label: "Suspended",
    color: "var(--color-text-muted)",
    hint: "already disconnected",
  },
};

export const useDunningData = () => {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("billing", "dunning", "write");

  const [stateFilter, setStateFilter] = useState("");
  const [exemptSubscription, setExemptSubscription] = useState(null);
  const [sweepOpen, setSweepOpen] = useState(false);

  const { data, isLoading, isFetching, error, refetch } = useGetAtRisk();
  const { data: exemptionsData, isLoading: exemptionsLoading } = useGetExemptions({
    page: 1,
    pageSize: 50,
    state: "live",
  });

  const revokeMutation = useRevokeExemption();

  const atRisk = useMemo(() => data?.data?.atRisk ?? [], [data]);
  const summary = data?.data?.summary ?? { eligible: 0, in_grace: 0, exempt: 0, suspended: 0 };
  const graceDays = data?.data?.graceDays ?? 3;

  const filtered = useMemo(
    () => (stateFilter ? atRisk.filter((r) => r.state === stateFilter) : atRisk),
    [atRisk, stateFilter]
  );

  const handleExempt = useCallback((record) => setExemptSubscription(record), []);
  const handleCloseExempt = useCallback(() => setExemptSubscription(null), []);
  const handleOpenSweep = useCallback(() => setSweepOpen(true), []);
  const handleCloseSweep = useCallback(() => setSweepOpen(false), []);

  const handleRevoke = useCallback(
    async (record) => {
      const ok = await confirm({
        title: "Revoke this exemption?",
        // Says exactly what does and does not happen. Somebody clicking this
        // needs to know it is not a disconnect button.
        description: `${decodeHTML(record.customerName)} becomes eligible for automatic disconnection again from the next sweep. Nobody is disconnected right now.`,
        confirmText: "Revoke",
        cancelText: "Keep it",
        danger: true,
      });
      if (ok) revokeMutation.mutate({ exemptionId: record.exemptionId });
    },
    [revokeMutation]
  );

  const getActionItems = useCallback(
    (record) => {
      if (!canWrite) return [];

      // Nothing to offer for an account already disconnected — exempting it
      // would shield a service that is already off.
      if (record.state === "suspended") return [];

      if (record.exempt) {
        return [
          {
            key: "revoke",
            label: "Revoke exemption",
            icon: <ShieldOff className="w-4 h-4" />,
            danger: true,
            onClick: () => handleRevoke(record),
          },
        ];
      }

      return [
        {
          key: "exempt",
          label: "Grant exemption",
          icon: <ShieldPlus className="w-4 h-4" />,
          onClick: () => handleExempt(record),
        },
      ];
    },
    [canWrite, handleExempt, handleRevoke]
  );

  const columns = useMemo(
    () => [
      {
        title: "Customer",
        key: "customer",
        ellipsis: true,
        render: (_, record) => (
          <div className="min-w-0">
            <div className="truncate" style={{ fontSize: 13.5, color: "var(--color-text-dark)" }}>
              {decodeHTML(record.customerName) || "—"}
            </div>
            <div className="truncate" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {record.accountNo}
              {record.branchName ? ` · ${decodeHTML(record.branchName)}` : ""}
            </div>
          </div>
        ),
      },
      {
        title: "Owes",
        key: "amountDue",
        width: 150,
        align: "right",
        render: (_, record) => (
          <div className="min-w-0">
            <div className="font-mono" style={{ fontSize: 13, color: "var(--color-text-dark)" }}>
              {formatPeso(record.amountDue)}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {record.unpaidCount} invoice{record.unpaidCount === 1 ? "" : "s"}
            </div>
          </div>
        ),
      },
      {
        title: "Overdue since",
        key: "oldestDueDate",
        width: 170,
        render: (_, record) => (
          <div className="min-w-0">
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              {dayjs(record.oldestDueDate).format("MMM D, YYYY")}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {record.daysPastDue} day{record.daysPastDue === 1 ? "" : "s"} ago
            </div>
          </div>
        ),
      },
      {
        title: "Status",
        key: "state",
        width: 200,
        render: (_, record) => {
          const meta = RISK_STATE[record.state] ?? RISK_STATE.in_grace;
          return (
            <div className="min-w-0">
              <span
                className="inline-flex items-center gap-2"
                style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
              >
                <span
                  style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color }}
                />
                {meta.label}
              </span>
              <div className="truncate" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {/* The number that matters when deciding who to phone first. */}
                {record.state === "in_grace"
                  ? `${record.daysUntilDisconnect} day${record.daysUntilDisconnect === 1 ? "" : "s"} left`
                  : record.state === "exempt"
                    ? `until ${dayjs(record.exemptUntil).format("MMM D")}`
                    : meta.hint}
              </div>
            </div>
          );
        },
      },
      {
        title: "",
        key: "actions",
        width: 60,
        align: "right",
        render: (_, record) => {
          const items = getActionItems(record);
          return items.length > 0 ? <RowActions items={items} /> : null;
        },
      },
    ],
    [getActionItems]
  );

  return {
    atRisk: filtered,
    summary,
    graceDays,
    exemptions: exemptionsData?.data?.exemptions ?? [],
    isLoading,
    isFetching,
    exemptionsLoading,
    error,
    refetch,
    canWrite,
    columns,
    stateFilter,
    setStateFilter,
    exemptSubscription,
    handleCloseExempt,
    sweepOpen,
    handleOpenSweep,
    handleCloseSweep,
  };
};
