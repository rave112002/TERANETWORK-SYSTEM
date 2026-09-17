import { useState } from "react";
import { Ban, Download, FileText, HandCoins, Loader2, Send, X } from "lucide-react";
import dayjs from "dayjs";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import SectionLabel from "../../../../../components/SectionLabel";
import Spinner from "../../../../../components/Spinner";
import { usePermissions } from "../../../../../hooks/usePermissions";
import {
  downloadInvoicePdf,
  useGetInvoiceById,
  useResendInvoice,
  useVoidInvoice,
} from "../../../../../services/requests/admin/billing";
import { decodeHTML } from "../../../../../utils/decode-html";
import { formatPeso } from "../../../../../utils/currency";
import { INVOICE_STATUS } from "../hooks";

/**
 * One invoice, in full: its lines, its totals, and the money against it.
 *
 * ── Nothing here edits the document ─────────────────────────────────────────
 *
 * The only two things that can happen to an issued invoice are being paid and
 * being voided, and both are recorded rather than applied in place. That is why
 * this is a read view with two actions rather than a form: the copy in the
 * customer's inbox and the copy on this screen must never disagree.
 */

const Row = ({ label, value, mono = false, strong = false }) => (
  <div className="flex items-baseline justify-between gap-4 py-1.5">
    <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>{label}</span>
    <span
      className={mono ? "font-mono" : undefined}
      style={{
        fontSize: strong ? 15 : 13,
        fontWeight: strong ? 600 : 400,
        color: strong ? "var(--color-text-dark)" : "var(--color-text-secondary)",
      }}
    >
      {value}
    </span>
  </div>
);

const InvoiceDetailDrawer = ({ open, invoice, onClose, onRecordPayment, onPreviewPdf }) => {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("billing", "invoices", "write");
  const canRecordPayment = hasPermission("billing", "payments", "write");

  const [voiding, setVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  const { data, isLoading } = useGetInvoiceById(open ? invoice?.invoiceId : undefined);
  const voidMutation = useVoidInvoice();
  const resendMutation = useResendInvoice();

  const full = data?.data?.invoice ?? invoice ?? {};
  const lines = full.lines ?? [];
  const payments = full.payments ?? [];
  const meta = INVOICE_STATUS[full.status] ?? INVOICE_STATUS.issued;
  const isOpenInvoice = full.status === "issued" || full.status === "overdue";

  const handleClose = () => {
    setVoiding(false);
    setVoidReason("");
    onClose();
  };

  const handleVoid = async () => {
    try {
      await voidMutation.mutateAsync({
        invoiceId: full.invoiceId,
        reason: voidReason.trim(),
      });
      setVoiding(false);
      setVoidReason("");
    } catch {
      // The mutation's onError has already said what went wrong; the drawer
      // stays open on the reason field so it can be corrected.
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 p-0 sm:max-w-200"
        style={{ background: "var(--color-surface)" }}
      >
        <SheetTitle className="sr-only">Invoice {full.invoiceNo}</SheetTitle>

        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-3 mb-7">
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
                  <FileText className="w-5.5 h-5.5 text-white" />
                </span>
                <div className="min-w-0">
                  <h2
                    className="m-0 font-semibold leading-tight font-mono"
                    style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                  >
                    {full.invoiceNo || "—"}
                  </h2>
                  <p
                    className="m-0 mt-0.5 inline-flex items-center gap-2"
                    style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}
                  >
                    <span
                      style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color }}
                    />
                    {meta.label}
                    {full.billingPeriodStart
                      ? ` · ${dayjs(full.billingPeriodStart).format("MMMM YYYY")}`
                      : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="inline-flex items-center justify-center shrink-0 transition-colors hover:bg-(--color-surface-sunken)"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "1px solid var(--color-line)",
                  color: "var(--color-text-secondary)",
                }}
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner size="large" />
              </div>
            ) : (
              <>
                {full.status === "void" && (
                  <div
                    className="mb-6 px-4 py-3"
                    style={{
                      borderRadius: 10,
                      border: "1px solid var(--color-line)",
                      background: "var(--color-surface-sunken)",
                    }}
                  >
                    <p
                      className="m-0"
                      style={{ fontSize: 13, fontWeight: 600, color: "var(--color-error)" }}
                    >
                      This invoice is void
                    </p>
                    <p
                      className="m-0 mt-1"
                      style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}
                    >
                      {decodeHTML(full.voidReason) || "No reason was recorded."}
                    </p>
                  </div>
                )}

                <SectionLabel>Billed to</SectionLabel>
                <div className="mb-6">
                  <p className="m-0" style={{ fontSize: 14, color: "var(--color-text-dark)" }}>
                    {decodeHTML(full.customerName) || "—"}
                  </p>
                  <p
                    className="m-0 mt-0.5"
                    style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
                  >
                    {full.accountNo}
                    {full.customerEmail ? ` · ${full.customerEmail}` : ""}
                  </p>
                </div>

                <SectionLabel>Period</SectionLabel>
                <div className="mb-6">
                  <Row
                    label="Service period"
                    value={
                      full.billingPeriodStart
                        ? `${dayjs(full.billingPeriodStart).format("MMM D")} – ${dayjs(full.billingPeriodEnd).format("MMM D, YYYY")}`
                        : "—"
                    }
                  />
                  <Row
                    label="Statement date"
                    value={
                      full.statementDate ? dayjs(full.statementDate).format("MMM D, YYYY") : "—"
                    }
                  />
                  <Row
                    label="Due date"
                    value={full.dueDate ? dayjs(full.dueDate).format("MMM D, YYYY") : "—"}
                  />
                </div>

                <SectionLabel>Lines</SectionLabel>
                <div className="mb-2" style={{ borderTop: "1px solid var(--color-line)" }}>
                  {lines.map((line) => (
                    <div
                      key={line.invoiceLineId}
                      className="flex items-baseline justify-between gap-4 py-2.5"
                      style={{ borderBottom: "1px solid var(--color-line-soft)" }}
                    >
                      <span
                        className="min-w-0 truncate"
                        style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                      >
                        {decodeHTML(line.description)}
                      </span>
                      <span
                        className="font-mono shrink-0"
                        style={{
                          fontSize: 13,
                          // Credits read green, so a bill that went down is
                          // visibly a bill that went down.
                          color:
                            Number(line.amount) < 0
                              ? "var(--color-success)"
                              : "var(--color-text-dark)",
                        }}
                      >
                        {formatPeso(line.amount)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mb-6 pt-2">
                  <Row label="Subtotal" value={formatPeso(full.subtotal)} mono />
                  <Row label="Fees" value={formatPeso(full.fees)} mono />
                  <Row label="Tax" value={formatPeso(full.tax)} mono />
                  <div style={{ borderTop: "1px solid var(--color-line)" }} className="mt-2 pt-2">
                    <Row label="Total" value={formatPeso(full.total)} mono strong />
                  </div>
                </div>

                {payments.length > 0 && (
                  <>
                    <SectionLabel>Payments</SectionLabel>
                    <div className="mb-6" style={{ borderTop: "1px solid var(--color-line)" }}>
                      {payments.map((p) => (
                        <div
                          key={p.paymentId}
                          className="flex items-baseline justify-between gap-4 py-2.5"
                          style={{ borderBottom: "1px solid var(--color-line-soft)" }}
                        >
                          <div className="min-w-0">
                            <div
                              style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                            >
                              {p.channel}
                            </div>
                            <div
                              style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                            >
                              {dayjs(p.paidAt).format("MMM D, YYYY HH:mm")}
                              {p.providerPaymentId ? ` · Ref ${p.providerPaymentId}` : ""}
                              {p.notes ? ` · ${decodeHTML(p.notes)}` : ""}
                            </div>
                          </div>
                          <span
                            className="font-mono shrink-0"
                            style={{ fontSize: 13, color: "var(--color-success)" }}
                          >
                            {formatPeso(p.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {voiding && (
                  <div
                    className="mb-2 px-4 py-4"
                    style={{
                      borderRadius: 10,
                      border: "1px solid var(--color-line)",
                      background: "var(--color-surface-sunken)",
                    }}
                  >
                    <SectionLabel>Why is this being voided?</SectionLabel>
                    <Input
                      autoFocus
                      className="h-10"
                      placeholder="e.g., Duplicate of a manual bill"
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      maxLength={255}
                    />
                    {/* Said plainly: a void leaves a gap in a sequential
                        numbering series that somebody has to explain later. */}
                    <p
                      className="m-0 mt-2"
                      style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                    >
                      The invoice stays on record, marked void with this reason. Any
                      adjustments it carried return to the next invoice.
                    </p>
                    <div className="flex justify-end gap-2 mt-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setVoiding(false);
                          setVoidReason("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={voidReason.trim().length < 3 || voidMutation.isPending}
                        onClick={handleVoid}
                      >
                        {voidMutation.isPending ? <Loader2 className="animate-spin" /> : <Ban />}
                        Void invoice
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div
            className="flex flex-wrap justify-end gap-3 p-6 pt-5"
            style={{
              borderTop: "1px solid var(--color-line)",
              paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
            }}
          >
            {onPreviewPdf && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => onPreviewPdf({ ...invoice, ...full })}
              >
                <FileText />
                Preview
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => downloadInvoicePdf(full.invoiceId, full.invoiceNo)}
            >
              <Download />
              PDF
            </Button>

            {canWrite && full.status !== "void" && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={resendMutation.isPending}
                onClick={() => resendMutation.mutate(full.invoiceId)}
              >
                {resendMutation.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                Email
              </Button>
            )}

            {canWrite && isOpenInvoice && !voiding && (
              <Button type="button" variant="outline" size="lg" onClick={() => setVoiding(true)}>
                <Ban />
                Void
              </Button>
            )}

            {canRecordPayment && isOpenInvoice && (
              <Button
                type="button"
                size="lg"
                onClick={() => {
                  handleClose();
                  onRecordPayment?.(full);
                }}
              >
                <HandCoins />
                Record payment
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default InvoiceDetailDrawer;
