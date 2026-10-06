import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildChatsHref, readChatRouteFilters, resolveSelectedConversation, resolveSelectedConversationId, resolveSelectedConversationState } from "../src/app/workspace-routing.ts";

const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

test("off-page deep links render exact API state without borrowing another customer's state", () => {
  type DetailState = { sourceTag: string | null; onlineSource: string | null; note: string };
  const routeState: DetailState = { sourceTag: "Facebook", onlineSource: "TikTok", note: "" };
  const listedState: DetailState = { sourceTag: null, onlineSource: null, note: "Local edit" };
  assert.equal(resolveSelectedConversationState({ selectedConversationId: "off-page",
    listedStates: { listed: listedState }, routeConversationId: "off-page", routeState }), routeState);
  assert.equal(resolveSelectedConversationState({ selectedConversationId: "listed",
    listedStates: { listed: listedState }, routeConversationId: "listed", routeState }), listedState);
  assert.equal(resolveSelectedConversationState({ selectedConversationId: "off-page",
    listedStates: { listed: listedState }, routeConversationId: "different-customer", routeState }), undefined);
  assert.equal(resolveSelectedConversationState({ selectedConversationId: "off-page", listedStates: {} }), undefined);
});

test("chat filter URLs are shareable and restorable", () => {
  const href = buildChatsHref({ store: "store-1", status: "follow-up", priority: "high", topic: "pricing" });
  assert.equal(href, "/chats?storeId=store-1&status=follow-up&priority=high&topic=pricing");
  assert.deepEqual(readChatRouteFilters(href.slice(href.indexOf("?"))), {
    store: "store-1", status: "follow-up", priority: "high", model: undefined,
    topic: "pricing", lineOaId: undefined, month: undefined, conversationId: undefined,
  });
});

test("chat routes preserve monthly and archive period selection", () => {
  assert.equal(
    buildChatsHref({ store: "store-1", month: "2026-10" }),
    "/chats?storeId=store-1&month=2026-10",
  );
  assert.equal(buildChatsHref({ month: "all" }), "/chats?month=all");
  assert.equal(
    buildChatsHref({ month: "all", replyState: "NOT_REPLIED" }),
    "/chats?month=all&replyState=NOT_REPLIED",
  );
  assert.equal(readChatRouteFilters("?month=2026-09").month, "2026-09");
  assert.equal(readChatRouteFilters("?month=all").month, "all");
  assert.deepEqual(readChatRouteFilters("?month=all&replyState=NOT_REPLIED"), {
    store: undefined,
    status: undefined,
    replyState: "NOT_REPLIED",
    priority: undefined,
    model: undefined,
    topic: undefined,
    lineOaId: undefined,
    month: "all",
    conversationId: undefined,
  });
  // Empty search defaults to no month in route filters (which lets caller fall back to current Bangkok month)
  assert.equal(readChatRouteFilters("").month, undefined);
});

test("chat routes use effective two-state reply filters and normalize legacy notified links", () => {
  assert.equal(
    buildChatsHref({ store: "store-1", replyState: "NOT_REPLIED" }),
    "/chats?storeId=store-1&replyState=NOT_REPLIED",
  );
  assert.equal(readChatRouteFilters("?replyState=REPLIED").replyState, "REPLIED");
  assert.equal(readChatRouteFilters("?bmReplyStatus=NOTIFIED_BM").replyState, "NOT_REPLIED");
  assert.equal(readChatRouteFilters("?bmReplyStatus=REPLIED").replyState, "REPLIED");
});

test("deep-linked conversation stays selected while its detail resolves outside the current list page", () => {
  const base = {
    selectedConversationId: "target-conversation",
    visibleConversations: [{ id: "page-one-conversation" }],
    routeConversationId: "target-conversation",
  };

  assert.equal(resolveSelectedConversationId({ ...base, routeLookupStatus: "pending" }), "target-conversation");
  assert.equal(resolveSelectedConversationId({ ...base, routeLookupStatus: "resolved" }), "target-conversation");
  assert.equal(resolveSelectedConversationId({ ...base, routeLookupStatus: "failed" }), "page-one-conversation");
  assert.equal(resolveSelectedConversationId({ ...base, routeConversationId: "another-route" }), "page-one-conversation");
  assert.equal(resolveSelectedConversationId({
    ...base,
    visibleConversations: [{ id: "target-conversation" }, { id: "page-one-conversation" }],
    routeLookupStatus: "failed",
  }), "target-conversation");
});

test("resolved deep-link detail is used when its row is outside the current page", () => {
  const visible = [{ id: "page-one-conversation", customer: "Current page row" }];
  const requested = { id: "target-conversation", customer: "Exact route target" };

  assert.deepEqual(resolveSelectedConversation({
    visibleConversations: visible,
    selectedConversationId: requested.id,
    routeConversation: requested,
  }), requested);
  assert.deepEqual(resolveSelectedConversation({
    visibleConversations: visible,
    selectedConversationId: "page-one-conversation",
    routeConversation: requested,
  }), visible[0]);
  assert.equal(resolveSelectedConversation({
    visibleConversations: visible,
    selectedConversationId: "missing-target",
  }), visible[0]);
});

test("changing Store or OA scope clears the exact deep-link selection before loading another scope", () => {
  assert.match(page, /function clearRequestedRouteConversation\(\)[\s\S]*?setSelectedConversationId\(""\)/);
  assert.match(page, /function changeStoreFilter\(storeId: string\)[\s\S]*?clearRequestedRouteConversation\(\)[\s\S]*?setSelectedStore\(storeId\)/);
  assert.match(page, /function changeLineOaFilter\(lineOaId: string\)[\s\S]*?clearRequestedRouteConversation\(\)[\s\S]*?setLineOaFilter\(lineOaId\)/);
  assert.match(page, /onChange=\{\(event\) => changeStoreFilter\(event\.target\.value\)\}/);
  assert.match(page, /onChange=\{\(event\) => changeLineOaFilter\(event\.target\.value\)\}/);
});

const topNavCode = readFileSync(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");

test("application exposes primary routes with active navigation", () => {
  for (const route of ["/dashboard", "/chats", "/stores", "/follower-insights", "/friend-source-links"]) {
    assert.match(topNavCode, new RegExp(`href=\\"${route.replace("?", "\\?")}`));
  }
  assert.match(topNavCode, /aria-current=\{currentSection === "chats" \? "page" : undefined\}/);
});

test("dashboard links to filtered workspaces while root remains public", () => {
  const dashboardCode = readFileSync(new URL("../src/app/dashboard/executive-dashboard-v2.tsx", import.meta.url), "utf8");
  assert.match(dashboardCode, /onOpenStore/);
  const home = page.slice(
    page.indexOf("export default function Home"),
    page.indexOf("export function ApplicationWorkspace"),
  );
  assert.match(home, /PublicLandingPage/);
  assert.doesNotMatch(home, /window\.location\.replace/);
});

test("stores and chats remain focused workspaces", () => {
  assert.match(page, /initialSection === "stores" \? \(/);
  assert.match(page, /initialSection === "dashboard" \? \(/);
  assert.match(page, /chat-resizable-grid/);
  assert.match(page, /managerUrl: selectedApiConversation\.resolvedLineOaManagerUrl/);
  assert.match(page, /setShowTranslation\(!showTranslation\)/);
  assert.match(page, /resolveSelectedConversation\(/);
  assert.match(page, /requestedRouteConversationIdRef/);
});

test("responsive navigation and workspace rules remain present", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /\.app-primary-nav/);
  assert.match(css, /\.app-workspace-grid/);
  assert.match(css, /html\[data-theme="dark"\]/);
});
