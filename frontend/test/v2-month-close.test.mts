import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { chatsStoreCounts } from "../src/app/reply-state.ts";
import { monthWindow } from "../src/lib/v2/month.ts";
import { closeStatusLabel, snapshotRates, snapshotSummary, type MonthCloseResponse } from "../src/lib/v2/month-close.ts";
import { networkCounts, storeCounts } from "../src/lib/v2/monthly-model.ts";

// Synthetic snapshot.
const response: MonthCloseResponse = {
  close: { id: "c1", month: "2026-09", revision: 1, closedBy: "SYSTEM", actorName: "system", reason: null, backfill: true, dueAt: "2026-10-01T17:00:00.000Z", closedAt: "2026-10-07T06:05:00.000Z", definitionVersion: "v2-month-1" },
  stores: [
    { storeUuid: "s1", storeId: "90001", storeName: "OBS Synthetic One", chatsTotal: 40, chatsUnreplied: 7, chatsReplied: 33, oldestWaitingMinutes: 900, rate24Total: 30, rate24Within: 27 },
    { storeUuid: "s2", storeId: null, storeName: "OBS Synthetic Two", chatsTotal: 0, chatsUnreplied: 0, chatsReplied: 0, oldestWaitingMinutes: null, rate24Total: 0, rate24Within: 0 },
  ],
  network: { chatsTotal: 40, chatsUnreplied: 7, chatsReplied: 33, rate24Total: 30, rate24Within: 27 },
  dueAt: "2026-10-01T17:00:00.000Z",
};

test("a snapshot reads exactly like the live /chats summary and /replymessage response", () => {
  const summary = snapshotSummary(response);
  assert.deepEqual(networkCounts(summary), { total: 40, notReplied: 7, replied: 33 });
  assert.deepEqual(storeCounts(summary).get("s1"), { total: 40, notReplied: 7, replied: 33, oldestWaitingMinutes: 900 });
  assert.deepEqual(chatsStoreCounts(summary.stores[0]).notReplied, 7, "/chats's own per-store function");
  assert.deepEqual(snapshotRates(response), { overview: { total: 30, within24h: 27 }, stores: [{ storeId: "s1", total: 30, within24h: 27 }, { storeId: "s2", total: 0, within24h: 0 }] });
});

test("status: closed, backfill, re-close, open month, ended but awaiting the automatic close", () => {
  const closedFrame = monthWindow("2026-09", Date.parse("2026-10-07T13:00:00+07:00"));
  assert.equal(closeStatusLabel(response.close, response.dueAt, closedFrame), "ปิดย้อนหลัง เมื่อ 7 ต.ค. 2026 13:05 (ตัวเลข ณ เวลาที่ปิด)");
  assert.equal(closeStatusLabel({ ...response.close!, backfill: false, closedAt: "2026-10-01T17:00:30.000Z" }, response.dueAt, closedFrame), "ปิดเดือนแล้ว เมื่อ 2 ต.ค. 2026 00:00");
  assert.equal(closeStatusLabel({ ...response.close!, revision: 2, closedBy: "ADMIN", actorName: "Synthetic Admin", reason: "late replay" }, response.dueAt, closedFrame), "ปิดใหม่ครั้งที่ 2 เมื่อ 7 ต.ค. 2026 13:05 โดย Synthetic Admin (late replay)");
  assert.equal(closeStatusLabel(null, "2026-11-01T17:00:00.000Z", monthWindow("2026-10", Date.parse("2026-10-07T13:00:00+07:00"))), "เดือนนี้ยังไม่ปิด (ข้อมูลถึงวันที่ 7)");
  assert.equal(closeStatusLabel(null, "2026-11-01T17:00:00.000Z", monthWindow("2026-10", Date.parse("2026-11-01T10:00:00+07:00"))), "สิ้นเดือนแล้ว รอปิดอัตโนมัติ 2 พ.ย. 2026 00:00 · ตัวเลขยังเปลี่ยนได้");
});

test("v2 reads the snapshot for closed months and live data only for open ones", () => {
  // The data layer moved to lib/metrics/use-monthly-metrics.tsx (shared with Home, Dashboard, Store 360).
  const data = readFileSync(new URL("../src/lib/metrics/use-monthly-metrics.tsx", import.meta.url), "utf8");
  assert.match(data, /fetch\(`\/api-backend\/v2\/month-close\/\$\{encodeURIComponent\(month\)\}`/);
  assert.match(data, /currentClosed \? \{ data: snapshotSummary\(monthClose\.data!\)/);
  assert.match(data, /currentClosed \? \{ data: snapshotRates\(monthClose\.data!\)/);
  assert.match(data, /useKeyedSource\("summary", on\(closeKnown && !currentClosed \? JSON\.stringify\(\{ month \}\) : null\)/, "no live call for a closed month");
  assert.match(data, /if \(close\?\.close\) return \{ \.\.\.point, summary: snapshotSummary\(close\), rates: snapshotRates\(close\), error: null \};/, "trend too");
  // The close status is stated on the Dashboard (the v2 data line was retired with the v2 shell).
  assert.match(readFileSync(new URL("../src/app/dashboard/monthly-dashboard.tsx", import.meta.url), "utf8"), /data\.statusText\]/);
});
