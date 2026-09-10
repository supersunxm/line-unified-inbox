import assert from "node:assert/strict";
import test from "node:test";
import { CustomerVoiceAnalysisSource } from "@prisma/client";
import { automaticCatalogAliases } from "../classification/product-catalog";
import { matchProducts, type MatchableModel } from "../classification/product-matcher";
import { buildCustomerVoiceAnalysis } from "./customer-voice-analyzer";

const models: MatchableModel[] = [
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
