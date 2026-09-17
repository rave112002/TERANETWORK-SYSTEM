import { useCallback, useMemo, useState } from "react";
import { Copy, EyeOff, Undo2, Wand2 } from "lucide-react";
import dayjs from "dayjs";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import RowActions from "../../../../components/RowActions";
import { usePermissions } from "../../../../hooks/usePermissions";
import {
  useDeletePaymentStatement,
  useFixPaymentReference,
  useGetPaymentStatements,
  useGetStatementReconciliation,
  useReviewStatementTransaction,
} from "../../../../services/requests/admin/billing";
import { confirm } from "../../../../store/confirmStore";
import { decodeHTML } from "../../../../utils/decode-html";
import { formatPeso } from "../../../../utils/currency";
import {
  Amount,
  DateCell,
  LineCell,
  Hint,
  PaymentCell,
  Reference,
  ReferenceDiff,
} from "./components/cells";

/**
 * GCash Check — the recorded payments compared with TERANETWORK's GCash
 * transaction history (docs/payments.md).
 *
 * ── One list at a time, most urgent first ───────────────────────────────────
 *
 * The page opens on the first list that has something in it, in this order:
 * possible typos (one click fixes two problems), money that arrived but was
 * never recorded (a paying customer may be cut off), recorded payments the
 * statement does not show (typo or fake proof), then amount differences.
 * Matched is last because it needs nothing from anyone.
 */
export const VIEWS = {
  possibleTypos: {
    label: "Possible typos",
    color: "var(--color-warning)",
    hint: "A recorded reference and a statement reference differ by one or two characters. Most likely the same payment, typed wrong.",
  },
  inFileNotRecorded: {
    label: "In the file, not recorded",
    color: "var(--color-error)",
    hint: "Money arrived but no invoice was marked paid. That customer may still be disconnected. Record the payment on their invoice, or mark the line as not a customer payment.",
  },
  recordedNotInFile: {
    label: "Recorded, not in the file",
    color: "var(--color-error)",
    hint: "A recorded payment whose reference is not in the statement: a mistyped reference, or a fake screenshot. Check the proof of payment.",
  },
  amountDiffers: {
    label: "Amount differs",
    color: "var(--color-warning)",
    hint: "Same reference, different amount: a typo, or a fee taken off.",
  },
  matched: {
    label: "Matched",
    color: "var(--color-success)",
    hint: "Reference and amount agree. Nothing to do.",
  },
  notCustomer: {
    label: "Not a customer",
    color: "var(--color-text-muted)",
    hint: "Money into the account that staff marked as not a customer payment.",
  },
};

const URGENT_ORDER = ["possibleTypos", "inFileNotRecorded", "recordedNotInFile", "amountDiffers"];

/* ── Hook ───────────────────────────────────────────────────────────────── */

export const useGcashCheckData = () => {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("billing", "payments", "write");

  const [selectedId, setSelectedId] = useState("");
  // The list someone picked, remembered per statement: a different statement
  // opens on its own most urgent list again.
  const [picked, setPicked] = useState({ statementId: "", view: null });
  const [uploadOpen, setUploadOpen] = useState(false);

  const statementsQuery = useGetPaymentStatements();
  const statements = useMemo(
    () => statementsQuery.data?.data?.statements ?? [],
    [statementsQuery.data]
  );

  // Follow the newest statement unless someone picked another one that still exists.
  const statementId =
    selectedId && statements.some((s) => s.statementId === selectedId)
      ? selectedId
      : statements[0]?.statementId || "";

  const reconciliationQuery = useGetStatementReconciliation(statementId);
  const result = reconciliationQuery.data?.data ?? null;
  const summary = result?.summary ?? {
    matched: 0,
    amountDiffers: 0,
    recordedNotInFile: 0,
    inFileNotRecorded: 0,
    notCustomer: 0,
    possibleTypos: 0,
  };

  const view = picked.statementId === statementId ? picked.view : null;
  const activeView = view ?? URGENT_ORDER.find((key) => summary[key] > 0) ?? "matched";
  const setView = useCallback(
    (next) => setPicked({ statementId, view: next }),
    [statementId]
  );

  const fixMutation = useFixPaymentReference();
  const reviewMutation = useReviewStatementTransaction();
  const deleteMutation = useDeletePaymentStatement();

  const handleCopy = useCallback(async (reference) => {
    try {
      await navigator.clipboard.writeText(reference);
      toast.success(`Copied ${reference}`);
    } catch {
      toast.error("Could not copy — select the reference and copy it by hand");
    }
  }, []);

  const handleFix = useCallback(
    async ({ payment, transaction }) => {
      const ok = await confirm({
        title: "Use the statement's reference?",
        description: `${decodeHTML(payment.customerName) || "This payment"} (${payment.invoiceNo}) was recorded with ${payment.referenceNo}. Change it to ${transaction.referenceNo}, as in the GCash statement? Only the reference changes. The old value is kept in the audit trail.`,
        confirmText: "Use statement reference",
      });
      if (ok) {
        fixMutation.mutate({
          paymentId: payment.paymentId,
          transactionId: transaction.transactionId,
        });
      }
    },
    [fixMutation]
  );

  const handleReview = useCallback(
    (transaction, reviewStatus) =>
      reviewMutation.mutate({ transactionId: transaction.transactionId, reviewStatus }),
    [reviewMutation]
  );

  const handleDeleteStatement = useCallback(async () => {
    const statement = statements.find((s) => s.statementId === statementId);
    if (!statement) return;
    const ok = await confirm({
      title: "Remove this statement?",
      description: `The check for ${dayjs(statement.periodStart).format("MMM D")} – ${dayjs(statement.periodEnd).format("MMM D, YYYY")} and its lines are removed. Use this for a wrong file. Payments are not touched.`,
      confirmText: "Remove",
      danger: true,
    });
    if (ok) deleteMutation.mutate(statementId);
  }, [deleteMutation, statementId, statements]);

  const handleUploaded = useCallback((response) => {
    const { statement, summary: counts, warnings } = response?.data ?? {};
    if (statement?.statementId) setSelectedId(statement.statementId);
    setPicked({ statementId: "", view: null });
    setUploadOpen(false);

    const problems = [
      counts?.possibleTypos && `${counts.possibleTypos} possible typo(s)`,
      counts?.inFileNotRecorded && `${counts.inFileNotRecorded} not recorded`,
      counts?.recordedNotInFile && `${counts.recordedNotInFile} not in the file`,
      counts?.amountDiffers && `${counts.amountDiffers} amount difference(s)`,
    ].filter(Boolean);
    toast.success(
      `Statement checked: ${statement?.creditCount ?? 0} incoming, ${statement?.newCreditCount ?? 0} new`,
      { description: problems.length ? problems.join(" · ") : "Everything matches." }
    );
    if (warnings?.length) {
      toast.warning("Some of the PDF could not be read cleanly", {
        description: warnings.join(" "),
        duration: 12000,
      });
    }
  }, []);

  const rows = useMemo(() => {
    if (!result) return [];
    switch (activeView) {
      case "possibleTypos":
        return result.possibleTypos.map((r) => ({
          ...r,
          key: `${r.payment.paymentId}:${r.transaction.transactionId}`,
        }));
      case "inFileNotRecorded":
      case "notCustomer":
        return result[activeView].map((r) => ({ ...r, key: r.transaction.transactionId }));
      default:
        return result[activeView].map((r) => ({ ...r, key: r.payment.paymentId }));
    }
  }, [result, activeView]);

  const columns = useMemo(() => {
    const paymentColumn = {
      title: "Recorded payment",
      key: "payment",
      ellipsis: true,
      render: (_, r) => <PaymentCell payment={r.payment} />,
    };
    const referenceColumn = (pick) => ({
      title: "Reference",
      key: "reference",
      width: 170,
      render: (_, r) => <Reference value={pick(r)} />,
    });

    switch (activeView) {
      case "possibleTypos":
        return [
          paymentColumn,
          {
            title: "Reference",
            key: "reference",
            width: 200,
            render: (_, r) => (
              <ReferenceDiff typed={r.payment.referenceNo} actual={r.transaction.referenceNo} />
            ),
          },
          {
            title: "Amount",
            key: "amount",
            width: 140,
            align: "right",
            render: (_, r) => (
              <div>
                <Amount value={r.payment.amount} />
                <Hint>
                  {r.sameAmount ? "same in file" : `file: ${formatPeso(r.transaction.amount)}`}
                </Hint>
              </div>
            ),
          },
          {
            title: "Statement line",
            key: "line",
            ellipsis: true,
            render: (_, r) => <LineCell transaction={r.transaction} />,
          },
          {
            title: "",
            key: "actions",
            width: 190,
            align: "right",
            render: (_, r) =>
              canWrite && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleFix(r)}
                  disabled={fixMutation.isPending}
                >
                  <Wand2 />
                  Use this reference
                </Button>
              ),
          },
        ];

      case "inFileNotRecorded":
      case "notCustomer":
        return [
          {
            title: "Received",
            key: "transactedAt",
            width: 150,
            render: (_, r) => <DateCell value={r.transaction.transactedAt} />,
          },
          {
            title: "From (as the statement says)",
            key: "description",
            ellipsis: true,
            render: (_, r) => (
              <span className="truncate" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                {decodeHTML(r.transaction.description) || "—"}
              </span>
            ),
          },
          referenceColumn((r) => r.transaction.referenceNo),
          {
            title: "Amount",
            key: "amount",
            width: 130,
            align: "right",
            render: (_, r) => <Amount value={r.transaction.amount} tone="var(--color-success)" />,
          },
          {
            title: "",
            key: "actions",
            width: 60,
            align: "right",
            render: (_, r) => (
              <RowActions
                items={[
                  {
                    key: "copy",
                    label: "Copy reference",
                    icon: <Copy className="w-4 h-4" />,
                    onClick: () => handleCopy(r.transaction.referenceNo),
                  },
                  ...(canWrite
                    ? [
                        activeView === "notCustomer"
                          ? {
                              key: "undo",
                              label: "Move back to not recorded",
                              icon: <Undo2 className="w-4 h-4" />,
                              onClick: () => handleReview(r.transaction, "open"),
                            }
                          : {
                              key: "not-customer",
                              label: "Not a customer payment",
                              icon: <EyeOff className="w-4 h-4" />,
                              onClick: () => handleReview(r.transaction, "not_customer"),
                            },
                      ]
                    : []),
                ]}
              />
            ),
          },
        ];

      case "recordedNotInFile":
        return [
          {
            title: "Recorded as received",
            key: "paidAt",
            width: 160,
            render: (_, r) => <DateCell value={r.payment.paidAt} />,
          },
          paymentColumn,
          referenceColumn((r) => r.payment.referenceNo),
          {
            title: "Amount",
            key: "amount",
            width: 130,
            align: "right",
            render: (_, r) => <Amount value={r.payment.amount} />,
          },
        ];

      case "amountDiffers":
        return [
          paymentColumn,
          referenceColumn((r) => r.payment.referenceNo),
          {
            title: "Recorded",
            key: "recorded",
            width: 130,
            align: "right",
            render: (_, r) => <Amount value={r.payment.amount} />,
          },
          {
            title: "In the file",
            key: "file",
            width: 130,
            align: "right",
            render: (_, r) => <Amount value={r.transaction.amount} tone="var(--color-warning)" />,
          },
        ];

      default:
        return [
          paymentColumn,
          referenceColumn((r) => r.payment.referenceNo),
          {
            title: "Amount",
            key: "amount",
            width: 130,
            align: "right",
            render: (_, r) => <Amount value={r.payment.amount} tone="var(--color-success)" />,
          },
          {
            title: "In the statement",
            key: "line",
            width: 190,
            render: (_, r) => <DateCell value={r.transaction.transactedAt} />,
          },
        ];
    }
  }, [activeView, canWrite, fixMutation.isPending, handleCopy, handleFix, handleReview]);

  return {
    canWrite,
    statements,
    statementId,
    setSelectedId,
    statement: result?.statement ?? statements.find((s) => s.statementId === statementId),
    summary,
    activeView,
    setView,
    rows,
    columns,
    isLoading: statementsQuery.isLoading || (!!statementId && reconciliationQuery.isLoading),
    isFetching: statementsQuery.isFetching || reconciliationQuery.isFetching,
    error: statementsQuery.error || reconciliationQuery.error,
    refetch: () => {
      statementsQuery.refetch();
      if (statementId) reconciliationQuery.refetch();
    },
    uploadOpen,
    handleOpenUpload: () => setUploadOpen(true),
    handleCloseUpload: () => setUploadOpen(false),
    handleUploaded,
    handleDeleteStatement,
    isDeleting: deleteMutation.isPending,
  };
};
