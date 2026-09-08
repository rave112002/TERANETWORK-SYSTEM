import { toast } from "sonner";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAdjustmentApi,
  createExemptionApi,
  deleteAdjustmentApi,
  getAtRiskApi,
  getExemptionsApi,
  revokeExemptionApi,
  runDunningSweepApi,
  generateInvoiceApi,
  getAdjustmentsApi,
  getInvoiceByIdApi,
  getInvoicePdfApi,
  getInvoicesApi,
  getPaymentsApi,
  recordPaymentApi,
  resendInvoiceApi,
  runBillingCycleApi,
  runDailyBillingApi,
  voidInvoiceApi,
} from "../../api/admin/billing";

/**
 * Billing queries and mutations.
 *
 * ── Why almost everything invalidates almost everything ─────────────────────
 *
 * These four caches are one ledger seen from different angles. Recording a
 * payment changes the invoice, the invoice list's outstanding total, and the
 * payments list. Generating an invoice consumes open adjustments. Voiding one
 * releases them again. Refreshing only the list you are standing on leaves a
 * clerk looking at a stale number and wondering whether the payment went
 * through — which is the moment they record it twice.
 */
const invalidateBilling = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: ["invoices"] });
  queryClient.invalidateQueries({ queryKey: ["payments"] });
  queryClient.invalidateQueries({ queryKey: ["adjustments"] });
};

/* ── Invoices ───────────────────────────────────────────────────────────── */

export const useGetInvoices = (filters = {}, options = {}) =>
  useQuery({
    queryKey: ["invoices", filters],
    queryFn: () => getInvoicesApi(filters),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });

export const useGetInvoiceById = (invoiceId, options = {}) =>
  useQuery({
    queryKey: ["invoices", invoiceId],
    queryFn: () => getInvoiceByIdApi(invoiceId),
    enabled: !!invoiceId,
    staleTime: 60 * 1000,
    ...options,
  });

/**
 * Download an invoice PDF.
 *
 * A plain async function rather than a hook: this is an action a person takes,
 * not state a component renders, and caching a Blob would hold the whole
 * document in memory for as long as the query key lived.
 *
 * @param {string} invoiceId
 * @param {string} invoiceNo used for the filename.
 */
export const downloadInvoicePdf = async (invoiceId, invoiceNo) => {
  try {
    const blob = await getInvoicePdfApi(invoiceId);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${invoiceNo || "invoice"}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Released on the next tick — revoking synchronously can cancel the
    // download in Safari before it has started reading the blob.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    toast.error(error.response?.data?.message || "Could not download the invoice");
  }
};

export const useVoidInvoice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invoiceId, reason }) => voidInvoiceApi(invoiceId, { reason }),
    onSuccess: (_res, variables) => {
      toast.success("Invoice voided");
      invalidateBilling(queryClient);
      queryClient.invalidateQueries({ queryKey: ["invoices", variables.invoiceId] });
    },
    onError: (error) => {
      // The API refuses precisely — "a paid invoice cannot be voided, record a
      // refund instead" — and that is more useful than anything generic.
      toast.error(error.response?.data?.message || "Could not void the invoice");
    },
  });
};

export const useResendInvoice = () =>
  useMutation({
    mutationFn: resendInvoiceApi,
    onSuccess: (res) => {
      const recipient = res?.data?.recipient;
      toast.success(recipient ? `Queued for ${recipient}` : "Invoice queued for sending");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Could not queue the invoice");
    },
  });

/** The engine's skip reasons, said the way a person would say them. */
const SKIP_REASONS = {
  already_billed: "This subscription has already been billed for that month",
  not_active: "Only active subscriptions are billed — a suspended one accrues nothing",
  activated_after_period: "This subscription had not started yet in that month",
  subscription_not_found: "That subscription no longer exists",
};

export const useGenerateInvoice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateInvoiceApi,
    onSuccess: (res) => {
      const result = res?.data?.result;
      if (result?.status === "created") {
        toast.success(`Invoice ${result.invoiceNo} generated`);
      } else {
        // A skip is a normal answer, not a failure — and the reason is the
        // whole point of showing it.
        toast.info(SKIP_REASONS[result?.reason] || "No invoice was generated");
      }
      invalidateBilling(queryClient);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Could not generate the invoice");
    },
  });
};

export const useRunBillingCycle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: runBillingCycleApi,
    onSuccess: (res) => {
      const result = res?.data?.result;
      const created = result?.created ?? 0;
      const skipped = result?.skipped ?? 0;
      const failed = result?.failed ?? 0;

      if (failed > 0) {
        // Loud, and not a success toast: somebody did not get billed, and that
        // is discovered otherwise only when they ask why.
        toast.error(
          `${created} invoice${created === 1 ? "" : "s"} created, but ${failed} failed. Check the job queue.`
        );
      } else if (created === 0) {
        toast.info(`Nothing to bill — ${skipped} subscription${skipped === 1 ? "" : "s"} skipped`);
      } else {
        toast.success(
          `${created} invoice${created === 1 ? "" : "s"} created, ${skipped} skipped`
        );
      }

      invalidateBilling(queryClient);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "The billing cycle could not be run");
    },
  });
};

export const useRunDailyBilling = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: runDailyBillingApi,
    onSuccess: (res) => {
      const result = res?.data?.result;
      const overdue = result?.overdue?.updated ?? 0;
      const reminders = result?.reminders?.queued ?? 0;
      toast.success(
        `${overdue} marked overdue, ${reminders} reminder${reminders === 1 ? "" : "s"} queued`
      );
      invalidateBilling(queryClient);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "The daily run could not be completed");
    },
  });
};

/* ── Payments ───────────────────────────────────────────────────────────── */

export const useGetPayments = (filters = {}, options = {}) =>
  useQuery({
    queryKey: ["payments", filters],
    queryFn: () => getPaymentsApi(filters),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });

export const useRecordPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: recordPaymentApi,
    onSuccess: (res) => {
      // Said explicitly, because the clerk is usually standing in front of the
      // customer who is about to ask when their internet comes back.
      toast.success(
        res?.data?.reconnectQueued
          ? "Payment recorded — the connection is being restored"
          : "Payment recorded"
      );
      invalidateBilling(queryClient);
    },
    onError: (error) => {
      // The exact-amount refusal names both figures; passing it through
      // verbatim is what tells them whether to take more or give change.
      toast.error(error.response?.data?.message || "Could not record the payment");
    },
  });
};

/* ── Adjustments ────────────────────────────────────────────────────────── */

export const useGetAdjustments = (filters = {}, options = {}) =>
  useQuery({
    queryKey: ["adjustments", filters],
    queryFn: () => getAdjustmentsApi(filters),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });

export const useCreateAdjustment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAdjustmentApi,
    onSuccess: () => {
      // Says when it takes effect. An adjustment that appears to do nothing is
      // an adjustment somebody enters a second time.
      toast.success("Adjustment saved — it will appear on the next invoice");
      invalidateBilling(queryClient);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Could not save the adjustment");
    },
  });
};

export const useDeleteAdjustment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAdjustmentApi,
    onSuccess: () => {
      toast.success("Adjustment removed");
      invalidateBilling(queryClient);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Could not remove the adjustment");
    },
  });
};

/* ── Dunning ────────────────────────────────────────────────────────────── */

/**
 * Who is heading for disconnection.
 *
 * A short staleTime, and refetched on focus: this is the screen somebody has
 * open while phoning customers, and a stale "eligible" badge next to a name
 * they have just taken payment from is exactly the wrong thing to show.
 */
export const useGetAtRisk = (options = {}) =>
  useQuery({
    queryKey: ["dunning", "at-risk"],
    queryFn: getAtRiskApi,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    ...options,
  });

export const useGetExemptions = (filters = {}, options = {}) =>
  useQuery({
    queryKey: ["dunning", "exemptions", filters],
    queryFn: () => getExemptionsApi(filters),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });

const invalidateDunning = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: ["dunning"] });
  // A sweep queues device work, so the job list is now wrong too.
  queryClient.invalidateQueries({ queryKey: ["jobs"] });
};

export const useRunDunningSweep = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: runDunningSweepApi,
    onSuccess: (res) => {
      const result = res?.data?.result;
      const queued = result?.queued ?? 0;
      const deduped = result?.deduped ?? 0;

      if (result?.dryRun) {
        // Never let a dry run look like a real one. Somebody testing needs to
        // know nothing reached a device.
        toast.warning(
          `Dry run — ${queued} disconnect(s) queued but no commands will be sent`
        );
      } else if (queued === 0) {
        toast.success(
          deduped > 0
            ? `Nobody new — ${deduped} disconnect(s) already pending`
            : "Nobody is eligible for disconnection"
        );
      } else {
        // Deliberately not a success toast. Queuing disconnections is not a
        // thing to feel good about having done.
        toast.warning(
          `${queued} disconnect${queued === 1 ? "" : "s"} queued${deduped ? `, ${deduped} already pending` : ""}`
        );
      }

      invalidateDunning(queryClient);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "The sweep could not be run");
    },
  });
};

export const useCreateExemption = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createExemptionApi,
    onSuccess: () => {
      toast.success("Exemption granted — this account will not be disconnected automatically");
      invalidateDunning(queryClient);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Could not grant the exemption");
    },
  });
};

export const useRevokeExemption = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ exemptionId, reason }) => revokeExemptionApi(exemptionId, reason),
    onSuccess: () => {
      // Says what does and does not happen next: revoking removes the shield,
      // it does not cut anybody off on the spot.
      toast.success("Exemption revoked — eligible again from the next sweep");
      invalidateDunning(queryClient);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Could not revoke the exemption");
    },
  });
};
