import assert from "node:assert/strict";
import test from "node:test";
import type { MassMessageItem } from "./mass-message/mass-message.types";
import {
  assessPurchaseBroadcastQuota,
  buildPurchaseBroadcastSendFingerprint,
} from "./purchase-broadcast-safe-send.service";

const messages: MassMessageItem[] = [
  { type: "text", text: "Hello selected audience" },
];

const refs = [
  {
    customerId: "customer-2",
    conversationId: "conversation-2",
    storeId: "store-2",
    lineOfficialAccountId: "oa-2",
  },
  {
    customerId: "customer-1",
    conversationId: "conversation-1",
    storeId: "store-1",
    lineOfficialAccountId: "oa-1",
  },
];

test("selected send fingerprint is stable across recipient ordering", () => {
  const first = buildPurchaseBroadcastSendFingerprint({
    campaignId: "campaign-1",
    title: "Campaign",
    messages,
    recipientRefs: refs,
  });
  const second = buildPurchaseBroadcastSendFingerprint({
    campaignId: "campaign-1",
    title: "Campaign",
    messages,
    recipientRefs: [...refs].reverse(),
  });
  assert.equal(first, second);
});

test("selected send fingerprint changes when reviewed content changes", () => {
  const first = buildPurchaseBroadcastSendFingerprint({
    campaignId: "campaign-1",
    title: "Campaign",
    messages,
    recipientRefs: refs,
  });
  const second = buildPurchaseBroadcastSendFingerprint({
    campaignId: "campaign-1",
    title: "Campaign",
    messages: [{ type: "text", text: "Changed" }],
    recipientRefs: refs,
  });
  assert.notEqual(first, second);
});

test("limited LINE quota fails closed when remaining messages are insufficient", () => {
  const result = assessPurchaseBroadcastQuota(
    { type: "limited", value: 1000 },
    950,
    60,
  );
  assert.equal(result.safe, false);
  assert.equal(result.remaining, 50);
  assert.equal(result.required, 60);
});

test("limited LINE quota passes when remaining messages cover the exact audience", () => {
  const result = assessPurchaseBroadcastQuota(
    { type: "limited", value: 1000 },
    940,
    60,
  );
  assert.equal(result.safe, true);
  assert.equal(result.remaining, 60);
});

test("LINE quota type none is allowed while still reporting current usage", () => {
  const result = assessPurchaseBroadcastQuota({ type: "none" }, 321, 50);
  assert.equal(result.safe, true);
  assert.equal(result.type, "NONE");
  assert.equal(result.usage, 321);
  assert.equal(result.remaining, null);
});
