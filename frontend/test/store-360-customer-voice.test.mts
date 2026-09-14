import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const viewCode = readFileSync(new URL("../src/app/store-360/store-360-view.tsx", import.meta.url), "utf8");
const panelCode = readFileSync(new URL("../src/app/store-360/customer-voice-panel.tsx", import.meta.url), "utf8");
const drilldownCode = readFileSync(new URL("../src/app/store-360/customer-voice/customer-voice-view.tsx", import.meta.url), "utf8");
const drilldownPageCode = readFileSync(new URL("../src/app/store-360/customer-voice/page.tsx", import.meta.url), "utf8");
const utilsCode = readFileSync(new URL("../src/app/store-360/customer-voice-utils.ts", import.meta.url), "utf8");
const apiCode = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const typeCode = readFileSync(new URL("../src/types/api.ts", import.meta.url), "utf8");

test("Store 360 loads Customer Voice with the selected period and previous comparison", () => {
  assert.match(apiCode, /storeInsightsCustomerVoice:/);
  assert.match(apiCode, /\/customer-voice/);
  assert.match(viewCode, /api\.storeInsightsCustomerVoice\(activeStoreId, \{ from, to, \.\.\.compare \}\)/);
  assert.match(viewCode, /customerVoiceRequestId/);
  assert.match(viewCode, /if \(requestId === customerVoiceRequestId\.current\) setCustomerVoice\(value\)/);
  assert.match(viewCode, /<CustomerVoicePanel data=\{customerVoice\} loading=\{customerVoiceLoading\} error=\{customerVoiceError\} storeId=\{activeStoreId\} from=\{from\} to=\{to\}/);
});

test("Customer Voice has honest no-analysis UI and real coverage/ranked values", () => {
  assert.match(panelCode, /Customer Voice analysis not available yet/);
  assert.match(panelCode, /coverage\.classifiedConversations/);
  assert.match(panelCode, /data\.topTopics/);
  assert.match(panelCode, /data\.topIntents/);
  assert.match(panelCode, /data\.topProducts/);
  assert.doesNotMatch(panelCode, /mock|faker|Math\.random/);
  assert.match(panelCode, /Customer Voice is temporarily unavailable/);
  assert.match(viewCode, /setCustomerVoiceError/);
});

test("Customer Voice Overview links to the protected drill-down dimensions", () => {
  assert.match(panelCode, /Customer Voice/);
  assert.match(panelCode, /Explore/);
  assert.match(panelCode, /customerVoiceDrilldownHref/);
  assert.match(panelCode, /dimension=\{tab === "topics" \? "topic" : tab === "intents" \? "intent" : "product"\}/);
  assert.match(utilsCode, /store-360\/customer-voice/);
  assert.match(drilldownPageCode, /CustomerVoiceDrilldownView/);
  assert.match(drilldownCode, /useSearchParams/);
  assert.match(drilldownCode, /responseStatus/);
  assert.match(drilldownCode, /salesTagged/);
  assert.match(drilldownCode, /unclassified/);
  assert.match(drilldownCode, /hasNextPage/);
  assert.match(drilldownCode, /\/chats\?storeId=/);
  assert.match(typeCode, /export type StoreInsightsCustomerVoice/);
  assert.match(typeCode, /StoreInsightsCustomerVoiceCoverage/);
  assert.match(typeCode, /StoreInsightsCustomerVoiceDrilldownResponse/);
  assert.match(apiCode, /customer-voice\/cases/);
});
