import { ReloadOutlined } from "@ant-design/icons";
import { Button, Tooltip } from "antd";
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
 * Ant's Button swallows onClick whenever `loading` is set, so `loading` alone
 * blocks the repeat clicks — no separate `disabled` needed.
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
    <Tooltip title={busy ? "Just refreshed — hold on a moment" : undefined}>
      <Button icon={<ReloadOutlined />} onClick={run} loading={busy} {...rest}>
        {children}
      </Button>
    </Tooltip>
  );
};

export default RefreshButton;
