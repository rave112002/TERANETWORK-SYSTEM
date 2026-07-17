import { memo } from "react";

/**
 * Stat card — de-emphasized label + dim icon on the top row, big value + unit
 * below. Flat by design: hairline border, radius 14, no shadow, no gradient bar.
 *
 * @param {string} title  - the de-emphasized label
 * @param {string|number} value
 * @param {string} [change] - the unit / caption sitting next to the value
 * @param {ReactNode} [icon] - a lucide icon; rendered dim
 */
const StatCard = ({ title, value, change, icon }) => (
  <div
    className="theme-transition"
    style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-line)",
      borderRadius: "var(--radius-card)",
      padding: "16px 18px",
    }}
  >
    <div className="flex items-center justify-between gap-3">
      <span
        className="truncate"
        style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}
      >
        {title}
      </span>
      {icon && (
        <span className="shrink-0" style={{ color: "var(--color-text-muted)" }}>
          {icon}
        </span>
      )}
    </div>

    <div className="flex items-baseline gap-1.5 mt-2.5">
      <span
        style={{
          fontSize: 30,
          fontWeight: 600,
          lineHeight: 1.1,
          letterSpacing: "-0.5px",
          color: "var(--color-text-dark)",
        }}
      >
        {value}
      </span>
      {change && (
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          {change}
        </span>
      )}
    </div>
  </div>
);

// Memoized: stat values rarely change, but parent pages re-render on every
// keystroke (search/filter state). React.memo skips re-render when props are equal.
export default memo(StatCard);
