import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  TIKTOK_TOKEN_ENDPOINT,
  TIKTOK_USER_INFO_ENDPOINT,
  TIKTOK_USER_INFO_FIELDS,
  TIKTOK_VIDEO_LIST_ENDPOINT,
  TIKTOK_VIDEO_LIST_FIELDS,
  logTikTokTokenDiagnostic,
  parseTikTokTokenResponse,
} from "../src/app/tiktok/tiktok-api-client.ts";
import {
  clearLatestTikTokData,
  getLatestTikTokData,
  setLatestTikTokData,
} from "../src/app/tiktok/tiktok-data-store.ts";

const apiClientSource = readFileSync(new URL("../src/app/tiktok/tiktok-api-client.ts", import.meta.url), "utf8");
const callbackRouteSource = readFileSync(new URL("../src/app/tiktok/callback/route.ts", import.meta.url), "utf8");
const dashboardPageSource = readFileSync(new URL("../src/app/tiktok/page.tsx", import.meta.url), "utf8");
const dashboardViewSource = readFileSync(new URL("../src/app/tiktok/tiktok-dashboard-view.tsx", import.meta.url), "utf8");
const topNavSource = readFileSync(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");

test("TikTok OAuth and API files exist", () => {
  assert.ok(existsSync(new URL("../src/app/tiktok/tiktok-types.ts", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/tiktok-data-store.ts", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/tiktok-api-client.ts", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/page.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/tiktok-dashboard-view.tsx", import.meta.url)));
});

test("TikTok API endpoints adhere to official TikTok Login Kit v2 specification", () => {
  assert.equal(TIKTOK_TOKEN_ENDPOINT, "https://open.tiktokapis.com/v2/oauth/token/");
  assert.equal(TIKTOK_USER_INFO_ENDPOINT, "https://open.tiktokapis.com/v2/user/info/");
  assert.equal(TIKTOK_VIDEO_LIST_ENDPOINT, "https://open.tiktokapis.com/v2/video/list/");
});

test("TikTok user info and video list fields request required metrics and profile fields", () => {
  assert.match(TIKTOK_USER_INFO_FIELDS, /open_id/);
  assert.match(TIKTOK_USER_INFO_FIELDS, /display_name/);
  assert.match(TIKTOK_USER_INFO_FIELDS, /username/);
  assert.match(TIKTOK_USER_INFO_FIELDS, /follower_count/);
  assert.match(TIKTOK_USER_INFO_FIELDS, /following_count/);
  assert.match(TIKTOK_USER_INFO_FIELDS, /likes_count/);
  assert.match(TIKTOK_USER_INFO_FIELDS, /video_count/);

  assert.match(TIKTOK_VIDEO_LIST_FIELDS, /id/);
  assert.match(TIKTOK_VIDEO_LIST_FIELDS, /create_time/);
  assert.match(TIKTOK_VIDEO_LIST_FIELDS, /cover_image_url/);
  assert.match(TIKTOK_VIDEO_LIST_FIELDS, /view_count/);
  assert.match(TIKTOK_VIDEO_LIST_FIELDS, /like_count/);
  assert.match(TIKTOK_VIDEO_LIST_FIELDS, /comment_count/);
  assert.match(TIKTOK_VIDEO_LIST_FIELDS, /share_count/);
});

test("parseTikTokTokenResponse handles valid flat JSON and nested data envelope", () => {
  // Flat format
  const flatPayload = {
    access_token: "act.sample_access_token_12345",
    refresh_token: "rft.sample_refresh_token_67890",
    open_id: "_000sample_open_id_abc",
    scope: "user.info.basic,user.info.profile,user.info.stats,video.list",
    expires_in: 86400,
    refresh_expires_in: 31536000,
    token_type: "Bearer",
  };

  const parsedFlat = parseTikTokTokenResponse(flatPayload);
  assert.equal(parsedFlat.accessToken, "act.sample_access_token_12345");
  assert.equal(parsedFlat.refreshToken, "rft.sample_refresh_token_67890");
  assert.equal(parsedFlat.openId, "_000sample_open_id_abc");
  assert.equal(parsedFlat.expiresIn, 86400);

  // Nested data envelope format
  const nestedPayload = {
    data: {
      access_token: "act.nested_token_999",
      open_id: "_000nested_open_id",
      scope: "user.info.basic,video.list",
      expires_in: 7200,
    },
    error: {
      code: "ok",
      message: "",
    },
  };

  const parsedNested = parseTikTokTokenResponse(nestedPayload);
  assert.equal(parsedNested.accessToken, "act.nested_token_999");
  assert.equal(parsedNested.openId, "_000nested_open_id");
});

test("parseTikTokTokenResponse throws safe error on invalid payload or TikTok error", () => {
  assert.throws(() => {
    parseTikTokTokenResponse(null);
  }, /Invalid token response/);

  assert.throws(() => {
    parseTikTokTokenResponse({
      error: "invalid_grant",
      error_description: "The provided authorization code is invalid or expired.",
    });
  }, /The provided authorization code is invalid or expired/);

  assert.throws(() => {
    parseTikTokTokenResponse({});
  }, /Missing access_token or open_id/);
});

test("logTikTokTokenDiagnostic emits booleans and counts without logging sensitive strings", () => {
  assert.ok(typeof logTikTokTokenDiagnostic === "function");
  assert.match(apiClientSource, /tokenExchangeSucceeded/);
  assert.match(apiClientSource, /accessTokenPresent/);
  assert.match(apiClientSource, /refreshTokenPresent/);
  assert.match(apiClientSource, /openIdPresent/);
  assert.match(apiClientSource, /grantedScopeCount/);
  assert.doesNotMatch(apiClientSource, /console\.info\([^)]*accessToken,/);
  assert.doesNotMatch(apiClientSource, /console\.info\([^)]*refreshToken,/);
  assert.doesNotMatch(apiClientSource, /console\.info\([^)]*clientSecret,/);
});

test("TikTok server-side data store stores and retrieves account data safely", () => {
  clearLatestTikTokData();
  assert.equal(getLatestTikTokData(), null);

  const sampleData = {
    profile: {
      open_id: "_000test_open_id",
      display_name: "OPPO Store Rama 9",
      username: "opporama9",
      follower_count: 14500,
      following_count: 25,
      likes_count: 89000,
      video_count: 34,
      is_verified: true,
    },
    videos: [
      {
        id: "71234567890123",
        title: "OPPO Find N3 Unboxing",
        view_count: 24500,
        like_count: 3200,
        comment_count: 120,
        share_count: 85,
        duration: 38,
      },
    ],
    updatedAt: new Date().toISOString(),
  };

  setLatestTikTokData(sampleData);
  const retrieved = getLatestTikTokData();
  assert.ok(retrieved);
  assert.equal(retrieved?.profile.display_name, "OPPO Store Rama 9");
  assert.equal(retrieved?.profile.follower_count, 14500);
  assert.equal(retrieved?.videos.length, 1);

  clearLatestTikTokData();
  assert.equal(getLatestTikTokData(), null);
});

test("Callback route handler redirects to /tiktok on success and safe error statuses on failure", () => {
  assert.match(callbackRouteSource, /const\s+tiktokDashboardUrl\s*=\s*new\s+URL\("\/tiktok",\s*publicOrigin\)/);
  assert.match(callbackRouteSource, /resultUrl\.searchParams\.set\("status",\s*"token_error"\)/);
  assert.match(callbackRouteSource, /resultUrl\.searchParams\.set\("status",\s*"profile_error"\)/);
  assert.match(callbackRouteSource, /resultUrl\.searchParams\.set\("status",\s*"state_mismatch"\)/);
});

test("Security: Client Secret, tokens, and authorization code are strictly server-side", () => {
  // No client secret in views
  assert.doesNotMatch(dashboardPageSource, /TIKTOK_CLIENT_SECRET/);
  assert.doesNotMatch(dashboardViewSource, /TIKTOK_CLIENT_SECRET/);
  assert.doesNotMatch(dashboardViewSource, /access_token/);
  assert.doesNotMatch(dashboardViewSource, /refresh_token/);

  // No localStorage or cookies storing tokens in views
  assert.doesNotMatch(dashboardViewSource, /localStorage/);
  assert.doesNotMatch(dashboardViewSource, /sessionStorage/);
  assert.doesNotMatch(dashboardViewSource, /document\.cookie/);
});

test("Dashboard and callback routes are NOT linked from existing TopNavigation", () => {
  assert.doesNotMatch(topNavSource, /href="\/tiktok"/);
  assert.doesNotMatch(topNavSource, /href="\/tiktok\/callback"/);
});
