import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const dashboardPageCode = readFileSync(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8");
const chatsPageCode = readFileSync(new URL("../src/app/chats/page.tsx", import.meta.url), "utf8");
const storesPageCode = readFileSync(new URL("../src/app/stores/page.tsx", import.meta.url), "utf8");
const classificationInsightsPageCode = readFileSync(new URL("../src/app/classification-insights/page.tsx", import.meta.url), "utf8");
const followerInsightsPageCode = readFileSync(new URL("../src/app/follower-insights/page.tsx", import.meta.url), "utf8");
const friendSourceLinksPageCode = readFileSync(new URL("../src/app/friend-source-links/page.tsx", import.meta.url), "utf8");
const topNavCode = readFileSync(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");
const sidebarCode = readFileSync(new URL("../src/components/shell/app-sidebar.tsx", import.meta.url), "utf8");

test("all workspace route entrypoints delegate to ApplicationWorkspace with matching section key", () => {
  assert.match(dashboardPageCode, /ApplicationWorkspace initialSection="dashboard"/);
  assert.match(chatsPageCode, /ApplicationWorkspace initialSection="chats"/);
  assert.match(storesPageCode, /ApplicationWorkspace initialSection="stores"/);
  assert.match(classificationInsightsPageCode, /ApplicationWorkspace initialSection="classification-insights"/);
  assert.match(followerInsightsPageCode, /ApplicationWorkspace initialSection="follower-insights"/);
  assert.match(friendSourceLinksPageCode, /ApplicationWorkspace initialSection="friend-source-links"/);
});

test("production route tree renders AppShell and TopNavigation as the single global navigation landmark", () => {
  // Page renders AppShell at top level
  assert.match(pageCode, /<AppShell/);
  // Page does NOT render legacy header markup
  assert.doesNotMatch(pageCode, /<header className="app-header/);
  // Only one global navigation header element exists in the rendered tree
  const headerTagCount = (topNavCode.match(/<header/g) || []).length;
  assert.equal(headerTagCount, 1, "Only one global header element must exist in top navigation");
});

test("production chats route renders ContextSidebar and non-chats routes omit contextual sidebar", () => {
  // Chats branch renders ContextSidebar
  assert.match(pageCode, /initialSection === "chats" && \([\s\S]*<ContextSidebar/);
  
  // Ensure legacy permanent 220px sidebar is removed
  assert.doesNotMatch(pageCode, /<aside className="app-surface min-w-0 overflow-y-auto border-r p-4">/);
});

test("sidebar links retain their canonical workspace destinations", () => {
  const routes = ["/home", "/dashboard", "/chats", "/follower-insights", "/classification-insights", "/stores", "/friend-source-links"];
  for (const route of routes) {
    assert.match(sidebarCode, new RegExp(`href: "${route}"`));
  }
});

test("TopNavigation consolidates account, theme, language, and logout controls", () => {
  assert.match(topNavCode, /ThemeControl/);
  assert.match(topNavCode, /setSearchText/);
  assert.match(topNavCode, /changeLanguage/);
  assert.match(topNavCode, /logout/);
  assert.match(topNavCode, /authUser\.displayName/);
  assert.doesNotMatch(topNavCode, /Notifications|12 unread|🔔/);
});
