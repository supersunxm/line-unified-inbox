import assert from "node:assert/strict";
import test from "node:test";
import {
  TikTokOAuthPermanentError,
  TikTokService,
  TikTokTransientError,
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

test("TikTok scheduled daily worker: token refresh, token rotation, failure isolation, and batch execution", async () => {
  const accountsDb = new Map<string, any>();
  const dailyMetricsDb = new Map<string, any>();

  const fakePrisma: any = {
    tikTokAccount: {
      findMany: async ({ where }: any) => {
        return Array.from(accountsDb.values()).filter(
          (acc) => acc.connectionStatus === "CONNECTED" && acc.encryptedRefreshToken != null
        );
      },
      update: async ({ where, data }: any) => {
        const existing = Array.from(accountsDb.values()).find((a) => a.id === where.id);
        if (existing) {
          Object.assign(existing, data);
        }
        return existing;
      },
    },
    tikTokAccountDailyMetric: {
      upsert: async ({ where, create, update }: any) => {
        const key = `${where.tikTokAccountId_metricDate.tikTokAccountId}:${where.tikTokAccountId_metricDate.metricDate.toISOString()}`;
        const existing = dailyMetricsDb.get(key);
        const record = existing
          ? { ...existing, ...update }
          : { ...create, id: `metric-${dailyMetricsDb.size + 1}` };
        dailyMetricsDb.set(key, record);
        return record;
      },
    },
  };

  const fakeEncryption: any = {
    encrypt: (val: string) => `enc:${val}`,
    decrypt: (val: string) => (val.startsWith("enc:") ? val.slice(4) : val),
  };

  const service = new TikTokService(fakePrisma, fakeEncryption);

  // Setup mock accounts
  // Account 1: Valid refresh token, rotates refresh token
  accountsDb.set("acc-1", {
    id: "acc-1",
    openId: "open-id-1",
    username: "store_1",
    displayName: "Store 1",
    connectionStatus: "CONNECTED",
    encryptedAccessToken: null,
    encryptedRefreshToken: "enc:refresh-token-1",
    followerCount: 1000,
    followingCount: 100,
    likesCount: 5000,
    videoCount: 20,
  });

  // Account 2: Expired refresh token (TikTok rejects with error)
  accountsDb.set("acc-2", {
    id: "acc-2",
    openId: "open-id-2",
    username: "store_2",
    displayName: "Store 2",
    connectionStatus: "CONNECTED",
    encryptedAccessToken: null,
    encryptedRefreshToken: "enc:refresh-token-invalid",
    followerCount: 2000,
    followingCount: 200,
    likesCount: 10000,
    videoCount: 30,
  });

  // Account 3: Valid access token (not expired), no refresh needed
  const validExp = new Date(Date.now() + 3600 * 1000);
  accountsDb.set("acc-3", {
    id: "acc-3",
    openId: "open-id-3",
    username: "store_3",
    displayName: "Store 3",
    connectionStatus: "CONNECTED",
    encryptedAccessToken: "enc:valid-token-3",
    encryptedRefreshToken: "enc:refresh-token-3",
    accessTokenExpiresAt: validExp,
    followerCount: 3000,
    followingCount: 300,
    likesCount: 15000,
    videoCount: 40,
  });

  // Mock fetchRefreshedTikTokToken and fetchTikTokUserProfile
  service.fetchRefreshedTikTokToken = async (refreshToken: string) => {
    if (refreshToken === "refresh-token-invalid") {
      throw new TikTokOAuthPermanentError("TikTok OAuth token refresh failed: invalid_grant", "invalid_grant");
    }
    return {
      accessToken: `new-access-token-for-${refreshToken}`,
      expiresIn: 86400,
      refreshToken: `rotated-refresh-token-for-${refreshToken}`,
      refreshExpiresIn: 31536000,
      openId: "open-id-1",
    };
  };

  service.fetchTikTokUserProfile = async (accessToken: string) => {
    if (accessToken.includes("refresh-token-1")) {
      return {
        open_id: "open-id-1",
        display_name: "Store 1 Updated",
        follower_count: 1050, // Grew by 50
        following_count: 105,
        likes_count: 5200,
        video_count: 22,
      };
    }
    if (accessToken === "valid-token-3") {
      return {
        open_id: "open-id-3",
        display_name: "Store 3",
        follower_count: 3100, // Grew by 100
        following_count: 300,
        likes_count: 15500,
        video_count: 42,
      };
    }
    throw new Error(`Unknown access token: ${accessToken}`);
  };

  // Run the batch daily sync across all 3 accounts
  const refDate = new Date("2026-08-14T01:00:00.000Z");
  const summary = await service.syncDailyTikTokMetrics({
    concurrency: 2,
    referenceNow: refDate,
  });

  // 1. Batch summary verification
  assert.equal(summary.totalAccounts, 3);
  assert.equal(summary.succeeded, 2); // acc-1 and acc-3
  assert.equal(summary.failed, 1); // acc-2 failed
  assert.equal(summary.tokenRefreshFailures, 1);
  assert.equal(summary.bangkokDate, "2026-08-14");

  // 2. Account 1 verified: token rotated and metrics updated
  const acc1 = accountsDb.get("acc-1");
  assert.equal(acc1.encryptedAccessToken, "enc:new-access-token-for-refresh-token-1");
  assert.equal(acc1.encryptedRefreshToken, "enc:rotated-refresh-token-for-refresh-token-1");
  assert.equal(acc1.followerCount, 1050);
  assert.equal(acc1.connectionStatus, "CONNECTED");

  // 3. Account 2 verified: marked EXPIRED due to permanent refresh failure, did not crash batch
  const acc2 = accountsDb.get("acc-2");
  assert.equal(acc2.connectionStatus, "EXPIRED");

  // 4. Account 3 verified: used existing valid access token
  const acc3 = accountsDb.get("acc-3");
  assert.equal(acc3.followerCount, 3100);

  // 5. Daily snapshot upsert idempotency: running twice on same day updates existing record
  assert.equal(dailyMetricsDb.size, 2);
  const run2Summary = await service.syncDailyTikTokMetrics({
    concurrency: 2,
    referenceNow: refDate,
  });
  assert.equal(run2Summary.succeeded, 2);
  assert.equal(dailyMetricsDb.size, 2); // No duplicate rows created
});

test("TikTok error classification: permanent vs transient errors, bounded retries, and job locking", async () => {
  const accountsDb = new Map<string, any>();
  const fakePrisma: any = {
    tikTokAccount: {
      findMany: async () => Array.from(accountsDb.values()),
      update: async ({ where, data }: any) => {
        const existing = accountsDb.get(where.id);
        if (existing) Object.assign(existing, data);
        return existing;
      },
    },
    tikTokAccountDailyMetric: {
      upsert: async () => ({ id: "m-1" }),
    },
  };

  const fakeEncryption: any = {
    encrypt: (val: string) => `enc:${val}`,
    decrypt: (val: string) => (val.startsWith("enc:") ? val.slice(4) : val),
  };

  const service = new TikTokService(fakePrisma, fakeEncryption);

  // Account 1: Transient 500 error during refresh -> MUST REMAIN CONNECTED
  accountsDb.set("acc-500", {
    id: "acc-500",
    openId: "open-id-500",
    connectionStatus: "CONNECTED",
    encryptedAccessToken: null,
    encryptedRefreshToken: "enc:refresh-500",
    followerCount: 5000,
    followingCount: 100,
    likesCount: 1000,
    videoCount: 10,
  });

  let refresh500Attempts = 0;
  service.fetchRefreshedTikTokToken = async (token: string) => {
    if (token === "refresh-500") {
      refresh500Attempts++;
      throw new TikTokTransientError("TikTok 500 internal server error", 500, 0.001);
    }
    return { accessToken: "act", openId: "open" };
  };

  const res500 = await service.syncSingleAccountDailyMetrics(accountsDb.get("acc-500"));
  assert.equal(res500.status, "FAILED");
  // CRITICAL: Must remain CONNECTED on transient 500 error!
  assert.equal(accountsDb.get("acc-500").connectionStatus, "CONNECTED");
  // Retried twice (total 3 attempts)
  assert.equal(refresh500Attempts, 3);

  // Account 2: Rate limit 429 during profile fetch -> retries and succeeds on retry
  accountsDb.set("acc-429", {
    id: "acc-429",
    openId: "open-id-429",
    connectionStatus: "CONNECTED",
    encryptedAccessToken: "enc:token-429",
    encryptedRefreshToken: "enc:refresh-429",
    accessTokenExpiresAt: new Date(Date.now() + 3600000),
    followerCount: 6000,
    followingCount: 100,
    likesCount: 1000,
    videoCount: 10,
  });

  let profile429Attempts = 0;
  service.fetchTikTokUserProfile = async (token: string) => {
    if (token === "token-429") {
      profile429Attempts++;
      if (profile429Attempts === 1) {
        throw new TikTokTransientError("Rate limit", 429, 0.01);
      }
      return {
        open_id: "open-id-429",
        follower_count: 6050,
      };
    }
    throw new Error("Unknown");
  };

  const res429 = await service.syncSingleAccountDailyMetrics(accountsDb.get("acc-429"));
  assert.equal(res429.status, "SUCCESS");
  assert.equal(res429.followerCount, 6050);
  assert.equal(accountsDb.get("acc-429").connectionStatus, "CONNECTED");
  assert.equal(profile429Attempts, 2);

  // Account 3: Permanent invalid_grant -> immediately fails without retries and marks EXPIRED
  accountsDb.set("acc-perm", {
    id: "acc-perm",
    openId: "open-id-perm",
    connectionStatus: "CONNECTED",
    encryptedAccessToken: null,
    encryptedRefreshToken: "enc:refresh-perm",
    followerCount: 7000,
    followingCount: 100,
    likesCount: 1000,
    videoCount: 10,
  });

  let permAttempts = 0;
  service.fetchRefreshedTikTokToken = async (token: string) => {
    if (token === "refresh-perm") {
      permAttempts++;
      throw new TikTokOAuthPermanentError("User revoked authorization", "invalid_grant");
    }
    return { accessToken: "act", openId: "open" };
  };

  const resPerm = await service.syncSingleAccountDailyMetrics(accountsDb.get("acc-perm"));
  assert.equal(resPerm.status, "FAILED");
  assert.equal(accountsDb.get("acc-perm").connectionStatus, "EXPIRED");
  assert.equal(permAttempts, 1); // No retries for permanent errors!

  // 4. Job lock prevention: Overlapping execution is safely skipped
  let lockHeld = true;
  service.tryAcquireJobLock = async () => !lockHeld;
  service.releaseJobLock = async () => {
    lockHeld = false;
  };

  const skippedJob = await service.syncDailyTikTokMetrics();
  assert.equal(skippedJob.totalAccounts, 0);
  assert.equal(skippedJob.succeeded, 0);

  // When lock is acquired, job runs and releases lock in finally block
  lockHeld = false;
  let lockReleased = false;
  service.tryAcquireJobLock = async () => true;
  service.releaseJobLock = async () => {
    lockReleased = true;
  };

  accountsDb.clear();
  await service.syncDailyTikTokMetrics();
  assert.equal(lockReleased, true);
});
