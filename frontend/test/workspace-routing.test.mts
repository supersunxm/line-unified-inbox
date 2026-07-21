import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildChatsHref, readChatRouteFilters } from "../src/app/workspace-routing.ts";

const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

test("chat filter URLs are shareable and restorable", () => {
  const href = buildChatsHref({ store: "store-1", status: "follow-up", priority: "high", topic: "pricing" });
  assert.equal(href, "/chats?storeId=store-1&status=follow-up&priority=high&topic=pricing");
  assert.deepEqual(readChatRouteFilters(href.slice(href.indexOf("?"))), {
    store: "store-1", status: "follow-up", priority: "high", model: undefined,
    topic: "pricing", lineOaId: undefined, conversationId: undefined,
  });
});

test("application exposes three primary routes with active navigation", () => {
  for (const route of ["/dashboard", "/chats", "/stores"]) assert.match(page, new RegExp(`href=\\"${route.replace("?", "\\?")}`));
  assert.match(page, /aria-current=\{primaryNavigation\.chatsActive \? "page"/);
});

test("dashboard links to filtered workspaces and root redirects safely", () => {
  assert.match(page, /\/chats\?status=follow-up/);
  assert.match(page, /\/stores\?status=error/);
  assert.match(page, /window\.location\.replace\("\/dashboard"\)/);
});

test("stores and chats remain focused workspaces", () => {
  assert.match(page, /initialSection === "stores" \? \(/);
  assert.match(page, /initialSection === "dashboard" \? \(/);
  assert.match(page, /grid-cols-\[220px_380px_1fr\]/);
  assert.match(page, /managerUrl: selectedApiConversation\.resolvedLineOaManagerUrl/);
  assert.match(page, /setShowTranslation\(!showTranslation\)/);
});

test("responsive navigation and workspace rules remain present", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /\.app-primary-nav/);
  assert.match(css, /\.app-workspace-grid/);
  assert.match(css, /html\[data-theme="dark"\]/);
});
