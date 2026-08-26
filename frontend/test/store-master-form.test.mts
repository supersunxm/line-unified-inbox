import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { CreateLineOaInput, StoreMasterSuggestion } from "../src/types/api.ts";
import {
  applyStoreMasterSelection,
  clearStoreMasterSelection,
  shouldShowNoMasterMatch,
  startDebouncedStoreMasterSearch,
  synchronizedStoreMasterData,
} from "../src/app/store-master-form.ts";

const master: StoreMasterSuggestion = {
  id: "master-42",
  accountName: "OPPO Central",
  storeName: "Central Store",
  externalStoreId: "S-0042",
  province: "Bangkok",
  region: "Central",
  lineId: "@oppocentral",
  lineOaLink: "https://line.me/R/ti/p/@oppocentral",
  lineManagerUrl: "https://manager.line.biz/account/@oppocentral",
  googleMapsUrl: "https://maps.app.goo.gl/central",
  matchScore: 1,
  matchReason: "EXACT_ACCOUNT_NAME",
  dataQualityStatus: "COMPLETE",
  existingStore: { id: "store-42", name: "Central Store" },
};

const credentials: CreateLineOaInput = {
  name: "Manual OA",
  channelSecret: "secret-value",
  channelAccessToken: "token-value",
  isActive: true,
};

test("Store Master search uses the account-name search endpoint", () => {
  const api = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(api, /searchStoreMaster[\s\S]*store-master\/search/);
  assert.match(api, /store-master\/search\?q=\$\{encodeURIComponent\(query\)\}/);
  assert.match(page, /value=\{searchQuery\}[\s\S]*setSearchQuery\(nextQuery\)/);
  assert.match(page, /useEffect\([\s\S]*api\.searchStoreMaster\(query, 10\)/);
});

test("typing lam calls api.searchStoreMaster with limit 10 after debounce", async () => {
  const calls: Array<[string, number]> = [];
  const states: string[] = [];
  const api = {
    searchStoreMaster: async (query: string, limit: number) => {
      calls.push([query, limit]);
      return [master];
    },
  };
  await new Promise<void>((resolve, reject) => {
    startDebouncedStoreMasterSearch({
      query: " lam ",
      delay: 5,
      search: (query) => api.searchStoreMaster(query, 10),
      onLoading: () => states.push("loading"),
      onSuccess: (_query, results) => { states.push(`results:${results.length}`); resolve(); },
      onError: reject,
    });
  });
  assert.deepEqual(calls, [["lam", 10]]);
  assert.deepEqual(states, ["loading", "results:1"]);
});

test("empty input remains idle and never calls Store Master search", async () => {
  let called = false;
  startDebouncedStoreMasterSearch({
    query: "   ",
    delay: 1,
    search: async () => { called = true; return []; },
    onLoading: () => { called = true; },
    onSuccess: () => { called = true; },
    onError: () => { called = true; },
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(called, false);
});

test("successful empty response is distinct from an API error", async () => {
  const emptyStates: string[] = [];
  await new Promise<void>((resolve, reject) => {
    startDebouncedStoreMasterSearch({
      query: "missing",
      delay: 1,
      search: async () => [],
      onLoading: () => emptyStates.push("loading"),
      onSuccess: (query, results) => {
        emptyStates.push("empty-success");
        assert.equal(shouldShowNoMasterMatch({ query, completedQuery: query, loading: false, hasSelection: false, resultCount: results.length, hasError: false }), true);
        resolve();
      },
      onError: reject,
    });
  });
  assert.deepEqual(emptyStates, ["loading", "empty-success"]);

  const errorStates: string[] = [];
  await new Promise<void>((resolve) => {
    startDebouncedStoreMasterSearch({
      query: "failure",
      delay: 1,
      search: async () => { throw new Error("API unavailable"); },
      onLoading: () => errorStates.push("loading"),
      onSuccess: () => errorStates.push("success"),
      onError: () => { errorStates.push("error"); resolve(); },
    });
  });
  assert.deepEqual(errorStates, ["loading", "error"]);
});

test("selecting a suggestion fills all supported fields and Store Master identifiers", () => {
  const selected = applyStoreMasterSelection(credentials, master);
  assert.equal(selected.storeMasterId, master.id);
  assert.equal(selected.storeId, master.existingStore?.id);
  assert.equal(selected.name, master.accountName);
  assert.equal(selected.basicId, master.lineId);
  assert.equal(selected.newStore, undefined);
  assert.deepEqual(synchronizedStoreMasterData(master), {
    storeId: "S-0042",
    storeName: "Central Store",
    accountName: "OPPO Central",
    lineId: "@oppocentral",
    province: "Bangkok",
    region: "Central",
    lineOaLink: master.lineOaLink,
    lineManagerUrl: master.lineManagerUrl,
    googleMapsUrl: master.googleMapsUrl,
  });
});

test("editing credentials preserves the selected Store Master payload", () => {
  const selected = applyStoreMasterSelection(credentials, master);
  const edited = { ...selected, channelSecret: "replacement-secret", channelAccessToken: "replacement-token" };
  assert.equal(edited.storeMasterId, master.id);
  assert.equal(edited.storeId, master.existingStore?.id);
});

test("manual fallback removes Store Master identifiers and keeps entered credentials", () => {
  const manual = clearStoreMasterSelection(applyStoreMasterSelection(credentials, master));
  assert.equal(manual.storeMasterId, undefined);
  assert.equal(manual.storeId, undefined);
  assert.equal(manual.channelSecret, credentials.channelSecret);
  assert.equal(manual.channelAccessToken, credentials.channelAccessToken);
});

test("no-match state appears only after the current search completes", () => {
  const base = { query: "OPPO", loading: false, hasSelection: false, resultCount: 0, hasError: false };
  assert.equal(shouldShowNoMasterMatch({ ...base, completedQuery: null }), false);
  assert.equal(shouldShowNoMasterMatch({ ...base, completedQuery: "OLD" }), false);
  assert.equal(shouldShowNoMasterMatch({ ...base, completedQuery: "OPPO", loading: true }), false);
  assert.equal(shouldShowNoMasterMatch({ ...base, completedQuery: "OPPO" }), true);
});

test("synchronized card has explicit readable light and dark theme tokens", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  for (const token of ["--synced-card-background", "--synced-card-border", "--synced-link"]) {
    assert.match(css, new RegExp(`:root[\\s\\S]*${token}:`));
    assert.match(css, new RegExp(`html\\[data-theme="dark"\\][\\s\\S]*${token}:`));
  }
  assert.match(css, /\.store-master-sync-card/);
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /selectedMaster && synchronizedMaster/);
  assert.match(page, /syncedStoreMasterTitle/);
});
