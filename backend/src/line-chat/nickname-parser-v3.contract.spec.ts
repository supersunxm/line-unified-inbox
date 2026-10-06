import assert from "node:assert/strict";
import test from "node:test";
import {
  createNicknameProductResolver,
  auditNicknameDateTokens,
  NICKNAME_PARSER_V3_RULE_VERSION,
  parseNicknameV3,
  type ParserV3Product,
} from "./nickname-parser-v3.contract";
import { parseNicknameSource } from "./nickname-source-contract";

const products: ParserV3Product[] = [
  {
    id: "reno-16",
    name: "OPPO Reno16",
    active: true,
    aliases: [
      { alias: "Reno 16", safety: "SAFE_EXACT" },
      { alias: "reno16", safety: "SAFE_COMPACT" },
      { alias: "reno", safety: "BLOCKED" },
      { alias: "operator reno", safety: "REVIEW_REQUIRED" },
    ],
  },
  { id: "inactive", name: "OPPO Old Model", active: false, aliases: [] },
];
const resolve = createNicknameProductResolver(products);
const parse = (value: string | null, readable = true) => parseNicknameV3(value, readable, resolve);

test("v3 result is versioned, deterministic, and exposes separate metadata dimensions", () => {
  const first = parse("OPPO Reno16 Online SG ผ่อน 9/26");
  assert.equal(first.ruleVersion, NICKNAME_PARSER_V3_RULE_VERSION);
  assert.deepEqual(first, parse("OPPO Reno16 Online SG ผ่อน 9/26"));
  assert.equal(first.decision, "DETERMINISTIC");
  assert.equal(first.values.customerType, "ONLINE");
  assert.equal(first.values.financeProvider, "SG_FINANCE");
  assert.equal(first.values.paymentMethod, "INSTALLMENT");
  assert.equal(first.values.product?.id, "reno-16");
  assert.deepEqual(first.values.period, { year: 2026, month: 9 });
  assert.equal(first.values.source, null);
});

test("owner-confirmed standalone business tokens map to independent dimensions", () => {
  assert.equal(parse("Online").values.customerType, "ONLINE");
  assert.equal(parse("SG").values.financeProvider, "SG_FINANCE");
  assert.equal(parse("UFUND").values.financeProvider, "UFUND");
  assert.equal(parse("Ufund").values.financeProvider, "UFUND");
  assert.equal(parse("สด").values.paymentMethod, "CASH");
  assert.equal(parse("เงินสด").values.paymentMethod, "CASH");
  assert.equal(parse("ผ่อน").values.paymentMethod, "INSTALLMENT");
  assert.equal(parse("Film").values.service, "FILM_INSTALLATION");
});

test("installment does not invent a finance provider and explicit provider is preserved", () => {
  assert.equal(parse("ผ่อน").values.financeProvider, null);
  assert.equal(parse("UFUND ผ่อน").values.financeProvider, "UFUND");
});

test("conflicting providers, payment methods, and periods require review", () => {
  for (const value of ["SG UFUND", "สด ผ่อน", "1/26 2/26"]) {
    assert.equal(parse(value).decision, "REVIEW", value);
  }
  assert.ok(parse("SG UFUND").holdReasons.includes("CONFLICTING_FINANCE_PROVIDER_SIGNALS"));
  assert.ok(parse("สด ผ่อน").holdReasons.includes("CONFLICTING_PAYMENT_METHOD_SIGNALS"));
});

test("two-field periods and D/M/Y full dates normalize only the confirmed 26/69 years", () => {
  assert.deepEqual(parse("1/26").values.period, { year: 2026, month: 1 });
  assert.deepEqual(parse("09/69").values.period, { year: 2026, month: 9 });
  assert.deepEqual(parse("5/6/26").values.date, { year: 2026, month: 6, day: 5 });
  assert.deepEqual(parse("05/06/69").values.date, { year: 2026, month: 6, day: 5 });
  assert.deepEqual(parse("5/6/2569").values.date, { year: 2026, month: 6, day: 5 });
  assert.deepEqual(parse("29/2/2024").values.date, { year: 2024, month: 2, day: 29 });
});

test("unsupported years, invalid dates, and non-confirmed delimiters never normalize", () => {
  for (const value of ["1/27", "09/2026", "31/2/26", "13/26", "9-26"]) {
    const result = parse(value);
    assert.equal(result.decision === "DETERMINISTIC", false, value);
  }
  assert.ok(parse("1/27").holdReasons.includes("UNSUPPORTED_OR_INVALID_NUMERIC_DATE"));
});

test("date audit reports observed numeric shapes without widening the accepted grammar", () => {
  assert.deepEqual(
    auditNicknameDateTokens("9/26, 09/69, 5/6/26, 05/06/2569, 9-26, 09/2026").map(({ shape, disposition }) => ({ shape, disposition })),
    [
      { shape: "M/YY", disposition: "PERIOD" },
      { shape: "MM/YY", disposition: "PERIOD" },
      { shape: "D/M/YY", disposition: "DATE" },
      { shape: "DD/MM/YYYY", disposition: "DATE" },
      { shape: "M-YY", disposition: "UNSUPPORTED_SEPARATOR" },
      { shape: "MM/YYYY", disposition: "INVALID" },
    ],
  );
  assert.equal(parse("9-26").values.period, null);
  assert.equal(parse("9-26").decision, "REVIEW");
  assert.ok(parse("9-26").holdReasons.includes("UNSUPPORTED_NUMERIC_DATE_SEPARATOR"));
});

test("Product Master canonical names and approved aliases resolve exactly; unsafe aliases stay held", () => {
  assert.equal(parse("OPPO Reno16").values.product?.id, "reno-16");
  assert.equal(parse("Reno 16").values.product?.id, "reno-16");
  assert.equal(parse("Reno16").values.product?.id, "reno-16");
  assert.equal(parse("reno").values.product, null);
  assert.equal(parse("operator reno").values.product, null);
  assert.equal(parse("OPPO Old Model").values.product, null);
  assert.equal(parse("Ｒｅｎｏ１６").values.product, null);
  assert.equal(parse("Reno16 with arbitrary Thai note สดชื่น").values.product, null);
});

test("product aliases colliding across active models are ambiguous", () => {
  const resolveCollision = createNicknameProductResolver([
    ...products,
    { id: "other", name: "Other Phone", active: true, aliases: [{ alias: "Reno 16", safety: "SAFE_EXACT" }] },
  ]);
  const result = parseNicknameV3("Online Reno 16", true, resolveCollision);
  assert.equal(result.decision, "REVIEW");
  assert.ok(result.holdReasons.includes("PRODUCT_ALIAS_COLLISION"));
});

test("a safe alias is held when it conflicts with a distinct active canonical model", () => {
  const resolveModels = createNicknameProductResolver([
    {
      id: "reno-16",
      name: "OPPO Reno16",
      active: true,
      aliases: [
        { alias: "Reno16F", safety: "SAFE_EXACT" },
        { alias: "Reno16 5G", safety: "SAFE_EXACT" },
        { alias: "Reno16", safety: "SAFE_COMPACT" },
        { alias: "OPPO Reno16", safety: "SAFE_EXACT" },
      ],
    },
    { id: "reno-16-f-5g", name: "OPPO Reno16 F 5G", active: true, aliases: [] },
    { id: "reno-16-5g", name: "OPPO Reno16 5G", active: true, aliases: [] },
  ]);

  assert.deepEqual(resolveModels("Reno16F"), { kind: "AMBIGUOUS", candidateCount: 2 });
  assert.deepEqual(resolveModels("Reno16 5G"), { kind: "AMBIGUOUS", candidateCount: 2 });
  assert.equal(resolveModels("Reno16").kind, "MATCH");
  assert.deepEqual(resolveModels("OPPO Reno16"), {
    kind: "MATCH", productId: "reno-16", productName: "OPPO Reno16", alias: "OPPO Reno16", matchKind: "CANONICAL",
  });
  assert.equal(resolveModels("OPPO Reno16 F 5G").kind, "MATCH");

  const shorthand = parseNicknameV3("Reno16F 26/9/69", true, resolveModels);
  assert.equal(shorthand.decision, "REVIEW");
  assert.ok(shorthand.holdReasons.includes("PRODUCT_ALIAS_COLLISION"));
});

test("English substrings and Thai substrings do not become business markers", () => {
  for (const value of ["online-shop", "offline", "design", "5G", "fundraising", "สดชื่น", "ผ่อนคลาย"]) {
    assert.equal(parse(value).values.customerType, null, value);
    assert.equal(parse(value).values.financeProvider, null, value);
    assert.equal(parse(value).values.paymentMethod, null, value);
    assert.equal(parse(value).values.service, null, value);
  }
  assert.equal(parse("online-shop").decision, "NO_SIGNAL");
  for (const value of ["ſG", "ＳＧ", "Onlınе", "Ｆｉｌｍ"]) {
    const result = parse(value);
    assert.equal(result.values.financeProvider, null, value);
    assert.equal(result.values.customerType, null, value);
    assert.equal(result.values.service, null, value);
  }
});

test("same nickname is parsed independently; identity never enters the nickname parser", () => {
  const a = parse("Online");
  const b = parse("Online");
  assert.deepEqual(a, b);
  assert.equal("lineOfficialAccountId" in a, false);
  assert.equal("lineChatUserId" in a, false);
});

test("missing or unreadable nickname evidence is UNKNOWN", () => {
  assert.equal(parse("Online", false).decision, "UNKNOWN");
  assert.equal(parse(null, false).decision, "UNKNOWN");
  assert.equal(parse("Online\u0000").decision, "UNKNOWN");
  assert.equal(parse(" ").decision, "NO_SIGNAL");
});

test("v2 Source behavior remains byte-for-byte equivalent for its frozen fixtures", () => {
  const fixtures = [
    "TikTok 09/26", "TIKTOK 09/26", "IG 09/26", "Website 09/26", "Lemon8 12/69",
    "TikTok", "TikTok 9/26", "TikTok 13/26", "TikTok-09/26", "I love Facebook 09/26",
    "TikTok/Facebook 09/26", "TikTok 09/26,TikTok 09/26", "Webſite 09/26", "LINE 09/26",
  ];
  for (const nickname of fixtures) {
    assert.deepEqual(parse(nickname).legacySource, parseNicknameSource(nickname, true), nickname);
  }
});
