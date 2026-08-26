import test from "node:test";
import assert from "node:assert/strict";
import {
  extractTemplateVariables,
  getStoreVariableValue,
  resolveTemplateVariables,
  validateTemplateVariables,
} from "./template-variable-resolver";

void test("extractTemplateVariables extracts unique variable names", () => {
  const template = "Visit {{store.name}} at {{store.googleMapsUrl}} or line {{store.lineId}}. Also {{store.name}}";
  const vars = extractTemplateVariables(template);
  assert.deepEqual(vars.sort(), ["store.googleMapsUrl", "store.lineId", "store.name"]);
});

void test("getStoreVariableValue extracts store properties and handles aliases", () => {
  const store = {
    storeName: "OPPO Brand Shop Central Rama 9",
    externalStoreId: "ST-1001",
    googleMapsUrl: "https://maps.app.goo.gl/abcdef123",
    lineId: "@oppo_rama9",
    province: "Bangkok",
    region: "Central",
  };

  assert.equal(getStoreVariableValue("store.googleMapsUrl", store), "https://maps.app.goo.gl/abcdef123");
  assert.equal(getStoreVariableValue("googleMapsUrl", store), "https://maps.app.goo.gl/abcdef123");
  assert.equal(getStoreVariableValue("store.name", store), "OPPO Brand Shop Central Rama 9");
  assert.equal(getStoreVariableValue("store.storeId", store), "ST-1001");
  assert.equal(getStoreVariableValue("store.externalStoreId", store), "ST-1001");
  assert.equal(getStoreVariableValue("store.lineId", store), "@oppo_rama9");
  assert.equal(getStoreVariableValue("store.province", store), "Bangkok");
});

void test("resolveTemplateVariables resolves {{store.googleMapsUrl}} and other variables correctly", () => {
  const store = {
    storeName: "OPPO Central World",
    googleMapsUrl: "https://maps.app.goo.gl/centralworld?utm_source=line",
    lineId: "@oppo_cw",
  };

  const template = "Store: {{store.name}} | Map: {{store.googleMapsUrl}} | LINE: {{store.lineId}}";
  const result = resolveTemplateVariables(template, store);
  assert.equal(
    result,
    "Store: OPPO Central World | Map: https://maps.app.goo.gl/centralworld?utm_source=line | LINE: @oppo_cw",
  );
});

void test("resolveTemplateVariables handles missing values by replacing with empty string", () => {
  const store = {
    storeName: "OPPO Central World",
    googleMapsUrl: null,
  };

  const template = "Map: {{store.googleMapsUrl}}";
  assert.equal(resolveTemplateVariables(template, store), "Map: ");
});

void test("validateTemplateVariables returns READY when googleMapsUrl exists and is valid HTTPS Google Maps URL", () => {
  const store = {
    storeName: "OPPO Store",
    googleMapsUrl: "https://maps.app.goo.gl/xyz987?entry=ttu",
  };

  const template = "Please navigate to {{store.googleMapsUrl}}";
  const validation = validateTemplateVariables(template, store);

  assert.equal(validation.status, "READY");
  assert.deepEqual(validation.missingVariables, []);
  assert.equal(validation.reason, undefined);
});

void test("validateTemplateVariables returns BLOCKED when googleMapsUrl is missing or null", () => {
  const store = {
    storeName: "OPPO Store",
    googleMapsUrl: null,
  };

  const template = "Location: {{store.googleMapsUrl}}";
  const validation = validateTemplateVariables(template, store);

  assert.equal(validation.status, "BLOCKED");
  assert.deepEqual(validation.missingVariables, ["store.googleMapsUrl"]);
  assert.match(validation.reason ?? "", /Missing Google Maps URL/);
});

void test("validateTemplateVariables returns BLOCKED when googleMapsUrl is invalid or non-HTTPS/non-Google Maps", () => {
  const store = {
    storeName: "OPPO Store",
    googleMapsUrl: "http://maps.google.com/test", // HTTP not allowed
  };

  const template = "Location: {{store.googleMapsUrl}}";
  const validation = validateTemplateVariables(template, store);

  assert.equal(validation.status, "BLOCKED");
  assert.deepEqual(validation.missingVariables, ["store.googleMapsUrl"]);
  assert.match(validation.reason ?? "", /Missing Google Maps URL/);
});

void test("validateTemplateVariables handles multiple variables with mixed status", () => {
  const store = {
    storeName: "OPPO Store",
    googleMapsUrl: null,
    province: null,
  };

  const template = "Visit {{store.name}} in {{store.province}} at {{store.googleMapsUrl}}";
  const validation = validateTemplateVariables(template, store);

  assert.equal(validation.status, "BLOCKED");
  assert.ok(validation.missingVariables.includes("store.googleMapsUrl"));
  assert.ok(validation.missingVariables.includes("store.province"));
});
