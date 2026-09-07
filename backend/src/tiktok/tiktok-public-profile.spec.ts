import assert from "node:assert/strict";
import test from "node:test";
import {
  extractTikTokPublicProfile,
  normalizeTikTokPublicUsername,
} from "./tiktok-public-profile";

test("normalizeTikTokPublicUsername accepts username, @username, and profile URL", () => {
  assert.equal(normalizeTikTokPublicUsername("o_centralworld"), "o_centralworld");
  assert.equal(normalizeTikTokPublicUsername(" @O_CentralWorld "), "o_centralworld");
  assert.equal(
    normalizeTikTokPublicUsername("https://www.tiktok.com/@o_centralworld?lang=th-TH"),
    "o_centralworld",
  );
  assert.throws(() => normalizeTikTokPublicUsername(""), /required/u);
  assert.throws(() => normalizeTikTokPublicUsername("bad username"), /Invalid/u);
});

test("extractTikTokPublicProfile prefers exact statsV2 counts over rounded stats", () => {
  const payload = {
    __DEFAULT_SCOPE__: {
      "webapp.user-detail": {
        userInfo: {
          user: {
            uniqueId: "o_centralworld",
            nickname: "OPPO Brand Shop CentralWorld",
            signature: "Official store",
            avatarLarger: "https://example.com/avatar.jpg",
            verified: false,
          },
          stats: {
            followerCount: 13800,
            followingCount: 290,
            heartCount: 99800,
            videoCount: 365,
          },
          statsV2: {
            followerCount: "13751",
            followingCount: "290",
            heartCount: "99808",
            videoCount: "368",
          },
        },
      },
    },
  };

  assert.deepEqual(extractTikTokPublicProfile([payload], "@o_centralworld"), {
    username: "o_centralworld",
    displayName: "OPPO Brand Shop CentralWorld",
    avatarUrl: "https://example.com/avatar.jpg",
    bioDescription: "Official store",
    isVerified: false,
    followerCount: 13751,
    followingCount: 290,
    likesCount: 99808,
    videoCount: 368,
    profileUrl: "https://www.tiktok.com/@o_centralworld",
  });
});

test("extractTikTokPublicProfile supports legacy UserModule profile shapes", () => {
  const payload = {
    UserModule: {
      users: {
        "user-1": {
          id: "user-1",
          uniqueId: "o_centralworld",
          nickname: "CentralWorld",
          avatarMedium: "https://example.com/avatar-legacy.jpg",
        },
      },
      stats: {
        "user-1": {
          followerCount: "1000",
          followingCount: "50",
          heart: "20000",
          videoCount: "100",
        },
      },
    },
  };

  const profile = extractTikTokPublicProfile([payload], "o_centralworld");
  assert.equal(profile?.followerCount, 1000);
  assert.equal(profile?.followingCount, 50);
  assert.equal(profile?.likesCount, 20000);
  assert.equal(profile?.videoCount, 100);
});
