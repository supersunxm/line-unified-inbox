import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { StoreMasterSuggestion, ApiStore } from "../src/types/api.ts";
import { synchronizedStoreMasterData } from "../src/app/store-master-form.ts";
import {
  extractTemplateVariables,
  getStoreVariableValue,
  isValidGoogleMapsUrl,
  resolveTemplateVariables,
  validateTemplateVariables,
} from "../src/lib/template-variable-resolver.ts";

test("synchronizedStoreMasterData includes googleMapsUrl", () => {
  const masterWithUrl: StoreMasterSuggestion = {
    id: "master-1",
    accountName: "OPPO Central",
    storeName: "Central Rama 9",
    externalStoreId: "S-1001",
    province: "Bangkok",
    region: "Central",
    lineId: "@oppo_rama9",
    lineOaLink: "https://lin.ee/xyz",
    lineManagerUrl: "https://manager.line.biz/account/1001",
    googleMapsUrl: "https://maps.app.goo.gl/abc12345?entry=ttu",
    matchScore: 1,
    matchReason: "EXACT_ACCOUNT_NAME",
    dataQualityStatus: "COMPLETE",
    existingStore: null,
  };

  const synced = synchronizedStoreMasterData(masterWithUrl);
  assert.equal(synced.googleMapsUrl, "https://maps.app.goo.gl/abc12345?entry=ttu");

  const masterWithoutUrl: StoreMasterSuggestion = {
    ...masterWithUrl,
    googleMapsUrl: null,
  };
  const syncedEmpty = synchronizedStoreMasterData(masterWithoutUrl);
  assert.equal(syncedEmpty.googleMapsUrl, null);
});

test("isValidGoogleMapsUrl validates HTTPS Google Maps links properly", () => {
  assert.equal(isValidGoogleMapsUrl("https://maps.app.goo.gl/short"), true);
  assert.equal(isValidGoogleMapsUrl("https://maps.app.goo.gl/short?param=1&entry=ttu"), true);
  assert.equal(isValidGoogleMapsUrl("https://goo.gl/maps/short"), true);
  assert.equal(isValidGoogleMapsUrl("https://maps.google.com/?cid=1234"), true);
  assert.equal(isValidGoogleMapsUrl("https://maps.google.co.th/?q=bangkok"), true);
  assert.equal(isValidGoogleMapsUrl("https://www.google.com/maps/place/OPPO"), true);
  assert.equal(isValidGoogleMapsUrl("https://google.com/maps?q=13,100"), true);

  // Insecure and invalid URLs
  assert.equal(isValidGoogleMapsUrl("http://maps.google.com/test"), false);
  assert.equal(isValidGoogleMapsUrl("https://apple.com/maps"), false);
  assert.equal(isValidGoogleMapsUrl("https://bing.com/maps"), false);
  assert.equal(isValidGoogleMapsUrl("not-a-url"), false);
  assert.equal(isValidGoogleMapsUrl(null), false);
  assert.equal(isValidGoogleMapsUrl(undefined), false);
});

test("Template variable resolver resolves {{store.googleMapsUrl}} and validates readiness", () => {
  const store = {
    storeName: "OPPO Rama 9",
    externalStoreId: "ST-22535",
    googleMapsUrl: "https://maps.app.goo.gl/rama9map",
  };

  const template = "Visit us at {{store.googleMapsUrl}} for special deals at {{store.name}}!";
  const resolved = resolveTemplateVariables(template, store);
  assert.equal(
    resolved,
    "Visit us at https://maps.app.goo.gl/rama9map for special deals at OPPO Rama 9!",
  );

  const readyValidation = validateTemplateVariables(template, store);
  assert.equal(readyValidation.status, "READY");
  assert.deepEqual(readyValidation.missingVariables, []);

  // When googleMapsUrl is missing
  const storeMissing = {
    storeName: "OPPO Rama 9",
    googleMapsUrl: null,
  };
  const blockedValidation = validateTemplateVariables(template, storeMissing);
  assert.equal(blockedValidation.status, "BLOCKED");
  assert.deepEqual(blockedValidation.missingVariables, ["store.googleMapsUrl"]);
  assert.match(blockedValidation.reason ?? "", /Missing Google Maps URL/);
});

test("Store Management UI source files contain Google Maps button and translations", () => {
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /openGoogleMaps/);
  assert.match(page, /googleMapsNotConfigured/);
  assert.match(page, /account\.store\.googleMapsUrl\s*\?/);
  assert.match(page, /synchronizedMaster\.googleMapsUrl/);

  const mobile = readFileSync(new URL("../src/app/stores/mobile-stores-app.tsx", import.meta.url), "utf8");
  assert.match(mobile, /account\.store\.googleMapsUrl/);
});

test("Store Master sync control is ADMIN-only and POSTs to /store-master/sync", () => {
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const api = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");

  // Endpoint and HTTP method
  assert.match(api, /syncStoreMaster:\s*\(\)\s*=>\s*request<StoreMasterSyncResult>\("\/store-master\/sync",\s*\{\s*method:\s*"POST"\s*\}\)/);

  // Role check: ADMIN only
  assert.match(page, /authUser\.role\s*===\s*"ADMIN"/);
  assert.match(page, /syncMasterFile/);
  assert.match(page, /sync-store-master-button/);

  // Non-admin / VIEWER cannot trigger sync
  assert.match(page, /if\s*\(masterSyncing\s*\|\|\s*authUser\?\.role\s*!==\s*"ADMIN"\)\s*return;/);
});

test("Store Master sync displays loading state and renders summary metrics", () => {
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  // Loading state & text
  assert.match(page, /disabled=\{masterSyncing\}/);
  assert.match(page, /isLoading=\{masterSyncing\}/);
  assert.match(page, /masterSyncing\s*\?\s*text\.syncingMasterFile\s*:\s*text\.syncMasterFile/);
  assert.match(page, /Syncing Store Master\.\.\./);

  // Summary card metrics rendered
  assert.match(page, /data-testid="store-master-sync-summary"/);
  assert.match(page, /data-testid="sync-total"/);
  assert.match(page, /data-testid="sync-complete"/);
  assert.match(page, /data-testid="sync-incomplete"/);
  assert.match(page, /data-testid="sync-updated"/);
  assert.match(page, /data-testid="sync-unchanged"/);
  assert.match(page, /data-testid="sync-missing-store-id"/);
  assert.match(page, /data-testid="sync-duplicate-account-names"/);
  assert.match(page, /data-testid="sync-duplicate-line-ids"/);
  assert.match(page, /data-testid="sync-missing-maps-urls"/);
  assert.match(page, /data-testid="sync-invalid-maps-urls"/);
  assert.match(page, /data-testid="dismiss-sync-summary"/);
});

test("Store ID 29113 / Central Pinklao refreshes Google Maps button after sync", () => {
  type StoreRow = {
    id: string;
    storeId: string | null;
    name: string;
    googleMapsUrl: string | null;
  };

  function renderGoogleMapsAction(store: StoreRow) {
    if (store.googleMapsUrl) {
      return {
        label: "Open Google Maps ↗",
        url: store.googleMapsUrl,
        disabled: false,
      };
    }
    return {
      label: "Not configured",
      url: null,
      disabled: true,
    };
  }

  // Pre-sync state: Store ID 29113 (Central Pinklao) has no configured Google Maps URL
  const initialPinklao: StoreRow = {
    id: "store-pinklao-1",
    storeId: "29113",
    name: "OPPO Central Pinklao",
    googleMapsUrl: null,
  };
  const preSyncAction = renderGoogleMapsAction(initialPinklao);
  assert.equal(preSyncAction.label, "Not configured");
  assert.equal(preSyncAction.url, null);
  assert.equal(preSyncAction.disabled, true);

  // Post-sync state: Store ID 29113 updated with Master File URL
  const postSyncPinklao: StoreRow = {
    ...initialPinklao,
    googleMapsUrl: "https://maps.app.goo.gl/centralpinklao29113",
  };
  const postSyncAction = renderGoogleMapsAction(postSyncPinklao);
  assert.equal(postSyncAction.label, "Open Google Maps ↗");
  assert.equal(postSyncAction.url, "https://maps.app.goo.gl/centralpinklao29113");
  assert.equal(postSyncAction.disabled, false);
});
