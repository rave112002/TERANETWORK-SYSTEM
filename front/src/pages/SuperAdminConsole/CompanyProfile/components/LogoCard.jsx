import { useRef } from "react";
import { Building2, CloudUpload, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import SectionLabel from "../../../../components/SectionLabel";

/**
 * The branch's logo. Uploading or removing applies straight away — it is its
 * own action on the branch, not part of the details form's Save.
 */
const LogoCard = ({ logoSrc, maxLogoMb, busy, onUpload, onRemove }) => {
  const inputRef = useRef(null);

  return (
    <div>
      <SectionLabel>Logo</SectionLabel>
      <div className="flex items-start gap-4">
        <div
          className="w-24 h-24 flex items-center justify-center overflow-hidden shrink-0"
          style={{
            borderRadius: 12,
            border: `1px ${logoSrc ? "solid" : "dashed"} var(--color-line)`,
            background: "var(--color-surface-sunken)",
          }}
        >
          {logoSrc ? (
            <img src={logoSrc} alt="Company logo" className="w-full h-full object-contain" width={96} height={96} />
          ) : (
            <Building2 className="w-8 h-8" style={{ color: "var(--color-text-muted)" }} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onUpload(file);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? <Loader2 className="animate-spin" /> : <CloudUpload />}
              {logoSrc ? "Change logo" : "Upload logo"}
            </Button>
            {logoSrc && (
              <Button type="button" variant="ghost" size="lg" disabled={busy} onClick={onRemove}>
                <Trash2 />
                Remove
              </Button>
            )}
          </div>
          <p className="m-0 mt-2" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            Printed on this branch&apos;s invoices. PNG or JPG, up to {maxLogoMb} MB. Saved immediately.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LogoCard;
