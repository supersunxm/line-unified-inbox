import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AUTH_UNAUTHORIZED_EVENT, routeAfterLogin, shouldRedirectToLogin } from "../src/lib/auth-session.ts";
import { resolveApiBaseUrl } from "../src/lib/runtime-config.ts";
import { GET } from "../src/app/api/health/route.ts";

const backendOrigin = "https://line-unified-inbox-production-544f.up.railway.app";

test("production uses the configured public API origin", () => {
  assert.equal(resolveApiBaseUrl(`${backendOrigin}/`, "production"), backendOrigin);
  assert.throws(() => resolveApiBaseUrl(undefined, "production"), /NEXT_PUBLIC_API_BASE_URL is required/);
  assert.throws(() => resolveApiBaseUrl("http://backend.example.com", "production"), /must use HTTPS/);
});

test("local development falls back to the local loopback API", () => {
  assert.equal(resolveApiBaseUrl(undefined, "development"), "http://127.0.0.1:3001");
});

test("401 authentication failures route protected pages to login", async () => {
  assert.equal(shouldRedirectToLogin(401, "/chats"), true);
  assert.equal(shouldRedirectToLogin(500, "/chats"), false);
  assert.equal(shouldRedirectToLogin(401, "/login"), false);

  const apiSource = await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8");
  const pageSource = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.equal(AUTH_UNAUTHORIZED_EVENT, "oppo-line-oa:unauthorized");
  assert.match(apiSource, /CustomEvent\(AUTH_UNAUTHORIZED_EVENT\)/);
  assert.match(pageSource, /window\.location\.replace\("\/login"\)/);
});

test("session restoration and logout rely on the secure server cookie", async () => {
  const apiSource = await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8");
  const pageSource = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(apiSource, /credentials: "include"/);
  assert.match(pageSource, /setAuthUser\(await api\.me\(\)\)/);
  assert.match(pageSource, /await api\.logout\(\)/);
  assert.match(pageSource, /setAuthUser\(null\)/);
  assert.equal(routeAfterLogin("/login"), "/dashboard");
  assert.equal(routeAfterLogin("/chats"), null);
  assert.doesNotMatch(pageSource, /localStorage\.(?:setItem|getItem)\([^\n]*(?:password|token|session)/i);
});

test("500 and network failures render through controlled error states", async () => {
  const pageSource = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(pageSource, /setApiError\(error instanceof Error \? error\.message/);
  assert.match(pageSource, /role="alert"/);
  assert.match(pageSource, /setSetupStatusError\(error instanceof Error \? error\.message/);
});

test("frontend health route returns safe success JSON", async () => {
  const response = GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", service: "frontend" });
});

test("Railway production config contains no localhost URL and uses portable commands", async () => {
  const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as { scripts: Record<string, string> };
  assert.doesNotMatch(envExample, /localhost|127\.0\.0\.1/);
  assert.match(envExample, /^NEXT_PUBLIC_API_BASE_URL=$/m);
  assert.match(envExample, /^NEXT_PUBLIC_APP_ENV=production$/m);
  assert.equal(packageJson.scripts.build, "next build");
  assert.equal(packageJson.scripts.start, "next start -H 0.0.0.0 -p ${PORT:-3000}");
});
