import assert from "node:assert/strict";
import test from "node:test";
import {
  getTikTokDemoGrowthMetrics,
  isTikTokDemoGrowthEnabled,
} from "../src/app/tiktok/dashboard/tiktok-demo-growth.ts";

test("isTikTokDemoGrowthEnabled respects environment variable flag and defaults false", () => {
  const origEnv = process.env.NEXT_PUBLIC_TIKTOK_DEMO_GROWTH;

  try {
    delete process.env.NEXT_PUBLIC_TIKTOK_DEMO_GROWTH;
    assert.equal(isTikTokDemoGrowthEnabled(), false);

    process.env.NEXT_PUBLIC_TIKTOK_DEMO_GROWTH = "false";
    assert.equal(isTikTokDemoGrowthEnabled(), false);

    process.env.NEXT_PUBLIC_TIKTOK_DEMO_GROWTH = "0";
    assert.equal(isTikTokDemoGrowthEnabled(), false);

    process.env.NEXT_PUBLIC_TIKTOK_DEMO_GROWTH = "true";
    assert.equal(isTikTokDemoGrowthEnabled(), true);

    process.env.NEXT_PUBLIC_TIKTOK_DEMO_GROWTH = "1";
    assert.equal(isTikTokDemoGrowthEnabled(), true);
  } finally {
    if (origEnv !== undefined) {
      process.env.NEXT_PUBLIC_TIKTOK_DEMO_GROWTH = origEnv;
    } else {
      delete process.env.NEXT_PUBLIC_TIKTOK_DEMO_GROWTH;
    }
  }
});

test("getTikTokDemoGrowthMetrics generates accurate Central World baseline values and 30-day history", () => {
  const data = getTikTokDemoGrowthMetrics("acc-central-world");

  assert.equal(data.accountId, "acc-central-world");
  assert.equal(data.history.length, 30);

  // 1. Current followers and growth deltas match requirements exactly
  assert.equal(data.summary.currentFollowerCount, 13342);
  assert.equal(data.summary.dailyFollowerGrowth, 47);
  assert.equal(data.summary.sevenDayFollowerGrowth, 286);
  assert.equal(data.summary.thirtyDayFollowerGrowth, 1124);

  // 2. Latest daily snapshot matches current followers count
  const latestSnapshot = data.history[data.history.length - 1];
  assert.equal(latestSnapshot.followerCount, 13342);

  // 3. Yesterday snapshot matches current - 47
  const yesterdaySnapshot = data.history[data.history.length - 2];
  assert.equal(yesterdaySnapshot.followerCount, 13342 - 47); // 13,295

  // 4. 7 days ago snapshot matches current - 286
  const sevenDaysAgoSnapshot = data.history[data.history.length - 8];
  assert.equal(sevenDaysAgoSnapshot.followerCount, 13342 - 286); // 13,056

  // 5. 30 days ago baseline snapshot matches current - 1,124
  const thirtyDaysAgoSnapshot = data.history[0];
  assert.equal(thirtyDaysAgoSnapshot.followerCount, 13342 - 1124); // 12,218

  // 6. Chronological ordering
  for (let i = 1; i < data.history.length; i++) {
    const prevTime = new Date(data.history[i - 1].metricDate).getTime();
    const currTime = new Date(data.history[i].metricDate).getTime();
    assert.ok(currTime > prevTime, "Snapshots must be strictly chronological");
  }
});
