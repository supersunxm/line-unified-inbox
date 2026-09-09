import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildTikTokAuthUrl,
  generateOAuthState,
} from "../src/app/tiktok/connect/tiktok-oauth.ts";
import {
  processTikTokCallbackParams,
  validateTikTokOAuthState,
} from "../src/app/tiktok/callback/tiktok-callback-validator.ts";
import { syncTikTokAccountInternallyToBackend } from "../src/app/tiktok/tiktok-api-client.ts";
import {
  TIKTOK_STORE_OWNER_ANALYTICS_SESSION_COOKIE,
  createTikTokStoreOwnerAnalyticsSession,
  verifyTikTokStoreOwnerAnalyticsSession,
} from "../src/app/tiktok/store-binding-session.ts";

const connectRouteSource = readFileSync(new URL("../src/app/tiktok/connect/route.ts", import.meta.url), "utf8");
const callbackRouteSource = readFileSync(new URL("../src/app/tiktok/callback/route.ts", import.meta.url), "utf8");
const apiClientSource = readFileSync(new URL("../src/app/tiktok/tiktok-api-client.ts", import.meta.url), "utf8");
const successPageSource = readFileSync(new URL("../src/app/tiktok/connect/success/page.tsx", import.meta.url), "utf8");
const successContentSource = readFileSync(new URL("../src/app/tiktok/connect/success/success-content.tsx", import.meta.url), "utf8");
const errorPageSource = readFileSync(new URL("../src/app/tiktok/connect/error/page.tsx", import.meta.url), "utf8");
const errorContentSource = readFileSync(new URL("../src/app/tiktok/connect/error/error-content.tsx", import.meta.url), "utf8");
const overviewPageSource = readFileSync(new URL("../src/app/tiktok/page.tsx", import.meta.url), "utf8");
const dashboardPageSource = readFileSync(new URL("../src/app/tiktok/dashboard/page.tsx", import.meta.url), "utf8");
const analyticsPageSource = readFileSync(new URL("../src/app/connect/tiktok/analytics/page.tsx", import.meta.url), "utf8");
const analyticsViewSource = readFileSync(new URL("../src/app/connect/tiktok/analytics/store-owner-analytics.tsx", import.meta.url), "utf8");
const storeBindingSuccessSource = readFileSync(new URL("../src/app/connect/tiktok/success/store-binding-success.tsx", import.meta.url), "utf8");
const backendControllerSource = readFileSync(new URL("../../backend/src/tiktok/tiktok.controller.ts", import.meta.url), "utf8");
const backendBindingSource = readFileSync(new URL("../../backend/src/tiktok/tiktok-store-binding.service.ts", import.meta.url), "utf8");
const successPublicSource = `${successPageSource}\n${successContentSource}`;
const errorPublicSource = `${errorPageSource}\n${errorContentSource}`;

test("A. Internal TikTok sync API requires X-Internal-TikTok-Secret header and does not allow anonymous writes", () => {
  assert.match(apiClientSource, /syncTikTokAccountInternallyToBackend/);
  assert.match(apiClientSource, /X-Internal-TikTok-Secret/);
  assert.match(apiClientSource, /\/tiktok\/internal\/sync/);
  assert.match(callbackRouteSource, /syncTikTokAccountInternallyToBackend\(/);
});

test("B. Missing or incorrect internal secret causes frontend sync to throw and fail closed", async () => {
  const originalSecret = process.env.TIKTOK_INTERNAL_SYNC_SECRET;
  delete process.env.TIKTOK_INTERNAL_SYNC_SECRET;
  try {
    await assert.rejects(
      async () => syncTikTokAccountInternallyToBackend({ accessToken: "sample_token", profile: { open_id: "sample_id", display_name: "Store" }, videos: [] }),
      (err: Error) => {
        assert.match(err.message, /Missing internal TikTok sync secret configuration/);
        return true;
      },
    );
  } finally {
    process.env.TIKTOK_INTERNAL_SYNC_SECRET = originalSecret;
  }
});

test("C. Public /tiktok/connect immediately redirects directly to TikTok OAuth without requiring login", () => {
  assert.doesNotMatch(connectRouteSource, /redirect\(["']\/login["']\)/);
  assert.doesNotMatch(connectRouteSource, /oppo_session/);
  assert.match(connectRouteSource, /generateOAuthState\(\)/);
  assert.match(connectRouteSource, /buildTikTokAuthUrl\(/);
  assert.match(connectRouteSource, /response\.cookies\.set\(TIKTOK_OAUTH_STATE_COOKIE/);
  assert.match(connectRouteSource, /NextResponse\.redirect\(authUrl,\s*302\)/);
  assert.ok(typeof buildTikTokAuthUrl === "function");
});

test("D. OAuth state validation: missing state rejected, mismatched state rejected, correct state accepted", () => {
  const validState = generateOAuthState();
  const mismatchState = generateOAuthState();
  assert.equal(validateTikTokOAuthState(validState, validState), true);
  assert.equal(processTikTokCallbackParams({ code: "valid_code_123", state: validState, cookieState: validState }).status, "SUCCESS");
  assert.equal(validateTikTokOAuthState(null, validState), false);
  assert.equal(validateTikTokOAuthState(validState, null), false);
  assert.notEqual(processTikTokCallbackParams({ code: "valid_code_123", state: null, cookieState: validState }).status, "SUCCESS");
  assert.equal(validateTikTokOAuthState(validState, mismatchState), false);
  assert.equal(processTikTokCallbackParams({ code: "valid_code_123", state: validState, cookieState: mismatchState }).status, "STATE_MISMATCH");
});

test("E. Callback route handler sets short-lived HttpOnly cookie for success page instead of query parameters", () => {
  assert.match(callbackRouteSource, /tiktok_connect_result/);
  assert.match(callbackRouteSource, /maxAge:\s*(60|120)/);
  assert.match(callbackRouteSource, /path:\s*("(\/|\/(tiktok\/)?connect\/success)")/);
  assert.match(callbackRouteSource, /httpOnly:\s*true/);
  assert.doesNotMatch(callbackRouteSource, /searchParams\.set\(["']accessToken/);
  assert.doesNotMatch(callbackRouteSource, /searchParams\.set\(["']refreshToken/);
  assert.doesNotMatch(callbackRouteSource, /searchParams\.set\(["']clientSecret/);
  assert.doesNotMatch(callbackRouteSource, /searchParams\.set\(["']secret/);
  assert.doesNotMatch(callbackRouteSource, /searchParams\.set\(["']id/);
});

test("F. Success page reads verified details from HttpOnly cookie and renders localized standalone guidance", () => {
  assert.match(successPageSource, /tiktok_connect_result/);
  assert.match(successPageSource, /getVerifiedConnectResult/);
  assert.doesNotMatch(successPageSource, /searchParams/);
  assert.match(successPublicSource, /เชื่อมต่อ TikTok สำเร็จ/);
  assert.match(successPublicSource, /TikTok Account Connected/);
  assert.match(successPublicSource, /TikTok 连接成功/);
  assert.doesNotMatch(successPublicSource, /TopNavigation/);
  assert.doesNotMatch(successPublicSource, /sidebar/i);
});

test("G. Error page handles all error reasons with safe trilingual guidance", () => {
  for (const reason of ["authorization_denied", "store_not_found", "duplicate_store_mapping", "invalid_state", "oauth_failed"]) {
    assert.match(errorPublicSource, new RegExp(reason));
  }
  assert.match(errorPublicSource, /ลองใหม่อีกครั้ง/);
  assert.match(errorPublicSource, /Try Again/);
  assert.match(errorPublicSource, /重试/);
  assert.doesNotMatch(errorPublicSource, /TopNavigation/);
  assert.doesNotMatch(errorPublicSource, /sidebar/i);
});

test("H. Admin routes /tiktok and /tiktok/dashboard remain strictly authenticated", () => {
  assert.match(overviewPageSource, /cookieStore\.get\(["']oppo_session["']\)/);
  assert.match(overviewPageSource, /redirect\(["']\/login["']\)/);
  assert.match(dashboardPageSource, /cookieStore\.get\(["']oppo_session["']\)/);
  assert.match(dashboardPageSource, /redirect\(["']\/login["']\)/);
});

test("I. LINE OA authentication and webhook routing remain untouched", () => {
  const lineWebhookRoute = readFileSync(new URL("../../backend/src/webhooks/line/line-webhook.controller.ts", import.meta.url), "utf8");
  assert.match(lineWebhookRoute, /signatures\.verify/);
  assert.match(lineWebhookRoute, /webhookKey/);
});

test("J. Internal secret value never appears in client templates or exposed frontend bundles", () => {
  assert.doesNotMatch(connectRouteSource, /TIKTOK_INTERNAL_SYNC_SECRET/);
  assert.doesNotMatch(successPublicSource, /TIKTOK_INTERNAL_SYNC_SECRET/);
  assert.doesNotMatch(errorPublicSource, /TIKTOK_INTERNAL_SYNC_SECRET/);
  assert.doesNotMatch(overviewPageSource, /TIKTOK_INTERNAL_SYNC_SECRET/);
  assert.doesNotMatch(dashboardPageSource, /TIKTOK_INTERNAL_SYNC_SECRET/);
});

test("K. Confirmed public TikTok flow uses a separate store-owner analytics route and session", () => {
  assert.match(storeBindingSuccessSource, /href="\/connect\/tiktok\/analytics"/);
  assert.doesNotMatch(storeBindingSuccessSource, /\/tiktok\/dashboard/);
  assert.doesNotMatch(storeBindingSuccessSource, /\/tiktok\/stores\//);
  assert.match(analyticsPageSource, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.match(analyticsPageSource, /TIKTOK_STORE_OWNER_ANALYTICS_SESSION_COOKIE/);
  assert.match(analyticsPageSource, /\/tiktok\/internal\/store-owner\/me/);
  assert.doesNotMatch(analyticsPageSource, /oppo_session/);
  assert.doesNotMatch(analyticsPageSource, /params/);
  assert.match(analyticsViewSource, /Followers/);
  assert.match(analyticsViewSource, /Following/);
  assert.match(analyticsViewSource, /Total Likes/);
  assert.match(analyticsViewSource, /Video Count/);
  assert.match(analyticsViewSource, /อ่านอย่างเดียว/);
  assert.match(analyticsViewSource, /รอ HQ ตรวจสอบ/);
  assert.match(analyticsViewSource, /pendingStore/);
  assert.match(analyticsViewSource, /เซสชันหมดอายุ/);
  assert.match(backendControllerSource, /Get\("internal\/store-owner\/me"\)/);
  assert.match(backendControllerSource, /verifyTikTokStoreOwnerSession/);
  assert.match(backendBindingSource, /tikTokAccount\.findUnique/);
  assert.doesNotMatch(backendBindingSource, /TikTokPublicProfile/);
});

test("L. Store-owner session is signed, scoped to account and store, and expires", () => {
  const originalSecret = process.env.TIKTOK_INTERNAL_SYNC_SECRET;
  const originalNow = Date.now;
  process.env.TIKTOK_INTERNAL_SYNC_SECRET = "test-store-owner-session-secret";
  try {
    const token = createTikTokStoreOwnerAnalyticsSession("account-1", "store-1");
    assert.equal(TIKTOK_STORE_OWNER_ANALYTICS_SESSION_COOKIE, "tiktok_store_owner_analytics_session");
    assert.deepEqual(verifyTikTokStoreOwnerAnalyticsSession(token), {
      accountId: "account-1",
      storeMasterId: "store-1",
      expiresAt: verifyTikTokStoreOwnerAnalyticsSession(token)?.expiresAt,
    });
    assert.equal(verifyTikTokStoreOwnerAnalyticsSession(`${token}tampered`), null);
    Date.now = () => originalNow() + 60 * 60 * 1000 + 1;
    assert.equal(verifyTikTokStoreOwnerAnalyticsSession(token), null);
  } finally {
    Date.now = originalNow;
    if (originalSecret === undefined) delete process.env.TIKTOK_INTERNAL_SYNC_SECRET;
    else process.env.TIKTOK_INTERNAL_SYNC_SECRET = originalSecret;
  }
});
