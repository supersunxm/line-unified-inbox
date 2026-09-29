import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeReplyEvidenceWindow,
  classifyReplyProjectionEligibility,
} from "./reply-state-evidence-window";
import {
  normalizeCanonicalReplyMessage,
  type CanonicalReplyMessage,
} from "./reply-state-resolver";

const boundary = new Date("2026-08-31T17:00:00.000Z");

function canonical(
  id: string,
  direction: "INBOUND" | "OUTBOUND" | "SYSTEM",
  sentAt: string,
  overrides: Partial<CanonicalReplyMessage> = {},
): CanonicalReplyMessage {
  return {
    id,
    externalMessageId: "evt-" + id,
    direction,
    deliveryStatus: "DELIVERED",
    originalText: id,
    sentAt: new Date(sentAt),
    senderUserId: direction === "OUTBOUND" ? "staff-1" : null,
    senderDisplayName: direction === "OUTBOUND" ? "BM One" : null,
    ...overrides,
  };
}

void test("classifies a conversation whose relevant evidence is entirely before Sep 1 Bangkok", () => {
  const events = [
    canonical("1", "INBOUND", "2026-08-31T10:00:00Z"),
    canonical("2", "OUTBOUND", "2026-08-31T10:05:00Z"),
  ].map(normalizeCanonicalReplyMessage);

  const result = analyzeReplyEvidenceWindow(events, boundary);

  assert.equal(result.hasRelevantMessageBeforeBoundary, true);
  assert.equal(result.hasRelevantMessageOnOrAfterBoundary, false);
  assert.equal(result.latestCustomerInboundOnOrAfterBoundary, false);
  assert.equal(result.latestHumanStaffReplyOnOrAfterBoundary, false);
});

void test("customer inbound exactly at Sep 1 Bangkok is inside the trusted evidence window", () => {
  const events = [
    canonical("1", "INBOUND", "2026-08-31T17:00:00Z"),
  ].map(normalizeCanonicalReplyMessage);

  const result = analyzeReplyEvidenceWindow(events, boundary);

  assert.equal(result.latestCustomerInboundAt?.toISOString(), "2026-08-31T17:00:00.000Z");
  assert.equal(result.latestCustomerInboundOnOrAfterBoundary, true);
  assert.equal(result.hasRelevantMessageOnOrAfterBoundary, true);
});

void test("older open cycle with a newer September customer message is still post-boundary evidence", () => {
  const events = [
    canonical("1", "INBOUND", "2026-08-30T10:00:00Z"),
    canonical("2", "INBOUND", "2026-09-02T10:00:00Z"),
  ].map(normalizeCanonicalReplyMessage);

  const result = analyzeReplyEvidenceWindow(events, boundary);

  assert.equal(result.hasRelevantMessageBeforeBoundary, true);
  assert.equal(result.hasRelevantMessageOnOrAfterBoundary, true);
  assert.equal(result.latestCustomerInboundOnOrAfterBoundary, true);
});

void test("post-boundary staff reply is tracked independently from customer activity", () => {
  const events = [
    canonical("1", "INBOUND", "2026-08-31T10:00:00Z"),
    canonical("2", "OUTBOUND", "2026-09-01T10:00:00Z"),
  ].map(normalizeCanonicalReplyMessage);

  const result = analyzeReplyEvidenceWindow(events, boundary);

  assert.equal(result.latestCustomerInboundOnOrAfterBoundary, false);
  assert.equal(result.latestHumanStaffReplyOnOrAfterBoundary, true);
  assert.equal(result.latestHumanStaffReplyAt?.toISOString(), "2026-09-01T10:00:00.000Z");
});

void test("system events do not count as relevant reply evidence", () => {
  const events = [
    canonical("1", "SYSTEM", "2026-09-02T10:00:00Z"),
  ].map(normalizeCanonicalReplyMessage);

  const result = analyzeReplyEvidenceWindow(events, boundary);

  assert.equal(result.firstRelevantMessageAt, null);
  assert.equal(result.latestRelevantMessageAt, null);
  assert.equal(result.hasRelevantMessageOnOrAfterBoundary, false);
});


void test("NOT_REPLIED projects only when the latest customer inbound is on or after the boundary", () => {
  const trusted = analyzeReplyEvidenceWindow([
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
  ].map(normalizeCanonicalReplyMessage), boundary);
  const legacy = analyzeReplyEvidenceWindow([
    canonical("2", "INBOUND", "2026-08-31T10:00:00Z"),
  ].map(normalizeCanonicalReplyMessage), boundary);

  assert.deepEqual(
    classifyReplyProjectionEligibility("NOT_REPLIED", trusted),
    {
      eligible: true,
      state: "NOT_REPLIED",
      reason: "DECIDING_EVENT_ON_OR_AFTER_BOUNDARY",
    },
  );
  assert.deepEqual(
    classifyReplyProjectionEligibility("NOT_REPLIED", legacy),
    {
      eligible: false,
      reason: "PRE_BOUNDARY_DECIDING_EVENT",
    },
  );
});

void test("REPLIED projects only when the latest human reply is on or after the boundary", () => {
  const trusted = analyzeReplyEvidenceWindow([
    canonical("1", "INBOUND", "2026-08-31T10:00:00Z"),
    canonical("2", "OUTBOUND", "2026-09-01T10:00:00Z"),
  ].map(normalizeCanonicalReplyMessage), boundary);
  const legacy = analyzeReplyEvidenceWindow([
    canonical("3", "INBOUND", "2026-08-31T09:00:00Z"),
    canonical("4", "OUTBOUND", "2026-08-31T10:00:00Z"),
  ].map(normalizeCanonicalReplyMessage), boundary);

  assert.equal(classifyReplyProjectionEligibility("REPLIED", trusted).eligible, true);
  assert.deepEqual(
    classifyReplyProjectionEligibility("REPLIED", legacy),
    {
      eligible: false,
      reason: "PRE_BOUNDARY_DECIDING_EVENT",
    },
  );
});

void test("AMBIGUOUS is never eligible for projection", () => {
  const window = analyzeReplyEvidenceWindow([
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
  ].map(normalizeCanonicalReplyMessage), boundary);

  assert.deepEqual(
    classifyReplyProjectionEligibility("AMBIGUOUS", window),
    {
      eligible: false,
      reason: "AMBIGUOUS",
    },
  );
});
