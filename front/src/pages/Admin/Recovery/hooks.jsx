import { useCallback, useMemo, useState } from "react";
import { PackageX, Undo2 } from "lucide-react";
import dayjs from "dayjs";

import RowActions from "../../../components/RowActions";
import { usePermissions } from "../../../hooks/usePermissions";
import {
  useGetPendingPullOuts,
  useGetRecoveryCandidates,
  useTransitionSubscription,
} from "../../../services/requests/admin/subscriptions";
import { confirm } from "../../../store/confirmStore";
import { decodeHTML } from "../../../utils/decode-html";
import { formatPeso } from "../../../utils/currency";

/**
 * Modem recovery — the end of the line for an account that never paid.
 *
 * ── Two lists, because they are two different jobs ──────────────────────────
 *
 *   Ready to give up on   an office decision: is this account worth chasing,
 *                         or do we send a van for the modem?
 *   Awaiting collection   field work: which modems are still out there, where,
 *                         and how long has the job been open?
 *
 * The first is reversible and the second is not, so they are not one table with
 * a status column. Somebody working through the office list should not be able
 * to close a job they have not done.
 *
 * Nothing on this screen happens automatically. The 60 days only decides when a
 * name appears here; a person decides everything after that, which is the
 * client's explicit instruction.
 */

export const TABS = [
  {
    key: "candidates",
    label: "Ready to give up on",
    subtitle:
      "Cut off long enough that somebody should decide. Nothing here is revoked until you say so.",
    empty: "Nobody has been cut off long enough",
    emptyDetail: "Which is the answer you want.",
    noun: "account",
  },
  {
    key: "pending",
    label: "Awaiting collection",
    subtitle: "Modems still out there. Close each one when the technician reports back.",
    empty: "No modems waiting to be collected",
    emptyDetail: "Every pull-out has been closed off.",
    noun: "modem",
  },
];

/** A name and account number, the way both tables lead. */
const customerCell = (row) => (
  <div className="min-w-0">
    <div className="truncate" style={{ fontSize: 13.5, color: "var(--color-text-dark)" }}>
      {decodeHTML(row.customerName)}
    </div>
    <div className="truncate" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
      {row.accountNo}
      {row.branchName ? ` · ${decodeHTML(row.branchName)}` : ""}
    </div>
  </div>
);

/** Where the modem is, in the terms a technician would use to go and find it. */
const modemCell = (row) => (
  <div className="min-w-0">
    <div
      className="font-mono truncate"
      style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}
    >
      {row.onuMac || row.onuSerialNo || "—"}
    </div>
    <div className="truncate" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
      {row.napLabel ? `${decodeHTML(row.napLabel)} · port ${row.napPort ?? "?"}` : "not seated"}
    </div>
  </div>
);

const daysCell = (days, since, label) => (
  <div className="min-w-0">
    <div style={{ fontSize: 13, color: "var(--color-text-dark)" }}>
      {Number(days) || 0} {label}
    </div>
    <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
      since {since ? dayjs(since).format("MMM D, YYYY") : "—"}
    </div>
  </div>
);

export const useRecoveryData = () => {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("subscriptions", null, "write");

  const [tab, setTab] = useState("candidates");
  const [search, setSearch] = useState("");

  // Only the visible list is fetched. Both are joins across five tables, and
  // neither needs to run because somebody opened the other one.
  const candidatesQuery = useGetRecoveryCandidates(
    { search },
    { enabled: tab === "candidates" },
  );
  const pendingQuery = useGetPendingPullOuts({ search }, { enabled: tab === "pending" });

  const transitionMutation = useTransitionSubscription();

  const active = tab === "candidates" ? candidatesQuery : pendingQuery;

  const handleRevoke = useCallback(
    async (record) => {
      const owed = formatPeso(record.amountOwed);
      const ok = await confirm({
        title: "Mark for pull-out?",
        description:
          `Give up on ${decodeHTML(record.customerName)}. They owe ${owed} and have been ` +
          `without service for ${record.daysSuspended} days. Paying will no longer restore ` +
          `their service, and coming back means a new subscription with a new installation ` +
          `fee. The balance is still owed either way.`,
        confirmText: "Mark for pull-out",
        cancelText: "Not yet",
        danger: true,
      });
      if (ok) {
        transitionMutation.mutate({ subscriptionId: record.subscriptionId, action: "revoke" });
      }
    },
    [transitionMutation],
  );

  const handleUnrevoke = useCallback(
    async (record) => {
      const ok = await confirm({
        title: "Cancel the pull-out?",
        description:
          "For a pull-out marked by mistake. The account goes back to suspended, and " +
          "service still only returns once the balance is settled.",
        confirmText: "Cancel pull-out",
        cancelText: "Leave it",
      });
      if (ok) {
        transitionMutation.mutate({ subscriptionId: record.subscriptionId, action: "unrevoke" });
      }
    },
    [transitionMutation],
  );

  /**
   * Closing needs the technician's answer, and the two answers do opposite
   * things to the hardware — so this asks the question rather than confirming an
   * assumption. The NAP port is freed either way.
   */
  const handleClose = useCallback(
    async (record, outcome) => {
      const recovered = outcome === "recovered";
      const modem = record.onuMac || record.onuSerialNo || "the modem";

      const ok = await confirm({
        title: recovered ? "Modem recovered?" : "Modem not recovered?",
        description: recovered
          ? `Close ${decodeHTML(record.customerName)}'s account. ${modem} goes back into ` +
            `stock and is un-blacklisted at the OLT so it works when it is next seated. ` +
            `The NAP port is freed.`
          : `Close ${decodeHTML(record.customerName)}'s account without the modem. ` +
            `${modem} is written off and STAYS blacklisted at the OLT, so nobody can use ` +
            `it. The NAP port is freed.`,
        confirmText: recovered ? "Recovered — close it" : "Write it off",
        cancelText: "Cancel",
        danger: !recovered,
      });

      if (ok) {
        transitionMutation.mutate({
          subscriptionId: record.subscriptionId,
          action: "close",
          outcome,
        });
      }
    },
    [transitionMutation],
  );

  const candidateColumns = useMemo(
    () => [
      { title: "Customer", key: "customer", ellipsis: true, render: (_, r) => customerCell(r) },
      {
        title: "Cut off",
        key: "daysSuspended",
        width: 160,
        render: (_, r) => daysCell(r.daysSuspended, r.suspendedAt, "days"),
      },
      {
        title: "Owes",
        key: "amountOwed",
        width: 140,
        align: "right",
        render: (_, r) => (
          <div className="min-w-0">
            <div className="font-mono" style={{ fontSize: 13, color: "var(--color-text-dark)" }}>
              {formatPeso(r.amountOwed)}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {r.unpaidCount} unpaid
            </div>
          </div>
        ),
      },
      { title: "Modem", key: "onuMac", width: 190, render: (_, r) => modemCell(r) },
      {
        title: "Note",
        key: "exemptionUntil",
        width: 190,
        render: (_, r) =>
          // Shown rather than filtered out: an exemption shields somebody from
          // being cut off, and says nothing about a modem that has already sat
          // idle for two months. The person deciding should see it, not have the
          // row hidden from them.
          r.exemptionUntil ? (
            <span style={{ fontSize: 12.5, color: "var(--color-warning)" }}>
              Exempt until {dayjs(r.exemptionUntil).format("MMM D")}
            </span>
          ) : (
            <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>—</span>
          ),
      },
      {
        title: "",
        key: "actions",
        width: 60,
        align: "right",
        render: (_, record) =>
          canWrite ? (
            <RowActions
              items={[
                {
                  key: "revoke",
                  label: "Mark for pull-out",
                  icon: <PackageX className="w-4 h-4" />,
                  danger: true,
                  onClick: () => handleRevoke(record),
                },
              ]}
            />
          ) : null,
      },
    ],
    [canWrite, handleRevoke],
  );

  const pendingColumns = useMemo(
    () => [
      { title: "Customer", key: "customer", ellipsis: true, render: (_, r) => customerCell(r) },
      {
        title: "Where",
        key: "customerAddress",
        ellipsis: true,
        render: (_, r) => (
          <div className="min-w-0">
            <div
              className="truncate"
              style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
            >
              {decodeHTML(r.customerAddress) || "no address on file"}
            </div>
            <div className="truncate" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {r.customerPhone || "no number"}
            </div>
          </div>
        ),
      },
      { title: "Modem", key: "onuMac", width: 190, render: (_, r) => modemCell(r) },
      {
        title: "Waiting",
        key: "daysWaiting",
        width: 160,
        render: (_, r) => daysCell(r.daysWaiting, r.forRecoveryAt, "days"),
      },
      {
        title: "",
        key: "actions",
        width: 60,
        align: "right",
        render: (_, record) =>
          canWrite ? (
            <RowActions
              items={[
                {
                  key: "recovered",
                  label: "Modem recovered",
                  icon: <PackageX className="w-4 h-4" />,
                  onClick: () => handleClose(record, "recovered"),
                },
                {
                  key: "not_recovered",
                  label: "Could not recover it",
                  icon: <PackageX className="w-4 h-4" />,
                  danger: true,
                  onClick: () => handleClose(record, "not_recovered"),
                },
                { type: "divider" },
                {
                  key: "unrevoke",
                  label: "Cancel pull-out",
                  icon: <Undo2 className="w-4 h-4" />,
                  onClick: () => handleUnrevoke(record),
                },
              ]}
            />
          ) : null,
      },
    ],
    [canWrite, handleClose, handleUnrevoke],
  );

  const rows =
    tab === "candidates"
      ? (candidatesQuery.data?.data?.candidates ?? [])
      : (pendingQuery.data?.data?.pending ?? []);

  return {
    tab,
    setTab,
    search,
    setSearch,
    rows,
    columns: tab === "candidates" ? candidateColumns : pendingColumns,
    recoveryAfterDays: candidatesQuery.data?.data?.recoveryAfterDays ?? null,
    canWrite,
    isLoading: active?.isLoading ?? false,
    isFetching: active?.isFetching ?? false,
    isSaving: transitionMutation.isPending,
    error: active?.error ?? null,
    refetch: active?.refetch ?? (() => {}),
  };
};
