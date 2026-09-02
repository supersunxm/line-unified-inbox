import assert from "node:assert/strict";
import test from "node:test";
import {
  attachDashboardPeerMetrics,
  calcDashboardPercent,
  extractDashboardPartner,
  getDashboardStoreIssues,
  matchesDashboardStoreFilters,
  type DashboardStoreHealthRow,
} from "./dashboard-executive.service";

test("extractDashboardPartner reads the trailing By partner pattern", () => {
  assert.equal(extractDashboardPartner("OBS Big C Tak By Com7"), "Com7");
  assert.equal(extractDashboardPartner("OBS Lotus Banbueng By TG"), "TG");
  assert.equal(extractDashboardPartner("OBS Central Rayong FL.2"), "ไม่ระบุ");
});

test("calcDashboardPercent never invents a percentage without a denominator", () => {
  assert.equal(calcDashboardPercent(0, 0), null);
  assert.equal(calcDashboardPercent(null, 100), null);
  assert.equal(calcDashboardPercent(80, 100), 80);
  assert.equal(calcDashboardPercent(11, 100), 11);
});

test("watchlist issues are combined per store using the specified thresholds", () => {
  assert.deepEqual(
    getDashboardStoreIssues({ followers: 5, reachPct: 79.9, blockPct: 10.1 }),
    ["inactive", "reach", "block"],
  );
  assert.deepEqual(
    getDashboardStoreIssues({ followers: 500, reachPct: 80, blockPct: 10 }),
    [],
  );
  assert.deepEqual(
    getDashboardStoreIssues({ followers: 500, reachPct: null, blockPct: null }),
    [],
  );
});

test("StoreMaster filters use exact Tier, KPI Plan, Area and BM values", () => {
  const metadata = {
    tier: "Top",
    kpiPlan: "Benchmark",
    area: "BKK-E3A",
    bm: "6002265 Tharinya Srisawat",
  };

  assert.equal(matchesDashboardStoreFilters(metadata, {}), true);
  assert.equal(matchesDashboardStoreFilters(metadata, { tier: "Top", kpiPlan: "Benchmark" }), true);
  assert.equal(matchesDashboardStoreFilters(metadata, { area: "BKK-E3B" }), false);
  assert.equal(matchesDashboardStoreFilters(metadata, { bm: "NO BM" }), false);
});

function peerRow(id: string, storeName: string, kpiPlan: string, followers: number): DashboardStoreHealthRow {
  return {
    storeId: id,
    storeMasterId: `master-${id}`,
    storeCode: id,
    storeName,
    partner: "OPPO",
    tier: "Top",
    kpiPlan,
    area: "BKK-E3A",
    bm: null,
    followers,
    start: followers,
    growth: 0,
    growthPct: 0,
    reach: null,
    reachPct: null,
    blocks: null,
    blockPct: null,
    issues: [],
    peerRank: null,
    peerSize: 0,
    peerAverageFollowers: null,
    needsAttention: false,
    isConnected: true,
  };
}

test("peer ranking compares only stores with the same KPI Plan", () => {
  const ranked = attachDashboardPeerMetrics([
    peerRow("1", "A", "Benchmark", 300),
    peerRow("2", "B", "Benchmark", 100),
    peerRow("3", "C", "BKK by OPPO", 50),
  ]);

  const a = ranked.find((row) => row.storeId === "1");
  const b = ranked.find((row) => row.storeId === "2");
  const c = ranked.find((row) => row.storeId === "3");
  assert.deepEqual([a?.peerRank, a?.peerSize, a?.peerAverageFollowers], [1, 2, 200]);
  assert.deepEqual([b?.peerRank, b?.peerSize, b?.peerAverageFollowers], [2, 2, 200]);
  assert.deepEqual([c?.peerRank, c?.peerSize, c?.peerAverageFollowers], [1, 1, 50]);
});
