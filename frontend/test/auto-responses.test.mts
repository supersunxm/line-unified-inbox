import assert from "node:assert/strict";
import test from "node:test";
import { primaryNavigationState } from "../src/app/primary-navigation.ts";
import type { PrimarySection } from "../src/app/primary-navigation.ts";
import { canAccessPrimarySection } from "../src/lib/authorization.ts";
import { autoResponseI18n } from "../src/app/auto-responses/auto-response-i18n.ts";
import { RICH_MENU_I18N } from "../src/app/rich-menus/rich-menu-i18n.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("PrimarySection type and primaryNavigationState support auto-responses", () => {
  const section: PrimarySection = "auto-responses";
  const state = primaryNavigationState(section);
  assert.equal(state.storesActive, false);
  assert.equal(state.chatsActive, false);
});

test("Auto-response Manager is ADMIN-only and denied for store users or viewers", () => {
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

  assert.equal(canAccessPrimarySection(adminUser, "auto-responses"), true);
  assert.equal(canAccessPrimarySection(storeUser, "auto-responses"), false);
});

test("Auto-response I18N dictionary has required warning copy and translations", () => {
  // Thai
  assert.match(
    autoResponseI18n.th.duplicateWarning,
    /เพื่อป้องกันการตอบซ้ำ ควรปิดข้อความตอบกลับอัตโนมัติที่ทำงานซ้ำกันใน LINE Official Account Manager/,
  );
  assert.match(
    autoResponseI18n.th.activeEditWarning,
    /การแก้ไขข้อความที่เปิดใช้งานอยู่จะมีผลกับ Rich Menu ที่เชื่อมโยงทันที/,
  );

  // English
  assert.match(
    autoResponseI18n.en.duplicateWarning,
    /To avoid duplicate replies, disable overlapping auto-response rules in LINE Official Account Manager/,
  );
  assert.match(
    autoResponseI18n.en.activeEditWarning,
    /Editing active responses takes effect immediately on all linked Rich Menus/,
  );

  // Chinese
  assert.match(
    autoResponseI18n.zh.duplicateWarning,
    /为防止重复回复，请在 LINE Official Account Manager 中关闭重叠的自动回复规则/,
  );
  assert.match(
    autoResponseI18n.zh.activeEditWarning,
    /修改已启用的回复消息将立即对所有关联的 Rich Menu 生效/,
  );
});

test("Rich Menu I18N includes Auto-response action labels in all languages", () => {
  assert.equal(RICH_MENU_I18N.th.actionTypePostbackAutoResponse, "ตอบกลับอัตโนมัติ (Auto-response)");
  assert.equal(RICH_MENU_I18N.en.actionTypePostbackAutoResponse, "Auto-response");
  assert.equal(RICH_MENU_I18N.zh.actionTypePostbackAutoResponse, "自动回复");
});

test("TopNavigation and AppSidebar contain Auto-response Manager routes and icons", () => {
  const topNavFile = readFileSync(
    resolve(process.cwd(), "src/components/shell/top-navigation.tsx"),
    "utf8",
  );
  assert.match(
    topNavFile,
    /"auto-responses":\s*\["ข้อความตอบกลับอัตโนมัติ",\s*"Auto-response",\s*"自动回复"\]/,
  );

  const appSidebarFile = readFileSync(
    resolve(process.cwd(), "src/components/shell/app-sidebar.tsx"),
    "utf8",
  );
  assert.match(appSidebarFile, /href:\s*"\/auto-responses"/);
  assert.match(appSidebarFile, /section:\s*"auto-responses"/);
  assert.match(appSidebarFile, /name === "auto-response"/);
});

test("API client contains all required Auto-response endpoints", () => {
  const apiFile = readFileSync(resolve(process.cwd(), "src/lib/api.ts"), "utf8");
  assert.match(apiFile, /listAutoResponses:/);
  assert.match(apiFile, /getAutoResponse:/);
  assert.match(apiFile, /createAutoResponse:/);
  assert.match(apiFile, /updateAutoResponse:/);
  assert.match(apiFile, /activateAutoResponse:/);
  assert.match(apiFile, /deactivateAutoResponse:/);
  assert.match(apiFile, /archiveAutoResponse:/);
  assert.match(apiFile, /getAutoResponseUsage:/);
  assert.match(apiFile, /previewAutoResponse:/);
});
