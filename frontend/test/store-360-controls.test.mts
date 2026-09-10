import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { filterStoreSearchOptions, storeSearchIdentifier } from "../src/app/store-360/store-search.ts";

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
  assert.match(comboboxCode, /max-h-72 overflow-y-auto/);
});

test("Store 360 keeps URL-backed selection and compact custom date inputs", () => {
  assert.match(viewCode, /<StoreSearchCombobox stores=\{stores\} selectedStoreId=\{activeStoreId\} onSelect=\{selectStore\}/);
  assert.match(viewCode, /setStoreId\(next\);[\s\S]*updateUrl\(next, from, to\);/);
  assert.match(viewCode, /preset === "custom"/);
  assert.match(viewCode, /aria-label="Custom start date"/);
  assert.match(viewCode, /aria-label="Custom end date"/);
  assert.match(viewCode, /max=\{todayInBangkok\(\)\}/);
  assert.match(viewCode, /updateCustomRange\(event\.target\.value, to\)/);
  assert.match(viewCode, /updateCustomRange\(from, event\.target\.value\)/);
  assert.match(viewCode, /comparisonMode === "previous" \? comparisonFor\(from, to\) : \{\}/);
  assert.match(viewCode, /summaryRequestId\.current \+= 1/);
  assert.match(viewCode, /conversationsRequestId\.current \+= 1/);
});
