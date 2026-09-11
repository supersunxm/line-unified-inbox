import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controlCode = readFileSync(new URL("../src/app/store-360/store-360-export-control.tsx", import.meta.url), "utf8");
const helperCode = readFileSync(new URL("../src/app/store-360/store-360-export.ts", import.meta.url), "utf8");
const apiCode = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const viewCode = readFileSync(new URL("../src/app/store-360/store-360-view.tsx", import.meta.url), "utf8");

test("Store 360 export control uses the current store and active Bangkok date range", () => {
  assert.match(controlCode, /button: "ดาวน์โหลดข้อมูล"/);
  assert.match(controlCode, /button: "Export Data"/);
  assert.match(controlCode, /setSelectedIds\(selectedStoreId \? \[selectedStoreId\] : \[\]\)/);
  assert.match(viewCode, /<Store360ExportControl[\s\S]*startDate=\{from\}[\s\S]*endDate=\{to\}/);
  assert.match(controlCode, /disabled={downloading \|\| selectedIds\.length === 0}/);
  assert.match(controlCode, /role="alert"/);
  assert.match(controlCode, /MAX_STORES = 10/);
  assert.match(helperCode, /timezone: "Asia\/Bangkok"/);
});

test("Store 360 export API sends explicit stores and the dedicated endpoint", () => {
  assert.match(apiCode, /storeInsightsExport:/);
  assert.match(apiCode, /requestBlob\("\/store-insights\/export"/);
  assert.match(apiCode, /JSON\.stringify\(input\)/);
  assert.match(helperCode, /storeIds: options\.storeIds/);
  assert.match(helperCode, /startDate: options\.startDate/);
  assert.match(helperCode, /endDate: options\.endDate/);
});

test("Store 360 export client path contains no raw message or customer identity fields", () => {
  assert.doesNotMatch(controlCode, /originalText|rawPayload|lineUserId|phoneNumber|customerId/);
  assert.doesNotMatch(helperCode, /originalText|rawPayload|lineUserId|phoneNumber|customerId/);
});
