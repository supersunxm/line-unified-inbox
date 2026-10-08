import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { primaryNavigationState } from "../src/app/primary-navigation.ts";
import type { PrimarySection } from "../src/app/primary-navigation.ts";
import { canAccessPrimarySection } from "../src/lib/authorization.ts";
import { getGreetingDict } from "../src/app/greeting-messages/greeting-i18n.ts";
import { getGreetingManagementStatusCopy, greetingManagementPhrases, greetingManagementTemplates } from "../src/app/greeting-messages/greeting-management-i18n.ts";
import {
  extractTemplateVariables,
  resolveTemplateVariables,
  validateTemplateVariables,
} from "../src/lib/template-variable-resolver.ts";

test("PrimarySection type and primaryNavigationState support greeting-messages", () => {
  const section: PrimarySection = "greeting-messages";
  const state = primaryNavigationState(section);
  assert.equal(state.storesActive, false);
  assert.equal(state.chatsActive, false);
});

test("Greeting Message Manager is ADMIN-only and denied for store users or viewers", () => {
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
      capabilities: {
        manageAccounts: true,
        reply: true,
        accessMainOa: true,
        manageMainOa: true,
      },
    },
  };

  const storeUser = {
    id: "store-1",
    email: "store@oppo.com",
    displayName: "Store User",
    role: "VIEWER" as const,
    memberships: [{ storeId: "s1", role: "STAFF" }],
    authorization: {
      version: 2,
      identity: { platformRole: "VIEWER" as const, membershipRoles: ["STAFF"] },
      platforms: { web: true, mobile: true },
      workspaces: { hq: false, store: true, mainOa: false },
      scope: { allStores: false, storeIds: ["s1"] },
      capabilities: {
        manageAccounts: false,
        reply: true,
        accessMainOa: false,
        manageMainOa: false,
      },
    },
  };

  assert.equal(canAccessPrimarySection(adminUser, "greeting-messages"), true);
  assert.equal(canAccessPrimarySection(storeUser, "greeting-messages"), false);
});

test("Greeting management status explanations have TH/EN/ZH translations and the route wires its count template", () => {
  const phraseByThai = new Map(greetingManagementPhrases.map((phrase) => [phrase.th, phrase]));
  assert.deepEqual(phraseByThai.get("ยังไม่ได้ใช้งาน"), {
    th: "ยังไม่ได้ใช้งาน",
    en: "Not in use yet",
    zh: "尚未使用",
  });
  assert.deepEqual(phraseByThai.get("ปิดการใช้งาน"), {
    th: "ปิดการใช้งาน",
    en: "Currently disabled",
    zh: "当前已停用",
  });
  assert.deepEqual(phraseByThai.get("เก็บไว้เป็นประวัติ"), {
    th: "เก็บไว้เป็นประวัติ",
    en: "Kept for history",
    zh: "已归档保存",
  });
  assert.deepEqual(greetingManagementTemplates, [{
    th: "ใช้งานอยู่ใน {{value}} ร้าน",
    en: "Active in {{value}} stores",
    zh: "已在 {{value}} 家门店启用",
  }]);

  assert.deepEqual(getGreetingManagementStatusCopy("th", 5), {
    ACTIVE: { title: "ใช้งานอยู่", subtitle: "ใช้งานอยู่ใน 5 ร้าน" },
    DRAFT: { title: "ฉบับร่าง", subtitle: "ยังไม่ได้ใช้งาน" },
    INACTIVE: { title: "ปิดใช้งาน", subtitle: "ปิดการใช้งาน" },
    ARCHIVED: { title: "จัดเก็บเป็นประวัติ", subtitle: "เก็บไว้เป็นประวัติ" },
  });
  assert.deepEqual(getGreetingManagementStatusCopy("en", 5), {
    ACTIVE: { title: "Active", subtitle: "Active in 5 stores" },
    DRAFT: { title: "Draft", subtitle: "Not in use yet" },
    INACTIVE: { title: "Inactive", subtitle: "Currently disabled" },
    ARCHIVED: { title: "Archived", subtitle: "Kept for history" },
  });
  assert.deepEqual(getGreetingManagementStatusCopy("zh", 5), {
    ACTIVE: { title: "启用中", subtitle: "已在 5 家门店启用" },
    DRAFT: { title: "草稿", subtitle: "尚未使用" },
    INACTIVE: { title: "已停用", subtitle: "当前已停用" },
    ARCHIVED: { title: "已归档", subtitle: "已归档保存" },
  });

  const route = readFileSync(new URL("../src/app/greeting-messages/manage/page.tsx", import.meta.url), "utf8");
  assert.match(route, /templates=\{greetingManagementTemplates\}/);
  const view = readFileSync(new URL("../src/app/greeting-messages/greeting-management-view.tsx", import.meta.url), "utf8");
  assert.match(view, /getGreetingManagementStatusCopy\(language, activeStores\)/);
});

test("Greeting I18N dictionary contains duplication warning and send policy copy in TH, EN, ZH", () => {
  const th = getGreetingDict("th");
  const en = getGreetingDict("en");
  const zh = getGreetingDict("zh");

  // Duplication warning banner
  assert.match(th.duplicationWarning, /LINE Official Account Manager/);
  assert.match(en.duplicationWarning, /LINE Official Account Manager/);
  assert.match(zh.duplicationWarning, /LINE 官方账号管理器/);

  // Send policy descriptions
  assert.match(th.sendPolicyFirstTime, /เพิ่มเพื่อนครั้งแรก/);
  assert.match(th.sendPolicyAddAndUnblock, /ปลดบล็อก/);

  assert.match(en.sendPolicyFirstTime, /First-time only/);
  assert.match(en.sendPolicyAddAndUnblock, /Add & Unblock/);

  assert.match(zh.sendPolicyFirstTime, /仅首次加好友/);
  assert.match(zh.sendPolicyAddAndUnblock, /解除拉黑/);
});

test("LINE OA visual layout strings are defined across all supported languages", () => {
  const th = getGreetingDict("th");
  const en = getGreetingDict("en");
  const zh = getGreetingDict("zh");

  assert.equal(th.previewTitle, "ตัวอย่าง");
  assert.equal(th.chatScreen, "หน้าจอแชท");
  assert.equal(th.chatList, "รายการแชท");
  assert.equal(en.previewTitle, "Preview");
  assert.equal(en.chatScreen, "Chat screen");
  assert.equal(en.chatList, "Chat list");
  assert.equal(zh.previewTitle, "预览");
  assert.equal(zh.chatScreen, "聊天界面");
  assert.equal(zh.chatList, "聊天列表");

  // Section headers
  assert.equal(th.sendingRestrictions, "ข้อจำกัดการส่ง");
  assert.equal(en.sendingRestrictions, "Sending restrictions");
  assert.equal(zh.sendingRestrictions, "发送限制");

  assert.equal(th.onlySendFirstTime, "ส่งเฉพาะเพื่อนใหม่ครั้งแรก");
  assert.equal(en.onlySendFirstTime, "Only send for first-time friends");
  assert.equal(zh.onlySendFirstTime, "仅向首次加好友的用户发送");

  assert.equal(th.messageContent, "เนื้อหาข้อความ");
  assert.equal(en.messageContent, "Message content");
  assert.equal(zh.messageContent, "消息内容");

  assert.equal(th.saveTemplate, "บันทึกเทมเพลต");
  assert.equal(en.saveTemplate, "Save template");
  assert.equal(zh.saveTemplate, "保存模板");

  // Status badges and action labels
  assert.match(th.statusActiveBadge(5, 2), /ใช้งานอยู่ · 5 ร้าน · v2/);
  assert.match(en.statusActiveBadge(5, 2), /Active · 5 stores · v2/);
  assert.match(zh.statusActiveBadge(5, 2), /已启用 · 5 家门店 · v2/);

  assert.match(th.statusDraftBadge(1), /แบบร่าง · ยังไม่เปิดใช้งาน · v1/);
  assert.match(en.statusDraftBadge(1), /Draft · Not activated · v1/);
  assert.match(zh.statusDraftBadge(1), /草稿 · 未启用 · v1/);

  assert.match(th.applyToStores(10), /นำไปใช้กับ 10 ร้าน/);
  assert.match(en.applyToStores(1), /Apply to 1 store/);
  assert.match(en.applyToStores(10), /Apply to 10 stores/);
  assert.match(zh.applyToStores(10), /应用到 10 家门店/);

  assert.equal(th.unsavedChanges, "มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก");
  assert.equal(th.basedOnSelectedStore, "อิงจากร้านที่เลือก");
  assert.equal(th.noGreetingAssigned, "ไม่มีข้อความต้อนรับจากระบบนี้");

  // Variable button labels
  assert.equal(th.userDisplayName, "ชื่อผู้ใช้");
  assert.equal(en.userDisplayName, "User's display name");
  assert.equal(zh.userDisplayName, "用户显示名称");

  assert.equal(th.accountName, "ชื่อบัญชี");
  assert.equal(en.accountName, "Account name");
  assert.equal(zh.accountName, "账号名称");

  assert.equal(th.storeName, "ชื่อร้าน");
  assert.equal(en.storeName, "Store name");
  assert.equal(zh.storeName, "门店名称");

  assert.equal(th.googleMaps, "Google Maps");
  assert.equal(en.googleMaps, "Google Maps");
  assert.equal(zh.googleMaps, "Google Maps");
});

test("Frontend variable resolver handles user.displayName and account.name without blocking store readiness", () => {
  const template =
    "สวัสดี {{user.displayName}} ยินดีต้อนรับสู่ {{store.storeName}} ({{account.name}})";
  const extracted = extractTemplateVariables(template);
  assert.deepEqual(extracted.sort(), [
    "account.name",
    "store.storeName",
    "user.displayName",
  ]);

  const storeContext = {
    id: "s1",
    storeName: "OPPO Central Bangna",
    account: { name: "OPPO Store Bangna" },
    user: { displayName: "คุณสมชาย" },
  };

  // Readiness check: user.displayName must NOT cause store readiness to be BLOCKED
  const readiness = validateTemplateVariables(template, storeContext);
  assert.equal(readiness.status, "READY");
  assert.equal(readiness.missingVariables.length, 0);

  // Resolution at runtime
  const resolved = resolveTemplateVariables(template, storeContext);
  assert.equal(
    resolved,
    "สวัสดี คุณสมชาย ยินดีต้อนรับสู่ OPPO Central Bangna (OPPO Store Bangna)",
  );
});

test("greeting page owns vertical scrolling inside full workspace", () => {
  const source = readFileSync(new URL("../src/app/greeting-messages/greeting-messages-view.tsx", import.meta.url), "utf8");
  assert.match(source, /h-full min-h-0 overflow-y-auto bg-white text-gray-900/);
});

test("greeting target stores are directly visible like rich menu targeting", () => {
  const source = readFileSync(new URL("../src/app/greeting-messages/greeting-messages-view.tsx", import.meta.url), "utf8");
  assert.match(source, /data-testid="greeting-store-targeting"/);
  assert.match(source, /handleSelectAllReadyStores/);
  assert.match(source, /handleSelectFilteredReadyStores/);
  assert.match(source, /storeReadinessFilter === value/);
  assert.match(source, /selectedStoreOaIds\.length/);
});

test("greeting preview deterministically follows store selection and handles dirty state", () => {
  const source = readFileSync(new URL("../src/app/greeting-messages/greeting-messages-view.tsx", import.meta.url), "utf8");

  // 1. Preview store resolution follows selection
  assert.match(source, /effectivePreviewStoreId/);
  assert.match(source, /lastSelectedStoreOaId/);
  assert.match(source, /isBasedOnSelectedStore/);
  assert.match(source, /manualPreviewStoreId/);

  // 2. Clear status badges & actions
  assert.match(source, /statusActiveBadge/);
  assert.match(source, /statusDraftBadge/);
  assert.match(source, /statusInactiveBadge/);
  assert.match(source, /handleTemplateStatus/);

  // 3. Button copy and counts
  assert.match(source, /saveTemplate/);
  assert.match(source, /saveAssignments/);
  assert.match(source, /applyToStores|saveAssignments/);

  // 4. Dirty state tracking
  assert.match(source, /isDirty/);
  assert.match(source, /unsavedChanges/);

  // 5. Store status column
  assert.match(source, /colGreetingStatus/);
  assert.match(source, /noGreetingAssigned/);

  // 6. Active edit warning modal
  assert.match(source, /activeEditWarningTitle/);
  assert.match(source, /activeEditWarningMessage/);
});
