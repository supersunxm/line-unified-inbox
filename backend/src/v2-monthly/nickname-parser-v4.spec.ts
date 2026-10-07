import assert from "node:assert/strict";
import test from "node:test";
import { buildNicknameV3ProductResolver } from "../line-chat/nickname-parser-v3-products";
import { parseNicknameV3 } from "../line-chat/nickname-parser-v3.contract";
import { NICKNAME_PARSER_V4_RULE_VERSION, parseDateTokenV4, parseNicknameV4, yearV4 } from "./nickname-parser-v4";

// Synthetic names only: placeholder words ("ลูกค้า", "คุณเอ", "TestUser"), never real customers.
const models = [
  { id: "m-reno16pro", name: "OPPO Reno16 Pro 5G", classificationLevel: "MODEL" },
  { id: "m-reno16", name: "OPPO Reno16", classificationLevel: "MODEL" },
  { id: "m-findx9", name: "OPPO Find X9", classificationLevel: "MODEL" },
  { id: "m-a6", name: "OPPO A6 5G", classificationLevel: "MODEL" },
];
const { resolveProduct } = buildNicknameV3ProductResolver(models, []);
const parse = (name: string) => parseNicknameV4(name, true, resolveProduct);

void test("MM/YY: any two-digit year is 20YY; impossible months and dates are rejected", () => {
  assert.equal(yearV4("26"), 2026);
  assert.equal(yearV4("27"), 2027);
  assert.equal(yearV4("69"), 2069);
  assert.equal(yearV4("2569"), 2026, "Buddhist four-digit year");
  assert.equal(yearV4("2026"), 2026);
  assert.equal(yearV4("123"), null);
  assert.deepEqual(parseDateTokenV4("09", "26"), { period: { year: 2026, month: 9 } });
  assert.deepEqual(parseDateTokenV4("1", "27"), { period: { year: 2027, month: 1 } });
  assert.deepEqual(parseDateTokenV4("12", "2569"), { period: { year: 2026, month: 12 } });
  assert.equal(parseDateTokenV4("13", "26"), null);
  assert.equal(parseDateTokenV4("00", "26"), null);
  assert.equal(parseDateTokenV4("123", "26"), null);
  assert.deepEqual(parseDateTokenV4("29", "02", "28"), { date: { year: 2028, month: 2, day: 29 } });
  assert.equal(parseDateTokenV4("29", "02", "27"), null, "not a leap year");
  assert.equal(parseDateTokenV4("31", "04", "26"), null);

  assert.deepEqual(parse("Online 01/27").values.period, { year: 2027, month: 1 }, "v3 held 2027 for review");
  const impossible = parse("Online 13/26");
  assert.equal(impossible.values.period, null);
  assert.equal(impossible.values.customerType, "ONLINE", "an invalid month does not drop other tags");
  assert.equal(impossible.invalidDateTokens, 1);
  assert.equal(impossible.hasFreeText, true);
  assert.deepEqual(parse("ลูกค้า 08/26 09/26").values.period, { year: 2026, month: 9 }, "the last purchase month wins");
});

void test("Thai ฟิล์ม and its variants are the film service, as is film in any case", () => {
  for (const name of ["ลูกค้า ฟิล์ม", "ติดฟิล์ม 09/26", "คุณเอติดฟิล์มกระจก", "ฟิมล์ Reno16", "ฟิลม์", "film", "Film", "FILM", "TestUser fIlM 09/26"]) {
    assert.deepEqual(parse(name).values.services, ["FILM_INSTALLATION"], name);
  }
  assert.deepEqual(parse("Filmmaker").values.services, [], "Latin film only as a whole word");
  assert.equal(parseNicknameV3("ติดฟิล์ม", true).values.service, null, "v3 did not read Thai");
});

void test("extra words keep the recognised tags (v3 dropped the whole name)", () => {
  const name = "คุณเอ Online Reno16 Pro ติดฟิล์ม ผ่อน SG 09/26 รับที่สาขา";
  assert.equal(parseNicknameV3(name, true, resolveProduct).decision, "REVIEW");
  const result = parse(name);
  assert.equal(result.decision, "TAGGED");
  assert.equal(result.hasFreeText, true);
  assert.deepEqual(result.values, {
    source: null,
    customerType: "ONLINE",
    financeProvider: "SG_FINANCE",
    paymentMethod: "INSTALLMENT",
    services: ["FILM_INSTALLATION"],
    period: { year: 2026, month: 9 },
    date: null,
    products: [{ id: "m-reno16pro", name: "OPPO Reno16 Pro 5G" }],
  });
});

void test("platforms anywhere, ออนไลน์, products from the catalog dictionary, conflicts drop only that field", () => {
  assert.equal(parse("TestUser TikTok 09/26").values.source, "TikTok");
  assert.equal(parse("FB ลูกค้า").values.source, "Facebook");
  assert.equal(parse("ลูกค้า ig").values.source, "Instagram");
  assert.equal(parse("ลูกค้าออนไลน์").values.customerType, "ONLINE");
  assert.deepEqual(parse("findx9 รีโน16โปร").values.products.map((product) => product.id), ["m-findx9", "m-reno16pro"]);
  assert.deepEqual(parse("A6 5G เงินสด").values.products.map((product) => product.id), ["m-a6"]);
  assert.deepEqual(parse("a6").values.products, [], "a6 alone is REVIEW_REQUIRED in the catalog");

  const conflicting = parse("Online สด ผ่อน 09/26");
  assert.equal(conflicting.values.paymentMethod, null);
  assert.deepEqual(conflicting.conflicts, ["paymentMethod"]);
  assert.equal(conflicting.values.customerType, "ONLINE");
  assert.deepEqual(conflicting.values.period, { year: 2026, month: 9 });
  assert.equal(parse("ลูกค้าสดใส").values.paymentMethod, null, "สด only as its own word");
  assert.equal(parse("ลูกค้า เงินสด").values.paymentMethod, "CASH");
});

void test("no tag, unreadable, and the version", () => {
  const none = parse("คุณเอ");
  assert.equal(none.decision, "NO_SIGNAL");
  assert.equal(none.hasFreeText, true);
  assert.equal(parseNicknameV4("x", false).decision, "UNREADABLE");
  assert.equal(parseNicknameV4("a\u0001b", true).decision, "UNREADABLE");
  assert.equal(parse("Online").ruleVersion, NICKNAME_PARSER_V4_RULE_VERSION);
  assert.equal(NICKNAME_PARSER_V4_RULE_VERSION, "nickname-parser-v4.0.0");
});
