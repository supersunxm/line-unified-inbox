import assert from "node:assert/strict";
import test from "node:test";
import { CustomerVoiceAnalysisSource } from "@prisma/client";
import { automaticCatalogAliases } from "../classification/product-catalog";
import { matchProducts, type MatchableModel } from "../classification/product-matcher";
import { buildCustomerVoiceAnalysis, matchCustomerVoiceProducts, normalizeCustomerVoiceProductText } from "./customer-voice-analyzer";

const models: MatchableModel[] = [
  {
    id: "reno-family",
    name: "OPPO Reno Series",
    classificationLevel: "FAMILY",
    priority: 1,
    aliases: [{ alias: "Reno", safety: "SAFE_EXACT", priority: 0 }],
    productSeries: { name: "Reno", productGroup: "SMARTPHONE" },
  },
  {
    id: "reno-16",
    name: "OPPO Reno16",
    classificationLevel: "MODEL",
    priority: 1,
    aliases: automaticCatalogAliases({ model: "OPPO Reno16", level: "MODEL", family: "Reno", group: "SMARTPHONE", priority: 1, aliases: [] }).map(({ alias, safety, language }) => ({ alias, safety, language, priority: 0 })),
    productSeries: { name: "Reno", productGroup: "SMARTPHONE" },
  },
  {
    id: "find-x9",
    name: "OPPO Find X9",
    classificationLevel: "MODEL",
    priority: 1,
    aliases: [{ alias: "Find X9", safety: "SAFE_EXACT", priority: 0 }],
    productSeries: { name: "Find", productGroup: "SMARTPHONE" },
  },
];

const inbound = (id: string, text: string, sentAt = "2026-09-10T01:00:00.000Z") => ({ id, originalText: text, sentAt: new Date(sentAt) });

test("Customer Voice analyzes multiple inbound bubbles once and preserves multiple signals", () => {
  const messages = [inbound("m-1", "ราคา OPPO Reno16 มีของไหม"), inbound("m-2", "เทียบกับ Find X9 ให้หน่อย")];
  const matches = matchProducts(messages.map(({ id, originalText, sentAt }) => ({ id, text: originalText, sentAt })), models);
  const result = buildCustomerVoiceAnalysis(messages, [], matches);

  assert.equal(result.inputMessageCount, 2);
  assert.equal(result.source, CustomerVoiceAnalysisSource.RULE_ENRICHED);
  assert.equal(result.primaryTopic, "Stock Availability");
  assert.deepEqual(result.secondaryTopics, ["Price Inquiry", "Product Information"]);
  assert.equal(result.intent, "STOCK_CHECK");
  assert.deepEqual(result.productMentions, ["OPPO Reno16", "OPPO Find X9"]);
  assert.match(result.summary ?? "", /OPPO Reno16/);
  assert.doesNotMatch(result.summary ?? "", /ราคา OPPO/);
});

test("existing persisted topics remain read-only and are marked as existing or mixed enrichment", () => {
  const existingOnly = buildCustomerVoiceAnalysis([inbound("m-1", "ขอข้อมูล")], [{ name: "Price Inquiry", confidence: 0.8 }], []);
  assert.equal(existingOnly.source, CustomerVoiceAnalysisSource.EXISTING_TOPIC);
  assert.equal(existingOnly.primaryTopic, "Price Inquiry");

  const mixed = buildCustomerVoiceAnalysis([inbound("m-2", "ราคา OPPO Reno16 มีของไหม")], [{ name: "Price Inquiry", confidence: 0.8 }], matchProducts([inbound("m-2", "ราคา OPPO Reno16 มีของไหม")].map(({ id, originalText, sentAt }) => ({ id, text: originalText, sentAt })), models));
  assert.equal(mixed.source, CustomerVoiceAnalysisSource.MIXED_ENRICHED);
  assert.equal(mixed.primaryTopic, "Stock Availability");
});

test("messages with no topic, intent, or normalized product are persisted as unclassified", () => {
  const result = buildCustomerVoiceAnalysis([inbound("m-1", "question about my account")], [], []);
  assert.equal(result.source, CustomerVoiceAnalysisSource.UNCLASSIFIED);
  assert.equal(result.primaryTopic, null);
  assert.equal(result.intent, null);
  assert.equal(result.confidence, null);
  assert.equal(result.summary, null);
});

test("existing topic aliases map to canonical analytics categories", () => {
  const result = buildCustomerVoiceAnalysis([inbound("m-1", "ขอบคุณ")], [{ name: "Installment", confidence: 0.85 }, { name: "Model Comparison", confidence: 0.75 }], []);
  assert.equal(result.primaryTopic, "Installment / Payment");
  assert.deepEqual(result.secondaryTopics, ["Product Information"]);
  assert.equal(result.source, CustomerVoiceAnalysisSource.EXISTING_TOPIC);
});

test("pilot gap phrases are classified conservatively without treating acknowledgements as signals", () => {
  const payment = buildCustomerVoiceAnalysis([inbound("m-1", "สอบถามเงินดาวน์ค่ะ ขอบคุณ")], [], []);
  assert.equal(payment.primaryTopic, "Installment / Payment");
  assert.equal(payment.intent, "PAYMENT_INQUIRY");

  const contact = buildCustomerVoiceAnalysis([inbound("m-2", "ขอเบอร์ติดต่อร้านค่ะ")], [], []);
  assert.equal(contact.primaryTopic, "Store Contact");
  assert.equal(contact.intent, "INFORMATION");

  const productQuestion = buildCustomerVoiceAnalysis([inbound("m-3", "มีรุ่นไหนบ้างคะ")], [], []);
  assert.equal(productQuestion.primaryTopic, "Product Information");
  assert.equal(productQuestion.intent, "INFORMATION");

  const acknowledgement = buildCustomerVoiceAnalysis([inbound("m-4", "ขอบคุณค่ะ")], [], []);
  assert.equal(acknowledgement.source, CustomerVoiceAnalysisSource.UNCLASSIFIED);

  assert.equal(buildCustomerVoiceAnalysis([inbound("m-5", "ใช้บัตรอะไรได้บ้าง")], [], []).intent, "PAYMENT_INQUIRY");
  assert.equal(buildCustomerVoiceAnalysis([inbound("m-6", "ให้ทางร้านโทรกลับได้ไหม")], [], []).primaryTopic, "Store Contact");
  assert.equal(buildCustomerVoiceAnalysis([inbound("m-7", "แนะนำมือถือหน่อยค่ะ")], [], []).primaryTopic, "Product Information");
});

test("an exact product model suppresses its redundant family match", () => {
  const message = inbound("m-1", "สนใจ OPPO Reno16");
  const matches = matchProducts([{ id: message.id, text: message.originalText, sentAt: message.sentAt }], models);
  const result = buildCustomerVoiceAnalysis([message], [], matches);
  assert.deepEqual(result.productMentions, ["OPPO Reno16"]);
});

test("v3 recognizes reusable Thai retail phrasing without classifying bare acknowledgements", () => {
  assert.equal(buildCustomerVoiceAnalysis([inbound("m-1", "ยังมีเครื่องพร้อมส่งไหมคะ")], [], []).primaryTopic, "Stock Availability");
  assert.equal(buildCustomerVoiceAnalysis([inbound("m-2", "ขอรายละเอียดเพิ่มเติมของรุ่นนี้ค่ะ")], [], []).primaryTopic, "Product Information");
  assert.equal(buildCustomerVoiceAnalysis([inbound("m-3", "ร้านอยู่ตรงไหน เปิดกี่โมงคะ")], [], []).primaryTopic, "Store Location / Opening Hours");
  assert.equal(buildCustomerVoiceAnalysis([inbound("m-4", "สนใจรุ่นนี้ อยากได้ข้อมูลค่ะ")], [], []).intent, "PURCHASE_CONSIDERATION");
  assert.equal(buildCustomerVoiceAnalysis([inbound("m-5", "ขอบคุณค่ะ")], [], []).source, CustomerVoiceAnalysisSource.UNCLASSIFIED);
});

test("v3 preserves topic precedence for meaningful business needs", () => {
  const result = buildCustomerVoiceAnalysis([inbound("m-1", "ราคาเท่าไหร่ ผ่อนเดือนละเท่าไหร่")], [], []);
  assert.equal(result.primaryTopic, "Installment / Payment");
  assert.deepEqual(result.secondaryTopics, ["Price Inquiry"]);
});

test("v3 normalizes Thai brand/model boundaries for matching without inventing a model", () => {
  assert.equal(normalizeCustomerVoiceProductText("ออปโป้รีโน16"), "ออปโป้ รีโน16");
  assert.equal(normalizeCustomerVoiceProductText("ออปโป้ Reno16"), "ออปโป้ Reno16");
});

test("v3 recovers a Reno family only for a business-context phrase", () => {
  const family = { id: "reno-family", name: "OPPO Reno Series", classificationLevel: "FAMILY", priority: 1, aliases: [{ alias: "reno", safety: "REVIEW_REQUIRED", priority: 0 }], productSeries: { name: "Reno Series", productGroup: "SMARTPHONE" } } as const;
  const business = matchCustomerVoiceProducts([inbound("m-1", "สนใจ Reno ราคาเท่าไหร่")], [family]);
  assert.equal(business[0]?.model.name, "OPPO Reno Series");
  assert.equal(matchCustomerVoiceProducts([inbound("m-2", "Reno")], [family]).length, 0);
});
