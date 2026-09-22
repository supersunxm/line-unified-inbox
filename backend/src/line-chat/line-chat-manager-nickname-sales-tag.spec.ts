import assert from "node:assert/strict";
import test from "node:test";
import { parseManagerNicknameSalesTag, nicknamePeriodDate } from "./line-chat-manager-nickname-sales-tag";

test("parses known online nickname formats conservatively", () => {
  assert.deepEqual(parseManagerNicknameSalesTag("TikTok 09/26"), {
    status: "ONLINE",
    onlineSource: "TikTok",
    period: { month: 9, year: 2026 },
  });
  assert.deepEqual(parseManagerNicknameSalesTag("IG 09/26"), {
    status: "ONLINE",
    onlineSource: "Instagram",
    period: { month: 9, year: 2026 },
  });
  assert.deepEqual(parseManagerNicknameSalesTag("Online"), {
    status: "ONLINE",
    onlineSource: null,
    period: null,
  });
  assert.equal(parseManagerNicknameSalesTag("John 09/26"), null);
});

test("parses film nickname format", () => {
  assert.deepEqual(parseManagerNicknameSalesTag("Film/iPhone/09/26"), {
    status: "FILM",
    filmBrand: "iPhone",
    period: { month: 9, year: 2026 },
  });
  assert.equal(parseManagerNicknameSalesTag("Film//09/26"), null);
});

test("parses purchased nickname format and payment labels", () => {
  assert.deepEqual(parseManagerNicknameSalesTag("Reno16 สด 09/26"), {
    status: "PURCHASED",
    modelToken: "Reno16",
    paymentMethod: "CASH",
    period: { month: 9, year: 2026 },
  });
  assert.deepEqual(parseManagerNicknameSalesTag("Reno16Pro ผ่อน 09/26"), {
    status: "PURCHASED",
    modelToken: "Reno16Pro",
    paymentMethod: "INSTALLMENT",
    period: { month: 9, year: 2026 },
  });
  assert.deepEqual(parseManagerNicknameSalesTag("A7Pro Ufund 09/26"), {
    status: "PURCHASED",
    modelToken: "A7Pro",
    paymentMethod: "UFUND",
    period: { month: 9, year: 2026 },
  });
  assert.deepEqual(parseManagerNicknameSalesTag("A7Pro SG 09/26"), {
    status: "PURCHASED",
    modelToken: "A7Pro",
    paymentMethod: "SG_FINANCE",
    period: { month: 9, year: 2026 },
  });
});

test("rejects invalid or ambiguous-looking arbitrary names", () => {
  assert.equal(parseManagerNicknameSalesTag("Alice"), null);
  assert.equal(parseManagerNicknameSalesTag("TikTok 13/26"), null);
  assert.equal(parseManagerNicknameSalesTag("Reno16 cash 09/26"), null);
  assert.equal(parseManagerNicknameSalesTag("Facebook 9/26"), null);
});

test("nicknamePeriodDate stays in the encoded Bangkok month", () => {
  const date = nicknamePeriodDate({ month: 9, year: 2026 });
  const monthYear = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
  assert.equal(monthYear, "09/26");
});
