import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBroadcastStoreVariableContext,
  resolveBroadcastMessagesForStore,
  validateBroadcastMessageVariables,
} from "./broadcast-store-variables";

void test("broadcast variables resolve storeName and storeLocationText per store", () => {
  const context = buildBroadcastStoreVariableContext({
    store: {
      id: "store-1",
      name: "OBS Central Pinklao",
      area: "Central Pinklao",
      storeMaster: {
        storeName: "OPPO Brand Shop Central Pinklao",
        province: "Bangkok",
        externalStoreId: "29113",
      },
    },
    lineOfficialAccount: { name: "OPPO Central Pinklao" },
  });

  const result = resolveBroadcastMessagesForStore(
    [{ type: "text", text: "พบกันที่ {{storeName}} - {{storeLocationText}}" }],
    context,
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(
      result.messages[0]?.type === "text" ? result.messages[0].text : "",
      "พบกันที่ OPPO Brand Shop Central Pinklao - Central Pinklao",
    );
  }
});

void test("storeLocationText falls back to province when store area is unavailable", () => {
  const context = buildBroadcastStoreVariableContext({
    store: {
      name: "OBS Example",
      area: null,
      region: "Central",
      storeMaster: { province: "Bangkok" },
    },
  });

  assert.equal(context.storeLocationText, "Bangkok");
});

void test("missing optional storePhone or mallName blocks only stores without that data", () => {
  const context = buildBroadcastStoreVariableContext({
    store: { name: "OBS Example", storeMaster: { province: "Bangkok" } },
  });

  const validation = validateBroadcastMessageVariables(
    [{ type: "text", text: "{{storeName}} {{storePhone}} {{mallName}}" }],
    context,
  );

  assert.equal(validation.status, "BLOCKED");
  assert.deepEqual(validation.missingVariables.sort(), ["mallName", "storePhone"]);
});
