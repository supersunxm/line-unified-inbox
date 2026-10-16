import assert from "node:assert/strict";
import test from "node:test";
import { messageSearchCopy } from "../src/components/chats/message-search/message-search-copy.ts";
import {
  createSyntheticChatMessageSearchAdapter,
  SYNTHETIC_MESSAGE_STORES,
} from "../src/components/chats/message-search/message-search-adapter.ts";
import {
  filterMessageSearchStores,
  isAllAuthorizedStores,
  messageSearchStoreSummary,
  reconcileMessageSearchStoreSelection,
  toggleMessageSearchStore,
} from "../src/components/chats/message-search/message-search-stores.ts";

const th = messageSearchCopy("th");
const stores = [
  { id: "store-a", name: "Alpha", code: "A01", storeId: "A01" },
  { id: "store-b", name: "Beta", code: "B02", storeId: null },
];

test("an empty store selection means every authorized store", () => {
  assert.equal(isAllAuthorizedStores([]), true);
  assert.equal(messageSearchStoreSummary([], stores, th), th.allStores);
});

test("store selection can be toggled, is capped at 50, and drops IDs that are no longer authorized", () => {
  let selected: string[] = [];
  selected = toggleMessageSearchStore(selected, "store-a");
  selected = toggleMessageSearchStore(selected, "store-b");
  assert.deepEqual(selected, ["store-a", "store-b"]);
  selected = toggleMessageSearchStore(selected, "store-a");
  assert.deepEqual(selected, ["store-b"]);

  const full = Array.from({ length: 50 }, (_, index) => `s-${index}`);
  assert.equal(toggleMessageSearchStore(full, "one-more"), full, "51st store is refused");

  assert.deepEqual(reconcileMessageSearchStoreSelection(["store-a", "revoked", "store-a"], stores), ["store-a"]);
});

test("the selection summary names one store, counts several, and falls back safely", () => {
  assert.equal(messageSearchStoreSummary(["store-b"], stores, th), "Beta");
  assert.equal(messageSearchStoreSummary(["store-a", "store-b"], stores, th), th.storesSelected(2));
  assert.equal(messageSearchStoreSummary(["unknown"], stores, th), th.storesSelected(1));
});

test("store search matches name and code case-insensitively and returns everything for an empty query", () => {
  assert.equal(filterMessageSearchStores(stores, "").length, 2);
  assert.deepEqual(filterMessageSearchStores(stores, "beta").map((s) => s.id), ["store-b"]);
  assert.deepEqual(filterMessageSearchStores(stores, "a01").map((s) => s.id), ["store-a"]);
});

test("synthetic store list is fictional and carries only the fields the selector needs", () => {
  assert.ok(SYNTHETIC_MESSAGE_STORES.length >= 2);
  for (const store of SYNTHETIC_MESSAGE_STORES) {
    assert.match(store.name, /^Synthetic Store /u, "store names are clearly synthetic");
    assert.deepEqual(Object.keys(store).sort(), ["code", "id", "name", "storeId"]);
  }
});

// ---- Synthetic adapter -------------------------------------------------------

test("synthetic adapter makes no network request for search or store listing", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (() => {
    calls += 1;
    return Promise.reject(new Error("network must not be used"));
  }) as typeof fetch;
  try {
    const adapter = createSyntheticChatMessageSearchAdapter();
    await adapter.search({ q: "สวัสดี", startDate: "2026-09-01", endDate: "2026-10-15" });
    await adapter.listStores();
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("synthetic search applies inclusive Bangkok dates at the day boundaries", async () => {
  const adapter = createSyntheticChatMessageSearchAdapter();
  // 16:59:59.999Z on 30 Sep is 23:59:59 in Bangkok on 30 Sep: in range for 30 Sep
  const lastInstant = await adapter.search({ q: "สวัสดี", startDate: "2026-09-30", endDate: "2026-09-30" });
  assert.deepEqual(lastInstant.items.map((item) => item.messageId), ["syn-msg-004"]);
  // 17:00Z on 30 Sep is 00:00 in Bangkok on 1 Oct: not in range for 30 Sep, in range for 1 Oct
  const nextDay = await adapter.search({ q: "สวัสดี", startDate: "2026-10-01", endDate: "2026-10-01" });
  assert.deepEqual(nextDay.items.map((item) => item.messageId), ["syn-msg-005"]);
});

test("synthetic search covers cross-month ranges correctly", async () => {
  const adapter = createSyntheticChatMessageSearchAdapter();
  const crossMonth = await adapter.search({ q: "ขอบคุณคำแนะนำ", startDate: "2026-08-31", endDate: "2026-09-01" });
  assert.deepEqual(crossMonth.items.map((item) => item.messageId), ["syn-msg-007"], "31 Aug 23:59 Bangkok is included");
});

test("synthetic search is case-insensitive for English and treats % literally", async () => {
  const adapter = createSyntheticChatMessageSearchAdapter();
  const english = await adapter.search({ q: "HELLO", startDate: "2026-09-01", endDate: "2026-10-15" });
  assert.deepEqual(english.items.map((item) => item.messageId), ["syn-msg-002"]);
  const percent = await adapter.search({ q: "100%", startDate: "2026-09-01", endDate: "2026-10-15" });
  assert.deepEqual(percent.items.map((item) => item.messageId), ["syn-msg-006"]);
});

test("synthetic search filters by selected stores and returns newest first", async () => {
  const adapter = createSyntheticChatMessageSearchAdapter();
  const byStore = await adapter.search({ q: "ขอบคุณ", startDate: "2026-08-01", endDate: "2026-10-15", storeIds: ["store-syn-02"] });
  assert.deepEqual(byStore.items.map((item) => item.messageId), ["syn-msg-003"]);
  const all = await adapter.search({ q: "สวัสดี", startDate: "2026-09-01", endDate: "2026-10-15" });
  const sentAt = all.items.map((item) => item.sentAt);
  assert.deepEqual(sentAt, [...sentAt].sort().reverse(), "results are ordered newest first");
});

test("synthetic paging returns every match exactly once with a stable cursor", async () => {
  const adapter = createSyntheticChatMessageSearchAdapter();
  const request = { q: "สวัสดี", startDate: "2026-09-01", endDate: "2026-10-15" };
  const everything = await adapter.search(request);
  const seen: string[] = [];
  let cursor: string | null | undefined = undefined;
  let pages = 0;
  do {
    const page = await adapter.search({ ...request, cursor, limit: 1 });
    seen.push(...page.items.map((item) => item.messageId));
    cursor = page.nextCursor;
    pages += 1;
  } while (cursor && pages < 20);
  assert.deepEqual(seen, everything.items.map((item) => item.messageId));
  assert.equal(new Set(seen).size, seen.length, "no duplicates across pages");
});

test("synthetic search enforces the same keyword, date, and cursor rules as the backend", async () => {
  const adapter = createSyntheticChatMessageSearchAdapter();
  await assert.rejects(adapter.search({ q: "a", startDate: "2026-09-01", endDate: "2026-09-01" }), /Invalid keyword/u);
  await assert.rejects(adapter.search({ q: "สวัสดี", startDate: "2026-01-01", endDate: "2026-04-01" }), /Invalid date range/u);
  await assert.rejects(adapter.search({ q: "สวัสดี", startDate: "2026-09-01", endDate: "2026-09-01", cursor: "abc" }), /Invalid cursor/u);
});

test("a cancelled request is rejected with AbortError", async () => {
  const adapter = createSyntheticChatMessageSearchAdapter();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(adapter.search({ q: "สวัสดี", startDate: "2026-09-01", endDate: "2026-09-01" }, { signal: controller.signal }), { name: "AbortError" });
});

test("synthetic results contain only interface fields and are marked as live", async () => {
  const adapter = createSyntheticChatMessageSearchAdapter();
  const page = await adapter.search({ q: "สวัสดี", startDate: "2026-09-01", endDate: "2026-10-15" });
  for (const item of page.items) {
    assert.deepEqual(Object.keys(item).sort(), [
      "conversationId",
      "customerDisplayName",
      "direction",
      "messageId",
      "sentAt",
      "snippet",
      "source",
      "storeId",
      "storeName",
    ]);
    assert.equal(item.source, "LIVE", "no historical records are assumed");
  }
});
