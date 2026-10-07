import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { chatsStoreCounts, effectiveSummaryCounts } from "../src/app/reply-state.ts";
import { monthWindow } from "../src/lib/v2/month.ts";
import {
  buildMonthStoreRows,
  dailyBreakdown,
  dataCoverage,
  filterMonthRows,
  networkTotals,
  partnerRows,
  sortMonthRows,
  topUnreplied,
  unattributedChats,
  v2Stores,
  type ChatCounts,
  type MonthSummary,
  type RateResponse,
  type StoreInfo,
} from "../src/lib/v2/monthly-model.ts";
import { UNMATCHED_PARTNER } from "../src/lib/v2/partners.ts";
import { numericValue } from "../src/lib/v2/value-state.ts";

const bkk = (iso: string) => Date.parse(`${iso}+07:00`);

// Synthetic fixtures only: no real customer data.
const summary: MonthSummary = {
  overview: { total: 64, notReplied: 9, notifiedBm: 2, replied: 53 },
  stores: [
    { storeId: "focus-seven-store-group", storeName: "Focus group · 7 stores", total: 30, notReplied: 4, notifiedBm: 1, replied: 25, oldestWaitingMinutes: 50 },
    { storeId: "s1", storeName: "OBS Alpha By TG", total: 40, notReplied: 6, notifiedBm: 1, replied: 33, oldestWaitingMinutes: 9240 },
    { storeId: "s2", storeName: "OBS Beta By TG 2", total: 20, notReplied: 1, notifiedBm: 1, replied: 18, oldestWaitingMinutes: 60 },
    { storeId: "s3", storeName: "OBS Gamma By OPPO", total: 4, notReplied: 2, notifiedBm: 0, replied: 2, oldestWaitingMinutes: 30 },
    { storeId: "s4", storeName: "Placeholder", total: 0, notReplied: 0, notifiedBm: 0, replied: 0, oldestWaitingMinutes: 0 },
  ],
};
const stores: StoreInfo[] = [
  { id: "s1", name: "OBS Alpha By TG", region: "Eastern", province: "Chonburi", lineOaCount: 1, partner: "TG" },
  { id: "s2", name: "OBS Beta By TG 2", region: "Northern", province: "Chiang Mai", lineOaCount: 1, partner: "TG" },
  { id: "s3", name: "OBS Gamma By OPPO", region: "Eastern", province: "Rayong", lineOaCount: 2, partner: "OPPO" },
  { id: "s4", name: "Placeholder", region: null, province: null, lineOaCount: 0 },
];
const rates: RateResponse = { overview: { total: 50, within24h: 46 }, stores: [{ storeId: "s1", total: 30, within24h: 28 }, { storeId: "s2", total: 15, within24h: 14 }, { storeId: "s3", total: 5, within24h: 4 }] };
const previousRates: RateResponse = { overview: { total: 40, within24h: 34 }, stores: [{ storeId: "s1", total: 25, within24h: 20 }, { storeId: "s2", total: 15, within24h: 14 }] };
const previous = new Map<string, ChatCounts>([["s1", { total: 30, notReplied: 3, replied: 27 }], ["s2", { total: 20, notReplied: 4, replied: 16 }]]);

function build() {
  const universe = v2Stores(stores, summary);
  return buildMonthStoreRows({
    stores: universe.stores,
    current: { data: summary },
    previous: { data: previous },
    rates: { data: rates },
    previousRates: { data: previousRates },
  });
}

test("parity with /chats: network totals are /chats's overview counts (same function, same endpoint)", () => {
  const totals = networkTotals({ current: { data: summary }, previous: { data: { total: 50, notReplied: 7, replied: 43 } }, rates: { data: rates }, previousRates: { data: previousRates } });
  const chats = effectiveSummaryCounts(summary.overview);
  assert.equal(numericValue(totals.chats), summary.overview.total);
  assert.equal(numericValue(totals.unreplied), chats.notReplied);
  assert.equal(numericValue(totals.replied), chats.replied);
  assert.equal(numericValue(totals.rate24), 92, "replyAnalytics overview, as /replymessage");
  assert.equal(numericValue(totals.unrepliedDelta), 4);
});

test("parity with /chats: per-store counts are chatsStoreCounts, the function /chats's sidebar uses", () => {
  const rows = build();
  for (const row of rows) {
    const source = summary.stores.find((store) => store.storeId === row.storeId);
    assert.ok(source);
    const expected = chatsStoreCounts(source);
    assert.equal(numericValue(row.chats), expected.total);
    assert.equal(numericValue(row.unreplied), expected.notReplied);
    assert.equal(numericValue(row.replied), expected.replied);
    assert.equal(row.oldestWaitingMinutes, expected.oldestWaitingMinutes, "calendar waiting, /chats's oldestWaitingMinutes");
  }
});

test("parity with /chats: both import the shared counting functions and call the same endpoint", () => {
  const chatsPage = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const model = readFileSync(new URL("../src/lib/v2/monthly-model.ts", import.meta.url), "utf8");
  assert.match(chatsPage, /countsMap\[s\.storeId\] = chatsStoreCounts\(s\);/);
  assert.match(chatsPage, /effectiveSummaryCounts\(bmSummaryData\.overview\)\.notReplied/);
  assert.match(chatsPage, /api\.bmReplyStatusSummary\(chatMonth/);
  assert.match(model, /import \{ chatsStoreCounts, effectiveSummaryCounts, getEffectiveReplyState \} from "\.\.\/\.\.\/app\/reply-state\.ts";/);
});

test("the focus group and placeholder stores (no LINE OA) are not v2 stores; names are never pattern-matched", () => {
  const universe = v2Stores(stores, summary);
  assert.deepEqual(universe.stores.map((store) => store.id), ["s1", "s2", "s3"]);
  assert.deepEqual(universe.placeholders.map((store) => store.id), ["s4"]);
  const named = v2Stores([{ id: "s5", name: "xxx", region: null, province: null, lineOaCount: 1 }], null);
  assert.deepEqual(named.stores.map((store) => store.id), ["s5"], "a placeholder-looking name with an OA stays");
});

test("partner table rows sum to the network totals (with the unmatched group)", () => {
  const rows = build();
  const partners = partnerRows(rows, { data: rates }, { data: previousRates });
  assert.deepEqual(partners.map((row) => row.partner), ["TG", "OPPO"]);
  const tg = partners[0];
  assert.equal(tg.storeCount, 2);
  assert.equal(numericValue(tg.unreplied), 9);
  assert.equal(numericValue(tg.rate24), 93.3);
  assert.equal(numericValue(tg.unrepliedDelta), 2);
  const sum = partners.reduce((total, row) => total + (numericValue(row.chats) ?? 0), 0);
  assert.equal(sum, 64);
  assert.equal(unattributedChats({ kind: "value", value: summary.overview.total }, rows), 0);
  assert.equal(partnerRows([{ ...rows[0], partner: UNMATCHED_PARTNER }], { data: rates }, { data: null })[0].partner, UNMATCHED_PARTNER);
});

test("low sample: rates are muted, unranked, and sorted after measured stores", () => {
  const rows = build();
  const gamma = rows.find((row) => row.storeId === "s3");
  assert.ok(gamma);
  assert.equal(gamma.replyRate.kind, "low-sample", "4 chats < MIN_RATE_SAMPLE");
  assert.equal(gamma.rate24.kind, "low-sample");
  assert.equal(gamma.partnerRank, null);
  assert.equal(gamma.previousUnreplied.kind, "true-zero", "no chats last period is a real zero");
  assert.deepEqual(sortMonthRows(rows, "reply").map((row) => row.storeId), ["s1", "s2", "s3"]);
  assert.deepEqual(sortMonthRows(rows, "rate24").map((row) => row.storeId), ["s1", "s2", "s3"]);
  assert.deepEqual(sortMonthRows(rows, "unreplied").map((row) => row.storeId), ["s1", "s2", "s3"], "ties by name");
  // delta = the 24-hour rate's change in points, biggest drop first; s3 has no comparable rate.
  assert.deepEqual(sortMonthRows(rows, "delta").map((row) => row.storeId), ["s2", "s1", "s3"]);
  assert.deepEqual(sortMonthRows(rows).map((row) => row.storeId), sortMonthRows(rows, "rate24").map((row) => row.storeId), "default = 24h gap to target");
});

test("rank within partner: best reply % first", () => {
  const rows = build();
  assert.equal(rows.find((row) => row.storeId === "s2")?.partnerRank, 1);
  assert.equal(rows.find((row) => row.storeId === "s1")?.partnerRank, 2);
  assert.equal(rows.find((row) => row.storeId === "s1")?.partnerRankedCount, 2);
});

test("filters, top unreplied and data coverage", () => {
  const rows = build();
  assert.deepEqual(filterMonthRows(rows, { partner: "TG", region: "Eastern" }).map((row) => row.storeId), ["s1"]);
  assert.deepEqual(topUnreplied(rows, 2).map((row) => row.storeId), ["s1", "s2"]);
  assert.deepEqual(dataCoverage(rows), { withChats: 3, total: 3 });
});

test("an uncollected previous month is never shown as zero", () => {
  const rows = buildMonthStoreRows({ stores: v2Stores(stores, summary).stores, current: { data: summary }, previous: { data: new Map(), collected: false }, rates: { data: rates }, previousRates: { data: null, error: "400" } });
  assert.equal(rows[0].previousUnreplied.kind, "not-collected");
  assert.equal(rows[0].unrepliedDelta.kind, "not-collected");
  assert.equal(rows[0].previousRate24.kind, "failed");
});

test("store drawer: daily breakdown and tag coverage (lower bound, synthetic metadata)", () => {
  const window = monthWindow("2026-10", bkk("2026-10-03T12:00:00"));
  const meta = { source: null, customerType: "ONLINE", product: null, paymentMethod: null, financeProvider: null, service: null, period: { year: 2026, month: 9 }, eventDate: null };
  const items = [
    { latestMessageAt: new Date(bkk("2026-10-01T09:00:00")).toISOString(), bmReplyStatus: "REPLIED", store: { id: "s1" }, nicknameDerivedMetadata: meta },
    { latestMessageAt: new Date(bkk("2026-10-01T23:59:00")).toISOString(), bmReplyStatus: "NOT_REPLIED", store: { id: "s1" }, nicknameDerivedMetadata: { ...meta, period: null } },
    { latestMessageAt: new Date(bkk("2026-10-03T08:00:00")).toISOString(), bmReplyStatus: "NOT_REPLIED", store: { id: "s1" }, nicknameDerivedMetadata: null },
  ];
  assert.deepEqual(dailyBreakdown(items, window.current), [
    { day: "2026-10-01", chats: 2, unreplied: 1 },
    { day: "2026-10-02", chats: 0, unreplied: 0 },
    { day: "2026-10-03", chats: 1, unreplied: 1 },
  ]);
});
