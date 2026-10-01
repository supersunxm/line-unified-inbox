import { useEffect, useRef, useState } from "react";
import { DEFERRED_LOADING_DELAY_MS, DEFERRED_LOADING_MIN_VISIBLE_MS, nextDeferredLoadingChange } from "./deferred-loading-model";

/**
 * Whether a loading placeholder should be on screen for `isLoading`.
 * Call it in the component that chooses between placeholder and content —
 * the placeholder cannot hold itself on screen once its parent unmounts it.
 */
export function useDeferredLoading(
  isLoading: boolean,
  { delayMs = DEFERRED_LOADING_DELAY_MS, minVisibleMs = DEFERRED_LOADING_MIN_VISIBLE_MS }: { delayMs?: number; minVisibleMs?: number } = {},
): boolean {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    const change = nextDeferredLoadingChange({ isLoading, visible, shownAt: shownAt.current, now: Date.now(), delayMs, minVisibleMs });
    if (!change) return undefined;
    const timer = window.setTimeout(() => {
      if (change.visible) shownAt.current = Date.now();
      setVisible(change.visible);
    }, change.afterMs);
    return () => window.clearTimeout(timer);
  }, [isLoading, visible, delayMs, minVisibleMs]);

  return visible;
}
