import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { chatMonthFromDate, parseChatMonth } from "./chat-month";

void test("September 2026 Bangkok month uses Bangkok midnight boundaries", () => {
  const range = parseChatMonth("2026-09");
  assert.ok(range);
  assert.equal(range.month, "2026-09");
  assert.equal(range.start.toISOString(), "2026-08-31T17:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-09-30T17:00:00.000Z");
});

void test("December rolls into January correctly", () => {
  const range = parseChatMonth("2026-12");
  assert.ok(range);
  assert.equal(range.start.toISOString(), "2026-11-30T17:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-12-31T17:00:00.000Z");
});

void test("missing month means no month filter", () => {
  assert.equal(parseChatMonth(undefined), null);
  assert.equal(parseChatMonth(""), null);
});

void test("invalid month values are rejected", () => {
  for (const value of ["2026-00", "2026-13", "26-09", "2026-9", "September"]) {
    assert.throws(() => parseChatMonth(value), BadRequestException);
  }
});

void test("chatMonthFromDate assigns UTC instants using Bangkok local month", () => {
  assert.equal(chatMonthFromDate(new Date("2026-08-31T16:59:59.999Z")), "2026-08");
  assert.equal(chatMonthFromDate(new Date("2026-08-31T17:00:00.000Z")), "2026-09");
});
