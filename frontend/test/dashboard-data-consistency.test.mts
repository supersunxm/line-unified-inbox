import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const dashboardPageCode = readFileSync(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8");

test("dashboard page route dispatches responsive views on the client", () => {
  assert.match(dashboardPageCode, /^"use client";/);
  assert.match(dashboardPageCode, /window\.matchMedia\("\(max-width: 767px\)"\)/);
  assert.match(dashboardPageCode, /<MobileDashboardApp \/>/);
  assert.match(dashboardPageCode, /<AuthorizedWorkspace section="dashboard" \/>/);
});

test("operational reset logic is wired to bmReplyStatusSummary", () => {
  assert.match(pageCode, /api\.bmReplyStatusSummary\(\)/);
});
