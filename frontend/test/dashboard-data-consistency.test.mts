import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getSlaMultiplier } from "../src/components/shell/store-priority-score.ts";

const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const dashboardViewCode = readFileSync(new URL("../src/app/dashboard/dashboard-view.tsx", import.meta.url), "utf8");
const dashboardPageCode = readFileSync(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8");
const storePriorityTableCode = readFileSync(new URL("../src/app/dashboard/store-priority-table.tsx", import.meta.url), "utf8");

test("dashboard page route enforces force-dynamic rendering mode", () => {
  assert.match(dashboardPageCode, /export const dynamic = "force-dynamic";/);
  assert.match(dashboardPageCode, /export const revalidate = 0;/);
});

test("operational reset logic is wired to bmReplyStatusSummary", () => {
  assert.match(pageCode, /api\.bmReplyStatusSummary\(\)/);
});

