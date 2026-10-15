import assert from "node:assert/strict";
import test from "node:test";
import {
  buildChatMessageSearchSql,
  buildMessageSnippet,
  chatSearchContainsPattern,
  chatSearchFingerprint,
  chatSearchKeywordVariants,
  decodeChatSearchCursor,
  encodeChatSearchCursor,
  escapeLikeLiteral,
  normalizeChatSearchKeyword,
  parseChatMessageSearchInput,
  resolveChatSearchRange,
} from "./chat-search-query";

const THAI_SARA_AM = "\u0E33";
const THAI_SARA_AM_DECOMPOSED = "\u0E4D\u0E32";

function errorCode(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    const response = (error as { getResponse?: () => unknown }).getResponse?.();
    return (response as { code?: string } | undefined)?.code;
  }
  return undefined;
}

const valid = { q: "สวัสดี", startDate: "2026-09-01", endDate: "2026-09-30" };

void test("keyword normalization keeps Thai semantics: NFC and SARA AM only, no NFKC rewriting", () => {
  assert.equal(normalizeChatSearchKeyword("  สวัสดี   ครับ ​ "), "สวัสดี ครับ");
  assert.equal(normalizeChatSearchKeyword(`ค${THAI_SARA_AM}`), `ค${THAI_SARA_AM}`);
  assert.equal(normalizeChatSearchKeyword(`ค${THAI_SARA_AM_DECOMPOSED}`), `ค${THAI_SARA_AM}`);
  assert.equal(normalizeChatSearchKeyword("é"), "é");
  assert.equal(normalizeChatSearchKeyword("Ａｂｃ"), "Ａｂｃ", "fullwidth letters must not be rewritten (NFKC would)");
});

void test("keyword variants match both SARA AM spellings against the same row", () => {
  assert.deepEqual(chatSearchKeywordVariants(`ค${THAI_SARA_AM}`), [`ค${THAI_SARA_AM}`, `ค${THAI_SARA_AM_DECOMPOSED}`]);
  assert.deepEqual(chatSearchKeywordVariants("hello"), ["hello"]);
});

void test("keyword length is counted in code points after trimming and must be 2 to 100", () => {
  assert.equal(errorCode(() => parseChatMessageSearchInput({ ...valid, q: "ก" })), "CHAT_SEARCH_INVALID_KEYWORD");
  assert.equal(errorCode(() => parseChatMessageSearchInput({ ...valid, q: "  ก  " })), "CHAT_SEARCH_INVALID_KEYWORD");
  assert.equal(parseChatMessageSearchInput({ ...valid, q: "กา" }).keyword, "กา");
  assert.equal(parseChatMessageSearchInput({ ...valid, q: "😀".repeat(100) }).keyword.length, 200);
  assert.equal(errorCode(() => parseChatMessageSearchInput({ ...valid, q: "😀".repeat(101) })), "CHAT_SEARCH_INVALID_KEYWORD");
  assert.equal(errorCode(() => parseChatMessageSearchInput({ ...valid, q: undefined })), "CHAT_SEARCH_INVALID_KEYWORD");
});

void test("LIKE wildcards and the escape character are matched literally", () => {
  assert.equal(escapeLikeLiteral("100%_!"), "100!%!_!!");
  assert.equal(chatSearchContainsPattern("a%b"), "%a!%b%");
  assert.equal(chatSearchContainsPattern("a_b"), "%a!_b%");
});

void test("Bangkok inclusive dates map to a half-open UTC window that ends at the next Bangkok midnight", () => {
  const range = resolveChatSearchRange("2026-09-01", "2026-09-30");
  assert.equal(range.gte.toISOString(), "2026-08-31T17:00:00.000Z");
  assert.equal(range.lt.toISOString(), "2026-09-30T17:00:00.000Z");
  assert.ok(new Date("2026-08-31T16:59:59.999Z") < range.gte, "31 Aug 23:59:59.999 Bangkok is outside");
  assert.ok(new Date("2026-08-31T17:00:00.000Z") >= range.gte, "1 Sep 00:00 Bangkok is inside");
  assert.ok(new Date("2026-09-30T16:59:59.999Z") < range.lt, "30 Sep 23:59:59.999 Bangkok is inside");
  assert.ok(new Date("2026-09-30T17:00:00.000Z") >= range.lt, "1 Oct 00:00 Bangkok is outside");
});

void test("single-day, cross-month, cross-year and leap-day ranges are inclusive", () => {
  const oneDay = resolveChatSearchRange("2026-09-15", "2026-09-15");
  assert.equal(oneDay.gte.toISOString(), "2026-09-14T17:00:00.000Z");
  assert.equal(oneDay.lt.toISOString(), "2026-09-15T17:00:00.000Z");

  const crossYear = resolveChatSearchRange("2025-12-25", "2026-01-05");
  assert.equal(crossYear.gte.toISOString(), "2025-12-24T17:00:00.000Z");
  assert.equal(crossYear.lt.toISOString(), "2026-01-05T17:00:00.000Z", "upper bound is 6 Jan 00:00 Bangkok");

  const leap = resolveChatSearchRange("2028-02-28", "2028-03-01");
  assert.equal(leap.lt.toISOString(), "2028-03-01T17:00:00.000Z", "2028 has 29 February");
});

void test("ranges are capped at 90 calendar days inclusive and reject invalid calendar input", () => {
  assert.doesNotThrow(() => resolveChatSearchRange("2026-01-01", "2026-03-31"), "90 days is allowed");
  assert.equal(errorCode(() => resolveChatSearchRange("2026-01-01", "2026-04-01")), "CHAT_SEARCH_RANGE_TOO_LARGE");
  assert.equal(errorCode(() => resolveChatSearchRange("2026-02-31", "2026-03-01")), "CHAT_SEARCH_INVALID_DATE");
  assert.equal(errorCode(() => resolveChatSearchRange("2026-09-30", "2026-09-01")), "CHAT_SEARCH_INVALID_DATE");
  assert.equal(errorCode(() => parseChatMessageSearchInput({ ...valid, startDate: "2026/09/01" })), "CHAT_SEARCH_INVALID_DATE");
  assert.equal(errorCode(() => parseChatMessageSearchInput({ ...valid, endDate: undefined })), "CHAT_SEARCH_INVALID_DATE");
});

void test("store selection is optional, de-duplicated and format-checked", () => {
  assert.equal(parseChatMessageSearchInput({ ...valid }).storeIds, null);
  assert.equal(parseChatMessageSearchInput({ ...valid, storeIds: [] }).storeIds, null);
  assert.deepEqual(parseChatMessageSearchInput({ ...valid, storeIds: "store-a" }).storeIds, ["store-a"]);
  assert.deepEqual(parseChatMessageSearchInput({ ...valid, storeIds: ["a", "a", "b"] }).storeIds, ["a", "b"]);
  assert.equal(errorCode(() => parseChatMessageSearchInput({ ...valid, storeIds: "a b;drop" })), "CHAT_SEARCH_INVALID_STORE");
  assert.equal(errorCode(() => parseChatMessageSearchInput({ ...valid, storeIds: [1] })), "CHAT_SEARCH_INVALID_STORE");
  const fifty = Array.from({ length: 50 }, (_, index) => `s${index}`);
  assert.equal(parseChatMessageSearchInput({ ...valid, storeIds: fifty }).storeIds?.length, 50);
  assert.equal(errorCode(() => parseChatMessageSearchInput({ ...valid, storeIds: [...fifty, "s50"] })), "CHAT_SEARCH_INVALID_STORE");
});

void test("limit defaults to 20 and is bounded to 1 to 50", () => {
  assert.equal(parseChatMessageSearchInput({ ...valid }).limit, 20);
  assert.equal(parseChatMessageSearchInput({ ...valid, limit: "5" }).limit, 5);
  assert.equal(parseChatMessageSearchInput({ ...valid, limit: 50 }).limit, 50);
  for (const limit of [0, 51, "0", "51", "1.5", "abc", -1]) {
    assert.equal(errorCode(() => parseChatMessageSearchInput({ ...valid, limit })), "CHAT_SEARCH_INVALID_LIMIT", `limit=${String(limit)}`);
  }
});

void test("an empty cursor means first page; malformed cursors are rejected", () => {
  assert.equal(parseChatMessageSearchInput({ ...valid, cursor: "" }).cursor, null);
  assert.equal(errorCode(() => parseChatMessageSearchInput({ ...valid, cursor: 7 })), "CHAT_SEARCH_INVALID_CURSOR");
  assert.equal(errorCode(() => parseChatMessageSearchInput({ ...valid, cursor: "x".repeat(513) })), "CHAT_SEARCH_INVALID_CURSOR");
});

void test("cursors round-trip and are bound to the exact query fingerprint", () => {
  const fingerprint = chatSearchFingerprint({ keyword: "สวัสดี", startDate: "2026-09-01", endDate: "2026-09-30", storeIds: null });
  const token = encodeChatSearchCursor({ sentAt: new Date("2026-09-10T03:04:05.678Z"), messageId: "msg-1" }, fingerprint);
  assert.deepEqual(decodeChatSearchCursor(token, fingerprint), { sentAt: new Date("2026-09-10T03:04:05.678Z"), messageId: "msg-1" });

  const otherFingerprint = chatSearchFingerprint({ keyword: "ครับ", startDate: "2026-09-01", endDate: "2026-09-30", storeIds: null });
  assert.throws(() => decodeChatSearchCursor(token, otherFingerprint), /does not match this search/u);
  assert.throws(() => decodeChatSearchCursor("not-a-cursor", fingerprint));
  const tampered = Buffer.from(JSON.stringify({ v: 2, t: "2026-09-10T03:04:05.678Z", i: "msg-1", f: fingerprint }), "utf8").toString("base64url");
  assert.throws(() => decodeChatSearchCursor(tampered, fingerprint));
  const badId = Buffer.from(JSON.stringify({ v: 1, t: "2026-09-10T03:04:05.678Z", i: "x';--", f: fingerprint }), "utf8").toString("base64url");
  assert.throws(() => decodeChatSearchCursor(badId, fingerprint));
});

void test("fingerprint is order-independent for stores and distinguishes all-authorized from a selection", () => {
  const base = { keyword: "a", startDate: "2026-09-01", endDate: "2026-09-02" };
  assert.equal(
    chatSearchFingerprint({ ...base, storeIds: ["b", "a"] }),
    chatSearchFingerprint({ ...base, storeIds: ["a", "b"] }),
  );
  assert.notEqual(chatSearchFingerprint({ ...base, storeIds: null }), chatSearchFingerprint({ ...base, storeIds: ["a"] }));
  assert.notEqual(
    chatSearchFingerprint({ ...base, storeIds: null }),
    chatSearchFingerprint({ ...base, endDate: "2026-09-03", storeIds: null }),
  );
});

void test("snippets keep short text whole and center long text on the match", () => {
  assert.equal(buildMessageSnippet("สวัสดีครับ", ["สวัสดี"]), "สวัสดีครับ");
  const long = `${"x".repeat(300)}สวัสดี${"y".repeat(300)}`;
  const snippet = buildMessageSnippet(long, ["สวัสดี"]);
  assert.ok(snippet.includes("สวัสดี"));
  assert.ok(snippet.length <= 162, `snippet length ${snippet.length}`);
  assert.ok(snippet.startsWith("…") && snippet.endsWith("…"));

  const mixedCase = `${"a".repeat(200)}HELLO${"b".repeat(200)}`;
  assert.ok(buildMessageSnippet(mixedCase, ["hello"]).includes("HELLO"));

  const decomposed = `${"z".repeat(200)}ค${THAI_SARA_AM_DECOMPOSED}${"z".repeat(200)}`;
  assert.ok(buildMessageSnippet(decomposed, [`ค${THAI_SARA_AM}`, `ค${THAI_SARA_AM_DECOMPOSED}`]).includes(`ค${THAI_SARA_AM_DECOMPOSED}`));

  const noMatch = "q".repeat(400);
  assert.equal(buildMessageSnippet(noMatch, ["zzz"]), `${"q".repeat(160)}…`);
});

void test("generated SQL binds all user input, applies every scope predicate to the message row, and bounds the result", () => {
  const keywordVariants = chatSearchKeywordVariants(`ค${THAI_SARA_AM}`);
  const range = resolveChatSearchRange("2026-09-01", "2026-09-30");
  const sql = buildChatMessageSearchSql({ keywordVariants, range, storeIds: null, cursor: null, limit: 20 });

  assert.doesNotMatch(sql.sql, /COUNT\(/iu, "no unbounded count");
  assert.match(sql.sql, /LIMIT \?$/mu);
  assert.ok(sql.values.includes(21), "fetches limit + 1 to detect another page");
  assert.match(sql.sql, /m\."sentAt" >= \? AND m\."sentAt" < \?/u);
  assert.match(sql.sql, /ESCAPE '!'/u);
  assert.match(sql.sql, /s\."isActive" = true AND s\."archivedAt" IS NULL/u);
  assert.match(sql.sql, /oa\."accountType" = 'STORE' AND oa\."isActive" = true AND oa\."archivedAt" IS NULL AND oa\."storeId" = c\."storeId"/u);
  assert.match(sql.sql, /ORDER BY m\."sentAt" DESC, m\."id" DESC/u);
  assert.doesNotMatch(sql.sql, /c\."storeId" IN/u, "no store predicate when every authorized store is in scope");
  assert.doesNotMatch(sql.sql, /\(m\."sentAt", m\."id"\) </u, "no keyset predicate on the first page");
  assert.ok(sql.values.includes(chatSearchContainsPattern(`ค${THAI_SARA_AM}`)));
  assert.ok(sql.values.includes(chatSearchContainsPattern(`ค${THAI_SARA_AM_DECOMPOSED}`)));
  assert.ok(!sql.sql.includes("คำ"), "user keyword text must never be inlined into SQL");
});

void test("store filter and keyset predicate are added only when requested", () => {
  const range = resolveChatSearchRange("2026-09-01", "2026-09-30");
  const sql = buildChatMessageSearchSql({
    keywordVariants: ["hi"],
    range,
    storeIds: ["store-a", "store-b"],
    cursor: { sentAt: new Date("2026-09-10T00:00:00.000Z"), messageId: "msg-9" },
    limit: 5,
  });
  assert.match(sql.sql, /c\."storeId" IN \(\?,\s?\?\)/u);
  assert.match(sql.sql, /\(m\."sentAt", m\."id"\) < \(\?,\s?\?\)/u);
  assert.ok(sql.values.includes("store-a") && sql.values.includes("store-b"));
  assert.ok(sql.values.includes("msg-9"));
});
