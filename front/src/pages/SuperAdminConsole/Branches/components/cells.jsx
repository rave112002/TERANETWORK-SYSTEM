import dayjs from "dayjs";

/** Table cells for the Branches list. */

/** What each status reads as. Only Online is green. */
const BRANCH_STATUS = {
  checking: { label: "Checking…", color: "var(--color-text-muted)" },
  online: { label: "Online", color: "var(--color-success)" },
  degraded: { label: "Database down", color: "var(--color-error)" },
  offline: { label: "Offline", color: "var(--color-error)" },
  unauthorized: { label: "Wrong key", color: "var(--color-warning)" },
  not_enabled: { label: "Not enabled", color: "var(--color-warning)" },
  incompatible: { label: "Needs update", color: "var(--color-warning)" },
  error: { label: "Error", color: "var(--color-error)" },
};

const muted = { fontSize: 12, color: "var(--color-text-muted)" };

export const StatusCell = ({ check }) => {
  const meta = BRANCH_STATUS[check?.status] ?? BRANCH_STATUS.checking;
  return (
    <div className="min-w-0">
      <div className="inline-flex items-center gap-2" style={{ fontSize: 13.5, color: "var(--color-text-dark)" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color }} />
        {meta.label}
      </div>
      <div className="truncate" style={muted}>
        {check?.status === "online" || check?.status === "degraded"
          ? `${check.latencyMs} ms · checked ${dayjs(check.checkedAt).format("h:mm:ss A")}`
          : check?.message || ""}
      </div>
    </div>
  );
};

export const WarningsCell = ({ check }) => {
  const warnings = check?.warnings ?? [];
  if (!check?.health) return <span style={muted}>—</span>;
  if (warnings.length === 0) {
    return <span style={{ fontSize: 13, color: "var(--color-success)" }}>All clear</span>;
  }
  return (
    <div className="min-w-0">
      <div className="truncate" style={{ fontSize: 13, color: "var(--color-warning)" }}>
        {warnings[0]}
      </div>
      {warnings.length > 1 && <div style={muted}>+{warnings.length - 1} more</div>}
    </div>
  );
};
