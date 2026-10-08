import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canAccessPrimarySection } from "../src/lib/authorization.ts";
import { primaryNavigationState } from "../src/app/primary-navigation.ts";
import { formatGoogleReviewWeeklyPeriodLabel } from "../src/app/google-review-kpi/weekly-period-label.ts";
import { googleReviewKpiPhrases, googleReviewKpiText } from "../src/app/google-review-kpi/google-review-kpi-i18n.ts";
import type { AuthUser } from "../src/types/api.ts";

const apiCode = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const appSidebarCode = readFileSync(new URL("../src/components/shell/navigation-config.ts", import.meta.url), "utf8");
const topNavCode = readFileSync(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");
const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const kpiViewCode = readFileSync(new URL("../src/app/google-review-kpi/google-review-kpi-view.tsx", import.meta.url), "utf8");

test("Google Review KPI access permissions for HQ, Store, and Viewer users", () => {
  const hqAdmin: AuthUser = {
    id: "admin-1",
    email: "admin@oppo.th",
    displayName: "Admin",
    role: "ADMIN",
    isActive: true,
    canAccessHq: true,
    canAccessWeb: true,
  };

  const storeUser: AuthUser = {
    id: "user-1",
    email: "store@oppo.th",
    displayName: "Store Manager",
    role: "VIEWER",
    isActive: true,
    canAccessHq: false,
    canAccessWeb: true,
    memberships: [
      {
        id: "m-1",
        storeId: "s-1",
        role: "STORE_MANAGER",
        store: { id: "s-1", name: "OPPO Store", code: "BKK001" },
      },
    ],
  };

  assert.equal(canAccessPrimarySection(hqAdmin, "google-review-kpi"), true);
  assert.equal(canAccessPrimarySection(storeUser, "google-review-kpi"), true);
});

test("primaryNavigationState handles google-review-kpi section cleanly", () => {
  const state = primaryNavigationState("google-review-kpi");
  assert.equal(state.homeActive, false);
  assert.equal(state.dashboardActive, false);
  assert.equal(state.chatsActive, false);
  assert.equal(state.storesActive, false);
});

test("API client and UI integration exposes Google Review KPI methods and routes", () => {
  assert.match(apiCode, /getGoogleReviewKpis/);
  assert.match(apiCode, /getStoreGoogleReviewKpi/);
  assert.match(apiCode, /submitGoogleReviewKpiResult/);
  assert.match(appSidebarCode, /href: "\/google-review-kpi"/);
  assert.match(topNavCode, /"google-review-kpi"/);
  assert.match(pageCode, /GoogleReviewKpiView/);
  assert.match(kpiViewCode, /Google Maps Review KPI Checker/);
  assert.match(kpiViewCode, /openMaps/);
});

test("Google Review KPI view has Download / Export buttons and handlers", () => {
  assert.match(apiCode, /downloadGoogleReviewWeeklyExport/);
  assert.match(kpiViewCode, /downloadGoogleReviewWeeklyExport/);
  assert.match(kpiViewCode, /downloadBtn/);
  assert.match(kpiViewCode, /downloadExcel/);
  assert.match(kpiViewCode, /downloadCsv/);
  assert.match(kpiViewCode, /handleDownloadWeeklyExport/);
  assert.match(kpiViewCode, /Google Rating/);
  assert.match(kpiViewCode, /Google Review Count/);
  assert.match(kpiViewCode, /googleReviewKpiText\(language, "googleRating"\)/);
  assert.match(kpiViewCode, /googleReviewKpiText\(language, "currentGoogleMaps"\)/);
  assert.match(kpiViewCode, /handleToggleSort/);
});

test("Google Review KPI tabs use Thai labels instead of Chinese fallback copy", () => {
  assert.match(kpiViewCode, /title:\s*"KPI รีวิว Google Maps"/);
  assert.match(kpiViewCode, /title:\s*"Google Maps Review KPI"/);
  assert.match(kpiViewCode, /title:\s*"Google Maps 评价 KPI 检查器"/);
  assert.match(kpiViewCode, /tabMonthly:\s*"KPI รายเดือน"/);
  assert.match(kpiViewCode, /tabWeeklyTopStore:\s*"ร้านยอดนิยมรายสัปดาห์"/);
  assert.match(kpiViewCode, /tabMonthly:\s*"Monthly KPI"/);
  assert.match(kpiViewCode, /tabMonthly:\s*"月度 KPI"/);
});

test("weekly review periods use the selected locale without mixing Thai and Chinese", () => {
  const period = {
    weekNumber: 2,
    label: "第二周 สัปดาห์ที่ 2 (03-09.09.2026)",
    labelTh: "สัปดาห์ที่ 2",
    labelZh: "第二周",
  };

  assert.equal(formatGoogleReviewWeeklyPeriodLabel(period, "th"), "สัปดาห์ที่ 2 (03-09.09.2026)");
  assert.equal(formatGoogleReviewWeeklyPeriodLabel(period, "en"), "Week 2 (03-09.09.2026)");
  assert.equal(formatGoogleReviewWeeklyPeriodLabel(period, "zh"), "第二周 (03-09.09.2026)");
  assert.doesNotMatch(formatGoogleReviewWeeklyPeriodLabel(period, "en"), /[\u0E00-\u0E7F\u4E00-\u9FFF]/);
});

test("Google Review coverage labels keep the store unit in the selected locale", () => {
  const english = googleReviewKpiText("en", "coverageNeedsAttention");
  const chinese = googleReviewKpiText("zh", "coverageNeedsAttention");

  assert.match(english, /6 stores/);
  assert.match(chinese, /6 家门店/);
  assert.doesNotMatch(english, /[\u0E00-\u0E7F\u4E00-\u9FFF]/);
  assert.doesNotMatch(chinese, /[\u0E00-\u0E7F]/);
});

test("Google Review KPI English and Chinese phrases contain no Thai-script leakage", () => {
  for (const phrase of googleReviewKpiPhrases) {
    assert.doesNotMatch(phrase.en, /[\u0E00-\u0E7F]/u, `${phrase.key} English phrase`);
    assert.doesNotMatch(phrase.zh, /[\u0E00-\u0E7F]/u, `${phrase.key} Chinese phrase`);
  }
});
