import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { primaryNavigationState } from "../src/app/primary-navigation.ts";
import { getClassificationInsightsText } from "../src/app/classification-insights/classification-insights-translations.ts";

const pageCode = readFileSync(new URL("../src/app/classification-insights/page.tsx", import.meta.url), "utf8");
const viewCode = readFileSync(new URL("../src/app/classification-insights/classification-insights-view.tsx", import.meta.url), "utf8");
const workspaceCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const apiCode = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const topNavigationCode = readFileSync(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");

test("classification insights route uses the existing authenticated application shell and readable container", () => {
  assert.match(pageCode, /ApplicationWorkspace initialSection="classification-insights"/);
  assert.match(workspaceCode, /initialSection === "classification-insights"[\s\S]*PageContainer variant="readable"[\s\S]*ClassificationInsightsView/);
  assert.match(topNavigationCode, /href="\/classification-insights"/);
  assert.equal(primaryNavigationState("classification-insights").classificationInsightsActive, true);
});

test("classification insights API uses the shared credentialed request helper", () => {
  assert.match(apiCode, /classificationInsights:\s*\(\) => request<ClassificationInsightsResponse>\("\/classification-insights"\)/);
  assert.match(apiCode, /credentials: "include"/);
});

test("dashboard identifies coverage and rule behavior without claiming accuracy", () => {
  for (const language of ["th", "en", "zh"] as const) {
    const text = getClassificationInsightsText(language);
    assert.match(text.subtitle, /ไม่ใช่ความแม่นยำ|not accuracy|不代表准确率/);
  }
  assert.match(viewCode, /data-classification-insights/);
  assert.doesNotMatch(viewCode, /precision|recall|correction rate/i);
});

test("dashboard renders every Phase 1.5 section and controlled empty and error states", () => {
  for (const marker of [
    "data-insights-kpis",
    "data-coverage-funnel",
    "data-product-ranking",
    "data-review-queue",
    "data-compact-monitoring",
    "data-catalog-health",
  ]) {
    assert.match(viewCode, new RegExp(marker));
  }
  assert.match(viewCode, /role="alert"/);
  assert.match(viewCode, /productRanking\.length === 0/);
  assert.match(viewCode, /reviewQueue\.length === 0/);
  assert.match(viewCode, /compactMonitoring\.aliases\.length === 0/);
});

test("review queue opens the existing conversation route and semantic theme classes are used", () => {
  assert.match(viewCode, /href=\{`\/chats\?conversationId=\$\{encodeURIComponent\(row\.conversationId\)\}`\}/);
  assert.match(viewCode, /app-card/);
  assert.match(viewCode, /app-muted/);
  assert.match(viewCode, /app-filter-panel/);
  assert.match(viewCode, /app-button-secondary/);
});
