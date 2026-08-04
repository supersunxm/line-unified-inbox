import assert from "node:assert/strict";
import test from "node:test";
import { applyTranslationGlossary, TranslationGlossaryService } from "./translation-glossary.service";

test("Google-style corrupted Chinese feature names are restored", () => {
  assert.equal(applyTranslationGlossary("AI 消除功能支持吗？也有 AI 工作室吗？", "zh"), "AI Eraser功能支持吗？也有 AI Studio吗？");
});

test("OPPO product names retain canonical spelling", () => {
  assert.equal(
    applyTranslationGlossary("Oppo Reno 16 Pro, Find X9 Professional, and Oppo Pad", "en"),
    "OPPO Reno16 Pro, Find X9 Pro, and OPPO Pad",
  );
  assert.equal(applyTranslationGlossary("欧珀 Reno16专业版 和 OPPO手表", "zh"), "OPPO Reno16 Pro 和 OPPO Watch");
});

test("technology names retain canonical spelling", () => {
  const input = "Color OS, Super Vooc, Air Vooc, AI eraser, AI studio, Ufs, and Amoled";
  assert.equal(applyTranslationGlossary(input, "en"), "ColorOS, SUPERVOOC, AirVOOC, AI Eraser, AI Studio, UFS, and AMOLED");
});

test("Simplified Chinese retail terminology is normalized", () => {
  const input = "支持分期和首付款，可门店提货；推广期间提供质保和修理，存货充足。";
  assert.equal(applyTranslationGlossary(input, "zh"), "支持分期付款和首付，可到店取货；促销期间提供保修和维修，库存充足。");
  assert.equal(applyTranslationGlossary("我可以网上订购，然后到店自提吗？", "zh"), "我可以网上订购，然后到店取货吗？");
});

test("unrelated sentences remain unchanged", () => {
  const english = "The customer asked for a guarantee that repair service is available today.";
  const chinese = "顾客询问黑色机型今天是否有货。";
  assert.equal(applyTranslationGlossary(english, "en"), english);
  assert.equal(applyTranslationGlossary(chinese, "zh"), chinese);
});

test("placeholder normalization is stable and prevents cascading replacements", () => {
  const service = new TranslationGlossaryService();
  const input = "已经支持到店取货和分期付款，也支持 AI Eraser。";
  assert.equal(service.apply(input, "zh"), input);
  assert.equal(service.apply(service.apply(input, "zh"), "zh"), input);
});
