import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { primaryNavigationState } from "../src/app/primary-navigation.ts";

const topNavCode = readFileSync(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");
const contextSidebarCode = readFileSync(new URL("../src/components/shell/context-sidebar.tsx", import.meta.url), "utf8");
const pageContainerCode = readFileSync(new URL("../src/components/shell/page-container.tsx", import.meta.url), "utf8");
const appShellCode = readFileSync(new URL("../src/components/shell/app-shell.tsx", import.meta.url), "utf8");
const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const globalsCode = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const separatorCode = readFileSync(new URL("../src/app/resizable-separator.tsx", import.meta.url), "utf8");

test("TopNavigation renders all 6 primary navigation links with aria-current='page'", () => {
  for (const route of ["/dashboard", "/chats", "/stores", "/classification-insights", "/follower-insights", "/friend-source-links"]) {
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
    classificationInsightsActive: false,
    followerInsightsActive: false,
    friendSourceLinksActive: false,
    showStoreManagementAction: false,
  });
  assert.deepEqual(primaryNavigationState("chats"), {
    dashboardActive: false,
    chatsActive: true,
    storesActive: false,
    classificationInsightsActive: false,
    followerInsightsActive: false,
    friendSourceLinksActive: false,
    showStoreManagementAction: false,
  });
});

test("PageContainer full has min-width: 0, min-height: 0, and flex-1 behavior", () => {
  assert.match(pageContainerCode, /min-h-0 flex-1 flex flex-col min-w-0/);
  assert.doesNotMatch(pageContainerCode, /chat-resizable-grid|gridTemplateColumns|data-chat-pane/);
});

test("TopNavigation title and supporting text use high-contrast semantic tokens", () => {
  assert.match(topNavCode, /<h1 className="text-lg font-bold tracking-tight sm:text-xl">/);
  assert.match(topNavCode, /<p className="app-muted hidden text-xs sm:block">/);
  assert.match(topNavCode, /className="app-header-metadata app-muted/);
  assert.match(topNavCode, /app-header-search app-input/);
  assert.match(contextSidebarCode, /app-muted mb-3/);
});

test("production chats grid has five direct logical children in pane order", () => {
  const gridStart = pageCode.indexOf('className={`app-workspace-grid grid');
  const gridEnd = pageCode.indexOf("\n      </div>\n      </PageContainer>", gridStart);
  const chatGrid = pageCode.slice(gridStart, gridEnd);
  const orderedChildren = [
    "<ContextSidebar",
    'separator="sidebar"',
    'data-chat-pane="conversations"',
    'separator="conversations"',
    'data-chat-pane="detail"',
  ];
  let previousIndex = -1;
  for (const child of orderedChildren) {
    const childIndex = chatGrid.indexOf(child);
    assert.ok(childIndex > previousIndex, `${child} must be a direct logical child in grid order`);
    previousIndex = childIndex;
  }
  assert.doesNotMatch(chatGrid.slice(chatGrid.indexOf('data-chat-pane="conversations"')), /<PageContainer variant="full">/);
});

test("pagination stays inside the conversation-list pane before its resize separator", () => {
  const listStart = pageCode.indexOf('data-chat-pane="conversations"');
  const pagination = pageCode.indexOf("<ConversationPaginationFooter", listStart);
  const listEnd = pageCode.indexOf('separator="conversations"', listStart);
  assert.ok(listStart < pagination && pagination < listEnd);
});

test("production page renders all five desktop grid tracks", () => {
  assert.match(pageCode, /gridTemplateColumns:\s*\`\$\{chatPaneWidths\.sidebar\}px/);
  assert.match(pageCode, /\$\{CHAT_PANE_LIMITS\.separatorWidth\}px \$\{chatPaneWidths\.conversations\}px \$\{CHAT_PANE_LIMITS\.separatorWidth\}px/);
  assert.match(pageCode, /minmax\(\$\{CHAT_PANE_LIMITS\.detailMin\}px,\s*1fr\)/);
  assert.match(separatorCode, /data-chat-separator=\{separator\}/);
});

test("responsive chat rules target identified direct panes", () => {
  assert.match(globalsCode, /\.chat-resizable-grid > \[data-chat-pane="detail"\]/);
  assert.match(globalsCode, /\.chat-resizable-grid > \[data-chat-pane="sidebar"\]/);
  assert.match(globalsCode, /grid-template-columns: 12rem 19rem minmax\(0, 1fr\) !important/);
});

test("SidebarView is shell-owned and unrelated header/sidebar content is retained", () => {
  assert.match(contextSidebarCode, /export type SidebarView/);
  assert.doesNotMatch(contextSidebarCode, /@\/app\/page/);
  assert.match(pageCode, /import type \{ SidebarView \} from "@\/components\/shell"/);
  assert.match(topNavCode, /Notifications \(12 unread\)/);
  assert.match(topNavCode, /User avatar for/);
  assert.match(topNavCode, /🇬🇧 English/);
  assert.match(contextSidebarCode, /\{conversationsCount\}/);
  assert.match(contextSidebarCode, /ร้านค้าทั้งหมด/);
});
