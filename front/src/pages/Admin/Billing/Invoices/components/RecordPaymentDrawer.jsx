import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CalendarDays, HandCoins, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

import SectionLabel from "../../../../../components/SectionLabel";
import { useRecordPayment } from "../../../../../services/requests/admin/billing";
import { decodeHTML } from "../../../../../utils/decode-html";
import { formatPeso } from "../../../../../utils/currency";

/**
 * Recording a payment taken outside the gateway — cash at the counter, a bank
 * transfer, a GCash send confirmed by hand.
 *
 * ── The amount is typed, not prefilled ──────────────────────────────────────
 *
 * It would be one line to default it to the invoice total, and that is exactly
 * why it does not. The backend requires the amount to equal the total exactly;
 * prefilling turns that check into a formality that always passes, and the one
 * case it exists for — the clerk was handed less than the bill — sails through
 * as a settled invoice. Typing what was actually received is the check.
 */

/**
 * The channels the backend accepts. Kept in the same order the counter uses
 * them, not alphabetically.
 */
const CHANNELS = [
  { value: "CASH", label: "Cash" },
  { value: "GCASH", label: "GCash" },
  { value: "MAYA", label: "Maya" },
  { value: "QRPH", label: "QR Ph" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CARD", label: "Card" },
  { value: "OTHER", label: "Other" },
];

const paymentSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: "Enter the amount received" })
    .positive("The amount must be greater than zero")
    .max(9999999999.99, "That amount is too large"),
  channel: z.string().min(1, "Choose how it was paid"),
  // Blank means now. A payment banked yesterday should be dated yesterday.
  paidAt: z.string(),
  notes: z.string().max(255, "Keep the note under 255 characters"),
});

const EMPTY = { amount: "", channel: "CASH", paidAt: "", notes: "" };

const req = <span style={{ color: "var(--color-error)" }}>*</span>;

const RecordPaymentDrawer = ({ open, invoice, onClose }) => {
  const recordMutation = useRecordPayment();

  const form = useForm({ resolver: zodResolver(paymentSchema), defaultValues: EMPTY });

  useEffect(() => {
    if (open) form.reset(EMPTY);
  }, [open, form]);

  const handleClose = () => {
    form.reset(EMPTY);
    onClose();
  };

  const onSubmit = async (values) => {
    try {
      await recordMutation.mutateAsync({
        invoiceId: invoice.invoiceId,
        amount: values.amount,
        channel: values.channel,
        // Sent as a full timestamp so a back-dated payment lands at the start
        // of that day rather than at whatever hour the form was submitted.
        paidAt: values.paidAt ? `${values.paidAt} 00:00:00` : undefined,
        notes: values.notes || undefined,
      });
      handleClose();
    } catch {
      // The mutation's onError names the mismatch precisely — how much is owed
      // and how much was entered — so the drawer stays open to be corrected.
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
        className="w-full gap-0 p-0 sm:max-w-150"
        style={{ background: "var(--color-surface)" }}
      >
        <SheetTitle className="sr-only">Record payment</SheetTitle>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            autoComplete="off"
            className="flex h-full flex-col"
          >
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-start justify-between gap-3 mb-7">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
                    <HandCoins className="w-5.5 h-5.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      className="m-0 font-semibold leading-tight"
                      style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                    >
                      Record payment
                    </h2>
                    <p
                      className="m-0 mt-0.5 truncate"
                      style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                    >
                      {invoice?.invoiceNo} · {decodeHTML(invoice?.customerName) || "—"}
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

              {/* The figure to check against, stated once and prominently, so
                  the clerk is comparing rather than copying. */}
              <div
                className="mb-6 px-4 py-3.5 flex items-baseline justify-between gap-4"
                style={{
                  borderRadius: 10,
                  border: "1px solid var(--color-line)",
                  background: "var(--color-surface-sunken)",
                }}
              >
                <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
                  Amount due on this invoice
                </span>
                <span
                  className="font-mono"
                  style={{ fontSize: 17, fontWeight: 600, color: "var(--color-text-dark)" }}
                >
                  {formatPeso(invoice?.total)}
                </span>
              </div>

              <SectionLabel>Payment</SectionLabel>

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>Amount received {req}</FormLabel>
                    <div className="relative">
                      <span
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ fontSize: 13, color: "var(--color-text-muted)" }}
                      >
                        ₱
                      </span>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0.01"
                          placeholder="0.00"
                          className="h-10 pl-8 font-mono"
                          autoFocus
                          {...field}
                        />
                      </FormControl>
                    </div>
                    <p
                      className="m-0 mt-1.5"
                      style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                    >
                      Must match the amount due exactly — partial payments are not accepted.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="channel"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>Paid by {req}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="How was it paid?" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CHANNELS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paidAt"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>Date received</FormLabel>
                    <div className="relative">
                      <CalendarDays
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                        style={{ color: "var(--color-text-muted)" }}
                      />
                      <FormControl>
                        <Input type="date" className="h-10 pl-9" {...field} />
                      </FormControl>
                    </div>
                    <p
                      className="m-0 mt-1.5"
                      style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                    >
                      Leave blank for today.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference or note</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., GCash ref 0012345678, received by the Bicutan counter"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div
              className="flex justify-end gap-3 p-6 pt-5"
              style={{
                borderTop: "1px solid var(--color-line)",
                paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
              }}
            >
              <Button type="button" variant="outline" size="lg" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" size="lg" disabled={recordMutation.isPending}>
                {recordMutation.isPending ? <Loader2 className="animate-spin" /> : <HandCoins />}
                Record payment
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default RecordPaymentDrawer;
