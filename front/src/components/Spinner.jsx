import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = { small: 16, default: 24, large: 32 };

/**
 * A standalone, centered spinner (lucide Loader2) tinted with the accent.
 * `size`: "small" | "default" | "large" | number(px). Optional `tip` renders a
 * label beneath it.
 */
const Spinner = ({ size = "default", tip, className }) => {
  const px = typeof size === "number" ? size : SIZES[size] || SIZES.default;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2
        className="animate-spin"
        style={{ width: px, height: px, color: "var(--color-secondary-color)" }}
        strokeWidth={2}
      />
      {tip && (
        <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          {tip}
        </span>
      )}
    </div>
  );
};

export default Spinner;
