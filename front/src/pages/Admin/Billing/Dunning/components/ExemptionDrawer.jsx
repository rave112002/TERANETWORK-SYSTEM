import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CalendarDays, Loader2, ShieldPlus, X } from "lucide-react";
import dayjs from "dayjs";

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
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

import SectionLabel from "../../../../../components/SectionLabel";
import { useCreateExemption } from "../../../../../services/requests/admin/billing";
import { decodeHTML } from "../../../../../utils/decode-html";
import { formatPeso } from "../../../../../utils/currency";

/**
 * Shielding one account from automatic disconnection.
 *
 * ── Both fields are load-bearing ────────────────────────────────────────────
 *
 * The reason is required and has a real minimum length, because the question it
 * answers is asked months later by somebody who was not in the room: "why is
 * this account four months overdue and still connected?" A blank reason is
 * indistinguishable from a mistake.
 *
 * The end date is required because an exemption with no end is not an
 * exemption — it is a silent permanent discount nobody revisits. Renewing puts
 * the decision back in front of a person on a schedule.
 */

/** Matches MAX_EXEMPTION_DAYS on the backend. */
const MAX_DAYS = 365;

const exemptionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, "Say why — a colleague will read this months from now")
    .max(255, "Keep it under 255 characters"),
  expiresAt: z
    .string()
    .min(10, "Choose when this exemption ends")
    .refine((v) => dayjs(v).isAfter(dayjs()), "The end date must be in the future")
    .refine(
      (v) => dayjs(v).diff(dayjs(), "day") <= MAX_DAYS,
      `An exemption cannot run more than ${MAX_DAYS} days ahead`
    ),
});

const EMPTY = { reason: "", expiresAt: "" };

const req = <span style={{ color: "var(--color-error)" }}>*</span>;

/** The common cases, so the ordinary decision is one click. */
const PRESETS = [
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "30 days", days: 30 },
];

const ExemptionDrawer = ({ open, record, onClose }) => {
  const createMutation = useCreateExemption();

  const form = useForm({ resolver: zodResolver(exemptionSchema), defaultValues: EMPTY });

  useEffect(() => {
    if (open) form.reset(EMPTY);
  }, [open, form]);

  const handleClose = () => {
    form.reset(EMPTY);
    onClose();
  };

  const onSubmit = async (values) => {
    try {
      await createMutation.mutateAsync({
        subscriptionId: record.subscriptionId,
        reason: values.reason,
        // End of the chosen day, not its first second — an exemption "until
        // Friday" should still hold on Friday evening when the sweep runs.
        expiresAt: `${values.expiresAt} 23:59:59`,
      });
      handleClose();
    } catch {
      // onError has already said why; the drawer stays open to be corrected.
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
        <SheetTitle className="sr-only">Grant exemption</SheetTitle>

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
                    <ShieldPlus className="w-5.5 h-5.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      className="m-0 font-semibold leading-tight"
                      style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                    >
                      Grant exemption
                    </h2>
                    <p
                      className="m-0 mt-0.5 truncate"
                      style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                    >
                      {decodeHTML(record?.customerName) || "—"} · {record?.accountNo}
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

              <div
                className="mb-6 px-4 py-3.5"
                style={{
                  borderRadius: 10,
                  border: "1px solid var(--color-line)",
                  background: "var(--color-surface-sunken)",
                }}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
                    Currently owes
                  </span>
                  <span
                    className="font-mono"
                    style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-dark)" }}
                  >
                    {formatPeso(record?.amountDue)}
                  </span>
                </div>
                <p
                  className="m-0 mt-2"
                  style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
                >
                  Overdue since {dayjs(record?.oldestDueDate).format("MMMM D, YYYY")} —{" "}
                  {record?.daysPastDue} day{record?.daysPastDue === 1 ? "" : "s"}. The debt
                  stands; this only stops the automatic disconnection.
                </p>
              </div>

              <SectionLabel>Until when</SectionLabel>
              <div className="flex flex-wrap gap-2 mb-3">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.days}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      form.setValue("expiresAt", dayjs().add(preset.days, "day").format("YYYY-MM-DD"), {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              <FormField
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>End date {req}</FormLabel>
                    <div className="relative">
                      <CalendarDays
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                        style={{ color: "var(--color-text-muted)" }}
                      />
                      <FormControl>
                        <Input
                          type="date"
                          className="h-10 pl-9"
                          min={dayjs().add(1, "day").format("YYYY-MM-DD")}
                          max={dayjs().add(MAX_DAYS, "day").format("YYYY-MM-DD")}
                          {...field}
                        />
                      </FormControl>
                    </div>
                    <p
                      className="m-0 mt-1.5"
                      style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                    >
                      From the next sweep after this date, the account is eligible again.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <SectionLabel>Why</SectionLabel>
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason {req}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Promised to pay Friday, spoke to Mrs Reyes on the 3rd"
                        rows={3}
                        maxLength={255}
                        {...field}
                      />
                    </FormControl>
                    <p
                      className="m-0 mt-1.5"
                      style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                    >
                      Recorded against your name. This is the answer to &ldquo;why is this
                      account still connected?&rdquo;
                    </p>
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
              <Button type="submit" size="lg" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="animate-spin" /> : <ShieldPlus />}
                Grant exemption
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default ExemptionDrawer;
