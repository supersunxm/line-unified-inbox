import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { readChatRouteFilters } from "../src/app/workspace-routing.ts";
import { chatsHref, parseReportUrl, parseStoresUrl, reportHref, storesHref, withMonth } from "../src/lib/v2/month-url.ts";

const NOW = Date.parse("2026-10-07T14:30:00+07:00");
const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const params = (query: string) => new URLSearchParams(query);

test("store list URL: month always written, defaults left out, unknown values fall back", () => {
  assert.equal(storesHref({ month: "2026-10" }), "/v2/stores?month=2026-10");
  assert.equal(storesHref({ month: "2026-09", partner: "TG", region: "Eastern", sort: "unreplied", store: "s1" }), "/v2/stores?month=2026-09&partner=TG&region=Eastern&sort=unreplied&store=s1");
  assert.equal(storesHref({ month: "2026-09", sort: "rate24" }), "/v2/stores?month=2026-09", "the default sort (24h gap) is left out");
  assert.deepEqual(parseStoresUrl(params("month=2026-09&partner=TG&sort=delta&store=s1"), NOW), { month: "2026-09", partner: "TG", region: null, sort: "delta", store: "s1" });
  assert.deepEqual(parseStoresUrl(params("month=2026-08&sort=bogus"), NOW), { month: "2026-10", partner: null, region: null, sort: "rate24", store: null });
  assert.equal(withMonth("/v2", "2026-09"), "/v2?month=2026-09");
});

test("report URL params round-trip: month, partner, store", () => {
  const href = reportHref({ month: "2026-09", partner: "IT City", store: null });
  assert.equal(href, "/v2/report?month=2026-09&partner=IT+City");
  assert.deepEqual(parseReportUrl(params(href.split("?")[1]), NOW), { month: "2026-09", partner: "IT City", store: null });
  assert.deepEqual(parseReportUrl(params("store=s1"), NOW), { month: "2026-10", partner: null, store: "s1" });
});

test("links to /chats use /chats's own URL params (storeId, month, replyState)", () => {
  const href = chatsHref({ storeId: "s1", month: "2026-09" });
  assert.equal(href, "/chats?storeId=s1&month=2026-09");
  const filters = readChatRouteFilters(href.split("?")[1]);
  assert.equal(filters.store, "s1");
  assert.equal(filters.month, "2026-09");
  assert.equal(readChatRouteFilters(chatsHref({ storeId: "s1", month: "2026-10", unrepliedOnly: true }).split("?")[1]).replyState, "NOT_REPLIED");
});

test("data layer: monthly numbers come from the /chats and /replymessage endpoints", () => {
  // The data layer moved to lib/metrics/use-monthly-metrics.tsx (shared with Home, Dashboard, Store 360).
  const data = read("lib/metrics/use-monthly-metrics.tsx");
  assert.match(data, /api\.bmReplyStatusSummary\(parsed\.month\)/, "/chats month view");
  assert.match(data, /fetch\(`\/api-backend\/conversations\/bm-reply-status-summary\?\$\{params\.toString\(\)\}`/, "/chats summary endpoint with from/to for the same-days comparison");
  assert.match(data, /frame\.inProgress \? JSON\.stringify\(\{ from: frame\.previous\.dateFrom, to: frame\.previous\.dateTo \}\)/);
  assert.doesNotMatch(data, /sort: "latest-asc"/, "no client-side paging for the comparison");
  assert.match(data, /api\.conversations\(\{ storeId, month, sort: "latest-desc", pageSize: MONTH_PAGE_SIZE, page \}\)/, "/chats list call for one store's month");
  assert.match(data, /\/api-backend\/dashboard\/store-24h-response-summary\?/, "/replymessage source");
  assert.match(read("app/replymessage/../dashboard/store-24h-response-panel.tsx"), /\/api-backend\/dashboard\/store-24h-response-summary\?/);
});

// The v2 "ตอนนี้" tab (business-hours waiting) was retired on 8 Oct 2026: every view now uses /chats's
// calendar wait and the monthly model.
test("monthly views use /chats's calendar wait; no business-hours waiting is left", () => {
  const monthly = ["app/dashboard/monthly-dashboard.tsx", "app/store-360/store-360-monthly.tsx", "app/home/page.tsx", "lib/metrics/store-model.ts", "lib/metrics/use-monthly-metrics.tsx", "components/v2/month-report.tsx"];
  for (const file of monthly) {
    assert.doesNotMatch(read(file), /WaitLabel|businessMinutes|formatWaitMinutes|นับเฉพาะเวลาเปิดร้าน/, file);
  }
  assert.match(read("lib/metrics/store-model.ts"), /oldestWaitingMinutes: counts && counts\.notReplied > 0 \? counts\.oldestWaitingMinutes : null/);
});

// The v2 workspace was retired into Home, Dashboard and Store 360 (8 Oct 2026): its URLs redirect,
// keeping the month; /v2/report and /v2/admin/partners stay.
test("retired v2 URLs redirect with the month kept", async () => {
  const { v2RedirectHref } = await import("../src/app/v2/v2-redirects.ts");
  assert.equal(v2RedirectHref("overview", {}), "/dashboard");
  assert.equal(v2RedirectHref("overview", { month: "2026-09" }), "/dashboard?month=2026-09");
  assert.equal(v2RedirectHref("stores", { month: "2026-09", partner: "TG", sort: "unreplied" }), "/dashboard?month=2026-09#stores");
  assert.equal(v2RedirectHref("stores", { month: "2026-09", store: "s1" }), "/store-360?storeId=s1&month=2026-09", "the old scorecard drawer opens Store 360");
  assert.equal(v2RedirectHref("response", { view: "chat", tab: "all" }), "/dashboard#stores");
  assert.equal(v2RedirectHref("customers", {}), "/store-360");
  assert.equal(v2RedirectHref("overview", { month: "../evil" }), "/dashboard", "only a YYYY-MM month is carried");
  assert.equal(v2RedirectHref("overview", { month: ["2026-10", "2026-09"] }), "/dashboard?month=2026-10");
  for (const [path, route] of [["app/v2/page.tsx", "overview"], ["app/v2/stores/page.tsx", "stores"], ["app/v2/response/page.tsx", "response"], ["app/v2/customers/page.tsx", "customers"]]) {
    assert.match(read(path), new RegExp(`redirect\\(v2RedirectHref\\("${route}", await searchParams\\)\\);`), path);
  }
  const files = readdirSync(new URL("../src/app/v2", import.meta.url));
  assert.ok(!files.includes("(shell)"), "no v2 shell");
  assert.match(read("app/v2/report/page.tsx"), /<MonthReport \/>/);
  assert.match(read("app/v2/admin/partners/page.tsx"), /<StorePartnersAdminPage \/>/);
  const components = readdirSync(new URL("../src/components/v2", import.meta.url)).sort();
  assert.deepEqual(components, ["month-report.tsx", "store-partners-admin.tsx", "v2-month-data.tsx"]);
});

test("no user-visible internal terms in v2 components", () => {
  const dir = new URL("../src/components/v2/", import.meta.url);
  for (const name of readdirSync(dir)) {
    const source = readFileSync(new URL(name, dir), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    const literals = source.match(/"[^"\n]*"|`[^`]*`|>[^<>{}\n]+</g) ?? [];
    // Template expressions (${data.mirror.error}) are code, not text.
    const offenders = literals.map((text) => text.replace(/\$\{[^}]*\}/g, "")).filter((text) => /\bMirror\b|\b[Rr]esolver\b|\b[Ff]leet\b|NOTIFIED_BM/.test(text) && !/mirror-status|fleet-readiness/.test(text));
    assert.deepEqual(offenders, [], name);
  }
});

test("Store 360: per-store per-day 24h rate from the /replymessage endpoint with storeId", () => {
  const data = read("lib/metrics/use-monthly-metrics.tsx");
  assert.match(data, /new URLSearchParams\(\{ dateFrom, dateTo, storeId \}\)/);
  assert.match(data, /\/api-backend\/dashboard\/store-24h-response-summary\?\$\{params\.toString\(\)\}/);
  const view = read("app/store-360/store-360-monthly.tsx");
  assert.match(view, /const dailyRates = useStoreDailyRateSource\(row\.storeId, data\.frame, data\.nonce\);/);
  assert.match(view, /`\$\{rate\.within24h\}\/\$\{rate\.total\}`/);
});
