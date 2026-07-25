import { AlertTriangle, Ban, FileQuestion } from "lucide-react";

/**
 * A centered status panel: framed icon + title + description + optional action.
 * `status` picks the icon/tint; pass `icon` to override. `action` is where the
 * primary button goes.
 *
 * status: "403" | "404" | "500" | "error"
 */
const PRESETS = {
  403: { Icon: Ban, tint: "var(--color-error)" },
  404: { Icon: FileQuestion, tint: "var(--color-text-muted)" },
  500: { Icon: AlertTriangle, tint: "var(--color-error)" },
  error: { Icon: AlertTriangle, tint: "var(--color-error)" },
};

const ResultState = ({
  status = "error",
  title,
  description,
  action,
  icon,
}) => {
  const preset = PRESETS[status] || PRESETS.error;
  const Icon = preset.Icon;

  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16">
      <span
        className="inline-flex items-center justify-center mb-5"
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: "var(--color-surface-sunken)",
          border: "1px solid var(--color-line)",
          color: preset.tint,
        }}
      >
        {icon || <Icon className="w-6 h-6" strokeWidth={1.8} />}
      </span>
      {title && (
        <h2
          className="m-0 font-semibold"
          style={{ fontSize: 20, letterSpacing: "-0.3px", color: "var(--color-text-dark)" }}
        >
          {title}
        </h2>
      )}
      {description && (
        <p
          className="m-0 mt-1.5 max-w-md"
          style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
};

export default ResultState;
