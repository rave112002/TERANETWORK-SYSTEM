import { Loader2, PowerOff, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import SectionLabel from "../../../../../components/SectionLabel";
import { useRunDunningSweep } from "../../../../../services/requests/admin/billing";

/**
 * Running the disconnection sweep by hand.
 *
 * ── Why this is a drawer and not a button ───────────────────────────────────
 *
 * The sweep runs itself at 20:00 nightly, so in a normal week nobody opens
 * this. It exists for the night the box was down. That makes it exactly the
 * kind of control that should cost a deliberate second click and say plainly
 * what it does — a one-click "Run sweep" in a toolbar is a thing somebody
 * presses while looking at something else.
 *
 * It is also honest about the limits of its own power: the sweep queues, the
 * worker disconnects, and the worker asks again first.
 */
const SweepDrawer = ({ open, onClose, graceDays }) => {
  const sweepMutation = useRunDunningSweep();

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && !sweepMutation.isPending) onClose();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 p-0 sm:max-w-150"
        style={{ background: "var(--color-surface)" }}
      >
        <SheetTitle className="sr-only">Run the disconnection sweep</SheetTitle>

        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-3 mb-7">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0"
                  style={{ background: "var(--color-error)" }}
                >
                  <PowerOff className="w-5.5 h-5.5 text-white" />
                </span>
                <div className="min-w-0">
                  <h2
                    className="m-0 font-semibold leading-tight"
                    style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                  >
                    Run the disconnection sweep
                  </h2>
                  <p
                    className="m-0 mt-0.5"
                    style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                  >
                    This normally runs itself at 20:00
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                disabled={sweepMutation.isPending}
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

            <SectionLabel>What this does</SectionLabel>
            <div
              className="mb-5 px-4 py-4"
              style={{
                borderRadius: 10,
                border: "1px solid var(--color-line)",
                background: "var(--color-surface-sunken)",
              }}
            >
              <p className="m-0" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                Queues a disconnection for every active subscription with an invoice more
                than <strong>{graceDays} day{graceDays === 1 ? "" : "s"}</strong> past due,
                excluding anyone holding a live exemption.
              </p>
              <p
                className="m-0 mt-3"
                style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
              >
                It queues; it does not disconnect. The provisioning worker does the device
                work and checks the debt again immediately beforehand — so anybody who pays
                between now and then keeps their connection.
              </p>
              <p
                className="m-0 mt-3"
                style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
              >
                Safe to run twice. Somebody already queued is reported as pending rather
                than queued again.
              </p>
            </div>

            <p
              className="m-0"
              style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
            >
              Watch the result in <strong>System → Jobs</strong>, and each modem&apos;s own
              history under Network → ONUs.
            </p>
          </div>

          <div
            className="flex justify-end gap-3 p-6 pt-5"
            style={{
              borderTop: "1px solid var(--color-line)",
              paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
            }}
          >
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onClose}
              disabled={sweepMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="lg"
              variant="destructive"
              disabled={sweepMutation.isPending}
              onClick={() => sweepMutation.mutate({})}
            >
              {sweepMutation.isPending ? <Loader2 className="animate-spin" /> : <PowerOff />}
              Run sweep now
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SweepDrawer;
