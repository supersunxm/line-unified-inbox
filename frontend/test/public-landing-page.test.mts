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
const landingSource = source("../src/app/public-landing-page.tsx");
const loginSource = source("../src/app/login/page.tsx");
const authorizedWorkspaceSource = source("../src/app/authorized-workspace.tsx");
const dashboardSource = source("../src/app/dashboard/page.tsx");
const mainOaSource = source("../src/app/main-oa/page.tsx");
const tiktokSource = source("../src/app/tiktok/page.tsx");
const tiktokConnectSource = source("../src/app/tiktok/connect/route.ts");
const privacySource = source("../src/app/privacy/page.tsx");
const termsSource = source("../src/app/terms/page.tsx");

test("public root renders customer-facing PublicLandingPage without an auth redirect or admin shell", () => {
  assert.match(homeSource, /PublicLandingPage/);
  assert.match(landingSource, /OPPO Brand Shop/);
  assert.match(landingSource, /ค้นหา OPPO Brand Shop ใกล้คุณ/);
  assert.match(landingSource, /ค้นหาสาขา ช่องทางติดต่อ LINE OA, TikTok/);
  assert.doesNotMatch(homeSource, /window\.location|redirect\(|api\.me|oppo_session|ApplicationWorkspace|AppShell/);
  assert.doesNotMatch(landingSource, /window\.location|redirect\(|api\.me|oppo_session|ApplicationWorkspace|AppShell/);
});

test("public landing calls to action, search, and policy links use canonical routes", () => {
  assert.match(landingSource, /\/stores\?q=/);
  assert.match(landingSource, /href="\/stores"/);
  assert.match(landingSource, /href="\/login"[\s\S]*เข้าสู่ระบบสำหรับพนักงาน/);
  assert.match(landingSource, /href="\/privacy"[\s\S]*Privacy Policy/);
  assert.match(landingSource, /href="\/terms"[\s\S]*Terms/);
  assert.match(landingSource, /ค้นหาสาขาใกล้คุณ/);
  assert.match(landingSource, /ติดต่อร้านผ่าน LINE/);
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
