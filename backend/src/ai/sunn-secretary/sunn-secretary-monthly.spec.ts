import assert from "node:assert/strict";
import test from "node:test";
import { fetchSecretaryMonthlyAnswer, normalizeMonthlyReplySummary } from "./sunn-secretary-monthly";

const now = new Date("2026-10-08T03:00:00Z");
const sample = { overview: { notReplied: 3 }, stores: [
  { storeId: "a", storeName: "A", notReplied: 1 },
  { storeId: "b", storeName: "B", notReplied: 2 },
  { storeId: "focus-seven-store-group", storeName: "Focus stores", notReplied: 3 },
]};
test("monthly totals exclude synthetic group and rank real stores", () => {
  const x = normalizeMonthlyReplySummary("2026-10", sample, now);
  assert.equal(x.totalUnansweredConversations, 3);
  assert.equal(x.storesWithUnanswered, 2);
  assert.deepEqual(x.stores.map(s=>s.storeId), ["b", "a"]);
});
test("disallows mismatched totals instead of guessing", () => {
  assert.throws(() => normalizeMonthlyReplySummary("2026-10",
    { overview: { notReplied: 4 }, stores: sample.stores }, now), /inconsistent/u);
});
test("forbids absent, global, or empty store scopes before database access", async () => {
  let calls = 0;
  const load = async () => { calls++; return sample; };
  await assert.rejects(fetchSecretaryMonthlyAnswer("2026-10", [], load), /scope/u);
  await assert.rejects(fetchSecretaryMonthlyAnswer("2026-10", null as unknown as string[], load), /scope/u);
  assert.equal(calls, 0);
});
test("passes deduplicated authorized scope into established source", async () => {
  let received: string[] = [];
  const result = await fetchSecretaryMonthlyAnswer("2026-10", ["a","a","b"], async (ids, month) => {
    received = ids;
    assert.equal(month, "2026-10");
    return sample;
  }, now);
  assert.deepEqual(received, ["a","b"]);
  assert.equal(result.calculatedAt, now.toISOString());
});
test("invalid store rows and NaN counts fail closed", () => {
  assert.throws(() => normalizeMonthlyReplySummary("2026-10",
    { overview: { notReplied: 1 }, stores: [{storeId:"a",storeName:"A",notReplied:NaN}] }, now), /Unverifiable/u);
  assert.throws(() => normalizeMonthlyReplySummary("2026-10",
    { overview: { notReplied: 2 }, stores: [{storeId:"a",storeName:"A",notReplied:1},{storeId:"a",storeName:"A",notReplied:1}] }, now), /Unverifiable/u);
});
