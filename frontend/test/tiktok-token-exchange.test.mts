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
  logTikTokTokenDiagnostic,
  logTikTokVideoDiagnostic,
  mergeTikTokVideoItems,
  parseTikTokTokenResponse,
  parseTikTokVideoItem,
  syncTikTokAccountToBackend,
} from "../src/app/tiktok/tiktok-api-client.ts";

const apiClientSource = readFileSync(new URL("../src/app/tiktok/tiktok-api-client.ts", import.meta.url), "utf8");
const callbackRouteSource = readFileSync(new URL("../src/app/tiktok/callback/route.ts", import.meta.url), "utf8");
const overviewPageSource = readFileSync(new URL("../src/app/tiktok/page.tsx", import.meta.url), "utf8");
const overviewViewSource = readFileSync(new URL("../src/app/tiktok/tiktok-overview-view.tsx", import.meta.url), "utf8");
const dashboardPageSource = readFileSync(new URL("../src/app/tiktok/dashboard/page.tsx", import.meta.url), "utf8");
const dashboardViewSource = readFileSync(new URL("../src/app/tiktok/dashboard/tiktok-dashboard-view.tsx", import.meta.url), "utf8");
const connectRouteSource = readFileSync(new URL("../src/app/tiktok/connect/route.ts", import.meta.url), "utf8");
const topNavSource = readFileSync(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");

test("TikTok OAuth, overview, and dashboard route files exist", () => {
  assert.ok(existsSync(new URL("../src/app/tiktok/tiktok-types.ts", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/tiktok-api-client.ts", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/page.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/tiktok-overview-view.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/dashboard/page.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/dashboard/tiktok-dashboard-view.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/connect/route.ts", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/connect/success/page.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/connect/error/page.tsx", import.meta.url)));
  // In-memory store permanently removed
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

  // Missing metric fields should remain undefined, not prematurely coerced to 0
  const partialVideo = {
    id: "7123456789012345679",
    create_time: 1723600000,
  };
  const parsedPartial = parseTikTokVideoItem(partialVideo);
  assert.ok(parsedPartial);
  assert.equal(parsedPartial.id, "7123456789012345679");
  assert.equal(parsedPartial.view_count, undefined);
  assert.equal(parsedPartial.like_count, undefined);
});

test("mergeTikTokVideoItems enriches list results with /video/query/ performance metrics and fresh cover URLs", () => {
  const listVideos = [
    {
      id: "vid-1",
      title: "OPPO Find N3 Flip",
      cover_image_url: "https://p16-sign.tiktokcdn.com/stale_cover.jpg",
    },
    {
      id: "vid-2",
      title: "OPPO Reno 12 AI Features",
      cover_image_url: "https://p16-sign.tiktokcdn.com/cover2.jpg",
      view_count: 5000,
    },
  ];

  const queryVideos = [
    {
      id: "vid-1",
      cover_image_url: "https://p16-sign.tiktokcdn.com/fresh_cover.jpg",
      view_count: 85000,
      like_count: 6200,
      comment_count: 180,
      share_count: 95,
    },
  ];

  const merged = mergeTikTokVideoItems(listVideos, queryVideos);
  assert.equal(merged.length, 2);

  // Enriched vid-1 gets fresh cover URL and query metrics
  assert.equal(merged[0].id, "vid-1");
  assert.equal(merged[0].cover_image_url, "https://p16-sign.tiktokcdn.com/fresh_cover.jpg");
  assert.equal(merged[0].view_count, 85000);
  assert.equal(merged[0].like_count, 6200);

  // Unmodified vid-2 keeps its existing data
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

test("Frontend interacts with backend PostgreSQL sync and query endpoints with canonical Bearer session auth", () => {
  assert.ok(typeof syncTikTokAccountToBackend === "function");
  assert.ok(typeof fetchLatestTikTokAccountFromBackend === "function");
  assert.match(apiClientSource, /\/tiktok\/sync/);
  assert.match(apiClientSource, /\/tiktok\/latest/);
  assert.match(apiClientSource, /sessionTokenPresent/);
  assert.match(apiClientSource, /backendSyncStatus/);
  assert.match(apiClientSource, /backendReadStatus/);
  assert.match(apiClientSource, /Bearer \$\{sessionToken\}/);
  // Verify raw cookie header is NOT forwarded to backend
  assert.doesNotMatch(apiClientSource, /headers\["Cookie"\]/);
  assert.match(callbackRouteSource, /request\.cookies\.get\("oppo_session"\)/);
  assert.match(overviewPageSource, /fetchLatestTikTokAccountFromBackend/);
  assert.match(dashboardPageSource, /fetchTikTokAccountsListFromBackend/);
  const dynamicDashboardSource = readFileSync(new URL("../src/app/tiktok/dashboard/[accountId]/page.tsx", import.meta.url), "utf8");
  assert.match(dynamicDashboardSource, /fetchTikTokAccountByIdFromBackend/);
});

test("Route structure: /tiktok is Overview and /tiktok/dashboard is Performance Dashboard", () => {
  // Overview view links to /tiktok/dashboard and /tiktok/connect
  assert.match(overviewViewSource, /href="\/tiktok\/dashboard"/);
  assert.match(overviewViewSource, /href="\/tiktok\/connect"/);
  assert.doesNotMatch(overviewViewSource, /href="\/dashboard"/);

  // Dashboard view links to /tiktok and /tiktok/connect
  assert.match(dashboardViewSource, /href="\/tiktok"/);
  assert.match(dashboardViewSource, /href="\/tiktok\/connect"/);
  assert.doesNotMatch(dashboardViewSource, /href="\/dashboard"/);
});

test("Overview view renders connected account info and empty state appropriately", () => {
  // Connected elements
  assert.match(overviewViewSource, /profile\.display_name/);
  assert.match(overviewViewSource, /profile\.follower_count/);
  assert.match(overviewViewSource, /profile\.following_count/);
  assert.match(overviewViewSource, /profile\.likes_count/);
  assert.match(overviewViewSource, /profile\.video_count/);
  assert.match(overviewViewSource, /Connected/);
  assert.match(overviewViewSource, /Open Dashboard/);

  // Neutral store attribution fallback when storeMaster is null
  assert.match(overviewViewSource, /Store not linked yet/);
  assert.doesNotMatch(overviewViewSource, /POC Sandbox/);
  assert.match(dashboardViewSource, /Store not linked yet/);
  assert.doesNotMatch(dashboardViewSource, /POC Sandbox/);

  // Empty state elements
  assert.match(overviewViewSource, /No TikTok Account Connected Yet/);
  assert.match(overviewViewSource, /Connect TikTok Account/);
});

test("TikTok dashboard renders all 6 KPI cards, performance highlights, and video analytics", () => {
  // 6 KPIs
  assert.match(dashboardViewSource, /Followers/);
  assert.match(dashboardViewSource, /Following/);
  assert.match(dashboardViewSource, /Total Likes/);
  assert.match(dashboardViewSource, /Total Videos/);
  assert.match(dashboardViewSource, /Total Video Views/);
  assert.match(dashboardViewSource, /Avg Views \/ Video/);

  // Performance Highlights
  assert.match(dashboardViewSource, /Top Video by Views/);
  assert.match(dashboardViewSource, /Top Video by Likes/);
  assert.match(dashboardViewSource, /Total Engagement/);
  assert.match(dashboardViewSource, /Avg Engagement \/ Post/);

  // Video item analytics
  assert.match(dashboardViewSource, /view_count/);
  assert.match(dashboardViewSource, /like_count/);
  assert.match(dashboardViewSource, /comment_count/);
  assert.match(dashboardViewSource, /share_count/);
  assert.match(dashboardViewSource, /duration/);
  assert.match(dashboardViewSource, /share_url/);
});

test("Security: Client Secret, tokens, and authorization code are strictly server-side", () => {
  // No client secret in views
  assert.doesNotMatch(overviewPageSource, /TIKTOK_CLIENT_SECRET/);
  assert.doesNotMatch(overviewViewSource, /TIKTOK_CLIENT_SECRET/);
  assert.doesNotMatch(overviewViewSource, /access_token/);
  assert.doesNotMatch(overviewViewSource, /refresh_token/);

  assert.doesNotMatch(dashboardPageSource, /TIKTOK_CLIENT_SECRET/);
  assert.doesNotMatch(dashboardViewSource, /TIKTOK_CLIENT_SECRET/);
  assert.doesNotMatch(dashboardViewSource, /access_token/);
  assert.doesNotMatch(dashboardViewSource, /refresh_token/);

  // No localStorage or cookies storing tokens in views
  assert.doesNotMatch(overviewViewSource, /localStorage/);
  assert.doesNotMatch(overviewViewSource, /sessionStorage/);
  assert.doesNotMatch(overviewViewSource, /document\.cookie/);
  assert.doesNotMatch(dashboardViewSource, /localStorage/);
  assert.doesNotMatch(dashboardViewSource, /sessionStorage/);
  assert.doesNotMatch(dashboardViewSource, /document\.cookie/);
});

test("Dashboard and callback routes are NOT linked from existing TopNavigation", () => {
  assert.doesNotMatch(topNavSource, /href="\/tiktok"/);
  assert.doesNotMatch(topNavSource, /href="\/tiktok\/dashboard"/);
  assert.doesNotMatch(topNavSource, /href="\/tiktok\/callback"/);
});

test("Authentication boundary: Admin TikTok routes require oppo_session and redirect to /login when unauthenticated", () => {
  const nextConfigContent = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
  const apiLibContent = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
  const callbackValidatorSource = readFileSync(new URL("../src/app/tiktok/callback/tiktok-callback-validator.ts", import.meta.url), "utf8");

  // Next.js rewrites proxy /auth/* to establish oppo_session cookie on lineoppo.click
  assert.match(nextConfigContent, /createAuthRewrite/);
  assert.match(nextConfigContent, /source:\s*["']\/auth\/:path\*["']/);
  assert.match(apiLibContent, /path\.startsWith\(["']\/auth\/["']\)/);

  // Admin TikTok Overview and Dashboard redirect unauthenticated requests to /login
  assert.match(overviewPageSource, /redirect\(["']\/login["']\)/);
  assert.match(dashboardPageSource, /redirect\(["']\/login["']\)/);

  // Public store authorization entry does NOT redirect to /login
  assert.doesNotMatch(connectRouteSource, /redirect\(["']\/login["']\)/);

  // Safe diagnostics log requestHasOppoSession boolean
  assert.match(callbackRouteSource, /requestHasOppoSession/);
  assert.match(callbackValidatorSource, /requestHasOppoSession:\s*Boolean/);
});

test("Follower growth KPI rendering and Follower Growth Chart component", () => {
  const chartSource = readFileSync(new URL("../src/app/tiktok/dashboard/tiktok-follower-chart.tsx", import.meta.url), "utf8");

  // 1. Dashboard view incorporates growth delta breakdown and chart
  assert.match(dashboardViewSource, /Today/);
  assert.match(dashboardViewSource, /7 Days/);
  assert.match(dashboardViewSource, /30 Days/);
  assert.match(dashboardViewSource, /TikTokFollowerGrowthChart/);
  const dynamicDashboardSource = readFileSync(new URL("../src/app/tiktok/dashboard/[accountId]/page.tsx", import.meta.url), "utf8");
  assert.match(dynamicDashboardSource, /fetchTikTokHistoricalMetricsFromBackend/);

  // 2. Chart component verifies sparse data empty state (< 2 snapshots)
  assert.match(chartSource, /sortedData\.length >= 2/);
  assert.match(chartSource, /Collecting Daily Snapshots/);
  assert.match(chartSource, /At least 2 daily snapshots/);

  // 3. Chart component implements non-interpolated SVG lines and area gradients
  assert.match(chartSource, /<path\s+d=\{linePath\}/);
  assert.match(chartSource, /<path\s+d=\{areaPath\}/);
  assert.match(chartSource, /followerAreaGrad/);

  // 4. Positive, negative, and null growth formatting rules
  assert.match(chartSource, /text-emerald-600/);
  assert.match(chartSource, /text-rose-600/);
  assert.match(chartSource, /--/);
});

test("Multi-account store support: /tiktok overview cards grid, /tiktok/dashboard/[accountId] route, and store switcher", () => {
  const dynamicDashboardSource = readFileSync(new URL("../src/app/tiktok/dashboard/[accountId]/page.tsx", import.meta.url), "utf8");
  const latestOverviewSource = readFileSync(new URL("../src/app/tiktok/tiktok-overview-view.tsx", import.meta.url), "utf8");
  const latestDashboardViewSource = readFileSync(new URL("../src/app/tiktok/dashboard/tiktok-dashboard-view.tsx", import.meta.url), "utf8");

  // 1. /tiktok/dashboard/[accountId]/page.tsx route exists and fetches account by ID
  assert.ok(existsSync(new URL("../src/app/tiktok/dashboard/[accountId]/page.tsx", import.meta.url)));
  assert.match(dynamicDashboardSource, /fetchTikTokAccountByIdFromBackend/);
  assert.match(dynamicDashboardSource, /fetchTikTokHistoricalMetricsFromBackend/);
  assert.match(dynamicDashboardSource, /fetchTikTokAccountsListFromBackend/);
  assert.match(dynamicDashboardSource, /notFound\(\)/);

  // 2. /tiktok overview renders multi-account grid when multiple accounts exist
  assert.match(latestOverviewSource, /totalAccounts > 1/);
  assert.match(latestOverviewSource, /Connected Store Accounts/);
  assert.match(latestOverviewSource, /Store Binding:/);
  assert.match(latestOverviewSource, /Open Dashboard/);
  assert.match(latestOverviewSource, /href=\{`\/tiktok\/dashboard\/\$\{account\.id\}`\}/);

  // 3. /tiktok/dashboard view includes account switcher and links to specific accounts
  assert.match(latestDashboardViewSource, /id="tiktok-store-switcher"/);
  assert.match(latestDashboardViewSource, /`\/tiktok\/dashboard\/\$\{e\.target\.value\}`/);
  assert.match(latestDashboardViewSource, /Stores Overview/);

  // 4. API client supports fetchTikTokAccountByIdFromBackend
  assert.match(apiClientSource, /export async function fetchTikTokAccountByIdFromBackend/);
  assert.match(apiClientSource, /`\$\{API_BASE_URL\}\/tiktok\/accounts\/\$\{encodeURIComponent\(accountId\)\}`/);

  // 5. Root /tiktok/dashboard page redirect behavior:
  // - 0 accounts: renders empty state
  // - 1 account: redirects to /tiktok/dashboard/<accountId>
  // - 2+ accounts: redirects to /tiktok overview (never arbitrarily selects accounts[0])
  const rootDashboardSource = readFileSync(new URL("../src/app/tiktok/dashboard/page.tsx", import.meta.url), "utf8");
  assert.match(rootDashboardSource, /accounts\.length === 0/);
  assert.match(rootDashboardSource, /<TikTokDashboardView data=\{null\} \/>/);
  assert.match(rootDashboardSource, /accounts\.length === 1/);
  assert.match(rootDashboardSource, /redirect\(`\/tiktok\/dashboard\/\$\{accounts\[0\]\.id\}`\)/);
  assert.match(rootDashboardSource, /redirect\(["']\/tiktok["']\)/);
  // Guarantee no arbitrary accounts[0] fallback when accounts.length > 1
  assert.doesNotMatch(rootDashboardSource, /accounts\.length > 0\s*\)\s*\{\s*redirect\(`\/tiktok\/dashboard/);
});


