// Pure data shaping for v2. No React, no fetch: node --test imports it directly.
// Reply state always comes from the backend resolver (effectiveReplyState / the
// replyState filter); this file only measures time and groups by store.

import { RECENT_WAIT_WINDOW_MS, businessMinutesBetween, needsFollowUp, realMinutesBetween } from "./business-hours.ts";

export type ReplyState = "REPLIED" | "NOT_REPLIED";

/** The fields v2 reads from an /conversations item. */
export type ConversationLike = {
  id: string;
  latestMessageAt: string;
  bmReplyStatus: string;
  effectiveReplyState?: ReplyState;
  replyStateProjection?: { decidingEventKind: "CUSTOMER_INBOUND" | "HUMAN_STAFF_REPLY"; decidingEventAt: string } | null;
  resolvedLineOaManagerUrl?: string | null;
  customer: { displayName: string };
  store: { id: string; name: string; lineManagerUrl: string | null; lineManagerUrlStatus: string };
};

/**
 * When the customer started waiting: the resolver's deciding customer message when it
 * recorded one, else the latest message time (what the backend summary's
 * oldestWaitingMinutes uses).
 */
export function waitingSinceOf(conversation: Pick<ConversationLike, "latestMessageAt" | "replyStateProjection">): string {
  const projection = conversation.replyStateProjection;
  if (projection && projection.decidingEventKind === "CUSTOMER_INBOUND" && projection.decidingEventAt) return projection.decidingEventAt;
  return conversation.latestMessageAt;
}

export function managerUrlOf(conversation: Pick<ConversationLike, "resolvedLineOaManagerUrl" | "store">): string | null {
  return conversation.resolvedLineOaManagerUrl || storeManagerUrlOf(conversation.store);
}

export function storeManagerUrlOf(store: ConversationLike["store"]): string | null {
  return store.lineManagerUrlStatus === "VALID" && store.lineManagerUrl ? store.lineManagerUrl : null;
}

export type WaitingChat = {
  id: string;
  storeId: string;
  storeName: string;
  customerName: string;
  waitingSince: string;
  businessMinutes: number;
  realMinutes: number;
  managerUrl: string | null;
};

export function toWaitingChat(conversation: ConversationLike, now: number): WaitingChat {
  const waitingSince = waitingSinceOf(conversation);
  return {
    id: conversation.id,
    storeId: conversation.store.id,
    storeName: conversation.store.name,
    customerName: conversation.customer.displayName,
    waitingSince,
    businessMinutes: businessMinutesBetween(waitingSince, now),
    realMinutes: realMinutesBetween(waitingSince, now),
    managerUrl: managerUrlOf(conversation),
  };
}

/** Longest business-hours wait first; ties by longest real wait, then id. */
export function sortWaitingChats(chats: WaitingChat[]): WaitingChat[] {
  return [...chats].sort((a, b) => b.businessMinutes - a.businessMinutes || b.realMinutes - a.realMinutes || a.id.localeCompare(b.id));
}

// ---- 24-hour reply rate (backend replyAnalytics rows) ----

export type ReplyRateRow = { storeId: string; storeName?: string; total: number; within24h: number; over24h: number; pending: number; responseRate24h: number | null };

export type ReplyRateTotals = { total: number; within24h: number; over24h: number; pending: number; rate: number | null };

/** The backend's own overview formula (Σwithin24h / Σtotal, one decimal), over the given stores. */
export function aggregateReplyRate(rows: ReplyRateRow[], includeStoreIds?: ReadonlySet<string>): ReplyRateTotals {
  const totals = { total: 0, within24h: 0, over24h: 0, pending: 0 };
  for (const row of rows) {
    if (includeStoreIds && !includeStoreIds.has(row.storeId)) continue;
    totals.total += row.total;
    totals.within24h += row.within24h;
    totals.over24h += row.over24h;
    totals.pending += row.pending;
  }
  return { ...totals, rate: totals.total === 0 ? null : Math.round((totals.within24h / totals.total) * 1000) / 10 };
}

export function rateDelta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return Math.round((current - previous) * 10) / 10;
}

// ---- Stores ----

/** One OA row of GET /operations/line-chat-nickname/mirror-status (Live Mirror chat collection). */
export type MirrorRow = { storeId: string | null; enabled: boolean; status: string; lastSuccessfulSyncAt: string | null };

/** A mirror sync older than this no longer counts as "collecting". */
export const MIRROR_FRESH_MS = 24 * 60 * 60 * 1000;

/**
 * Stores whose chats are being collected: at least one OA with Live Mirror enabled and a
 * successful sync within the last 24 hours.
 */
export function storesWithChatData(mirror: MirrorRow[], now: number): Set<string> {
  const collected = new Set<string>();
  for (const row of mirror) {
    if (!row.storeId || !row.enabled || !row.lastSuccessfulSyncAt) continue;
    const syncedAt = Date.parse(row.lastSuccessfulSyncAt);
    if (Number.isFinite(syncedAt) && now - syncedAt <= MIRROR_FRESH_MS) collected.add(row.storeId);
  }
  return collected;
}

/** Fallback when mirror status cannot be read: any conversation in the last 7 days (replyAnalytics total > 0). */
export function storesWithRecentActivity(rates7d: ReplyRateRow[]): Set<string> {
  return new Set(rates7d.filter((row) => row.total > 0).map((row) => row.storeId));
}

export function isRecentWait(waitingSince: string, now: number): boolean {
  return now - Date.parse(waitingSince) <= RECENT_WAIT_WINDOW_MS;
}

export type SummaryStore = { storeId: string; storeName: string; notReplied: number; notifiedBm: number; replied: number; oldestWaitingMinutes?: number };

export type StoreRow = {
  storeId: string;
  storeName: string;
  region: string | null;
  hasData: boolean;
  /** Backend count of NOT_REPLIED chats (notReplied + notifiedBm). */
  waitingCount: number;
  /** Waiting chats whose customer message is within the last 7 days. */
  recentWaitingCount: number;
  /** waitingCount − recentWaitingCount: the "ค้างเกิน 7 วัน" backlog. */
  oldWaitingCount: number;
  /** Real minutes since the oldest waiting chat (backend summary), for sorting by age. */
  oldestWaitingMinutes: number | null;
  /** Longest business-hours wait among the recent (≤ 7 days) waiting chats, or null when none. */
  longestBusinessMinutes: number | null;
  longestWaitingSince: string | null;
  longestChatId: string | null;
  /** A recent customer has waited ≥ the threshold in business hours. */
  needsFollowUp: boolean;
  rate7d: number | null;
  ratePrev7d: number | null;
  rateDelta: number | null;
  /** Daily 24-hour rate for the last 7 days, oldest first; null where no chats. */
  trend: Array<number | null>;
  managerUrl: string | null;
};

export function buildStoreRows(input: {
  summaryStores: SummaryStore[];
  waitingChats: WaitingChat[];
  /** null when no has-data source has loaded yet: then no store is marked as missing data. */
  storesWithData: ReadonlySet<string> | null;
  now: number;
  rates7d: ReplyRateRow[];
  ratesPrev7d: ReplyRateRow[];
  daily?: ReplyRateRow[][];
  regions?: ReadonlyMap<string, string | null>;
}): StoreRow[] {
  const byStore = new Map<string, WaitingChat[]>();
  for (const chat of input.waitingChats) {
    if (!isRecentWait(chat.waitingSince, input.now)) continue;
    const list = byStore.get(chat.storeId) ?? [];
    list.push(chat);
    byStore.set(chat.storeId, list);
  }
  const rateOf = (rows: ReplyRateRow[], storeId: string) => rows.find((row) => row.storeId === storeId)?.responseRate24h ?? null;
  return input.summaryStores.map((store) => {
    const chats = sortWaitingChats(byStore.get(store.storeId) ?? []);
    const longest = chats[0] ?? null;
    const rate7d = rateOf(input.rates7d, store.storeId);
    const ratePrev7d = rateOf(input.ratesPrev7d, store.storeId);
    const hasData = input.storesWithData ? input.storesWithData.has(store.storeId) : true;
    const longestBusinessMinutes = longest ? longest.businessMinutes : null;
    const waitingCount = store.notReplied + store.notifiedBm;
    const recentWaitingCount = Math.min(chats.length, waitingCount);
    return {
      storeId: store.storeId,
      storeName: store.storeName,
      region: input.regions?.get(store.storeId) ?? null,
      hasData,
      waitingCount,
      recentWaitingCount,
      oldWaitingCount: waitingCount - recentWaitingCount,
      oldestWaitingMinutes: waitingCount > 0 ? store.oldestWaitingMinutes ?? null : null,
      longestBusinessMinutes,
      longestWaitingSince: longest ? longest.waitingSince : null,
      longestChatId: longest ? longest.id : null,
      needsFollowUp: hasData && longestBusinessMinutes !== null && needsFollowUp(longestBusinessMinutes),
      rate7d,
      ratePrev7d,
      rateDelta: rateDelta(rate7d, ratePrev7d),
      trend: (input.daily ?? []).map((day) => rateOf(day, store.storeId)),
      managerUrl: chats.find((chat) => chat.managerUrl)?.managerUrl ?? null,
    };
  });
}

export type StoreTab = "follow-up" | "all" | "no-data";

/** ต้องตาม / ทั้งหมด (stores with data) / ไม่มีข้อมูล. */
export function filterStoreRows(rows: StoreRow[], tab: StoreTab): StoreRow[] {
  if (tab === "no-data") return rows.filter((row) => !row.hasData);
  if (tab === "follow-up") return rows.filter((row) => row.hasData && row.needsFollowUp);
  return rows.filter((row) => row.hasData);
}

export type StoreSort = "wait" | "age";

/**
 * "wait" (default): longest recent business-hours wait first, nothing waiting last.
 * "age": oldest waiting chat first (real time, includes the > 7-day backlog).
 * Ties: waiting count, then name.
 */
export function sortStoreRows(rows: StoreRow[], sort: StoreSort = "wait"): StoreRow[] {
  const key = (row: StoreRow) => (sort === "age" ? row.oldestWaitingMinutes : row.longestBusinessMinutes) ?? -1;
  return [...rows].sort((a, b) => key(b) - key(a) || b.waitingCount - a.waitingCount || a.storeName.localeCompare(b.storeName, "th"));
}

/** The longest waits for the "วันนี้" side list: one row per store (its longest recent wait). */
export function longestWaitPerStore(rows: StoreRow[], limit = 5): StoreRow[] {
  return sortStoreRows(rows.filter((row) => row.hasData && row.longestBusinessMinutes !== null)).slice(0, limit);
}

/** Stores with the biggest week-on-week drop in the 24-hour rate, biggest first. */
export function biggestRateDrops(rows: StoreRow[], limit = 3): StoreRow[] {
  return rows
    .filter((row) => row.hasData && row.rateDelta !== null && row.rateDelta < 0)
    .sort((a, b) => (a.rateDelta ?? 0) - (b.rateDelta ?? 0) || a.storeName.localeCompare(b.storeName, "th"))
    .slice(0, limit);
}

/** Counts for the KPI strip, all over stores with data only. */
export function responseKpis(rows: StoreRow[]) {
  const withData = rows.filter((row) => row.hasData);
  const waitingStores = withData.filter((row) => row.waitingCount > 0);
  return {
    storesWithData: withData.length,
    followUpStores: withData.filter((row) => row.needsFollowUp).length,
    waitingChats: waitingStores.reduce((sum, row) => sum + row.waitingCount, 0),
    waitingStores: waitingStores.length,
    oldBacklogChats: withData.reduce((sum, row) => sum + row.oldWaitingCount, 0),
    oldBacklogStores: withData.filter((row) => row.oldWaitingCount > 0).length,
    noDataStores: rows.length - withData.length,
    totalStores: rows.length,
  };
}
