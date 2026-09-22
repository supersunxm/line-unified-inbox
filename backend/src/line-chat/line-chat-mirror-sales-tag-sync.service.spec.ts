import assert from "node:assert/strict";
import test from "node:test";
import {
  configuredLineChatMirrorSalesTagStoreCodes,
  isLineChatMirrorSalesTagSyncApplyEnabled,
  isLineChatMirrorSalesTagSyncEnabled,
  lineChatMirrorSalesTagSyncBatchSize,
  lineChatMirrorSalesTagSyncIntervalMs,
} from "./line-chat-mirror-sales-tag-sync.service";

function withEnv(values: Record<string, string | undefined>, callback: () => void): void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("Manager nickname sales-tag sync is opt-in and apply is separately gated", () => {
  withEnv(
    {
      LINE_CHAT_MIRROR_SALES_TAG_SYNC_ENABLED: undefined,
      LINE_CHAT_MIRROR_SALES_TAG_SYNC_APPLY: undefined,
    },
    () => {
      assert.equal(isLineChatMirrorSalesTagSyncEnabled(), false);
      assert.equal(isLineChatMirrorSalesTagSyncApplyEnabled(), false);
    },
  );

  withEnv(
    {
      LINE_CHAT_MIRROR_SALES_TAG_SYNC_ENABLED: "true",
      LINE_CHAT_MIRROR_SALES_TAG_SYNC_APPLY: "false",
    },
    () => {
      assert.equal(isLineChatMirrorSalesTagSyncEnabled(), true);
      assert.equal(isLineChatMirrorSalesTagSyncApplyEnabled(), false);
    },
  );
});

test("Manager nickname sales-tag sync parses and deduplicates store scope", () => {
  withEnv(
    {
      LINE_CHAT_MIRROR_SALES_TAG_SYNC_STORE_CODES: "28375, 25610;28375 25389",
    },
    () => {
      assert.deepEqual(configuredLineChatMirrorSalesTagStoreCodes(), [
        "28375",
        "25610",
        "25389",
      ]);
    },
  );
});

test("Manager nickname sales-tag sync bounds interval and batch size", () => {
  withEnv(
    {
      LINE_CHAT_MIRROR_SALES_TAG_SYNC_INTERVAL_MS: "1000",
      LINE_CHAT_MIRROR_SALES_TAG_SYNC_BATCH_SIZE: "99999",
    },
    () => {
      assert.equal(lineChatMirrorSalesTagSyncIntervalMs(), 60_000);
      assert.equal(lineChatMirrorSalesTagSyncBatchSize(), 2_000);
    },
  );
});
