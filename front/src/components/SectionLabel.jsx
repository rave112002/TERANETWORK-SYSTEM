/**
 * Form section label — uppercase micro-label with an accent tick.
 * Groups fields inside a drawer; use instead of a <Divider>.
 */
const SectionLabel = ({ children }) => (
  <div className="flex items-center gap-2 mb-4">
    <span
      style={{
        width: 3,
        height: 14,
        borderRadius: 2,
        background: "var(--color-secondary-color)",
      }}
    />
    <span
      className="uppercase"
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        color: "var(--color-text-muted)",
      }}
    >
      {children}
    </span>
  </div>
);

export default SectionLabel;
