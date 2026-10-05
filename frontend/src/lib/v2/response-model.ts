// Pure data shaping for v2. No React, no fetch: node --test imports it directly.
// Reply state always comes from the backend resolver (effectiveReplyState / the
// replyState filter); this file only measures time and groups by store.

import { thaiLocationLabel } from "./thai-geo.ts";
import { FOLLOW_TODAY_LIMIT, RECENT_WAIT_WINDOW_MS, businessMinutesBetween, followTodayWindowStart, needsFollowUp, realMinutesBetween } from "./business-hours.ts";

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

export type StoreLocation = { region: string | null; province: string | null };

export type StoreRow = {
  storeId: string;
  storeName: string;
  /** From GET /stores (Store.region / Store.area, synced from StoreMaster); null when unknown. */
  region: string | null;
  province: string | null;
  hasData: boolean;
  /** Backend count of NOT_REPLIED chats (notReplied + notifiedBm). */
  waitingCount: number;
  /** Waiting chats whose customer message is within the last 7 days. */
  recentWaitingCount: number;
  /** waitingCount − recentWaitingCount: the "ค้างเกิน 7 วัน" backlog. */
  oldWaitingCount: number;
  /** Real minutes since the oldest waiting chat (backend summary), for sorting by age. */
  oldestWaitingMinutes: number | null;
  /** Waiting chats whose customer message was sent since yesterday 10:00 ("รอตอบ (ตั้งแต่เมื่อวาน)"). */
  sinceYesterdayCount: number;
  /** Of those, the chats that have waited ≥ the follow-up threshold in business minutes. */
  followTodayCount: number;
  /** Longest business-hours wait among the followTodayCount chats, or null. */
  followTodayLongestMinutes: number | null;
  /** Longest business-hours wait among the since-yesterday chats (any length), with its chat. */
  windowLongestMinutes: number | null;
  windowLongestWaitingSince: string | null;
  windowLongestChatId: string | null;
  /** Position in "ตามวันนี้" (1-based), or null when the store is not in it. */
  followTodayRank: number | null;
  /** Longest business-hours wait among the recent (≤ 7 days) waiting chats, or null when none. */
  longestBusinessMinutes: number | null;
  longestWaitingSince: string | null;
  longestChatId: string | null;
  /** The store's longest recent wait has reached the threshold (red badges). */
  hasOverdueWait: boolean;
  rate7d: number | null;
  ratePrev7d: number | null;
  rateDelta: number | null;
  /** Daily 24-hour rate for the last 7 days, oldest first; null where no chats. */
  trend: Array<number | null>;
  managerUrl: string | null;
};

/** "ภาค · จังหวัด" in Thai (thai-geo.ts), or null (then nothing is shown). */
export function locationLabel(row: Pick<StoreRow, "region" | "province">): string | null {
  return thaiLocationLabel(row.region, row.province);
}

export type WaitScope = "window" | "7d";

/**
 * The one "รอนานสุด" for a store in a given scope, so every place agrees:
 * "window" = since yesterday 10:00 (ตามวันนี้ tab, "วันนี้" item 1 and top 5);
 * "7d" = the last 7 days (ทั้งหมด, shown as "รอนานสุด (7 วัน)").
 */
export function displayedWait(row: StoreRow, scope: WaitScope): { minutes: number | null; waitingSince: string | null; chatId: string | null } {
  return scope === "window"
    ? { minutes: row.windowLongestMinutes, waitingSince: row.windowLongestWaitingSince, chatId: row.windowLongestChatId }
    : { minutes: row.longestBusinessMinutes, waitingSince: row.longestWaitingSince, chatId: row.longestChatId };
}

/** The synthetic "Focus group · 7 stores" row that bm-reply-status-summary prepends; it is not a Store. */
export const FOCUS_GROUP_SUMMARY_ID = "focus-seven-store-group";

/**
 * A v2 store is a summary row whose id is a Store record (from GET /stores). The synthetic
 * focus-group row is never one: its counts are 7 real stores counted a second time.
 * Without the Store list, only the synthetic id is dropped.
 */
export function isRealStore(storeId: string, storeIds: ReadonlySet<string> | null | undefined): boolean {
  if (storeId === FOCUS_GROUP_SUMMARY_ID) return false;
  return storeIds ? storeIds.has(storeId) : true;
}

/**
 * "ตามวันนี้": stores with data and at least one chat waiting ≥ the threshold whose customer
 * message was sent since yesterday 10:00. Most such chats first, then the longest of those
 * waits, then name (so ties are cut deterministically). At most `limit` stores.
 */
export function selectFollowToday<T extends Pick<StoreRow, "hasData" | "followTodayCount" | "followTodayLongestMinutes" | "storeName">>(rows: T[], limit = FOLLOW_TODAY_LIMIT): T[] {
  return rows
    .filter((row) => row.hasData && row.followTodayCount > 0)
    .sort((a, b) => b.followTodayCount - a.followTodayCount
      || (b.followTodayLongestMinutes ?? 0) - (a.followTodayLongestMinutes ?? 0)
      || a.storeName.localeCompare(b.storeName, "th"))
    .slice(0, limit);
}

export function buildStoreRows(input: {
  summaryStores: SummaryStore[];
  waitingChats: WaitingChat[];
  /** null when no has-data source has loaded yet: then no store is marked as missing data. */
  storesWithData: ReadonlySet<string> | null;
  now: number;
  rates7d: ReplyRateRow[];
  ratesPrev7d: ReplyRateRow[];
  daily?: ReplyRateRow[][];
  locations?: ReadonlyMap<string, StoreLocation>;
  /** Store record ids (GET /stores); rows not in it are not stores. null/undefined: only the synthetic group is dropped. */
  storeIds?: ReadonlySet<string> | null;
  followTodayLimit?: number;
}): StoreRow[] {
  const byStore = new Map<string, WaitingChat[]>();
  for (const chat of input.waitingChats) {
    if (!isRecentWait(chat.waitingSince, input.now)) continue;
    const list = byStore.get(chat.storeId) ?? [];
    list.push(chat);
    byStore.set(chat.storeId, list);
  }
  const windowStart = followTodayWindowStart(input.now);
  const rateOf = (rows: ReplyRateRow[], storeId: string) => rows.find((row) => row.storeId === storeId)?.responseRate24h ?? null;
  const rows: StoreRow[] = input.summaryStores.filter((store) => isRealStore(store.storeId, input.storeIds)).map((store) => {
    const chats = sortWaitingChats(byStore.get(store.storeId) ?? []);
    const longest = chats[0] ?? null;
    const rate7d = rateOf(input.rates7d, store.storeId);
    const ratePrev7d = rateOf(input.ratesPrev7d, store.storeId);
    const hasData = input.storesWithData ? input.storesWithData.has(store.storeId) : true;
    const longestBusinessMinutes = longest ? longest.businessMinutes : null;
    const waitingCount = store.notReplied + store.notifiedBm;
    const recentWaitingCount = Math.min(chats.length, waitingCount);
    const sinceYesterday = chats.filter((chat) => Date.parse(chat.waitingSince) >= windowStart);
    const overdueSinceYesterday = sinceYesterday.filter((chat) => needsFollowUp(chat.businessMinutes));
    const location = input.locations?.get(store.storeId);
    return {
      storeId: store.storeId,
      storeName: store.storeName,
      region: location?.region ?? null,
      province: location?.province ?? null,
      hasData,
      waitingCount,
      recentWaitingCount,
      oldWaitingCount: waitingCount - recentWaitingCount,
      oldestWaitingMinutes: waitingCount > 0 ? store.oldestWaitingMinutes ?? null : null,
      sinceYesterdayCount: sinceYesterday.length,
      followTodayCount: overdueSinceYesterday.length,
      followTodayLongestMinutes: overdueSinceYesterday[0]?.businessMinutes ?? null,
      windowLongestMinutes: sinceYesterday[0]?.businessMinutes ?? null,
      windowLongestWaitingSince: sinceYesterday[0]?.waitingSince ?? null,
      windowLongestChatId: sinceYesterday[0]?.id ?? null,
      followTodayRank: null,
      longestBusinessMinutes,
      longestWaitingSince: longest ? longest.waitingSince : null,
      longestChatId: longest ? longest.id : null,
      hasOverdueWait: hasData && longestBusinessMinutes !== null && needsFollowUp(longestBusinessMinutes),
      rate7d,
      ratePrev7d,
      rateDelta: rateDelta(rate7d, ratePrev7d),
      trend: (input.daily ?? []).map((day) => rateOf(day, store.storeId)),
      managerUrl: chats.find((chat) => chat.managerUrl)?.managerUrl ?? null,
    };
  });
  selectFollowToday(rows, input.followTodayLimit ?? FOLLOW_TODAY_LIMIT).forEach((row, index) => { row.followTodayRank = index + 1; });
  return rows;
}

export type StoreTab = "follow-today" | "all" | "no-data";

/** ตามวันนี้ / ทั้งหมด (stores with data) / ไม่มีข้อมูล. */
export function filterStoreRows(rows: StoreRow[], tab: StoreTab): StoreRow[] {
  if (tab === "no-data") return rows.filter((row) => !row.hasData);
  if (tab === "follow-today") return rows.filter((row) => row.followTodayRank !== null);
  return rows.filter((row) => row.hasData);
}

/**
 * "follow": the ตามวันนี้ order (count, then longest wait).
 * "recent" (default in ทั้งหมด): most chats waiting since yesterday 10:00, then ตามวันนี้ count, then longest wait.
 * "wait": longest recent business-hours wait first. "rate": lowest 24-hour rate first, no data last.
 * "age": oldest waiting chat first (real time, includes the > 7-day backlog).
 * Ties end with waiting count, then name.
 */
export type StoreSort = "follow" | "recent" | "wait" | "rate" | "age";

export function defaultSortForTab(tab: StoreTab): StoreSort {
  return tab === "follow-today" ? "follow" : "recent";
}

export function sortStoreRows(rows: StoreRow[], sort: StoreSort = "wait"): StoreRow[] {
  const tail = (a: StoreRow, b: StoreRow) => b.waitingCount - a.waitingCount || a.storeName.localeCompare(b.storeName, "th");
  const desc = (key: (row: StoreRow) => number | null) => (a: StoreRow, b: StoreRow) => (key(b) ?? -1) - (key(a) ?? -1);
  const byFollow = (a: StoreRow, b: StoreRow) => (a.followTodayRank ?? Infinity) - (b.followTodayRank ?? Infinity);
  const compare: Record<StoreSort, (a: StoreRow, b: StoreRow) => number> = {
    follow: (a, b) => byFollow(a, b) || desc((row) => row.longestBusinessMinutes)(a, b) || tail(a, b),
    recent: (a, b) => desc((row) => row.sinceYesterdayCount)(a, b) || desc((row) => row.followTodayCount)(a, b) || desc((row) => row.longestBusinessMinutes)(a, b) || tail(a, b),
    wait: (a, b) => desc((row) => row.longestBusinessMinutes)(a, b) || tail(a, b),
    rate: (a, b) => (a.rate7d ?? Infinity) - (b.rate7d ?? Infinity) || tail(a, b),
    age: (a, b) => desc((row) => row.oldestWaitingMinutes)(a, b) || tail(a, b),
  };
  return [...rows].sort(compare[sort]);
}

/** The longest waits for the "วันนี้" side list: one row per store, its longest wait since yesterday 10:00. */
export function longestWaitPerStore(rows: StoreRow[], limit = 5): StoreRow[] {
  return rows
    .filter((row) => row.hasData && row.windowLongestMinutes !== null)
    .sort((a, b) => (b.windowLongestMinutes ?? 0) - (a.windowLongestMinutes ?? 0) || b.sinceYesterdayCount - a.sinceYesterdayCount || a.storeName.localeCompare(b.storeName, "th"))
    .slice(0, limit);
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
    /** = the sidebar badge, the ตามวันนี้ tab count and the "วันนี้" item 1. */
    followTodayStores: withData.filter((row) => row.followTodayRank !== null).length,
    /** Stores with at least one chat waiting ≥ the threshold since yesterday 10:00 (the "M" in "N จาก M"). */
    followTodayCandidates: withData.filter((row) => row.followTodayCount > 0).length,
    waitingChats: waitingStores.reduce((sum, row) => sum + row.waitingCount, 0),
    waitingStores: waitingStores.length,
    oldBacklogChats: withData.reduce((sum, row) => sum + row.oldWaitingCount, 0),
    oldBacklogStores: withData.filter((row) => row.oldWaitingCount > 0).length,
    noDataStores: rows.length - withData.length,
    totalStores: rows.length,
  };
}
