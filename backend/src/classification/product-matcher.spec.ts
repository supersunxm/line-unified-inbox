import assert from "node:assert/strict";
import test from "node:test";
import { ProductAliasSource } from "@prisma/client";
import { automaticCatalogAliases, PRODUCT_CATALOG, storedProductAliasSafety, synchronizableCatalogAliases, validateProductCatalog } from "./product-catalog";
import { matchProduct, MatchableModel } from "./product-matcher";
import { compactProductText } from "./product-normalization";

const models: MatchableModel[] = PRODUCT_CATALOG.map((entry, index) => ({ id: String(index), name: entry.model, classificationLevel: entry.level, priority: entry.priority, aliases: automaticCatalogAliases(entry).map(({ alias, safety }) => ({ alias, safety, priority: 0 })), productSeries: { name: entry.family, productGroup: entry.group } }));
const detect = (text: string) => matchProduct([{ id: "message", text, sentAt: new Date() }], models)?.model.name;

void test("catalog aliases are unique after normalization", () => assert.deepEqual(validateProductCatalog(), []));
for (const entry of PRODUCT_CATALOG) for (const { alias } of automaticCatalogAliases(entry)) void test(`safe alias ${alias} resolves to ${entry.model}`, () => assert.equal(detect(alias), entry.model));

for (const [text, confidence, detectionMethod] of [
  ["A65G", 0.92, "COMPACT_VARIATION"],
  ["A6 5G", 0.98, "NORMALIZED_PHRASE"],
  ["A6-5G", 0.98, "NORMALIZED_PHRASE"],
  ["A6_5G", 0.98, "NORMALIZED_PHRASE"],
  ["OPPO A6 5G", 0.98, "NORMALIZED_PHRASE"],
  ["OPPOA65G", 0.92, "COMPACT_VARIATION"],
  ["Oppo A6 5g", 0.98, "NORMALIZED_PHRASE"],
  ["ออปโป้ A6 5G", 0.98, "NORMALIZED_PHRASE"],
] as const) void test(`detects OPPO A6 5G from ${text}`, () => {
  const result = matchProduct([{ id: "a6-message", text, sentAt: new Date() }], models);
  const canonical = models.find(({ name }) => name === "OPPO A6 5G");
  assert.equal(result?.model.id, canonical?.id);
  assert.equal(result?.model.name, "OPPO A6 5G");
  assert.equal(result?.confidence, confidence);
  assert.equal(result?.detectionMethod, detectionMethod);
  assert.equal(result?.matchedPhrase, text.toLocaleLowerCase() === "oppo a6 5g" ? "OPPO A6 5G" : "a6 5g");
  assert.equal(result?.sourceMessageId, "a6-message");
});

for (const [text, expected] of [
  ["Reno 16", "OPPO Reno16"], ["Reno16", "OPPO Reno16"], ["Oppo a6 pro", "OPPO A6 Pro 5G"],
  ["Reno16/F/8+128มีไหมคะ", "OPPO Reno16"], ["ผ่อน oppo a6 pro ได้ไหม", "OPPO A6 Pro 5G"],
  ["Find X9 มีของไหม", "OPPO Find X9"], ["OPPO Pad 3 ราคา", "OPPO Pad 3"], ["Enco Air4 สีขาว", "OPPO Enco Air4"],
] as const) void test(`detects ${text}`, () => assert.equal(detect(text), expected));

for (const [text, group] of [
  ["OPPO Reno 16", "SMARTPHONE"], ["A 6 Pro", "SMARTPHONE"], ["Find N", "SMARTPHONE"], ["find flip", "SMARTPHONE"], ["มือถือ oppo", "SMARTPHONE"],
  ["OPPO Pad", "TABLET"], ["pad air", "TABLET"], ["แท็บเล็ต oppo", "TABLET"], ["OPPO Watch", "WEARABLE"], ["OPPO smartwatch", "WEARABLE"], ["oppo band", "WEARABLE"],
  ["OPPO Enco", "AUDIO"], ["หูฟัง enco", "AUDIO"], ["oppo earbuds", "AUDIO"], ["OPPO TV", "TV"], ["ทีวี OPPO", "TV"],
  ["OPPO router", "SMART_HOME_AIOT"], ["กล้อง OPPO", "SMART_HOME_AIOT"], ["OPPO smart home", "SMART_HOME_AIOT"],
  ["หัวชาร์จ supervooc", "ACCESSORIES"], ["สาย type c OPPO", "ACCESSORIES"], ["เคส Reno 16", "ACCESSORIES"], ["power bank OPPO", "ACCESSORIES"], ["OPPO Pad keyboard", "ACCESSORIES"], ["ปากกา OPPO Pad", "ACCESSORIES"],
] as const) void test(`${text} maps to ${group}`, () => assert.equal(matchProduct([{ id: "m", text, sentAt: new Date() }], models)?.model.productSeries?.productGroup, group));

for (const text of ["Reno", "renovation project", "smartwatch", "generic smartwatch", "ทีวี", "smart tv", "Samsung TV", "เราเตอร์", "TP-Link router", "smart home", "generic smart home", "power bank", "generic power bank", "สาย Type-C", "iPhone Type-C cable", "คีย์บอร์ดแท็บเล็ต", "กล้องวงจรปิด", "Xiaomi camera", "A6", "A65", "Pro", "5G", "A", "Pad", "Watch", "Air4", "X2", "เอหก 5G", "12345", "เครื่อง 5G ราคาเท่าไร", "apple watch ราคา", "notepad ใช้ยังไง", "budget เท่าไร", "bandwidth ช้า", "เครื่องเสีย"]) void test(`avoids false positive: ${text}`, () => assert.equal(detect(text), undefined));

for (const text of ["OPPO Reno Series", "Reno Series", "OPPO smartwatch", "smartwatch OPPO", "ทีวี OPPO", "OPPO Router", "เราเตอร์ OPPO", "OPPO Smart Home", "OPPO power bank", "power bank OPPO"]) {
  void test(`keeps approved brand context: ${text}`, () => assert.ok(detect(text)));
}

for (const [text, modelName] of [
  ["Pad3", "OPPO Pad 3"],
  ["WatchX2", "OPPO Watch X2"],
  ["EncoAir4", "OPPO Enco Air4"],
  ["รีโน16", "OPPO Reno16"],
  ["เรโน16", "OPPO Reno16"],
] as const) void test(`keeps approved compact compatibility: ${text}`, () => {
  const result = matchProduct([{ id: "compact", text, sentAt: new Date() }], models);
  assert.equal(result?.model.name, modelName);
  assert.equal(result?.confidence, 0.92);
  assert.equal(result?.detectionMethod, "COMPACT_VARIATION");
});

for (const [text, modelName] of [
  ["Pad 3", "OPPO Pad 3"],
  ["Watch X2", "OPPO Watch X2"],
  ["Enco Air 4", "OPPO Enco Air4"],
  ["รีโน 16", "OPPO Reno16"],
  ["เรโน 16", "OPPO Reno16"],
] as const) void test(`keeps normalized exact confidence: ${text}`, () => {
  const result = matchProduct([{ id: "exact", text, sentAt: new Date() }], models);
  assert.equal(result?.model.name, modelName);
  assert.equal(result?.confidence, 0.98);
  assert.equal(result?.detectionMethod, "NORMALIZED_PHRASE");
});

void test("blocked and review-required runtime keys are absent from catalog synchronization", () => {
  const keys = new Set(PRODUCT_CATALOG.flatMap((entry) => synchronizableCatalogAliases(entry).map(({ alias }) => compactProductText(alias))));
  for (const key of ["reno", "smartwatch", "ทีวี", "เราเตอร์", "smarthome", "powerbank", "สายtypec", "คีย์บอร์ดแท็บเล็ต"]) {
    assert.equal(keys.has(key), false, key);
  }
});

void test("safety identity preserves OPPO brand context", () => {
  assert.equal(storedProductAliasSafety("OPPO TV", "oppo tv", ProductAliasSource.CATALOG), "SAFE_EXACT");
  assert.equal(storedProductAliasSafety("OPPO TV", "tv", ProductAliasSource.CATALOG), "REVIEW_REQUIRED");
  assert.equal(storedProductAliasSafety("OPPO TV", "ทีวี oppo", ProductAliasSource.CATALOG), "SAFE_EXACT");
  assert.equal(storedProductAliasSafety("OPPO TV", "ทีวี", ProductAliasSource.CATALOG), "BLOCKED");
  assert.equal(storedProductAliasSafety("OPPO Router", "oppo router", ProductAliasSource.CATALOG), "SAFE_EXACT");
  assert.equal(storedProductAliasSafety("OPPO Router", "router", ProductAliasSource.CATALOG), "REVIEW_REQUIRED");
  assert.equal(storedProductAliasSafety("OPPO Smart Home", "oppo smart home", ProductAliasSource.CATALOG), "SAFE_EXACT");
  assert.equal(storedProductAliasSafety("OPPO Smart Home", "smart home", ProductAliasSource.CATALOG), "REVIEW_REQUIRED");
});

for (const [text, expected] of [
  ["A6 Pro", "OPPO A6 Pro 5G"],
  ["A6 Pro 5G", "OPPO A6 Pro 5G"],
  ["OPPO A6 5G", "OPPO A6 5G"],
  ["Find X9 Pro", undefined],
  ["Reno16 Pro", "OPPO Reno16 Pro 5G"],
] as const) void test(`keeps A6 model distinction for ${text}`, () => assert.equal(detect(text), expected));

for (const text of ["Find X9 Ultra", "Find X9 Mini", "Find X9 Zoom", "Reno16 Ultra", "Reno16 Mini", "A6 Ultra", "A6 Pro Ultra", "A6 Pro Mini"]) {
  void test(`rejects unknown identity suffix: ${text}`, () => assert.equal(detect(text), undefined));
}

for (const [text, expected] of [
  ["Find X9 256GB", "OPPO Find X9"],
  ["Reno16 ราคาเท่าไหร่", "OPPO Reno16"],
  ["Reno16 12/256", "OPPO Reno16"],
  ["A6 5G สีชมพู", "OPPO A6 5G"],
  ["A6 Pro 5G มีของไหม", "OPPO A6 Pro 5G"],
] as const) void test(`accepts non-identity trailing attribute: ${text}`, () => assert.equal(detect(text), expected));

void test("review-required and blocked aliases never auto-match", () => {
  const guardedModel: MatchableModel = {
    id: "guarded",
    name: "OPPO Guarded Model",
    classificationLevel: "MODEL",
    priority: 1,
    aliases: [
      { alias: "review me", priority: 0, safety: "REVIEW_REQUIRED" },
      { alias: "blocked model", priority: 0, safety: "BLOCKED" },
    ],
    productSeries: { name: "Guarded", productGroup: "SMARTPHONE" },
  };
  assert.equal(matchProduct([{ id: "review", text: "review me", sentAt: new Date() }], [guardedModel]), undefined);
  assert.equal(matchProduct([{ id: "blocked", text: "blocked model", sentAt: new Date() }], [guardedModel]), undefined);
});

void test("manual and missing-source database aliases fail closed", () => {
  const manualSafety = storedProductAliasSafety("OPPO Reno16", "operator reno alias", ProductAliasSource.MANUAL);
  const missingSourceSafety = storedProductAliasSafety("OPPO Reno16", "reno16", undefined);
  const guardedModel: MatchableModel = {
    id: "manual",
    name: "OPPO Manual Alias Model",
    classificationLevel: "MODEL",
    priority: 1,
    aliases: [
      { alias: "operator reno alias", priority: 0, safety: manualSafety },
      { alias: "missing source alias", priority: 0, safety: missingSourceSafety },
    ],
    productSeries: { name: "Manual", productGroup: "SMARTPHONE" },
  };

  assert.equal(manualSafety, "REVIEW_REQUIRED");
  assert.equal(missingSourceSafety, "REVIEW_REQUIRED");
  assert.equal(matchProduct([{ id: "manual", text: "operator reno alias", sentAt: new Date() }], [guardedModel]), undefined);
  assert.equal(matchProduct([{ id: "missing", text: "missing source alias", sentAt: new Date() }], [guardedModel]), undefined);
});

void test("an exact older model survives a newer generic product mention", () => {
  const result = matchProduct([{ id: "old", text: "Reno16", sentAt: new Date(1) }, { id: "new", text: "มือถือ oppo", sentAt: new Date(2) }], models);
  assert.equal(result?.model.name, "OPPO Reno16"); assert.equal(result?.sourceMessageId, "old");
});

void test("the newest exact model wins", () => {
  const result = matchProduct([{ id: "old", text: "Reno16", sentAt: new Date(1) }, { id: "new", text: "A6 Pro", sentAt: new Date(2) }], models);
  assert.equal(result?.model.name, "OPPO A6 Pro 5G");
});
