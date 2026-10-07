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
  const data = read("components/v2/v2-month-data.tsx");
  assert.match(data, /api\.bmReplyStatusSummary\(parsed\.month\)/, "/chats month view");
  assert.match(data, /fetch\(`\/api-backend\/conversations\/bm-reply-status-summary\?\$\{params\.toString\(\)\}`/, "/chats summary endpoint with from/to for the same-days comparison");
  assert.match(data, /frame\.inProgress \? JSON\.stringify\(\{ from: frame\.previous\.dateFrom, to: frame\.previous\.dateTo \}\)/);
  assert.doesNotMatch(data, /sort: "latest-asc"/, "no client-side paging for the comparison");
  assert.match(data, /api\.conversations\(\{ storeId, month, sort: "latest-desc", pageSize: MONTH_PAGE_SIZE, page \}\)/, "/chats list call for one store's month");
  assert.match(data, /\/api-backend\/dashboard\/store-24h-response-summary\?/, "/replymessage source");
  assert.match(read("app/replymessage/../dashboard/store-24h-response-panel.tsx"), /\/api-backend\/dashboard\/store-24h-response-summary\?/);
});

test("business-hours waiting appears only in the ตอนนี้ tab; monthly views use /chats's calendar wait", () => {
  const monthly = ["components/v2/month-overview.tsx", "components/v2/store-scorecard-view.tsx", "components/v2/store-scorecard-drawer.tsx", "components/v2/v2-month-data.tsx", "lib/v2/monthly-model.ts"];
  for (const file of monthly) {
    assert.doesNotMatch(read(file), /WaitLabel|businessMinutes|formatWaitMinutes|นับเฉพาะเวลาเปิดร้าน/, file);
  }
  assert.match(read("components/v2/store-scorecard-drawer.tsx"), /import \{ formatWaitingDuration \} from "@\/components\/shell\/store-priority-score";/);
  assert.match(read("components/v2/response-view.tsx"), /data-v2-business-hours-label[^>]*>นับเฉพาะเวลาเปิดร้าน</);
});

test("shell: monthly pages carry the month selector; ภาพรวมเดือน and ตอนนี้ are tabs; daily attention list removed", () => {
  const shell = read("components/v2/v2-shell.tsx");
  assert.match(shell, /"\/v2": "ภาพรวมเดือน", "\/v2\/response": "ตอนนี้", "\/v2\/stores": "สาขา"/);
  assert.match(shell, /\{monthly && <MonthSelector \/>\}/);
  assert.match(shell, /label: "สาขา", icon: "stores"/);
  assert.match(read("components/v2/v2-month-controls.tsx"), /selectableMonths\(now\)/);
  assert.match(read("app/v2/(shell)/page.tsx"), /<MonthOverview \/>/);
  assert.match(read("app/v2/(shell)/stores/page.tsx"), /<StoreScorecardView \/>/);
  const files = readdirSync(new URL("../src/components/v2", import.meta.url));
  assert.ok(!files.includes("today-view.tsx"));
  assert.ok(!files.includes("stores-view.tsx"));
  assert.match(read("components/v2/v2-layout.tsx"), /<V2DataProvider active=\{pathname\.startsWith\("\/v2\/response"\)\}>/, "live sources load only on ตอนนี้");
});

test("store list: no 'สาขาที่ต้องดู' KPI or daily inclusion rule; Google Review column only with results", () => {
  const view = read("components/v2/store-scorecard-view.tsx");
  assert.doesNotMatch(view, /สาขาที่ต้องดู|hasAttention|ต้องดู"/);
  assert.match(view, /\{data\.hasGoogleResults && <TableHead scope="col">Google Review<\/TableHead>\}/);
  assert.match(view, /<th scope="row"/, "real table semantics: the store is the row header");
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

test("drawer: per-store per-day 24h rate from the /replymessage endpoint with storeId", () => {
  const data = read("components/v2/v2-month-data.tsx");
  assert.match(data, /new URLSearchParams\(\{ dateFrom, dateTo, storeId \}\)/);
  assert.match(data, /\/api-backend\/dashboard\/store-24h-response-summary\?\$\{params\.toString\(\)\}/);
  const drawer = read("components/v2/store-scorecard-drawer.tsx");
  assert.match(drawer, /const dailyRates = useStoreDailyRates\(row\.storeId\);/);
  assert.match(drawer, /rateByDay\.get\(day\.day\)!\.within24h\}\/\$\{rateByDay\.get\(day\.day\)!\.total\}/);
});
