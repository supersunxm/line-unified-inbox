import assert from "node:assert/strict";
import test from "node:test";
import {
  TikTokOAuthPermanentError,
  TikTokService,
  TikTokTransientError,
  getBangkokCalendarDate,
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
  const immediatelyFetched = await service.getTikTokAccountById(result.id);
  assert.equal(immediatelyFetched?.id, result.id);
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

test("Multi-account support: distinct openIds create separate records, reconnect updates in-place, and videos/metrics are isolated", async () => {
  const accountsDb = new Map<string, any>();
  const videosDb = new Map<string, any>();
  const dailyMetricsDb = new Map<string, any>();
  const storeMastersDb = new Map<string, any>();

  // Set up 2 stores in StoreMaster
  storeMastersDb.set("sm-cw", {
    id: "sm-cw",
    storeName: "OPPO Brand Shop Central World",
    tiktokUsername: "o_centralworld",
    province: "Bangkok",
    region: "Central",
  });
  storeMastersDb.set("sm-par", {
    id: "sm-par",
    storeName: "OPPO Brand Shop Siam Paragon",
    tiktokUsername: "o_siamparagon",
    province: "Bangkok",
    region: "Central",
  });

  const fakePrisma: any = {
    storeMaster: {
      findMany: async ({ where }: any) => {
        const username = where?.tiktokUsername;
        if (!username) return Array.from(storeMastersDb.values());
        return Array.from(storeMastersDb.values()).filter(
          (s) => s.tiktokUsername?.toLowerCase() === username.toLowerCase()
        );
      },
    },
    tikTokAccount: {
      findUnique: async ({ where, include }: any) => {
        let account: any = null;
        if (where?.id) {
          account = accountsDb.get(where.id);
        } else if (where?.openId) {
          account = Array.from(accountsDb.values()).find((a) => a.openId === where.openId);
        }
        if (!account) return null;
        const res = { ...account };
        if (include?.videos) {
          res.videos = Array.from(videosDb.values()).filter((v) => v.tikTokAccountId === account.id);
        }
        if (include?.storeMaster) {
          res.storeMaster = account.storeMasterId ? storeMastersDb.get(account.storeMasterId) : null;
        }
        return res;
      },
      findFirst: async ({ where, include }: any) => {
        let account: any = null;
        if (where?.OR) {
          account = Array.from(accountsDb.values()).find(
            (a) => a.id === where.OR[0].id || a.openId === where.OR[1].openId
          );
        } else if (where?.id) {
          account = accountsDb.get(where.id);
        } else if (where?.openId) {
          account = Array.from(accountsDb.values()).find((a) => a.openId === where.openId);
        } else {
          account = Array.from(accountsDb.values())[0];
        }
        if (!account) return null;
        const res = { ...account };
        if (include?.videos) {
          res.videos = Array.from(videosDb.values()).filter((v) => v.tikTokAccountId === account.id);
        }
        if (include?.storeMaster) {
          res.storeMaster = account.storeMasterId ? storeMastersDb.get(account.storeMasterId) : null;
        }
        return res;
      },
      findMany: async ({ include }: any) => {
        return Array.from(accountsDb.values()).map((a) => ({
          ...a,
          storeMaster: a.storeMasterId ? storeMastersDb.get(a.storeMasterId) : null,
          _count: {
            videos: Array.from(videosDb.values()).filter((v) => v.tikTokAccountId === a.id).length,
          },
        }));
      },
      upsert: async ({ where, create, update }: any) => {
        let existing = Array.from(accountsDb.values()).find((a) => a.openId === where.openId);
        if (existing) {
          Object.assign(existing, update, { lastSyncedAt: new Date() });
          return existing;
        }
        const newId = `acc-${accountsDb.size + 1}`;
        const newRecord = {
          id: newId,
          ...create,
          connectedAt: new Date(),
          lastSyncedAt: new Date(),
        };
        accountsDb.set(newId, newRecord);
        return newRecord;
      },
    },
    tikTokVideo: {
      upsert: async ({ where, create, update }: any) => {
        const key = `${where.tikTokAccountId_tikTokVideoId.tikTokAccountId}_${where.tikTokAccountId_tikTokVideoId.tikTokVideoId}`;
        const existing = videosDb.get(key);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const record = { id: `vid-${videosDb.size + 1}`, ...create };
        videosDb.set(key, record);
        return record;
      },
    },
    tikTokAccountDailyMetric: {
      upsert: async ({ create, update }: any) => {
        const key = `${create.tikTokAccountId}_${create.metricDate.toISOString()}`;
        const existing = dailyMetricsDb.get(key);
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() });
          return existing;
        }
        const record = {
          id: `m-${dailyMetricsDb.size + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...create,
        };
        dailyMetricsDb.set(key, record);
        return record;
      },
      findMany: async ({ where }: any) => {
        return Array.from(dailyMetricsDb.values()).filter(
          (m) => m.tikTokAccountId === where.tikTokAccountId
        );
      },
    },
  };

  const fakeEncryption: any = {
    encrypt: (val: string) => `enc:${val}`,
    decrypt: (val: string) => (val.startsWith("enc:") ? val.slice(4) : val),
  };

  const service = new TikTokService(fakePrisma, fakeEncryption);

  // 1. Connect Store 1: O-Central World (open_id: "open-cw")
  const sync1 = await service.upsertTikTokAccount({
    tokens: {
      accessToken: "token-cw",
      refreshToken: "refresh-cw",
      openId: "open-cw",
    },
    profile: {
      open_id: "open-cw",
      display_name: "O-Central World",
      username: "o_centralworld",
      follower_count: 5000,
      video_count: 5,
    },
    videos: [
      { id: "vid-cw-1", title: "Central World Video 1", view_count: 1000 },
      { id: "vid-cw-2", title: "Central World Video 2", view_count: 2000 },
    ],
  });

  assert.equal(accountsDb.size, 1);
  assert.equal(sync1.displayName, "O-Central World");
  assert.equal(sync1.storeMaster?.storeName, "OPPO Brand Shop Central World");
  assert.equal(sync1.videos.length, 2);

  // 2. Connect Store 2: Siam Paragon (open_id: "open-paragon")
  const sync2 = await service.upsertTikTokAccount({
    tokens: {
      accessToken: "token-paragon",
      refreshToken: "refresh-paragon",
      openId: "open-paragon",
    },
    profile: {
      open_id: "open-paragon",
      display_name: "OPPO Siam Paragon",
      username: "o_siamparagon",
      follower_count: 8000,
      video_count: 3,
    },
    videos: [
      { id: "vid-par-1", title: "Paragon Video 1", view_count: 5000 },
    ],
  });

  // Verify multi-account persistence
  assert.equal(accountsDb.size, 2);
  assert.equal(sync2.displayName, "OPPO Siam Paragon");
  assert.equal(sync2.storeMaster?.storeName, "OPPO Brand Shop Siam Paragon");

  // Verify Store 1 was preserved untouched
  const acc1 = await service.getTikTokAccountById("acc-1");
  assert.equal(acc1?.displayName, "O-Central World");
  assert.equal(acc1?.storeMaster?.storeName, "OPPO Brand Shop Central World");

  // 3. Reconnect Store 1 (same open_id: "open-cw") with updated follower count
  await service.upsertTikTokAccount({
    tokens: {
      accessToken: "token-cw-new",
      refreshToken: "refresh-cw-new",
      openId: "open-cw",
    },
    profile: {
      open_id: "open-cw",
      display_name: "O-Central World Updated",
      username: "o_centralworld",
      follower_count: 5200,
      video_count: 5,
    },
    videos: [],
  });

  // Must NOT create a duplicate third account
  assert.equal(accountsDb.size, 2);
  const acc1AfterReconnect = await service.getTikTokAccountById("acc-1");
  assert.equal(acc1AfterReconnect?.displayName, "O-Central World Updated");
  assert.equal(acc1AfterReconnect?.followerCount, 5200);

  // 4. Test account list read
  const list = await service.listTikTokAccounts();
  assert.equal(list.length, 2);
  const listCW = list.find((a) => a.openId === "open-cw");
  const listPar = list.find((a) => a.openId === "open-paragon");
  assert.equal(listCW?.storeMaster?.storeName, "OPPO Brand Shop Central World");
  assert.equal(listPar?.storeMaster?.storeName, "OPPO Brand Shop Siam Paragon");

  // 5. Test no cross-store video leakage
  const acc1Data = await service.getTikTokAccountById("acc-1");
  const acc2Data = await service.getTikTokAccountById("acc-2");
  assert.equal(acc1Data?.videos.length, 2);
  assert.equal(acc1Data?.videos[0].title, "Central World Video 1");
  assert.equal(acc2Data?.videos.length, 1);
  assert.equal(acc2Data?.videos[0].title, "Paragon Video 1");

  // 6. Test no cross-store metrics leakage
  const acc1Metrics = await service.getAccountHistoricalMetrics("acc-1", 30);
  const acc2Metrics = await service.getAccountHistoricalMetrics("acc-2", 30);
  assert.equal(acc1Metrics?.accountId, "acc-1");
  assert.equal(acc2Metrics?.accountId, "acc-2");
});

test("TikTokService.getBulkAccountsMetricsSummary accurately computes today, 7D, and 30D growth across all connected accounts in bulk", async () => {
  const accountsTable: any[] = [
    {
      id: "acc-1",
      openId: "open-cw",
      displayName: "OPPO Central World",
      username: "o_centralworld",
      followerCount: 13342,
      followingCount: 120,
      likesCount: 54200,
      videoCount: 18,
      createdAt: new Date("2026-07-01"),
    },
    {
      id: "acc-2",
      openId: "open-par",
      displayName: "OPPO Siam Paragon",
      username: "o_siamparagon",
      followerCount: 8500,
      followingCount: 95,
      likesCount: 31000,
      videoCount: 12,
      createdAt: new Date("2026-07-01"),
    },
    {
      id: "acc-3",
      openId: "open-mega",
      displayName: "OPPO Mega Bangna",
      username: "o_megabangna",
      followerCount: 4200,
      followingCount: 50,
      likesCount: 12000,
      videoCount: 8,
      createdAt: new Date("2026-07-01"),
    },
  ];

  const refDate = new Date("2026-08-15T12:00:00.000Z"); // 2026-08-15 in Bangkok
  const todayBangkok = getBangkokCalendarDate(refDate);

  const metricsTable: any[] = [
    // Account 1 (Central World): snapshots for today, yesterday (T-1), 7D ago (T-7), 30D ago (T-30)
    {
      id: "m-cw-today",
      tikTokAccountId: "acc-1",
      metricDate: todayBangkok,
      followerCount: 13342,
      followingCount: 120,
      likesCount: 54200,
      videoCount: 18,
      createdAt: todayBangkok,
      updatedAt: todayBangkok,
    },
    {
      id: "m-cw-yesterday",
      tikTokAccountId: "acc-1",
      metricDate: new Date(todayBangkok.getTime() - 86400000),
      followerCount: 13295, // Delta today: +47
      followingCount: 117, // Delta today: +3
      likesCount: 52955, // Delta today: +1245
      videoCount: 16, // Delta today: +2
      createdAt: new Date(todayBangkok.getTime() - 86400000),
      updatedAt: new Date(todayBangkok.getTime() - 86400000),
    },
    {
      id: "m-cw-7d",
      tikTokAccountId: "acc-1",
      metricDate: new Date(todayBangkok.getTime() - 7 * 86400000),
      followerCount: 13056, // Delta 7D: +286
      followingCount: 108, // Delta 7D: +12
      likesCount: 51179, // Delta 7D: +3021
      videoCount: 10, // Delta 7D: +8
      createdAt: new Date(todayBangkok.getTime() - 7 * 86400000),
      updatedAt: new Date(todayBangkok.getTime() - 7 * 86400000),
    },
    {
      id: "m-cw-30d",
      tikTokAccountId: "acc-1",
      metricDate: new Date(todayBangkok.getTime() - 30 * 86400000),
      followerCount: 12218, // Delta 30D: +1124
      followingCount: 92, // Delta 30D: +28
      likesCount: 45436, // Delta 30D: +8764
      videoCount: 3, // Delta 30D: +15
      createdAt: new Date(todayBangkok.getTime() - 30 * 86400000),
      updatedAt: new Date(todayBangkok.getTime() - 30 * 86400000),
    },

    // Account 2 (Siam Paragon): net negative and zero changes
    {
      id: "m-par-today",
      tikTokAccountId: "acc-2",
      metricDate: todayBangkok,
      followerCount: 8500,
      followingCount: 95,
      likesCount: 31000,
      videoCount: 12,
      createdAt: todayBangkok,
      updatedAt: todayBangkok,
    },
    {
      id: "m-par-yesterday",
      tikTokAccountId: "acc-2",
      metricDate: new Date(todayBangkok.getTime() - 86400000),
      followerCount: 8520, // Delta today: -20 (net unfollows)
      followingCount: 95, // Delta today: 0 (zero change)
      likesCount: 30800, // Delta today: +200
      videoCount: 12, // Delta today: 0
      createdAt: new Date(todayBangkok.getTime() - 86400000),
      updatedAt: new Date(todayBangkok.getTime() - 86400000),
    },
    {
      id: "m-par-7d",
      tikTokAccountId: "acc-2",
      metricDate: new Date(todayBangkok.getTime() - 7 * 86400000),
      followerCount: 8600, // Delta 7D: -100
      followingCount: 90, // Delta 7D: +5
      likesCount: 30000, // Delta 7D: +1000
      videoCount: 10, // Delta 7D: +2
      createdAt: new Date(todayBangkok.getTime() - 7 * 86400000),
      updatedAt: new Date(todayBangkok.getTime() - 7 * 86400000),
    },
    // No 30D snapshot for Account 2 -> should return null for thirtyDays growth

    // Account 3 (Mega Bangna): Brand new account with only today's snapshot -> all growth deltas null
    {
      id: "m-mega-today",
      tikTokAccountId: "acc-3",
      metricDate: todayBangkok,
      followerCount: 4200,
      followingCount: 50,
      likesCount: 12000,
      videoCount: 8,
      createdAt: todayBangkok,
      updatedAt: todayBangkok,
    },
  ];

  const fakePrisma: any = {
    tikTokAccount: {
      findMany: async () => accountsTable,
    },
    tikTokAccountDailyMetric: {
      findMany: async ({ where }: any) => {
        return metricsTable.filter(
          (m) =>
            (!where.tikTokAccountId ||
              (where.tikTokAccountId.in && where.tikTokAccountId.in.includes(m.tikTokAccountId))) &&
            (!where.metricDate || !where.metricDate.gte || m.metricDate >= where.metricDate.gte)
        );
      },
    },
  };

  const fakeEncryption: any = {};
  const service = new TikTokService(fakePrisma, fakeEncryption);

  const bulkSummary = await service.getBulkAccountsMetricsSummary(30, refDate);

  assert.equal(bulkSummary.accounts.length, 3);

  // 1. Account 1 (Central World) - full growth across all 3 periods and all 4 metrics
  const cw = bulkSummary.accounts.find((a) => a.accountId === "acc-1");
  assert.ok(cw);
  assert.equal(cw?.current.followerCount, 13342);
  assert.equal(cw?.current.followingCount, 120);
  assert.equal(cw?.current.likesCount, 54200);
  assert.equal(cw?.current.videoCount, 18);

  assert.deepEqual(cw?.growth.today, {
    followers: 47,
    following: 3,
    likes: 1245,
    videos: 2,
  });
  assert.deepEqual(cw?.growth.sevenDays, {
    followers: 286,
    following: 12,
    likes: 3021,
    videos: 8,
  });
  assert.deepEqual(cw?.growth.thirtyDays, {
    followers: 1124,
    following: 28,
    likes: 8764,
    videos: 15,
  });

  // 2. Account 2 (Siam Paragon) - negative, zero, and missing 30D snapshot
  const par = bulkSummary.accounts.find((a) => a.accountId === "acc-2");
  assert.ok(par);
  assert.equal(par?.growth.today.followers, -20);
  assert.equal(par?.growth.today.following, 0);
  assert.equal(par?.growth.today.likes, 200);
  assert.equal(par?.growth.today.videos, 0);

  assert.equal(par?.growth.sevenDays.followers, -100);
  assert.equal(par?.growth.sevenDays.following, 5);

  assert.equal(par?.growth.thirtyDays.followers, null);
  assert.equal(par?.growth.thirtyDays.following, null);
  assert.equal(par?.growth.thirtyDays.likes, null);
  assert.equal(par?.growth.thirtyDays.videos, null);

  // 3. Account 3 (Mega Bangna) - missing past snapshots => all nulls
  const mega = bulkSummary.accounts.find((a) => a.accountId === "acc-3");
  assert.ok(mega);
  assert.deepEqual(mega?.growth.today, {
    followers: null,
    following: null,
    likes: null,
    videos: null,
  });
  assert.deepEqual(mega?.growth.sevenDays, {
    followers: null,
    following: null,
    likes: null,
    videos: null,
  });
  assert.deepEqual(mega?.growth.thirtyDays, {
    followers: null,
    following: null,
    likes: null,
    videos: null,
  });
});

test("TikTokService.resetTikTokSandboxAccountByUsername safely revokes token, deletes child records and account, while preserving StoreMaster and unrelated accounts", async () => {
  const accountsTable: any[] = [
    {
      id: "acc-cw",
      openId: "open-cw",
      username: "o_centralworld",
      displayName: "OPPO Central World",
      storeMasterId: "sm-cw",
      encryptedAccessToken: "enc-access-token-123",
      storeMaster: {
        id: "sm-cw",
        storeName: "OPPO Brand Shop Central World",
        accountName: "OPPO Central World",
        tiktokUsername: "o_centralworld",
      },
      _count: {
        videos: 5,
        dailyMetrics: 30,
      },
    },
    {
      id: "acc-paragon",
      openId: "open-paragon",
      username: "o_siamparagon",
      displayName: "OPPO Siam Paragon",
      storeMasterId: "sm-paragon",
      encryptedAccessToken: "enc-access-token-paragon",
      storeMaster: {
        id: "sm-paragon",
        storeName: "OPPO Brand Shop Siam Paragon",
        accountName: "OPPO Siam Paragon",
        tiktokUsername: "o_siamparagon",
      },
      _count: {
        videos: 3,
        dailyMetrics: 15,
      },
    },
  ];

  const videosTable: any[] = [
    { id: "v1", tikTokAccountId: "acc-cw" },
    { id: "v2", tikTokAccountId: "acc-cw" },
    { id: "v3", tikTokAccountId: "acc-paragon" },
  ];

  const metricsTable: any[] = [
    { id: "m1", tikTokAccountId: "acc-cw" },
    { id: "m2", tikTokAccountId: "acc-cw" },
    { id: "m3", tikTokAccountId: "acc-paragon" },
  ];

  const storeMasterTable: any[] = [
    { id: "sm-cw", storeName: "OPPO Brand Shop Central World", tiktokUsername: "o_centralworld" },
    { id: "sm-paragon", storeName: "OPPO Brand Shop Siam Paragon", tiktokUsername: "o_siamparagon" },
  ];

  let revokedTokens: string[] = [];
  let shouldRevokeFail = false;

  const fakePrisma: any = {
    tikTokAccount: {
      findMany: async () => accountsTable,
      delete: async ({ where }: any) => {
        const idx = accountsTable.findIndex((a) => a.id === where.id);
        if (idx >= 0) accountsTable.splice(idx, 1);
        return { id: where.id };
      },
    },
    tikTokVideo: {
      deleteMany: async ({ where }: any) => {
        const initial = videosTable.length;
        const remaining = videosTable.filter((v) => v.tikTokAccountId !== where.tikTokAccountId);
        videosTable.length = 0;
        videosTable.push(...remaining);
        return { count: initial - remaining.length };
      },
    },
    tikTokAccountDailyMetric: {
      deleteMany: async ({ where }: any) => {
        const initial = metricsTable.length;
        const remaining = metricsTable.filter((m) => m.tikTokAccountId !== where.tikTokAccountId);
        metricsTable.length = 0;
        metricsTable.push(...remaining);
        return { count: initial - remaining.length };
      },
    },
    $transaction: async (fn: any) => fn(fakePrisma),
  };

  const fakeEncryption: any = {
    decrypt: (val: string) => `decrypted-${val}`,
  };

  const service = new TikTokService(fakePrisma, fakeEncryption);

  // Mock revokeTikTokToken
  service.revokeTikTokToken = async (token: string) => {
    if (shouldRevokeFail) {
      throw new Error("TikTok API network failure");
    }
    revokedTokens.push(token);
    return { success: true, status: 200, message: "Token successfully revoked by TikTok" };
  };

  // 1. Rejects zero matches safely
  const noMatch = await service.resetTikTokSandboxAccountByUsername("unknown_store");
  assert.equal(noMatch.success, false);
  assert.equal(noMatch.revokeResult, "No matching TikTokAccount found in database");

  // 2. Dry run preview does not delete rows or call revoke
  const dryRun = await service.resetTikTokSandboxAccountByUsername("@O_CentralWorld", { dryRun: true });
  assert.equal(dryRun.success, true);
  assert.equal(dryRun.deletedAccountId, "acc-cw");
  assert.equal(dryRun.deletedVideosCount, 5);
  assert.equal(dryRun.deletedDailyMetricsCount, 30);
  assert.equal(accountsTable.length, 2); // Unchanged
  assert.equal(revokedTokens.length, 0); // No revoke in dry run

  // 3. Revoke failure prevents database deletion
  shouldRevokeFail = true;
  await assert.rejects(
    async () => service.resetTikTokSandboxAccountByUsername("o_centralworld"),
    /TikTok token revocation failed/
  );
  assert.equal(accountsTable.length, 2); // DB deletion aborted
  shouldRevokeFail = false;

  // 4. Successful confirmed execution
  const confirmed = await service.resetTikTokSandboxAccountByUsername("  @O_CENTRALWORLD  ");
  assert.equal(confirmed.success, true);
  assert.equal(confirmed.deletedAccountId, "acc-cw");
  assert.equal(confirmed.username, "o_centralworld");
  assert.equal(confirmed.displayName, "OPPO Central World");
  assert.equal(confirmed.storeMasterName, "OPPO Brand Shop Central World");
  assert.equal(confirmed.revokeResult, "Token successfully revoked by TikTok");
  assert.equal(revokedTokens.length, 1);
  assert.equal(revokedTokens[0], "decrypted-enc-access-token-123");

  // 5. Account and child records deleted
  assert.equal(accountsTable.length, 1);
  assert.equal(accountsTable[0].id, "acc-paragon"); // acc-paragon preserved
  assert.equal(videosTable.length, 1);
  assert.equal(videosTable[0].tikTokAccountId, "acc-paragon"); // Central World videos removed
  assert.equal(metricsTable.length, 1);
  assert.equal(metricsTable[0].tikTokAccountId, "acc-paragon"); // Central World daily metrics removed

  // 6. StoreMaster preserved completely
  assert.equal(storeMasterTable.length, 2);
  assert.equal(storeMasterTable[0].tiktokUsername, "o_centralworld");
});
