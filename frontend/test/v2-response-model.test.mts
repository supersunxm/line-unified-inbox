import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateReplyRate,
  biggestRateDrops,
  buildStoreRows,
  filterStoreRows,
  responseKpis,
  sortStoreRows,
  sortWaitingChats,
  storesWithChatData,
  toWaitingChat,
  waitingSinceOf,
  type ConversationLike,
  type ReplyRateRow,
  type SummaryStore,
} from "../src/lib/v2/response-model.ts";
import { buildConversationList } from "../src/lib/v2/conversation-list.ts";
import { ALL_STORES, parseResponseUrl, responseUrlQuery } from "../src/lib/v2/response-url.ts";

const bkk = (local: string) => `${local}+07:00`;
const NOW = Date.parse(bkk("2026-10-04T15:00:00"));

function conversation(id: string, storeId: string, waitingSince: string, extra: Partial<ConversationLike> = {}): ConversationLike {
  return {
    id,
    latestMessageAt: waitingSince,
    bmReplyStatus: "NOT_REPLIED",
    effectiveReplyState: "NOT_REPLIED",
    replyStateProjection: null,
    customer: { displayName: `ลูกค้า ${id}` },
    store: { id: storeId, name: `ร้าน ${storeId}`, lineManagerUrl: `https://manager.line.biz/${storeId}`, lineManagerUrlStatus: "VALID" },
    ...extra,
  };
}

const summary = (storeId: string, notReplied: number): SummaryStore => ({ storeId, storeName: `ร้าน ${storeId}`, notReplied, notifiedBm: 0, replied: 0 });
const rate = (storeId: string, within24h: number, total: number): ReplyRateRow => ({ storeId, total, within24h, over24h: total - within24h, pending: 0, responseRate24h: total === 0 ? null : Math.round((within24h / total) * 1000) / 10 });

test("waiting starts at the resolver's deciding customer message, else the latest message", () => {
  const projected = conversation("c1", "s1", bkk("2026-10-04T14:00:00"), { replyStateProjection: { decidingEventKind: "CUSTOMER_INBOUND", decidingEventAt: bkk("2026-10-04T12:00:00") } });
  assert.equal(waitingSinceOf(projected), bkk("2026-10-04T12:00:00"));
  const staffDecided = conversation("c2", "s1", bkk("2026-10-04T14:00:00"), { replyStateProjection: { decidingEventKind: "HUMAN_STAFF_REPLY", decidingEventAt: bkk("2026-10-04T12:00:00") } });
  assert.equal(waitingSinceOf(staffDecided), bkk("2026-10-04T14:00:00"));
  // Waits are measured in business minutes; the Manager URL comes from the store when VALID.
  const chat = toWaitingChat(projected, NOW);
  assert.equal(chat.businessMinutes, 180);
  assert.equal(chat.managerUrl, "https://manager.line.biz/s1");
});

test("follow-up selection: a store needs follow-up when its longest wait reaches 60 business minutes and it has data", () => {
  const chats = [
    toWaitingChat(conversation("a", "s1", bkk("2026-10-04T13:59:00")), NOW), // 61 min
    toWaitingChat(conversation("b", "s2", bkk("2026-10-04T14:01:00")), NOW), // 59 min
    toWaitingChat(conversation("c", "s3", bkk("2026-10-03T20:30:00")), NOW), // 30 + 300 = 330 min, but no data
    toWaitingChat(conversation("d", "s4", bkk("2026-10-03T22:00:00")), NOW), // overnight: 300 min
  ];
  const rows = buildStoreRows({
    summaryStores: [summary("s1", 1), summary("s2", 1), summary("s3", 1), summary("s4", 2), summary("s5", 0)],
    waitingChats: chats,
    storesWithData: storesWithChatData([
      { storeId: "s1", status: "READY" },
      { storeId: "s2", status: "READY" },
      { storeId: "s3", status: "NEED_LOGIN" },
      { storeId: "s4", status: "BLOCKED" },
      { storeId: "s4", status: "READY" }, // any READY OA counts
      { storeId: "s5", status: "READY" },
    ]),
    rates7d: [],
    ratesPrev7d: [],
  });
  const byId = new Map(rows.map((row) => [row.storeId, row]));
  assert.equal(byId.get("s1")?.needsFollowUp, true);
  assert.equal(byId.get("s2")?.needsFollowUp, false);
  assert.equal(byId.get("s3")?.hasData, false);
  assert.equal(byId.get("s3")?.needsFollowUp, false);
  assert.equal(byId.get("s4")?.needsFollowUp, true);
  assert.equal(byId.get("s4")?.waitingCount, 2); // count comes from the backend summary, not the chat list
  assert.deepEqual(filterStoreRows(rows, "follow-up").map((row) => row.storeId).sort(), ["s1", "s4"]);
  assert.deepEqual(filterStoreRows(rows, "all").map((row) => row.storeId).sort(), ["s1", "s2", "s4", "s5"]);
  assert.deepEqual(filterStoreRows(rows, "no-data").map((row) => row.storeId), ["s3"]);
  // No-data stores are excluded from every KPI.
  assert.deepEqual(responseKpis(rows), { storesWithData: 4, followUpStores: 2, waitingChats: 4, waitingStores: 3, noDataStores: 1, totalStores: 5 });
});

test("without fleet data no store is marked as missing data", () => {
  const rows = buildStoreRows({ summaryStores: [summary("s1", 0)], waitingChats: [], storesWithData: null, rates7d: [], ratesPrev7d: [] });
  assert.equal(rows[0].hasData, true);
});

test("stores sort by longest business-hours wait, then waiting count, then name; nothing waiting goes last", () => {
  const base = { region: null, hasData: true, needsFollowUp: false, rate7d: null, ratePrev7d: null, rateDelta: null, trend: [], managerUrl: null, longestWaitingSince: null };
  const rows = sortStoreRows([
    { ...base, storeId: "a", storeName: "ข", waitingCount: 1, longestBusinessMinutes: 30 },
    { ...base, storeId: "b", storeName: "ก", waitingCount: 0, longestBusinessMinutes: null },
    { ...base, storeId: "c", storeName: "ค", waitingCount: 3, longestBusinessMinutes: 300 },
    { ...base, storeId: "d", storeName: "ง", waitingCount: 5, longestBusinessMinutes: 30 },
  ]);
  assert.deepEqual(rows.map((row) => row.storeId), ["c", "d", "a", "b"]);
  const chats = sortWaitingChats([
    toWaitingChat(conversation("x", "s1", bkk("2026-10-04T14:30:00")), NOW),
    toWaitingChat(conversation("y", "s1", bkk("2026-10-03T20:59:00")), NOW),
  ]);
  assert.deepEqual(chats.map((chat) => chat.id), ["y", "x"]);
});

test("the 24-hour rate re-aggregates with the backend formula over stores with data only", () => {
  const rows = [rate("s1", 9, 10), rate("s2", 1, 10), rate("s3", 0, 0)];
  assert.deepEqual(aggregateReplyRate(rows), { total: 20, within24h: 10, over24h: 10, pending: 0, rate: 50 });
  assert.equal(aggregateReplyRate(rows, new Set(["s1"])).rate, 90);
  assert.equal(aggregateReplyRate([], new Set()).rate, null);
});

test("week-on-week: deltas and the three biggest drops", () => {
  const rows = buildStoreRows({
    summaryStores: ["s1", "s2", "s3", "s4", "s5"].map((id) => summary(id, 0)),
    waitingChats: [],
    storesWithData: new Set(["s1", "s2", "s3", "s4"]),
    rates7d: [rate("s1", 5, 10), rate("s2", 8, 10), rate("s3", 9, 10), rate("s4", 7, 10), rate("s5", 0, 10)],
    ratesPrev7d: [rate("s1", 9, 10), rate("s2", 9, 10), rate("s3", 8, 10), rate("s4", 10, 10), rate("s5", 10, 10)],
  });
  assert.equal(rows.find((row) => row.storeId === "s1")?.rateDelta, -40);
  // s5 has the biggest drop but no data, so it is not named.
  assert.deepEqual(biggestRateDrops(rows).map((row) => row.storeId), ["s1", "s4", "s2"]);
});

test("chat list: waiting first by longest wait, then replied by latest, limited to the chosen stores", () => {
  const waiting = [toWaitingChat(conversation("w1", "s1", bkk("2026-10-04T14:30:00")), NOW), toWaitingChat(conversation("w2", "s2", bkk("2026-10-04T11:00:00")), NOW)];
  const recent = [
    { ...conversation("r1", "s1", bkk("2026-10-04T09:00:00")), effectiveReplyState: "REPLIED" as const },
    { ...conversation("r2", "s1", bkk("2026-10-04T13:00:00")), effectiveReplyState: "REPLIED" as const },
    conversation("w3", "s1", bkk("2026-10-04T12:00:00")),
  ];
  const list = buildConversationList(waiting, recent as never, new Set(["s1"]), NOW);
  assert.deepEqual(list.map((item) => `${item.kind}:${item.id}`), ["waiting:w3", "waiting:w1", "replied:r2", "replied:r1"]);
});

test("URL state round-trips and keeps the selection when the view changes", () => {
  const state = parseResponseUrl(new URLSearchParams("view=chat&tab=all&store=s1&conversation=c9"));
  assert.deepEqual(state, { view: "chat", tab: "all", store: "s1", conversation: "c9" });
  assert.equal(responseUrlQuery({ ...state, view: "stores" }), "?tab=all&store=s1&conversation=c9");
  assert.deepEqual(parseResponseUrl(new URLSearchParams("tab=bogus")), { view: "stores", tab: "follow-up", store: null, conversation: null });
  assert.equal(responseUrlQuery({ view: "chat", tab: "follow-up", store: ALL_STORES, conversation: null }), "?view=chat&store=all");
});
