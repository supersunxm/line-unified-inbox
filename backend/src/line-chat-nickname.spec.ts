import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLineChatNickname,
  compactModelNameToFit,
  MAX_LINE_CHAT_NICKNAME_LENGTH,
} from "./line-chat-nickname";

void test("online status maps to Online", () => {
  assert.equal(buildLineChatNickname({ status: "ONLINE" }), "Online");
});

void test("cash purchase uses model, สด, and recorded month/year", () => {
  const result = buildLineChatNickname({
    status: "PURCHASED",
    paymentMethod: "CASH",
    recordedAt: "2026-08-30T12:00:00+07:00",
    products: [{ model: { name: "OPPO Find X9" } }],
  });
  assert.equal(result, "Find X9 สด 08/26");
  assert.ok(result.length <= MAX_LINE_CHAT_NICKNAME_LENGTH);
});

void test("installment purchase compacts whitespace inside model name when exceeding 20 chars", () => {
  const result = buildLineChatNickname({
    status: "PURCHASED",
    paymentMethod: "INSTALLMENT",
    recordedAt: "2026-09-02T10:00:00+07:00",
    products: [{ customProductName: "Reno14 Pro", model: { name: "OPPO Reno14 Pro 5G" } }],
  });
  // Reno14 Pro (10) + " ผ่อน 09/26" (11) = 21 -> compacts to "Reno14Pro ผ่อน 09/26" (20)
  assert.equal(result, "Reno14Pro ผ่อน 09/26");
  assert.equal(result?.length, 20);
});

void test("month/year follows Bangkok time at a UTC month boundary", () => {
  const result = buildLineChatNickname({
    status: "PURCHASED",
    paymentMethod: "CASH",
    recordedAt: "2026-08-31T17:30:00.000Z",
    products: [{ model: { name: "Find X9" } }],
  });
  assert.equal(result, "Find X9 สด 09/26");
  assert.ok(result.length <= MAX_LINE_CHAT_NICKNAME_LENGTH);
});

void test("interested status does not change nickname", () => {
  assert.equal(buildLineChatNickname({ status: "INTERESTED" }), null);
});

void test("purchase nickname is not emitted when required data is incomplete", () => {
  assert.equal(buildLineChatNickname({ status: "PURCHASED", paymentMethod: "CASH", recordedAt: "2026-08-30T12:00:00+07:00" }), null);
  assert.equal(buildLineChatNickname({ status: "PURCHASED", paymentMethod: "OTHER", recordedAt: "2026-08-30T12:00:00+07:00", products: [{ model: { name: "Find X9" } }] }), null);
});

void test("Reno16 5G ผ่อน 09/26: already <= 20 remains completely unchanged", () => {
  const result = buildLineChatNickname({
    status: "PURCHASED",
    paymentMethod: "INSTALLMENT",
    recordedAt: "2026-09-01T12:00:00+07:00",
    products: [{ model: { name: "Reno16 5G" } }],
  });
  assert.equal(result, "Reno16 5G ผ่อน 09/26");
  assert.equal(result?.length, 20);
  assert.ok(result.length <= MAX_LINE_CHAT_NICKNAME_LENGTH);
});

void test("Reno16 F 5G ผ่อน 09/26: strips redundant 5G suffix to fit <= 20", () => {
  const result = buildLineChatNickname({
    status: "PURCHASED",
    paymentMethod: "INSTALLMENT",
    recordedAt: "2026-09-01T12:00:00+07:00",
    products: [{ model: { name: "Reno16 F 5G" } }],
  });
  // "Reno16 F 5G ผ่อน 09/26" = 22 -> "Reno16 F ผ่อน 09/26" = 19
  assert.equal(result, "Reno16 F ผ่อน 09/26");
  assert.equal(result?.length, 19);
  assert.ok(result.length <= MAX_LINE_CHAT_NICKNAME_LENGTH);
});

void test("Reno16 Pro 5G ผ่อน 09/26: strips 5G and compacts model whitespace to fit <= 20", () => {
  const result = buildLineChatNickname({
    status: "PURCHASED",
    paymentMethod: "INSTALLMENT",
    recordedAt: "2026-09-01T12:00:00+07:00",
    products: [{ model: { name: "Reno16 Pro 5G" } }],
  });
  // "Reno16 Pro 5G ผ่อน 09/26" = 24 -> strips 5G -> "Reno16 Pro ผ่อน 09/26" = 21 -> compacts space -> "Reno16Pro ผ่อน 09/26" = 20
  assert.equal(result, "Reno16Pro ผ่อน 09/26");
  assert.equal(result?.length, 20);
  assert.ok(result.length <= MAX_LINE_CHAT_NICKNAME_LENGTH);
});

void test("Reno16 Pro 5G สด 09/26: strips 5G and preserves Reno16 Pro identity, สด, 09/26 <= 20", () => {
  const result = buildLineChatNickname({
    status: "PURCHASED",
    paymentMethod: "CASH",
    recordedAt: "2026-09-01T12:00:00+07:00",
    products: [{ model: { name: "Reno16 Pro 5G" } }],
  });
  // "Reno16 Pro 5G สด 09/26" = 22 -> strips 5G -> "Reno16 Pro สด 09/26" = 19
  assert.equal(result, "Reno16 Pro สด 09/26");
  assert.equal(result?.length, 19);
  assert.ok(result.length <= MAX_LINE_CHAT_NICKNAME_LENGTH);
});

void test("short nicknames remain unchanged when already <= 20", () => {
  const a6 = buildLineChatNickname({
    status: "PURCHASED",
    paymentMethod: "CASH",
    recordedAt: "2026-09-01T12:00:00+07:00",
    products: [{ model: { name: "A6" } }],
  });
  assert.equal(a6, "A6 สด 09/26");
  assert.equal(a6?.length, 11);

  const findX9 = buildLineChatNickname({
    status: "PURCHASED",
    paymentMethod: "CASH",
    recordedAt: "2026-08-01T12:00:00+07:00",
    products: [{ model: { name: "Find X9" } }],
  });
  assert.equal(findX9, "Find X9 สด 08/26");
  assert.equal(findX9?.length, 16);
});

void test("parentheses and symbol removal before destructive truncation", () => {
  const result = buildLineChatNickname({
    status: "PURCHASED",
    paymentMethod: "INSTALLMENT",
    recordedAt: "2026-09-01T12:00:00+07:00",
    products: [{ model: { name: "Find N3 (5G)" } }],
  });
  // "Find N3 (5G) ผ่อน 09/26" = 23 -> "Find N3 ผ่อน 09/26" = 18
  assert.equal(result, "Find N3 ผ่อน 09/26");
  assert.equal(result?.length, 18);
  assert.ok(result.length <= MAX_LINE_CHAT_NICKNAME_LENGTH);

  const resultWithPlus = buildLineChatNickname({
    status: "PURCHASED",
    paymentMethod: "INSTALLMENT",
    recordedAt: "2026-09-01T12:00:00+07:00",
    products: [{ model: { name: "Reno 12+ Pro 5G" } }],
  });
  // "Reno 12+ Pro 5G ผ่อน 09/26" = 26 -> strips 5G -> "Reno 12+ Pro" (23) -> strips + -> "Reno 12 Pro" (22) -> compacts space -> "Reno12Pro" = 20
  assert.equal(resultWithPlus, "Reno12Pro ผ่อน 09/26");
  assert.equal(resultWithPlus?.length, 20);
  assert.ok(resultWithPlus.length <= MAX_LINE_CHAT_NICKNAME_LENGTH);
});

void test("very long unexpected model names truncate ONLY model budget, preserving payment and month/year", () => {
  const result = buildLineChatNickname({
    status: "PURCHASED",
    paymentMethod: "INSTALLMENT",
    recordedAt: "2026-09-01T12:00:00+07:00",
    products: [{ model: { name: "OPPO SuperUltraLongModelName2026 5G" } }],
  });
  // Suffix: " ผ่อน 09/26" = 11. Budget for model = 20 - 11 = 9.
  // Model without 5G/spaces = "SuperUltraLongModelName2026". Truncated to 9: "SuperUltr".
  assert.equal(result, "SuperUltr ผ่อน 09/26");
  assert.equal(result?.length, 20);
  assert.ok(result.endsWith(" ผ่อน 09/26"));
  assert.ok(result.length <= MAX_LINE_CHAT_NICKNAME_LENGTH);
});

void test("Thai payment method and month/year are NEVER removed or truncated", () => {
  const models = [
    "A3",
    "A3s",
    "A78 5G",
    "Reno11 Pro 5G",
    "Find X7 Ultra",
    "A98 5G",
    "OPPO Reno 10 Pro+ 5G",
    "OPPO Find N3 Flip 5G",
    "UnexpectedExtremelyLongModelTitleThatExceedsAllReasonableLimits",
  ];

  for (const model of models) {
    for (const paymentMethod of ["CASH", "INSTALLMENT"] as const) {
      const label = paymentMethod === "CASH" ? "สด" : "ผ่อน";
      const nickname = buildLineChatNickname({
        status: "PURCHASED",
        paymentMethod,
        recordedAt: "2026-09-05T12:00:00+07:00",
        products: [{ model: { name: model } }],
      });

      assert.ok(nickname !== null, `Nickname should not be null for model ${model}`);
      assert.ok(nickname.length <= 20, `Nickname "${nickname}" length ${nickname.length} must be <= 20`);
      assert.ok(nickname.includes(label), `Nickname "${nickname}" must include payment label "${label}"`);
      assert.ok(nickname.endsWith("09/26"), `Nickname "${nickname}" must end with month/year "09/26"`);
    }
  }
});
