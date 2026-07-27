import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { primaryNavigationState } from "../src/app/primary-navigation.ts";

const topNavCode = readFileSync(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");
const contextSidebarCode = readFileSync(new URL("../src/components/shell/context-sidebar.tsx", import.meta.url), "utf8");
const pageContainerCode = readFileSync(new URL("../src/components/shell/page-container.tsx", import.meta.url), "utf8");
const appShellCode = readFileSync(new URL("../src/components/shell/app-shell.tsx", import.meta.url), "utf8");

test("TopNavigation renders all 5 primary navigation links with aria-current='page'", () => {
  for (const route of ["/dashboard", "/chats", "/stores", "/follower-insights", "/friend-source-links"]) {
    assert.match(topNavCode, new RegExp(`href=\\"${route.replace("?", "\\?")}`));
  }
  assert.match(topNavCode, /aria-current=\{currentSection ===/);
  assert.match(topNavCode, /ThemeControl/);
});

test("PageContainer supports readable, wide, and full layout variants", () => {
  assert.match(pageContainerCode, /max-w-7xl/);
  assert.match(pageContainerCode, /max-w-\[1440px\]/);
  assert.match(pageContainerCode, /variant === "full"/);
});

test("ContextSidebar renders status filters and store selection filter list", () => {
  assert.match(contextSidebarCode, /selectSidebarView\("incoming"\)/);
  assert.match(contextSidebarCode, /selectSidebarView\("followUp"\)/);
  assert.match(contextSidebarCode, /selectSidebarView\("reminded"\)/);
  assert.match(contextSidebarCode, /setSelectedStore/);
});

test("AppShell integrates TopNavigation and global loading/error banners", () => {
  assert.match(appShellCode, /<TopNavigation/);
  assert.match(appShellCode, /isLoading/);
  assert.match(appShellCode, /apiError/);
});

test("primaryNavigationState maps active sections correctly", () => {
  assert.deepEqual(primaryNavigationState("dashboard"), {
    dashboardActive: true,
    chatsActive: false,
    storesActive: false,
    followerInsightsActive: false,
    friendSourceLinksActive: false,
    showStoreManagementAction: false,
  });
  assert.deepEqual(primaryNavigationState("chats"), {
    dashboardActive: false,
    chatsActive: true,
    storesActive: false,
    followerInsightsActive: false,
    friendSourceLinksActive: false,
    showStoreManagementAction: false,
  });
});
