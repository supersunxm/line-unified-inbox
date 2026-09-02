import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  TIKTOK_TOKEN_ENDPOINT,
  TIKTOK_USER_INFO_ENDPOINT,
  TIKTOK_USER_INFO_FIELDS,
  TIKTOK_VIDEO_LIST_ENDPOINT,
  TIKTOK_VIDEO_LIST_FIELDS,
  TIKTOK_VIDEO_QUERY_ENDPOINT,
  fetchLatestTikTokAccountFromBackend,
  fetchTikTokAccountByIdFromBackend,
  logTikTokTokenDiagnostic,
  logTikTokVideoDiagnostic,
  mergeTikTokVideoItems,
  parseTikTokTokenResponse,
  parseTikTokVideoItem,
  syncTikTokAccountToBackend,
  TikTokBackendAuthenticationError,
} from "../src/app/tiktok/tiktok-api-client.ts";

const apiClientSource = readFileSync(new URL("../src/app/tiktok/tiktok-api-client.ts", import.meta.url), "utf8");
const callbackRouteSource = readFileSync(new URL("../src/app/tiktok/callback/route.ts", import.meta.url), "utf8");
const overviewPageSource = readFileSync(new URL("../src/app/tiktok/page.tsx", import.meta.url), "utf8");
const overviewViewSource = readFileSync(new URL("../src/app/tiktok/tiktok-overview-view.tsx", import.meta.url), "utf8");
const overviewTranslationsSource = readFileSync(new URL("../src/app/tiktok/tiktok-overview-translations.ts", import.meta.url), "utf8");
const overviewUiSource = `${overviewViewSource}\n${overviewTranslationsSource}`;
const dashboardPageSource = readFileSync(new URL("../src/app/tiktok/dashboard/page.tsx", import.meta.url), "utf8");
const dashboardViewSource = readFileSync(new URL("../src/app/tiktok/dashboard/tiktok-dashboard-view.tsx", import.meta.url), "utf8");
const dashboardTranslationsSource = readFileSync(new URL("../src/app/tiktok/dashboard/tiktok-dashboard-translations.ts", import.meta.url), "utf8");
const dashboardUiSource = `${dashboardViewSource}\n${dashboardTranslationsSource}`;
const connectRouteSource = readFileSync(new URL("../src/app/tiktok/connect/route.ts", import.meta.url), "utf8");
const topNavSource = readFileSync(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");

test("TikTok OAuth, overview, and dashboard route files exist", () => {
  assert.ok(existsSync(new URL("../src/app/tiktok/tiktok-types.ts", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/tiktok-api-client.ts", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/page.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/tiktok-overview-view.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/tiktok-overview-translations.ts", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/dashboard/page.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/dashboard/tiktok-dashboard-view.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/dashboard/tiktok-dashboard-translations.ts", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/connect/route.ts", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/connect/success/page.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/connect/error/page.tsx", import.meta.url)));
  assert.equal(existsSync(new URL("../src/app/tiktok/tiktok-data-store.ts", import.meta.url)), false);
});

test("TikTok API endpoints adhere to official TikTok Login Kit v2 specification", () => {
  assert.equal(TIKTOK_TOKEN_ENDPOINT, "https://open.tiktokapis.com/v2/oauth/token/");
  assert.equal(TIKTOK_USER_INFO_ENDPOINT, "https://open.tiktokapis.com/v2/user/info/");
  assert.equal(TIKTOK_VIDEO_LIST_ENDPOINT, "https://open.tiktokapis.com/v2/video/list/");
  assert.equal(TIKTOK_VIDEO_QUERY_ENDPOINT, "https://open.tiktokapis.com/v2/video/query/");
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

  const nestedPayload = {
    data: {
      access_token: "act.nested_token_999",
      open_id: "_000nested_open_id",
      scope: "user.info.basic,video.list",
      expires_in: 7200,
    },
    error: { code: "ok", message: "" },
  };
  const parsedNested = parseTikTokTokenResponse(nestedPayload);
  assert.equal(parsedNested.accessToken, "act.nested_token_999");
  assert.equal(parsedNested.openId, "_000nested_open_id");
});

test("parseTikTokTokenResponse throws safe error on invalid payload or TikTok error", () => {
  assert.throws(() => parseTikTokTokenResponse(null), /Invalid token response/);
  assert.throws(() => parseTikTokTokenResponse({ error: "invalid_grant", error_description: "The provided authorization code is invalid or expired." }), /The provided authorization code is invalid or expired/);
  assert.throws(() => parseTikTokTokenResponse({}), /Missing access_token or open_id/);
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

test("parseTikTokVideoItem parses full video metrics and preserves null/undefined without premature zero coercion", () => {
  const rawVideo = {
    id: "7123456789012345678",
    create_time: 1723600000,
    title: "OPPO Reno 12 Pro Unboxing",
    video_description: "Check out the newest features #OPPO",
    cover_image_url: "https://p16-sign.tiktokcdn.com/cover1.jpg",
    share_url: "https://www.tiktok.com/@oppo/video/7123456789012345678",
    duration: 45,
    view_count: 150000,
    like_count: 12000,
    comment_count: 450,
    share_count: 230,
  };
  const parsed = parseTikTokVideoItem(rawVideo);
  assert.ok(parsed);
  assert.equal(parsed.id, "7123456789012345678");
  assert.equal(parsed.title, "OPPO Reno 12 Pro Unboxing");
  assert.equal(parsed.view_count, 150000);
  assert.equal(parsed.like_count, 12000);
  assert.equal(parsed.comment_count, 450);
  assert.equal(parsed.share_count, 230);
  assert.equal(parsed.cover_image_url, "https://p16-sign.tiktokcdn.com/cover1.jpg");

  const partialVideo = { id: "7123456789012345679", create_time: 1723600000 };
  const parsedPartial = parseTikTokVideoItem(partialVideo);
  assert.ok(parsedPartial);
  assert.equal(parsedPartial.id, "7123456789012345679");
  assert.equal(parsedPartial.view_count, undefined);
  assert.equal(parsedPartial.like_count, undefined);
});

test("mergeTikTokVideoItems enriches list results with /video/query/ performance metrics and fresh cover URLs", () => {
  const listVideos = [
    { id: "vid-1", title: "OPPO Find N3 Flip", cover_image_url: "https://p16-sign.tiktokcdn.com/stale_cover.jpg" },
    { id: "vid-2", title: "OPPO Reno 12 AI Features", cover_image_url: "https://p16-sign.tiktokcdn.com/cover2.jpg", view_count: 5000 },
  ];
  const queryVideos = [
    { id: "vid-1", cover_image_url: "https://p16-sign.tiktokcdn.com/fresh_cover.jpg", view_count: 85000, like_count: 6200, comment_count: 180, share_count: 95 },
  ];
  const merged = mergeTikTokVideoItems(listVideos, queryVideos);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, "vid-1");
  assert.equal(merged[0].cover_image_url, "https://p16-sign.tiktokcdn.com/fresh_cover.jpg");
  assert.equal(merged[0].view_count, 85000);
  assert.equal(merged[0].like_count, 6200);
  assert.equal(merged[1].id, "vid-2");
  assert.equal(merged[1].cover_image_url, "https://p16-sign.tiktokcdn.com/cover2.jpg");
  assert.equal(merged[1].view_count, 5000);
});

test("logTikTokVideoDiagnostic emits metrics completeness without sensitive data", () => {
  assert.ok(typeof logTikTokVideoDiagnostic === "function");
  assert.match(apiClientSource, /videoListCount/);
  assert.match(apiClientSource, /videoQueryCount/);
  assert.match(apiClientSource, /videosWithViewCount/);
  assert.match(apiClientSource, /videosWithCoverImage/);
});

test("Frontend forwards WEB sessions to backend through the canonical oppo_session cookie", () => {
  assert.ok(typeof syncTikTokAccountToBackend === "function");
  assert.ok(typeof fetchLatestTikTokAccountFromBackend === "function");
  assert.match(apiClientSource, /\/tiktok\/sync/);
  assert.match(apiClientSource, /\/tiktok\/latest/);
  assert.match(apiClientSource, /sessionTokenPresent/);
  assert.match(apiClientSource, /backendSyncStatus/);
  assert.match(apiClientSource, /backendReadStatus/);
  assert.match(apiClientSource, /Cookie:\s*`oppo_session=\$\{encodeURIComponent\(sessionToken\)\}`/);
  assert.doesNotMatch(apiClientSource, /Authorization:\s*`Bearer \$\{sessionToken\}`/);
  assert.match(callbackRouteSource, /request\.cookies\.get\("oppo_session"\)/);
  assert.match(overviewPageSource, /fetchLatestTikTokAccountFromBackend/);
  assert.match(dashboardPageSource, /fetchTikTokAccountsListFromBackend/);
  const dynamicDashboardSource = readFileSync(new URL("../src/app/tiktok/dashboard/[accountId]/page.tsx", import.meta.url), "utf8");
  assert.match(dynamicDashboardSource, /fetchTikTokAccountByIdFromBackend/);
});

test("Route structure: /tiktok is Overview and /tiktok/dashboard is Performance Dashboard", () => {
  assert.match(overviewViewSource, /href="\/tiktok\/dashboard"/);
  assert.match(overviewViewSource, /href="\/tiktok\/connect"/);
  assert.doesNotMatch(overviewViewSource, /href="\/dashboard"/);
  assert.match(dashboardViewSource, /href="\/tiktok"/);
  assert.match(dashboardViewSource, /href="\/tiktok\/connect"/);
  assert.doesNotMatch(dashboardViewSource, /href="\/dashboard"/);
});

test("Overview view renders connected account info and localized empty state appropriately", () => {
  assert.match(overviewViewSource, /profile\.display_name/);
  assert.match(overviewViewSource, /profile\.follower_count/);
  assert.match(overviewViewSource, /profile\.following_count/);
  assert.match(overviewViewSource, /profile\.likes_count/);
  assert.match(overviewViewSource, /profile\.video_count/);
  assert.match(overviewUiSource, /Connected/);
  assert.match(overviewUiSource, /Open Dashboard/);
  assert.match(overviewUiSource, /Store not linked yet/);
  assert.doesNotMatch(overviewViewSource, /POC Sandbox/);
  assert.match(dashboardUiSource, /Store not linked yet/);
  assert.doesNotMatch(dashboardViewSource, /POC Sandbox/);
  assert.match(overviewUiSource, /No TikTok Account Connected Yet/);
  assert.match(overviewUiSource, /Connect TikTok Account/);
});

test("TikTok dashboard renders all 6 localized KPI cards, performance highlights, and video analytics", () => {
  assert.match(dashboardUiSource, /Followers/);
  assert.match(dashboardUiSource, /Following/);
  assert.match(dashboardUiSource, /Total Likes/);
  assert.match(dashboardUiSource, /Total Videos/);
  assert.match(dashboardUiSource, /Total Video Views/);
  assert.match(dashboardUiSource, /Avg Views \/ Video/);
  assert.match(dashboardUiSource, /Top Video by Views/);
  assert.match(dashboardUiSource, /Top Video by Likes/);
  assert.match(dashboardUiSource, /Total Engagement/);
  assert.match(dashboardUiSource, /Avg Engagement \/ Post/);
  assert.match(dashboardViewSource, /view_count/);
  assert.match(dashboardViewSource, /like_count/);
  assert.match(dashboardViewSource, /comment_count/);
  assert.match(dashboardViewSource, /share_count/);
  assert.match(dashboardViewSource, /duration/);
  assert.match(dashboardViewSource, /share_url/);
});

test("Security: Client Secret, tokens, and authorization code are strictly server-side", () => {
  assert.doesNotMatch(overviewPageSource, /TIKTOK_CLIENT_SECRET/);
  assert.doesNotMatch(overviewViewSource, /TIKTOK_CLIENT_SECRET/);
  assert.doesNotMatch(overviewViewSource, /access_token/);
  assert.doesNotMatch(overviewViewSource, /refresh_token/);
  assert.doesNotMatch(dashboardPageSource, /TIKTOK_CLIENT_SECRET/);
  assert.doesNotMatch(dashboardViewSource, /TIKTOK_CLIENT_SECRET/);
  assert.doesNotMatch(dashboardViewSource, /access_token/);
  assert.doesNotMatch(dashboardViewSource, /refresh_token/);
  assert.doesNotMatch(overviewViewSource, /localStorage/);
  assert.doesNotMatch(overviewViewSource, /sessionStorage/);
  assert.doesNotMatch(overviewViewSource, /document\.cookie/);
  assert.doesNotMatch(dashboardViewSource, /localStorage/);
  assert.doesNotMatch(dashboardViewSource, /sessionStorage/);
  assert.doesNotMatch(dashboardViewSource, /document\.cookie/);
});

test("TikTok is linked from current shell navigation without deep callback links", () => {
  assert.match(topNavSource, /href="\/tiktok"/);
  assert.doesNotMatch(topNavSource, /href="\/tiktok\/dashboard"/);
  assert.doesNotMatch(topNavSource, /href="\/tiktok\/callback"/);
});

test("Authentication boundary: Admin TikTok routes require oppo_session and redirect to /login when unauthenticated", () => {
  const nextConfigContent = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
  const apiLibContent = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
  const callbackValidatorSource = readFileSync(new URL("../src/app/tiktok/callback/tiktok-callback-validator.ts", import.meta.url), "utf8");
  assert.match(nextConfigContent, /createAuthRewrite/);
  assert.match(nextConfigContent, /source:\s*["']\/auth\/:path\*["']/);
  assert.match(apiLibContent, /path\.startsWith\(["']\/auth\/["']\)/);
  assert.match(overviewPageSource, /redirect\(["']\/login["']\)/);
  assert.match(dashboardPageSource, /redirect\(["']\/login["']\)/);
  assert.doesNotMatch(connectRouteSource, /redirect\(["']\/login["']\)/);
  assert.match(callbackRouteSource, /requestHasOppoSession/);
  assert.match(callbackValidatorSource, /requestHasOppoSession:\s*Boolean/);
});

test("Follower growth KPI rendering and localized Follower Growth Chart component", () => {
  const chartSource = readFileSync(new URL("../src/app/tiktok/dashboard/tiktok-follower-chart.tsx", import.meta.url), "utf8");
  const chartUiSource = `${chartSource}\n${dashboardTranslationsSource}`;
  assert.match(dashboardUiSource, /Today/);
  assert.match(dashboardUiSource, /7 Days/);
  assert.match(dashboardUiSource, /30 Days/);
  assert.match(dashboardViewSource, /TikTokFollowerGrowthChart/);
  const dynamicDashboardSource = readFileSync(new URL("../src/app/tiktok/dashboard/[accountId]/page.tsx", import.meta.url), "utf8");
  assert.match(dynamicDashboardSource, /fetchTikTokHistoricalMetricsFromBackend/);
  assert.match(chartSource, /sortedData\.length >= 2/);
  assert.match(chartUiSource, /Collecting Daily Snapshots/);
  assert.match(chartUiSource, /At least 2 daily snapshots/);
  assert.match(chartSource, /<path\s+d=\{linePath\}/);
  assert.match(chartSource, /<path\s+d=\{areaPath\}/);
  assert.match(chartSource, /followerAreaGrad/);
  assert.match(chartSource, /text-emerald-600/);
  assert.match(chartSource, /text-rose-600/);
  assert.match(chartSource, /--/);
});

test("Multi-account store support: /tiktok overview cards grid, /tiktok/dashboard/[accountId] route, and localized store switcher", () => {
  const dynamicDashboardSource = readFileSync(new URL("../src/app/tiktok/dashboard/[accountId]/page.tsx", import.meta.url), "utf8");
  const latestOverviewSource = readFileSync(new URL("../src/app/tiktok/tiktok-overview-view.tsx", import.meta.url), "utf8");
  const latestDashboardViewSource = readFileSync(new URL("../src/app/tiktok/dashboard/tiktok-dashboard-view.tsx", import.meta.url), "utf8");
  const latestOverviewUiSource = `${latestOverviewSource}\n${overviewTranslationsSource}`;
  const latestDashboardUiSource = `${latestDashboardViewSource}\n${dashboardTranslationsSource}`;

  assert.ok(existsSync(new URL("../src/app/tiktok/dashboard/[accountId]/page.tsx", import.meta.url)));
  assert.match(dynamicDashboardSource, /fetchTikTokAccountByIdFromBackend/);
  assert.match(dynamicDashboardSource, /fetchTikTokHistoricalMetricsFromBackend/);
  assert.match(dynamicDashboardSource, /fetchTikTokAccountsListFromBackend/);
  assert.match(dynamicDashboardSource, /notFound\(\)/);
  assert.match(latestOverviewSource, /totalAccounts > 1/);
  assert.match(latestOverviewUiSource, /Connected Store Accounts/);
  assert.match(overviewTranslationsSource, /storeBinding:\s*"Store Binding"/);
  assert.match(latestOverviewSource, /\{t\.storeBinding\}:/);
  assert.match(latestOverviewUiSource, /Open Dashboard/);
  assert.match(latestOverviewSource, /href=\{`\/tiktok\/dashboard\/\$\{account\.id\}`\}/);
  assert.match(latestDashboardViewSource, /id="tiktok-store-switcher"/);
  assert.match(latestDashboardViewSource, /window\.location\.assign\(`\/tiktok\/dashboard\/\$\{event\.target\.value\}`\)/);
  assert.match(latestDashboardUiSource, /Stores Overview/);
  assert.match(apiClientSource, /export async function fetchTikTokAccountByIdFromBackend/);
  assert.match(apiClientSource, /`\$\{API_BASE_URL\}\/tiktok\/accounts\/\$\{encodeURIComponent\(accountId\)\}`/);

  const rootDashboardSource = readFileSync(new URL("../src/app/tiktok/dashboard/page.tsx", import.meta.url), "utf8");
  assert.match(rootDashboardSource, /accounts\.length === 0/);
  assert.match(rootDashboardSource, /<TikTokDashboardResponsive data=\{null\} \/>/);
  assert.match(rootDashboardSource, /accounts\.length === 1/);
  assert.match(rootDashboardSource, /redirect\(`\/tiktok\/dashboard\/\$\{accounts\[0\]\.id\}`\)/);
  assert.match(rootDashboardSource, /redirect\(["']\/tiktok["']\)/);
  assert.doesNotMatch(rootDashboardSource, /accounts\.length > 0\s*\)\s*\{\s*redirect\(`\/tiktok\/dashboard/);
});

test("Dashboard account fetch returns valid data, preserves 404, and exposes 401 authentication failure", async () => {
  const originalFetch = globalThis.fetch;
  let forwardedCookie = "";
  const validAccount = {
    id: "account-1",
    openId: "open-1",
    displayName: "O-Central World",
    username: "o_centralworld",
    followerCount: 10,
    followingCount: 2,
    likesCount: 30,
    videoCount: 1,
    isVerified: false,
    lastSyncedAt: "2026-08-25T03:18:22.864Z",
    videos: [],
  };

  try {
    globalThis.fetch = async (_input, init) => {
      forwardedCookie = new Headers(init?.headers).get("Cookie") || "";
      return Response.json(validAccount);
    };
    const account = await fetchTikTokAccountByIdFromBackend("account-1", { sessionToken: "valid-session" });
    assert.equal(account?.id, "account-1");
    assert.equal(account?.profile.display_name, "O-Central World");
    assert.equal(forwardedCookie, "oppo_session=valid-session");
    globalThis.fetch = async () => new Response(null, { status: 404 });
    assert.equal(await fetchTikTokAccountByIdFromBackend("missing", { sessionToken: "valid-session" }), null);
    globalThis.fetch = async () => new Response(null, { status: 401 });
    await assert.rejects(fetchTikTokAccountByIdFromBackend("account-1", { sessionToken: "expired-session" }), TikTokBackendAuthenticationError);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Dynamic dashboard redirects backend 401 to login and reserves notFound for a missing account", () => {
  const dynamicDashboardSource = readFileSync(new URL("../src/app/tiktok/dashboard/[accountId]/page.tsx", import.meta.url), "utf8");
  assert.match(dynamicDashboardSource, /error instanceof TikTokBackendAuthenticationError/);
  assert.match(dynamicDashboardSource, /redirect\("\/login"\)/);
  assert.match(dynamicDashboardSource, /if \(!data\) \{\s*notFound\(\);/s);
});
