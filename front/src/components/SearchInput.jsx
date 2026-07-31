import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The filter input every list-page toolbar uses — search icon prefix + a clear
 * button. Controlled: `onChange` receives the raw string.
 */
const SearchInput = ({
  value,
  onChange,
  placeholder = "Search…",
  className,
  width = 280,
}) => (
  <div
    className={cn("relative", className)}
    style={{ width, maxWidth: "100%" }}
  >
    <Search
      className="pointer-events-none absolute left-3 top-1/2 h-3.75 w-3.75 -translate-y-1/2"
      style={{ color: "var(--color-text-muted)" }}
    />
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-10 pl-9 pr-9"
    />
    {value ? (
      <button
        type="button"
        aria-label="Clear search"
        onClick={() => onChange("")}
        className="icon-btn absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    ) : null}
  </div>
);

export default SearchInput;
