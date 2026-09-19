import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  LineChatMessageSendJobStatus,
  MessageDeliveryAttemptStatus,
  MessageDeliveryStatus,
  Prisma,
} from "@prisma/client";
import { hostname } from "node:os";
import { PrismaService } from "../prisma.service";
import { persistStaffOutboundReplyState } from "../conversation-reply-state";
import { LineChatManagerMessageRelayWorkerService } from "./line-chat-manager-message-relay-worker.service";
import { isLineChatDurableSendQueueStoreEnabled } from "./line-chat-pilot.constants";

const POLL_INTERVAL_MS = 1_500;
const JOB_LEASE_MS = 90_000;
const MAX_PARALLEL_PROFILES = 4;
const VERIFY_BACKOFF_MS = [3_000, 5_000, 10_000, 20_000] as const;
const MAX_VERIFY_ATTEMPTS = VERIFY_BACKOFF_MS.length;

// Safety invariant: an ambiguous customer-facing send transitions to
// VERIFY_PENDING. The worker must never auto-resend from that state.
// Deployment touch: rebuild after Railway usage-limit increase (2026-09-19).

function jsonObject(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, Prisma.JsonValue>;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isDefinitelyPreSendBusy(message: string): boolean {
  return (
    message.includes("is busy with another operation")
    || message.includes("กำลังทำงานอื่นอยู่")
  );
}

function isNonRetryableBeforeSend(message: string): boolean {
  return (
    message.includes("ไม่พร้อมใช้งาน")
    || message.includes("ยังไม่ได้เชื่อมต่อกับ worker")
    || message.includes("LINE_CHAT_WORKER_INTERNAL_URL")
  );
}

type ManagerOutboundEvent = {
  managerMessageId: string;
  text: string;
  sentAt: Date;
  bizId: string | null;
  ownerName: string | null;
};

@Injectable()
export class LineChatMessageSendWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LineChatMessageSendWorkerService.name);
  private readonly workerId = `${process.env.RAILWAY_SERVICE_NAME?.trim() || "local"}:${process.env.RAILWAY_REPLICA_ID?.trim() || hostname()}:${process.pid}:send-queue`;
  private timer: NodeJS.Timeout | null = null;
  private processing = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LineChatManagerMessageRelayWorkerService)
    private readonly managerRelay: LineChatManagerMessageRelayWorkerService,
  ) {}

  onModuleInit(): void {
    if (
      process.env.NODE_ENV === "test"
      || process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE === "true"
      || process.env.LINE_CHAT_DURABLE_SEND_QUEUE_ENABLED !== "true"
    ) {
      return;
    }

    this.logger.log(JSON.stringify({
      event: "line_chat_message_send_worker_started",
      workerId: this.workerId,
    }));
    this.timer = setInterval(() => void this.processCycle(), POLL_INTERVAL_MS);
    void this.processCycle();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async recoverStuckJobs(): Promise<number> {
    const now = new Date();
    const stuck = await this.prisma.lineChatMessageSendJob.findMany({
      where: {
        status: LineChatMessageSendJobStatus.PROCESSING,
        lockedUntil: { lt: now },
      },
      take: 50,
      select: { id: true, messageId: true },
    });

    for (const job of stuck) {
      await this.prisma.$transaction([
        this.prisma.lineChatMessageSendJob.update({
          where: { id: job.id },
          data: {
            status: LineChatMessageSendJobStatus.VERIFY_PENDING,
            scheduledAt: now,
            workerId: null,
            claimedAt: null,
            lockedUntil: null,
            lastError: "WORKER_LEASE_EXPIRED_VERIFY_BEFORE_ANY_RESEND",
          },
        }),
        this.prisma.messageDeliveryAttempt.updateMany({
          where: {
            sendJobId: job.id,
            status: MessageDeliveryAttemptStatus.PROCESSING,
          },
          data: {
            status: MessageDeliveryAttemptStatus.VERIFY_PENDING,
            finishedAt: now,
            failureReason: "WORKER_LEASE_EXPIRED_VERIFY_BEFORE_ANY_RESEND",
          },
        }),
      ]);
    }

    if (stuck.length > 0) {
      this.logger.warn(JSON.stringify({
        event: "line_chat_message_send_stuck_jobs_recovered",
        count: stuck.length,
      }));
    }
    return stuck.length;
  }

  async processCycle(): Promise<number> {
    if (this.processing) return 0;
    this.processing = true;
    try {
      await this.recoverStuckJobs();
      const now = new Date();
      const candidates = await this.prisma.lineChatMessageSendJob.findMany({
        where: {
          status: {
            in: [
              LineChatMessageSendJobStatus.QUEUED,
              LineChatMessageSendJobStatus.VERIFY_PENDING,
            ],
          },
          scheduledAt: { lte: now },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 50,
      });

      const bySession = new Map<string, (typeof candidates)[number]>();
      for (const job of candidates) {
        if (!bySession.has(job.lineChatSessionId)) {
          bySession.set(job.lineChatSessionId, job);
        }
      }
      const selected = [...bySession.values()].slice(0, MAX_PARALLEL_PROFILES);
      const results = await Promise.all(selected.map((job) => this.claimAndProcess(job)));
      return results.filter(Boolean).length;
    } catch (error) {
      this.logger.error(JSON.stringify({
        event: "line_chat_message_send_cycle_failed",
        error: errorText(error),
      }));
      return 0;
    } finally {
      this.processing = false;
    }
  }

  private async claimAndProcess(job: {
    id: string;
    status: LineChatMessageSendJobStatus;
  }): Promise<boolean> {
    const now = new Date();
    const claimed = await this.prisma.lineChatMessageSendJob.updateMany({
      where: {
        id: job.id,
        status: job.status,
        scheduledAt: { lte: now },
      },
      data: {
        status: LineChatMessageSendJobStatus.PROCESSING,
        workerId: this.workerId,
        claimedAt: now,
        lockedUntil: new Date(now.getTime() + JOB_LEASE_MS),
      },
    });
    if (claimed.count === 0) return false;

    if (job.status === LineChatMessageSendJobStatus.VERIFY_PENDING) {
      await this.processVerification(job.id);
    } else {
      await this.processSend(job.id);
    }
    return true;
  }

  private async processSend(jobId: string): Promise<void> {
    const job = await this.prisma.lineChatMessageSendJob.findUnique({
      where: { id: jobId },
      include: {
        conversation: {
          select: {
            store: {
              select: {
                code: true,
                storeMaster: { select: { externalStoreId: true } },
              },
            },
          },
        },
        message: {
          select: {
            id: true,
            conversationId: true,
            originalText: true,
            rawPayload: true,
            senderUserId: true,
            senderDisplayName: true,
            sentAt: true,
          },
        },
      },
    });
    if (!job) return;

    const storeCode = job.conversation?.store?.code?.trim()
      || job.conversation?.store?.storeMaster?.externalStoreId?.trim()
      || "";
    if (!isLineChatDurableSendQueueStoreEnabled(storeCode)) {
      this.logger.warn(JSON.stringify({
        event: "line_chat_message_send_job_store_not_allowlisted",
        jobId: job.id,
        storeCode,
      }));
      return;
    }

    // A previously attempted job is a manual retry/recovery. Re-read Manager
    // history before any customer-facing resend. If the original text already
    // exists, confirm it. If another staff reply exists, import that reply and
    // suppress the stale unsent draft instead of sending it late.
    if (job.attemptCount > 0) {
      try {
        const activity = await this.managerRelay.inspectOutboundActivitySince({
          conversationId: job.conversationId,
          after: job.message.sentAt,
        });
        if (activity.handled) {
          const exact = activity.events.find(
            (event) => event.text === job.message.originalText,
          );
          if (exact) {
            await this.markDelivered(
              job.id,
              null,
              exact.managerMessageId,
              exact.sentAt,
            );
            this.logger.log(JSON.stringify({
              event: "line_chat_message_retry_precheck_exact_found",
              jobId: job.id,
              messageId: job.messageId,
              conversationId: job.conversationId,
              managerMessageId: exact.managerMessageId,
            }));
            return;
          }

          if (activity.events.length > 0) {
            await this.supersedeWithManagerReplies(job.id, activity.events);
            return;
          }
        }
      } catch (error) {
        // Fail safe: a retry may not send until the source-of-truth precheck
        // succeeds. Requeue for another read-only check rather than guessing.
        await this.prisma.lineChatMessageSendJob.update({
          where: { id: job.id },
          data: {
            status: LineChatMessageSendJobStatus.QUEUED,
            scheduledAt: new Date(Date.now() + 5_000),
            workerId: null,
            claimedAt: null,
            lockedUntil: null,
            lastError: `RETRY_PRECHECK_FAILED: ${errorText(error).slice(0, 420)}`,
          },
        });
        return;
      }
    }

    const startedAt = new Date();
    const attemptNo = job.attemptCount + 1;
    const attempt = await this.prisma.$transaction(async (tx) => {
      await tx.lineChatMessageSendJob.update({
        where: { id: job.id },
        data: {
          attemptCount: { increment: 1 },
          sendStartedAt: startedAt,
          lastError: null,
        },
      });
      return tx.messageDeliveryAttempt.create({
        data: {
          messageId: job.messageId,
          sendJobId: job.id,
          attemptNo,
          status: MessageDeliveryAttemptStatus.PROCESSING,
          startedAt,
          sendActionAt: startedAt,
        },
      });
    });

    try {
      const result = await this.managerRelay.relayText({
        conversationId: job.conversationId,
        text: job.message.originalText,
        idempotencyKey: job.idempotencyKey,
      });
      if (!result.handled) {
        throw new Error("MANAGER_RELAY_NOT_HANDLED");
      }
      await this.markDelivered(job.id, attempt.id, null, new Date());
    } catch (error) {
      const message = errorText(error);
      if (isDefinitelyPreSendBusy(message)) {
        await this.prisma.$transaction([
          this.prisma.lineChatMessageSendJob.update({
            where: { id: job.id },
            data: {
              status: LineChatMessageSendJobStatus.QUEUED,
              scheduledAt: new Date(Date.now() + 3_000),
              workerId: null,
              claimedAt: null,
              lockedUntil: null,
              lastError: message.slice(0, 500),
            },
          }),
          this.prisma.messageDeliveryAttempt.update({
            where: { id: attempt.id },
            data: {
              status: MessageDeliveryAttemptStatus.FAILED,
              finishedAt: new Date(),
              failureReason: "PROFILE_BUSY_BEFORE_SEND",
            },
          }),
        ]);
        return;
      }

      if (isNonRetryableBeforeSend(message)) {
        await this.markFailed(job.id, attempt.id, message);
        return;
      }

      // Any ambiguous transport/composer/verification error is verify-only.
      // Never issue another customer-facing send automatically.
      await this.prisma.$transaction([
        this.prisma.lineChatMessageSendJob.update({
          where: { id: job.id },
          data: {
            status: LineChatMessageSendJobStatus.VERIFY_PENDING,
            scheduledAt: new Date(Date.now() + VERIFY_BACKOFF_MS[0]),
            verifyAttemptCount: 0,
            workerId: null,
            claimedAt: null,
            lockedUntil: null,
            lastError: message.slice(0, 500),
          },
        }),
        this.prisma.messageDeliveryAttempt.update({
          where: { id: attempt.id },
          data: {
            status: MessageDeliveryAttemptStatus.VERIFY_PENDING,
            failureReason: message.slice(0, 500),
          },
        }),
        this.prisma.message.update({
          where: { id: job.messageId },
          data: {
            deliveryStatus: MessageDeliveryStatus.PENDING,
            rawPayload: {
              ...jsonObject(job.message.rawPayload),
              queueState: "VERIFY_PENDING",
              lastSendError: message.slice(0, 500),
            },
          },
        }),
      ]);
    }
  }

  private async processVerification(jobId: string): Promise<void> {
    const job = await this.prisma.lineChatMessageSendJob.findUnique({
      where: { id: jobId },
      include: {
        message: {
          select: {
            id: true,
            originalText: true,
            rawPayload: true,
            senderUserId: true,
            senderDisplayName: true,
            sentAt: true,
          },
        },
        attempts: {
          where: { status: MessageDeliveryAttemptStatus.VERIFY_PENDING },
          orderBy: { attemptNo: "desc" },
          take: 1,
        },
      },
    });
    if (!job) return;

    const verifyNo = job.verifyAttemptCount + 1;
    const after = job.sendStartedAt ?? job.claimedAt ?? job.createdAt;

    try {
      const result = await this.managerRelay.inspectTextPresenceSince({
        conversationId: job.conversationId,
        text: job.message.originalText,
        after,
      });

      if (result.handled && result.presence === "PRESENT") {
        await this.markDelivered(
          job.id,
          job.attempts[0]?.id ?? null,
          result.managerMessageId,
          result.managerSentAt ?? new Date(),
        );
        return;
      }

      if (verifyNo < MAX_VERIFY_ATTEMPTS) {
        const delay = VERIFY_BACKOFF_MS[Math.min(verifyNo, VERIFY_BACKOFF_MS.length - 1)];
        await this.prisma.lineChatMessageSendJob.update({
          where: { id: job.id },
          data: {
            status: LineChatMessageSendJobStatus.VERIFY_PENDING,
            verifyAttemptCount: verifyNo,
            lastVerifiedAt: new Date(),
            scheduledAt: new Date(Date.now() + delay),
            workerId: null,
            claimedAt: null,
            lockedUntil: null,
            lastError: result.handled ? result.presence : "VERIFY_NOT_HANDLED",
          },
        });
        return;
      }

      await this.markFailed(
        job.id,
        job.attempts[0]?.id ?? null,
        "LINE_MANAGER_MESSAGE_NOT_FOUND_AFTER_VERIFY_WINDOW",
      );
    } catch (error) {
      const message = errorText(error);
      if (verifyNo < MAX_VERIFY_ATTEMPTS) {
        const delay = VERIFY_BACKOFF_MS[Math.min(verifyNo, VERIFY_BACKOFF_MS.length - 1)];
        await this.prisma.lineChatMessageSendJob.update({
          where: { id: job.id },
          data: {
            status: LineChatMessageSendJobStatus.VERIFY_PENDING,
            verifyAttemptCount: verifyNo,
            lastVerifiedAt: new Date(),
            scheduledAt: new Date(Date.now() + delay),
            workerId: null,
            claimedAt: null,
            lockedUntil: null,
            lastError: message.slice(0, 500),
          },
        });
        return;
      }
      await this.markFailed(job.id, job.attempts[0]?.id ?? null, message);
    }
  }

  private async supersedeWithManagerReplies(
    jobId: string,
    events: ManagerOutboundEvent[],
  ): Promise<void> {
    const job = await this.prisma.lineChatMessageSendJob.findUnique({
      where: { id: jobId },
      include: {
        message: {
          select: {
            id: true,
            conversationId: true,
            rawPayload: true,
            senderUserId: true,
            senderDisplayName: true,
          },
        },
        conversation: {
          select: {
            id: true,
            bmReplyStatus: true,
            followUpStatus: true,
            latestMessageAt: true,
          },
        },
      },
    });
    if (!job) return;

    const ownerNames = [...new Set(
      events
        .map((event) => event.ownerName?.trim())
        .filter((name): name is string => Boolean(name)),
    )];
    const users = ownerNames.length > 0
      ? await this.prisma.user.findMany({
          where: {
            displayName: { in: ownerNames },
            isActive: true,
          },
          select: { id: true, displayName: true },
        })
      : [];
    const userByName = new Map(users.map((user) => [user.displayName.trim(), user]));

    let latestImportedAt = job.conversation.latestMessageAt;
    let latestAttributed: {
      userId: string;
      displayName: string;
      sentAt: Date;
    } | null = null;

    await this.prisma.$transaction(async (tx) => {
      for (const event of events) {
        const externalMessageId = `line-chat-manager:${event.managerMessageId}`;
        const matchedUser = event.ownerName
          ? userByName.get(event.ownerName.trim())
          : undefined;

        await tx.message.upsert({
          where: { externalMessageId },
          update: {
            deliveryStatus: MessageDeliveryStatus.DELIVERED,
            originalText: event.text,
            sentAt: event.sentAt,
            senderUserId: matchedUser?.id ?? undefined,
            senderDisplayName: matchedUser?.displayName
              ?? event.ownerName
              ?? "LINE OA Manager",
            rawPayload: {
              provider: "LINE_MANAGER",
              source: "LINE_CHAT_MANAGER_RECONCILIATION",
              managerMessageId: event.managerMessageId,
              managerBizId: event.bizId,
              reconciledAt: new Date().toISOString(),
            },
          },
          create: {
            conversationId: job.conversationId,
            externalMessageId,
            direction: "OUTBOUND",
            deliveryStatus: MessageDeliveryStatus.DELIVERED,
            messageType: "TEXT",
            originalText: event.text,
            sentAt: event.sentAt,
            senderUserId: matchedUser?.id ?? null,
            senderDisplayName: matchedUser?.displayName
              ?? event.ownerName
              ?? "LINE OA Manager",
            rawPayload: {
              provider: "LINE_MANAGER",
              source: "LINE_CHAT_MANAGER_RECONCILIATION",
              managerMessageId: event.managerMessageId,
              managerBizId: event.bizId,
              reconciledAt: new Date().toISOString(),
            },
          },
        });

        if (event.sentAt > latestImportedAt) latestImportedAt = event.sentAt;
        if (
          matchedUser
          && (!latestAttributed || event.sentAt > latestAttributed.sentAt)
        ) {
          latestAttributed = {
            userId: matchedUser.id,
            displayName: matchedUser.displayName,
            sentAt: event.sentAt,
          };
        }
      }

      await tx.message.update({
        where: { id: job.messageId },
        data: {
          deliveryStatus: MessageDeliveryStatus.FAILED,
          rawPayload: {
            ...jsonObject(job.message.rawPayload),
            queueState: "SUPERSEDED",
            hiddenFromTimeline: true,
            supersededAt: new Date().toISOString(),
            supersededByManagerMessageIds: events.map(
              (event) => event.managerMessageId,
            ),
          },
        },
      });

      await tx.lineChatMessageSendJob.update({
        where: { id: job.id },
        data: {
          status: LineChatMessageSendJobStatus.FAILED,
          completedAt: new Date(),
          workerId: null,
          claimedAt: null,
          lockedUntil: null,
          lastError: "SUPERSEDED_BY_MANAGER_REPLY",
        },
      });

      await tx.conversation.update({
        where: { id: job.conversationId },
        data: {
          latestMessageAt: latestImportedAt,
        },
      });

      if (latestAttributed) {
        await persistStaffOutboundReplyState(tx, {
          conversationId: job.conversationId,
          previousBmReplyStatus: job.conversation.bmReplyStatus,
          previousFollowUpStatus: job.conversation.followUpStatus,
          actor: {
            id: latestAttributed.userId,
            displayName: latestAttributed.displayName,
          },
          sentAt: latestAttributed.sentAt,
          description: "Reconciled staff reply already present in LINE OA Manager; stale retry suppressed",
        });
      }
    });

    this.logger.log(JSON.stringify({
      event: "line_chat_message_retry_suppressed_by_manager_reply",
      jobId: job.id,
      messageId: job.messageId,
      conversationId: job.conversationId,
      importedCount: events.length,
      attributed: Boolean(latestAttributed),
    }));
  }

  private async markDelivered(
    jobId: string,
    attemptId: string | null,
    managerMessageId: string | null,
    confirmedAt: Date,
  ): Promise<void> {
    const job = await this.prisma.lineChatMessageSendJob.findUnique({
      where: { id: jobId },
      include: {
        message: {
          select: {
            id: true,
            conversationId: true,
            rawPayload: true,
            senderUserId: true,
            senderDisplayName: true,
          },
        },
        conversation: {
          select: {
            id: true,
            bmReplyStatus: true,
            followUpStatus: true,
          },
        },
      },
    });
    if (!job) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.message.update({
        where: { id: job.messageId },
        data: {
          deliveryStatus: MessageDeliveryStatus.DELIVERED,
          sentAt: confirmedAt,
          rawPayload: {
            ...jsonObject(job.message.rawPayload),
            queueState: "DELIVERED",
            confirmedAt: confirmedAt.toISOString(),
            managerMessageId,
          },
        },
      });
      await tx.lineChatMessageSendJob.update({
        where: { id: job.id },
        data: {
          status: LineChatMessageSendJobStatus.DELIVERED,
          managerMessageId,
          lastVerifiedAt: confirmedAt,
          completedAt: new Date(),
          workerId: null,
          claimedAt: null,
          lockedUntil: null,
          lastError: null,
        },
      });
      if (attemptId) {
        await tx.messageDeliveryAttempt.update({
          where: { id: attemptId },
          data: {
            status: MessageDeliveryAttemptStatus.DELIVERED,
            verifiedAt: confirmedAt,
            finishedAt: new Date(),
            managerMessageId,
            failureReason: null,
          },
        });
      }

      if (job.message.senderUserId) {
        await persistStaffOutboundReplyState(tx, {
          conversationId: job.conversationId,
          previousBmReplyStatus: job.conversation.bmReplyStatus,
          previousFollowUpStatus: job.conversation.followUpStatus,
          actor: {
            id: job.message.senderUserId,
            displayName: job.message.senderDisplayName?.trim() || "Staff",
          },
          sentAt: confirmedAt,
          description: "Customer message confirmed by LINE OA Manager message history",
        });
      }
    });

    this.logger.log(JSON.stringify({
      event: "line_chat_message_send_delivered",
      jobId: job.id,
      messageId: job.messageId,
      conversationId: job.conversationId,
      managerMessageId,
    }));
  }

  private async markFailed(
    jobId: string,
    attemptId: string | null,
    reason: string,
  ): Promise<void> {
    const job = await this.prisma.lineChatMessageSendJob.findUnique({
      where: { id: jobId },
      include: { message: { select: { id: true, rawPayload: true } } },
    });
    if (!job) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.message.update({
        where: { id: job.messageId },
        data: {
          deliveryStatus: MessageDeliveryStatus.FAILED,
          rawPayload: {
            ...jsonObject(job.message.rawPayload),
            queueState: "FAILED",
            failedAt: new Date().toISOString(),
            error: reason.slice(0, 500),
          },
        },
      });
      await tx.lineChatMessageSendJob.update({
        where: { id: job.id },
        data: {
          status: LineChatMessageSendJobStatus.FAILED,
          completedAt: new Date(),
          workerId: null,
          claimedAt: null,
          lockedUntil: null,
          lastError: reason.slice(0, 500),
        },
      });
      if (attemptId) {
        await tx.messageDeliveryAttempt.update({
          where: { id: attemptId },
          data: {
            status: MessageDeliveryAttemptStatus.FAILED,
            finishedAt: new Date(),
            failureReason: reason.slice(0, 500),
          },
        });
      }
    });

    this.logger.warn(JSON.stringify({
      event: "line_chat_message_send_failed",
      jobId: job.id,
      messageId: job.messageId,
      conversationId: job.conversationId,
      reason: reason.slice(0, 250),
    }));
  }
}
