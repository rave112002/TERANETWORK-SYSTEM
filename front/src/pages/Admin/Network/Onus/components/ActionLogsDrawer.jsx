import { useState } from "react";
import { ChevronRight, ScrollText, X } from "lucide-react";
import dayjs from "dayjs";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import SectionLabel from "../../../../../components/SectionLabel";
import Spinner from "../../../../../components/Spinner";
import { useGetActionLogs } from "../../../../../services/requests/admin/network/provisioning";

/**
 * The device black box for one modem.
 *
 * Every command sent to the OLT and its verbatim reply. This is what settles
 * "why was I disconnected on the 3rd?" — so the raw text is shown exactly as
 * the device produced it, unwrapped and unformatted, rather than summarised.
 */

const ACTION_META = {
  activate: { label: "Restore", color: "var(--color-success)" },
  deactivate: { label: "Suspend", color: "var(--color-error)" },
  status: { label: "Status read", color: "var(--color-text-muted)" },
  dry_run: { label: "Dry run", color: "var(--color-warning)" },
};

/** "user:<uuid>" and "system:dunning" both need to read as a person or a cause. */
const describeActor = (triggeredBy) => {
  if (!triggeredBy) return "—";
  if (triggeredBy.startsWith("system:")) return `${triggeredBy.slice(7)} (automatic)`;
  if (triggeredBy.startsWith("user:")) return "a staff member";
  return triggeredBy;
};

const LogRow = ({ log }) => {
  const [open, setOpen] = useState(false);
  const meta = ACTION_META[log.action] ?? ACTION_META.status;
  const hasDetail = Boolean(log.command || log.deviceResponse || log.error);

  return (
    <div style={{ borderBottom: "1px solid var(--color-line-soft)" }}>
      <button
        type="button"
        onClick={() => hasDetail && setOpen(!open)}
        className="w-full flex items-center gap-3 py-3 text-left"
        style={{ cursor: hasDetail ? "pointer" : "default" }}
      >
        <ChevronRight
          className="w-3.5 h-3.5 shrink-0 transition-transform"
          style={{
            color: "var(--color-text-muted)",
            opacity: hasDetail ? 1 : 0,
            transform: open ? "rotate(90deg)" : "none",
          }}
        />

        <span
          className="shrink-0"
          style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color }}
        />

        <span
          className="shrink-0"
          style={{ fontSize: 13.5, fontWeight: 500, color: "var(--color-text-dark)", width: 100 }}
        >
          {meta.label}
        </span>

        <span
          className="shrink-0"
          style={{
            fontSize: 12.5,
            color: log.success ? "var(--color-text-secondary)" : "var(--color-error)",
            width: 80,
          }}
        >
          {log.success ? "OK" : "Failed"}
        </span>

        <span className="truncate flex-1" style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
          {describeActor(log.triggeredBy)}
        </span>

        <span
          className="shrink-0 font-mono"
          style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}
        >
          {dayjs(log.dateCreated).format("MMM D, HH:mm:ss")}
        </span>
      </button>

      {open && hasDetail && (
        <div className="pb-4 pl-9 space-y-3">
          {log.error && (
            <div>
              <SectionLabel>Outcome</SectionLabel>
              <p
                className="m-0"
                style={{ fontSize: 12.5, color: log.success ? "var(--color-text-secondary)" : "var(--color-error)" }}
              >
                {log.error}
              </p>
            </div>
          )}

          {log.command && (
            <div>
              <SectionLabel>Command sent</SectionLabel>
              <pre
                className="m-0 overflow-x-auto font-mono"
                style={{
                  fontSize: 11.5,
                  padding: 10,
                  borderRadius: 8,
                  background: "var(--color-surface-sunken)",
                  border: "1px solid var(--color-line)",
                  color: "var(--color-text-secondary)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {log.command}
              </pre>
            </div>
          )}

          {log.deviceResponse && (
            <div>
              <SectionLabel>Device reply, verbatim</SectionLabel>
              <pre
                className="m-0 overflow-x-auto font-mono"
                style={{
                  fontSize: 11.5,
                  padding: 10,
                  borderRadius: 8,
                  background: "var(--color-surface-sunken)",
                  border: "1px solid var(--color-line)",
                  color: "var(--color-text-secondary)",
                  whiteSpace: "pre-wrap",
                  maxHeight: 260,
                }}
              >
                {log.deviceResponse}
              </pre>
            </div>
          )}

          {log.durationMs !== null && log.durationMs !== undefined && (
            <p className="m-0" style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>
              Took {log.durationMs} ms{log.oltName ? ` · ${log.oltName}` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const ActionLogsDrawer = ({ open, onClose, onu }) => {
  const { data, isLoading } = useGetActionLogs(open ? onu?.onuId : undefined, {
    page: 1,
    pageSize: 50,
  });

  const logs = data?.data?.logs || [];

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 p-0 sm:max-w-200"
        style={{ background: "var(--color-surface)" }}
      >
        <SheetTitle className="sr-only">Device history</SheetTitle>

        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-3 mb-7">
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
                  <ScrollText className="w-5.5 h-5.5 text-white" />
                </span>
                <div className="min-w-0">
                  <h2
                    className="m-0 font-semibold leading-tight"
                    style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                  >
                    Device history
                  </h2>
                  <p
                    className="m-0 mt-0.5 font-mono truncate"
                    style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}
                  >
                    {onu?.mac || onu?.serialNo || "—"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
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

            <p
              className="m-0 mb-5"
              style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
            >
              Every command this system has sent to the OLT for this modem, with the device&apos;s
              own reply. Append-only — nothing here is ever edited or removed.
            </p>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner size="large" />
              </div>
            ) : logs.length === 0 ? (
              <p
                className="m-0 py-10 text-center"
                style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}
              >
                No commands have been sent to this modem yet.
              </p>
            ) : (
              <div style={{ borderTop: "1px solid var(--color-line)" }}>
                {logs.map((log) => (
                  <LogRow key={log.actionLogId} log={log} />
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ActionLogsDrawer;
