import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Password field with a show/hide toggle and an optional lock-icon prefix.
 * All extra props (value, onChange, ref…) forward to the shadcn Input, so it
 * drops straight into a RHF field:
 *
 *   <FormControl>
 *     <PasswordInput placeholder="…" {...field} />
 *   </FormControl>
 */
const PasswordInput = ({ className, showLock = true, ...props }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      {showLock && (
        <Lock
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: "var(--color-text-muted)" }}
        />
      )}
      <Input
        type={visible ? "text" : "password"}
        className={cn("h-10 pr-9", showLock && "pl-9", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="icon-btn absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
};

export default PasswordInput;
