import assert from "node:assert/strict";
import test from "node:test";
import { TikTokService } from "./tiktok.service";

test("TikTokService upserts account and encrypts tokens securely at rest", async () => {
  const accountsDb = new Map<string, any>();
  const videosDb = new Map<string, any>();

  const fakePrisma: any = {
    tikTokAccount: {
      upsert: async ({ where, create, update }: any) => {
        const existing = accountsDb.get(where.openId);
        const record = existing
          ? { ...existing, ...update, id: existing.id }
          : { ...create, id: "acc-uuid-1" };
        accountsDb.set(where.openId, record);
        return record;
      },
      findFirst: async () => {
        const accounts = Array.from(accountsDb.values());
        if (accounts.length === 0) return null;
        const latest = accounts[accounts.length - 1];
        const videos = Array.from(videosDb.values()).filter(
          (v) => v.tikTokAccountId === latest.id
        );
        return {
          ...latest,
          videos,
          storeMaster: null,
        };
      },
      findMany: async () => {
        return Array.from(accountsDb.values()).map((a) => ({
          ...a,
          storeMaster: null,
          _count: {
            videos: Array.from(videosDb.values()).filter(
              (v) => v.tikTokAccountId === a.id
            ).length,
          },
        }));
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

  // 1. Initial sync with tokens
  const syncPayload = {
    accessToken: "act.sample_access_token_12345",
    refreshToken: "rft.sample_refresh_token_67890",
    expiresIn: 86400,
    refreshExpiresIn: 31536000,
    grantedScopes: "user.info.basic,user.info.profile,user.info.stats,video.list",
    profile: {
      open_id: "_000sample_open_id",
      display_name: "OPPO Central World",
      username: "oppo_centralworld",
      follower_count: 52000,
      following_count: 120,
      likes_count: 1420000,
      video_count: 85,
      is_verified: true,
    },
    videos: [
      {
        id: "7123456789",
        title: "OPPO Reno 12 Pro Unboxing",
        viewCount: 150000,
        likeCount: 12000,
        commentCount: 450,
        shareCount: 230,
        duration: 45,
        createTime: 1723600000,
      },
    ],
  };

  const result = await service.upsertTikTokAccount(syncPayload);

  // Verification 1: Persisted account stored with encrypted tokens
  const storedAccount = accountsDb.get("_000sample_open_id");
  assert.ok(storedAccount);
  assert.equal(storedAccount.encryptedAccessToken, "encrypted:act.sample_access_token_12345");
  assert.equal(storedAccount.encryptedRefreshToken, "encrypted:rft.sample_refresh_token_67890");
  assert.equal(storedAccount.displayName, "OPPO Central World");

  // Verification 2: Return DTO strictly NEVER contains tokens
  assert.equal("accessToken" in result, false);
  assert.equal("refreshToken" in result, false);
  assert.equal("encryptedAccessToken" in result, false);
  assert.equal("encryptedRefreshToken" in result, false);
  assert.equal(result.openId, "_000sample_open_id");
  assert.equal(result.displayName, "OPPO Central World");
  assert.equal(result.videos.length, 1);
  assert.equal(result.videos[0].viewCount, 150000);

  // Verification 3: Reconnecting same openId updates record rather than duplicating
  const updatePayload = {
    ...syncPayload,
    profile: {
      ...syncPayload.profile,
      follower_count: 53500, // Updated follower count
    },
  };

  const updatedResult = await service.upsertTikTokAccount(updatePayload);
  assert.equal(accountsDb.size, 1, "Must not duplicate account with same openId");
  assert.equal(updatedResult.followerCount, 53500);

  // Verification 4: List accounts returns summary
  const list = await service.listTikTokAccounts();
  assert.equal(list.length, 1);
  assert.equal(list[0].openId, "_000sample_open_id");
  assert.equal(list[0].videoCountRecorded, 1);
});
