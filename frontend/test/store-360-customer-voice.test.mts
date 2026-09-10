import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const viewCode = readFileSync(new URL("../src/app/store-360/store-360-view.tsx", import.meta.url), "utf8");
const panelCode = readFileSync(new URL("../src/app/store-360/customer-voice-panel.tsx", import.meta.url), "utf8");
const apiCode = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const typeCode = readFileSync(new URL("../src/types/api.ts", import.meta.url), "utf8");

test("Store 360 loads Customer Voice with the selected period and previous comparison", () => {
  assert.match(apiCode, /storeInsightsCustomerVoice:/);
  assert.match(apiCode, /\/customer-voice/);
  assert.match(viewCode, /api\.storeInsightsCustomerVoice\(activeStoreId, \{ from, to, \.\.\.compare \}\)/);
  assert.match(viewCode, /customerVoiceRequestId/);
  assert.match(viewCode, /if \(requestId === customerVoiceRequestId\.current\) setCustomerVoice\(value\)/);
  assert.match(viewCode, /<CustomerVoicePanel data=\{customerVoice\}/);
});

test("Customer Voice has honest no-analysis UI and real coverage/ranked values", () => {
  assert.match(panelCode, /Customer Voice analysis not available yet/);
  assert.match(panelCode, /coverage\.classifiedConversations/);
  assert.match(panelCode, /data\.topTopics/);
  assert.match(panelCode, /data\.topIntents/);
  assert.match(panelCode, /data\.topProducts/);
  assert.match(panelCode, /onTopicSelect\(item\.label\)/);
  assert.doesNotMatch(panelCode, /mock|faker|Math\.random/);
});

test("Customer Voice topic clicks use the existing Conversation Explorer query", () => {
  assert.match(viewCode, /customerVoiceTopic: customerVoiceTopic \?\? undefined/);
  assert.match(viewCode, /customerVoiceTopic &&/);
  assert.match(viewCode, /setCustomerVoiceTopic\(nextTopic\)/);
  assert.match(typeCode, /export type StoreInsightsCustomerVoice/);
  assert.match(typeCode, /StoreInsightsCustomerVoiceCoverage/);
});
