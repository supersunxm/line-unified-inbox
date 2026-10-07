import assert from "node:assert/strict";
import test from "node:test";
import { countState, deltaState, formatValue, meetsSample, MIN_RATE_SAMPLE, rateState, valueReason } from "../src/lib/v2/value-state.ts";

test("a count is 0 only when the source loaded and counted zero", () => {
  assert.deepEqual(countState(0), { kind: "true-zero", value: 0 });
  assert.deepEqual(countState(5), { kind: "value", value: 5 });
  assert.equal(countState(null).kind, "failed");
  assert.equal(countState(undefined, { loading: true }).kind, "loading");
  assert.equal(countState(0, { error: "500" }).kind, "failed");
  assert.equal(countState(3, { collected: false }).kind, "not-collected");
});

test("unknown never renders as 0 and every dash has a reason", () => {
  for (const state of [countState(null), countState(undefined, { loading: true }), countState(0, { collected: false }), rateState(0, 0), { kind: "not-applicable" } as const]) {
    const formatted = formatValue(state, "percent");
    assert.notEqual(formatted.text, "0");
    assert.notEqual(formatted.text, "0.0%");
    assert.ok(formatted.reason, `${state.kind} needs a reason`);
  }
  assert.equal(formatValue(countState(0)).text, "0");
  assert.equal(formatValue(countState(0)).reason, null);
  assert.equal(formatValue(rateState(0, 0), "percent").reason, "ไม่มีแชทในช่วงนี้");
  assert.equal(formatValue(countState(0, { collected: false })).reason, "ระบบยังไม่ได้เก็บข้อมูลช่วงนี้");
});

test("rates below MIN_RATE_SAMPLE are low sample: value kept, muted, n shown, no target colour", () => {
  assert.equal(MIN_RATE_SAMPLE, 10);
  const low = rateState(4, 5);
  assert.deepEqual(low, { kind: "low-sample", value: 80, n: 5 });
  assert.equal(meetsSample(low), false);
  const formatted = formatValue(low, "percent");
  assert.equal(formatted.text, "80.0%");
  assert.equal(formatted.muted, true);
  assert.match(formatted.reason ?? "", /n=5/);
  const enough = rateState(9, 10);
  assert.deepEqual(enough, { kind: "value", value: 90, n: 10 });
  assert.equal(meetsSample(enough), true);
  assert.deepEqual(rateState(0, 12), { kind: "true-zero", value: 0, n: 12 });
});

test("deltas carry the reason of the side that is missing", () => {
  assert.deepEqual(deltaState(countState(7), countState(4)), { kind: "value", value: 3 });
  assert.deepEqual(deltaState(countState(4), countState(4)), { kind: "true-zero", value: 0 });
  assert.equal(deltaState(countState(7), countState(0, { collected: false })).kind, "not-collected");
  assert.equal(deltaState(countState(7), countState(null)).kind, "failed");
  assert.equal(deltaState(rateState(1, 2), rateState(9, 10)).kind, "low-sample");
  assert.equal(deltaState(rateState(0, 0), rateState(9, 10)).kind, "no-activity");
  assert.equal(valueReason(countState(3)), null);
});
