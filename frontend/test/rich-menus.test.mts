import assert from "node:assert/strict";
import test from "node:test";
import { primaryNavigationState } from "../src/app/primary-navigation.ts";
import type { PrimarySection } from "../src/app/primary-navigation.ts";
import { canAccessPrimarySection } from "../src/lib/authorization.ts";
import { RICH_MENU_I18N } from "../src/app/rich-menus/rich-menu-i18n.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("PrimarySection type and primaryNavigationState support rich-menus", () => {
  const section: PrimarySection = "rich-menus";
  const state = primaryNavigationState(section);
  assert.equal(state.storesActive, false);
  assert.equal(state.chatsActive, false);
});

test("Rich Menu Manager is ADMIN-only and denied for store users or viewers", () => {
  const adminUser = {
    id: "admin-1",
    email: "admin@oppo.com",
    displayName: "Admin",
    role: "ADMIN" as const,
    authorization: {
      version: 2,
      identity: { platformRole: "ADMIN" as const, membershipRoles: [] },
      platforms: { web: true, mobile: true },
      workspaces: { hq: true, store: false, mainOa: true },
      scope: { allStores: true, storeIds: [] },
      capabilities: { manageAccounts: true, reply: true, accessMainOa: true, manageMainOa: true },
    },
  };

  const storeUser = {
    id: "store-1",
    email: "store@oppo.com",
    displayName: "Store",
    role: "VIEWER" as const,
    memberships: [{ storeId: "s1", role: "STAFF" }],
    authorization: {
      version: 2,
      identity: { platformRole: "VIEWER" as const, membershipRoles: ["STAFF"] },
      platforms: { web: true, mobile: true },
      workspaces: { hq: false, store: true, mainOa: false },
      scope: { allStores: false, storeIds: ["s1"] },
      capabilities: { manageAccounts: false, reply: true, accessMainOa: false, manageMainOa: false },
    },
  };

  assert.equal(canAccessPrimarySection(adminUser, "rich-menus"), true);
  assert.equal(canAccessPrimarySection(storeUser, "rich-menus"), false);
});

test("TopNavigation and AppSidebar contain Rich Menu Manager routes and icons", () => {
  const topNavFile = readFileSync(resolve(process.cwd(), "src/components/shell/top-navigation.tsx"), "utf8");
  assert.match(topNavFile, /"rich-menus":\s*\["จัดการ Rich Menu",\s*"Rich Menu Manager",\s*"Rich Menu 管理"\]/);

  const appSidebarFile = readFileSync(resolve(process.cwd(), "src/components/shell/app-sidebar.tsx"), "utf8");
  assert.match(appSidebarFile, /href:\s*"\/rich-menus"/);
  assert.match(appSidebarFile, /section:\s*"rich-menus"/);
  assert.match(appSidebarFile, /name === "rich-menu"/);
});

test("RichMenusView supports multilingual dictionary across Thai, English, and Chinese", () => {
  // Thai
  assert.equal(RICH_MENU_I18N.th.pageTitle, "ริชเมนู");
  assert.equal(RICH_MENU_I18N.th.saveDraft, "บันทึกแบบร่าง");
  assert.equal(RICH_MENU_I18N.th.mainSettings, "การตั้งค่าหลัก");
  assert.equal(RICH_MENU_I18N.th.title, "ชื่อริชเมนู");
  assert.equal(RICH_MENU_I18N.th.menuContent, "เนื้อหาเมนู");
  assert.equal(RICH_MENU_I18N.th.preview, "ตัวอย่าง");
  assert.equal(RICH_MENU_I18N.th.targetStores, "ร้านเป้าหมาย");
  assert.equal(RICH_MENU_I18N.th.selectAllReady, "เลือกร้านที่พร้อมทั้งหมด");
  assert.equal(RICH_MENU_I18N.th.missingGoogleMapsReason, "ไม่มีลิงก์ Google Maps");

  // English
  assert.equal(RICH_MENU_I18N.en.pageTitle, "Rich Menu");
  assert.equal(RICH_MENU_I18N.en.saveDraft, "Save Draft");
  assert.equal(RICH_MENU_I18N.en.mainSettings, "Main settings");
  assert.equal(RICH_MENU_I18N.en.title, "Title");
  assert.equal(RICH_MENU_I18N.en.menuContent, "Menu content");
  assert.equal(RICH_MENU_I18N.en.preview, "Preview");
  assert.equal(RICH_MENU_I18N.en.targetStores, "Target stores");
  assert.equal(RICH_MENU_I18N.en.selectAllReady, "Select all ready");
  assert.equal(RICH_MENU_I18N.en.missingGoogleMapsReason, "Missing Google Maps URL");

  // Chinese
  assert.equal(RICH_MENU_I18N.zh.pageTitle, "丰富菜单");
  assert.equal(RICH_MENU_I18N.zh.saveDraft, "保存草稿");
  assert.equal(RICH_MENU_I18N.zh.mainSettings, "主要设置");
  assert.equal(RICH_MENU_I18N.zh.title, "菜单名称");
  assert.equal(RICH_MENU_I18N.zh.menuContent, "菜单内容");
  assert.equal(RICH_MENU_I18N.zh.preview, "预览");
  assert.equal(RICH_MENU_I18N.zh.targetStores, "目标门店");
  assert.equal(RICH_MENU_I18N.zh.selectAllReady, "选择全部可用门店");
  assert.equal(RICH_MENU_I18N.zh.missingGoogleMapsReason, "缺少 Google Maps 链接");

  // Structural & variable placeholders unchanged across languages
  const viewFile = readFileSync(resolve(process.cwd(), "src/app/rich-menus/rich-menus-view.tsx"), "utf8");
  assert.match(viewFile, /\{\{store\.storeName\}\}/);
  assert.match(viewFile, /\{\{store\.googleMapsUrl\}\}/);
  assert.match(viewFile, /\{\{store\.lineUrl\}\}/);
  assert.match(viewFile, /\{\{store\.tiktokUrl\}\}/);
});

test("API client exports Rich Menu template and readiness methods", () => {
  const apiFile = readFileSync(resolve(process.cwd(), "src/lib/api.ts"), "utf8");
  assert.match(apiFile, /listRichMenuTemplates/);
  assert.match(apiFile, /getRichMenuTemplate/);
  assert.match(apiFile, /createRichMenuTemplate/);
  assert.match(apiFile, /updateRichMenuTemplate/);
  assert.match(apiFile, /deleteRichMenuTemplate/);
  assert.match(apiFile, /previewRichMenuTemplate/);
  assert.match(apiFile, /getRichMenuReadiness/);
  assert.match(apiFile, /saveRichMenuAssignments/);
  assert.match(apiFile, /uploadRichMenuImage/);
});

test("RichMenusView enables vertical page scrolling while preserving chats fixed-height layout", () => {
  const viewFile = readFileSync(resolve(process.cwd(), "src/app/rich-menus/rich-menus-view.tsx"), "utf8");
  // Asserts rich-menus has scrollable root container with sticky header
  assert.match(viewFile, /data-rich-menus-scroll/);
  assert.match(viewFile, /overflow-y-auto/);
  assert.match(viewFile, /flex-1 min-h-0/);
  assert.match(viewFile, /sticky top-0/);

  // Asserts /chats maintains its dedicated single-screen layout and scrolling rules
  const pageFile = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
  assert.match(pageFile, /data-chat-pane="conversations"/);
  assert.match(pageFile, /data-chat-message-scroll/);
});
