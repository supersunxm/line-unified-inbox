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

const pageSource = readFileSync(new URL("../src/app/tiktok/connect/page.tsx", import.meta.url), "utf8");
const formSource = readFileSync(new URL("../src/app/tiktok/connect/connect-form.tsx", import.meta.url), "utf8");
const actionSource = readFileSync(new URL("../src/app/tiktok/connect/actions.ts", import.meta.url), "utf8");
const oauthSource = readFileSync(new URL("../src/app/tiktok/connect/tiktok-oauth.ts", import.meta.url), "utf8");
const topNavSource = readFileSync(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");

test("TikTok connect route files exist", () => {
  assert.ok(existsSync(new URL("../src/app/tiktok/connect/page.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/connect/connect-form.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/connect/actions.ts", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/connect/tiktok-oauth.ts", import.meta.url)));
});

test("TikTok connect page has appropriate metadata and noindex robots directive", () => {
  assert.match(pageSource, /title:\s*"Connect TikTok Account \| OPPO Retail TikTok Monitor"/);
  assert.match(pageSource, /robots:\s*\{[^}]*index:\s*false[^}]*follow:\s*false[^}]*\}/s);
  assert.match(pageSource, /<h1[^>]*>\s*Connect TikTok Account\s*<\/h1>/);
});

test("TikTok OAuth requests all 4 required read-only scopes", () => {
  const expectedScopes = ["user.info.basic", "user.info.profile", "user.info.stats", "video.list"];
  assert.deepEqual(Array.from(TIKTOK_OAUTH_SCOPES), expectedScopes);
  assert.match(oauthSource, /user\.info\.basic/);
  assert.match(oauthSource, /user\.info\.profile/);
  assert.match(oauthSource, /user\.info\.stats/);
  assert.match(oauthSource, /video\.list/);
});

test("buildTikTokAuthUrl constructs valid TikTok authorization URL with all required query parameters", () => {
  const state = "test-state-123456";
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
  assert.equal(url.searchParams.get("state"), "test-state-123456");
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

test("Cookie configuration for OAuth state is secure and HttpOnly", () => {
  assert.equal(TIKTOK_OAUTH_STATE_COOKIE, "tiktok_oauth_state");
  assert.equal(TIKTOK_STATE_COOKIE_OPTIONS.httpOnly, true);
  assert.equal(TIKTOK_STATE_COOKIE_OPTIONS.sameSite, "lax");
  assert.equal(TIKTOK_STATE_COOKIE_OPTIONS.path, "/");
  assert.equal(TIKTOK_STATE_COOKIE_OPTIONS.maxAge, 600);
});

test("UI emphasizes read-only monitoring and clearly states no video publishing permissions requested", () => {
  assert.match(pageSource, /read-only/i);
  assert.match(pageSource, /does not request permission to publish/i);
  assert.match(formSource, /Connect TikTok/);
});

test("Security: Client Secret is strictly server-side and never exposed to frontend code", () => {
  assert.doesNotMatch(pageSource, /TIKTOK_CLIENT_SECRET/);
  assert.doesNotMatch(formSource, /TIKTOK_CLIENT_SECRET/);
  assert.doesNotMatch(oauthSource, /TIKTOK_CLIENT_SECRET/);
});

test("TikTok Connect route is NOT linked from existing TopNavigation", () => {
  assert.doesNotMatch(topNavSource, /href="\/tiktok\/connect"/);
  assert.doesNotMatch(topNavSource, /TikTok/);
});
