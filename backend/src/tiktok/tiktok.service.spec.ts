import assert from "node:assert/strict";
import test from "node:test";
import {
  TikTokService,
  normalizeTikTokUsernameForMatching,
} from "./tiktok.service";

test("normalizeTikTokUsernameForMatching sanitizes username correctly", () => {
  // 1. Exact lowercase
  assert.equal(normalizeTikTokUsernameForMatching("oppothailand"), "oppothailand");
  // 2. Specific test cases requested
  assert.equal(normalizeTikTokUsernameForMatching(" @o_centralworld "), "o_centralworld");
  assert.equal(normalizeTikTokUsernameForMatching("@O_CENTRALWORLD"), "o_centralworld");
  assert.equal(normalizeTikTokUsernameForMatching("   "), null);
  // 3. Leading @ and multiple @ stripped
  assert.equal(normalizeTikTokUsernameForMatching("@oppo_centralworld"), "oppo_centralworld");
  assert.equal(normalizeTikTokUsernameForMatching("@@@oppo_centralworld"), "oppo_centralworld");
  // 4. Case insensitive normalization
  assert.equal(normalizeTikTokUsernameForMatching("OPPO_CentralWorld"), "oppo_centralworld");
  // 5. Whitespace trimming with @
  assert.equal(normalizeTikTokUsernameForMatching("  @OPPO_CentralWorld  "), "oppo_centralworld");
  // 6. Empty, #REF!, none, null -> null
  assert.equal(normalizeTikTokUsernameForMatching(""), null);
  assert.equal(normalizeTikTokUsernameForMatching("#REF!"), null);
  assert.equal(normalizeTikTokUsernameForMatching("none"), null);
  assert.equal(normalizeTikTokUsernameForMatching(null), null);
  assert.equal(normalizeTikTokUsernameForMatching(undefined), null);
});

test("TikTokService auto-binds StoreMaster and handles reconciliation safely", async () => {
  const accountsDb = new Map<string, any>();
  const videosDb = new Map<string, any>();
  const storeMasterDb = new Map<string, any>([
    [
      "store-cw-1",
      {
        id: "store-cw-1",
        storeName: "OPPO Brand Shop Central World",
        accountName: "Central World (4F)",
        tiktokUsername: "oppo_centralworld",
        province: "Bangkok",
        region: "Central",
      },
    ],
    [
      "store-ambig-1",
      {
        id: "store-ambig-1",
        storeName: "OPPO Store Rama 9 A",
        accountName: "Rama 9 A",
        tiktokUsername: "oppo_rama9",
        province: "Bangkok",
        region: "Central",
      },
    ],
    [
      "store-ambig-2",
      {
        id: "store-ambig-2",
        storeName: "OPPO Store Rama 9 B",
        accountName: "Rama 9 B",
        tiktokUsername: "@OPPO_RAMA9",
        province: "Bangkok",
        region: "Central",
      },
    ],
  ]);

  const fakePrisma: any = {
    storeMaster: {
      findMany: async ({ where }: any) => {
        const all = Array.from(storeMasterDb.values());
        if (!where) return all;
        if (where.OR) {
          const targetUsernames = where.OR.map((o: any) =>
            String(o.tiktokUsername?.equals || "").toLowerCase()
          );
          return all.filter((s) => {
            const current = String(s.tiktokUsername || "").toLowerCase();
            return targetUsernames.includes(current);
          });
        }
        return all;
      },
    },
    tikTokAccount: {
      upsert: async ({ where, create, update }: any) => {
        const existing = accountsDb.get(where.openId);
        const record = existing
          ? { ...existing, ...update, id: existing.id }
          : { ...create, id: "acc-uuid-1" };
        accountsDb.set(where.openId, record);
        return record;
      },
      findUnique: async ({ where }: any) => {
        return accountsDb.get(where.openId) || null;
      },
      findFirst: async () => {
        const accounts = Array.from(accountsDb.values());
        if (accounts.length === 0) return null;
        const latest = accounts[accounts.length - 1];
        const videos = Array.from(videosDb.values()).filter(
          (v) => v.tikTokAccountId === latest.id
        );
        const store = latest.storeMasterId ? storeMasterDb.get(latest.storeMasterId) : null;
        return {
          ...latest,
          videos,
          storeMaster: store || null,
        };
      },
      findMany: async ({ where }: any) => {
        let list = Array.from(accountsDb.values());
        if (where && "storeMasterId" in where && where.storeMasterId === null) {
          list = list.filter((a) => a.storeMasterId === null || a.storeMasterId === undefined);
        }
        return list.map((a) => {
          const store = a.storeMasterId ? storeMasterDb.get(a.storeMasterId) : null;
          return {
            ...a,
            storeMaster: store || null,
            _count: {
              videos: Array.from(videosDb.values()).filter(
                (v) => v.tikTokAccountId === a.id
              ).length,
            },
          };
        });
      },
      update: async ({ where, data }: any) => {
        for (const [key, acc] of accountsDb.entries()) {
          if (acc.id === where.id) {
            const updated = { ...acc, ...data };
            accountsDb.set(key, updated);
            return updated;
          }
        }
        throw new Error("Account not found");
      },
    },
    tikTokVideo: {
      upsert: async ({ where, create, update }: any) => {
        const key = `${where.tikTokAccountId_tikTokVideoId.tikTokAccountId}:${where.tikTokAccountId_tikTokVideoId.tikTokVideoId}`;
        const existing = videosDb.get(key);
        const record = existing
          ? { ...existing, ...update }
          : { ...create, id: `video-${key}` };
        videosDb.set(key, record);
        return record;
      },
    },
    tikTokAccountDailyMetric: {
      upsert: async () => ({}),
    },
  };

  const fakeEncryption: any = {
    encrypt: (val: string) => `encrypted:${val}`,
    decrypt: (val: string) => val.replace("encrypted:", ""),
  };

  const service = new TikTokService(fakePrisma, fakeEncryption);

  // 1. Test resolution logic directly
  const matchCw = await service.resolveStoreMasterIdByTikTokUsername("@OPPO_CentralWorld");
  assert.equal(matchCw.status, "MATCHED");
  assert.equal(matchCw.storeMasterId, "store-cw-1");
  assert.equal(matchCw.matchedCount, 1);

  const matchNone = await service.resolveStoreMasterIdByTikTokUsername("non_existent_username");
  assert.equal(matchNone.status, "STORE_NOT_FOUND");
  assert.equal(matchNone.storeMasterId, null);
  assert.equal(matchNone.matchedCount, 0);

  const matchAmbig = await service.resolveStoreMasterIdByTikTokUsername("oppo_rama9");
  assert.equal(matchAmbig.status, "AMBIGUOUS_STORE_MATCH");
  assert.equal(matchAmbig.storeMasterId, null);
  assert.equal(matchAmbig.matchedCount, 2);

  // 2. Initial sync with O-Central World handle automatically binds storeMasterId
  const syncPayload = {
    accessToken: "act.sample_token",
    refreshToken: "rft.sample_token",
    expiresIn: 86400,
    refreshExpiresIn: 31536000,
    profile: {
      open_id: "_000cw_open_id",
      display_name: "OPPO Central World",
      username: "@OPPO_CentralWorld", // Has leading @ and uppercase
      follower_count: 52000,
    },
    videos: [],
  };

  const result = await service.upsertTikTokAccount(syncPayload);
  assert.equal(result.storeMasterId, "store-cw-1");
  assert.ok(result.storeMaster);
  assert.equal(result.storeMaster.storeName, "OPPO Brand Shop Central World");
  assert.equal(result.storeMaster.province, "Bangkok");

  // 3. Re-syncing preserves existing storeMasterId
  const reSyncPayload = {
    ...syncPayload,
    profile: {
      ...syncPayload.profile,
      username: "oppo_centralworld",
      follower_count: 53000,
    },
  };
  const reSyncResult = await service.upsertTikTokAccount(reSyncPayload);
  assert.equal(reSyncResult.storeMasterId, "store-cw-1");

  // 4. Test reconciliation for an existing unbound account
  // Simulate an account persisted earlier without storeMasterId
  accountsDb.set("_000unbound_open_id", {
    id: "acc-uuid-unbound",
    openId: "_000unbound_open_id",
    username: "oppo_centralworld",
    storeMasterId: null,
  });

  const reconReport = await service.reconcileTikTokStoreBindings();
  assert.equal(reconReport.totalChecked, 1);
  assert.equal(reconReport.matchedCount, 1);
  assert.equal(reconReport.unmatchedCount, 0);
  assert.equal(reconReport.ambiguousCount, 0);

  const updatedUnbound = accountsDb.get("_000unbound_open_id");
  assert.equal(updatedUnbound.storeMasterId, "store-cw-1");
});

test("TikTok daily metric snapshots and growth calculation semantics", async () => {
  const accountsDb = new Map<string, any>();
  const videosDb = new Map<string, any>();
  const dailyMetricsDb = new Map<string, any>();

  const fakePrisma: any = {
    storeMaster: {
      findMany: async () => [],
    },
    tikTokAccount: {
      upsert: async ({ where, create, update }: any) => {
        const existing = accountsDb.get(where.openId);
        const record = existing
          ? { ...existing, ...update, id: existing.id }
          : { ...create, id: "acc-123" };
        accountsDb.set(where.openId, record);
        return record;
      },
      findUnique: async ({ where }: any) => {
        return accountsDb.get(where.openId) || null;
      },
      findFirst: async ({ where }: any) => {
        if (where?.OR) {
          for (const clause of where.OR) {
            if (clause.id) {
              const match = Array.from(accountsDb.values()).find((a) => a.id === clause.id);
              if (match) return match;
            }
            if (clause.openId) {
              const match = accountsDb.get(clause.openId);
              if (match) return match;
            }
          }
        }
        const accounts = Array.from(accountsDb.values());
        if (accounts.length === 0) return null;
        return accounts[accounts.length - 1];
      },
      findMany: async () => Array.from(accountsDb.values()),
    },
    tikTokVideo: {
      upsert: async () => ({}),
    },
    tikTokAccountDailyMetric: {
      upsert: async ({ where, create, update }: any) => {
        const key = `${where.tikTokAccountId_metricDate.tikTokAccountId}:${where.tikTokAccountId_metricDate.metricDate.toISOString()}`;
        const existing = dailyMetricsDb.get(key);
        const record = existing
          ? { ...existing, ...update, updatedAt: new Date() }
          : { ...create, id: `metric-${dailyMetricsDb.size + 1}`, createdAt: new Date(), updatedAt: new Date() };
        dailyMetricsDb.set(key, record);
        return record;
      },
      findMany: async ({ where }: any) => {
        let list = Array.from(dailyMetricsDb.values()).filter(
          (m) => m.tikTokAccountId === where.tikTokAccountId
        );
        if (where.metricDate?.gte) {
          list = list.filter((m) => m.metricDate.getTime() >= where.metricDate.gte.getTime());
        }
        return list.sort((a, b) => a.metricDate.getTime() - b.metricDate.getTime());
      },
    },
  };

  const fakeEncryption: any = {
    encrypt: (val: string) => `encrypted:${val}`,
    decrypt: (val: string) => val.replace("encrypted:", ""),
  };

  const service = new TikTokService(fakePrisma, fakeEncryption);

  // 1. First snapshot creation on sync
  const syncDay1 = {
    profile: {
      open_id: "open-id-centralworld",
      display_name: "OPPO Central World",
      username: "oppo_centralworld",
      follower_count: 50000,
      following_count: 200,
      likes_count: 350000,
      video_count: 85,
    },
    videos: [],
  };

  await service.upsertTikTokAccount(syncDay1);
  assert.equal(dailyMetricsDb.size, 1);

  const firstSnapshot = Array.from(dailyMetricsDb.values())[0];
  assert.equal(firstSnapshot.followerCount, 50000);
  assert.equal(firstSnapshot.followingCount, 200);
  assert.equal(firstSnapshot.likesCount, 350000);
  assert.equal(firstSnapshot.videoCount, 85);

  // 2. Same-day re-sync updates the same daily record without creating a duplicate
  const syncDay1Updated = {
    profile: {
      open_id: "open-id-centralworld",
      display_name: "OPPO Central World",
      username: "oppo_centralworld",
      follower_count: 50050,
      following_count: 201,
      likes_count: 350500,
      video_count: 86,
    },
    videos: [],
  };

  await service.upsertTikTokAccount(syncDay1Updated);
  assert.equal(dailyMetricsDb.size, 1, "Same-day sync must not create duplicate snapshot");
  const updatedSnapshot = Array.from(dailyMetricsDb.values())[0];
  assert.equal(updatedSnapshot.followerCount, 50050);

  // 3. Negative follower growth and comparison semantics
  // Setup historical timeline for test: Day -30, Day -7, Day -1, Day 0
  dailyMetricsDb.clear();
  const accId = "acc-123";
  const refDate = new Date(Date.UTC(2026, 7, 14, 12, 0, 0)); // 2026-08-14 19:00 Bangkok

  const dMinus30 = new Date(Date.UTC(2026, 6, 15, 0, 0, 0)); // 2026-07-15
  const dMinus7 = new Date(Date.UTC(2026, 7, 7, 0, 0, 0));   // 2026-08-07
  const dMinus1 = new Date(Date.UTC(2026, 7, 13, 0, 0, 0));  // 2026-08-13
  const dToday = new Date(Date.UTC(2026, 7, 14, 0, 0, 0));   // 2026-08-14

  dailyMetricsDb.set(`${accId}:${dMinus30.toISOString()}`, {
    id: "m-30",
    tikTokAccountId: accId,
    metricDate: dMinus30,
    followerCount: 48000,
    followingCount: 190,
    likesCount: 300000,
    videoCount: 70,
    createdAt: dMinus30,
    updatedAt: dMinus30,
  });

  dailyMetricsDb.set(`${accId}:${dMinus7.toISOString()}`, {
    id: "m-7",
    tikTokAccountId: accId,
    metricDate: dMinus7,
    followerCount: 50100, // higher than today -> test negative delta
    followingCount: 195,
    likesCount: 330000,
    videoCount: 80,
    createdAt: dMinus7,
    updatedAt: dMinus7,
  });

  dailyMetricsDb.set(`${accId}:${dMinus1.toISOString()}`, {
    id: "m-1",
    tikTokAccountId: accId,
    metricDate: dMinus1,
    followerCount: 50020,
    followingCount: 200,
    likesCount: 349000,
    videoCount: 84,
    createdAt: dMinus1,
    updatedAt: dMinus1,
  });

  dailyMetricsDb.set(`${accId}:${dToday.toISOString()}`, {
    id: "m-0",
    tikTokAccountId: accId,
    metricDate: dToday,
    followerCount: 50000,
    followingCount: 201,
    likesCount: 350000,
    videoCount: 85,
    createdAt: dToday,
    updatedAt: dToday,
  });

  const historyResult = await service.getAccountHistoricalMetrics("acc-123", 30, refDate);
  assert.ok(historyResult);
  assert.equal(historyResult.summary.currentFollowerCount, 50000);
  assert.equal(historyResult.summary.previousDayFollowerCount, 50020);
  assert.equal(historyResult.summary.dailyFollowerGrowth, -20); // 50000 - 50020 = -20
  assert.equal(historyResult.summary.sevenDayFollowerCount, 50100);
  assert.equal(historyResult.summary.sevenDayFollowerGrowth, -100); // 50000 - 50100 = -100 (negative growth test)
  assert.equal(historyResult.summary.thirtyDayFollowerCount, 48000);
  assert.equal(historyResult.summary.thirtyDayFollowerGrowth, 2000); // 50000 - 48000 = +2000

  // 4. Missing comparison dates return null (never fabricated as 0)
  dailyMetricsDb.clear();
  dailyMetricsDb.set(`${accId}:${dToday.toISOString()}`, {
    id: "m-0",
    tikTokAccountId: accId,
    metricDate: dToday,
    followerCount: 50000,
    followingCount: 201,
    likesCount: 350000,
    videoCount: 85,
    createdAt: dToday,
    updatedAt: dToday,
  });

  const singleDayResult = await service.getAccountHistoricalMetrics("acc-123", 30, refDate);
  assert.ok(singleDayResult);
  assert.equal(singleDayResult.summary.currentFollowerCount, 50000);
  assert.equal(singleDayResult.summary.previousDayFollowerCount, null);
  assert.equal(singleDayResult.summary.dailyFollowerGrowth, null);
  assert.equal(singleDayResult.summary.sevenDayFollowerCount, null);
  assert.equal(singleDayResult.summary.sevenDayFollowerGrowth, null);
  assert.equal(singleDayResult.summary.thirtyDayFollowerCount, null);
  assert.equal(singleDayResult.summary.thirtyDayFollowerGrowth, null);

  // 5. Test bulk daily sync planning method
  const plan = await service.planDailyAccountsSync();
  assert.equal(typeof plan.totalConnectedAccounts, "number");
  assert.ok(Array.isArray(plan.accountIds));
});
