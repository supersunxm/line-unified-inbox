import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { StoreRow } from "../src/lib/v2/response-model.ts";
import {
  buildStoreHealthRows,
  filterStoreHealthRows,
  sortStoreHealthRows,
  storeHealthKpis,
} from "../src/lib/v2/stores-model.ts";

function row(storeId: string, patch: Partial<StoreRow> = {}): StoreRow {
  return {
    storeId,
    storeName: `ร้าน ${storeId}`,
    region: "Eastern",
    province: "Chonburi",
    hasData: true,
    waitingCount: 0,
    recentWaitingCount: 0,
    oldWaitingCount: 0,
    oldestWaitingMinutes: null,
    sinceYesterdayCount: 0,
    followTodayCount: 0,
    followTodayLongestMinutes: null,
    windowLongestMinutes: null,
    windowLongestWaitingSince: null,
    windowLongestChatId: null,
    followTodayRank: null,
    longestBusinessMinutes: null,
    longestWaitingSince: null,
    longestChatId: null,
    hasOverdueWait: false,
    rate7d: 95,
    ratePrev7d: 95,
    rateDelta: 0,
    trend: [],
    managerUrl: null,
    ...patch,
  };
}

test("store health joins Google Review by Store.id, not the external store code", () => {
  const rows = buildStoreHealthRows(
    [row("store-record-1")],
    [{
      id: "store-record-1",
      kpiResult: { qualifiedReviews: 4, targetQualifiedReviews: 10, isPassed: false },
    }],
  );
  assert.deepEqual(
    [rows[0].reviewLoaded, rows[0].reviewChecked, rows[0].reviewQualified, rows[0].reviewTarget, rows[0].reviewPassed],
    [true, true, 4, 10, false],
  );
});

test("attention includes missing chat data, today's chase, old backlog, low 24h rate and below-target reviews", () => {
  const rows = buildStoreHealthRows(
    [
      row("ok"),
      row("missing", { hasData: false }),
      row("follow", { followTodayCount: 2 }),
      row("backlog", { oldWaitingCount: 5, waitingCount: 5 }),
      row("rate", { rate7d: 72 }),
      row("review"),
    ],
    [
      { id: "ok", kpiResult: { qualifiedReviews: 10, targetQualifiedReviews: 10, isPassed: true } },
      { id: "missing", kpiResult: null },
      { id: "follow", kpiResult: null },
      { id: "backlog", kpiResult: null },
      { id: "rate", kpiResult: null },
      { id: "review", kpiResult: { qualifiedReviews: 3, targetQualifiedReviews: 10, isPassed: false } },
    ],
  );
  assert.deepEqual(
    rows.filter((item) => item.hasAttention).map((item) => item.storeId).sort(),
    ["backlog", "follow", "missing", "rate", "review"],
  );
  assert.equal(rows.find((item) => item.storeId === "ok")?.hasAttention, false);
});

test("store health KPI denominators stay explicit", () => {
  const rows = buildStoreHealthRows(
    [
      row("a", { followTodayCount: 1, rate7d: 80 }),
      row("b", { oldWaitingCount: 3, waitingCount: 3, rate7d: 95 }),
      row("c", { hasData: false, rate7d: null }),
    ],
    [
      { id: "a", kpiResult: { qualifiedReviews: 2, targetQualifiedReviews: 10, isPassed: false } },
      { id: "b", kpiResult: { qualifiedReviews: 10, targetQualifiedReviews: 10, isPassed: true } },
      { id: "c", kpiResult: null },
    ],
  );
  assert.deepEqual(storeHealthKpis(rows), {
    totalStores: 3,
    storesWithData: 2,
    attentionStores: 3,
    followTodayStores: 1,
    backlogStores: 1,
    belowRateTargetStores: 1,
    rateMeasuredStores: 2,
    belowReviewTargetStores: 1,
    reviewMeasuredStores: 2,
  });
});

test("filters and priority order surface missing data, then today's chase, then backlog", () => {
  const rows = buildStoreHealthRows(
    [
      row("normal", { storeName: "OPPO Central Bangna", region: "Bangkok", province: "Bangkok" }),
      row("backlog", { storeName: "OPPO Central Pinklao", oldWaitingCount: 9, waitingCount: 9 }),
      row("follow", { storeName: "OPPO Robinson Chonburi", followTodayCount: 3, waitingCount: 3 }),
      row("missing", { storeName: "OPPO Harbor Mall", hasData: false }),
    ],
    [],
  );
  assert.deepEqual(sortStoreHealthRows(rows).map((item) => item.storeId), ["missing", "follow", "backlog", "normal"]);
  assert.deepEqual(filterStoreHealthRows(rows, { tab: "attention" }).map((item) => item.storeId).sort(), ["backlog", "follow", "missing"]);
  assert.deepEqual(filterStoreHealthRows(rows, { tab: "no-data" }).map((item) => item.storeId), ["missing"]);
  assert.deepEqual(filterStoreHealthRows(rows, { tab: "all", search: "Bangna" }).map((item) => item.storeId), ["normal"]);
  assert.deepEqual(filterStoreHealthRows(rows, { tab: "all", region: "Eastern" }).map((item) => item.storeId).sort(), ["backlog", "follow", "missing"]);
});

test("v2 sidebar and title map route สาขา to /v2/stores while Store 360 stays a drill-down", () => {
  const shell = readFileSync(new URL("../src/components/v2/v2-shell.tsx", import.meta.url), "utf8");
  const view = readFileSync(new URL("../src/components/v2/stores-view.tsx", import.meta.url), "utf8");
  assert.match(shell, /href: "\/v2\/stores", label: "สาขา"/);
  assert.match(shell, /"\/v2\/stores": "สาขา"/);
  assert.match(view, /\/store-360\?storeId=/);
  assert.match(view, /responseHref\(\{ tab: "all", store: row\.storeId \}\)/);
});
