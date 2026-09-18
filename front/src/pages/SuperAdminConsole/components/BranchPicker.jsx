import { Server } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * The branch a per-branch page acts on. Changes here go to that branch only.
 */
const BranchPicker = ({ branches, branch, onChange, disabled = false }) => (
  <div className="flex items-center gap-2.5">
    <Server className="w-4 h-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />
    <Select value={branch?.branchId ?? ""} onValueChange={onChange} disabled={disabled || branches.length === 0}>
      <SelectTrigger className="h-9 w-full sm:w-72">
        <SelectValue placeholder="Choose a branch" />
      </SelectTrigger>
      <SelectContent>
        {branches.map((b) => (
          <SelectItem key={b.branchId} value={b.branchId}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

export default BranchPicker;
