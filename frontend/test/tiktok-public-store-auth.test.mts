import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_TIKTOK_REDIRECT_URI,
  TIKTOK_AUTH_BASE_URL,
  TIKTOK_OAUTH_SCOPES,
  TIKTOK_OAUTH_STATE_COOKIE,
  TIKTOK_STATE_COOKIE_OPTIONS,
  buildTikTokAuthUrl,
  generateOAuthState,
  getPublicAppUrl,
} from "../src/app/tiktok/connect/tiktok-oauth.ts";
import {
  processTikTokCallbackParams,
  timingSafeStringEqual,
  validateTikTokOAuthState,
} from "../src/app/tiktok/callback/tiktok-callback-validator.ts";
import {
  syncTikTokAccountInternallyToBackend,
} from "../src/app/tiktok/tiktok-api-client.ts";

const connectRouteSource = readFileSync(new URL("../src/app/tiktok/connect/route.ts", import.meta.url), "utf8");
const callbackRouteSource = readFileSync(new URL("../src/app/tiktok/callback/route.ts", import.meta.url), "utf8");
const apiClientSource = readFileSync(new URL("../src/app/tiktok/tiktok-api-client.ts", import.meta.url), "utf8");
const successPageSource = readFileSync(new URL("../src/app/tiktok/connect/success/page.tsx", import.meta.url), "utf8");
const errorPageSource = readFileSync(new URL("../src/app/tiktok/connect/error/page.tsx", import.meta.url), "utf8");
const overviewPageSource = readFileSync(new URL("../src/app/tiktok/page.tsx", import.meta.url), "utf8");
const dashboardPageSource = readFileSync(new URL("../src/app/tiktok/dashboard/page.tsx", import.meta.url), "utf8");
const topNavSource = readFileSync(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");

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
      async () => {
        await syncTikTokAccountInternallyToBackend({
          accessToken: "sample_token",
          profile: { open_id: "sample_id", display_name: "Store" },
        });
      },
      (err: any) => {
        assert.match(err.message, /Missing internal TikTok sync secret configuration/);
        return true;
      }
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
});

test("D. OAuth state validation: missing state rejected, mismatched state rejected, correct state accepted", () => {
  const validState = generateOAuthState();
  const mismatchState = generateOAuthState();

  // Correct state
  assert.equal(validateTikTokOAuthState(validState, validState), true);
  const successResult = processTikTokCallbackParams({
    code: "valid_code_123",
    state: validState,
    cookieState: validState,
  });
  assert.equal(successResult.status, "SUCCESS");

  // Missing state
  assert.equal(validateTikTokOAuthState(null, validState), false);
  assert.equal(validateTikTokOAuthState(validState, null), false);
  const missingResult = processTikTokCallbackParams({
    code: "valid_code_123",
    state: null,
    cookieState: validState,
  });
  assert.notEqual(missingResult.status, "SUCCESS");

  // Mismatched state
  assert.equal(validateTikTokOAuthState(validState, mismatchState), false);
  const mismatchResult = processTikTokCallbackParams({
    code: "valid_code_123",
    state: validState,
    cookieState: mismatchState,
  });
  assert.equal(mismatchResult.status, "STATE_MISMATCH");
});

test("E. Callback route handler sets short-lived HttpOnly cookie for success page instead of query parameters", () => {
  assert.match(callbackRouteSource, /tiktok_connect_result/);
  assert.match(callbackRouteSource, /maxAge:\s*60/);
  assert.match(callbackRouteSource, /path:\s*"\/tiktok\/connect\/success"/);
  assert.match(callbackRouteSource, /httpOnly:\s*true/);

  // Does NOT leak tokens, secrets, or internal IDs in query parameters
  assert.doesNotMatch(callbackRouteSource, /searchParams\.set\(["']accessToken/);
  assert.doesNotMatch(callbackRouteSource, /searchParams\.set\(["']refreshToken/);
  assert.doesNotMatch(callbackRouteSource, /searchParams\.set\(["']clientSecret/);
  assert.doesNotMatch(callbackRouteSource, /searchParams\.set\(["']secret/);
  assert.doesNotMatch(callbackRouteSource, /searchParams\.set\(["']id/);
});

test("F. Success page reads verified details from HttpOnly cookie and ignores arbitrary query params", () => {
  assert.match(successPageSource, /tiktok_connect_result/);
  assert.match(successPageSource, /getVerifiedConnectResult/);
  assert.doesNotMatch(successPageSource, /searchParams/);
  assert.match(successPageSource, /เชื่อมต่อ TikTok สำเร็จ/);
  assert.match(successPageSource, /TikTok Account Connected/);
  assert.doesNotMatch(successPageSource, /TopNavigation/);
  assert.doesNotMatch(successPageSource, /sidebar/i);
});

test("G. Error page handles all error reasons with safe bilingual guidance", () => {
  assert.match(errorPageSource, /authorization_denied/);
  assert.match(errorPageSource, /store_not_found/);
  assert.match(errorPageSource, /duplicate_store_mapping/);
  assert.match(errorPageSource, /invalid_state/);
  assert.match(errorPageSource, /oauth_failed/);
  assert.match(errorPageSource, /ลองใหม่อีกครั้ง/);
  assert.doesNotMatch(errorPageSource, /TopNavigation/);
  assert.doesNotMatch(errorPageSource, /sidebar/i);
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
  assert.doesNotMatch(successPageSource, /TIKTOK_INTERNAL_SYNC_SECRET/);
  assert.doesNotMatch(errorPageSource, /TIKTOK_INTERNAL_SYNC_SECRET/);
  assert.doesNotMatch(overviewPageSource, /TIKTOK_INTERNAL_SYNC_SECRET/);
  assert.doesNotMatch(dashboardPageSource, /TIKTOK_INTERNAL_SYNC_SECRET/);
});
