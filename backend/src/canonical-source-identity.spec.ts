import assert from "node:assert/strict";
import test from "node:test";
import { canonicalSourceIds, isCompatibleHistoricalDuplicate } from "./canonical-source-identity";
const at = new Date("2026-09-04T12:41:33.423Z");
const historical = { sourceEventId: "source-1", direction: "OUTBOUND", sentAt: at, text: "Staff reply" };
const canonical = { externalMessageId: "app-generated-id", rawPayload: { providerMessageId: "source-1" }, messageType: "TEXT", direction: "OUTBOUND", sentAt: new Date(at.getTime() + 82), text: "Staff reply" };
void test("durable provider and Manager identities normalize without reading other payload fields", () => {
  assert.deepEqual(canonicalSourceIds({ externalMessageId: "line-chat-manager:source-1", rawPayload: { providerMessageId: "source-1", managerMessageId: "source-2" } }), ["source-1", "source-2"]);
});
void test("proven provider identity with sub-second drift suppresses Historical duplicate", () => assert.equal(isCompatibleHistoricalDuplicate(canonical, historical), true));
void test("same text and time without durable identity is not a duplicate", () => assert.equal(isCompatibleHistoricalDuplicate({ ...canonical, rawPayload: {} }, historical), false));
void test("payload and direction conflict are never suppressed", () => {
  assert.equal(isCompatibleHistoricalDuplicate({ ...canonical, text: "Other" }, historical), false);
  assert.equal(isCompatibleHistoricalDuplicate({ ...canonical, direction: "INBOUND" }, historical), false);
});
void test("timestamp drift outside proven one-second boundary remains separate", () => assert.equal(isCompatibleHistoricalDuplicate({ ...canonical, sentAt: new Date(at.getTime() + 1001) }, historical), false));
void test("non-text identity is not suppressed", () => assert.equal(isCompatibleHistoricalDuplicate({ ...canonical, messageType: "IMAGE" }, historical), false));
void test("malformed payload is ignored", () => assert.deepEqual(canonicalSourceIds({ rawPayload: { providerMessageId: 1, managerMessageId: [] } }), []));
