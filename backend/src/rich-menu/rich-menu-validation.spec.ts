import assert from "node:assert/strict";
import test from "node:test";
import {
  collectRichMenuPreflightReasons,
  RichMenuValidationRule,
  RichMenuValidationTarget,
} from "./rich-menu-validation";

const target = (overrides: Partial<RichMenuValidationTarget> = {}): RichMenuValidationTarget => ({
  id: "oa-1",
  name: "Store OA",
  accountType: "STORE",
  isActive: true,
  archivedAt: null,
  encryptedChannelAccessToken: "encrypted-token",
  store: {
    id: "store-1",
    name: "Store One",
    code: "S001",
    area: "Bangkok",
    region: "Central",
    storeMaster: {
      externalStoreId: "S001",
      accountName: "Store OA",
      lineOaLink: null,
      lineId: null,
      lineManagerUrl: null,
      tiktokUsername: "oppo_store",
      tiktokProfileUrl: "https://www.tiktok.com/@oppo_store",
      googleMapsUrl: "https://maps.app.goo.gl/store-one",
      province: "Bangkok",
      region: "Central",
    },
  },
  ...overrides,
});

const template = (areas: unknown[]) => ({
  imageUrl: "https://lineoppo.click/messages/media/public?key=line-media/outbound/rich-menu/image.png",
  width: 2500,
  height: 1686,
  areasJson: areas,
});

const uri = (actionData: string, id = actionData) => ({
  id,
  bounds: { x: 0, y: 0, width: 1250, height: 843 },
  actionType: "URI" as const,
  actionData,
});

test("preflight reports missing Google Maps URL only", () => {
  const store = target();
  store.store!.storeMaster!.googleMapsUrl = null;
  const reasons = collectRichMenuPreflightReasons({
    template: template([uri("{{store.googleMapsUrl}}")]),
    targetOa: store,
    autoResponseRules: [],
  });

  assert.deepEqual(reasons, ["ไม่มี Google Maps URL"]);
});

test("preflight reports missing TikTok URL only", () => {
  const store = target();
  store.store!.storeMaster!.tiktokProfileUrl = null;
  const reasons = collectRichMenuPreflightReasons({
    template: template([uri("{{store.tiktokUrl}}")]),
    targetOa: store,
    autoResponseRules: [],
  });

  assert.deepEqual(reasons, ["ไม่มี TikTok URL"]);
});

test("preflight accumulates missing Maps and TikTok reasons", () => {
  const store = target();
  store.store!.storeMaster!.googleMapsUrl = null;
  store.store!.storeMaster!.tiktokProfileUrl = null;
  const reasons = collectRichMenuPreflightReasons({
    template: template([uri("{{store.googleMapsUrl}}", "maps"), uri("{{store.tiktokUrl}}", "tiktok")]),
    targetOa: store,
    autoResponseRules: [],
  });

  assert.deepEqual(reasons, ["ไม่มี Google Maps URL", "ไม่มี TikTok URL"]);
});

test("preflight reports an invalid TikTok URL", () => {
  const store = target();
  store.store!.storeMaster!.tiktokProfileUrl = "not-a-tiktok-url";
  const reasons = collectRichMenuPreflightReasons({
    template: template([uri("{{store.tiktokUrl}}")]),
    targetOa: store,
    autoResponseRules: [],
  });

  assert.deepEqual(reasons, ["TikTok URL ไม่ถูกต้อง"]);
});

test("preflight accumulates inactive OA and missing token", () => {
  const reasons = collectRichMenuPreflightReasons({
    template: template([uri("https://example.com/store")]),
    targetOa: target({ isActive: false, encryptedChannelAccessToken: null }),
    autoResponseRules: [],
  });

  assert.ok(reasons.includes("LINE OA ถูกปิดใช้งาน"));
  assert.ok(reasons.includes("LINE OA ไม่มี Channel Access Token"));
  assert.equal(reasons.length, 2);
});

test("preflight reports inactive auto-response and unresolved variables", () => {
  const rule: RichMenuValidationRule = {
    id: "rule-1",
    name: "Store Info",
    status: "INACTIVE",
    textTemplate: "ดูข้อมูล {{store.unknownField}}",
    contentJson: null,
  };
  const reasons = collectRichMenuPreflightReasons({
    template: template([
      {
        id: "auto-response",
        bounds: { x: 0, y: 0, width: 2500, height: 1686 },
        actionType: "POSTBACK_AUTO_RESPONSE" as const,
        actionData: "oppo_ar:v1:rule-1",
      },
    ]),
    targetOa: target(),
    autoResponseRules: [rule],
  });

  assert.ok(reasons.includes('Auto-response "Store Info" ยังไม่ได้เปิดใช้งาน'));
  assert.ok(reasons.includes("ข้อมูลร้านไม่ครบ: {{store.unknownField}}"));
});

test("preflight reports an unresolved dynamic URI variable", () => {
  const reasons = collectRichMenuPreflightReasons({
    template: template([uri("{{store.unknownUrl}}")]),
    targetOa: target(),
    autoResponseRules: [],
  });

  assert.ok(reasons.includes("ข้อมูลร้านไม่ครบ: {{store.unknownUrl}}"));
  assert.equal(reasons.some((reason) => reason.includes("ต้องขึ้นต้นด้วย http:// หรือ https://")), false);
});

test("preflight reports a resolved URI without an HTTP scheme", () => {
  const reasons = collectRichMenuPreflightReasons({
    template: template([uri("store.example.com")]),
    targetOa: target(),
    autoResponseRules: [],
  });

  assert.ok(reasons.some((reason) => reason.includes("ต้องขึ้นต้นด้วย http:// หรือ https://")));
});
