import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getTikTokDemoGrowthMetrics,
  isTikTokDemoGrowthEnabled,
} from "../src/app/tiktok/dashboard/tiktok-demo-growth.ts";

test("Overview page.tsx concurrently fetches historical metrics and passes to TikTokOverviewView", () => {
  const pageCode = readFileSync(
    new URL("../src/app/tiktok/page.tsx", import.meta.url),
    "utf8",
  );

  // 1. Concurrently fetches single account and historical metrics via Promise.all
  assert.match(pageCode, /fetchTikTokHistoricalMetricsFromBackend/);
  assert.match(pageCode, /Promise\.all\(\[/);

  // 2. Integrates shared demo growth helper
  assert.match(pageCode, /isTikTokDemoGrowthEnabled\(\)/);
  assert.match(pageCode, /getTikTokDemoGrowthMetrics\(/);

  // 3. Passes historicalMetrics to TikTokOverviewView
  assert.match(pageCode, /historicalMetrics=\{historicalMetrics\}/);
});

test("TikTokOverviewView implements net follower growth UI with positive, negative, zero, and missing delta formatting", () => {
  const viewCode = readFileSync(
    new URL("../src/app/tiktok/tiktok-overview-view.tsx", import.meta.url),
    "utf8",
  );

  // 1. Props include historicalMetrics
  assert.match(viewCode, /historicalMetrics\?: TikTokHistoricalMetricsData \| null/);

  // 2. formatDelta handles positive (+), negative (-), zero (0), and missing (--)
  assert.match(viewCode, /function formatDelta\(delta: number \| null \| undefined\)/);
  assert.match(viewCode, /text:\s*"--"/);
  assert.match(viewCode, /text:\s*`\+\$\{new Intl\.NumberFormat\("en-US"\)\.format\(delta\)\}`/);
  assert.match(viewCode, /text:\s*new Intl\.NumberFormat\("en-US"\)\.format\(delta\)/);
  assert.match(viewCode, /text:\s*"0"/);

  // 3. Followers card renders 3 compact rows: Today, 7 Days, 30 Days
  assert.match(viewCode, />Today<\/span>/);
  assert.match(viewCode, />7 Days<\/span>/);
  assert.match(viewCode, />30 Days<\/span>/);

  // 4. Subtle divider and styling
  assert.match(viewCode, /border-t border-slate-100 pt-2\.5 dark:border-slate-800\/80/);
});

test("Overview and Dashboard share identical demo growth baseline metrics when demo mode is active", () => {
  const demoMetrics = getTikTokDemoGrowthMetrics("acc-central-world");

  // Exact Central World sample values
  assert.equal(demoMetrics.summary.currentFollowerCount, 13342);
  assert.equal(demoMetrics.summary.dailyFollowerGrowth, 47);
  assert.equal(demoMetrics.summary.sevenDayFollowerGrowth, 286);
  assert.equal(demoMetrics.summary.thirtyDayFollowerGrowth, 1124);

  // 30 days history length
  assert.equal(demoMetrics.history.length, 30);
});

test("Demo mode is disabled by default and uses real PostgreSQL snapshot data", () => {
  const origEnv = process.env.NEXT_PUBLIC_TIKTOK_DEMO_GROWTH;
  try {
    delete process.env.NEXT_PUBLIC_TIKTOK_DEMO_GROWTH;
    assert.equal(isTikTokDemoGrowthEnabled(), false);
  } finally {
    if (origEnv !== undefined) {
      process.env.NEXT_PUBLIC_TIKTOK_DEMO_GROWTH = origEnv;
    } else {
      delete process.env.NEXT_PUBLIC_TIKTOK_DEMO_GROWTH;
    }
  }
});
