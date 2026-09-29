import assert from "node:assert/strict";
import test from "node:test";
import { ReplyStateShadowService } from "./reply-state-shadow.service";
import type { PrismaService } from "./prisma.service";

function createPrisma(overrides: {
  conversation?: Record<string, unknown>;
  crosswalks?: Array<Record<string, unknown>>;
  directCandidates?: Array<{ id: string }>;
  directCrosswalk?: Record<string, unknown> | null;
  historical?: Array<Record<string, unknown>>;
}) {
  let findManyCall = 0;
  return {
    conversation: {
      findUnique: async () => overrides.conversation ?? null,
      findMany: async () => {
        findManyCall += 1;
        return findManyCall === 1 ? overrides.directCandidates ?? [] : [];
      },
    },
    historicalConversationCrosswalk: {
      findMany: async () => overrides.crosswalks ?? [],
      findFirst: async () => overrides.directCrosswalk ?? null,
    },
    historicalTimelineMessage: {
      findMany: async () => overrides.historical ?? [],
    },
  } as unknown as PrismaService;
}

const baseConversation = {
  id: "conversation-1",
  storeId: "store-1",
  lineOfficialAccountId: "oa-1",
  lineChatUserId: "chat-1",
  bmReplyStatus: "REPLIED",
  replyStateProjection: null,
  messages: [
    {
      id: "message-1",
      externalMessageId: "source-1",
      direction: "INBOUND",
      deliveryStatus: "DELIVERED",
      originalText: "hello",
      sentAt: new Date("2026-09-01T10:00:00Z"),
      senderUserId: null,
      senderDisplayName: null,
      rawPayload: {},
    },
  ],
};

void test("shadow resolver exposes stored and resolved state without write behavior", async () => {
  const service = new ReplyStateShadowService(createPrisma({
    conversation: baseConversation,
    directCandidates: [{ id: "conversation-1" }],
  }));

  const result = await service.resolveConversation("conversation-1");

  assert.equal(result.storedBmReplyStatus, "REPLIED");
  assert.equal(result.resolvedReplyState, "NOT_REPLIED");
  assert.equal(result.mismatch, true);
  assert.equal(result.confidence, "DETERMINISTIC");
  assert.equal(result.evidence.canonicalMessageCount, 1);
  assert.equal(result.evidence.historicalMessageCount, 0);
  assert.equal(result.evidence.historicalLinkMode, "NONE");
  assert.equal(result.databaseWrites, 0);
});

void test("shadow endpoint compares persisted projection with dynamic resolver", async () => {
  const service = new ReplyStateShadowService(createPrisma({
    conversation: {
      ...baseConversation,
      bmReplyStatus: "NOT_REPLIED",
      replyStateProjection: {
        state: "NOT_REPLIED",
        decidingEventKind: "CUSTOMER_INBOUND",
        decidingEventAt: new Date("2026-09-01T10:00:00Z"),
        evidenceBoundary: new Date("2026-08-31T17:00:00Z"),
        resolverVersion: "reply-state-v1",
        canonicalMessageCount: 1,
        historicalMessageCount: 0,
        computedAt: new Date("2026-09-29T10:00:00Z"),
        updatedAt: new Date("2026-09-29T10:00:00Z"),
      },
    },
    directCandidates: [{ id: "conversation-1" }],
  }));

  const result = await service.resolveConversation("conversation-1");

  assert.equal(result.resolvedReplyState, "NOT_REPLIED");
  assert.equal(result.persistedProjection?.state, "NOT_REPLIED");
  assert.equal(result.projectionMatchesDynamic, true);
});

void test("shadow endpoint surfaces a stale persisted projection mismatch", async () => {
  const service = new ReplyStateShadowService(createPrisma({
    conversation: {
      ...baseConversation,
      replyStateProjection: {
        state: "REPLIED",
        decidingEventKind: "HUMAN_STAFF_REPLY",
        decidingEventAt: new Date("2026-09-01T09:00:00Z"),
        evidenceBoundary: new Date("2026-08-31T17:00:00Z"),
        resolverVersion: "reply-state-v1",
        canonicalMessageCount: 1,
        historicalMessageCount: 0,
        computedAt: new Date("2026-09-29T10:00:00Z"),
        updatedAt: new Date("2026-09-29T10:00:00Z"),
      },
    },
    directCandidates: [{ id: "conversation-1" }],
  }));

  const result = await service.resolveConversation("conversation-1");

  assert.equal(result.resolvedReplyState, "NOT_REPLIED");
  assert.equal(result.persistedProjection?.state, "REPLIED");
  assert.equal(result.projectionMatchesDynamic, false);
});

void test("safe historical crosswalk can supply staff reply evidence", async () => {
  const service = new ReplyStateShadowService(createPrisma({
    conversation: {
      ...baseConversation,
      bmReplyStatus: "NOT_REPLIED",
    },
    crosswalks: [{
      storeId: "store-1",
      lineOfficialAccountId: "oa-1",
      historicalLineChatUserId: "chat-1",
    }],
    directCandidates: [{ id: "conversation-1" }],
    directCrosswalk: {
      classification: "LINK_SAFE",
      canonicalConversationId: "conversation-1",
      evidenceType: "SOURCE_EVENT_ID",
      anchorCount: 1,
    },
    historical: [{
      id: "historical-2",
      sourceEventId: "source-2",
      sourceEventType: "messageSent",
      direction: "OUTBOUND",
      text: "reply",
      sentAt: new Date("2026-09-01T10:05:00Z"),
      senderBizId: null,
    }],
  }));

  const result = await service.resolveConversation("conversation-1");

  assert.equal(result.resolvedReplyState, "REPLIED");
  assert.equal(result.mismatch, true);
  assert.equal(result.evidence.historicalMessageCount, 1);
  assert.equal(result.evidence.historicalLinkMode, "CROSSWALK_AND_DIRECT");
});

void test("direct historical identity is disabled when a safe crosswalk points elsewhere", async () => {
  const service = new ReplyStateShadowService(createPrisma({
    conversation: baseConversation,
    directCandidates: [{ id: "conversation-1" }],
    directCrosswalk: {
      classification: "LINK_SAFE",
      canonicalConversationId: "conversation-2",
      evidenceType: "SOURCE_EVENT_ID",
      anchorCount: 1,
    },
    historical: [{
      id: "historical-2",
      sourceEventId: "source-2",
      sourceEventType: "messageSent",
      direction: "OUTBOUND",
      text: "reply",
      sentAt: new Date("2026-09-01T10:05:00Z"),
      senderBizId: "biz-staff",
    }],
  }));

  const result = await service.resolveConversation("conversation-1");

  assert.equal(result.evidence.linkageConflict, true);
  assert.equal(result.evidence.directIdentityUnique, false);
  assert.equal(result.evidence.historicalMessageCount, 0);
  assert.equal(result.resolvedReplyState, "NOT_REPLIED");
});

void test("historical-only unknown outbound remains AMBIGUOUS instead of guessing", async () => {
  const service = new ReplyStateShadowService(createPrisma({
    conversation: baseConversation,
    crosswalks: [{
      storeId: "store-1",
      lineOfficialAccountId: "oa-1",
      historicalLineChatUserId: "chat-1",
    }],
    directCandidates: [{ id: "conversation-1" }],
    historical: [{
      id: "historical-2",
      sourceEventId: "source-2",
      sourceEventType: "message",
      direction: "OUTBOUND",
      text: "unknown reply",
      sentAt: new Date("2026-09-01T10:05:00Z"),
      senderBizId: null,
    }],
  }));

  const result = await service.resolveConversation("conversation-1");

  assert.equal(result.resolvedReplyState, "AMBIGUOUS");
  assert.equal(result.confidence, "AMBIGUOUS");
  assert.equal(result.ambiguityReason, "UNKNOWN_OUTBOUND_ACTOR");
});

void test("missing conversation returns NotFoundException", async () => {
  const service = new ReplyStateShadowService(createPrisma({ conversation: undefined }));

  await assert.rejects(
    () => service.resolveConversation("missing"),
    (error: unknown) =>
      error instanceof Error &&
      error.name === "NotFoundException",
  );
});
