/**
 * Shared tooltip surface for all charts.
 *
 * Text wears text tokens; the small dot beside the value is the only thing that
 * carries the series colour (per the design system's "identity is a mark, not
 * coloured text" rule).
 */
const ChartTooltip = ({ active, payload, label, seriesColor, labelFormatter, valueLabel }) => {
  if (!active || !payload?.length) return null;

  const value = payload[0]?.value;

  return (
    <div
      style={{
        background: "var(--color-surface-raised, var(--color-surface))",
        border: "1px solid var(--color-line)",
        borderRadius: "var(--radius-control)",
        padding: "8px 10px",
        boxShadow: "0 4px 16px rgba(0,0,0,.10)",
      }}
    >
      <div style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>
        {labelFormatter ? labelFormatter(label) : label}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            flex: "none",
            background: seriesColor,
          }}
        />
        <span
          style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-text-dark)" }}
        >
          {value}
        </span>
        {valueLabel && (
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            {valueLabel}
          </span>
        )}
      </div>
    </div>
  );
};

export default ChartTooltip;
