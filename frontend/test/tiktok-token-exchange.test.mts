import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  TIKTOK_TOKEN_ENDPOINT,
  TIKTOK_USER_INFO_ENDPOINT,
  TIKTOK_USER_INFO_FIELDS,
  TIKTOK_VIDEO_LIST_ENDPOINT,
  TIKTOK_VIDEO_LIST_FIELDS,
  fetchLatestTikTokAccountFromBackend,
  logTikTokTokenDiagnostic,
  parseTikTokTokenResponse,
  syncTikTokAccountToBackend,
} from "../src/app/tiktok/tiktok-api-client.ts";

const apiClientSource = readFileSync(new URL("../src/app/tiktok/tiktok-api-client.ts", import.meta.url), "utf8");
const callbackRouteSource = readFileSync(new URL("../src/app/tiktok/callback/route.ts", import.meta.url), "utf8");
const dashboardPageSource = readFileSync(new URL("../src/app/tiktok/page.tsx", import.meta.url), "utf8");
const dashboardViewSource = readFileSync(new URL("../src/app/tiktok/tiktok-dashboard-view.tsx", import.meta.url), "utf8");
const topNavSource = readFileSync(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");

test("TikTok OAuth and API files exist", () => {
  assert.ok(existsSync(new URL("../src/app/tiktok/tiktok-types.ts", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/tiktok-api-client.ts", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/page.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/tiktok-dashboard-view.tsx", import.meta.url)));
  // In-memory store removed
  assert.equal(existsSync(new URL("../src/app/tiktok/tiktok-data-store.ts", import.meta.url)), false);
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

test("Frontend interacts with backend PostgreSQL sync and query endpoints", () => {
  assert.ok(typeof syncTikTokAccountToBackend === "function");
  assert.ok(typeof fetchLatestTikTokAccountFromBackend === "function");
  assert.match(apiClientSource, /\/tiktok\/sync/);
  assert.match(apiClientSource, /\/tiktok\/latest/);
  assert.match(callbackRouteSource, /syncTikTokAccountToBackend/);
  assert.match(dashboardPageSource, /fetchLatestTikTokAccountFromBackend/);
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
