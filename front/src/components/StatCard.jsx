import { memo } from "react";

const StatCard = ({ title, value, icon, color, bgColor, textColor, change }) => {
  return (
    <div
      className="theme-transition relative overflow-hidden rounded-2xl p-6 hover:-translate-y-0.5 transition-all duration-300"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-medium truncate mb-2"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {title}
          </p>
          <p
            className="text-2xl font-bold"
            style={{ color: "var(--color-text-dark)" }}
          >
            {value}
          </p>
          {change && (
            <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
              {change}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl shrink-0 ${bgColor} ${textColor}`}>
          {icon}
        </div>
      </div>
      <div
        className={`absolute bottom-0 left-0 right-0 h-1 bg-linear-to-r ${color}`}
      ></div>
    </div>
  );
};

// Memoized: stat values rarely change, but parent pages re-render on every
// keystroke (search/filter state). React.memo skips re-render when props are equal.
export default memo(StatCard);
