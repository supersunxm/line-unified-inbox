import { type AppLanguage } from "../../app/language-utils.ts";
import { v2Text } from "./translations.ts";

// The monthly store model shared by Home, Dashboard, Store 360 and /v2/report. Pure: node --test
// imports it directly. Partner-free: work is evaluated per store (owner decision 8 Oct 2026); the
// partner grouping that /v2/report still prints lives in lib/v2/monthly-model.ts on top of this.
//
// One definition, shared with Store Chats (/chats):
// - Chats in a month, unreplied and replied come from GET /conversations/bm-reply-status-summary?month=
//   (the call /chats makes for its month view), turned into counts by effectiveSummaryCounts
//   (network) and chatsStoreCounts (per store) from app/reply-state.ts — the functions /chats
//   itself uses. A chat belongs to the month of its latest message (backend latestMessageAt).
// - The previous month over the same days (month-to-date comparison) comes from the same
//   endpoint with from/to (Bangkok days 1–D, same latestMessageAt bucketing).
// - The 24-hour reply rate comes from GET /dashboard/store-24h-response-summary (replyAnalytics),
//   the source of /replymessage: within24h / total.
// - Waiting time in monthly views is calendar time, /chats's oldestWaitingMinutes.
// Every page that shows one of these numbers gets it from here (docs/metrics-registry.md).

import { chatsStoreCounts, effectiveSummaryCounts, getEffectiveReplyState } from "../../app/reply-state.ts";
import { bangkokDay, periodDays, type MonthPeriod } from "./month.ts";
import { countState, deltaState, MIN_RATE_SAMPLE, meetsSample, numericValue, rateState, type SourceStatus, type ValueState } from "./value-state.ts";

export { MIN_RATE_SAMPLE };

/** The /chats month-view summary, as returned by bm-reply-status-summary. */
export type SummaryCounts = { total: number; notReplied: number; notifiedBm: number; replied: number };
export type SummaryStore = SummaryCounts & { storeId: string; storeName: string; oldestWaitingMinutes?: number | null };
export type MonthSummary = { overview: SummaryCounts; stores: SummaryStore[] };

export type ChatCounts = { total: number; notReplied: number; replied: number };

/** Network ทั้งหมด / ยังไม่ตอบ / ตอบแล้ว exactly as /chats's sidebar overview shows them. */
export function networkCounts(summary: MonthSummary): ChatCounts {
  const effective = effectiveSummaryCounts(summary.overview);
  return { total: summary.overview.total, notReplied: effective.notReplied, replied: effective.replied };
}

/**
 * ยังไม่ตอบ for a month: the ONE function behind the sidebar badge, Home's KPI, Dashboard and
 * /chats's own count (effectiveSummaryCounts(overview).notReplied).
 */
export function unrepliedCount(summary: Pick<MonthSummary, "overview">): number {
  return effectiveSummaryCounts(summary.overview).notReplied;
}

/** Per-store counts exactly as /chats's sidebar shows them (chatsStoreCounts). */
export function storeCounts(summary: MonthSummary): Map<string, ChatCounts & { oldestWaitingMinutes: number }> {
  return new Map(summary.stores.map((store) => {
    const counts = chatsStoreCounts(store);
    return [store.storeId, { total: counts.total, notReplied: counts.notReplied, replied: counts.replied, oldestWaitingMinutes: counts.oldestWaitingMinutes }];
  }));
}

/** The fields read from a /conversations item. */
export type ConversationCountLike = {
  latestMessageAt: string;
  bmReplyStatus: string;
  effectiveReplyState?: "REPLIED" | "NOT_REPLIED";
  store: { id: string } | null;
};

/** 24-hour reply rate rows from replyAnalytics (store-24h-response-summary). */
export type RateRow = { storeId: string; total: number; within24h: number; over24h?: number; pending?: number };
export type RateTotals = { total: number; within24h: number };
export type RateResponse = { overview: RateTotals; stores: RateRow[] };

/** A store as GET /stores returns it (Store.region, Store.area = province, _count.lineOfficialAccounts). */
export type StoreInfo = {
  id: string;
  name: string;
  region: string | null;
  province: string | null;
  lineOaCount: number | null;
  /** From the Store → partner mapping (only /v2/report reads it). */
  partner?: string | null;
};

export type PeriodSource<T> = { data: T | null; error?: string | null; loading?: boolean; collected?: boolean };

/** One store's month: the numbers every page shows for it. */
export type StoreMetricsRow = {
  storeId: string;
  storeName: string;
  region: string | null;
  province: string | null;
  chats: ValueState;
  unreplied: ValueState;
  replied: ValueState;
  /** ตอบแล้ว ÷ แชท. */
  replyRate: ValueState;
  /** replyAnalytics within24h ÷ total; n = total. */
  rate24: ValueState;
  previousChats: ValueState;
  previousUnreplied: ValueState;
  previousReplied: ValueState;
  previousReplyRate: ValueState;
  previousRate24: ValueState;
  /** Change in ยังไม่ตอบ vs the comparison period. */
  unrepliedDelta: ValueState;
  replyRateDelta: ValueState;
  rate24Delta: ValueState;
  /** Calendar minutes since the oldest unreplied chat's latest message (/chats's oldestWaitingMinutes). */
  oldestWaitingMinutes: number | null;
};

function status<T>(source: PeriodSource<T>): SourceStatus {
  return { loading: source.loading && source.data === null, error: source.data === null ? source.error : null, collected: source.collected };
}

export function buildStoreRows(input: {
  stores: StoreInfo[];
  current: PeriodSource<MonthSummary>;
  /** Per-store counts for the comparison period (whole previous month or the same days). */
  previous: PeriodSource<Map<string, ChatCounts>>;
  rates: PeriodSource<RateResponse>;
  previousRates: PeriodSource<RateResponse>;
}): StoreMetricsRow[] {
  const current = input.current.data ? storeCounts(input.current.data) : null;
  const rateBy = (source: PeriodSource<RateResponse>) => new Map((source.data?.stores ?? []).map((row) => [row.storeId, row]));
  const rates = rateBy(input.rates);
  const previousRates = rateBy(input.previousRates);
  const currentStatus = status(input.current);
  const previousStatus = status(input.previous);
  return input.stores.map((store): StoreMetricsRow => {
    const counts = current?.get(store.id) ?? (current ? { total: 0, notReplied: 0, replied: 0, oldestWaitingMinutes: 0 } : null);
    const previous = input.previous.data ? input.previous.data.get(store.id) ?? { total: 0, notReplied: 0, replied: 0 } : null;
    const rate = input.rates.data ? rates.get(store.id) ?? { storeId: store.id, total: 0, within24h: 0 } : null;
    const previousRate = input.previousRates.data ? previousRates.get(store.id) ?? { storeId: store.id, total: 0, within24h: 0 } : null;
    const unreplied = countState(counts?.notReplied, currentStatus);
    const previousUnreplied = countState(previous?.notReplied, previousStatus);
    const replyRate = rateState(counts?.replied, counts?.total, currentStatus);
    const previousReplyRate = rateState(previous?.replied, previous?.total, previousStatus);
    const rate24 = rateState(rate?.within24h, rate?.total, status(input.rates));
    const previousRate24 = rateState(previousRate?.within24h, previousRate?.total, status(input.previousRates));
    return {
      storeId: store.id,
      storeName: store.name,
      region: store.region,
      province: store.province,
      chats: countState(counts?.total, currentStatus),
      unreplied,
      replied: countState(counts?.replied, currentStatus),
      replyRate,
      rate24,
      previousChats: countState(previous?.total, previousStatus),
      previousUnreplied,
      previousReplied: countState(previous?.replied, previousStatus),
      previousReplyRate,
      previousRate24,
      unrepliedDelta: deltaState(unreplied, previousUnreplied),
      replyRateDelta: deltaState(replyRate, previousReplyRate),
      rate24Delta: deltaState(rate24, previousRate24),
      oldestWaitingMinutes: counts && counts.notReplied > 0 ? counts.oldestWaitingMinutes : null,
    };
  });
}

export const valueOr = (state: ValueState, fallback: number) => numericValue(state) ?? fallback;

export type MonthSort = "rate24" | "reply" | "unreplied" | "delta";

/** Lower is worse; rates below MIN_RATE_SAMPLE or without chats sort after every measured rate. */
export const rateKey = (state: ValueState) => (meetsSample(state) ? valueOr(state, Infinity) : Infinity);

/**
 * rate24 (default): the 24-hour rate's gap to its target, worst first — the lowest rate first,
 * since the target is the same for every store. reply: lowest ตอบแล้ว % first. Rates below
 * MIN_RATE_SAMPLE (and stores with no chats) go to the end of both. delta: the biggest drop in
 * the 24-hour rate (points) first. unreplied: most unreplied chats first.
 * Ties: most unreplied, then name.
 */
export function sortStoreRows<T extends StoreMetricsRow>(rows: T[], sort: MonthSort = "rate24"): T[] {
  const tail = (a: T, b: T) => valueOr(b.unreplied, -1) - valueOr(a.unreplied, -1) || a.storeName.localeCompare(b.storeName, "th");
  const compare: Record<MonthSort, (a: T, b: T) => number> = {
    rate24: (a, b) => rateKey(a.rate24) - rateKey(b.rate24) || tail(a, b),
    reply: (a, b) => rateKey(a.replyRate) - rateKey(b.replyRate) || tail(a, b),
    unreplied: tail,
    delta: (a, b) => (meetsSample(a.rate24Delta) ? valueOr(a.rate24Delta, Infinity) : Infinity) - (meetsSample(b.rate24Delta) ? valueOr(b.rate24Delta, Infinity) : Infinity) || tail(a, b),
  };
  return [...rows].sort((a, b) => {
    const order = compare[sort](a, b);
    return Number.isNaN(order) ? 0 : order;
  });
}

export function filterStoreRows<T extends StoreMetricsRow>(rows: T[], input: { region?: string | null; search?: string | null }): T[] {
  const query = input.search?.trim().toLocaleLowerCase("th") ?? "";
  return rows.filter((row) => {
    if (input.region && row.region !== input.region) return false;
    return !query || row.storeName.toLocaleLowerCase("th").includes(query);
  });
}

export type GroupTotals = {
  chats: ValueState;
  unreplied: ValueState;
  replied: ValueState;
  replyRate: ValueState;
  rate24: ValueState;
  previousChats: ValueState;
  previousUnreplied: ValueState;
  previousReplyRate: ValueState;
  previousRate24: ValueState;
  unrepliedDelta: ValueState;
  replyRateDelta: ValueState;
  rate24Delta: ValueState;
};

/** The source status a non-numeric state stands for, so a derived value inherits it. */
function stateStatus(state: ValueState): SourceStatus {
  if (state.kind === "not-collected") return { collected: false };
  if (state.kind === "failed") return state.error ? { error: state.error } : { failed: true };
  if (state.kind === "loading") return { loading: true };
  return {};
}

export function sumStates(states: ValueState[]): ValueState {
  if (states.length === 0) return { kind: "true-zero", value: 0 };
  for (const kind of ["not-collected", "failed", "loading"] as const) {
    const blocked = states.find((state) => state.kind === kind);
    if (blocked) return blocked;
  }
  return countState(states.reduce((sum, state) => sum + (numericValue(state) ?? 0), 0));
}

export function totalsFrom(input: {
  chats: ValueState; unreplied: ValueState; replied: ValueState;
  previousChats: ValueState; previousUnreplied: ValueState; previousReplied: ValueState;
  rate: { within24h: number; total: number } | null; rateStatus: SourceStatus;
  previousRate: { within24h: number; total: number } | null; previousRateStatus: SourceStatus;
}): GroupTotals {
  const ratio = (replied: ValueState, chats: ValueState) => rateState(numericValue(replied), numericValue(chats), stateStatus(chats));
  const replyRate = ratio(input.replied, input.chats);
  const previousReplyRate = ratio(input.previousReplied, input.previousChats);
  const rate24 = rateState(input.rate?.within24h, input.rate?.total, input.rateStatus);
  const previousRate24 = rateState(input.previousRate?.within24h, input.previousRate?.total, input.previousRateStatus);
  return {
    chats: input.chats,
    unreplied: input.unreplied,
    replied: input.replied,
    replyRate,
    rate24,
    previousChats: input.previousChats,
    previousUnreplied: input.previousUnreplied,
    previousReplyRate,
    previousRate24,
    unrepliedDelta: deltaState(input.unreplied, input.previousUnreplied),
    replyRateDelta: deltaState(replyRate, previousReplyRate),
    rate24Delta: deltaState(rate24, previousRate24),
  };
}

export { status as periodStatus };

/**
 * Network KPIs: chats from the /chats summary overview (exactly /chats's ทั้งหมด / ยังไม่ตอบ /
 * ตอบแล้ว), the 24-hour rate from replyAnalytics's own overview (exactly /replymessage's).
 */
export function networkTotals(input: {
  current: PeriodSource<MonthSummary>;
  previous: PeriodSource<ChatCounts>;
  rates: PeriodSource<RateResponse>;
  previousRates: PeriodSource<RateResponse>;
}): GroupTotals {
  const counts = input.current.data ? networkCounts(input.current.data) : null;
  const previous = input.previous.data;
  const currentStatus = status(input.current);
  const previousStatus = status(input.previous);
  return totalsFrom({
    chats: countState(counts?.total, currentStatus),
    unreplied: countState(counts?.notReplied, currentStatus),
    replied: countState(counts?.replied, currentStatus),
    previousChats: countState(previous?.total, previousStatus),
    previousUnreplied: countState(previous?.notReplied, previousStatus),
    previousReplied: countState(previous?.replied, previousStatus),
    rate: input.rates.data?.overview ?? null,
    rateStatus: status(input.rates),
    previousRate: input.previousRates.data?.overview ?? null,
    previousRateStatus: status(input.previousRates),
  });
}

/** The stores with the most unreplied chats (n > 0), most first. */
export function topUnreplied<T extends StoreMetricsRow>(rows: T[], limit = 10): T[] {
  return sortStoreRows(rows.filter((row) => (numericValue(row.unreplied) ?? 0) > 0), "unreplied").slice(0, limit);
}

/**
 * "สาขาที่ต้องดู" (Home, the Store 360 picker): the stores with the most unreplied chats this month,
 * ties by the lower 24-hour rate. A low-sample 24-hour rate does not break ties (it is shown muted,
 * never compared); the unreplied count still counts. Stores with nothing unreplied are not listed.
 */
export function storesToWatch<T extends StoreMetricsRow>(rows: T[], limit = 5): T[] {
  return rows
    .filter((row) => (numericValue(row.unreplied) ?? 0) > 0)
    .sort((a, b) => valueOr(b.unreplied, 0) - valueOr(a.unreplied, 0) || rateKey(a.rate24) - rateKey(b.rate24) || a.storeName.localeCompare(b.storeName, "th"))
    .slice(0, limit);
}

/** Stores with at least one chat in the period, or null when that period has no numbers. */
export function previousCoverage(rows: StoreMetricsRow[]): { withChats: number; total: number } | null {
  if (rows.length === 0 || rows.some((row) => numericValue(row.previousChats) === null)) return null;
  return { withChats: rows.filter((row) => (numericValue(row.previousChats) ?? 0) > 0).length, total: rows.length };
}

/**
 * Network count minus the sum over listed stores. 0 when every chat belongs to a listed store;
 * otherwise the UI states the difference instead of letting the store table silently not add up.
 */
export function unattributedChats(network: ValueState, rows: StoreMetricsRow[]): number | null {
  const total = numericValue(network);
  if (total === null) return null;
  const listed = sumStates(rows.map((row) => row.chats));
  const sum = numericValue(listed);
  return sum === null ? null : total - sum;
}

// ---- One store's month ----

export type NicknameMetadataLike = {
  source: string | null;
  customerType: string | null;
  product: { name: string } | null;
  paymentMethod: string | null;
  financeProvider: string | null;
  service: string | null;
  period: { year: number; month: number } | null;
  eventDate: string | null;
} | null | undefined;

export type StoreMonthConversation = ConversationCountLike & { nicknameDerivedMetadata?: NicknameMetadataLike };

export type DayCounts = { day: string; chats: number; unreplied: number };

/** Chats and unreplied per Bangkok day of latest message, for every day of the period (zeros included). */
export function dailyBreakdown(items: StoreMonthConversation[], period: MonthPeriod): DayCounts[] {
  const days = new Map(periodDays(period).map((day) => [day, { day, chats: 0, unreplied: 0 }]));
  for (const item of items) {
    const at = Date.parse(item.latestMessageAt);
    if (!(at >= period.startMs && at < period.endMs)) continue;
    const entry = days.get(bangkokDay(at));
    if (!entry) continue;
    entry.chats += 1;
    if (getEffectiveReplyState({ bmReplyStatus: item.bmReplyStatus as never, effectiveReplyState: item.effectiveReplyState }) !== "REPLIED") entry.unreplied += 1;
  }
  return [...days.values()];
}

/**
 * "สาขาที่มีข้อมูลแชท 1–7 ต.ค. 2026 134 ร้าน · 1–7 ก.ย. 2026 139 ร้าน (จาก 150 ร้าน)".
 * Both compared periods are stated; no cause is inferred.
 */
export function coverageText(input: {
  currentLabel: string;
  previousLabel: string;
  current: { withChats: number; total: number };
  previous: { withChats: number; total: number } | null;
  previousReason: string | null;
}, language: AppLanguage = "th"): string {
  const t = v2Text(language);
  const previous = input.previous ? t("storeCount", { count: input.previous.withChats }) : `— (${input.previousReason ?? t("noData")})`;
  return t("coverage", { currentLabel: input.currentLabel, count: input.current.withChats, previousLabel: input.previousLabel, previous, total: input.current.total });
}
