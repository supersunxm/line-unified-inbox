import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveAuthorizedStoreId, withStore360Timeout } from "../src/app/store-360/store-360-bootstrap.ts";

const viewCode = readFileSync(new URL("../src/app/store-360/store-360-monthly.tsx", import.meta.url), "utf8");

// Owner decision 8 Oct 2026: Store 360 is one store's month. Its store is URL-backed (?storeId=&month=);
// without one it opens the last viewed store or a searchable picker with the stores to check — never an
// arbitrary store. The old combobox and its search helper (store-search*.ts) were removed with the old view.
test("Store 360 keeps URL-backed selection: ?storeId=&month=, last viewed store, else the picker", () => {
  assert.match(viewCode, /const month = parseV2Month\(params\.get\("month"\)\);\n\s*const storeId = params\.get\("storeId"\);/);
  assert.match(viewCode, /const target = storeToOpen\(readLastStore\(storageOrNull\(\)\), data\.storeRows\);\n\s*if \(target\) router\.replace\(store360Href\(target, month\)\);/);
  assert.match(viewCode, /if \(row\) writeLastStore\(storageOrNull\(\), row\.storeId\);/);
  assert.match(viewCode, /const showPicker = !storeId \|\| picking \|\| notInScope;/);
  assert.match(viewCode, /<MetricsMonthSelect month=\{month\} \/>/);
  assert.doesNotMatch(viewCode, /stores\[0\]|resolveAuthorizedStoreId/, "never an arbitrary store");
  assert.doesNotMatch(viewCode, /type="date"/);
});

test("shared period picker supports Store 360 draft-only quick ranges without changing existing consumers", () => {
  const pickerCode = readFileSync(new URL("../src/components/date-range/unified-period-picker.tsx", import.meta.url), "utf8");
  assert.match(pickerCode, /defaultOpen\?: boolean/);
  assert.match(pickerCode, /deferQuickRanges\?: boolean/);
  assert.match(pickerCode, /showOutsideQuickRanges\?: boolean/);
  assert.match(pickerCode, /if \(deferQuickRanges\)/);
  assert.match(pickerCode, /showOutsideQuickRanges &&/);
});

test("Store 360 bootstrap validates URL stores and falls back only to an authorized store", () => {
  const stores = [{ id: "authorized-1" }, { id: "authorized-2" }];
  assert.equal(resolveAuthorizedStoreId("authorized-2", stores), "authorized-2");
  assert.equal(resolveAuthorizedStoreId("missing", stores), "authorized-1");
  assert.equal(resolveAuthorizedStoreId("", stores), "authorized-1");
  assert.equal(resolveAuthorizedStoreId("missing", []), "");
});

test("Store 360 bootstrap timeout rejects instead of leaving the opening screen forever", async () => {
  await assert.rejects(withStore360Timeout(new Promise(() => undefined), 5), /took too long/);
  assert.equal(await withStore360Timeout(Promise.resolve("ready"), 50), "ready");
  // The monthly view loads through the metrics layer (no bootstrap timeout); the helper still serves
  // the unlinked /store-360/response and /store-360/customer-voice routes.
  assert.match(readFileSync(new URL("../src/app/store-360/response/response-view.tsx", import.meta.url), "utf8"), /withStore360Timeout/);
});
