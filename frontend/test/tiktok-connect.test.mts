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

const publicConnectPageSource = readFileSync(new URL("../src/app/connect/tiktok/page.tsx", import.meta.url), "utf8");
const publicSuccessPageSource = readFileSync(new URL("../src/app/connect/tiktok/success/page.tsx", import.meta.url), "utf8");
const connectRouteSource = readFileSync(new URL("../src/app/tiktok/connect/route.ts", import.meta.url), "utf8");
const successPageSource = readFileSync(new URL("../src/app/tiktok/connect/success/page.tsx", import.meta.url), "utf8");
const successContentSource = readFileSync(new URL("../src/app/tiktok/connect/success/success-content.tsx", import.meta.url), "utf8");
const errorPageSource = readFileSync(new URL("../src/app/tiktok/connect/error/page.tsx", import.meta.url), "utf8");
const errorContentSource = readFileSync(new URL("../src/app/tiktok/connect/error/error-content.tsx", import.meta.url), "utf8");
const oauthSource = readFileSync(new URL("../src/app/tiktok/connect/tiktok-oauth.ts", import.meta.url), "utf8");
const topNavSource = readFileSync(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");
const successPublicSource = `${successPageSource}\n${successContentSource}`;
const errorPublicSource = `${errorPageSource}\n${errorContentSource}`;

test("Public TikTok store authorization route files exist", () => {
  assert.ok(existsSync(new URL("../src/app/connect/tiktok/page.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/connect/tiktok/success/page.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/connect/route.ts", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/connect/success/page.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/connect/success/success-content.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/connect/error/page.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/connect/error/error-content.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/connect/tiktok-oauth.ts", import.meta.url)));
});

test("Public /connect/tiktok page renders genuine customer/store owner explanation with Thai copy and config guard", () => {
  assert.match(publicConnectPageSource, /เชื่อมต่อ TikTok กับ OPPO Brand Shop/);
  assert.match(publicConnectPageSource, /ผู้ติดตาม/);
  assert.match(publicConnectPageSource, /กำลังติดตาม/);
  assert.match(publicConnectPageSource, /ยอดถูกใจทั้งหมด/);
  assert.match(publicConnectPageSource, /จำนวนวิดีโอ/);
  assert.match(publicConnectPageSource, /จะไม่โพสต์ แก้ไข หรือลบคอนเทนต์/);
  assert.match(publicConnectPageSource, /ไม่มีการเข้าถึงข้อความส่วนตัว/);
  assert.match(publicConnectPageSource, /ยกเลิกการเชื่อมต่อหรือเพิกถอนสิทธิ์ได้ตลอดเวลา/);
  assert.match(publicConnectPageSource, /เชื่อมต่อกับ TikTok/);
  assert.match(publicConnectPageSource, /รอการกำหนดค่าการเชื่อมต่อ \(TikTok Sandbox Configuration Required\)/);
});

test("Public success and error pages have appropriate metadata and noindex robots directive", () => {
  assert.match(successPageSource, /title:\s*"TikTok Connected Successfully \| OPPO Retail Operations"/);
  assert.match(successPageSource, /robots:\s*\{[^}]*index:\s*false[^}]*follow:\s*false[^}]*\}/s);
  assert.match(publicSuccessPageSource, /title:\s*"TikTok Connected Successfully \| OPPO Brand Shop"/);
  assert.match(publicSuccessPageSource, /robots:\s*\{[^}]*index:\s*false[^}]*follow:\s*false[^}]*\}/s);
  assert.match(errorPageSource, /title:\s*"Unable to Connect TikTok \| OPPO Retail Operations"/);
  assert.match(errorPageSource, /robots:\s*\{[^}]*index:\s*false[^}]*follow:\s*false[^}]*\}/s);
});

test("TikTok OAuth requests strictly the 3 minimum read-only scopes (video.list is omitted)", () => {
  const expectedScopes = ["user.info.basic", "user.info.profile", "user.info.stats"];
  assert.deepEqual(Array.from(TIKTOK_OAUTH_SCOPES), expectedScopes);
  assert.match(oauthSource, /user\.info\.basic/);
  assert.match(oauthSource, /user\.info\.profile/);
  assert.match(oauthSource, /user\.info\.stats/);
  assert.doesNotMatch(oauthSource, /video\.list/);
});

test("buildTikTokAuthUrl constructs valid TikTok authorization URL with exact matching state and minimal scopes", () => {
  const state = generateOAuthState();
  const clientKey = "test_client_key_abc";
  const urlString = buildTikTokAuthUrl({ clientKey, state, redirectUri: "https://lineoppo.click/tiktok/callback" });
  const url = new URL(urlString);
  assert.equal(url.origin + url.pathname, TIKTOK_AUTH_BASE_URL);
  assert.equal(url.searchParams.get("client_key"), "test_client_key_abc");
  assert.equal(url.searchParams.get("scope"), "user.info.basic,user.info.profile,user.info.stats");
  assert.doesNotMatch(url.searchParams.get("scope") || "", /video\.list/);
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("redirect_uri"), "https://lineoppo.click/tiktok/callback");
  assert.equal(url.searchParams.get("state"), state);
});

test("buildTikTokAuthUrl falls back to default redirect URI when none provided", () => {
  const urlString = buildTikTokAuthUrl({ clientKey: "my_key", state: "state_xyz" });
  const url = new URL(urlString);
  assert.equal(url.searchParams.get("redirect_uri"), DEFAULT_TIKTOK_REDIRECT_URI);
  assert.equal(DEFAULT_TIKTOK_REDIRECT_URI, "https://lineoppo.click/tiktok/callback");
});

test("buildTikTokAuthUrl throws safely when clientKey is missing", () => {
  assert.throws(() => buildTikTokAuthUrl({ clientKey: "", state: "state_123" }), /Missing required TikTok Client Key/);
});

test("generateOAuthState generates cryptographically secure unique values", () => {
  const state1 = generateOAuthState();
  const state2 = generateOAuthState();
  assert.equal(state1.length, 64);
  assert.notEqual(state1, state2);
});

test("Cookie configuration for OAuth state is secure, HttpOnly, and accessible to callback", () => {
  assert.equal(TIKTOK_OAUTH_STATE_COOKIE, "tiktok_oauth_state");
  assert.equal(TIKTOK_STATE_COOKIE_OPTIONS.httpOnly, true);
  assert.equal(TIKTOK_STATE_COOKIE_OPTIONS.sameSite, "lax");
  assert.equal(TIKTOK_STATE_COOKIE_OPTIONS.path, "/");
  assert.equal(TIKTOK_STATE_COOKIE_OPTIONS.maxAge, 600);
});

test("Public /tiktok/connect route handler sets cookie on 302 redirect response directly to TikTok", () => {
  assert.match(connectRouteSource, /response\.cookies\.set\(TIKTOK_OAUTH_STATE_COOKIE/);
  assert.match(connectRouteSource, /NextResponse\.redirect\(authUrl,\s*302\)/);
  assert.doesNotMatch(connectRouteSource, /redirect\(["']\/login["']\)/);
});

test("Public success page renders connected profile, statistics grid, and read-only reassurance", () => {
  assert.match(successPublicSource, /TikTok เชื่อมต่อสำเร็จ/);
  assert.match(successPublicSource, /TikTok Account Connected/);
  assert.match(successPublicSource, /TikTok 连接成功/);
  assert.match(successPublicSource, /ข้อมูลนี้ได้รับอนุญาตจากบัญชี TikTok ที่เชื่อมต่อ/);
  assert.match(successPublicSource, /การเชื่อมต่อนี้เป็นแบบอ่านอย่างเดียว \(Read-only\)/);
  assert.match(successPublicSource, /ผู้ติดตาม/);
  assert.match(successPublicSource, /กำลังติดตาม/);
  assert.match(successPublicSource, /ยอดถูกใจทั้งหมด/);
  assert.match(successPublicSource, /วิดีโอ/);
  assert.match(successPublicSource, /ดูข้อมูลร้าน/);
  assert.match(successPublicSource, /การยกเลิกการเชื่อมต่อ/);
  assert.doesNotMatch(successPublicSource, /TopNavigation/);
  assert.doesNotMatch(successPublicSource, /sidebar/i);
});

test("Public error page handles authorization denied, invalid state, store not found, and duplicate mapping", () => {
  assert.match(errorPublicSource, /authorization_denied/);
  assert.match(errorPublicSource, /store_not_found/);
  assert.match(errorPublicSource, /duplicate_store_mapping/);
  assert.match(errorPublicSource, /invalid_state/);
  assert.match(errorPublicSource, /ลองใหม่อีกครั้ง/);
  assert.match(errorPublicSource, /Try Again/);
  assert.match(errorPublicSource, /重试/);
  assert.doesNotMatch(errorPublicSource, /TopNavigation/);
});

test("Security: Client Secret and tokens are strictly server-side and never exposed to frontend code", () => {
  assert.doesNotMatch(publicConnectPageSource, /TIKTOK_CLIENT_SECRET/);
  assert.doesNotMatch(connectRouteSource, /TIKTOK_CLIENT_SECRET/);
  assert.doesNotMatch(successPublicSource, /TIKTOK_CLIENT_SECRET/);
  assert.doesNotMatch(errorPublicSource, /TIKTOK_CLIENT_SECRET/);
  assert.doesNotMatch(oauthSource, /TIKTOK_CLIENT_SECRET/);
  assert.doesNotMatch(successPublicSource, /access_token/);
  assert.doesNotMatch(successPublicSource, /refresh_token/);
  assert.doesNotMatch(successPublicSource, /open_id/);
});

test("Public store authorization routes are NOT linked from existing TopNavigation", () => {
  assert.doesNotMatch(topNavSource, /href="\/tiktok\/connect"/);
  assert.doesNotMatch(topNavSource, /href="\/tiktok\/callback"/);
});
