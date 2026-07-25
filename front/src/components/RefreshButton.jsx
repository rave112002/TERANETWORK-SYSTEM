import { Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCooldown } from "../hooks/useCooldown";

/**
 * The Refresh control every list page uses.
 *
 * Exists as a shared component so the spam guard can't regress: the button is
 * inert both while a fetch is in flight *and* for a short cooldown afterwards.
 *
 * Bind `isFetching` — **not** `isLoading`. React Query's `isLoading` is only
 * true for the first load of an empty cache, so on a refresh (which always has
 * cached data) it stays false and the button never disables at all.
 *
 * The trigger is wrapped in a <span> so the tooltip still fires while the button
 * is disabled (a disabled button has `pointer-events: none`).
 */
const RefreshButton = ({
  onRefresh,
  isFetching = false,
  cooldownMs = 2000,
  children = "Refresh",
  ...rest
}) => {
  const [run, isCoolingDown] = useCooldown(onRefresh, cooldownMs);
  const busy = isFetching || isCoolingDown;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            variant="outline"
            size="sm"
            onClick={run}
            disabled={busy}
            {...rest}
          >
            {busy ? <Loader2 className="animate-spin" /> : <RotateCw />}
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      {busy && (
        <TooltipContent>Just refreshed — hold on a moment</TooltipContent>
      )}
    </Tooltip>
  );
};

export default RefreshButton;
