import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CUSTOMER_VOICE_MIN_COVERAGE, showCustomerVoice } from "../src/lib/metrics/store-view.ts";

// Owner decision 8 Oct 2026: the Customer Voice module left the Store 360 overview (4 of 935 chats were
// analysed, so it read 0%). The overview links to it only when ≥ 20% of the month's chats were
// classified; the drill-down route /store-360/customer-voice keeps working, unlinked otherwise.
const viewCode = readFileSync(new URL("../src/app/store-360/store-360-monthly.tsx", import.meta.url), "utf8");
const drilldownCode = readFileSync(new URL("../src/app/store-360/customer-voice/customer-voice-view.tsx", import.meta.url), "utf8");
const drilldownPageCode = readFileSync(new URL("../src/app/store-360/customer-voice/page.tsx", import.meta.url), "utf8");
const utilsCode = readFileSync(new URL("../src/app/store-360/customer-voice-utils.ts", import.meta.url), "utf8");
const apiCode = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const typeCode = readFileSync(new URL("../src/types/api.ts", import.meta.url), "utf8");

test("Store 360 shows Customer Voice only as a link, and only at ≥ 20% coverage", () => {
  assert.equal(CUSTOMER_VOICE_MIN_COVERAGE, 0.2);
  assert.equal(showCustomerVoice(4 / 935), false);
  assert.equal(showCustomerVoice(0.2), true);
  assert.equal(showCustomerVoice(null), false);
  assert.match(apiCode, /storeInsightsCustomerVoice:/);
  assert.match(viewCode, /\{showCustomerVoice\(voice\.data\) && \(\n\s*<p data-s360-customer-voice><Link href=\{`\/store-360\/customer-voice\?/);
  assert.doesNotMatch(viewCode, /CustomerVoicePanel|topTopics|topIntents/);
});

test("Customer Voice drill-down route keeps working (protected dimensions, chats link)", () => {
  assert.match(utilsCode, /store-360\/customer-voice/);
  assert.match(drilldownPageCode, /CustomerVoiceDrilldownView/);
  assert.match(drilldownCode, /useSearchParams/);
  assert.match(drilldownCode, /responseStatus/);
  assert.match(drilldownCode, /salesTagged/);
  assert.match(drilldownCode, /unclassified/);
  assert.match(drilldownCode, /notAnalyzed/);
  assert.match(drilldownCode, /window\.location\.assign/);
  assert.match(drilldownCode, /hasNextPage/);
  assert.match(drilldownCode, /\/chats\?storeId=/);
  assert.match(typeCode, /export type StoreInsightsCustomerVoice/);
  assert.match(typeCode, /StoreInsightsCustomerVoiceCoverage/);
  assert.match(typeCode, /StoreInsightsCustomerVoiceDrilldownResponse/);
  assert.match(apiCode, /customer-voice\/cases/);
});
