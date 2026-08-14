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
