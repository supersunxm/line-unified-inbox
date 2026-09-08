import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageCode = readFileSync(new URL("../src/app/replymessage/page.tsx", import.meta.url), "utf8");
const panelCode = readFileSync(new URL("../src/app/dashboard/store-24h-response-panel.tsx", import.meta.url), "utf8");
const sidebarCode = readFileSync(new URL("../src/components/shell/app-sidebar.tsx", import.meta.url), "utf8");

test("replymessage remains dashboard-authorized and opens the selected store chat", () => {
  assert.match(pageCode, /<AuthorizedSection section="dashboard">/);
  assert.match(pageCode, /window\.location\.href = `\/chats\?store=\$\{encodeURIComponent\(storeId\)\}`/);
});

test("24h response panel uses the shared Thai period picker and preserves API dates", () => {
  assert.match(panelCode, /<UnifiedPeriodPicker[\s\S]*language="th"/);
  assert.match(panelCode, /new URLSearchParams\(\{ dateFrom: range\.dateFrom, dateTo: range\.dateTo \}\)/);
  assert.match(panelCode, /\/dashboard\/store-24h-response-summary\?\$\{params\.toString\(\)\}/);
  assert.doesNotMatch(panelCode, /type="date"/);
  assert.doesNotMatch(panelCode, /PERIOD_LABELS|PeriodChoice/);
  assert.match(panelCode, /type="search"/);
});

test("replymessage sidebar entry retains its route and pathname active state", () => {
  assert.match(sidebarCode, /href: "\/replymessage"/);
  assert.match(sidebarCode, /active: \(path\) => path\.startsWith\("\/replymessage"\)/);
});
