import dayjs from "dayjs";

import { decodeHTML } from "../../../../../utils/decode-html";
import { formatPeso } from "../../../../../utils/currency";

/** Table cells for the GCash Check lists. */

const muted = { fontSize: 12, color: "var(--color-text-muted)" };

/** A small grey second line under a cell value. */
export const Hint = ({ children }) => <div style={muted}>{children}</div>;

export const DateCell = ({ value }) => (
  <div className="min-w-0">
    <div style={{ fontSize: 13.5, color: "var(--color-text-dark)" }}>
      {value ? dayjs(value).format("MMM D, YYYY") : "—"}
    </div>
    <div style={muted}>{value ? dayjs(value).format("h:mm A") : ""}</div>
  </div>
);

export const PaymentCell = ({ payment }) => (
  <div className="min-w-0">
    <div className="truncate" style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
      {decodeHTML(payment.customerName) || "—"}
    </div>
    <div className="truncate" style={muted}>
      <span className="font-mono">{payment.invoiceNo}</span> · {payment.channel}
      {payment.recordedByName ? ` · ${decodeHTML(payment.recordedByName)}` : ""}
    </div>
  </div>
);

export const LineCell = ({ transaction }) => (
  <div className="min-w-0">
    <div className="truncate" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
      {decodeHTML(transaction.description) || "—"}
    </div>
    <div style={muted}>{dayjs(transaction.transactedAt).format("MMM D, YYYY h:mm A")}</div>
  </div>
);

export const Reference = ({ value }) => (
  <span className="font-mono" style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
    {value || "—"}
  </span>
);

/** The statement's reference with the characters that differ from the typed one marked. */
export const ReferenceDiff = ({ typed, actual }) => {
  const sameLength = typed.length === actual.length;
  return (
    <div className="min-w-0 font-mono" style={{ fontSize: 12.5 }}>
      <div style={{ color: "var(--color-text-muted)" }}>
        <span style={{ fontFamily: "inherit", fontSize: 11 }}>typed </span>
        {typed}
      </div>
      <div style={{ color: "var(--color-text-dark)" }}>
        <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>file&nbsp; </span>
        {sameLength
          ? [...actual].map((ch, i) => (
              <span
                // Position is the identity here: the same digit can appear twice.
                key={i}
                style={
                  ch === typed[i]
                    ? undefined
                    : { color: "var(--color-warning)", fontWeight: 700, textDecoration: "underline" }
                }
              >
                {ch}
              </span>
            ))
          : actual}
      </div>
    </div>
  );
};

export const Amount = ({ value, tone }) => (
  <span className="font-mono" style={{ fontSize: 13, color: tone || "var(--color-text-dark)" }}>
    {formatPeso(value)}
  </span>
);
