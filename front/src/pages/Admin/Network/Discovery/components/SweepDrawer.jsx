import { useState } from "react";
import { Loader2, ScanSearch, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import SectionLabel from "../../../../../components/SectionLabel";
import { useRunDiscovery } from "../../../../../services/requests/admin/network/discovery";

/**
 * Starting a sweep.
 *
 * Says plainly that it reads and does not write — because "Discovery" sounds
 * like it might reorganise the network, and a technician deciding whether it is
 * safe to press during business hours should not have to guess.
 */
const SweepDrawer = ({ open, onClose, oltOptions }) => {
  const [oltId, setOltId] = useState("");
  const sweepMutation = useRunDiscovery();

  // Cleared on open during render rather than in an effect: an effect would
  // briefly show the previously chosen OLT.
  const [hydratedFor, setHydratedFor] = useState(false);
  if (open !== hydratedFor) {
    setHydratedFor(open);
    if (open) setOltId("");
  }

  const handleRun = async () => {
    try {
      await sweepMutation.mutateAsync({ oltId });
      onClose();
    } catch {
      // onError has already named the failure; the drawer stays open so a
      // different OLT can be chosen.
    }
  };

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
        <SheetTitle className="sr-only">Sweep an OLT</SheetTitle>

        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-3 mb-7">
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
                  <ScanSearch className="w-5.5 h-5.5 text-white" />
                </span>
                <div className="min-w-0">
                  <h2
                    className="m-0 font-semibold leading-tight"
                    style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                  >
                    Sweep an OLT
                  </h2>
                  <p
                    className="m-0 mt-0.5"
                    style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                  >
                    Ask the device what modems it can see
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

            <SectionLabel>Which OLT</SectionLabel>
            <Select value={oltId} onValueChange={setOltId}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Choose an OLT" />
              </SelectTrigger>
              <SelectContent>
                {oltOptions.length === 0 && (
                  <div
                    className="px-2 py-3 text-center"
                    style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
                  >
                    No active OLTs
                  </div>
                )}
                {oltOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div
              className="mt-6 px-4 py-4"
              style={{
                borderRadius: 10,
                border: "1px solid var(--color-line)",
                background: "var(--color-surface-sunken)",
              }}
            >
              <p className="m-0" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                This <strong>reads only</strong>. It opens one session to the OLT, lists the
                modems it can see, and compares them with your records.
              </p>
              <p
                className="m-0 mt-3"
                style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
              >
                No customer is created, no modem is provisioned, and nobody&apos;s connection
                changes. Anything the sweep finds that you do not have on file is added to
                your inventory only when you import it, one at a time.
              </p>
              <p
                className="m-0 mt-3"
                style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
              >
                A large OLT can take a minute or two.
              </p>
            </div>
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
              disabled={!oltId || sweepMutation.isPending}
              onClick={handleRun}
            >
              {sweepMutation.isPending ? <Loader2 className="animate-spin" /> : <ScanSearch />}
              {sweepMutation.isPending ? "Reading the OLT…" : "Start sweep"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SweepDrawer;
