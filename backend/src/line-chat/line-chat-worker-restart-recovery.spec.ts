import test from "node:test";
import assert from "node:assert/strict";
import {
  LineChatMessageSendJobStatus,
  MessageDeliveryAttemptStatus,
  MessageDeliveryStatus,
} from "@prisma/client";
import { LineChatMessageSendWorkerService } from "./line-chat-message-send-worker.service";

test("expired PROCESSING worker lease recovers to VERIFY_PENDING without creating another attempt", async () => {
  const jobUpdates: Array<Record<string, unknown>> = [];
  const attemptUpdates: Array<Record<string, unknown>> = [];
  const mockPrisma: any = {
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    lineChatMessageSendJob: {
      findMany: async () => [{ id: "job-1", messageId: "message-1" }],
      update: async ({ data }: { data: Record<string, unknown> }) => {
        jobUpdates.push(data);
        return data;
      },
    },
    messageDeliveryAttempt: {
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        attemptUpdates.push(data);
        return { count: 1 };
      },
    },
  };

  const worker = new LineChatMessageSendWorkerService(mockPrisma, {});
  assert.equal(await worker.recoverStuckJobs(), 1);

  assert.equal(jobUpdates[0].status, LineChatMessageSendJobStatus.VERIFY_PENDING);
  assert.equal(jobUpdates[0].lastError, "WORKER_LEASE_EXPIRED_VERIFY_BEFORE_ANY_RESEND");
  assert.equal(jobUpdates[0].workerId, null);
  assert.equal(jobUpdates[0].claimedAt, null);
  assert.equal(jobUpdates[0].lockedUntil, null);
  assert.equal(attemptUpdates[0].status, MessageDeliveryAttemptStatus.VERIFY_PENDING);
  assert.equal(
    attemptUpdates[0].failureReason,
    "WORKER_LEASE_EXPIRED_VERIFY_BEFORE_ANY_RESEND",
  );
});

test("recovered VERIFY_PENDING job verifies Manager history only and delivers the original attempt", async () => {
  const attempt = {
    id: "attempt-1",
    status: MessageDeliveryAttemptStatus.VERIFY_PENDING,
    attemptNo: 1,
    sendActionAt: new Date("2026-09-19T18:00:00.000Z"),
    managerMessageId: null as string | null,
    verifiedAt: null as Date | null,
  };
  const job = {
    id: "job-1",
    messageId: "message-1",
    conversationId: "conversation-1",
    attemptCount: 1,
    verifyAttemptCount: 0,
    sendStartedAt: new Date("2026-09-19T18:00:00.000Z"),
    claimedAt: null,
    createdAt: new Date("2026-09-19T17:59:00.000Z"),
    managerMessageId: null as string | null,
    message: {
      id: "message-1",
      originalText: "INTERNAL WORKER RESTART B 002",
      rawPayload: {},
      senderUserId: null,
      senderDisplayName: null,
      sentAt: new Date("2026-09-19T17:59:00.000Z"),
    },
    conversation: {
      id: "conversation-1",
      bmReplyStatus: "NOT_REPLIED",
      followUpStatus: "FOLLOW_UP",
    },
    attempts: [attempt],
  };
  const jobUpdates: Array<Record<string, unknown>> = [];
  const messageUpdates: Array<Record<string, unknown>> = [];
  let relayTextCalls = 0;
  const managerMessageId = "632511000000000001";
  const managerSentAt = new Date("2026-09-19T18:01:00.000Z");

  const mockPrisma: any = {
    $transaction: async (operation: (tx: any) => Promise<unknown>) => operation(mockPrisma),
    lineChatMessageSendJob: {
      findUnique: async () => job,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(job, data);
        jobUpdates.push(data);
        return job;
      },
    },
    message: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(job.message, data);
        messageUpdates.push(data);
        return job.message;
      },
    },
    messageDeliveryAttempt: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(attempt, data);
        return attempt;
      },
    },
  };
  const mockRelay = {
    inspectTextPresenceSince: async () => ({
      handled: true,
      presence: "PRESENT" as const,
      managerMessageId,
      managerSentAt,
    }),
    relayText: async () => {
      relayTextCalls += 1;
      throw new Error("relayText must not run during lease recovery verification");
    },
  };

  const worker = new LineChatMessageSendWorkerService(mockPrisma, mockRelay);
  await (worker as any).processVerification(job.id);

  assert.equal(relayTextCalls, 0);
  assert.equal(job.attemptCount, 1);
  assert.equal(jobUpdates.at(-1)?.status, LineChatMessageSendJobStatus.DELIVERED);
  assert.equal(job.managerMessageId, managerMessageId);
  assert.equal(messageUpdates.at(-1)?.deliveryStatus, MessageDeliveryStatus.DELIVERED);
  assert.equal(attempt.status, MessageDeliveryAttemptStatus.DELIVERED);
  assert.equal(attempt.managerMessageId, managerMessageId);
  assert.equal(attempt.verifiedAt, managerSentAt);
  assert.equal(job.attempts.length, 1);
});
