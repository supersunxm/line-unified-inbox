import { describe, expect, it } from "vitest";
import { buildLineChatNickname } from "./line-chat-nickname";

const baseInput = {
  status: "PURCHASED" as const,
  recordedAt: new Date("2026-09-16T08:00:00.000Z"),
  products: [{ model: { name: "OPPO A5" } }],
};

describe("LINE chat installment finance nickname labels", () => {
  it("keeps legacy INSTALLMENT as credit-card installment", () => {
    expect(buildLineChatNickname({ ...baseInput, paymentMethod: "INSTALLMENT" })).toBe("A5 ผ่อน 09/26");
  });

  it("maps explicit credit card to ผ่อน", () => {
    expect(buildLineChatNickname({ ...baseInput, paymentMethod: "CREDIT_CARD" })).toBe("A5 ผ่อน 09/26");
  });

  it("maps Ufund to Ufund", () => {
    expect(buildLineChatNickname({ ...baseInput, paymentMethod: "UFUND" })).toBe("A5 Ufund 09/26");
  });

  it("maps SG Finance to SG", () => {
    expect(buildLineChatNickname({ ...baseInput, paymentMethod: "SG_FINANCE" })).toBe("A5 SG 09/26");
  });
});
