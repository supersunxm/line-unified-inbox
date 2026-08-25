import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const pageSource = source("../src/app/page.tsx");
const homeSource = pageSource.slice(
  pageSource.indexOf("export default function Home"),
  pageSource.indexOf("export function ApplicationWorkspace"),
);
const loginSource = source("../src/app/login/page.tsx");
const authorizedWorkspaceSource = source("../src/app/authorized-workspace.tsx");
const dashboardSource = source("../src/app/dashboard/page.tsx");
const mainOaSource = source("../src/app/main-oa/page.tsx");
const tiktokSource = source("../src/app/tiktok/page.tsx");
const tiktokConnectSource = source("../src/app/tiktok/connect/route.ts");
const privacySource = source("../src/app/privacy/page.tsx");
const termsSource = source("../src/app/terms/page.tsx");

test("public root renders OPPO Retail Insights without an auth redirect or admin shell", () => {
  assert.match(homeSource, /OPPO Retail Insights/);
  assert.match(homeSource, /Understand your social content performance\./);
  assert.match(homeSource, /Connect your social account to view profile insights, audience statistics, and public content performance\./);
  assert.doesNotMatch(homeSource, /window\.location|redirect\(|api\.me|oppo_session|ApplicationWorkspace|AppShell/);
});

test("public landing calls to action and policy links use canonical routes", () => {
  assert.match(homeSource, /href="\/tiktok\/connect"[\s\S]*Connect Account/);
  assert.match(homeSource, /href="\/login"[\s\S]*Administrator Sign in/);
  assert.match(homeSource, /href="\/privacy"[\s\S]*Privacy Policy/);
  assert.match(homeSource, /href="\/terms"[\s\S]*Terms of Service/);
  assert.match(homeSource, /Connect your account/);
  assert.match(homeSource, /Authorize access/);
  assert.match(homeSource, /View your insights/);
});

test("administrator login remains available at /login", () => {
  assert.match(loginSource, /OPPO LINE OA Monitor/);
  assert.match(loginSource, /Sign in to your authorized workspace/);
  assert.match(loginSource, /api\.login\(identifier, password\)/);
});

test("admin workspaces retain their unauthenticated /login boundary", () => {
  assert.match(dashboardSource, /AuthorizedWorkspace section="dashboard"/);
  assert.match(authorizedWorkspaceSource, /reason instanceof ApiError && reason\.status === 401/);
  assert.match(authorizedWorkspaceSource, /window\.location\.replace\("\/login"\)/);
  assert.match(mainOaSource, /router\.replace\("\/login"\)/);
  assert.match(tiktokSource, /if \(!sessionToken\)[\s\S]*redirect\("\/login"\)/);
});

test("TikTok authorization entry and policy pages remain public", () => {
  assert.doesNotMatch(tiktokConnectSource, /redirect\("\/login"\)|oppo_session/);
  assert.doesNotMatch(privacySource, /redirect\("\/login"\)|oppo_session|api\.me/);
  assert.doesNotMatch(termsSource, /redirect\("\/login"\)|oppo_session|api\.me/);
});
