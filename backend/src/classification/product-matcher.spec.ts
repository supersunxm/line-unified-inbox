import assert from "node:assert/strict";
import test from "node:test";
import { ProductAliasSource } from "@prisma/client";
import { automaticCatalogAliases, PRODUCT_CATALOG, storedProductAliasSafety, synchronizableCatalogAliases, validateProductCatalog } from "./product-catalog";
import { matchProduct, MatchableModel, toSemanticMethod } from "./product-matcher";
import { compactProductText } from "./product-normalization";

// Thread language through so PHONETIC_ALIAS detection works correctly
const models: MatchableModel[] = PRODUCT_CATALOG.map((entry, index) => ({ id: String(index), name: entry.model, classificationLevel: entry.level, priority: entry.priority, aliases: automaticCatalogAliases(entry).map(({ alias, safety, language }) => ({ alias, safety, language, priority: 0 })), productSeries: { name: entry.family, productGroup: entry.group } }));
const detect = (text: string) => matchProduct([{ id: "message", text, sentAt: new Date() }], models)?.model.name;

void test("catalog aliases are unique after normalization", () => assert.deepEqual(validateProductCatalog(), []));
for (const entry of PRODUCT_CATALOG) for (const { alias } of automaticCatalogAliases(entry)) void test(`safe alias ${alias} resolves to ${entry.model}`, () => assert.equal(detect(alias), entry.model));

// Semantic detectionMethod assertions (EXACT_ALIAS, COMPACT_ALIAS, PHONETIC_ALIAS, SERIES_MATCH)
for (const [text, confidence, detectionMethod] of [
  ["A65G", 0.92, "COMPACT_ALIAS"],
  ["A6 5G", 0.98, "EXACT_ALIAS"],
  ["A6-5G", 0.98, "EXACT_ALIAS"],
  ["A6_5G", 0.98, "EXACT_ALIAS"],
  ["OPPO A6 5G", 0.98, "EXACT_ALIAS"],
  ["OPPOA65G", 0.92, "COMPACT_ALIAS"],
  ["Oppo A6 5g", 0.98, "EXACT_ALIAS"],
  ["ออปโป้ A6 5G", 0.98, "EXACT_ALIAS"],
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
  ["หัวชาร์จ supervooc", "ACCESSORIES"], ["สาย type c OPPO", "ACCESSORIES"], ["เคส oppo", "ACCESSORIES"], ["power bank OPPO", "ACCESSORIES"], ["OPPO Pad keyboard", "ACCESSORIES"], ["ปากกา OPPO Pad", "ACCESSORIES"],
] as const) void test(`${text} maps to ${group}`, () => assert.equal(matchProduct([{ id: "m", text, sentAt: new Date() }], models)?.model.productSeries?.productGroup, group));

for (const text of ["Reno", "renovation project", "smartwatch", "generic smartwatch", "ทีวี", "smart tv", "Samsung TV", "เราเตอร์", "TP-Link router", "smart home", "generic smart home", "power bank", "generic power bank", "สาย Type-C", "iPhone Type-C cable", "คีย์บอร์ดแท็บเล็ต", "กล้องวงจรปิด", "Xiaomi camera", "A6", "A65", "Pro", "5G", "A", "Pad", "Watch", "Air4", "X2", "เอหก 5G", "12345", "เครื่อง 5G ราคาเท่าไร", "apple watch ราคา", "notepad ใช้ยังไง", "budget เท่าไร", "bandwidth ช้า", "เครื่องเสีย"]) void test(`avoids false positive: ${text}`, () => assert.equal(detect(text), undefined));

for (const text of ["OPPO Reno Series", "Reno Series", "OPPO smartwatch", "smartwatch OPPO", "ทีวี OPPO", "OPPO Router", "เราเตอร์ OPPO", "OPPO Smart Home", "OPPO power bank", "power bank OPPO"]) {
  void test(`keeps approved brand context: ${text}`, () => assert.ok(detect(text)));
}

for (const [text, modelName] of [
  ["Pad3", "OPPO Pad 3"],
  ["WatchX2", "OPPO Watch X2"],
  ["EncoAir4", "OPPO Enco Air4"],
] as const) void test(`keeps approved compact compatibility: ${text}`, () => {
  const result = matchProduct([{ id: "compact", text, sentAt: new Date() }], models);
  assert.equal(result?.model.name, modelName);
  assert.equal(result?.confidence, 0.92);
  assert.equal(result?.detectionMethod, "COMPACT_ALIAS");
});

// รีโน16 / เรโน16 now have direct SAFE_COMPACT catalog aliases (language=th)
// → NORMALIZED_PHRASE internally but language=th so semantic label = PHONETIC_ALIAS
for (const [text, modelName] of [
  ["รีโน16", "OPPO Reno16"],
  ["เรโน16", "OPPO Reno16"],
] as const) void test(`keeps approved Thai compact alias: ${text}`, () => {
  const result = matchProduct([{ id: "compact", text, sentAt: new Date() }], models);
  assert.equal(result?.model.name, modelName);
  assert.equal(result?.confidence, 0.98);
  assert.equal(result?.detectionMethod, "PHONETIC_ALIAS");
});

for (const [text, modelName, expectedMethod] of [
  ["Pad 3", "OPPO Pad 3", "EXACT_ALIAS"],
  ["Watch X2", "OPPO Watch X2", "EXACT_ALIAS"],
  ["Enco Air 4", "OPPO Enco Air4", "EXACT_ALIAS"],
  ["รีโน 16", "OPPO Reno16", "PHONETIC_ALIAS"],
  ["เรโน 16", "OPPO Reno16", "PHONETIC_ALIAS"],
] as const) void test(`detectionMethod for ${text}`, () => {
  const result = matchProduct([{ id: "exact", text, sentAt: new Date() }], models);
  assert.equal(result?.model.name, modelName);
  assert.equal(result?.confidence, 0.98);
  assert.equal(result?.detectionMethod, expectedMethod);
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

// ── Thai phonetic alias detection (P0 new coverage) ─────────────────────

for (const [text, expected] of [
  // Reno16 Pro — Thai phonetic (P0)
  ["รีโน16โปร", "OPPO Reno16 Pro 5G"],
  ["รีโน 16 โปร", "OPPO Reno16 Pro 5G"],
  ["เรโน16โปร", "OPPO Reno16 Pro 5G"],
  ["เรโน 16 โปร", "OPPO Reno16 Pro 5G"],
  // Find X9 — Thai phonetic (P0)
  ["ไฟน์เอ็กซ์9", "OPPO Find X9"],
  ["ไฟน์ x9", "OPPO Find X9"],
  ["ไฟน์เอ็กซ์ 9", "OPPO Find X9"],
  // A6 Pro — Thai phonetic (P1)
  ["เอ6โปร", "OPPO A6 Pro 5G"],
  ["เอ 6 โปร", "OPPO A6 Pro 5G"],
  // A6 5G — brand-context exact (P1)
  ["oppo a6", "OPPO A6 5G"],
  // Watch X2 — compact no-space and Thai (P1)
  ["watchx2", "OPPO Watch X2"],
  ["นาฬิกา x2", "OPPO Watch X2"],
  // Enco Air4 — Thai (P1)
  ["หูฟัง enco air 4", "OPPO Enco Air4"],
  ["หูฟัง enco air4", "OPPO Enco Air4"],
  // Pad 3 — Thai (P1)
  ["แพด3", "OPPO Pad 3"],
  ["แพด 3", "OPPO Pad 3"],
] as const) void test(`Thai/compact alias detects ${text}`, () => assert.equal(detect(text), expected));

// ── Reno16 vs Reno16 Pro disambiguation (P1) ─────────────────────────────

// "reno16" must NOT escalate to Reno16 Pro; only explicit pro mention should match Pro
void test("reno16 alone resolves to base Reno16, not Pro", () => {
  assert.equal(detect("reno16"), "OPPO Reno16");
  assert.equal(detect("Reno 16"), "OPPO Reno16");
  assert.equal(detect("รีโน 16"), "OPPO Reno16");
  assert.equal(detect("เรโน 16"), "OPPO Reno16");
});

// Explicit "pro" in text must resolve to Reno16 Pro
void test("reno16 pro resolves to OPPO Reno16 Pro 5G", () => {
  assert.equal(detect("reno16 pro"), "OPPO Reno16 Pro 5G");
  assert.equal(detect("รีโน16โปร"), "OPPO Reno16 Pro 5G");
  assert.equal(detect("สนใจ Reno16 Pro สีขาว"), "OPPO Reno16 Pro 5G");
});

// New Thai aliases for Reno16 Pro must not trigger on base Reno16 text
void test("รีโน 16 alone does not escalate to Pro (disambiguation guard)", () => {
  assert.equal(detect("สนใจ รีโน 16 แบบผ่อน"), "OPPO Reno16");
});

// ── oppo a6 requires brand context; a6 alone must not match (P1) ─────────

void test("a6 alone remains undetected (REVIEW_REQUIRED guard)", () => {
  assert.equal(detect("a6"), undefined);
  assert.equal(detect("A6"), undefined);
});

void test("oppo a6 with brand context detects A6 5G", () => {
  assert.equal(detect("oppo a6 ราคา"), "OPPO A6 5G");
  assert.equal(detect("OPPO A6"), "OPPO A6 5G");
});

// ── toSemanticMethod unit tests ────────────────────────────────────────────

void test("toSemanticMethod: COMPACT_VARIATION always yields COMPACT_ALIAS", () => {
  assert.equal(toSemanticMethod("COMPACT_VARIATION", "MODEL", undefined), "COMPACT_ALIAS");
  assert.equal(toSemanticMethod("COMPACT_VARIATION", "FAMILY", "th"), "COMPACT_ALIAS");
  assert.equal(toSemanticMethod("COMPACT_VARIATION", "GENERIC", undefined), "COMPACT_ALIAS");
});

void test("toSemanticMethod: NORMALIZED_PHRASE + FAMILY/GENERIC → SERIES_MATCH", () => {
  assert.equal(toSemanticMethod("NORMALIZED_PHRASE", "FAMILY", undefined), "SERIES_MATCH");
  assert.equal(toSemanticMethod("NORMALIZED_PHRASE", "GENERIC", undefined), "SERIES_MATCH");
  assert.equal(toSemanticMethod("NORMALIZED_PHRASE", "FAMILY", "th"), "SERIES_MATCH");
});

void test("toSemanticMethod: NORMALIZED_PHRASE + MODEL + language=th → PHONETIC_ALIAS", () => {
  assert.equal(toSemanticMethod("NORMALIZED_PHRASE", "MODEL", "th"), "PHONETIC_ALIAS");
});

void test("toSemanticMethod: NORMALIZED_PHRASE + MODEL + no language → EXACT_ALIAS", () => {
  assert.equal(toSemanticMethod("NORMALIZED_PHRASE", "MODEL", undefined), "EXACT_ALIAS");
  assert.equal(toSemanticMethod("NORMALIZED_PHRASE", "MODEL", "en"), "EXACT_ALIAS");
});

// SERIES_MATCH e2e: "มือถือ oppo" matches OPPO Smartphone (GENERIC level)
void test("series-level detection yields SERIES_MATCH method", () => {
  const result = matchProduct([{ id: "m", text: "มือถือ oppo", sentAt: new Date() }], models);
  assert.equal(result?.detectionMethod, "SERIES_MATCH");
});

// PHONETIC_ALIAS e2e: Thai phonetic alias on MODEL level
void test("Thai phonetic alias detection yields PHONETIC_ALIAS method", () => {
  const result = matchProduct([{ id: "m", text: "รีโน16โปร", sentAt: new Date() }], models);
  assert.equal(result?.model.name, "OPPO Reno16 Pro 5G");
  assert.equal(result?.detectionMethod, "PHONETIC_ALIAS");
});

// EXACT_ALIAS e2e: plain Latin alias on MODEL level
void test("latin exact alias detection yields EXACT_ALIAS method", () => {
  const result = matchProduct([{ id: "m", text: "reno16 pro", sentAt: new Date() }], models);
  assert.equal(result?.model.name, "OPPO Reno16 Pro 5G");
  assert.equal(result?.detectionMethod, "EXACT_ALIAS");
});

// COMPACT_ALIAS e2e: compact no-space match
void test("compact no-space detection yields COMPACT_ALIAS method", () => {
  const result = matchProduct([{ id: "m", text: "reno16pro", sentAt: new Date() }], models);
  assert.equal(result?.model.name, "OPPO Reno16 Pro 5G");
  assert.equal(result?.detectionMethod, "COMPACT_ALIAS");
});

// Empty/whitespace message must not crash and must return undefined
void test("empty message text returns no match without crashing", () => {
  assert.equal(matchProduct([{ id: "empty", text: "", sentAt: new Date() }], models), undefined);
  assert.equal(matchProduct([{ id: "ws", text: "   ", sentAt: new Date() }], models), undefined);
});
