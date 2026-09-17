import { useMemo } from "react";

import { useGetOperationsSummary } from "../../../services/requests/admin/reports";

/**
 * The operations dashboard.
 *
 * ── What belongs on this screen ─────────────────────────────────────────────
 *
 * It replaced a template dashboard that counted users, roles and audit entries
 * — true facts nobody starts their day by needing. What an ISP wants at 8am is:
 * what is owed, who is about to lose service, and what broke overnight.
 *
 * The "needs attention" list is the reason the page is worth opening. Every
 * item on it is a thing that will not fix itself, and each one links to the
 * screen where it gets fixed.
 */

/**
 * Turn the summary into the attention list.
 *
 * Only genuine problems appear — an empty list is the healthy state and should
 * read as one. A count of zero is deliberately not shown as "0 dead letters",
 * because a screen full of zeroes trains people to skim past it on the morning
 * one of them is not zero.
 */
const buildAttention = (attention) => {
  if (!attention) return [];

  const items = [];

  if (attention.deadLetters > 0) {
    items.push({
      key: "dead",
      severity: "error",
      title: `${attention.deadLetters} job${attention.deadLetters === 1 ? "" : "s"} gave up`,
      // A dead letter means a modem was never actually reconnected, or an
      // invoice was never actually emailed. It needs a person.
      detail: "Retried to exhaustion and stopped. Something did not happen.",
      to: "/admin/system",
      cta: "Open the job queue",
    });
  }

  if (attention.failed > 0) {
    items.push({
      key: "failed",
      severity: "warning",
      title: `${attention.failed} job${attention.failed === 1 ? "" : "s"} failing`,
      detail: "Still retrying, but not succeeding yet.",
      to: "/admin/system",
      cta: "Open the job queue",
    });
  }

  // The latest GCash statement check. Money that arrived unrecorded comes
  // first: that customer paid and may still be disconnected.
  const gcash = attention.gcash;
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (gcash?.inFileNotRecorded > 0) {
    items.push({
      key: "gcash-unrecorded",
      severity: "error",
      title: `${plural(gcash.inFileNotRecorded, "GCash payment")} not recorded`,
      detail: "Money arrived in the GCash account but no invoice was marked paid.",
      to: "/admin/billing/gcash-check",
      cta: "Open GCash Check",
    });
  }

  if (gcash?.possibleTypos > 0) {
    items.push({
      key: "gcash-typos",
      severity: "warning",
      title: plural(gcash.possibleTypos, "possible reference typo"),
      detail: "A typed reference is one or two characters off from one in the GCash statement.",
      to: "/admin/billing/gcash-check",
      cta: "Review the pairs",
    });
  }

  if (gcash?.recordedNotInFile > 0) {
    items.push({
      key: "gcash-missing",
      severity: "warning",
      title: `${plural(gcash.recordedNotInFile, "recorded payment")} not in the GCash statement`,
      detail: "A mistyped reference, or proof of payment that was not real.",
      to: "/admin/billing/gcash-check",
      cta: "Open GCash Check",
    });
  }

  if (gcash?.amountDiffers > 0) {
    items.push({
      key: "gcash-amount",
      severity: "info",
      title: `${plural(gcash.amountDiffers, "GCash amount")} ${gcash.amountDiffers === 1 ? "differs" : "differ"} from the statement`,
      detail: "Same reference, different amount: a typo, or a fee taken off.",
      to: "/admin/billing/gcash-check",
      cta: "Open GCash Check",
    });
  }

  if (attention.atRisk > 0) {
    items.push({
      key: "at-risk",
      severity: "warning",
      title: `${attention.atRisk} account${attention.atRisk === 1 ? "" : "s"} past due`,
      detail: "Heading for disconnection unless they pay or are exempted.",
      to: "/admin/billing/dunning",
      cta: "Open dunning",
    });
  }

  if (attention.unappliedAdjustments > 0) {
    items.push({
      key: "adjustments",
      severity: "info",
      title: `${attention.unappliedAdjustments} adjustment${attention.unappliedAdjustments === 1 ? "" : "s"} waiting`,
      detail: "Credits and charges that land on the next invoice.",
      to: "/admin/billing/adjustments",
      cta: "Review adjustments",
    });
  }

  if (attention.liveExemptions > 0) {
    items.push({
      key: "exemptions",
      severity: "info",
      title: `${attention.liveExemptions} account${attention.liveExemptions === 1 ? "" : "s"} shielded`,
      detail: "Exempt from automatic disconnection until their end date.",
      to: "/admin/billing/dunning",
      cta: "Review exemptions",
    });
  }

  return items;
};

export const useDashboardData = () => {
  const { data, isLoading, isFetching, error, refetch } = useGetOperationsSummary();

  const summary = data?.data ?? null;

  const attention = useMemo(() => buildAttention(summary?.attention), [summary]);

  return {
    summary,
    attention,
    money: summary?.money ?? { billedThisMonth: 0, outstanding: 0, overdue: 0, openInvoices: 0 },
    service: summary?.service ?? { active: 0, suspended: 0, pending: 0, monthlyRecurring: 0 },
    network:
      summary?.network ?? {
        onusActive: 0,
        onusSuspended: 0,
        onusOffline: 0,
        onusUnprovisioned: 0,
      },
    series: summary?.series ?? [],
    period: summary?.period ?? null,
    isLoading,
    isFetching,
    error,
    refetch,
  };
};
