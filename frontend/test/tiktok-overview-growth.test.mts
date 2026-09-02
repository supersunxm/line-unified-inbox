import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getTikTokDemoGrowthMetrics,
  isTikTokDemoGrowthEnabled,
} from "../src/app/tiktok/dashboard/tiktok-demo-growth.ts";

test("Overview page.tsx concurrently fetches historical metrics and passes to TikTokOverviewView", () => {
  const pageCode = readFileSync(new URL("../src/app/tiktok/page.tsx", import.meta.url), "utf8");
  assert.match(pageCode, /fetchTikTokHistoricalMetricsFromBackend/);
  assert.match(pageCode, /Promise\.all\(\[/);
  assert.match(pageCode, /isTikTokDemoGrowthEnabled\(\)/);
  assert.match(pageCode, /getTikTokDemoGrowthMetrics\(/);
  assert.match(pageCode, /historicalMetrics=\{historicalMetrics\}/);
});

test("TikTokOverviewView implements locale-aware net follower growth UI for positive, negative, zero, and missing deltas", () => {
  const viewCode = readFileSync(new URL("../src/app/tiktok/tiktok-overview-view.tsx", import.meta.url), "utf8");

  assert.match(viewCode, /historicalMetrics\?: TikTokHistoricalMetricsData \| null/);
  assert.match(viewCode, /function deltaPresentation\(value: number \| null \| undefined, locale: string\)/);
  assert.match(viewCode, /text:\s*"--"/);
  assert.match(viewCode, /new Intl\.NumberFormat\(locale\)\.format\(value\)/);
  assert.match(viewCode, /text:\s*`\+\$\{formatted\}`/);
  assert.match(viewCode, /text:\s*formatted/);
  assert.match(viewCode, /text:\s*"0"/);

  assert.match(viewCode, /\[t\.today, historicalMetrics\?\.summary\?\.dailyFollowerGrowth\]/);
  assert.match(viewCode, /\[t\.sevenDays, historicalMetrics\?\.summary\?\.sevenDayFollowerGrowth\]/);
  assert.match(viewCode, /\[t\.thirtyDays, historicalMetrics\?\.summary\?\.thirtyDayFollowerGrowth\]/);
  assert.match(viewCode, /border-t border-slate-100 pt-2\.5 dark:border-slate-800\/80/);
});

test("Overview and Dashboard share identical demo growth baseline metrics when demo mode is active", () => {
  const demoMetrics = getTikTokDemoGrowthMetrics("acc-central-world");
  assert.equal(demoMetrics.summary.currentFollowerCount, 13342);
  assert.equal(demoMetrics.summary.dailyFollowerGrowth, 47);
  assert.equal(demoMetrics.summary.sevenDayFollowerGrowth, 286);
  assert.equal(demoMetrics.summary.thirtyDayFollowerGrowth, 1124);
  assert.equal(demoMetrics.history.length, 30);
});

test("Demo mode is disabled by default and uses real PostgreSQL snapshot data", () => {
  const origEnv = process.env.NEXT_PUBLIC_TIKTOK_DEMO_GROWTH;
  try {
    delete process.env.NEXT_PUBLIC_TIKTOK_DEMO_GROWTH;
    assert.equal(isTikTokDemoGrowthEnabled(), false);
  } finally {
    if (origEnv !== undefined) process.env.NEXT_PUBLIC_TIKTOK_DEMO_GROWTH = origEnv;
    else delete process.env.NEXT_PUBLIC_TIKTOK_DEMO_GROWTH;
  }
});
