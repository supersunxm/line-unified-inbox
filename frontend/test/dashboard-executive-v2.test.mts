import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const code = readFileSync(
  new URL("../src/app/dashboard/executive-dashboard-v2.tsx", import.meta.url),
  "utf8",
);
const wrapper = readFileSync(
  new URL("../src/app/dashboard/dashboard-view.tsx", import.meta.url),
  "utf8",
);

test("dashboard switches to the five-tier executive v2 view", () => {
  assert.match(wrapper, /ExecutiveDashboardV2/);
  assert.match(code, />ตัวเลขหลัก</);
  assert.match(code, />การดำเนินงานตอบกลับลูกค้า</);
  assert.match(code, />สาขาที่ต้องติดตาม</);
  assert.match(code, />รายละเอียดระดับสาขา</);
  assert.match(code, />ข้อมูลเสริม</);
});

test("reply bucket percentage is null when there are no replied messages", () => {
  assert.match(code, /if \(totalReplied === 0\) return null/);
  assert.match(code, /ยังไม่มีข้อความที่ตอบกลับในวันนี้/);
  assert.match(code, /bucket\.percent === null \? "—"/);
});

test("watchlist is one unified table with combined issue chips", () => {
  assert.match(code, /Watchlist — สาขาที่มีสัญญาณผิดปกติ/);
  assert.match(code, /store\.issues\.map/);
  assert.match(code, /overflow-x-auto/);
  assert.match(code, /min-w-\[720px\]/);
  assert.doesNotMatch(code, /ResponseRateCard/);
  assert.doesNotMatch(code, /StorePerformanceOverview/);
});

test("dashboard uses live executive store health instead of HTML mock values", () => {
  assert.match(code, /dashboard\/executive-store-health/);
  assert.match(code, /health\.stores/);
  assert.doesNotMatch(code, /198,375/);
  assert.doesNotMatch(code, /OBS Siam TV Lamphun/);
});
