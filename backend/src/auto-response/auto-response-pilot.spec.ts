import assert from "node:assert/strict";
import test from "node:test";
import { matchPilotInboundText, normalizePilotText } from "./auto-response-pilot";

test("normalizes Unicode whitespace and Latin casing without fuzzy matching", () => {
  assert.equal(normalizePilotText("  ร้านอยู่ที่ไหน\nABC  "), "ร้านอยู่ที่ไหน abc");
  assert.equal(matchPilotInboundText("ร้านอยู่ที่ไหนครับ").intent, "STORE_LOCATION");
});

test("matches approved location phrases", () => {
  for (const text of [
    "ร้านอยู่ที่ไหนครับ",
    "ร้านตั่งอยู่ไหนครับ",
    "ขอพิกัดร้านหน่อยครับ",
    "หน้าร้านอยู่ตรงไหนคะ",
    "ชั้นไหน",
  ]) {
    const result = matchPilotInboundText(text);
    assert.equal(result.outcome, "MATCHED", text);
    assert.equal(result.intent, "STORE_LOCATION", text);
  }
});

test("does not match generic location statements or broad branch questions", () => {
  for (const text of ["หน้าร้าน", "เดี๋ยวเข้าไปดูหน้าร้าน", "มีสาขาไหนบ้างครับ", "ร้าน"]) {
    const result = matchPilotInboundText(text);
    assert.notEqual(result.outcome, "MATCHED", text);
  }
});

test("matches only high-confidence finance phrases", () => {
  for (const text of [
    "สนใจผ่อนค่ะ",
    "ผ่อนยังไงครับ",
    "ผ่อนต้องใช้อะไรบ้างครับ",
    "สมัครสินเชื่อยังไงครับ",
    "ต้องใช้คนค้ำไหม",
    "เครดิตบูโรคืออะไร",
  ]) {
    const result = matchPilotInboundText(text);
    assert.equal(result.outcome, "MATCHED", text);
    assert.equal(result.intent, "FINANCE_INFO", text);
  }
});

test("observes but excludes bare finance and online-finance phrases", () => {
  for (const text of ["ผ่อนค่ะ", "ผ่อนครับ", "ผ่อนคับ", "ผ่อนออนไลน์ได้ไหมคะ"]) {
    const result = matchPilotInboundText(text);
    assert.equal(result.outcome, "EXCLUDED", text);
    assert.equal(result.intent, undefined, text);
  }
});

test("blocks amount, term, price, product and availability questions", () => {
  for (const text of [
    "ดาวน์เท่าไหร่คะ",
    "ดาวน์กี่บาทคะ",
    "ผ่อนเดือนละเท่าไหร่ครับ",
    "ผ่อนกี่เดือน",
    "รุ่นนี้ผ่อนเดือนละเท่าไหร่",
    "มีสีดำไหม",
    "ราคาเท่าไหร่",
  ]) {
    const result = matchPilotInboundText(text);
    assert.equal(result.outcome, "EXCLUDED", text);
  }
});

test("rejects ambiguous location and finance messages", () => {
  const result = matchPilotInboundText("ร้านอยู่ตรงไหนและสมัครสินเชื่อยังไงครับ");
  assert.equal(result.outcome, "AMBIGUOUS");
  assert.equal(result.reason, "MULTIPLE_INTENTS");
});
