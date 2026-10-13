import assert from "node:assert/strict";
import test from "node:test";
import { fetchSecretaryMonthlyAnswer, normalizeMonthlyReplySummary } from "./sunn-secretary-monthly";

const now = new Date("2026-10-08T03:00:00Z");
const sample = { overview: { total: 3, notReplied: 3 }, stores: [
  { storeId: "a", storeName: "A", total: 1, notReplied: 1 },
  { storeId: "b", storeName: "B", total: 2, notReplied: 2 },
  { storeId: "focus-seven-store-group", storeName: "Focus stores", total: 3, notReplied: 3 },
], dataQuality: {
  sourceConversationCount: 3, rowBudgetExceeded: false, unmappedStoreConversationCount: 0,
  lineOaStoreIdentityMismatchCount: 0, inactiveLineOaConversationCount: 0,
  replyProjectionConversationCount: 3, replyProjectionMissingCount: 0, replyProjectionStaleCount: 0,
  replyProjectionUnknownVersionCount: 0,
}};
test("monthly totals exclude synthetic group and rank real stores", () => {
  const x = normalizeMonthlyReplySummary("2026-10", sample, now);
  assert.equal(x.totalUnansweredConversations, 3);
  assert.equal(x.storesWithUnanswered, 2);
  assert.deepEqual(x.stores.map(s=>s.storeId), ["b", "a"]);
});
test("disallows mismatched totals instead of guessing", () => {
  assert.throws(() => normalizeMonthlyReplySummary("2026-10",
    { ...sample, overview: { total: 3, notReplied: 4 } }, now), /inconsistent/u);
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
    { ...sample, overview: { total: 1, notReplied: 1 }, stores: [{storeId:"a",storeName:"A",total:1,notReplied:NaN}] }, now), /unverified|Unverifiable/u);
  assert.throws(() => normalizeMonthlyReplySummary("2026-10",
    { ...sample, overview: { total: 2, notReplied: 2 }, stores: [{storeId:"a",storeName:"A",total:1,notReplied:1},{storeId:"a",storeName:"A",total:1,notReplied:1}] }, now), /unverified|Unverifiable/u);
});

test("projection gaps, stale projection, source truncation and missing identities fail closed", () => {
  for (const dataQuality of [
    { ...sample.dataQuality, replyProjectionMissingCount: 1 },
    { ...sample.dataQuality, replyProjectionStaleCount: 1 },
    { ...sample.dataQuality, rowBudgetExceeded: true },
    { ...sample.dataQuality, unmappedStoreConversationCount: 1 },
    { ...sample.dataQuality, lineOaStoreIdentityMismatchCount: 1 },
    { ...sample.dataQuality, inactiveLineOaConversationCount: 1 },
  ]) {
    assert.throws(() => normalizeMonthlyReplySummary("2026-10", { ...sample, dataQuality }, now), /unverified/u);
  }
});

test("synthetic focus aggregate must match the underlying unique store rows", () => {
  assert.throws(() => normalizeMonthlyReplySummary("2026-10", {
    ...sample,
    stores: sample.stores.map(row => row.storeId === "focus-seven-store-group" ? { ...row, total: 4 } : row),
  }, now), /inconsistent/u);
});
