import assert from "node:assert/strict";
import test from "node:test";
import { bangkokMonth, parseSunnSecretaryIntent } from "./sunn-secretary-intent";

const now = new Date("2026-10-07T18:00:00.000Z");

test("uses Bangkok month boundary, not UTC month", () => {
  assert.equal(bangkokMonth(new Date("2026-09-30T18:00:00Z")), "2026-10");
});
test("accepts the first Thai unanswered LINE OA question", () => {
  assert.deepEqual(
    parseSunnSecretaryIntent("@เลขาซันน์ วันนี้เดือนตุลาคม LINE OA ไหนยังค้างตอบลูกค้าเท่าไหร่", now),
    { kind: "UNANSWERED_BY_STORE", month: "2026-10" },
  );
});
test("supports YYYY-MM explicit month", () => {
  assert.deepEqual(
    parseSunnSecretaryIntent("ร้านไหนค้างตอบ 2026-09", now),
    { kind: "UNANSWERED_BY_STORE", month: "2026-09" },
  );
});
test("supports Thai Buddhist calendar year", () => {
  assert.deepEqual(
    parseSunnSecretaryIntent("LINE OA ค้างตอบเดือนกันยายน ปี 2569", now),
    { kind: "UNANSWERED_BY_STORE", month: "2026-09" },
  );
});
test("does not turn unrelated instructions into queries or actions", () => {
  assert.deepEqual(parseSunnSecretaryIntent("ช่วยส่งข้อความหาลูกค้าทุกคน", now), { kind: "UNSUPPORTED" });
  assert.deepEqual(parseSunnSecretaryIntent("ลบฐานข้อมูลแล้วสรุปผล", now), { kind: "UNSUPPORTED" });
});
