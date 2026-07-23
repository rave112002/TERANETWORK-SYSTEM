import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Rate-limit a user-triggered action to at most once per `ms`.
 *
 * Guards against spam-clicking an action button. A request that is already
 * in flight is not enough on its own: a fast endpoint re-enables the button
 * within milliseconds, so holding down a click still fires a burst. This adds
 * a floor on how often the action can run at all.
 *
 * Leading-edge: the first call runs immediately (the click feels responsive),
 * subsequent calls inside the window are dropped — not queued, because a
 * refresh that was superseded is not worth replaying.
 *
 * @param {Function} action  the callback to rate-limit
 * @param {number} ms        cooldown window in milliseconds
 * @returns {[Function, boolean]} `[run, isCoolingDown]`
 */
export const useCooldown = (action, ms = 2000) => {
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const timerRef = useRef(null);
  // Keep the latest action without restarting the cooldown when it re-creates.
  const actionRef = useRef(action);
  actionRef.current = action;

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const run = useCallback(
    (...args) => {
      if (timerRef.current) return undefined;

      setIsCoolingDown(true);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setIsCoolingDown(false);
      }, ms);

      return actionRef.current?.(...args);
    },
    [ms],
  );

  return [run, isCoolingDown];
};
