import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Plus, Scale, X } from "lucide-react";

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

import SubscriptionChecklist from "./SubscriptionChecklist";
import SectionLabel from "../../../../../components/SectionLabel";
import {
  useCreateBulkAdjustment,
  useGetAdjustmentTargets,
} from "../../../../../services/requests/admin/billing";
import { confirm } from "../../../../../store/confirmStore";
import { formatPeso } from "../../../../../utils/currency";

/**
 * Raising a credit or a one-off charge.
 *
 * ── The amount is always positive here ──────────────────────────────────────
 *
 * The sign comes from the kind, and the backend applies it. A form that accepts
 * a signed number lets a stray minus turn a goodwill credit into a nine-hundred
 * peso charge on somebody's bill, and the person who typed it has no reason to
 * look twice. So: a positive figure, and a line underneath saying, in words,
 * which direction the bill will move.
 *
 * ── One subscription or many ────────────────────────────────────────────────
 *
 * The same adjustment can go on any number of subscriptions at once (an outage
 * credit for a whole area). It is saved in one all-or-nothing request, and
 * anything over one asks first, naming the count and the total, because a
 * wrong amount times three hundred is a morning of removals.
 */

const ADJUSTMENT_KINDS = [
  { value: "credit", label: "Credit", reduces: true, hint: "e.g., compensation for an outage" },
  { value: "discount", label: "Discount", reduces: true, hint: "e.g., a loyalty or promo discount" },
  { value: "debit", label: "Charge", reduces: false, hint: "e.g., a replacement router" },
  {
    value: "reconnection_fee",
    label: "Reconnection fee",
    reduces: false,
    hint: "charged when service is restored",
  },
  {
    value: "install_fee",
    label: "Installation fee",
    reduces: false,
    hint: "for work outside the original install",
  },
];

const adjustmentSchema = z.object({
  subscriptionIds: z.array(z.string()).min(1, "Choose whose bill this affects"),
  kind: z.string().min(1, "Choose what kind of adjustment this is"),
  description: z
    .string()
    .trim()
    .min(3, "Say what this is for — the customer sees this on their invoice")
    .max(255, "Keep it under 255 characters"),
  amount: z.coerce
    .number({ invalid_type_error: "Enter an amount" })
    .positive("Enter a positive amount — the kind decides the direction")
    .max(9999999999.99, "That amount is too large"),
});

const EMPTY = { subscriptionIds: [], kind: "credit", description: "", amount: "" };

const req = <span style={{ color: "var(--color-error)" }}>*</span>;

const AdjustmentFormDrawer = ({ open, onClose, onSuccess }) => {
  const createMutation = useCreateBulkAdjustment();

  // Only active and suspended subscriptions, and all of them: a terminated one
  // is never invoiced again, so a charge against it would sit unapplied
  // forever — the backend refuses it, and offering it here would be an
  // invitation to that refusal.
  const { data: targetsData, isLoading: targetsLoading } = useGetAdjustmentTargets({
    enabled: open,
  });
  const targets = targetsData?.data?.subscriptions ?? [];

  const form = useForm({ resolver: zodResolver(adjustmentSchema), defaultValues: EMPTY });
  const kind = form.watch("kind");
  const amount = form.watch("amount");
  const selectedCount = form.watch("subscriptionIds").length;
  const kindMeta = ADJUSTMENT_KINDS.find((k) => k.value === kind);

  useEffect(() => {
    if (open) form.reset(EMPTY);
  }, [open, form]);

  const handleClose = () => {
    form.reset(EMPTY);
    onClose();
  };

  const onSubmit = async (values) => {
    const count = values.subscriptionIds.length;
    if (count > 1) {
      const meta = ADJUSTMENT_KINDS.find((k) => k.value === values.kind);
      const each = Number(values.amount);
      const ok = await confirm({
        title: `Add this to ${count} subscriptions?`,
        description:
          `"${values.description.trim()}" — ${meta?.label ?? values.kind} of ${formatPeso(each)} on each, ` +
          `${formatPeso(each * count)} in all. Each customer's next invoice will be ` +
          `${meta?.reduces ? "lower" : "higher"} by ${formatPeso(each)}.`,
        confirmText: `Add to ${count}`,
        cancelText: "Go back",
      });
      if (!ok) return;
    }

    try {
      await createMutation.mutateAsync({
        subscriptionIds: values.subscriptionIds,
        kind: values.kind,
        description: values.description,
        amount: values.amount,
      });
      onSuccess?.();
    } catch {
      // onError has already said why; the drawer stays open to be corrected.
    }
  };

  const numericAmount = Number(amount);
  const previewAmount = Number.isFinite(numericAmount) && numericAmount > 0 ? numericAmount : null;

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
        <SheetTitle className="sr-only">Add adjustment</SheetTitle>

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
                    <Scale className="w-5.5 h-5.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      className="m-0 font-semibold leading-tight"
                      style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                    >
                      Add adjustment
                    </h2>
                    <p
                      className="m-0 mt-0.5"
                      style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                    >
                      On one subscription or many. Each gets its own line on the next invoice.
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

              <SectionLabel>Who</SectionLabel>
              <FormField
                control={form.control}
                name="subscriptionIds"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>Subscriptions {req}</FormLabel>
                    <SubscriptionChecklist
                      options={targets}
                      value={field.value}
                      onChange={field.onChange}
                      isLoading={targetsLoading}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <SectionLabel>What</SectionLabel>
              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>Kind {req}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="What kind of adjustment?" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ADJUSTMENT_KINDS.map((k) => (
                          <SelectItem key={k.value} value={k.value}>
                            <span className="flex flex-col items-start">
                              <span>{k.label}</span>
                              <span style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>
                                {k.hint}
                              </span>
                            </span>
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
                name="description"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>Description {req}</FormLabel>
                    <FormControl>
                      <Input
                        className="h-10"
                        placeholder="e.g., Outage credit, 3–5 July"
                        maxLength={255}
                        {...field}
                      />
                    </FormControl>
                    <p
                      className="m-0 mt-1.5"
                      style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                    >
                      This wording goes on the customer&apos;s invoice — write it for them.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount {req}</FormLabel>
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
                          {...field}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Says in words which way the bill moves, before it is saved. */}
              {previewAmount !== null && kindMeta && (
                <div
                  className="mt-5 px-4 py-3.5"
                  style={{
                    borderRadius: 10,
                    border: "1px solid var(--color-line)",
                    background: "var(--color-surface-sunken)",
                  }}
                >
                  <p
                    className="m-0"
                    style={{
                      fontSize: 13,
                      color: kindMeta.reduces ? "var(--color-success)" : "var(--color-text-dark)",
                    }}
                  >
                    {selectedCount > 1 ? "Each customer's next invoice" : "The next invoice"} will be{" "}
                    <strong>{kindMeta.reduces ? "lower" : "higher"}</strong> by{" "}
                    <span className="font-mono">{formatPeso(previewAmount)}</span>
                    {selectedCount > 1 ? (
                      <>
                        {" "}— <span className="font-mono">{formatPeso(previewAmount * selectedCount)}</span>{" "}
                        across {selectedCount} subscriptions.
                      </>
                    ) : (
                      "."
                    )}
                  </p>
                </div>
              )}
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
              <Button type="submit" size="lg" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                {selectedCount > 1 ? `Save ${selectedCount} adjustments` : "Save adjustment"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default AdjustmentFormDrawer;
