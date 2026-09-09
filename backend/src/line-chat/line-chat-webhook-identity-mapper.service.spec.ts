import assert from "node:assert/strict";
import test from "node:test";
import { LineChatNicknameSyncJobStatus } from "@prisma/client";
import { LineChatWebhookIdentityMapperService } from "./line-chat-webhook-identity-mapper.service";

const OA_ID = "oa-1";
const TARGET_ID = "conversation-target";
const USER_ID = `U${"a".repeat(32)}`;
const OTHER_1 = `U${"b".repeat(32)}`;
const OTHER_2 = `U${"c".repeat(32)}`;
const OTHER_3 = `U${"d".repeat(32)}`;

function fixture(options: {
  evidence?: Array<{ lineChatUserId: string | null; customer: { lineUserId: string } }>;
  targets?: Array<{ id: string; lineOfficialAccountId: string; lineChatUserId: string | null; customer: { lineUserId: string } }>;
  conflicts?: Array<{ id: string; lineChatUserId: string | null }>;
} = {}) {
  const conversationWrites: unknown[] = [];
  const jobWrites: unknown[] = [];
  let findManyCall = 0;
  const evidence = options.evidence ?? [OTHER_1, OTHER_2, OTHER_3].map((id) => ({
    lineChatUserId: id,
    customer: { lineUserId: id },
  }));
  const targets = options.targets ?? [{
    id: TARGET_ID,
    lineOfficialAccountId: OA_ID,
    lineChatUserId: null,
    customer: { lineUserId: USER_ID },
  }];
  const conflicts = options.conflicts ?? [];

  const tx = {
    conversation: {
      updateMany: async (args: unknown) => {
        conversationWrites.push(args);
        return { count: 1 };
      },
    },
    lineChatNicknameSyncJob: {
      updateMany: async (args: unknown) => {
        jobWrites.push(args);
        return { count: 1 };
      },
    },
  };
  const prisma = {
    lineChatNicknameSyncJob: {
      findMany: async () => [{ id: "job-1", conversationId: TARGET_ID, lineOfficialAccountId: OA_ID }],
    },
    conversation: {
      findMany: async () => {
        findManyCall += 1;
        if (findManyCall === 1) return evidence;
        if (findManyCall === 2) return targets;
        return conflicts;
      },
    },
    $transaction: async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
  };

  return {
    service: new LineChatWebhookIdentityMapperService(prisma as never),
    conversationWrites,
    jobWrites,
  };
}

test("maps a pending nickname job from webhook identity only after verified OA evidence", async () => {
  const value = fixture();
  const mapped = await value.service.processCycle();
  assert.equal(mapped, 1);
  assert.equal(value.conversationWrites.length, 1);
  assert.equal(value.jobWrites.length, 1);
  assert.deepEqual(value.conversationWrites[0], {
    where: { id: TARGET_ID, lineOfficialAccountId: OA_ID, lineChatUserId: null },
    data: { lineChatUserId: USER_ID },
  });
  const jobWrite = value.jobWrites[0] as { where: unknown; data: Record<string, unknown> };
  assert.deepEqual(jobWrite.where, {
    conversationId: TARGET_ID,
    lineOfficialAccountId: OA_ID,
    status: LineChatNicknameSyncJobStatus.PENDING,
  });
  assert.equal(jobWrite.data.lineChatUserId, USER_ID);
  assert.equal(jobWrite.data.lineUserId, USER_ID);
  assert.equal(jobWrite.data.lastError, null);
  assert.ok(jobWrite.data.scheduledAt instanceof Date);
});

test("does not map when the OA has fewer than three matching durable identities", async () => {
  const value = fixture({
    evidence: [OTHER_1, OTHER_2].map((id) => ({ lineChatUserId: id, customer: { lineUserId: id } })),
  });
  assert.equal(await value.service.processCycle(), 0);
  assert.equal(value.conversationWrites.length, 0);
  assert.equal(value.jobWrites.length, 0);
});

test("does not map when any sampled durable identity disagrees with webhook identity", async () => {
  const value = fixture({
    evidence: [
      { lineChatUserId: OTHER_1, customer: { lineUserId: OTHER_1 } },
      { lineChatUserId: OTHER_2, customer: { lineUserId: OTHER_2 } },
      { lineChatUserId: OTHER_3, customer: { lineUserId: OTHER_3 } },
      { lineChatUserId: USER_ID, customer: { lineUserId: OTHER_1 } },
    ],
  });
  assert.equal(await value.service.processCycle(), 0);
  assert.equal(value.conversationWrites.length, 0);
  assert.equal(value.jobWrites.length, 0);
});

test("does not reuse an existing Manager chat ID for another conversation in the same OA", async () => {
  const value = fixture({ conflicts: [{ id: "another-conversation", lineChatUserId: USER_ID }] });
  assert.equal(await value.service.processCycle(), 0);
  assert.equal(value.conversationWrites.length, 0);
  assert.equal(value.jobWrites.length, 0);
});

test("does not map duplicate pending conversations that propose the same webhook identity", async () => {
  const value = fixture({
    targets: [
      { id: TARGET_ID, lineOfficialAccountId: OA_ID, lineChatUserId: null, customer: { lineUserId: USER_ID } },
      { id: "conversation-duplicate", lineOfficialAccountId: OA_ID, lineChatUserId: null, customer: { lineUserId: USER_ID } },
    ],
  });
  assert.equal(await value.service.processCycle(), 0);
  assert.equal(value.conversationWrites.length, 0);
  assert.equal(value.jobWrites.length, 0);
});
