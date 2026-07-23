import dayjs from "dayjs";
import { Building2 } from "lucide-react";
import { decodeHTML } from "../../../../utils/decode-html";

// Status → dot colour. Anything not live reads as muted.
const STATUS_DOT = {
  Active: "var(--color-success)",
  Pending: "var(--color-warning)",
  Suspended: "var(--color-warning)",
  Inactive: "var(--color-text-muted)",
};

/**
 * Newest companies — a compact list, not a chart: the job here is identity +
 * recency, which reads better as rows than as marks.
 */
const RecentCompanies = ({ items = [] }) => (
  <div
    className="overflow-hidden"
    style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-line)",
      borderRadius: "var(--radius-card)",
    }}
  >
    <div
      className="flex items-center gap-2 px-[18px] py-3.5"
      style={{ borderBottom: "1px solid var(--color-line)" }}
    >
      <Building2
        className="w-4 h-4 shrink-0"
        strokeWidth={1.8}
        style={{ color: "var(--color-text-muted)" }}
      />
      <span
        style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-text-dark)" }}
      >
        Newest companies
      </span>
    </div>

    {items.length === 0 ? (
      <div className="px-[18px] py-14 text-center">
        <p className="m-0" style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          No companies yet
        </p>
      </div>
    ) : (
      <div>
        {items.map((c, i) => {
          const label = decodeHTML(c.name) || "";
          const initial = (label.trim().charAt(0) || "?").toUpperCase();
          return (
            <div
              key={c.companyId}
              className="flex items-center justify-between gap-4 px-[18px] py-3"
              style={
                i === 0 ? undefined : { borderTop: "1px solid var(--color-line-soft)" }
              }
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="inline-flex items-center justify-center shrink-0"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: "var(--color-surface-sunken)",
                    border: "1px solid var(--color-line)",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {initial}
                </span>
                <div className="min-w-0">
                  <p
                    className="m-0 font-medium truncate"
                    style={{ fontSize: 13.5, color: "var(--color-text-dark)" }}
                  >
                    {label}
                  </p>
                  <p
                    className="m-0 mt-0.5 truncate"
                    style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                  >
                    {c.subscriptionPlan} · {c.branchCount} branch
                    {Number(c.branchCount) === 1 ? "" : "es"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <span
                  className="inline-flex items-center gap-2"
                  style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background:
                        STATUS_DOT[c.status] || "var(--color-text-muted)",
                    }}
                  />
                  {c.status}
                </span>
                <span
                  className="hidden sm:inline"
                  style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                >
                  {dayjs(c.dateCreated).format("MMM D, YYYY")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

export default RecentCompanies;
