import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildLineChatNickname } from "./line-chat-nickname";

const baseInput = {
  status: "PURCHASED" as const,
  recordedAt: new Date("2026-09-16T08:00:00.000Z"),
  products: [{ model: { name: "OPPO A5" } }],
};

describe("LINE chat installment finance nickname labels", () => {
  it("keeps legacy INSTALLMENT as credit-card installment", () => {
    assert.equal(buildLineChatNickname({ ...baseInput, paymentMethod: "INSTALLMENT" }), "A5 ผ่อน 09/26");
  });

  it("maps explicit credit card to ผ่อน", () => {
    assert.equal(buildLineChatNickname({ ...baseInput, paymentMethod: "CREDIT_CARD" }), "A5 ผ่อน 09/26");
  });

  it("maps Ufund to Ufund", () => {
    assert.equal(buildLineChatNickname({ ...baseInput, paymentMethod: "UFUND" }), "A5 Ufund 09/26");
  });

  it("maps SG Finance to SG", () => {
    assert.equal(buildLineChatNickname({ ...baseInput, paymentMethod: "SG_FINANCE" }), "A5 SG 09/26");
  });
});
