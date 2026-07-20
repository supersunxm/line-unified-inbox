import assert from "node:assert/strict";
import test from "node:test";
import { PRODUCT_CATALOG, validateProductCatalog } from "./product-catalog";
import { matchProduct, MatchableModel } from "./product-matcher";

const models: MatchableModel[] = PRODUCT_CATALOG.map((entry, index) => ({ id: String(index), name: entry.model, classificationLevel: entry.level, priority: entry.priority, aliases: entry.aliases.map((alias) => ({ alias, priority: 0 })), productSeries: { name: entry.family, productGroup: entry.group } }));
const detect = (text: string) => matchProduct([{ id: "message", text, sentAt: new Date() }], models)?.model.name;

void test("catalog aliases are unique after normalization", () => assert.deepEqual(validateProductCatalog(), []));
for (const [text, expected] of [
  ["Reno 16", "OPPO Reno16"], ["Reno16", "OPPO Reno16"], ["Oppo a6 pro", "OPPO A6 Pro 5G"],
  ["Reno16/F/8+128มีไหมคะ", "OPPO Reno16"], ["ผ่อน oppo a6 pro ได้ไหม", "OPPO A6 Pro 5G"],
  ["Find X9 มีของไหม", "OPPO Find X9"], ["OPPO Pad 3 ราคา", "OPPO Pad 3"], ["Enco Air4 สีขาว", "OPPO Enco Air4"],
] as const) void test(`detects ${text}`, () => assert.equal(detect(text), expected));

for (const [text, group] of [
  ["OPPO Reno 16", "SMARTPHONE"], ["A 6 Pro", "SMARTPHONE"], ["Find N", "SMARTPHONE"], ["find flip", "SMARTPHONE"], ["มือถือ oppo", "SMARTPHONE"],
  ["OPPO Pad", "TABLET"], ["pad air", "TABLET"], ["แท็บเล็ต oppo", "TABLET"], ["OPPO Watch", "WEARABLE"], ["smartwatch", "WEARABLE"], ["oppo band", "WEARABLE"],
  ["OPPO Enco", "AUDIO"], ["หูฟัง enco", "AUDIO"], ["earbuds oppo", "AUDIO"], ["OPPO TV", "TV"], ["smart tv", "TV"], ["ทีวี", "TV"],
  ["เราเตอร์", "SMART_HOME_AIOT"], ["กล้องวงจรปิด", "SMART_HOME_AIOT"], ["smart home", "SMART_HOME_AIOT"],
  ["หัวชาร์จ supervooc", "ACCESSORIES"], ["สาย type c", "ACCESSORIES"], ["เคส Reno 16", "ACCESSORIES"], ["power bank", "ACCESSORIES"], ["คีย์บอร์ดแท็บเล็ต", "ACCESSORIES"], ["ปากกา OPPO Pad", "ACCESSORIES"],
] as const) void test(`${text} maps to ${group}`, () => assert.equal(matchProduct([{ id: "m", text, sentAt: new Date() }], models)?.model.productSeries?.productGroup, group));

for (const text of ["apple watch ราคา", "notepad ใช้ยังไง", "budget เท่าไร", "bandwidth ช้า", "เครื่องเสีย"]) void test(`avoids false positive: ${text}`, () => assert.equal(detect(text), undefined));

void test("an exact older model survives a newer generic product mention", () => {
  const result = matchProduct([{ id: "old", text: "Reno16", sentAt: new Date(1) }, { id: "new", text: "มือถือ oppo", sentAt: new Date(2) }], models);
  assert.equal(result?.model.name, "OPPO Reno16"); assert.equal(result?.sourceMessageId, "old");
});

void test("the newest exact model wins", () => {
  const result = matchProduct([{ id: "old", text: "Reno16", sentAt: new Date(1) }, { id: "new", text: "A6 Pro", sentAt: new Date(2) }], models);
  assert.equal(result?.model.name, "OPPO A6 Pro 5G");
});
