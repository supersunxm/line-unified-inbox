import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const viewCode = readFileSync(new URL("../src/app/store-360/store-360-view.tsx", import.meta.url), "utf8");
const panelCode = readFileSync(new URL("../src/app/store-360/customer-voice-panel.tsx", import.meta.url), "utf8");

test("Store 360 Phase 1 uses the approved BI information hierarchy", () => {
  for (const label of ["Turn conversations into business impact", "KeyInsight", "BusinessPerformance", "SalesPerformance", "Response Performance", "Team Performance", "Conversation Explorer"]) {
    assert.ok(viewCode.includes(label), "missing BI section: " + label);
  }
  for (const label of ["Customers", "Reply within 24h", "Median response time", "Sales-tagged customers", "Unanswered customers", "Customer Voice coverage"]) {
    assert.ok(viewCode.includes(label), "missing KPI: " + label);
  }
  assert.match(viewCode, /grid-cols-3/);
  assert.match(viewCode, /xl:grid-cols-6/);
  const row3 = viewCode.indexOf("<BusinessPerformance summary={summary} /><CustomerVoicePanel");
  assert.ok(row3 >= 0 && row3 < viewCode.indexOf("<SalesPerformance summary={summary} />", row3), "Row 3 should place Sales Performance beside Business Performance and Customer Voice");
  const row4 = viewCode.indexOf("headingId=\"response-performance-title\"");
  assert.ok(row4 >= 0 && row4 < viewCode.indexOf("<ResponderList responders={responders}", row4) && row4 < viewCode.indexOf("<ConversationExplorer conversations=", row4), "Row 4 should keep response, team, and explorer together");
});

test("Store 360 renders the real daily trend aggregation without illustrative values", () => {
  assert.match(viewCode, /dailyTrend/);
  assert.match(viewCode, /Daily activity/);
  assert.doesNotMatch(viewCode, /hourly distribution, not a daily trend/);
  assert.match(viewCode, /Deterministic summary from the selected Store 360 period/);
  assert.doesNotMatch(viewCode, /\+12%|\+5%/);
});

test("Customer Voice exposes tabs and honest partial coverage", () => {
  assert.match(panelCode, /role="tablist"/);
  assert.match(panelCode, /role="tab"/);
  assert.match(panelCode, /Current-version coverage/);
  assert.match(panelCode, /It is not full-store coverage/);
  assert.match(panelCode, /Product Interest/);
  assert.match(panelCode, /From conversations/);
  assert.match(panelCode, /items\.slice\(0, 5\)/);
  assert.match(panelCode, /href="#conversation-explorer-title"/);
  assert.match(panelCode, /View all topics/);
});

test("Store 360 overview uses a compact conversation preview and responsive loading layout", () => {
  assert.match(viewCode, /A compact preview of recent conversations/);
  assert.match(viewCode, /View all conversations/);
  assert.match(viewCode, /Store360Skeleton/);
  assert.match(viewCode, /sm:grid-cols-2/);
  assert.match(viewCode, /lg:grid-cols-3/);
  assert.doesNotMatch(viewCode, /type="date"/);
  assert.match(viewCode, /Search conversations, topics, or keywords/);
  assert.match(viewCode, /<AppShell currentSection="store-360"/);
  assert.match(viewCode, /showGlobalHeader=\{false\}/);
  assert.doesNotMatch(viewCode, /Store360Shell/);
});
