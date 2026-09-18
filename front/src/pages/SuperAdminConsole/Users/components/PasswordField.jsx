import { useState } from "react";
import { Copy, Eye, EyeOff, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { generatePassword } from "./passwords";

/**
 * A password input with Generate and Copy, for passwords SuperAdmin sets and
 * then hands to the person. Generating reveals it so it can be read out.
 */
const PasswordField = ({ field, placeholder }) => {
  const [visible, setVisible] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(field.value);
      toast.success("Password copied");
    } catch {
      toast.error("Could not copy — select it and copy by hand");
    }
  };

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <FormControl>
          <Input
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            placeholder={placeholder}
            className="h-10 pr-9 font-mono"
            {...field}
          />
        </FormControl>
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-2.5 top-1/2 -translate-y-1/2"
          style={{ color: "var(--color-text-muted)" }}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={() => {
          field.onChange(generatePassword());
          setVisible(true);
        }}
      >
        <Wand2 />
        Generate
      </Button>
      <Button type="button" variant="outline" size="lg" disabled={!field.value} onClick={copy} aria-label="Copy password">
        <Copy />
      </Button>
    </div>
  );
};

export default PasswordField;
