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
