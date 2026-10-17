import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const results = readFileSync(new URL("../src/components/chats/message-search/embedded-chat-message-results.tsx", import.meta.url), "utf8");
const highlight = readFileSync(new URL("../src/components/chats/message-search/highlight-search-text.tsx", import.meta.url), "utf8");

test("global message search belongs in existing three-pane /chats workspace", () => {
  assert.match(page, /data-chat-pane="conversations"/);
  assert.match(page, /data-chat-pane="detail"/);
  assert.match(page, /data-chat-filter-button/);
  assert.match(page, /<EmbeddedChatMessageResults/);
  assert.match(page, /showEmbeddedMessageResults \? \(/);
  assert.doesNotMatch(results, /window\.location\.assign/);
});

test("message-search date filter reuses UnifiedPeriodPicker inside advanced filters", () => {
  assert.match(page, /data-embedded-message-search-date/);
  assert.match(page, /<UnifiedPeriodPicker/);
  assert.match(page, /validateMessageSearchPeriod\(messageSearchPeriod/);
  assert.match(page, /setMessageSearchPeriod\(\{ dateFrom, dateTo \}\)/);
  assert.match(page, /<option value="all">\{text\.allLineOa\}<\/option>/);
});

test("message-level search leaves the existing chatMonth conversation query intact", () => {
  assert.match(page, /month: initialSection === "chats" \? chatMonth : undefined/);
  assert.match(page, /buildConversationListQuery/);
  assert.match(page, /search: initialSection === "chats" && !showEmbeddedMessageResults \? searchText : ""/);
  assert.match(results, /useChatMessageSearch/);
  assert.match(results, /period,/);
  assert.match(results, /storeIds: storeId === "all" \? \[\] : \[storeId\]/);
});

test("message search is HQ- and production-backend-flag-gated", () => {
  assert.match(page, /authUser\?\.role === "ADMIN"/);
  assert.match(page, /authUser\.authorization\?\.workspaces\?\.hq === true/);
  assert.match(page, /isChatMessageSearchUiEnabled\(process\.env\.NEXT_PUBLIC_CHAT_MESSAGE_SEARCH_UI\)/);
  assert.match(page, /NEXT_PUBLIC_CHAT_MESSAGE_SEARCH_DATA === "backend"/);
});

test("results group by conversation and select exact target without HTML injection", () => {
  assert.match(results, /new Map<string, \{ first: MessageSearchItem; count: number \}>\(\)/);
  assert.match(results, /groups\.get\(item\.conversationId\)/);
  assert.match(results, /onSelect\(\{ messageId: first\.messageId, conversationId: first\.conversationId/);
  assert.match(page, /data-chat-message-id=\{message\.id\}/);
  assert.match(page, /scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
  assert.match(page, /targetAutoPageRef\.current >= 8/);
  assert.match(highlight, /<mark data-chat-search-highlight/);
  assert.doesNotMatch(highlight, /dangerouslySetInnerHTML|innerHTML/);
});

test("embedded search automatically loads result pages and labels provisional counts accurately", () => {
  assert.match(results, /autoLoadAll: true/);
  assert.match(results, /pageSize: EMBEDDED_SEARCH_PAGE_SIZE/);
  assert.match(results, /maxAutoItems: EMBEDDED_SEARCH_MAX_AUTOMATIC_ITEMS/);
  assert.match(results, /data-chat-search-completeness/);
  assert.match(results, /search\.state\.items\.length/);
  assert.match(results, /copy\.gathering/);
  assert.match(results, /copy\.limitReached/);
  assert.doesNotMatch(results, /onClick=\{search\.loadMore\}/, "successful searches must not require clicking a Load More button");
});

test("spacing-equivalent product names are highlighted without HTML injection", () => {
  assert.match(highlight, /compactProductRange/);
  assert.match(highlight, /data-chat-search-highlight/);
  assert.doesNotMatch(highlight, /dangerouslySetInnerHTML|innerHTML/);
});
