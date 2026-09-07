import assert from "node:assert/strict";
import test from "node:test";
import {
  capturePageSnapshotWithSettling,
  classifyTikTokDiagnostics,
  extractTikTokPublicProfile,
  extractTikTokStatusCode,
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
    metricSource: "statsV2",
    metricPrecision: "EXACT",
  });
});

test("extractTikTokPublicProfile marks legacy display stats as rounded", () => {
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
  assert.equal(profile?.metricSource, "stats");
  assert.equal(profile?.metricPrecision, "DISPLAY_ROUNDED");
});

test("extractTikTokStatusCode extracts status codes from hydration scope", () => {
  const audiencePayload = {
    __DEFAULT_SCOPE__: {
      "webapp.user-detail": {
        statusCode: 209002,
        statusMsg: "",
      },
    },
  };
  const notFoundPayload = {
    __DEFAULT_SCOPE__: {
      "webapp.user-detail": {
        statusCode: 10221,
        statusMsg: "",
      },
    },
  };

  assert.equal(extractTikTokStatusCode([audiencePayload]), 209002);
  assert.equal(extractTikTokStatusCode([notFoundPayload]), 10221);
  assert.equal(extractTikTokStatusCode([{ unrelated: true }]), null);
});

test("classifyTikTokDiagnostics categorizes public profile outcomes correctly", () => {
  assert.equal(
    classifyTikTokDiagnostics({
      profile: {
        username: "o_centralworld",
        displayName: null,
        avatarUrl: null,
        bioDescription: null,
        isVerified: null,
        followerCount: 100,
        followingCount: 10,
        likesCount: 500,
        videoCount: 20,
        profileUrl: "https://www.tiktok.com/@o_centralworld",
        metricSource: "statsV2",
        metricPrecision: "EXACT",
      },
      statusCode: 0,
      bodyText: "",
      pageTitle: "TikTok",
      captchaOrBlockDetected: false,
      hydrationCount: 1,
      navigationMessage: null,
    }).category,
    "OK_EXACT",
  );

  assert.equal(
    classifyTikTokDiagnostics({
      profile: null,
      statusCode: 209002,
      bodyText: "This creator turned on audience controls.",
      pageTitle: "TikTok",
      captchaOrBlockDetected: false,
      hydrationCount: 1,
      navigationMessage: null,
    }).category,
    "AUDIENCE_CONTROLLED",
  );

  assert.equal(
    classifyTikTokDiagnostics({
      profile: null,
      statusCode: 10221,
      bodyText: "Couldn't find this account",
      pageTitle: "TikTok",
      captchaOrBlockDetected: false,
      hydrationCount: 1,
      navigationMessage: null,
    }).category,
    "ACCOUNT_NOT_FOUND",
  );

  assert.equal(
    classifyTikTokDiagnostics({
      profile: null,
      statusCode: null,
      bodyText: "Security Verification: verify to continue",
      pageTitle: "TikTok",
      captchaOrBlockDetected: true,
      hydrationCount: 0,
      navigationMessage: null,
    }).category,
    "VERIFICATION_REQUIRED",
  );

  assert.equal(
    classifyTikTokDiagnostics({
      profile: null,
      statusCode: null,
      bodyText: "some random text",
      pageTitle: "TikTok",
      captchaOrBlockDetected: false,
      hydrationCount: 1,
      navigationMessage: null,
    }).category,
    "PARSE_FAILED",
  );
});

test("capturePageSnapshotWithSettling waits for attached hydration element before evaluation", async () => {
  const callOrder: string[] = [];
  const fakePage = {
    waitForSelector: async (selector: string, options?: { state?: string; timeout?: number }) => {
      callOrder.push(`waitForSelector:${options?.state ?? "default"}`);
      assert.equal(options?.state, "attached");
      return null;
    },
    evaluate: async () => {
      callOrder.push("evaluate");
      return {
        scripts: [{ id: "__UNIVERSAL_DATA_FOR_REHYDRATION__", text: '{"ok":true}' }],
        title: "TikTok - Make Your Day",
        bodyText: "",
        finalUrl: "https://www.tiktok.com/@test",
      };
    },
    waitForTimeout: async () => {},
  };

  const snapshot = await capturePageSnapshotWithSettling(
    fakePage,
    ["__UNIVERSAL_DATA_FOR_REHYDRATION__"],
    { selectorTimeoutMs: 2000 },
  );

  assert.deepEqual(callOrder, ["waitForSelector:attached", "evaluate"]);
  assert.equal(snapshot.title, "TikTok - Make Your Day");
  assert.equal(snapshot.scripts[0]?.text, '{"ok":true}');
});

test("capturePageSnapshotWithSettling retries safely when execution context was destroyed", async () => {
  let attempts = 0;
  const fakePage = {
    waitForSelector: async () => null,
    evaluate: async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("page.evaluate: Execution context was destroyed, most likely because of a navigation");
      }
      return {
        scripts: [{ id: "__UNIVERSAL_DATA_FOR_REHYDRATION__", text: '{"recovered":true}' }],
        title: "TikTok - Settled",
        bodyText: "",
        finalUrl: "https://www.tiktok.com/@test",
      };
    },
    waitForTimeout: async () => {},
  };

  const snapshot = await capturePageSnapshotWithSettling(
    fakePage,
    ["__UNIVERSAL_DATA_FOR_REHYDRATION__"],
    { selectorTimeoutMs: 2000, retryTimeoutMs: 1000 },
  );

  assert.equal(attempts, 2);
  assert.equal(snapshot.title, "TikTok - Settled");
  assert.equal(snapshot.scripts[0]?.text, '{"recovered":true}');
});

test("capturePageSnapshotWithSettling proceeds gracefully when selector times out", async () => {
  const fakePage = {
    waitForSelector: async () => {
      throw new Error("Timeout 2000ms exceeded waiting for selector");
    },
    evaluate: async () => ({
      scripts: [{ id: "__UNIVERSAL_DATA_FOR_REHYDRATION__", text: null }],
      title: "TikTok - 404",
      bodyText: "Couldn't find this account",
      finalUrl: "https://www.tiktok.com/@missing",
    }),
    waitForTimeout: async () => {},
  };

  const snapshot = await capturePageSnapshotWithSettling(
    fakePage,
    ["__UNIVERSAL_DATA_FOR_REHYDRATION__"],
    { selectorTimeoutMs: 2000 },
  );

  assert.equal(snapshot.title, "TikTok - 404");
  assert.equal(snapshot.bodyText, "Couldn't find this account");
});


