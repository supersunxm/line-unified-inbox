import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { filterStoreSearchOptions, getActiveOptionScrollTop, storeSearchIdentifier } from "../src/app/store-360/store-search.ts";

const viewCode = readFileSync(new URL("../src/app/store-360/store-360-view.tsx", import.meta.url), "utf8");
const comboboxCode = readFileSync(new URL("../src/app/store-360/store-search-combobox.tsx", import.meta.url), "utf8");

test("Store 360 store search filters long lists by name and Store ID", () => {
  const stores = Array.from({ length: 150 }, (_, index) => ({
    id: `internal-${index}`,
    storeId: `OPPO-${String(index).padStart(3, "0")}`,
    name: index === 117 ? "Robinson Ratchaphruek" : `Branch ${index}`,
    code: index === 42 ? "BKK-SPECIAL" : null,
  }));

  assert.deepEqual(filterStoreSearchOptions(stores, "robinson").map((store) => store.id), ["internal-117"]);
  assert.deepEqual(filterStoreSearchOptions(stores, "oppo-042").map((store) => store.id), ["internal-42"]);
  assert.deepEqual(filterStoreSearchOptions(stores, "bkk-special").map((store) => store.id), ["internal-42"]);
  assert.equal(filterStoreSearchOptions(stores, "missing").length, 0);
  assert.equal(filterStoreSearchOptions(stores, "").length, 150);
  assert.equal(storeSearchIdentifier(stores[42]), "OPPO-042");
});

test("Store 360 active-option scrolling changes only the result container scrollTop", () => {
  assert.equal(getActiveOptionScrollTop(100, 200, 500, 220, 260), 100);
  assert.equal(getActiveOptionScrollTop(100, 200, 500, 150, 260), 50);
  assert.equal(getActiveOptionScrollTop(100, 200, 500, 450, 540), 140);
});

test("Store 360 combobox exposes accessible search and keyboard interactions", () => {
  assert.match(comboboxCode, /role="combobox"/);
  assert.match(comboboxCode, /role="listbox"/);
  assert.match(comboboxCode, /aria-activedescendant=/);
  assert.match(comboboxCode, /event\.key === "ArrowDown"/);
  assert.match(comboboxCode, /event\.key === "ArrowUp"/);
  assert.match(comboboxCode, /event\.key === "Enter"/);
  assert.match(comboboxCode, /event\.key === "Escape"/);
  assert.match(comboboxCode, /Clear store search/);
  assert.match(comboboxCode, /No stores found/);
  assert.match(comboboxCode, /max-h-72 overflow-y-auto overscroll-contain/);
  assert.doesNotMatch(comboboxCode, /scrollIntoView/);
  assert.match(comboboxCode, /results\.scrollTop = getActiveOptionScrollTop/);
  assert.match(comboboxCode, /onWheel=\{\(event\) => event\.stopPropagation\(\)\}/);
});

test("Store 360 keeps URL-backed selection and shared custom date calendar", () => {
  assert.match(viewCode, /<StoreSearchCombobox stores=\{stores\} selectedStoreId=\{activeStoreId\} onSelect=\{selectStore\}/);
  assert.match(viewCode, /setStoreId\(next\);[\s\S]*updateUrl\(next, from, to\);/);
  assert.match(viewCode, /preset === "custom"/);
  assert.match(viewCode, /<UnifiedPeriodPicker dateFrom=\{from\} dateTo=\{to\} language=\{language\} defaultOpen=\{customPickerOpen\} deferQuickRanges showOutsideQuickRanges=\{false\}/);
  assert.doesNotMatch(viewCode, /preset === "custom"[\s\S]*type="date"/);
  assert.match(viewCode, /const applyCustomRange = \(nextFrom: string, nextTo: string\)/);
  assert.match(viewCode, /if \(next === "custom"\) \{[\s\S]*setCustomPickerOpen\(true\)/);
  assert.match(viewCode, /comparisonMode === "previous" \? comparisonFor\(from, to\) : \{\}/);
  assert.match(viewCode, /summaryRequestId\.current \+= 1/);
  assert.match(viewCode, /conversationsRequestId\.current \+= 1/);
});

test("shared period picker supports Store 360 draft-only quick ranges without changing existing consumers", () => {
  const pickerCode = readFileSync(new URL("../src/components/date-range/unified-period-picker.tsx", import.meta.url), "utf8");
  assert.match(pickerCode, /defaultOpen\?: boolean/);
  assert.match(pickerCode, /deferQuickRanges\?: boolean/);
  assert.match(pickerCode, /showOutsideQuickRanges\?: boolean/);
  assert.match(pickerCode, /if \(deferQuickRanges\)/);
  assert.match(pickerCode, /showOutsideQuickRanges &&/);
});
