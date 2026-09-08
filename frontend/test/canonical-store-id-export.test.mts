import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const exportSource = readFileSync(
  new URL("../src/app/follower-insights/daily-follower-growth-export.ts", import.meta.url),
  "utf8",
);

test("Follower Insights export never falls back to row.storeId internal UUID", () => {
  assert.doesNotMatch(exportSource, /masterStoreId\s*\|\|\s*row\.externalStoreId\s*\|\|\s*row\.storeId/);
  assert.doesNotMatch(exportSource, /masterStoreId\s*\?\?\s*externalStoreId\s*\?\?\s*row\.storeId/);
  assert.match(exportSource, /const canonicalStoreId = masterStoreId \?\? externalStoreId/);
});

test("Follower Insights export fails closed on missing or conflicting canonical Store ID", () => {
  assert.match(exportSource, /Store ID conflict/);
  assert.match(exportSource, /Missing canonical Store ID/);
  assert.match(exportSource, /throw new Error/);
});

test("Follower Insights matrix writes and sorts by canonical Store ID", () => {
  assert.match(exportSource, /storeId: canonicalStoreId/);
  assert.match(exportSource, /a\.canonicalStoreId\.localeCompare\(b\.canonicalStoreId/);
  assert.match(exportSource, /requireCanonicalStoreId\(row\)/);
});
