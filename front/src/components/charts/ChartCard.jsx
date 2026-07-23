/**
 * Flat card wrapper for a chart — hairline border, radius 14, no shadow, to
 * match the list/stat cards. The title names the series, which is why the
 * single-series charts inside carry no legend box.
 */
const ChartCard = ({ title, subtitle, action, children, height = 260 }) => (
  <div
    style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-line)",
      borderRadius: "var(--radius-card)",
    }}
  >
    <div
      className="flex items-center justify-between gap-3 px-[18px] py-3.5"
      style={{ borderBottom: "1px solid var(--color-line)" }}
    >
      <div className="min-w-0">
        <h2
          className="m-0 font-semibold leading-tight truncate"
          style={{ fontSize: 14, color: "var(--color-text-dark)" }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className="m-0 mt-0.5 truncate"
            style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>

    <div className="px-2 pt-4 pb-2" style={{ height }}>
      {children}
    </div>
  </div>
);

export default ChartCard;
