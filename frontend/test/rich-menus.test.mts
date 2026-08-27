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

test("Template selector modal contains 12 LINE-style presets organized in Large and Compact groups", () => {
  const viewFile = readFileSync(resolve(process.cwd(), "src/app/rich-menus/rich-menus-view.tsx"), "utf8");

  // 7 Large Presets
  assert.match(viewFile, /"LARGE_6"/);
  assert.match(viewFile, /"LARGE_4"/);
  assert.match(viewFile, /"LARGE_TOP_1_BOTTOM_3"/);
  assert.match(viewFile, /"LARGE_LEFT_1_RIGHT_2"/);
  assert.match(viewFile, /"LARGE_2_ROWS"/);
  assert.match(viewFile, /"LARGE_2_COLS"/);
  assert.match(viewFile, /"LARGE_1"/);

  // 5 Compact Presets
  assert.match(viewFile, /"COMPACT_3"/);
  assert.match(viewFile, /"COMPACT_LEFT_SMALL"/);
  assert.match(viewFile, /"COMPACT_LEFT_LARGE"/);
  assert.match(viewFile, /"COMPACT_2"/);
  assert.match(viewFile, /"COMPACT_1"/);

  // Backward compatibility
  assert.match(viewFile, /GRID_6/);
  assert.match(viewFile, /GRID_4/);
  assert.match(viewFile, /GRID_3/);
  assert.match(viewFile, /CUSTOM/);

  // Dimension displays
  assert.match(viewFile, /templateGroupLarge/);
  assert.match(viewFile, /templateGroupLargeDims/);
  assert.match(viewFile, /templateGroupCompact/);
  assert.match(viewFile, /templateGroupCompactDims/);
});

test("RichMenusView supports multilingual dictionary across Thai, English, and Chinese for 12 presets and image uploads", () => {
  // Thai
  assert.equal(RICH_MENU_I18N.th.pageTitle, "ริชเมนู");
  assert.equal(RICH_MENU_I18N.th.saveDraft, "บันทึกแบบร่าง");
  assert.equal(RICH_MENU_I18N.th.selectTemplateTitle, "เลือกเทมเพลต");
  assert.equal(RICH_MENU_I18N.th.templateGroupLarge, "ขนาดใหญ่");
  assert.equal(RICH_MENU_I18N.th.templateGroupCompact, "แบบกะทัดรัด");
  assert.equal(RICH_MENU_I18N.th.unsupportedFormatError, "รองรับเฉพาะไฟล์ JPG หรือ PNG กรุณาแปลงรูปภาพแล้วลองอีกครั้ง");
  assert.equal(RICH_MENU_I18N.th.aspectRatioMismatchError, "รูปภาพไม่ตรงกับสัดส่วนของเทมเพลตที่เลือก");

  // English
  assert.equal(RICH_MENU_I18N.en.pageTitle, "Rich Menu");
  assert.equal(RICH_MENU_I18N.en.saveDraft, "Save Draft");
  assert.equal(RICH_MENU_I18N.en.selectTemplateTitle, "Select a template");
  assert.equal(RICH_MENU_I18N.en.templateGroupLarge, "Large");
  assert.equal(RICH_MENU_I18N.en.templateGroupCompact, "Compact");
  assert.equal(RICH_MENU_I18N.en.unsupportedFormatError, "Only JPG and PNG images are supported. Please convert the image and try again.");
  assert.equal(RICH_MENU_I18N.en.aspectRatioMismatchError, "The image does not match the aspect ratio of the selected template.");

  // Chinese
  assert.equal(RICH_MENU_I18N.zh.pageTitle, "丰富菜单");
  assert.equal(RICH_MENU_I18N.zh.saveDraft, "保存草稿");
  assert.equal(RICH_MENU_I18N.zh.selectTemplateTitle, "选择模板");
  assert.equal(RICH_MENU_I18N.zh.templateGroupLarge, "大型");
  assert.equal(RICH_MENU_I18N.zh.templateGroupCompact, "紧凑型");
  assert.equal(RICH_MENU_I18N.zh.unsupportedFormatError, "仅支持 JPG 或 PNG 图片，请转换后重试。");
  assert.equal(RICH_MENU_I18N.zh.aspectRatioMismatchError, "图片比例与所选模板不匹配。");

  // Structural & variable placeholders unchanged across languages
  const viewFile = readFileSync(resolve(process.cwd(), "src/app/rich-menus/rich-menus-view.tsx"), "utf8");
  assert.match(viewFile, /\{\{store\.storeName\}\}/);
  assert.match(viewFile, /\{\{store\.googleMapsUrl\}\}/);
  assert.match(viewFile, /\{\{store\.lineUrl\}\}/);
  assert.match(viewFile, /\{\{store\.tiktokUrl\}\}/);
});

test("RichMenusView image upload performs client validation and preserves previous image on failure", () => {
  const viewFile = readFileSync(resolve(process.cwd(), "src/app/rich-menus/rich-menus-view.tsx"), "utf8");
  // Client format and extension validation
  assert.match(viewFile, /isJpegOrPng/);
  assert.match(viewFile, /unsupportedFormatError/);
  assert.match(viewFile, /imageSizeError/);

  // Passes preset to uploadRichMenuImage
  assert.match(viewFile, /uploadRichMenuImage\(file,\s*formPreset\)/);

  // Clear previous error on new selection
  assert.match(viewFile, /setImageError\(null\)/);

  // Single error display without overlapping noImageSelected
  assert.match(viewFile, /imageError \? \(/);
});

test("API client exports Rich Menu Phase 2A canary publish, retry, and rollback methods", () => {
  const apiFile = readFileSync(resolve(process.cwd(), "src/lib/api.ts"), "utf8");
  assert.match(apiFile, /listRichMenuTemplates/);
  assert.match(apiFile, /getRichMenuTemplate/);
  assert.match(apiFile, /createRichMenuTemplate/);
  assert.match(apiFile, /updateRichMenuTemplate/);
  assert.match(apiFile, /deleteRichMenuTemplate/);
  assert.match(apiFile, /previewRichMenuTemplate/);
  assert.match(apiFile, /getRichMenuReadiness/);
  assert.match(apiFile, /saveRichMenuAssignments/);
  assert.match(apiFile, /publishCanaryRichMenu/);
  assert.match(apiFile, /listRichMenuPublishAttempts/);
  assert.match(apiFile, /getRichMenuPublishAttempt/);
  assert.match(apiFile, /retryRichMenuPublish/);
  assert.match(apiFile, /rollbackRichMenuPublish/);
  assert.match(apiFile, /uploadRichMenuImage:\s*\(file:\s*File,\s*preset\?:/);
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

test("RichMenusView enforces simplified single-checkbox store selection and unified publishing rules", () => {
  const viewFile = readFileSync(resolve(process.cwd(), "src/app/rich-menus/rich-menus-view.tsx"), "utf8");

  // Single-checkbox paradigm: publishSelectedOaIds
  assert.match(viewFile, /publishSelectedOaIds/);
  assert.doesNotMatch(viewFile, /assignedOaIds/);
  assert.doesNotMatch(viewFile, /handleSaveAssignments/);
  assert.match(viewFile, /isPublishEligible/);

  // Bulk publish and Rollback modals
  assert.match(viewFile, /isBulkPublishModalOpen/);
  assert.match(viewFile, /isRollbackModalOpen/);
  assert.match(viewFile, /handlePublishBulk/);
  assert.match(viewFile, /handleRollback/);
  assert.match(viewFile, /handleRetrySingle/);

  // Active Job progress card
  assert.match(viewFile, /activeJob/);
  assert.match(viewFile, /handleCancelJob/);
  assert.match(viewFile, /handleRetryFailedJob/);
  assert.match(viewFile, /capabilities/);

  // Target stores table contains single checkbox column and Publish status column
  assert.match(viewFile, /colSelectCheckbox/);
  assert.doesNotMatch(viewFile, /colAssignCheckbox/);
  assert.match(viewFile, /colPublishStatus/);
  assert.match(viewFile, /statusPublished/);
  assert.match(viewFile, /statusCurrentVersionPublished/);
  assert.match(viewFile, /statusHasNewVersion/);
  assert.match(viewFile, /statusFailed/);
  assert.match(viewFile, /statusSkipped/);
  assert.match(viewFile, /statusCancelled/);
  assert.match(viewFile, /statusRolledBack/);
  assert.match(viewFile, /rollbackButton/);
  assert.match(viewFile, /retryPublishButton/);

  // Default display behavior selector supports show / collapse
  assert.match(viewFile, /formSelected === true/);
  assert.match(viewFile, /formSelected === false/);
  assert.match(viewFile, /behaviorShow/);
  assert.match(viewFile, /behaviorCollapsed/);
});

test("Rich Menu i18n dictionary supports Phase 2A/2B publishing, rollback, and status messages across th, en, and zh", () => {
  // Thai
  assert.equal(RICH_MENU_I18N.th.publishToLine, "เผยแพร่ไปยัง LINE");
  assert.equal(RICH_MENU_I18N.th.publishCanaryModalTitle, "เผยแพร่ริชเมนูไปยัง LINE?");
  assert.equal(RICH_MENU_I18N.th.bulkPublishModalTitle, "เผยแพร่ริชเมนูไปยังหลายร้านค้า?");
  assert.equal(RICH_MENU_I18N.th.confirmAndPublish, "ยืนยันและเผยแพร่");
  assert.equal(RICH_MENU_I18N.th.rollbackButton, "ย้อนกลับริชเมนู");
  assert.equal(RICH_MENU_I18N.th.statusPublished, "● เผยแพร่แล้ว");
  assert.equal(RICH_MENU_I18N.th.jobStatusQueued, "อยู่ในคิวรอประมวลผล");
  assert.equal(RICH_MENU_I18N.th.cancelJobButton, "ยกเลิกงานเผยแพร่");

  // English
  assert.equal(RICH_MENU_I18N.en.publishToLine, "Publish to LINE");
  assert.equal(RICH_MENU_I18N.en.publishCanaryModalTitle, "Publish Rich Menu to LINE?");
  assert.equal(RICH_MENU_I18N.en.bulkPublishModalTitle, "Publish Rich Menu to Multiple Stores?");
  assert.equal(RICH_MENU_I18N.en.confirmAndPublish, "Confirm and Publish");
  assert.equal(RICH_MENU_I18N.en.rollbackButton, "Rollback");
  assert.equal(RICH_MENU_I18N.en.statusPublished, "● Published");
  assert.equal(RICH_MENU_I18N.en.jobStatusQueued, "Queued in background");
  assert.equal(RICH_MENU_I18N.en.cancelJobButton, "Cancel Job");
  assert.equal(RICH_MENU_I18N.en.retryFailedButton, "Retry Failed Stores Only");

  // Chinese
  assert.equal(RICH_MENU_I18N.zh.publishToLine, "发布至 LINE");
  assert.equal(RICH_MENU_I18N.zh.publishCanaryModalTitle, "发布丰富菜单至 LINE？");
  assert.equal(RICH_MENU_I18N.zh.bulkPublishModalTitle, "发布丰富菜单至多家门店？");
  assert.equal(RICH_MENU_I18N.zh.confirmAndPublish, "确认并发布");
  assert.equal(RICH_MENU_I18N.zh.rollbackButton, "回滚菜单");
  assert.equal(RICH_MENU_I18N.zh.statusPublished, "● 已发布");
  assert.equal(RICH_MENU_I18N.zh.jobStatusQueued, "排队中");
  assert.equal(RICH_MENU_I18N.zh.cancelJobButton, "取消任务");
});
