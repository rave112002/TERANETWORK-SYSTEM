import dayjs from "dayjs";
import { Mail } from "lucide-react";

/**
 * Emails sent in the last 24 hours against the Gmail account's daily limit.
 *
 * Gmail counts a rolling 24 hours, not the calendar day, so neither does this.
 * `level` comes from the server (shared/manage-contract `emailUsageLevel`), so
 * this card and SuperAdmin never disagree about the same branch.
 */

const LEVEL = {
  ok: { label: "Within the limit", color: "var(--color-success)" },
  high: { label: "Getting close to the limit", color: "var(--color-warning)" },
  full: { label: "Limit reached", color: "var(--color-error)" },
};

const TYPE_LABEL = {
  invoice_issued: "Invoice",
  reminder: "Reminder",
  final: "Last notice",
  overdue: "Overdue notice",
  payment_received: "Payment received",
};

const muted = { fontSize: 12.5, color: "var(--color-text-muted)" };

const EmailUsageCard = ({ usage, isLoading }) => {
  if (isLoading || !usage) {
    return (
      <div className="px-4.5 py-4" style={cardStyle}>
        <span style={muted}>Loading email usage…</span>
      </div>
    );
  }

  const { sentLast24h, limit, quotaRefusedLast24h, configured, statementDayEstimate } = usage;
  const level = LEVEL[usage.level] ?? LEVEL.ok;
  const percent = limit > 0 ? Math.min(100, Math.round((sentLast24h / limit) * 100)) : 0;
  const failures = usage.recentFailures ?? [];

  return (
    <div style={cardStyle}>
      <div
        className="flex items-center justify-between gap-3 flex-wrap px-4.5 py-3.5"
        style={{ borderBottom: "1px solid var(--color-line)" }}
      >
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-dark)" }}>
            Email sending
          </span>
        </div>
        <span style={muted}>Gmail limit · last 24 hours</span>
      </div>

      <div className="px-4.5 py-4 space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <span style={{ fontSize: 30, fontWeight: 600, color: "var(--color-text-dark)" }}>
              {sentLast24h}
            </span>
            <span style={{ fontSize: 14, color: "var(--color-text-muted)" }}> / {limit} sent</span>
          </div>
          <span className="inline-flex items-center gap-2" style={{ fontSize: 13 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: level.color }} />
            <span style={{ color: "var(--color-text-secondary)" }}>{level.label}</span>
          </span>
        </div>

        <div
          style={{ height: 6, borderRadius: 3, background: "var(--color-surface-sunken)" }}
          role="meter"
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={sentLast24h}
          aria-label="Emails sent in the last 24 hours"
        >
          <div
            style={{ width: `${percent}%`, height: "100%", borderRadius: 3, background: level.color }}
          />
        </div>

        {quotaRefusedLast24h > 0 && (
          <p style={{ fontSize: 13, color: "var(--color-error)" }}>
            Gmail refused {quotaRefusedLast24h} email{quotaRefusedLast24h === 1 ? "" : "s"} for
            the daily limit. Retries stop after about half an hour, so these show as dead jobs
            below — resend them from the invoice once the count here has come down.
          </p>
        )}

        {!configured && (
          <p style={{ fontSize: 13, color: "var(--color-warning)" }}>
            Email is not set up on this branch (no SMTP in the server settings), so nothing is
            actually emailed — messages are only written to the server log.
          </p>
        )}

        <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          Next statement day sends about <strong>{statementDayEstimate}</strong> invoice email
          {statementDayEstimate === 1 ? "" : "s"}
          {statementDayEstimate > limit ? (
            <span style={{ color: "var(--color-error)" }}>
              {" "}
              — more than the limit. Emails past it are refused by Gmail and must be resent
              from their invoices the next day.
            </span>
          ) : (
            "."
          )}
        </p>
      </div>

      {failures.length > 0 && (
        <div style={{ borderTop: "1px solid var(--color-line)" }}>
          <div className="px-4.5 pt-3 pb-1" style={{ ...muted, fontWeight: 500 }}>
            Not sent in the last 24 hours
          </div>
          {failures.map((f) => (
            <div
              key={f.emailEventId}
              className="px-4.5 py-2.5 min-w-0"
              style={{ borderTop: "1px solid var(--color-line-soft)" }}
            >
              <div className="flex items-center justify-between gap-3 min-w-0">
                <span className="truncate" style={{ fontSize: 13.5, color: "var(--color-text-dark)" }}>
                  {TYPE_LABEL[f.type] ?? f.type}
                  {f.invoiceNo ? ` · ${f.invoiceNo}` : ""} → {f.recipient}
                </span>
                <span className="shrink-0" style={muted}>
                  {dayjs(f.dateCreated).format("MMM D, h:mm A")}
                </span>
              </div>
              <div className="truncate" style={muted} title={f.error || ""}>
                {f.error || "No reason recorded"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const cardStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-line)",
  borderRadius: "var(--radius-card)",
};

export default EmailUsageCard;
