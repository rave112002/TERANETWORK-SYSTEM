/**
 * A single-column bordered label/value list used by the read-only view dialogs.
 *
 * items: { label: ReactNode, value: ReactNode }[]
 */
const DescriptionList = ({ items = [] }) => (
  <div
    style={{
      border: "1px solid var(--color-line)",
      borderRadius: 10,
      overflow: "hidden",
    }}
  >
    {items.map((item, i) => (
      <div
        key={i}
        className="grid grid-cols-[40%_60%]"
        style={{
          borderTop: i === 0 ? "none" : "1px solid var(--color-line)",
        }}
      >
        <div
          className="px-3.5 py-2.5"
          style={{
            fontSize: 13,
            color: "var(--color-text-secondary)",
            background: "var(--color-surface-sunken)",
            borderRight: "1px solid var(--color-line)",
          }}
        >
          {item.label}
        </div>
        <div
          className="px-3.5 py-2.5 min-w-0 break-words"
          style={{ fontSize: 13.5, color: "var(--color-text-dark)" }}
        >
          {item.value}
        </div>
      </div>
    ))}
  </div>
);

export default DescriptionList;
