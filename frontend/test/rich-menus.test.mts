import assert from "node:assert/strict";
import test from "node:test";
import { primaryNavigationState } from "../src/app/primary-navigation.ts";
import type { PrimarySection } from "../src/app/primary-navigation.ts";
import { canAccessPrimarySection } from "../src/lib/authorization.ts";
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

test("RichMenusView defines Phase 1 boundary, token insertion, preset layouts, and Phase 2 publish lock", () => {
  const viewFile = readFileSync(resolve(process.cwd(), "src/app/rich-menus/rich-menus-view.tsx"), "utf8");
  // Phase 1 guarantees
  assert.match(viewFile, /Phase 1: Template & Readiness Preview/);
  assert.match(viewFile, /Publishing available in Phase 2/);
  assert.match(viewFile, /Phase 1 is Management \+ Template \+ Preview \+ Readiness only/);

  // Layout presets
  assert.match(viewFile, /GRID_6/);
  assert.match(viewFile, /GRID_3/);
  assert.match(viewFile, /GRID_4/);
  assert.match(viewFile, /CUSTOM/);

  // Token variables
  assert.match(viewFile, /\{\{store\.storeName\}\}/);
  assert.match(viewFile, /\{\{store\.googleMapsUrl\}\}/);
  assert.match(viewFile, /\{\{store\.lineUrl\}\}/);
  assert.match(viewFile, /\{\{store\.tiktokUrl\}\}/);

  // Store readiness actions
  assert.match(viewFile, /Select All Ready/);
  assert.match(viewFile, /Save Assigned Stores/);
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
