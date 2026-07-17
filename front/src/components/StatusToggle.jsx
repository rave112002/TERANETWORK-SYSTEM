/**
 * Segmented toggle for on/off choices (status, enabled, …) — use instead of a
 * <Select>. Controlled: works directly inside a <Form.Item name="status">,
 * which injects `value` / `onChange`.
 *
 * @param {string} [value]
 * @param {(v: string) => void} [onChange]
 * @param {{v: string, dot: string}[]} [options] - defaults to Active/Inactive
 */
const DEFAULT_OPTIONS = [
  { v: "Active", dot: "var(--color-success)" },
  { v: "Inactive", dot: "var(--color-text-muted)" },
];

const StatusToggle = ({ value, onChange, options = DEFAULT_OPTIONS }) => (
  <div
    className="grid gap-1 p-1"
    style={{
      gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      background: "var(--color-surface-sunken)",
      border: "1px solid var(--color-line)",
      borderRadius: 12,
    }}
  >
    {options.map((o) => {
      const active = value === o.v;
      return (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange?.(o.v)}
          className="flex items-center justify-center gap-2 transition-colors"
          style={{
            height: 40,
            borderRadius: 9,
            fontSize: 13.5,
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
            background: active ? "var(--color-surface)" : "transparent",
            color: active
              ? "var(--color-text-dark)"
              : "var(--color-text-secondary)",
            boxShadow: active ? "0 1px 2px rgba(0,0,0,.06)" : "none",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: o.dot,
            }}
          />
          {o.v}
        </button>
      );
    })}
  </div>
);

export default StatusToggle;
