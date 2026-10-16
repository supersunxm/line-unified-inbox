import assert from "node:assert/strict";
import test from "node:test";
import {
  activeMessageSearchPreset,
  bangkokTodayIso,
  defaultMessageSearchPeriod,
  messageSearchPeriodDays,
  validateMessageSearchPeriod,
} from "../src/components/chats/message-search/message-search-period.ts";
import { messageSearchCopy } from "../src/components/chats/message-search/message-search-copy.ts";
import {
  buildMessageSearchRequest,
  clearMessageSearchFilters,
  defaultMessageSearchFilters,
  hasActiveMessageSearchFilters,
  messageSearchRequestKey,
  normalizeMessageSearchKeyword,
  parseMessageSearchFilters,
  serializeMessageSearchFilters,
  validateMessageSearchKeyword,
} from "../src/components/chats/message-search/message-search-query.ts";

const TODAY = "2026-10-15";
const th = messageSearchCopy("th");

test("default period is the last 7 Bangkok calendar days, inclusive of today", () => {
  assert.deepEqual(defaultMessageSearchPeriod(TODAY), { dateFrom: "2026-10-09", dateTo: "2026-10-15" });
  assert.equal(messageSearchPeriodDays(defaultMessageSearchPeriod(TODAY)), 7);
});

test("7, 14, and 30 day presets match the shared preset windows and are recognized as presets", () => {
  assert.deepEqual(defaultMessageSearchPeriod(TODAY), { dateFrom: "2026-10-09", dateTo: TODAY });
  const fourteen = { dateFrom: "2026-10-02", dateTo: TODAY };
  const thirty = { dateFrom: "2026-09-16", dateTo: TODAY };
  assert.equal(activeMessageSearchPreset(defaultMessageSearchPeriod(TODAY), TODAY), 7);
  assert.equal(activeMessageSearchPreset(fourteen, TODAY), 14);
  assert.equal(activeMessageSearchPreset(thirty, TODAY), 30);
  assert.equal(activeMessageSearchPreset({ dateFrom: "2026-10-05", dateTo: TODAY }, TODAY), null, "custom range is not a preset");
});

test("Bangkok 'today' changes at Bangkok midnight, not UTC midnight", () => {
  // 16:59:59.999Z is 23:59:59.999 in Bangkok on 14 Oct
  assert.equal(bangkokTodayIso(new Date("2026-10-14T16:59:59.999Z")), "2026-10-14");
  // 17:00:00Z is 00:00 in Bangkok on 15 Oct
  assert.equal(bangkokTodayIso(new Date("2026-10-14T17:00:00.000Z")), "2026-10-15");
});

test("cross-month and cross-year default windows are computed on calendar days", () => {
  assert.deepEqual(defaultMessageSearchPeriod("2026-03-03"), { dateFrom: "2026-02-25", dateTo: "2026-03-03" });
  assert.deepEqual(defaultMessageSearchPeriod("2026-01-03"), { dateFrom: "2025-12-28", dateTo: "2026-01-03" });
});

test("a custom period is valid up to exactly 90 calendar days and rejected beyond", () => {
  assert.equal(validateMessageSearchPeriod({ dateFrom: "2026-01-01", dateTo: "2026-03-31" }, TODAY, "th"), null, "90 days allowed");
  assert.equal(messageSearchPeriodDays({ dateFrom: "2026-01-01", dateTo: "2026-03-31" }), 90);
  assert.equal(validateMessageSearchPeriod({ dateFrom: "2026-01-01", dateTo: "2026-04-01" }, TODAY, "th"), th.periodTooLong, "91 days rejected");
});

test("future dates and reversed ranges are rejected with localized messages", () => {
  assert.equal(validateMessageSearchPeriod({ dateFrom: "2026-10-14", dateTo: "2026-10-16" }, TODAY, "th"), th.futureDate);
  assert.equal(validateMessageSearchPeriod({ dateFrom: "2026-09-10", dateTo: "2026-09-01" }, TODAY, "th"), th.periodReversed);
});

test("a single-day custom range is valid", () => {
  assert.equal(validateMessageSearchPeriod({ dateFrom: "2026-09-30", dateTo: "2026-09-30" }, TODAY, "th"), null);
  assert.equal(messageSearchPeriodDays({ dateFrom: "2026-09-30", dateTo: "2026-09-30" }), 1);
});

test("keyword normalization is NFC with zero-width removal and whitespace collapse", () => {
  assert.equal(normalizeMessageSearchKeyword("  สวัสดี   ครับ  "), "สวัสดี ครับ");
  assert.equal(normalizeMessageSearchKeyword("A​B"), "AB");
  assert.equal(normalizeMessageSearchKeyword("é"), "é");
});

test("keyword validation requires 2 to 100 code points after trimming", () => {
  assert.deepEqual(validateMessageSearchKeyword(""), { valid: false, keyword: "", reason: "empty" });
  assert.deepEqual(validateMessageSearchKeyword("   "), { valid: false, keyword: "", reason: "empty" });
  assert.equal(validateMessageSearchKeyword("a").valid, false);
  assert.equal(validateMessageSearchKeyword(" ก ").valid, false, "one Thai character is too short");
  assert.equal(validateMessageSearchKeyword("กา").valid, true);
  assert.equal(validateMessageSearchKeyword("😀".repeat(100)).valid, true, "100 code points, including emoji, is allowed");
  assert.deepEqual(validateMessageSearchKeyword("a".repeat(101)), { valid: false, keyword: "a".repeat(101), reason: "tooLong" });
});

test("no request is built until the keyword and period are both searchable", () => {
  assert.equal(buildMessageSearchRequest(defaultMessageSearchFilters(TODAY), TODAY), null, "empty keyword sends nothing");
  assert.equal(buildMessageSearchRequest({ ...defaultMessageSearchFilters(TODAY), keyword: "a" }, TODAY), null, "one character sends nothing");
  assert.equal(
    buildMessageSearchRequest({ keyword: "สวัสดี", period: { dateFrom: "2026-01-01", dateTo: "2026-04-01" }, storeIds: [] }, TODAY),
    null,
    "over-long period sends nothing",
  );
});

test("a valid request carries the exact inclusive Bangkok dates and omits storeIds when all authorized stores are used", () => {
  const request = buildMessageSearchRequest({ keyword: " สวัสดี ", period: defaultMessageSearchPeriod(TODAY), storeIds: [] }, TODAY);
  assert.deepEqual(request, { q: "สวัสดี", startDate: "2026-10-09", endDate: "2026-10-15" });
  assert.equal("storeIds" in (request ?? {}), false);
});

test("a selected store list is included in the request and is order-insensitive in the cache key", () => {
  const request = buildMessageSearchRequest({ keyword: "สวัสดี", period: defaultMessageSearchPeriod(TODAY), storeIds: ["store-b", "store-a"] }, TODAY);
  assert.deepEqual(request?.storeIds, ["store-b", "store-a"]);
  const reordered = buildMessageSearchRequest({ keyword: "สวัสดี", period: defaultMessageSearchPeriod(TODAY), storeIds: ["store-a", "store-b"] }, TODAY);
  assert.ok(request && reordered);
  assert.equal(messageSearchRequestKey(request), messageSearchRequestKey(reordered));
});

test("query state round-trips through the URL and restores exactly", () => {
  const filters = {
    keyword: "สวัสดี",
    period: { dateFrom: "2026-09-01", dateTo: "2026-09-30" },
    storeIds: ["store-a", "store-b"],
  };
  const query = serializeMessageSearchFilters(filters, TODAY).toString();
  assert.deepEqual(parseMessageSearchFilters(`?${query}`, TODAY), filters);
});

test("default filters serialize to an empty query and an empty query restores the defaults", () => {
  assert.equal(serializeMessageSearchFilters(defaultMessageSearchFilters(TODAY), TODAY).toString(), "");
  assert.deepEqual(parseMessageSearchFilters("", TODAY), defaultMessageSearchFilters(TODAY));
});

test("the conversation month parameter is never read as a message-search date", () => {
  const parsed = parseMessageSearchFilters("?month=2026-09&storeId=store-a&bmReplyStatus=REPLIED", TODAY);
  assert.deepEqual(parsed.period, defaultMessageSearchPeriod(TODAY));
  assert.deepEqual(parsed.storeIds, []);
  assert.equal(parsed.keyword, "");
});

test("invalid URL values fall back to safe defaults", () => {
  const parsed = parseMessageSearchFilters("?msgQ=a&msgFrom=2026-02-31&msgTo=2026-02-40&msgStores=good-1,bad%20id,,good-1", TODAY);
  assert.equal(parsed.keyword, "", "single-character keyword is dropped");
  assert.deepEqual(parsed.period, defaultMessageSearchPeriod(TODAY), "impossible dates fall back to the default period");
  assert.deepEqual(parsed.storeIds, ["good-1"], "invalid and duplicate store IDs are removed");
});

test("store selection from the URL is capped at 50 stores", () => {
  const ids = Array.from({ length: 60 }, (_, index) => `s-${index}`).join(",");
  assert.equal(parseMessageSearchFilters(`?msgStores=${ids}`, TODAY).storeIds.length, 50);
});

test("active-filter detection and clear-filters both restore the default 7-day state", () => {
  const defaults = defaultMessageSearchFilters(TODAY);
  assert.equal(hasActiveMessageSearchFilters(defaults, TODAY), false);
  assert.equal(hasActiveMessageSearchFilters({ ...defaults, keyword: "สวัสดี" }, TODAY), true);
  assert.equal(hasActiveMessageSearchFilters({ ...defaults, storeIds: ["store-a"] }, TODAY), true);
  assert.equal(hasActiveMessageSearchFilters({ ...defaults, period: { dateFrom: "2026-09-01", dateTo: "2026-09-30" } }, TODAY), true);
  assert.deepEqual(
    clearMessageSearchFilters(TODAY),
    { keyword: "", period: defaultMessageSearchPeriod(TODAY), storeIds: [] },
  );
});
