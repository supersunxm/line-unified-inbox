import assert from "node:assert/strict";
import test from "node:test";
import { shouldAnalyzeCustomerVoiceConversation } from "./customer-voice-versioning";

const lastAnalyzed = new Date("2026-09-10T10:00:00.000Z");
const currentVersion = "customer-voice-rules-v3";

test("historical v1 and v2 checkpoints are eligible for intentional v3 processing", () => {
  assert.equal(shouldAnalyzeCustomerVoiceConversation(lastAnalyzed, { analysisVersion: "customer-voice-rules-v1", lastAnalyzedMessageAt: lastAnalyzed }, currentVersion), true);
  assert.equal(shouldAnalyzeCustomerVoiceConversation(lastAnalyzed, { analysisVersion: "customer-voice-rules-v2", lastAnalyzedMessageAt: lastAnalyzed }, currentVersion), true);
});

test("a missing current-version checkpoint is eligible for processing", () => {
  assert.equal(shouldAnalyzeCustomerVoiceConversation(lastAnalyzed, undefined, currentVersion), true);
});

test("a current-version checkpoint is idempotent when no newer inbound message exists", () => {
  assert.equal(shouldAnalyzeCustomerVoiceConversation(lastAnalyzed, { analysisVersion: currentVersion, lastAnalyzedMessageAt: lastAnalyzed }, currentVersion), false);
});

test("a current-version checkpoint is stale when a newer inbound message exists", () => {
  assert.equal(shouldAnalyzeCustomerVoiceConversation(new Date("2026-09-10T10:00:01.000Z"), { analysisVersion: currentVersion, lastAnalyzedMessageAt: lastAnalyzed }, currentVersion), true);
});
