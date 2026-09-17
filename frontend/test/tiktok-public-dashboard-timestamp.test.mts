import assert from "node:assert/strict";
import test from "node:test";
import { formatDashboardTimestamp } from "../src/app/tiktok/tiktok-public-timestamp.ts";

test("formatDashboardTimestamp clearly distinguishes metricDate snapshot from collection timestamp", () => {
  const metricDate = "2026-09-16";
  const lastUpdatedAt = "2026-09-17T03:41:18.550Z";

  const english = formatDashboardTimestamp(metricDate, lastUpdatedAt, "en-US", "en");
  assert.ok(english, "Timestamp label should be generated");
  assert.ok(english.includes("Data for 16 Sep 2026"), `Expected 'Data for 16 Sep 2026' but got: ${english}`);
  assert.ok(english.includes("Updated 17 Sep 2026"), `Expected 'Updated 17 Sep 2026' but got: ${english}`);
  assert.ok(english.includes("10:41"), `Expected Bangkok time '10:41' but got: ${english}`);
  assert.ok(english.includes(" · "), "Parts should be separated by middle dot");

  // Crucial invariant: metric date (16 Sep) must NOT be labeled as updated, and collection date (17 Sep) must NOT be labeled as data date
  assert.doesNotMatch(english, /Data for 17 Sep/);
  assert.doesNotMatch(english, /Updated 16 Sep/);

  const thai = formatDashboardTimestamp(metricDate, lastUpdatedAt, "th-TH", "th");
  assert.ok(thai, "Thai timestamp label should be generated");
  assert.ok(thai.includes("ข้อมูล ณ วันที่"), "Thai data prefix should be present");
  assert.ok(thai.includes("อัปเดต"), "Thai updated prefix should be present");
  assert.ok(thai.includes("16"), "Metric day 16 should be present");
  assert.ok(thai.includes("17"), "Collection day 17 should be present");
});

test("formatDashboardTimestamp handles single timestamps gracefully", () => {
  const metricOnly = formatDashboardTimestamp("2026-09-16", null, "en-US", "en");
  assert.equal(metricOnly, "Data for 16 Sep 2026");

  const updateOnly = formatDashboardTimestamp(null, "2026-09-17T03:41:18.550Z", "en-US", "en");
  assert.ok(updateOnly?.startsWith("Updated 17 Sep 2026"));

  const empty = formatDashboardTimestamp(null, null, "en-US", "en");
  assert.equal(empty, null);
});
