import assert from "node:assert/strict";
import test from "node:test";
import {
  calcDashboardPercent,
  extractDashboardPartner,
  getDashboardStoreIssues,
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
