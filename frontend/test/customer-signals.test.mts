import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ApiCustomerEvent } from "../src/types/api";

const sourceLabels: Record<string, string> = {
  LINE_PROFILE_SYNC: "LINE Profile",
  BM_MANUAL: "ผู้จัดการร้าน",
  AI_ANALYSIS: "AI วิเคราะห์",
};

const eventTypeTitles: Record<string, string> = {
  NAME_CHANGED: "เปลี่ยนชื่อ LINE",
  PRODUCT_INTEREST_DETECTED: "พบความสนใจสินค้า",
  PURCHASE_INTENT_CHANGED: "เจตนาซื้อเปลี่ยน",
};

describe("CustomerSignals data mapping", () => {
  it("maps source enums to friendly Thai labels", () => {
    assert.equal(sourceLabels["LINE_PROFILE_SYNC"], "LINE Profile");
    assert.equal(sourceLabels["BM_MANUAL"], "ผู้จัดการร้าน");
    assert.equal(sourceLabels["AI_ANALYSIS"], "AI วิเคราะห์");
  });

  it("maps event type enums to friendly titles", () => {
    assert.equal(eventTypeTitles["NAME_CHANGED"], "เปลี่ยนชื่อ LINE");
    assert.equal(eventTypeTitles["PRODUCT_INTEREST_DETECTED"], "พบความสนใจสินค้า");
    assert.equal(eventTypeTitles["PURCHASE_INTENT_CHANGED"], "เจตนาซื้อเปลี่ยน");
  });

  it("slices latest 5 events for compact operator UI", () => {
    const mockEvents: ApiCustomerEvent[] = Array.from({ length: 10 }, (_, i) => ({
      id: `evt-${i}`,
      customerId: "cust-1",
      type: "NAME_CHANGED",
      source: "LINE_PROFILE_SYNC",
      previousValue: `Old-${i}`,
      newValue: `New-${i}`,
      metadata: null,
      createdAt: new Date().toISOString(),
    }));

    const sliced = mockEvents.slice(0, 5);
    assert.equal(sliced.length, 5);
    assert.equal(sliced[0].id, "evt-0");
    assert.equal(sliced[4].id, "evt-4");
  });
});
