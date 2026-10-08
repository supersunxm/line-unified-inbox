import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { metricsTranslations, v2Text, v2Translations } from "../src/lib/metrics/translations.ts";
import { countState, deltaState, formatValue, meetsSample, MIN_RATE_SAMPLE, rateState, type ValueState } from "../src/lib/metrics/value-state.ts";
import { targetState } from "../src/lib/metrics/kpi.ts";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

// Quality checks across Home, Dashboard and Store 360 (owner brief, 8 Oct 2026).

test("one function per KPI: Home, Dashboard, Store 360 and the sidebar badge read the same hook and rows", () => {
  const home = read("app/home/page.tsx");
  const dashboard = read("app/dashboard/monthly-dashboard.tsx");
  const store360 = read("app/store-360/store-360-monthly.tsx");
  for (const [name, source] of [["home", home], ["dashboard", dashboard], ["store-360", store360]] as const) {
    assert.match(source, /useMonthlyMetrics\(month/, name);
    assert.doesNotMatch(source, /bmReplyStatusSummary|store-24h-response-summary|dashboardAnalytics\(/, `${name}: no page-level count of its own`);
  }
  // Network numbers: data.network on Home and Dashboard; per store: data.storeRows (Home, Dashboard, Store 360).
  assert.match(home, /data\.network\.unreplied/);
  assert.match(dashboard, /data\.network\.unreplied/);
  assert.match(home, /storesToWatch\(data\.storeRows\)/);
  assert.match(dashboard, /data\.storeRows/);
  assert.match(store360, /data\.storeRows\.find/);
  // The hook builds the network from networkCounts (= /chats's effectiveSummaryCounts) and the rows from
  // chatsStoreCounts; the badge from unrepliedCount on the same cached summary (test/metrics-layer.test.mts).
  const hook = read("lib/metrics/use-monthly-metrics.tsx");
  assert.match(hook, /const storeRows = buildStoreRows\(/);
  assert.match(hook, /const network = networkTotals\(/);
  assert.match(read("components/shell/chats-unreplied-badge.ts"), /return unrepliedCount\(summary\);/);
});

test("no 0 for an unknown state, and every — carries a reason", () => {
  const unknown: ValueState[] = [{ kind: "no-activity" }, { kind: "not-collected" }, { kind: "failed" }, { kind: "failed", error: "500" }, { kind: "not-applicable" }, { kind: "loading" }];
  for (const state of unknown) {
    for (const language of ["th", "en", "zh"] as const) {
      const formatted = formatValue(state, "count", language);
      assert.notEqual(formatted.text, "0", `${state.kind} ${language}`);
      assert.ok(formatted.reason, `${state.kind} ${language} has a reason`);
    }
  }
  assert.equal(formatValue(countState(0)).text, "0", "a measured zero is 0");
  assert.equal(countState(undefined).kind, "failed", "a missing number is never 0");
  assert.equal(rateState(0, 0).kind, "no-activity", "no chats: not 0%");
  assert.equal(deltaState({ kind: "value", value: 5 }, { kind: "not-collected" }).kind, "not-collected");
});

test("low-sample rule: under MIN_RATE_SAMPLE a rate is muted, shows n, has no target colour and no rank", () => {
  assert.equal(MIN_RATE_SAMPLE, 10);
  const small = rateState(4, 9);
  assert.equal(small.kind, "low-sample");
  assert.equal(meetsSample(small), false);
  assert.equal(formatValue(small, "percent").muted, true);
  assert.match(formatValue(small, "percent").reason ?? "", /n=9/);
  assert.equal(targetState(small, 90).kind, "low-sample");
  assert.equal(rateState(9, 10).kind, "value");
});

test("i18n: every metrics string exists in Thai, English and Chinese with the same placeholders", () => {
  const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(",");
  for (const [key, entry] of Object.entries(v2Translations) as Array<[string, { th: string; en: string; zh: string }]>) {
    for (const language of ["th", "en", "zh"] as const) assert.ok(entry[language]?.trim(), `${key}.${language}`);
    assert.equal(placeholders(entry.en), placeholders(entry.th), `${key} en placeholders`);
    assert.equal(placeholders(entry.zh), placeholders(entry.th), `${key} zh placeholders`);
  }
  assert.ok(Object.keys(metricsTranslations).length > 100);
  assert.equal(v2Text("zh")("storeScope", { count: 1, total: 2 }), "2 家门店中 1 家有聊天数据");
});

test("no English left in the Thai strings of the metrics pages (names and product terms excepted)", () => {
  const allowed = /\b(LINE|OA|Google|Review|Store|360|CSV|Backend|API|Webhook|Customer|Voice|KPI|n|SG|Finance|Ufund)\b/g;
  for (const [key, entry] of Object.entries(metricsTranslations) as Array<[string, { th: string }]>) {
    const words = entry.th.replace(/\{\w+\}/g, "").replace(allowed, "").match(/[A-Za-z]{2,}/g);
    assert.equal(words, null, `${key}: ${entry.th}`);
  }
  // The pages render through the table: no hard-coded user-visible English in their JSX text.
  for (const file of ["app/home/page.tsx", "app/dashboard/monthly-dashboard.tsx", "app/store-360/store-360-monthly.tsx"]) {
    const jsxText = read(file).match(/>[^<>{}\n=;]*[A-Za-z]{3,}[^<>{}\n=;]*<\//g) ?? [];
    assert.deepEqual(jsxText, [], file);
  }
});
