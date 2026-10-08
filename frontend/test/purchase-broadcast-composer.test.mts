import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  mobileMassMessagesPhrases,
  mobileMassMessagesTemplates,
  purchaseBroadcastAudienceStatusLabel,
  purchaseBroadcastMetricLabel,
  purchaseBroadcastMessageabilityLabel,
} from "../src/app/mobile-route-i18n.ts";

const composerCode = readFileSync(
  new URL("../src/app/mass-messages/purchase-broadcast-composer.tsx", import.meta.url),
  "utf8",
);
const bannerCode = readFileSync(
  new URL("../src/app/mass-messages/purchase-broadcast-draft-banner.tsx", import.meta.url),
  "utf8",
);
const routeCode = readFileSync(
  new URL("../src/app/mass-messages/drafts/[campaignId]/draft-responsive.tsx", import.meta.url),
  "utf8",
);
const mobileComposerCode = readFileSync(
  new URL("../src/app/mass-messages/mobile-purchase-broadcast-composer.tsx", import.meta.url),
  "utf8",
);

test("Mass Message surfaces Purchase Intelligence SELECTED_USERS drafts", () => {
  assert.match(bannerCode, /item\.status === "DRAFT"/);
  assert.match(bannerCode, /item\.audienceType === "SELECTED_USERS"/);
  assert.match(bannerCode, /\/mass-messages\/drafts\//);
  assert.match(bannerCode, /No message sent/);
  assert.match(routeCode, /PurchaseBroadcastComposer/);
});

test("composer loads and saves through the dedicated draft-only endpoint", () => {
  assert.match(
    composerCode,
    /\/admin\/purchase-analytics\/audience\/broadcast-draft\/\$\{encodeURIComponent\(campaignId\)\}\/composer/,
  );
  assert.match(composerCode, /method: "PATCH"/);
  assert.match(composerCode, /Save Draft/);
  assert.match(composerCode, /DRAFT ONLY/);
});

test("desktop composer follows and changes the shared application language", () => {
  assert.match(composerCode, /import \{ useAppLanguage \} from "\.\.\/language"/);
  assert.match(composerCode, /const \{ language, setLanguage \} = useAppLanguage\(\)/);
  assert.match(composerCode, /language=\{language\}/);
  assert.match(composerCode, /changeLanguage=\{setLanguage\}/);
  assert.doesNotMatch(composerCode, /language="en"/);
});

test("Purchase Intelligence draft copy localizes its safety and audience labels", () => {
  const phrase = (english: string) => mobileMassMessagesPhrases.find((entry) => entry.en === english);
  assert.deepEqual(phrase("Compose content for the exact saved customer audience. Saving never sends to LINE."), {
    th: "เตรียมเนื้อหาสำหรับกลุ่มลูกค้าที่บันทึกไว้ การบันทึกจะไม่ส่งข้อความผ่าน LINE",
    en: "Compose content for the exact saved customer audience. Saving never sends to LINE.",
    zh: "为已保存的客户群准备内容。保存草稿不会发送到 LINE。",
  });
  assert.equal(purchaseBroadcastMetricLabel("customers", "th"), "ลูกค้า");
  assert.equal(purchaseBroadcastMetricLabel("stores", "zh"), "门店");
  assert.equal(purchaseBroadcastMetricLabel("lineOas", "zh"), "LINE OA 账号");
  assert.equal(phrase("Content")?.th, "เนื้อหา");
  assert.equal(phrase("Content")?.zh, "内容");
  assert.equal(phrase("Preview")?.th, "ดูตัวอย่าง");
  assert.match(mobileComposerCode, /label: "เนื้อหา"/);
  assert.equal(mobileMassMessagesTemplates.find((entry) => entry.en === "{{value}} items")?.th, "{{value}} รายการ");
  assert.match(mobileComposerCode, /purchaseBroadcastAudienceStatusLabel\(status, language\)/);
  assert.match(mobileComposerCode, /purchaseBroadcastMessageabilityLabel\(draft\.audience\.messageabilityDefinition, language\)/);
  assert.match(mobileComposerCode, /Save Draft edits content only\. It does not create deliveries, start the processor, or use LINE quota\./);
});

test("Purchase Intelligence audience enum values show localized labels instead of API codes", () => {
  assert.equal(purchaseBroadcastAudienceStatusLabel("PURCHASED", "th"), "ซื้อแล้ว");
  assert.equal(purchaseBroadcastAudienceStatusLabel("INTERESTED", "en"), "Interested");
  assert.equal(purchaseBroadcastAudienceStatusLabel("ONLINE", "zh"), "在线");
  assert.equal(purchaseBroadcastAudienceStatusLabel("NOT_SPECIFIED", "th"), "ไม่ได้ระบุ");
  assert.equal(purchaseBroadcastAudienceStatusLabel("UNKNOWN_STATUS", "en"), "UNKNOWN_STATUS");
  assert.equal(purchaseBroadcastMessageabilityLabel("LINE_USER_ID_AND_ACTIVE_READY_OA", "th"), "บัญชี LINE พร้อมรับข้อความ");
  assert.equal(purchaseBroadcastMessageabilityLabel("LINE_USER_ID_AND_ACTIVE_READY_OA", "en"), "LINE account is ready to receive messages");
  assert.equal(purchaseBroadcastMessageabilityLabel("LINE_USER_ID_AND_ACTIVE_READY_OA", "zh"), "LINE 账号已准备好接收消息");
  assert.equal(purchaseBroadcastMessageabilityLabel("OTHER_DEFINITION", "en"), "OTHER_DEFINITION");
});

test("composer supports text and existing protected image upload without send execution", () => {
  assert.match(composerCode, /api\.uploadMassMessageImage\(file\)/);
  assert.match(composerCode, /maxLength=\{5000\}/);
  assert.match(composerCode, /Attach image/);
  assert.doesNotMatch(composerCode, /api\.createMassMessage/);
  assert.doesNotMatch(composerCode, /processCampaign/);
});

test("Phase 2B keeps Review and Send explicitly locked", () => {
  assert.match(composerCode, /Send is locked in Phase 2B/);
  assert.match(composerCode, /Review &amp; Send — Locked/);
  assert.match(composerCode, /<button type="button" disabled/);
  assert.match(composerCode, /creates no delivery rows/);
});
