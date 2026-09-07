import assert from "node:assert/strict";
import test from "node:test";
import {
  assertExactTikTokPublicProfile,
  calculateTikTokGrowth,
  getBangkokMetricDate,
} from "./tiktok-public-analytics.service";
import { TikTokPublicProfile } from "./tiktok-public-profile";

function profile(overrides: Partial<TikTokPublicProfile> = {}): TikTokPublicProfile {
  return {
    username: "o_centralworld",
    displayName: "O-Central World",
    avatarUrl: null,
    bioDescription: null,
    isVerified: false,
    followerCount: 13752,
    followingCount: 290,
    likesCount: 99814,
    videoCount: 365,
    profileUrl: "https://www.tiktok.com/@o_centralworld",
    metricSource: "statsV2",
    metricPrecision: "EXACT",
    ...overrides,
  };
}

test("Bangkok metric date uses Asia/Bangkok calendar day", () => {
  assert.equal(getBangkokMetricDate("2026-09-07T17:30:00.000Z"), "2026-09-08");
  assert.equal(getBangkokMetricDate("2026-09-07T01:00:00.000Z"), "2026-09-07");
});

test("exact statsV2 profile is accepted for persistence", () => {
  assert.doesNotThrow(() => assertExactTikTokPublicProfile(profile()));
});

test("rounded display stats are rejected", () => {
  assert.throws(
    () => assertExactTikTokPublicProfile(profile({ metricSource: "stats", metricPrecision: "DISPLAY_ROUNDED" })),
    /not exact/u,
  );
});

test("incomplete or invalid exact metrics are rejected", () => {
  assert.throws(
    () => assertExactTikTokPublicProfile(profile({ followerCount: null })),
    /incomplete or invalid/u,
  );
  assert.throws(
    () => assertExactTikTokPublicProfile(profile({ likesCount: -1 })),
    /incomplete or invalid/u,
  );
});

test("growth returns absolute and percentage change", () => {
  assert.deepEqual(calculateTikTokGrowth(13820, 13751), {
    absolute: 69,
    percent: 0.5,
  });
  assert.deepEqual(calculateTikTokGrowth(100, null), {
    absolute: null,
    percent: null,
  });
  assert.deepEqual(calculateTikTokGrowth(10, 0), {
    absolute: 10,
    percent: null,
  });
});
