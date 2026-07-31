import dayjs from "dayjs";
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { ACTION_DOT } from "../hooks";
import SectionLabel from "../../../../components/SectionLabel";
import { decodeHTML } from "../../../../utils/decode-html";

// metadata is a JSON column — mysql2 may return it as a parsed object or a string.
const parseMetadata = (metadata) => {
  if (!metadata) return null;
  if (typeof metadata === "object") return metadata;
  try {
    return JSON.parse(metadata);
  } catch {
    return metadata; // not valid JSON — show the raw string
  }
};

// One label/value row in a field group.
const Field = ({ label, children }) => (
  <div
    className="flex items-start justify-between gap-6 py-2.5"
    style={{ borderBottom: "1px solid var(--color-line-soft)" }}
  >
    <span
      className="shrink-0"
      style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
    >
      {label}
    </span>
    <span
      className="min-w-0 text-right"
      style={{ fontSize: 13.5, color: "var(--color-text-dark)" }}
    >
      {children}
    </span>
  </div>
);

const AuditDetailModal = ({ open, onClose, log }) => {
  if (!log) return null;

  const meta = parseMetadata(log.metadata);
  const userName =
    decodeHTML([log.firstName, log.lastName].filter(Boolean).join(" ")) ||
    log.accountId ||
    "—";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-160 max-h-[85vh] overflow-y-auto"
      >
        <DialogTitle className="sr-only">Audit Event</DialogTitle>
        {/* Header — accent chip + title + subtitle + bordered X */}
        <div className="flex items-start justify-between gap-3 mb-7">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
            <FileText className="w-5.5 h-5.5 text-white" />
          </span>
          <div className="min-w-0">
            <h2
              className="m-0 font-semibold leading-tight"
              style={{ fontSize: 19, color: "var(--color-text-dark)" }}
            >
              Audit Event
            </h2>
            <p
              className="m-0 mt-0.5"
              style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
            >
              {dayjs(log.dateCreated).format("MMM D, YYYY h:mm:ss A")}
            </p>
          </div>
        </div>
        <button
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

      {/* Event */}
      <div>
        <SectionLabel>Event</SectionLabel>

        <Field label="Action">
          <span className="inline-flex items-center gap-2">
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                flex: "none",
                background: ACTION_DOT[log.action] || "var(--color-text-muted)",
              }}
            />
            {log.action || "—"}
          </span>
        </Field>
        <Field label="Module">{log.module || "—"}</Field>
        <Field label="Description">{decodeHTML(log.description) || "—"}</Field>
      </div>

      {/* Origin */}
      <div className="mt-7">
        <SectionLabel>Origin</SectionLabel>

        <Field label="User">{userName}</Field>
        <Field label="IP address">
          <span className="font-mono" style={{ fontSize: 12.5 }}>
            {log.ipAddress || "—"}
          </span>
        </Field>
        {/* Only present once the detail endpoint has loaded */}
        {log.userAgent && (
          <Field label="User agent">
            <span
              className="font-mono break-all"
              style={{ fontSize: 11.5, color: "var(--color-text-secondary)" }}
            >
              {log.userAgent}
            </span>
          </Field>
        )}
      </div>

      {/* Metadata */}
      {meta && (
        <div className="mt-7">
          <SectionLabel>Metadata</SectionLabel>

          <pre
            className="font-mono p-4 overflow-auto max-h-72 whitespace-pre-wrap break-words"
            style={{
              fontSize: 12,
              background: "var(--color-surface-sunken)",
              border: "1px solid var(--color-line)",
              borderRadius: "var(--radius-card)",
              color: "var(--color-text-dark)",
            }}
          >
            {typeof meta === "string" ? meta : JSON.stringify(meta, null, 2)}
          </pre>
        </div>
      )}

        {/* Footer */}
        <DialogFooter
          className="mt-8 pt-5"
          style={{ borderTop: "1px solid var(--color-line)" }}
        >
          <Button size="lg" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AuditDetailModal;
