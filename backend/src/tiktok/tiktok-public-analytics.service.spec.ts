import assert from "node:assert/strict";
import test from "node:test";
import {
  assertExactTikTokPublicProfile,
  calculateTikTokGrowth,
  getBangkokMetricDate,
  TikTokPublicAnalyticsService,
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

test("persistExactSnapshot binds shared TikTokPublicAccount to all matching active StoreMaster rows", async () => {
  const initialStores = [
    {
      id: "sm-30679",
      externalStoreId: "30679",
      storeName: "OBS Big C Mahachai By JP",
      tiktokUsername: "oppo.bigcmahachai",
      tiktokProfileUrl: "https://www.tiktok.com/@oppo.bigcmahachai",
      tiktokPublicAccountId: null,
      isActive: true,
    },
    {
      id: "sm-31754",
      externalStoreId: "31754",
      storeName: "OBS Big C Mahachai By JP Store",
      tiktokUsername: "oppo.bigcmahachai",
      tiktokProfileUrl: "https://www.tiktok.com/@oppo.bigcmahachai",
      tiktokPublicAccountId: null,
      isActive: true,
    },
    {
      id: "sm-inactive",
      externalStoreId: "99999",
      storeName: "OBS Big C Mahachai Closed",
      tiktokUsername: "oppo.bigcmahachai",
      tiktokProfileUrl: "https://www.tiktok.com/@oppo.bigcmahachai",
      tiktokPublicAccountId: null,
      isActive: false,
    },
    {
      id: "sm-109",
      externalStoreId: "109",
      storeName: "OBS Seacon Square",
      tiktokUsername: "o_seaconsquaresrinakarin",
      tiktokProfileUrl: "https://www.tiktok.com/@o_seaconsquaresrinakarin",
      tiktokPublicAccountId: null,
      isActive: true,
    },
  ];

  const stores = new Map(initialStores.map((s) => [s.id, { ...s }]));
  const publicAccounts = new Map<string, any>();
  const dailyMetrics = new Map<string, any>();

  const tx: any = {
    tikTokPublicAccount: {
      upsert: async ({ where, create, update }: any) => {
        const existing = publicAccounts.get(where.username);
        if (existing) {
          const updated = { ...existing, ...update };
          publicAccounts.set(where.username, updated);
          return updated;
        }
        const created = { id: `pub-${where.username}`, ...create };
        publicAccounts.set(where.username, created);
        return created;
      },
    },
    storeMaster: {
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const store of stores.values()) {
          let matches = false;
          if (where.OR && Array.isArray(where.OR)) {
            for (const cond of where.OR) {
              if (cond.id && store.id === cond.id) {
                matches = true;
                break;
              }
              if (cond.isActive && !store.isActive) {
                continue;
              }
              if (cond.tiktokUsername?.equals) {
                const target = String(cond.tiktokUsername.equals).toLowerCase();
                const actual = String(store.tiktokUsername || "").toLowerCase();
                if (target === actual) {
                  matches = true;
                  break;
                }
              }
            }
          }
          if (matches) {
            Object.assign(store, data);
            count++;
          }
        }
        return { count };
      },
    },
    tikTokPublicDailyMetric: {
      upsert: async ({ where, create, update }: any) => {
        const key = `${where.tiktokPublicAccountId_metricDate.tiktokPublicAccountId}:${where.tiktokPublicAccountId_metricDate.metricDate.toISOString()}`;
        const existing = dailyMetrics.get(key);
        if (existing) {
          const updated = { ...existing, ...update };
          dailyMetrics.set(key, updated);
          return updated;
        }
        const created = { id: `metric-${key}`, ...create };
        dailyMetrics.set(key, created);
        return created;
      },
    },
  };

  const fakePrisma: any = {
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(tx),
  };

  const service = new TikTokPublicAnalyticsService(fakePrisma);

  const probeResult = {
    status: "OK" as const,
    source: "TOKCOUNTER" as const,
    fetchedAt: "2026-09-18T02:30:00.000Z",
    profile: profile({
      username: "oppo.bigcmahachai",
      displayName: "OPPO Big C Mahachai",
      profileUrl: "https://www.tiktok.com/@oppo.bigcmahachai",
      followerCount: 2269,
      followingCount: 162,
      likesCount: 11100,
      videoCount: 147,
      metricSource: "statsV2",
      metricPrecision: "EXACT",
    }),
    diagnostics: {
      category: "OK",
      statusCode: 200,
      finalUrl: "https://tokcounter.com/?user=oppo.bigcmahachai",
      bodyLength: 1000,
      htmlSnippet: "",
      message: null,
    },
  };

  // Persist targeting Store 30679
  const res = await service.persistExactSnapshot(
    {
      id: "sm-30679",
      tiktokUsername: "oppo.bigcmahachai",
      tiktokProfileUrl: "https://www.tiktok.com/@oppo.bigcmahachai",
    },
    probeResult,
  );

  assert.equal(res.username, "oppo.bigcmahachai");
  assert.equal(res.followerCount, 2269);

  // Both Store 30679 and Store 31754 MUST be linked to pub-oppo.bigcmahachai
  assert.equal(stores.get("sm-30679")?.tiktokPublicAccountId, "pub-oppo.bigcmahachai");
  assert.equal(stores.get("sm-31754")?.tiktokPublicAccountId, "pub-oppo.bigcmahachai");

  // Inactive store must NOT be auto-bound
  assert.equal(stores.get("sm-inactive")?.tiktokPublicAccountId, null);

  // Unrelated active store must NOT be auto-bound
  assert.equal(stores.get("sm-109")?.tiktokPublicAccountId, null);
});

test("persistExactSnapshot matches @-prefixed handles and is idempotent", async () => {
  const initialStores = [
    {
      id: "sm-27837",
      externalStoreId: "27837",
      storeName: "OBS Taweekit Buriram By TG 2",
      tiktokUsername: "o_taweekitburiram",
      tiktokProfileUrl: "https://www.tiktok.com/@o_taweekitburiram",
      tiktokPublicAccountId: null,
      isActive: true,
    },
    {
      id: "sm-27368",
      externalStoreId: "27368",
      storeName: "OBS Taweekit Buriram By TG",
      tiktokUsername: "@O_TAWEEKITBURIRAM",
      tiktokProfileUrl: "https://www.tiktok.com/@o_taweekitburiram",
      tiktokPublicAccountId: null,
      isActive: true,
    },
  ];

  const stores = new Map(initialStores.map((s) => [s.id, { ...s }]));
  const publicAccounts = new Map<string, any>();
  const dailyMetrics = new Map<string, any>();

  const tx: any = {
    tikTokPublicAccount: {
      upsert: async ({ where, create, update }: any) => {
        const existing = publicAccounts.get(where.username);
        if (existing) {
          const updated = { ...existing, ...update };
          publicAccounts.set(where.username, updated);
          return updated;
        }
        const created = { id: `pub-${where.username}`, ...create };
        publicAccounts.set(where.username, created);
        return created;
      },
    },
    storeMaster: {
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const store of stores.values()) {
          let matches = false;
          if (where.OR && Array.isArray(where.OR)) {
            for (const cond of where.OR) {
              if (cond.id && store.id === cond.id) {
                matches = true;
                break;
              }
              if (cond.isActive && !store.isActive) {
                continue;
              }
              if (cond.tiktokUsername?.equals) {
                const target = String(cond.tiktokUsername.equals).toLowerCase();
                const actual = String(store.tiktokUsername || "").toLowerCase();
                if (target === actual) {
                  matches = true;
                  break;
                }
              }
            }
          }
          if (matches) {
            Object.assign(store, data);
            count++;
          }
        }
        return { count };
      },
    },
    tikTokPublicDailyMetric: {
      upsert: async ({ where, create, update }: any) => {
        const key = `${where.tiktokPublicAccountId_metricDate.tiktokPublicAccountId}:${where.tiktokPublicAccountId_metricDate.metricDate.toISOString()}`;
        const existing = dailyMetrics.get(key);
        if (existing) {
          const updated = { ...existing, ...update };
          dailyMetrics.set(key, updated);
          return updated;
        }
        const created = { id: `metric-${key}`, ...create };
        dailyMetrics.set(key, created);
        return created;
      },
    },
  };

  const fakePrisma: any = {
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(tx),
  };

  const service = new TikTokPublicAnalyticsService(fakePrisma);

  const probeResult = {
    status: "OK" as const,
    source: "TOKCOUNTER" as const,
    fetchedAt: "2026-09-18T02:30:00.000Z",
    profile: profile({
      username: "o_taweekitburiram",
      displayName: "OPPO Taweekit",
      profileUrl: "https://www.tiktok.com/@o_taweekitburiram",
      followerCount: 5000,
      followingCount: 100,
      likesCount: 20000,
      videoCount: 50,
      metricSource: "statsV2",
      metricPrecision: "EXACT",
    }),
    diagnostics: {
      category: "OK",
      statusCode: 200,
      finalUrl: "https://tokcounter.com/?user=o_taweekitburiram",
      bodyLength: 1000,
      htmlSnippet: "",
      message: null,
    },
  };

  // Run 1
  await service.persistExactSnapshot(
    {
      id: "sm-27837",
      tiktokUsername: "o_taweekitburiram",
      tiktokProfileUrl: "https://www.tiktok.com/@o_taweekitburiram",
    },
    probeResult,
  );

  assert.equal(stores.get("sm-27837")?.tiktokPublicAccountId, "pub-o_taweekitburiram");
  assert.equal(stores.get("sm-27368")?.tiktokPublicAccountId, "pub-o_taweekitburiram");
  assert.equal(publicAccounts.size, 1);
  assert.equal(dailyMetrics.size, 1);

  // Run 2 (Idempotency check)
  await service.persistExactSnapshot(
    {
      id: "sm-27368",
      tiktokUsername: "@O_TAWEEKITBURIRAM",
      tiktokProfileUrl: "https://www.tiktok.com/@o_taweekitburiram",
    },
    probeResult,
  );

  assert.equal(stores.get("sm-27837")?.tiktokPublicAccountId, "pub-o_taweekitburiram");
  assert.equal(stores.get("sm-27368")?.tiktokPublicAccountId, "pub-o_taweekitburiram");
  assert.equal(publicAccounts.size, 1);
  assert.equal(dailyMetrics.size, 1);
});

