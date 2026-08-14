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
const storeChatsOverflowCode = readFileSync(new URL("../src/components/chats/store-chats-overflow-menu.tsx", import.meta.url), "utf8");

test("TopNavigation renders all 8 primary navigation links with aria-current='page'", () => {
  for (const route of [
    "/dashboard",
    "/chats",
    "/stores",
    "/admin/registrations",
    "/classification-insights",
    "/follower-insights",
    "/friend-source-links",
    "/mass-messages",
  ]) {
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

test("ContextSidebar renders bmReplyStatus filters and store selection filter list", () => {
  assert.match(contextSidebarCode, /selectSidebarView\("all"\)/);
  assert.match(contextSidebarCode, /selectSidebarView\("notReplied"\)/);
  assert.match(contextSidebarCode, /selectSidebarView\("notifiedBm"\)/);
  assert.match(contextSidebarCode, /selectSidebarView\("replied"\)/);
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
  assert.match(topNavCode, /<h1 className="text-base font-bold tracking-tight xl:text-lg">/);
  assert.match(topNavCode, /<p className="app-muted hidden text-xs 2xl:block">/);
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

test("SidebarView is shell-owned and profile controls are consolidated", () => {
  assert.match(contextSidebarCode, /export type SidebarView/);
  assert.doesNotMatch(contextSidebarCode, /@\/app\/page/);
  assert.match(pageCode, /import type \{ SidebarView \} from "@\/components\/shell"/);
  assert.doesNotMatch(topNavCode, /Notifications|12 unread|🔔/);
  assert.match(topNavCode, /Open profile menu for/);
  assert.match(topNavCode, /🇬🇧 English/);
  assert.match(topNavCode, /Appearance/);
  assert.match(topNavCode, /Pilot/);
  assert.match(contextSidebarCode, /overview\.notReplied/);
  assert.match(contextSidebarCode, /ร้านค้าทั้งหมด/);
});

test("header responsiveness and menus preserve accessible controls", () => {
  assert.match(topNavCode, /lg:hidden/);
  assert.match(topNavCode, /w-40 lg:block xl:w-48/);
  assert.match(topNavCode, /2xl:hidden/);
  assert.match(topNavCode, /aria-haspopup="dialog"/);
  assert.match(topNavCode, /aria-haspopup="menu"/);
  assert.match(topNavCode, /event\.key === "Escape"/);
  assert.match(topNavCode, /title=\{updatedLabel\}/);
  assert.match(topNavCode, /focus-visible:ring-2/);
});

test("Store Chats owns pane reset in its page-level overflow menu", () => {
  assert.doesNotMatch(topNavCode, /resetPaneSizes/);
  assert.match(pageCode, /<StoreChatsOverflowMenu language=\{language\} resetPaneSizes=\{resetChatPanes\}/);
  assert.match(storeChatsOverflowCode, /Reset pane sizes/);
  assert.match(storeChatsOverflowCode, /resetPaneSizes\(\)/);
  assert.match(storeChatsOverflowCode, /event\.key === "Escape"/);
});

test("TopNavigation search wrapper and controls do not expand invisibly or intercept pointer events over navigation links", () => {
  // Ensure ResponsiveSearch does NOT use lg:flex-1 (which creates an invisible flex area overlapping nav links)
  assert.doesNotMatch(topNavCode, /ref=\{searchRef\}\s+className="[^"]*lg:flex-1/);
  assert.match(topNavCode, /ref=\{searchRef\}\s+className="relative shrink-0"/);

  // Ensure header controls uses shrink-0 and ml-auto instead of expanding across navigation space
  assert.doesNotMatch(topNavCode, /className="app-header-controls[^"]*lg:flex-1/);
  assert.match(topNavCode, /className="app-header-controls flex shrink-0 items-center justify-end gap-2 ml-auto"/);

  // Ensure all 8 navigation items use native <Link> tags with valid hrefs and focus rings
  for (const href of [
    "/dashboard",
    "/chats",
    "/stores",
    "/admin/registrations",
    "/classification-insights",
    "/follower-insights",
    "/friend-source-links",
    "/mass-messages",
  ]) {
    assert.match(topNavCode, new RegExp(`<Link[^>]*href="${href}"`));
  }
});

