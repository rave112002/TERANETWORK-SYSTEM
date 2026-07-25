import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The ⋮ row-actions menu every list table uses. `items` is the array the page
 * hooks build: { key, label, icon, onClick, danger? } with { type: "divider" }
 * separators. Renders nothing when there are no items (e.g. read-only users).
 */
const RowActions = ({ items = [] }) => {
  if (!items.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="hover:bg-(--color-surface-sunken)"
        >
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item, i) =>
          item.type === "divider" ? (
            <DropdownMenuSeparator key={`sep-${i}`} />
          ) : (
            <DropdownMenuItem
              key={item.key}
              variant={item.danger ? "destructive" : "default"}
              disabled={item.disabled}
              onClick={item.onClick}
            >
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default RowActions;
