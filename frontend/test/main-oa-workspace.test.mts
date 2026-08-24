import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Main OA workspace uses dedicated backend endpoints and does not use store filtering", async () => {
  const page = await readFile(new URL("../src/app/main-oa/page.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8");
  assert.match(page, /Main OA/);
  assert.match(page, /Switch to Branch Stores/);
  assert.match(api, /\/main-oa\/conversations/);
  assert.doesNotMatch(page, /accountType\s*===\s*["']HEAD_OFFICE/);
});

test("Main OA is integrated into the current sidebar shell and remains permission-gated", async () => {
  const page = await readFile(new URL("../src/app/main-oa/page.tsx", import.meta.url), "utf8");
  const sidebar = await readFile(new URL("../src/components/shell/app-sidebar.tsx", import.meta.url), "utf8");
  const topNavigation = await readFile(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");
  assert.match(page, /<AppShell/);
  assert.match(page, /currentSection="main-oa"/);
  assert.match(page, /permissions\?\.canAccessMainOa/);
  assert.match(sidebar, /href: "\/main-oa"/);
  assert.match(sidebar, /mainOaOnly/);
  assert.match(sidebar, /canAccessMainOa/);
  assert.match(topNavigation, /<AppSidebar/);
  assert.doesNotMatch(topNavigation, /app-primary-nav/);
});
