import { useState } from "react";
import { CalendarClock, Loader2, Mail, Play, X } from "lucide-react";
import dayjs from "dayjs";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import SectionLabel from "../../../../../components/SectionLabel";
import {
  useRunBillingCycle,
  useRunDailyBilling,
} from "../../../../../services/requests/admin/billing";

/**
 * Running the billing jobs by hand.
 *
 * ── Why this button exists at all ───────────────────────────────────────────
 *
 * Both jobs are scheduled — the cycle on the 15th, the sweep every morning —
 * and in a normal month nobody opens this drawer. It is here for the month the
 * box was down on the 15th, or a run half-failed and somebody needs to finish
 * it. Making that a support ticket instead of a button is how an ISP ends up
 * not billing anyone for a month.
 *
 * Pressing either twice is safe and says so on the screen: a second cycle run
 * reports skips rather than billing anyone again.
 */
const RunCycleDrawer = ({ open, onClose }) => {
  const cycleMutation = useRunBillingCycle();
  const dailyMutation = useRunDailyBilling();

  const [runDate, setRunDate] = useState("");

  // Cleared when the drawer opens, adjusted during render rather than in an
  // effect: an effect would paint last month's date for one frame before
  // wiping it, and this drawer's whole job is being unambiguous about which
  // month is about to be billed.
  const [hydratedFor, setHydratedFor] = useState(false);
  if (open !== hydratedFor) {
    setHydratedFor(open);
    if (open) setRunDate("");
  }

  const effectiveDate = runDate || dayjs().format("YYYY-MM-DD");
  const billedMonth = dayjs(effectiveDate).format("MMMM YYYY");
  const isPending = cycleMutation.isPending || dailyMutation.isPending;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && !isPending) onClose();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 p-0 sm:max-w-150"
        style={{ background: "var(--color-surface)" }}
      >
        <SheetTitle className="sr-only">Run billing</SheetTitle>

        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-3 mb-7">
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
                  <CalendarClock className="w-5.5 h-5.5 text-white" />
                </span>
                <div className="min-w-0">
                  <h2
                    className="m-0 font-semibold leading-tight"
                    style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                  >
                    Run billing
                  </h2>
                  <p
                    className="m-0 mt-0.5"
                    style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                  >
                    These normally run on a schedule — use this to catch up
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                disabled={isPending}
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

            <SectionLabel>Which month</SectionLabel>
            <Input
              type="date"
              className="h-10"
              value={runDate}
              onChange={(e) => setRunDate(e.target.value)}
            />
            <p
              className="m-0 mt-1.5 mb-7"
              style={{ fontSize: 12, color: "var(--color-text-muted)" }}
            >
              Leave blank for today. The cycle bills the whole calendar month this date
              falls in — currently <strong>{billedMonth}</strong>.
            </p>

            <SectionLabel>Monthly cycle</SectionLabel>
            <div
              className="mb-6 px-4 py-4"
              style={{
                borderRadius: 10,
                border: "1px solid var(--color-line)",
                background: "var(--color-surface-sunken)",
              }}
            >
              <p className="m-0" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                Issues an invoice for every <strong>active</strong> subscription for{" "}
                {billedMonth}, emails it, and carries over any open adjustments.
              </p>
              <p
                className="m-0 mt-2"
                style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
              >
                Suspended subscriptions are skipped and accrue nothing. Anything already
                billed for this month is skipped too, so running it twice is safe.
              </p>
              <Button
                type="button"
                className="mt-4 w-full"
                size="lg"
                disabled={isPending}
                onClick={() =>
                  cycleMutation.mutate(runDate ? { runDate } : {})
                }
              >
                {cycleMutation.isPending ? <Loader2 className="animate-spin" /> : <Play />}
                Generate invoices for {billedMonth}
              </Button>
            </div>

            <SectionLabel>Daily sweep</SectionLabel>
            <div
              className="px-4 py-4"
              style={{
                borderRadius: 10,
                border: "1px solid var(--color-line)",
                background: "var(--color-surface-sunken)",
              }}
            >
              <p className="m-0" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                Marks past-due invoices overdue and queues reminders for anything due in
                two days.
              </p>
              <p
                className="m-0 mt-2"
                style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
              >
                This does not disconnect anyone. Suspension happens separately, after the
                grace period.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4 w-full"
                size="lg"
                disabled={isPending}
                onClick={() => dailyMutation.mutate(runDate ? { runDate } : {})}
              >
                {dailyMutation.isPending ? <Loader2 className="animate-spin" /> : <Mail />}
                Sweep overdue and send reminders
              </Button>
            </div>
          </div>

          <div
            className="flex justify-end gap-3 p-6 pt-5"
            style={{
              borderTop: "1px solid var(--color-line)",
              paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
            }}
          >
            <Button type="button" variant="outline" size="lg" onClick={onClose} disabled={isPending}>
              Done
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default RunCycleDrawer;
