import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildConversationListQuery,
  conversationListQueryKey,
  LatestConversationRequestGuard,
  reconcileConversationPage,
} from "../src/app/conversation-list-query.ts";

const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

test("authoritative query represents every server-side list dimension", () => {
  const query = buildConversationListQuery({
    page: 5,
    pageSize: 10,
    search: "  Reno  ",
    storeId: "store-1",
    lineOaId: "oa-1",
    followUpStatus: "FOLLOW_UP",
    priority: "HIGH",
    productSeriesId: "series-1",
    productModelId: "model-1",
    topicId: "topic-1",
  });

  assert.deepEqual(query, {
    page: 5,
    pageSize: 10,
    search: "Reno",
    storeId: "store-1",
    lineOaId: "oa-1",
    followUpStatus: "FOLLOW_UP",
    priority: "HIGH",
    productSeriesId: "series-1",
    productModelId: "model-1",
    topicId: "topic-1",
  });
  assert.equal(conversationListQueryKey(query), JSON.stringify(query));
});

test("Clear All query is unfiltered page 1 and preserves a valid zero total", () => {
  const query = buildConversationListQuery({
    page: 1,
    pageSize: 20,
    search: "",
    storeId: "all",
    lineOaId: "all",
  });
  assert.deepEqual(query, { page: 1, pageSize: 20, search: undefined, storeId: undefined, lineOaId: undefined, followUpStatus: undefined, priority: undefined, productSeriesId: undefined, productModelId: undefined, topicId: undefined });
  assert.equal(reconcileConversationPage(0, 1, 20), 1);
  assert.match(pageCode, /\{chatTotalCount\} \{text\.searchResults\}/);
  assert.doesNotMatch(pageCode, /chatTotalCount \|\| filteredConversations\.length/);
});

test("out-of-range pages reconcile the real query page", () => {
  assert.equal(reconcileConversationPage(35, 5, 20), 2);
  assert.equal(reconcileConversationPage(0, 5, 20), 1);
  assert.match(pageCode, /setChatPage\(reconciledPage\)/);
});

test("request generations reject reversed and repeated-store stale responses", () => {
  const guard = new LatestConversationRequestGuard();
  const allStores = guard.begin();
  const storeOne = guard.begin();
  const storeTwo = guard.begin();
  assert.equal(guard.isLatest(allStores), false);
  assert.equal(guard.isLatest(storeOne), false);
  assert.equal(guard.isLatest(storeTwo), true);
});

test("one loader owns conversation state and polling reuses its current query", () => {
  assert.equal([...pageCode.matchAll(/api\.conversations\(/g)].length, 1);
  assert.match(pageCode, /const loadConversations = useCallback/);
  assert.match(pageCode, /loadConversations\(conversationQueryRef\.current, silent\)/);
  assert.match(pageCode, /window\.setInterval[\s\S]*loadApplicationData\(true\)[\s\S]*12_000/);

  const supportingStart = pageCode.indexOf("const loadSupportingData");
  const supportingEnd = pageCode.indexOf("const loadApplicationData", supportingStart);
  assert.doesNotMatch(pageCode.slice(supportingStart, supportingEnd), /api\.conversations/);
});

test("classification filters are resolved to IDs and sent server-side", () => {
  assert.match(pageCode, /productSeriesId: initialSection === "chats" \? productSeriesId/);
  assert.match(pageCode, /productModelId: initialSection === "chats" \? productModelId/);
  assert.match(pageCode, /topicId: initialSection === "chats" \? topicId/);
  assert.match(pageCode, /const filteredConversations = conversations/);
});

test("all query-shaping fields reset page and selected conversation stays in returned rows", () => {
  for (const field of ["storeId", "lineOaId", "followUpStatus", "search", "priority", "productSeriesId", "productModelId", "topicId", "pageSize"]) {
    assert.match(pageCode, new RegExp(`${field}: activeConversationQuery\\.${field}`));
  }
  assert.match(pageCode, /previousConversationFilterShape\.current !== conversationFilterShapeKey/);
  assert.match(pageCode, /setChatPage\(1\)/);
  assert.match(pageCode, /mapped\.some\(\(\{ id \}\) => id === currentId\) \? currentId : mapped\[0\]\?\.id \?\? ""/);
});

test("persisted filters are validated after metadata loads even when the result list is empty", () => {
  const validationStart = pageCode.indexOf("if (!uiPreferencesLoaded || !supportingDataLoaded) return");
  const validationEnd = pageCode.indexOf("const filteredConversations", validationStart);
  const validationCode = pageCode.slice(validationStart, validationEnd);
  assert.ok(validationStart > 0);
  assert.doesNotMatch(validationCode, /conversations\.length/);
  assert.match(validationCode, /setSelectedStore\("all"\)/);
  assert.match(validationCode, /setModelFilter\("all"\)/);
  assert.match(validationCode, /setTopicFilter\("all"\)/);
});
