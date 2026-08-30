import assert from "node:assert/strict";
import test from "node:test";
import { buildLineChatNickname } from "./line-chat-nickname";

void test("online status maps to Online", () => {
  assert.equal(buildLineChatNickname({ status: "ONLINE" }), "Online");
});

void test("cash purchase uses model, สด, and recorded month/year", () => {
  assert.equal(buildLineChatNickname({
    status: "PURCHASED",
    paymentMethod: "CASH",
    recordedAt: "2026-08-30T12:00:00+07:00",
    products: [{ model: { name: "OPPO Find X9" } }],
  }), "Find X9 สด 08/26");
});

void test("installment purchase uses custom product name when present", () => {
  assert.equal(buildLineChatNickname({
    status: "PURCHASED",
    paymentMethod: "INSTALLMENT",
    recordedAt: "2026-09-02T10:00:00+07:00",
    products: [{ customProductName: "Reno14 Pro", model: { name: "OPPO Reno14 Pro 5G" } }],
  }), "Reno14 Pro ผ่อน 09/26");
});

void test("month/year follows Bangkok time at a UTC month boundary", () => {
  assert.equal(buildLineChatNickname({
    status: "PURCHASED",
    paymentMethod: "CASH",
    recordedAt: "2026-08-31T17:30:00.000Z",
    products: [{ model: { name: "Find X9" } }],
  }), "Find X9 สด 09/26");
});

void test("interested status does not change nickname", () => {
  assert.equal(buildLineChatNickname({ status: "INTERESTED" }), null);
});

void test("purchase nickname is not emitted when required data is incomplete", () => {
  assert.equal(buildLineChatNickname({ status: "PURCHASED", paymentMethod: "CASH", recordedAt: "2026-08-30T12:00:00+07:00" }), null);
  assert.equal(buildLineChatNickname({ status: "PURCHASED", paymentMethod: "OTHER", recordedAt: "2026-08-30T12:00:00+07:00", products: [{ model: { name: "Find X9" } }] }), null);
});
