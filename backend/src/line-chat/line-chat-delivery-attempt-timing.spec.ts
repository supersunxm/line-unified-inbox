import test from "node:test";
import assert from "node:assert/strict";
import {
  MessageDeliveryAttemptStatus,
  MessageDeliveryStatus,
  LineChatMessageSendJobStatus,
} from "@prisma/client";
import {
  isLineChatCanaryPauseAfterSendEnabled,
  isLineChatCanaryPreSendFailureEnabled,
} from "./line-chat-pilot.constants";
import { LineChatMessageSendWorkerService } from "./line-chat-message-send-worker.service";

test("Canary 004 pre-send failure gate requires all 4 conditions", async (t) => {
  const valid = {
    storeCode: "28375",
    conversationId: "a04560a5-8658-493b-9b18-c992adc2b683",
    text: "TEST DURABLE PRE-SEND FAIL 004",
    env: {
      enabled: "true",
      testText: "TEST DURABLE PRE-SEND FAIL 004",
    },
  };

  await t.test("matches when all 4 conditions are met", () => {
    assert.equal(isLineChatCanaryPreSendFailureEnabled(valid), true);
  });

  await t.test("fails closed when env flag is not true", () => {
    assert.equal(
      isLineChatCanaryPreSendFailureEnabled({ ...valid, env: { enabled: "false" } }),
      false,
    );
    assert.equal(
      isLineChatCanaryPreSendFailureEnabled({ ...valid, env: { enabled: undefined } }),
      false,
    );
    assert.equal(
      isLineChatCanaryPreSendFailureEnabled({ ...valid, env: { enabled: "" } }),
      false,
    );
  });

  await t.test("fails closed when the configured test text is absent or does not match", () => {
    assert.equal(
      isLineChatCanaryPreSendFailureEnabled({
        ...valid,
        env: { enabled: "true", testText: undefined },
      }),
      false,
    );
    assert.equal(
      isLineChatCanaryPreSendFailureEnabled({
        ...valid,
        text: "TEST DURABLE STALE RETRY 007",
        env: { enabled: "true", testText: "TEST DURABLE STALE RETRY 007" },
      }),
      true,
    );
    assert.equal(
      isLineChatCanaryPreSendFailureEnabled({
        ...valid,
        env: { enabled: "true", testText: "TEST DURABLE STALE RETRY 007" },
      }),
      false,
    );
  });

  await t.test("fails closed when store is not 28375", () => {
    assert.equal(
      isLineChatCanaryPreSendFailureEnabled({ ...valid, storeCode: "25610" }),
      false,
    );
    assert.equal(
      isLineChatCanaryPreSendFailureEnabled({ ...valid, storeCode: null }),
      false,
    );
  });

  await t.test("fails closed when conversation is not the authorized canary conversation", () => {
    // Max's conversation
    assert.equal(
      isLineChatCanaryPreSendFailureEnabled({
        ...valid,
        conversationId: "9cf223e4-194a-47ce-b795-1192a22d3928",
      }),
      false,
    );
    // Random conversation
    assert.equal(
      isLineChatCanaryPreSendFailureEnabled({
        ...valid,
        conversationId: "b1111111-2222-3333-4444-555555555555",
      }),
      false,
    );
  });

  await t.test("fails closed when text is not exact TEST DURABLE PRE-SEND FAIL 004", () => {
    assert.equal(
      isLineChatCanaryPreSendFailureEnabled({ ...valid, text: "TEST DURABLE QUEUE 002" }),
      false,
    );
    assert.equal(
      isLineChatCanaryPreSendFailureEnabled({ ...valid, text: "Hello" }),
      false,
    );
    assert.equal(
      isLineChatCanaryPreSendFailureEnabled({ ...valid, text: "" }),
      false,
    );
  });
});

test("Canary worker restart pause gate requires the exact flag, store, conversation, and text", async (t) => {
  const valid = {
    storeCode: "28375",
    conversationId: "cb6dc791-ef0e-45f0-bb33-96c9b638c9a0",
    text: "INTERNAL WORKER RESTART B 002",
    env: { enabled: "true" },
  };

  await t.test("matches only when every condition is exact", () => {
    assert.equal(isLineChatCanaryPauseAfterSendEnabled(valid), true);
  });

  await t.test("fails closed when the flag is absent, false, or empty", () => {
    assert.equal(
      isLineChatCanaryPauseAfterSendEnabled({ ...valid, env: { enabled: undefined } }),
      false,
    );
    assert.equal(
      isLineChatCanaryPauseAfterSendEnabled({ ...valid, env: { enabled: "false" } }),
      false,
    );
    assert.equal(
      isLineChatCanaryPauseAfterSendEnabled({ ...valid, env: { enabled: "" } }),
      false,
    );
  });

  await t.test("fails closed for the wrong store, conversation, or text", () => {
    assert.equal(
      isLineChatCanaryPauseAfterSendEnabled({ ...valid, storeCode: "25610" }),
      false,
    );
    assert.equal(
      isLineChatCanaryPauseAfterSendEnabled({
        ...valid,
        conversationId: "9cf223e4-194a-47ce-b795-1192a22d3928",
      }),
      false,
    );
    assert.equal(
      isLineChatCanaryPauseAfterSendEnabled({ ...valid, text: "INTERNAL DURABLE TEST B 001" }),
      false,
    );
    assert.equal(
      isLineChatCanaryPauseAfterSendEnabled({ ...valid, text: "INTERNAL WORKER RESTART B 001" }),
      false,
    );
  });
});

test("Delivery attempt sendActionAt timing semantics", async (t) => {
  const originalEnv = { ...process.env };

  t.beforeEach(() => {
    process.env.LINE_CHAT_DURABLE_SEND_QUEUE_ENABLED = "true";
    process.env.LINE_CHAT_DURABLE_SEND_QUEUE_STORE_CODES = "28375";
    process.env.LINE_CHAT_DURABLE_SEND_QUEUE_CONVERSATION_IDS = "a04560a5-8658-493b-9b18-c992adc2b683";
  });

  t.afterEach(() => {
    process.env = { ...originalEnv };
  });

  function createTestFixture(text = "Hello world") {
    const attempts: Array<Record<string, unknown>> = [];
    const jobs: Array<Record<string, unknown>> = [];
    const messages: Array<Record<string, unknown>> = [];

    const jobRecord: any = {
      id: "job-1",
      messageId: "msg-1",
      conversationId: "a04560a5-8658-493b-9b18-c992adc2b683",
      idempotencyKey: "idem-1",
      attemptCount: 0,
      conversation: {
        id: "a04560a5-8658-493b-9b18-c992adc2b683",
        store: { code: "28375", storeMaster: null },
      },
      message: {
        id: "msg-1",
        originalText: text,
        rawPayload: {},
      },
      attempts: [],
    };

    const mockPrisma: any = {
      $transaction: async (arg: any) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        if (typeof arg === "function") {
          return arg(mockPrisma);
        }
        return null;
      },
      lineChatMessageSendJob: {
        findUnique: async ({ where }: any) => {
          if (where.id === jobRecord.id) {
            return jobRecord;
          }
          return null;
        },
        update: async ({ where, data }: any) => {
          Object.assign(jobRecord, data);
          jobs.push({ id: where.id, ...data });
          return { ...jobRecord, ...data };
        },
      },
      messageDeliveryAttempt: {
        create: async ({ data }: any) => {
          const record = { id: `attempt-${attempts.length + 1}`, ...data };
          attempts.push(record);
          jobRecord.attempts.push(record);
          return record;
        },
        update: async ({ where, data }: any) => {
          const att = attempts.find((a) => a.id === where.id);
          if (att) {
            Object.assign(att, data);
            return att;
          }
          const updated = { id: where.id, ...data };
          attempts.push(updated);
          return updated;
        },
      },
      message: {
        update: async ({ where, data }: any) => {
          messages.push({ id: where.id, ...data });
          return { id: where.id, ...data };
        },
      },
    };

    return { attempts, jobs, messages, mockPrisma, jobRecord };
  }

  await t.test(
    "deliberate canary pre-send failure leaves sendActionAt null and fails attempt closed",
    async () => {
      const { attempts, jobs, messages, mockPrisma, jobRecord } = createTestFixture(
        "TEST DURABLE PRE-SEND FAIL 004",
      );
      const mockRelay: any = {
        relayText: async () => {
          throw new Error("should not be called on pre-send failure");
        },
      };

      const worker = new LineChatMessageSendWorkerService(mockPrisma, mockRelay);
      process.env.LINE_CHAT_CANARY_FORCE_PRE_SEND_FAILURE_ENABLED = "true";
      process.env.LINE_CHAT_CANARY_FORCE_PRE_SEND_FAILURE_TEXT = "TEST DURABLE PRE-SEND FAIL 004";

      await (worker as any).processSend(jobRecord.id);

      // Check initial attempt creation
      assert.equal(attempts.length, 1);
      const attempt = attempts[0];
      assert.ok(attempt.startedAt instanceof Date);
      assert.equal(attempt.sendActionAt, null, "sendActionAt MUST remain null on pre-send failure");
      assert.equal(attempt.status, MessageDeliveryAttemptStatus.FAILED);
      assert.match(String(attempt.failureReason), /CONTROLLED_CANARY_PRE_SEND_FAILURE/);

      // Check job and message
      const lastJob = jobs[jobs.length - 1];
      assert.equal(lastJob.status, LineChatMessageSendJobStatus.FAILED);

      const lastMessage = messages[messages.length - 1];
      assert.equal(lastMessage.deliveryStatus, MessageDeliveryStatus.FAILED);
    },
  );

  await t.test(
    "unmapped / missing session pre-send failure leaves sendActionAt null and fails closed",
    async () => {
      const { attempts, jobs, messages, mockPrisma, jobRecord } = createTestFixture("Hello world");
      const mockRelay: any = {
        relayText: async () => {
          // Throws before calling onSendAction
          throw new Error("ไม่พบ session ของ LINE OA Manager");
        },
      };

      const worker = new LineChatMessageSendWorkerService(mockPrisma, mockRelay);
      await (worker as any).processSend(jobRecord.id);

      assert.equal(attempts.length, 1);
      const attempt = attempts[0];
      assert.ok(attempt.startedAt instanceof Date);
      assert.equal(attempt.sendActionAt, null, "sendActionAt MUST remain null if session missing");
      assert.equal(attempt.status, MessageDeliveryAttemptStatus.FAILED);

      const lastJob = jobs[jobs.length - 1];
      assert.equal(lastJob.status, LineChatMessageSendJobStatus.FAILED);

      const lastMessage = messages[messages.length - 1];
      assert.equal(lastMessage.deliveryStatus, MessageDeliveryStatus.FAILED);
    },
  );

  await t.test(
    "profile busy before send leaves sendActionAt null and requeues job",
    async () => {
      const { attempts, jobs, mockPrisma, jobRecord } = createTestFixture("Hello world");
      const mockRelay: any = {
        relayText: async () => {
          throw new Error("LINE OA Manager กำลังทำงานอื่นอยู่ กรุณาลองส่งอีกครั้ง");
        },
      };

      const worker = new LineChatMessageSendWorkerService(mockPrisma, mockRelay);
      await (worker as any).processSend(jobRecord.id);

      assert.equal(attempts.length, 1);
      const attempt = attempts[0];
      assert.ok(attempt.startedAt instanceof Date);
      assert.equal(attempt.sendActionAt, null, "sendActionAt MUST remain null when profile busy");
      assert.equal(attempt.status, MessageDeliveryAttemptStatus.FAILED);
      assert.equal(attempt.failureReason, "PROFILE_BUSY_BEFORE_SEND");

      const lastJob = jobs[jobs.length - 1];
      assert.equal(lastJob.status, LineChatMessageSendJobStatus.QUEUED);
    },
  );

  await t.test(
    "actual send path sets sendActionAt before Manager response",
    async () => {
      const { attempts, jobs, messages, mockPrisma, jobRecord } = createTestFixture("Hello world");
      const sendTime = new Date("2026-09-19T18:00:00.000Z");

      const mockRelay: any = {
        relayText: async (input: any) => {
          assert.ok(input.onSendAction, "onSendAction callback must be provided");
          // Callback invoked right before clicking send / pressing Enter
          await input.onSendAction(sendTime);
          return {
            handled: true,
            duplicate: false,
            lineChatUserId: "U123",
            managerMessageId: "manager-message-1",
            managerSentAt: sendTime,
            verificationSource: "MANAGER_API",
          };
        },
      };

      const worker = new LineChatMessageSendWorkerService(mockPrisma, mockRelay);

      await (worker as any).processSend(jobRecord.id);

      assert.equal(attempts.length, 1);
      const attempt = attempts[0];
      assert.ok(attempt.startedAt instanceof Date);
      assert.equal(attempt.sendActionAt, sendTime, "sendActionAt MUST be populated when send action occurs");
      assert.equal(attempt.status, MessageDeliveryAttemptStatus.DELIVERED);
      assert.equal(attempt.managerMessageId, "manager-message-1");
      assert.equal(messages[messages.length - 1].deliveryStatus, MessageDeliveryStatus.DELIVERED);
      assert.equal(jobs[jobs.length - 1].managerMessageId, "manager-message-1");
    },
  );

  await t.test(
    "exact pause hook runs after sendActionAt persistence and before markDelivered",
    async () => {
      const { attempts, mockPrisma, jobRecord } = createTestFixture("INTERNAL WORKER RESTART B 002");
      const sendTime = new Date("2026-09-19T18:00:00.000Z");
      const testConversationId = "cb6dc791-ef0e-45f0-bb33-96c9b638c9a0";
      jobRecord.conversationId = testConversationId;
      jobRecord.conversation.id = testConversationId;
      process.env.LINE_CHAT_DURABLE_SEND_QUEUE_CONVERSATION_IDS =
        `a04560a5-8658-493b-9b18-c992adc2b683,${testConversationId}`;
      process.env.LINE_CHAT_CANARY_PAUSE_AFTER_SEND_ENABLED = "true";

      const ordering: string[] = [];
      let releasePause: (() => void) | null = null;
      let resolvePauseEntered: (() => void) | null = null;
      const pauseEntered = new Promise<void>((resolve) => {
        resolvePauseEntered = resolve;
      });
      const mockRelay: any = {
        relayText: async (input: any) => {
          await input.onSendAction(sendTime);
          return {
            handled: true,
            duplicate: false,
            lineChatUserId: "U123",
            managerMessageId: "manager-message-restart-1",
            managerSentAt: sendTime,
            verificationSource: "MANAGER_API",
          };
        },
      };
      const worker = new LineChatMessageSendWorkerService(mockPrisma, mockRelay);
      (worker as any).pauseAfterSendBeforeDeliveryPersist = async (input: any) => {
        ordering.push("pause");
        assert.equal(input.attemptId, "attempt-1");
        assert.equal(input.sendActionAt, sendTime);
        assert.equal(attempts[0].sendActionAt, sendTime);
        resolvePauseEntered?.();
        await new Promise<void>((resolve) => {
          releasePause = resolve;
        });
      };
      (worker as any).markDelivered = async () => {
        ordering.push("markDelivered");
      };

      const processing = (worker as any).processSend(jobRecord.id);
      await pauseEntered;
      assert.deepEqual(ordering, ["pause"]);
      assert.equal(attempts[0].sendActionAt, sendTime);
      assert.equal(attempts[0].status, MessageDeliveryAttemptStatus.PROCESSING);
      assert.equal(releasePause !== null, true);
      releasePause?.();
      await processing;

      assert.deepEqual(ordering, ["pause", "markDelivered"]);
      assert.equal(attempts.length, 1);
    },
  );

  await t.test(
    "handled relay without concrete Manager evidence remains VERIFY_PENDING",
    async () => {
      const { attempts, jobs, messages, mockPrisma, jobRecord } = createTestFixture("Hello world");
      const sendTime = new Date("2026-09-19T18:00:00.000Z");

      const mockRelay: any = {
        relayText: async (input: any) => {
          await input.onSendAction(sendTime);
          return {
            handled: true,
            duplicate: false,
            lineChatUserId: "U123",
            managerMessageId: null,
            managerSentAt: null,
            verificationSource: null,
          };
        },
      };

      const worker = new LineChatMessageSendWorkerService(mockPrisma, mockRelay);
      await (worker as any).processSend(jobRecord.id);

      assert.equal(attempts[0].sendActionAt, sendTime);
      assert.equal(attempts[0].status, MessageDeliveryAttemptStatus.VERIFY_PENDING);
      assert.equal(jobs[jobs.length - 1].status, LineChatMessageSendJobStatus.VERIFY_PENDING);
      assert.equal(messages[messages.length - 1].deliveryStatus, MessageDeliveryStatus.PENDING);
      assert.equal(jobs[jobs.length - 1].lastError, "MANAGER_DELIVERY_EVIDENCE_REQUIRED");
    },
  );

  await t.test(
    "markDelivered rejects blank Manager message evidence at runtime",
    async () => {
      const { mockPrisma } = createTestFixture("Hello world");
      const worker = new LineChatMessageSendWorkerService(mockPrisma, {});

      await assert.rejects(
        () => (worker as any).markDelivered("job-1", null, "   ", new Date()),
        /MANAGER_DELIVERY_EVIDENCE_REQUIRED/,
      );
    },
  );

  await t.test(
    "PRESENT verification without ID does not deliver or resend",
    async () => {
      const { attempts, jobs, messages, mockPrisma, jobRecord } = createTestFixture("Hello world");
      const pendingAttempt = {
        id: "attempt-1",
        status: MessageDeliveryAttemptStatus.VERIFY_PENDING,
        attemptNo: 1,
        sendActionAt: new Date("2026-09-19T18:00:00.000Z"),
      };
      attempts.push(pendingAttempt);
      jobRecord.attempts = [pendingAttempt];
      jobRecord.attemptCount = 1;
      jobRecord.verifyAttemptCount = 0;
      jobRecord.sendStartedAt = new Date("2026-09-19T18:00:00.000Z");
      let relayCalls = 0;
      const mockRelay: any = {
        inspectTextPresenceSince: async () => ({
          handled: true,
          presence: "PRESENT",
          lineChatUserId: "U123",
          managerMessageId: null,
          managerSentAt: null,
        }),
        relayText: async () => {
          relayCalls += 1;
          throw new Error("relayText must not be called during verification");
        },
      };

      const worker = new LineChatMessageSendWorkerService(mockPrisma, mockRelay);
      await (worker as any).processVerification(jobRecord.id);

      assert.equal(relayCalls, 0);
      assert.equal(pendingAttempt.status, MessageDeliveryAttemptStatus.VERIFY_PENDING);
      assert.equal(jobs[jobs.length - 1].status, LineChatMessageSendJobStatus.VERIFY_PENDING);
      assert.equal(messages.length, 0, "verification uncertainty must not rewrite Message as delivered");
    },
  );

  await t.test(
    "delivery records share the same concrete Manager message ID",
    async () => {
      const { attempts, jobs, messages, mockPrisma, jobRecord } = createTestFixture("Hello world");
      const managerSentAt = new Date("2026-09-19T18:00:00.000Z");
      const mockRelay: any = {
        relayText: async (input: any) => {
          await input.onSendAction(managerSentAt);
          return {
            handled: true,
            duplicate: false,
            lineChatUserId: "U123",
            managerMessageId: "manager-message-shared",
            managerSentAt,
            verificationSource: "MANAGER_API",
          };
        },
      };

      const worker = new LineChatMessageSendWorkerService(mockPrisma, mockRelay);
      await (worker as any).processSend(jobRecord.id);

      assert.equal(attempts[0].managerMessageId, "manager-message-shared");
      assert.equal(jobs[jobs.length - 1].managerMessageId, "manager-message-shared");
      assert.equal(
        messages[messages.length - 1].rawPayload.managerMessageId,
        "manager-message-shared",
      );
    },
  );

  await t.test(
    "verification uncertainty after send action retains populated sendActionAt and enters VERIFY_PENDING",
    async () => {
      const { attempts, jobs, messages, mockPrisma, jobRecord } = createTestFixture("Hello world");
      const sendTime = new Date("2026-09-19T18:00:00.000Z");

      const mockRelay: any = {
        relayText: async (input: any) => {
          // Send action is initiated
          await input.onSendAction(sendTime);
          // But verification times out or throws
          throw new Error("TEST_SIMULATED_VERIFY_DELAY: verification timed out");
        },
      };

      const worker = new LineChatMessageSendWorkerService(mockPrisma, mockRelay);
      await (worker as any).processSend(jobRecord.id);

      assert.equal(attempts.length, 1);
      const attempt = attempts[0];
      assert.ok(attempt.startedAt instanceof Date);
      assert.equal(
        attempt.sendActionAt,
        sendTime,
        "sendActionAt MUST remain populated in VERIFY_PENDING",
      );
      assert.equal(attempt.status, MessageDeliveryAttemptStatus.VERIFY_PENDING);

      const lastJob = jobs[jobs.length - 1];
      assert.equal(lastJob.status, LineChatMessageSendJobStatus.VERIFY_PENDING);

      const lastMessage = messages[messages.length - 1];
      assert.equal(lastMessage.deliveryStatus, MessageDeliveryStatus.PENDING);
    },
  );
});
