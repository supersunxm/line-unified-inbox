import assert from "node:assert/strict";
import test from "node:test";
import {
  isChatMessageSearchUiEnabled,
  isLocalSyntheticHost,
  isSyntheticMessageSearchAllowed,
  resolveMessageSearchDataMode,
  selectMessageSearchAdapterKind,
} from "../src/components/chats/message-search/message-search-config.ts";
import { formatMessageSearchTimestamp, messageSearchDirectionLabel, messageSearchSourceLabel } from "../src/components/chats/message-search/message-search-format.ts";
import { messageSearchCopy } from "../src/components/chats/message-search/message-search-copy.ts";
import type { MessageSearchItem, MessageSearchPage } from "../src/components/chats/message-search/message-search-adapter.ts";
import { initialMessageSearchState, messageSearchReducer } from "../src/components/chats/message-search/message-search-state.ts";

// ---- Feature flag -----------------------------------------------------------

test("the frontend flag is enabled only by the exact value true", () => {
  assert.equal(isChatMessageSearchUiEnabled(undefined), false, "unset is disabled by default");
  assert.equal(isChatMessageSearchUiEnabled(""), false);
  assert.equal(isChatMessageSearchUiEnabled("false"), false);
  assert.equal(isChatMessageSearchUiEnabled("TRUE"), false);
  assert.equal(isChatMessageSearchUiEnabled("1"), false);
  assert.equal(isChatMessageSearchUiEnabled("true"), true);
});

test("the data source is synthetic unless the backend is named explicitly", () => {
  assert.equal(resolveMessageSearchDataMode(undefined), "synthetic");
  assert.equal(resolveMessageSearchDataMode("production"), "synthetic");
  assert.equal(resolveMessageSearchDataMode("Backend"), "synthetic");
  assert.equal(resolveMessageSearchDataMode("backend"), "backend");
});

test("with the flag disabled no adapter is selected in any data mode, so no request can be made", () => {
  assert.equal(selectMessageSearchAdapterKind({ enabled: false, mode: "synthetic" }), null);
  assert.equal(selectMessageSearchAdapterKind({ enabled: false, mode: "backend" }), null);
});

test("with the flag enabled the adapter follows the explicit data mode in local non-production", () => {
  assert.equal(
    selectMessageSearchAdapterKind({ enabled: true, mode: "synthetic", appEnv: "development", nodeEnv: "development", hostname: "127.0.0.1" }),
    "synthetic",
  );
  assert.equal(selectMessageSearchAdapterKind({ enabled: true, mode: "backend" }), "backend");
});

test("synthetic mode is refused in production builds, production appEnv, and non-loopback hostnames", () => {
  assert.equal(isLocalSyntheticHost("127.0.0.1"), true);
  assert.equal(isLocalSyntheticHost("localhost"), true);
  assert.equal(isLocalSyntheticHost("::1"), true);
  assert.equal(isLocalSyntheticHost("lineoppo.click"), false);
  assert.equal(isLocalSyntheticHost("example.ngrok-free.app"), false);

  assert.equal(isSyntheticMessageSearchAllowed({ appEnv: "production", nodeEnv: "development", hostname: "127.0.0.1" }), false);
  assert.equal(isSyntheticMessageSearchAllowed({ appEnv: "development", nodeEnv: "production", hostname: "127.0.0.1" }), false);
  assert.equal(isSyntheticMessageSearchAllowed({ appEnv: "development", nodeEnv: "development", hostname: "lineoppo.click" }), false);
  assert.equal(isSyntheticMessageSearchAllowed({ appEnv: "development", nodeEnv: "development", hostname: "127.0.0.1" }), true);

  assert.equal(
    selectMessageSearchAdapterKind({ enabled: true, mode: "synthetic", appEnv: "production", nodeEnv: "development", hostname: "127.0.0.1" }),
    null,
  );
  assert.equal(
    selectMessageSearchAdapterKind({ enabled: true, mode: "synthetic", appEnv: "development", nodeEnv: "production", hostname: "127.0.0.1" }),
    null,
  );
  assert.equal(
    selectMessageSearchAdapterKind({ enabled: true, mode: "synthetic", appEnv: "development", nodeEnv: "development", hostname: "lineoppo.click" }),
    null,
  );
  assert.equal(
    selectMessageSearchAdapterKind({ enabled: true, mode: "backend", appEnv: "production", nodeEnv: "production", hostname: "lineoppo.click" }),
    "backend",
  );
});

// ---- Reducer ----------------------------------------------------------------

const ITEM: MessageSearchItem = {
  messageId: "m-1",
  conversationId: "c-1",
  storeId: "store-syn-01",
  storeName: "Synthetic Store 01",
  customerDisplayName: "Sample Customer A",
  direction: "INBOUND",
  sentAt: "2026-10-14T03:00:00.000Z",
  snippet: "สวัสดี",
  source: "LIVE",
};
const page = (items: MessageSearchItem[], hasMore = false, nextCursor: string | null = null): MessageSearchPage => ({ items, hasMore, nextCursor });

test("a current response replaces results and a stale response for an older request is ignored", () => {
  let state = messageSearchReducer(initialMessageSearchState, { type: "search-started", requestId: 1 });
  state = messageSearchReducer(state, { type: "search-started", requestId: 2 });
  const stale = messageSearchReducer(state, { type: "page-received", requestId: 1, page: page([ITEM]), append: false });
  assert.equal(stale, state, "stale page leaves state unchanged");
  const current = messageSearchReducer(state, { type: "page-received", requestId: 2, page: page([ITEM]), append: false });
  assert.equal(current.status, "loaded");
  assert.deepEqual(current.items, [ITEM]);
});

test("an empty current response reports the empty state", () => {
  const started = messageSearchReducer(initialMessageSearchState, { type: "search-started", requestId: 1 });
  const done = messageSearchReducer(started, { type: "page-received", requestId: 1, page: page([]), append: false });
  assert.equal(done.status, "empty");
  assert.deepEqual(done.items, []);
});

test("a failed current request reports an error and clears stale rows", () => {
  let state = messageSearchReducer(initialMessageSearchState, { type: "search-started", requestId: 1 });
  state = messageSearchReducer(state, { type: "page-received", requestId: 1, page: page([ITEM]), append: false });
  state = messageSearchReducer(state, { type: "search-started", requestId: 2 });
  state = messageSearchReducer(state, { type: "failed", requestId: 2, message: "failed", append: false });
  assert.equal(state.status, "error");
  assert.deepEqual(state.items, []);
});

test("load-more appends to the current results and keeps the cursor for the next page", () => {
  let state = messageSearchReducer(initialMessageSearchState, { type: "search-started", requestId: 5 });
  state = messageSearchReducer(state, { type: "page-received", requestId: 5, page: page([ITEM], true, "20"), append: false });
  state = messageSearchReducer(state, { type: "load-more-started", requestId: 5 });
  assert.equal(state.loadingMore, true);
  const second = { ...ITEM, messageId: "m-2" };
  state = messageSearchReducer(state, { type: "page-received", requestId: 5, page: page([second], false, null), append: true });
  assert.deepEqual(state.items.map((item) => item.messageId), ["m-1", "m-2"]);
  assert.equal(state.hasMore, false);
  assert.equal(state.loadingMore, false);
});

test("a load-more response from an earlier search cannot be appended to a new search", () => {
  let state = messageSearchReducer(initialMessageSearchState, { type: "search-started", requestId: 7 });
  state = messageSearchReducer(state, { type: "page-received", requestId: 7, page: page([ITEM], true, "20"), append: false });
  state = messageSearchReducer(state, { type: "search-started", requestId: 8 });
  const late = messageSearchReducer(state, { type: "page-received", requestId: 7, page: page([{ ...ITEM, messageId: "old" }], false, null), append: true });
  assert.deepEqual(late.items, [], "the new search is still empty while loading");
});

test("reset returns to idle and adopts the caller's request id", () => {
  const reset = messageSearchReducer(
    messageSearchReducer(initialMessageSearchState, { type: "search-started", requestId: 3 }),
    { type: "reset", requestId: 4 },
  );
  assert.equal(reset.status, "idle");
  assert.equal(reset.requestId, 4);
});

// ---- Formatting -------------------------------------------------------------

test("message timestamps are displayed in Bangkok time regardless of the viewer's zone", () => {
  // 17:30Z is 00:30 on 15 Oct in Bangkok
  const label = formatMessageSearchTimestamp("2026-10-14T17:30:00.000Z", "en");
  assert.match(label, /Oct 15, 2026/u);
  assert.match(label, /12:30 AM/u);
});

test("direction and source labels are localized and never invent a historical source", () => {
  assert.equal(messageSearchDirectionLabel("INBOUND", "th"), messageSearchCopy("th").directionInbound);
  assert.equal(messageSearchDirectionLabel("OUTBOUND", "en"), messageSearchCopy("en").directionOutbound);
  assert.equal(messageSearchSourceLabel("LIVE", "th"), messageSearchCopy("th").sourceLive);
  assert.equal(messageSearchSourceLabel("HISTORICAL", "zh"), messageSearchCopy("zh").sourceHistorical);
});
