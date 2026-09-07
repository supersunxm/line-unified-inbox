import assert from "node:assert/strict";
import test from "node:test";
import {
  extractTikTokPublicData,
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

test("extractTikTokPublicData reads universal hydration userInfo and recent posts", () => {
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
            followerCount: 13751,
            followingCount: 290,
            heartCount: 99800,
            videoCount: 368,
          },
        },
      },
      "webapp.user-post": {
        itemList: [
          {
            id: "7600000000000000001",
            desc: "Reno launch",
            createTime: 1788700000,
            author: { uniqueId: "o_centralworld" },
            video: { cover: "https://example.com/cover.jpg" },
            stats: {
              playCount: 4521,
              diggCount: 325,
              commentCount: 17,
              shareCount: 24,
            },
          },
        ],
      },
    },
  };

  const result = extractTikTokPublicData([payload], "@o_centralworld");

  assert.deepEqual(result.profile, {
    username: "o_centralworld",
    displayName: "OPPO Brand Shop CentralWorld",
    avatarUrl: "https://example.com/avatar.jpg",
    bioDescription: "Official store",
    isVerified: false,
    followerCount: 13751,
    followingCount: 290,
    likesCount: 99800,
    videoCount: 368,
    profileUrl: "https://www.tiktok.com/@o_centralworld",
  });
  assert.equal(result.posts.length, 1);
  assert.equal(result.posts[0].viewCount, 4521);
  assert.equal(result.posts[0].likeCount, 325);
  assert.equal(result.posts[0].commentCount, 17);
  assert.equal(result.posts[0].shareCount, 24);
});

test("extractTikTokPublicData supports legacy UserModule/ItemModule shapes and filters other authors", () => {
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
    ItemModule: {
      own: {
        id: "own-video",
        desc: "Own post",
        createTime: 1788700100,
        author: { uniqueId: "o_centralworld" },
        stats: {
          playCount: "900",
          diggCount: "90",
          commentCount: "9",
          shareCount: "3",
        },
      },
      other: {
        id: "other-video",
        desc: "Other post",
        createTime: 1788700200,
        author: { uniqueId: "another_store" },
        stats: {
          playCount: 999999,
          diggCount: 999,
          commentCount: 99,
          shareCount: 9,
        },
      },
    },
  };

  const result = extractTikTokPublicData([payload], "o_centralworld");

  assert.equal(result.profile?.followerCount, 1000);
  assert.equal(result.profile?.likesCount, 20000);
  assert.deepEqual(result.posts.map((post) => post.id), ["own-video"]);
});

test("extractTikTokPublicData deduplicates repeated network and hydration post payloads", () => {
  const post = {
    id: "same-video",
    desc: "Repeated",
    createTime: 1788700300,
    author: { uniqueId: "o_centralworld" },
    stats: {
      playCount: 100,
      diggCount: 10,
      commentCount: 1,
      shareCount: 2,
    },
  };

  const result = extractTikTokPublicData(
    [{ itemList: [post] }, { data: { itemList: [post] } }],
    "o_centralworld",
  );

  assert.equal(result.posts.length, 1);
  assert.equal(result.posts[0].id, "same-video");
});
