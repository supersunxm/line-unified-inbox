import assert from "node:assert/strict";
import test from "node:test";
import { buildNicknameV3ProductResolver } from "../line-chat/nickname-parser-v3-products";
import { parseNicknameV3 } from "../line-chat/nickname-parser-v3.contract";
import { bangkokYear, NICKNAME_PARSER_V4_RULE_VERSION, parseDateTokenV4, parseNicknameV4, twoDigitYearWindows, yearV4 } from "./nickname-parser-v4";

// Synthetic names only: placeholder words ("ลูกค้า", "คุณเอ", "TestUser"), never real customers.
const models = [
  { id: "m-reno16pro", name: "OPPO Reno16 Pro 5G", classificationLevel: "MODEL" },
  { id: "m-reno16", name: "OPPO Reno16", classificationLevel: "MODEL" },
  { id: "m-findx9", name: "OPPO Find X9", classificationLevel: "MODEL" },
  { id: "m-a6", name: "OPPO A6 5G", classificationLevel: "MODEL" },
];
const { resolveProduct } = buildNicknameV3ProductResolver(models, []);
// Two-digit years are read against "now" (Asia/Bangkok); tests pin it to 7 Oct 2026.
const NOW = new Date("2026-10-07T03:00:00Z");
const parse = (name: string) => parseNicknameV4(name, true, resolveProduct, NOW);

void test("v4.1 two-digit years: CE [now−5, now+1] → 20YY, BE [now−5, now+1] → 25YY − 543, else invalid", () => {
  assert.equal(bangkokYear(new Date("2026-12-31T17:30:00Z")), 2027, "Bangkok is UTC+7");
  // CE window 2021–2027, BE window 2564–2570 (= 2021–2027 CE).
  assert.equal(yearV4("26", NOW), 2026);
  assert.equal(yearV4("21", NOW), 2021);
  assert.equal(yearV4("27", NOW), 2027);
  assert.equal(yearV4("69", NOW), 2026, "BE 2569 = 2026 (v4.0 read 2069)");
  assert.equal(yearV4("64", NOW), 2021);
  assert.equal(yearV4("70", NOW), 2027);
  for (const yy of ["20", "28", "50", "63", "71", "99", "00"]) assert.equal(yearV4(yy, NOW), null, yy);
  // Four-digit years are unchanged.
  assert.equal(yearV4("2569", NOW), 2026, "Buddhist four-digit year");
  assert.equal(yearV4("2026", NOW), 2026);
  assert.equal(yearV4("123", NOW), null);
  // The windows move with "now", and never overlap.
  assert.equal(yearV4("28", new Date("2027-06-01T00:00:00Z")), 2028);
  assert.equal(yearV4("21", new Date("2027-06-01T00:00:00Z")), null);
  for (let year = 2000; year <= 2400; year++) assert.doesNotThrow(() => twoDigitYearWindows(new Date(Date.UTC(year, 5, 1))), String(year));
  const { ce, be } = twoDigitYearWindows(NOW);
  assert.deepEqual([...ce.keys()].sort(), [21, 22, 23, 24, 25, 26, 27]);
  assert.deepEqual([...be.keys()].sort(), [64, 65, 66, 67, 68, 69, 70]);
});

void test("MM/YY and full dates use those windows; single-digit months; impossible months and dates are rejected", () => {
  assert.deepEqual(parseDateTokenV4("09", "26", undefined, NOW), { period: { year: 2026, month: 9 } });
  assert.deepEqual(parseDateTokenV4("9", "69", undefined, NOW), { period: { year: 2026, month: 9 } }, "single-digit month, BE year");
  assert.deepEqual(parseDateTokenV4("1", "27", undefined, NOW), { period: { year: 2027, month: 1 } });
  assert.deepEqual(parseDateTokenV4("12", "2569", undefined, NOW), { period: { year: 2026, month: 12 } });
  assert.equal(parseDateTokenV4("09", "80", undefined, NOW), null, "outside both windows");
  assert.equal(parseDateTokenV4("13", "26", undefined, NOW), null);
  assert.equal(parseDateTokenV4("00", "26", undefined, NOW), null);
  assert.equal(parseDateTokenV4("123", "26", undefined, NOW), null);
  assert.deepEqual(parseDateTokenV4("5", "10", "69", NOW), { date: { year: 2026, month: 10, day: 5 } }, "BE full date");
  assert.deepEqual(parseDateTokenV4("29", "02", "2028", NOW), { date: { year: 2028, month: 2, day: 29 } });
  assert.equal(parseDateTokenV4("29", "02", "27", NOW), null, "not a leap year");
  assert.equal(parseDateTokenV4("31", "04", "26", NOW), null);

  assert.deepEqual(parse("Online 9/69").values.period, { year: 2026, month: 9 });
  assert.deepEqual(parse("ลูกค้า 09/69 ติดฟิล์ม").values.period, { year: 2026, month: 9 });
  const outside = parse("Online 09/80");
  assert.equal(outside.values.period, null);
  assert.equal(outside.values.customerType, "ONLINE", "an invalid year does not drop other tags");
  assert.equal(outside.invalidDateTokens, 1);

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
  assert.equal(NICKNAME_PARSER_V4_RULE_VERSION, "nickname-parser-v4.1.0");
});
