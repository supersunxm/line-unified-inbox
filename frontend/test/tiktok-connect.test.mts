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
} from "../src/app/tiktok/connect/tiktok-oauth.ts";

const connectRouteSource = readFileSync(new URL("../src/app/tiktok/connect/route.ts", import.meta.url), "utf8");
const successPageSource = readFileSync(new URL("../src/app/tiktok/connect/success/page.tsx", import.meta.url), "utf8");
const errorPageSource = readFileSync(new URL("../src/app/tiktok/connect/error/page.tsx", import.meta.url), "utf8");
const oauthSource = readFileSync(new URL("../src/app/tiktok/connect/tiktok-oauth.ts", import.meta.url), "utf8");
const topNavSource = readFileSync(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");

test("Public TikTok store authorization route files exist", () => {
  assert.ok(existsSync(new URL("../src/app/tiktok/connect/route.ts", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/connect/success/page.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/connect/error/page.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/connect/tiktok-oauth.ts", import.meta.url)));
});

test("Public success and error pages have appropriate metadata and noindex robots directive", () => {
  assert.match(successPageSource, /title:\s*"TikTok Connected Successfully \| OPPO Retail Operations"/);
  assert.match(successPageSource, /robots:\s*\{[^}]*index:\s*false[^}]*follow:\s*false[^}]*\}/s);
  assert.match(errorPageSource, /title:\s*"Unable to Connect TikTok \| OPPO Retail Operations"/);
  assert.match(errorPageSource, /robots:\s*\{[^}]*index:\s*false[^}]*follow:\s*false[^}]*\}/s);
});

test("TikTok OAuth requests all 4 required read-only scopes", () => {
  const expectedScopes = ["user.info.basic", "user.info.profile", "user.info.stats", "video.list"];
  assert.deepEqual(Array.from(TIKTOK_OAUTH_SCOPES), expectedScopes);
  assert.match(oauthSource, /user\.info\.basic/);
  assert.match(oauthSource, /user\.info\.profile/);
  assert.match(oauthSource, /user\.info\.stats/);
  assert.match(oauthSource, /video\.list/);
});

test("buildTikTokAuthUrl constructs valid TikTok authorization URL with exact matching state", () => {
  const state = generateOAuthState();
  const clientKey = "test_client_key_abc";
  const urlString = buildTikTokAuthUrl({
    clientKey,
    state,
    redirectUri: "https://lineoppo.click/tiktok/callback",
  });

  const url = new URL(urlString);
  assert.equal(url.origin + url.pathname, TIKTOK_AUTH_BASE_URL);
  assert.equal(url.searchParams.get("client_key"), "test_client_key_abc");
  assert.equal(url.searchParams.get("scope"), "user.info.basic,user.info.profile,user.info.stats,video.list");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("redirect_uri"), "https://lineoppo.click/tiktok/callback");
  assert.equal(url.searchParams.get("state"), state);
});

test("buildTikTokAuthUrl falls back to default redirect URI when none provided", () => {
  const urlString = buildTikTokAuthUrl({
    clientKey: "my_key",
    state: "state_xyz",
  });
  const url = new URL(urlString);
  assert.equal(url.searchParams.get("redirect_uri"), DEFAULT_TIKTOK_REDIRECT_URI);
  assert.equal(DEFAULT_TIKTOK_REDIRECT_URI, "https://lineoppo.click/tiktok/callback");
});

test("buildTikTokAuthUrl throws safely when clientKey is missing", () => {
  assert.throws(() => {
    buildTikTokAuthUrl({ clientKey: "", state: "state_123" });
  }, /Missing required TikTok Client Key/);
});

test("generateOAuthState generates cryptographically secure unique values", () => {
  const state1 = generateOAuthState();
  const state2 = generateOAuthState();
  assert.equal(state1.length, 64); // 32 bytes hex = 64 characters
  assert.notEqual(state1, state2);
});

test("Cookie configuration for OAuth state is secure, HttpOnly, and accessible to callback", () => {
  assert.equal(TIKTOK_OAUTH_STATE_COOKIE, "tiktok_oauth_state");
  assert.equal(TIKTOK_STATE_COOKIE_OPTIONS.httpOnly, true);
  assert.equal(TIKTOK_STATE_COOKIE_OPTIONS.sameSite, "lax");
  assert.equal(TIKTOK_STATE_COOKIE_OPTIONS.path, "/"); // Path / ensures cookie is sent to /tiktok/callback
  assert.equal(TIKTOK_STATE_COOKIE_OPTIONS.maxAge, 600); // 10 minutes
});

test("Public /tiktok/connect route handler sets cookie on 302 redirect response directly to TikTok", () => {
  assert.match(connectRouteSource, /response\.cookies\.set\(TIKTOK_OAUTH_STATE_COOKIE/);
  assert.match(connectRouteSource, /NextResponse\.redirect\(authUrl,\s*302\)/);
  assert.doesNotMatch(connectRouteSource, /redirect\(["']\/login["']\)/);
});

test("Public success page renders standalone layout with Thai and English confirmation", () => {
  assert.match(successPageSource, /เชื่อมต่อ TikTok สำเร็จ/);
  assert.match(successPageSource, /TikTok Account Connected/);
  assert.match(successPageSource, /คุณสามารถปิดหน้านี้ได้/);
  assert.doesNotMatch(successPageSource, /TopNavigation/);
  assert.doesNotMatch(successPageSource, /sidebar/i);
});

test("Public error page handles authorization denied, invalid state, store not found, and duplicate mapping", () => {
  assert.match(errorPageSource, /authorization_denied/);
  assert.match(errorPageSource, /store_not_found/);
  assert.match(errorPageSource, /duplicate_store_mapping/);
  assert.match(errorPageSource, /invalid_state/);
  assert.match(errorPageSource, /ลองใหม่อีกครั้ง/);
  assert.doesNotMatch(errorPageSource, /TopNavigation/);
});

test("Security: Client Secret is strictly server-side and never exposed to frontend code", () => {
  assert.doesNotMatch(connectRouteSource, /TIKTOK_CLIENT_SECRET/);
  assert.doesNotMatch(successPageSource, /TIKTOK_CLIENT_SECRET/);
  assert.doesNotMatch(errorPageSource, /TIKTOK_CLIENT_SECRET/);
  assert.doesNotMatch(oauthSource, /TIKTOK_CLIENT_SECRET/);
});

test("Public store authorization routes are NOT linked from existing TopNavigation", () => {
  assert.doesNotMatch(topNavSource, /href="\/tiktok\/connect"/);
  assert.doesNotMatch(topNavSource, /href="\/tiktok\/callback"/);
  assert.doesNotMatch(topNavSource, /TikTok/);
});
