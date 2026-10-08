import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sumTagCoverage, tagCoverageByStore, tagCoverageView, UNREAD_NAMES_LABEL, type TagCoverageCounts } from "../src/lib/v2/tag-coverage.ts";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const counts = (total: number, readCount: number, tagged: number, withPeriod: number): TagCoverageCounts => ({
  total, read: readCount, tagged, withPeriod, byType: { online: tagged, source: 0, product: 0, film: 0, payment: 0, finance: 0, period: withPeriod, date: 0 },
});

test("unread names say ยังไม่ได้อ่านชื่อ, never 0%; read names give tagged ÷ read", () => {
  assert.equal(UNREAD_NAMES_LABEL, "ยังไม่ได้อ่านชื่อ");
  assert.deepEqual(tagCoverageView(counts(40, 0, 0, 0)), { kind: "unread", total: 40 });
  assert.deepEqual(tagCoverageView(counts(0, 0, 0, 0)), { kind: "no-chats" });
  assert.equal(tagCoverageView(null), null);
  const view = tagCoverageView(counts(120, 80, 60, 20));
  assert.ok(view && view.kind === "value");
  assert.deepEqual([view.read, view.total], [80, 120]);
  assert.equal(view.tagged.kind, "value");
  assert.equal("value" in view.tagged ? view.tagged.value : null, 75);
  assert.equal(tagCoverageView(counts(40, 3, 3, 0))?.kind, "value", "a few read names still show a (low-sample) rate");
});

test("partner coverage sums its stores", () => {
  const byStore = tagCoverageByStore({
    month: "2026-10", parserVersion: "nickname-parser-v4.0.0", rederiveComplete: true, updatedAt: null, network: counts(0, 0, 0, 0),
    stores: [{ storeUuid: "a", storeId: "1", ...counts(10, 8, 4, 2) }, { storeUuid: "b", storeId: "2", ...counts(5, 0, 0, 0) }],
  });
  const sum = sumTagCoverage([byStore.get("a"), byStore.get("b"), undefined]);
  assert.deepEqual([sum.total, sum.read, sum.tagged, sum.withPeriod, sum.byType.online, sum.byType.period], [15, 8, 4, 2, 4, 2]);
});

// The v2 store list, partner table and drawer were retired (8 Oct 2026); Store 360 shows the coverage.
test("Store 360 reads the backend coverage (Parser v4)", () => {
  const view = read("app/store-360/store-360-monthly.tsx");
  assert.match(view, /const coverage = tagCoverageView\(data\.tagCoverageByStore\.get\(storeId\)\);/);
  assert.doesNotMatch(view, /เป็นค่าต่ำสุด/, "no client-side lower bound");
  assert.match(read("lib/metrics/use-monthly-metrics.tsx"), /\/api-backend\/v2\/tag-coverage\?month=/, "the data layer moved to lib/metrics");
});
