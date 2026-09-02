import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const code = readFileSync(
  new URL("../src/app/dashboard/executive-dashboard-base.tsx", import.meta.url),
  "utf8",
);
const integration = readFileSync(
  new URL("../src/app/dashboard/executive-dashboard-v2.tsx", import.meta.url),
  "utf8",
);
const peerPanel = readFileSync(
  new URL("../src/app/dashboard/executive-store-peer-panel.tsx", import.meta.url),
  "utf8",
);
const wrapper = readFileSync(
  new URL("../src/app/dashboard/dashboard-view.tsx", import.meta.url),
  "utf8",
);

test("dashboard renders the current executive operations sections", () => {
  assert.match(wrapper, /ExecutiveDashboardV2/);
  assert.match(integration, /ExecutiveDashboardBase/);
  assert.match(code, />ตัวเลขหลัก</);
  assert.match(code, />การดำเนินงานตอบกลับลูกค้า</);
  assert.match(code, />รายละเอียดระดับสาขา</);
  assert.match(code, />ข้อมูลเสริม</);
});

test("reply bucket percentage is null when there are no replied messages", () => {
  assert.match(code, /if \(totalReplied === 0\) return null/);
  assert.match(code, /ยังไม่มีข้อความที่ตอบกลับในช่วงที่เลือก/);
  assert.match(code, /bucket\.percent === null \? "—"/);
});

test("dashboard keeps the current unified store comparison table", () => {
  assert.match(code, /Top 10 สาขาผู้ติดตามสูงสุด vs สาขาที่ต้องการการดูแล/);
  assert.match(code, /top10/);
  assert.match(code, /bottom10/);
  assert.match(code, /overflow-x-auto/);
  assert.doesNotMatch(code, /Watchlist|store\.issues\.map/);
});

test("dashboard uses live executive store health instead of HTML mock values", () => {
  assert.match(code, /dashboard\/executive-store-health/);
  assert.match(code, /health\.stores/);
  assert.doesNotMatch(code, /198,375/);
  assert.doesNotMatch(code, /OBS Siam TV Lamphun/);
});

test("dashboard integrates StoreMaster peer filters and same-plan ranking", () => {
  assert.match(integration, /ExecutiveStorePeerPanel/);
  assert.match(integration, /dashboardPeerPanel/);
  assert.match(peerPanel, /StoreMaster Peer Comparison/);
  assert.match(peerPanel, /Same KPI Plan Ranking/);
  assert.match(peerPanel, /Needs Attention/);
  assert.match(peerPanel, /label="Tier"/);
  assert.match(peerPanel, /label="KPI Plan"/);
  assert.match(peerPanel, /label="Area"/);
  assert.match(peerPanel, /label="BM"/);
  assert.match(peerPanel, /params\.set\("kpiPlan", kpiPlan\)/);
});
