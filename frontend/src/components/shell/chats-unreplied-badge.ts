"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getCurrentBangkokMonth } from "@/app/chat-period";
import { unrepliedCount } from "@/lib/metrics/store-model";
import { sharedMonthSummary } from "@/lib/metrics/use-monthly-metrics";

/** At most one summary request per this interval, shared by every badge on the page. */
export const CHATS_BADGE_REFRESH_MS = 5 * 60 * 1000;

type BadgeState = { count: number | null; fetchedAt: number; inFlight: boolean };

let state: BadgeState = { count: null, fetchedAt: 0, inFlight: false };
const listeners = new Set<() => void>();

function publish(next: BadgeState) {
  state = next;
  for (const listener of listeners) listener();
}

/**
 * This month's ยังไม่ตอบ, exactly as /chats, Home, Dashboard and Store 360 count it: the same request
 * (bm-reply-status-summary?month=<current Bangkok month>, through the metrics layer's shared cache)
 * and the same helper (unrepliedCount = effectiveSummaryCounts(overview).notReplied).
 */
export async function loadChatsUnrepliedCount(): Promise<number> {
  const summary = await sharedMonthSummary(getCurrentBangkokMonth());
  return unrepliedCount(summary);
}

function refreshIfStale(now = Date.now()) {
  if (state.inFlight || now - state.fetchedAt < CHATS_BADGE_REFRESH_MS) return;
  publish({ ...state, inFlight: true });
  loadChatsUnrepliedCount().then(
    (count) => publish({ count, fetchedAt: Date.now(), inFlight: false }),
    // On error the badge is hidden until the next allowed refresh.
    () => publish({ count: null, fetchedAt: Date.now(), inFlight: false }),
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** null while loading, on error, or when disabled: the badge is then not rendered. Never blocks rendering. */
export function useChatsUnrepliedBadge(enabled: boolean): number | null {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => state);
  useEffect(() => {
    if (!enabled) return;
    refreshIfStale();
    const timer = window.setInterval(() => refreshIfStale(), CHATS_BADGE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return enabled ? snapshot.count : null;
}
