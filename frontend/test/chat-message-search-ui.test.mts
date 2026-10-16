import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { messageSearchCopy, type MessageSearchCopy } from "../src/components/chats/message-search/message-search-copy.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const searchDir = "src/components/chats/message-search";
const searchFiles = readdirSync(new URL(`../${searchDir}/`, import.meta.url)).filter((name) => /\.(ts|tsx)$/u.test(name));
const searchSource = (name: string) => read(`${searchDir}/${name}`);
const routeCode = read("src/app/chats/search/page.tsx");
const panelCode = searchSource("chat-message-search-panel.tsx");
const hookCode = searchSource("use-chat-message-search.ts");

// ---- Route: flag gate ordering ------------------------------------------------

test("the search route is gated by the frontend flag and production environment checks before any authorization or data call", () => {
  assert.match(routeCode, /isChatMessageSearchUiEnabled\(process\.env\.NEXT_PUBLIC_CHAT_MESSAGE_SEARCH_UI\)/u);
  assert.match(routeCode, /appEnv:\s*process\.env\.NEXT_PUBLIC_APP_ENV/u);
  assert.match(routeCode, /nodeEnv:\s*process\.env\.NODE_ENV/u);
  assert.match(routeCode, /window\.location\.hostname/u);
  assert.match(routeCode, /if \(kind === null\) notFound\(\);/u);
  const gate = routeCode.indexOf("notFound()");
  const syntheticBranch = routeCode.indexOf('if (kind === "synthetic")');
  const authWrapper = routeCode.indexOf("<AuthorizedSection");
  assert.ok(gate > 0 && syntheticBranch > gate, "the disabled path is decided first");
  assert.ok(authWrapper > syntheticBranch, "the auth wrapper is only used on the backend path");
});

test("synthetic mode renders without the auth wrapper, so it cannot call the production auth endpoint", () => {
  const syntheticReturn = routeCode.slice(routeCode.indexOf('if (kind === "synthetic")'), routeCode.indexOf("<AuthorizedSection"));
  assert.match(syntheticReturn, /ChatMessageSearchPanel adapter=\{SYNTHETIC_ADAPTER\}/u);
  assert.doesNotMatch(syntheticReturn, /AuthorizedSection/u);
});

test("the route never calls the API client directly; only adapters perform requests", () => {
  assert.doesNotMatch(routeCode, /from "@\/lib\/api"/u);
  assert.doesNotMatch(routeCode, /\bapi\./u);
  assert.doesNotMatch(panelCode, /from "@\/lib\/api"/u);
});

// ---- Adapter isolation -------------------------------------------------------

test("only the HTTP adapter imports the API client, and the synthetic adapter has no network code", () => {
  const importers = searchFiles.filter((name) => /from "@\/lib\/api"/u.test(searchSource(name)));
  assert.deepEqual(importers, ["message-search-http-adapter.ts"]);
  const synthetic = searchSource("message-search-adapter.ts");
  assert.doesNotMatch(synthetic, /\bfetch\(/u);
  assert.doesNotMatch(synthetic, /XMLHttpRequest|WebSocket|EventSource/u);
});

test("the backend adapter only forwards to the search endpoint and the scoped store list", () => {
  const http = searchSource("message-search-http-adapter.ts");
  assert.match(http, /api\.searchChatMessages\(/u);
  assert.match(http, /api\.stores\(false, options/u, "stores come from the server-scoped /stores endpoint");
  assert.doesNotMatch(http, /conversations|historicalChats|historical-timeline/u, "no legacy conversation API is used");
});

test("the API client exposes the search endpoint under the documented path only", () => {
  const api = read("src/lib/api.ts");
  assert.match(api, /searchChatMessages: \(params/u);
  assert.match(api, /\/chat-search\/messages\?/u);
});

// ---- Date picker reuse and month isolation -------------------------------------

test("the panel reuses the shared UnifiedPeriodPicker and does not implement a second calendar", () => {
  assert.match(panelCode, /import \{ UnifiedPeriodPicker \} from "@\/components\/date-range\/unified-period-picker"/u);
  assert.match(panelCode, /presetLabel=\{copy\.preset\}/u);
  for (const name of searchFiles) {
    assert.doesNotMatch(searchSource(name), /function CalendarMonthGrid|function UnifiedPeriodPicker/u, `${name} must not define a calendar`);
  }
});

test("the shared picker keeps its two-month desktop grid and its default preset labels", () => {
  const picker = read("src/components/date-range/unified-period-picker.tsx");
  assert.match(picker, /grid-cols-1 md:grid-cols-2/u);
  assert.match(picker, /presetLabel \? presetLabel\(days\) : `\$\{days\}D`/u, "existing callers keep the default label");
});

test("message search never reads or combines the conversation month filter", () => {
  for (const name of searchFiles) {
    const code = searchSource(name);
    assert.doesNotMatch(code, /latestMessageAt/u, `${name} must not use the conversation timestamp`);
    assert.doesNotMatch(code, /chatMonth|resolveChatMonthRange/u, `${name} must not use the conversation month`);
    assert.doesNotMatch(code, /["']month["']/u, `${name} must not read the month query parameter`);
  }
});

test("the existing conversation filters are left intact", () => {
  const listQuery = read("src/app/conversation-list-query.ts");
  assert.match(listQuery, /month: input\.month/u, "the conversation month filter is unchanged");
  assert.doesNotMatch(listQuery, /msgQ|msgFrom|msgTo|msgStores/u);
  const chatsPage = read("src/app/chats/page.tsx");
  assert.match(chatsPage, /AuthorizedWorkspace section="chats"/u);
  assert.doesNotMatch(chatsPage, /message-search|chat-message-search/u, "the existing /chats page does not mount search");
});

// ---- Responsive layout ---------------------------------------------------------

test("the layout is responsive: filters stack on mobile and sit in rows on desktop", () => {
  assert.match(panelCode, /md:flex-row/u);
  assert.match(panelCode, /md:px-6/u);
  assert.match(searchSource("chat-message-search-store-select.tsx"), /md:absolute/u);
  assert.match(searchSource("chat-message-search-results.tsx"), /min-w-0/u, "long names and snippets do not overflow");
});

// ---- Search behavior wiring ----------------------------------------------------

test("the hook makes no request for an unsearchable state and cancels superseded requests", () => {
  assert.match(hookCode, /if \(!request\) return;/u);
  assert.match(hookCode, /cancelInFlight\(\);/u);
  assert.match(hookCode, /MESSAGE_SEARCH_DEBOUNCE_MS/u);
  assert.match(hookCode, /if \(!controller\.signal\.aborted\)/u, "cancelled responses are dropped");
});

test("query state is written to the URL with replaceState, not navigation", () => {
  assert.match(panelCode, /window\.history\.replaceState/u);
  assert.doesNotMatch(panelCode, /router\.push|window\.location\.href\s*=/u);
});

// ---- Copy ----------------------------------------------------------------------

const COPY_KEYS: Array<keyof MessageSearchCopy> = [
  "pageTitle", "modeLabel", "modeNote", "searchPlaceholder", "keywordHint", "keywordEmpty", "keywordTooShort", "keywordTooLong",
  "allStores", "selectStores", "storeSearchPlaceholder", "storesSelected", "noStoreMatch", "periodLabel", "preset", "customPeriod",
  "periodChip", "storeChip", "keywordChip", "removeChip", "clearFilters", "futureDate", "periodTooLong", "periodReversed", "invalidDate",
  "noResults", "loading", "loadingMore", "loadMore", "searchError", "retry", "sourceLive", "sourceHistorical", "directionInbound",
  "directionOutbound", "directionSystem", "customerUnknown", "partialDataNote", "accountStatusNote", "disabledTitle", "disabledBody",
  "syntheticNotice", "backToChats",
];

test("Thai, English, and Chinese copy define every key with no empty values", () => {
  for (const language of ["th", "en", "zh"] as const) {
    const copy = messageSearchCopy(language);
    for (const key of COPY_KEYS) {
      const value = copy[key];
      if (typeof value === "function") assert.ok(typeof value(3) === "string" && value(3).length > 0, `${language}.${key}`);
      else assert.ok(typeof value === "string" && value.trim().length > 0, `${language}.${key}`);
    }
  }
});

test("Thai copy includes the exact labels required by the owner-approved UX", () => {
  const th = messageSearchCopy("th");
  assert.equal(th.pageTitle, "ค้นหาข้อความ");
  assert.equal(th.allStores, "ทุกร้าน");
  assert.equal(th.selectStores, "เลือกร้านค้า");
  assert.equal(th.periodLabel, "ช่วงวันที่");
  assert.equal(th.preset(7), "7 วัน");
  assert.equal(th.preset(14), "14 วัน");
  assert.equal(th.preset(30), "30 วัน");
  assert.equal(th.customPeriod, "กำหนดเอง");
  assert.equal(th.clearFilters, "ล้างตัวกรอง");
  assert.equal(th.noResults, "ไม่พบข้อความ");
  assert.equal(th.partialDataNote, "ข้อมูลบางส่วนอาจอยู่ระหว่างการกู้คืน");
});

test("the account-status and recovery explanation is always shown with the results", () => {
  assert.match(panelCode, /copy\.partialDataNote/u);
  assert.match(panelCode, /copy\.accountStatusNote/u);
});
