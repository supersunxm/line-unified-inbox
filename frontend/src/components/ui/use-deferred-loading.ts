import { useEffect, useState } from "react";

/**
 * Returns true after a delay, useful for deferring skeleton display.
 * Avoids flickering on fast networks by only showing the skeleton after
 * the given delay.
 *
 * Cleanup: if component unmounts before the delay fires, the state change
 * is cancelled. If already showing, clearing isLoading does not cause the
 * skeleton to flash again.
 *
 * @param delay Milliseconds to wait before returning true; defaults to 200.
 * @param isLoading Whether the data is still loading; reset the timer on change.
 */
export function useDeferredLoading(delay = 200, isLoading = true): boolean {
  const [showDeferred, setShowDeferred] = useState(false);

  useEffect(() => {
    if (!isLoading) return;
    const timer = window.setTimeout(() => setShowDeferred(true), delay);
    return () => window.clearTimeout(timer);
  }, [isLoading, delay]);

  useEffect(() => {
    if (!isLoading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowDeferred(false);
    }
  }, [isLoading]);

  return showDeferred;
}
