// Timing rules for useDeferredLoading. Kept free of React so node --test can import it.

export const DEFERRED_LOADING_DELAY_MS = 200;
export const DEFERRED_LOADING_MIN_VISIBLE_MS = 400;

export type DeferredLoadingState = {
  isLoading: boolean;
  visible: boolean;
  /** When the placeholder became visible (ms); only meaningful while `visible`. */
  shownAt: number;
  now: number;
  delayMs: number;
  minVisibleMs: number;
};

/**
 * The next visibility change to schedule, or null when nothing should change.
 * - Loading and hidden: show after `delayMs`, so fast loads never flash a placeholder.
 * - Done and visible: hide once it has been visible for `minVisibleMs`, so it never blinks.
 */
export function nextDeferredLoadingChange({ isLoading, visible, shownAt, now, delayMs, minVisibleMs }: DeferredLoadingState): { visible: boolean; afterMs: number } | null {
  if (isLoading && !visible) return { visible: true, afterMs: delayMs };
  if (!isLoading && visible) return { visible: false, afterMs: Math.max(0, shownAt + minVisibleMs - now) };
  return null;
}
