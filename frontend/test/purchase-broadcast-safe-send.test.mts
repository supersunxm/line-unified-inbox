import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const safeSendCode = readFileSync(
  new URL("../src/app/mass-messages/purchase-broadcast-safe-send.tsx", import.meta.url),
  "utf8",
);
const composerRouteCode = readFileSync(
  new URL("../src/app/mass-messages/drafts/[campaignId]/page.tsx", import.meta.url),
  "utf8",
);
const reviewRouteCode = readFileSync(
  new URL("../src/app/mass-messages/drafts/[campaignId]/review/page.tsx", import.meta.url),
  "utf8",
);

test("composer links to a dedicated safe review route", () => {
  assert.match(composerRouteCode, /Review &amp; Send/);
  assert.match(composerRouteCode, /\/review/);
  assert.match(reviewRouteCode, /PurchaseBroadcastSafeSend/);
});

test("safe send runs server review before execution", () => {
  assert.match(safeSendCode, /\/review`/);
  assert.match(safeSendCode, /Run Safety Review/);
  assert.match(safeSendCode, /eligibleRecipientCount/);
  assert.match(safeSendCode, /excludedRecipientCount/);
  assert.match(safeSendCode, /quota/);
});

test("real delivery requires checkbox plus exact SEND confirmation", () => {
  assert.match(safeSendCode, /confirmationText === "SEND"/);
  assert.match(safeSendCode, /confirm: true/);
  assert.match(safeSendCode, /LINE monthly message quota may be consumed/);
  assert.match(safeSendCode, /Send to \$\{review\.audience\.eligibleRecipientCount\.toLocaleString\(\)\} customers/);
});

test("safe send status polling is isolated from composer save behavior", () => {
  assert.match(safeSendCode, /\/send-status/);
  assert.match(safeSendCode, /\/send`/);
  assert.doesNotMatch(safeSendCode, /api\.createMassMessage/);
});
