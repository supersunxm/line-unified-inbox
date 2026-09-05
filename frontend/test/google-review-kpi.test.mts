import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canAccessPrimarySection } from "../src/lib/authorization.ts";
import { primaryNavigationState } from "../src/app/primary-navigation.ts";
import type { AuthUser } from "../src/types/api.ts";

const apiCode = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const appSidebarCode = readFileSync(new URL("../src/components/shell/app-sidebar.tsx", import.meta.url), "utf8");
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
});
