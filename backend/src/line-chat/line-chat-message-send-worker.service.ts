import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  ActivityActionType,
  BmReplyStatus,
  FollowUpStatus,
  LineChatMessageSendJobStatus,
  MessageDeliveryAttemptStatus,
  MessageDeliveryStatus,
  MessageDirection,
  MessageType,
  Prisma,
} from "@prisma/client";
import { hostname } from "node:os";
import { PrismaService } from "../prisma.service";
import { persistStaffOutboundReplyState } from "../conversation-reply-state";
import { LineChatManagerMessageRelayWorkerService } from "./line-chat-manager-message-relay-worker.service";
import { LineChatRecentResolverService } from "./line-chat-recent-resolver.service";
import {
  isLineChatCanaryPreSendFailureEnabled,
  isLineChatDurableSendQueueConversationEnabled,
  isLineChatMirrorOnlyStore,
} from "./line-chat-pilot.constants";

const POLL_INTERVAL_MS = 1_500;
const JOB_LEASE_MS = 90_000;
const MAX_PARALLEL_PROFILES = 4;
const VERIFY_BACKOFF_MS = [3_000, 5_000, 10_000, 20_000] as const;
const MAX_VERIFY_ATTEMPTS = VERIFY_BACKOFF_MS.length;
const FAILED_REPLY_RECONCILIATION_DELAY_MS = 12_000;
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

function configuredFailedReplyReconciliationConversationIds(): string[] {
  const raw = process.env.LINE_CHAT_FAILED_REPLY_RECONCILIATION_CONVERSATION_IDS?.trim();
  if (!raw) return [];
  return [...new Set(
    raw
      .split(/[\s,;]+/u)
      .map((value) => value.trim())
      .filter(Boolean),
  )];
}

function managerEventMessageType(value: string): MessageType {
  switch (value.trim().toLowerCase()) {
    case "text": return MessageType.TEXT;
    case "image": return MessageType.IMAGE;
    case "video": return MessageType.VIDEO;
    case "audio": return MessageType.AUDIO;
    case "file": return MessageType.FILE;
    case "location": return MessageType.LOCATION;
    case "sticker": return MessageType.STICKER;
    default: return MessageType.UNSUPPORTED;
  }
}

type ManagerOutboundEvent = {
  managerMessageId: string;
  messageType: string;
  text: string;
  fileName: string | null;
  sentAt: Date;
  bizId: string | null;
  ownerName: string | null;
};

function hasManagerDeliveryEvidence(input: {
  managerMessageId: string | null;
  managerSentAt: Date | null;
}): input is { managerMessageId: string; managerSentAt: Date } {
  return Boolean(
    input.managerMessageId?.trim()
    && input.managerSentAt instanceof Date
    && Number.isFinite(input.managerSentAt.getTime()),
  );
}

@Injectable()
export class LineChatMessageSendWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LineChatMessageSendWorkerService.name);
  private readonly workerId = `${process.env.RAILWAY_SERVICE_NAME?.trim() || "local"}:${process.env.RAILWAY_REPLICA_ID?.trim() || hostname()}:${process.pid}:send-queue`;
  private timer: NodeJS.Timeout | null = null;
  private reconciliationTimer: NodeJS.Timeout | null = null;
  private processing = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LineChatManagerMessageRelayWorkerService)
    private readonly managerRelay: LineChatManagerMessageRelayWorkerService,
    @Inject(LineChatRecentResolverService)
    private readonly recentResolver: LineChatRecentResolverService,
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

    if (configuredFailedReplyReconciliationConversationIds().length > 0) {
      this.reconciliationTimer = setTimeout(
        () => void this.reconcileConfiguredFailedReplies(),
        FAILED_REPLY_RECONCILIATION_DELAY_MS,
      );
      this.reconciliationTimer.unref?.();
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.reconciliationTimer) clearTimeout(this.reconciliationTimer);
    this.timer = null;
    this.reconciliationTimer = null;
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

  public async reconcileConfiguredFailedReplies(): Promise<void> {
    const conversationIds = configuredFailedReplyReconciliationConversationIds();
    if (conversationIds.length === 0) return;

    this.logger.log(JSON.stringify({
      event: "line_chat_failed_reply_reconciliation_started",
      conversationCount: conversationIds.length,
    }));

    for (const conversationId of conversationIds) {
      try {
        await this.reconcileFailedConversation(conversationId);
      } catch (error) {
        this.logger.warn(JSON.stringify({
          event: "line_chat_failed_reply_reconciliation_failed",
          conversationId,
          error: errorText(error).slice(0, 500),
        }));
      }
    }
  }

  private async reconcileFailedConversation(conversationId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        lineChatUserId: true,
      },
    });
    if (!conversation) {
      this.logger.warn(JSON.stringify({
        event: "line_chat_failed_reply_reconciliation_skipped",
        conversationId,
        reason: "CONVERSATION_NOT_FOUND",
      }));
      return;
    }

    if (!conversation.lineChatUserId?.trim()) {
      const resolution = await this.recentResolver.resolveUniqueNameForReconciliation(conversationId);
      if (resolution.status !== "RESOLVED") {
        this.logger.warn(JSON.stringify({
          event: "line_chat_failed_reply_reconciliation_skipped",
          conversationId,
          reason: resolution.status,
        }));
        return;
      }
    }

    const failedMessages = await this.prisma.message.findMany({
      where: {
        conversationId,
        direction: MessageDirection.OUTBOUND,
        deliveryStatus: MessageDeliveryStatus.FAILED,
      },
      orderBy: [{ sentAt: "asc" }, { id: "asc" }],
      take: 50,
      select: {
        id: true,
        sentAt: true,
        rawPayload: true,
      },
    });
    const visibleFailedMessages = failedMessages.filter(
      (message) => jsonObject(message.rawPayload).hiddenFromTimeline !== true,
    );
    if (visibleFailedMessages.length === 0) {
      this.logger.log(JSON.stringify({
        event: "line_chat_failed_reply_reconciliation_completed",
        conversationId,
        failedMessagesChecked: failedMessages.length,
        reconciled: 0,
        reason: "NO_VISIBLE_FAILED_MESSAGES",
      }));
      return;
    }

    const earliestFailedAt = visibleFailedMessages[0].sentAt;
    const latestFailedAt = visibleFailedMessages[visibleFailedMessages.length - 1].sentAt;
    const inboundAnchor = await this.prisma.message.findFirst({
      where: {
        conversationId,
        direction: MessageDirection.INBOUND,
        sentAt: { lte: earliestFailedAt },
      },
      orderBy: [{ sentAt: "desc" }, { id: "desc" }],
      select: { sentAt: true },
    });
    if (!inboundAnchor) {
      this.logger.warn(JSON.stringify({
        event: "line_chat_failed_reply_reconciliation_skipped",
        conversationId,
        reason: "NO_INBOUND_ANCHOR",
      }));
      return;
    }

    const activity = await this.managerRelay.inspectOutboundActivitySince({
      conversationId,
      after: inboundAnchor.sentAt,
    });
    if (!activity.handled || activity.events.length === 0) {
      this.logger.warn(JSON.stringify({
        event: "line_chat_failed_reply_reconciliation_skipped",
        conversationId,
        reason: activity.handled ? "NO_MANAGER_OUTBOUND_EVIDENCE" : "MANAGER_INSPECTION_NOT_HANDLED",
      }));
      return;
    }

    const upperBound = new Date(latestFailedAt.getTime() + 5 * 60_000);
    const relevantEvents = activity.events.filter(
      (event) => event.sentAt >= inboundAnchor.sentAt && event.sentAt <= upperBound,
    );
    if (relevantEvents.length === 0) {
      this.logger.warn(JSON.stringify({
        event: "line_chat_failed_reply_reconciliation_skipped",
        conversationId,
        reason: "NO_MANAGER_OUTBOUND_IN_REPLY_WINDOW",
        managerEventsObserved: activity.events.length,
      }));
      return;
    }

    await this.reconcileMessagesFromManagerHistory({
      conversationId,
      failedMessages: visibleFailedMessages,
      events: relevantEvents,
    });

    this.logger.log(JSON.stringify({
      event: "line_chat_failed_reply_reconciliation_completed",
      conversationId,
      failedMessagesChecked: visibleFailedMessages.length,
      managerEventsImported: relevantEvents.length,
      reconciled: visibleFailedMessages.length,
    }));
  }

  private async reconcileMessagesFromManagerHistory(input: {
    conversationId: string;
    failedMessages: Array<{
      id: string;
      sentAt: Date;
      rawPayload: Prisma.JsonValue | null;
    }>;
    events: ManagerOutboundEvent[];
  }): Promise<void> {
    if (input.failedMessages.length === 0 || input.events.length === 0) return;

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: input.conversationId },
      select: {
        id: true,
        bmReplyStatus: true,
        followUpStatus: true,
        latestMessageAt: true,
      },
    });
    if (!conversation) return;

    const latestInbound = await this.prisma.message.findFirst({
      where: {
        conversationId: input.conversationId,
        direction: MessageDirection.INBOUND,
      },
      orderBy: [{ sentAt: "desc" }, { id: "desc" }],
      select: { sentAt: true },
    });
    const latestNonFailed = await this.prisma.message.findFirst({
      where: {
        conversationId: input.conversationId,
        NOT: {
          direction: MessageDirection.OUTBOUND,
          deliveryStatus: MessageDeliveryStatus.FAILED,
        },
      },
      orderBy: [{ sentAt: "desc" }, { id: "desc" }],
      select: { sentAt: true },
    });

    const ownerNames = [...new Set(
      input.events
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

    let latestImportedAt = latestNonFailed?.sentAt ?? input.events[0].sentAt;
    let latestAttributed: {
      userId: string;
      displayName: string;
      sentAt: Date;
    } | null = null;

    for (const event of input.events) {
      if (event.sentAt > latestImportedAt) latestImportedAt = event.sentAt;
      const matchedUser = event.ownerName
        ? userByName.get(event.ownerName.trim())
        : undefined;
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

    const latestManagerEvent = input.events.reduce(
      (latest, event) => event.sentAt > latest.sentAt ? event : latest,
      input.events[0],
    );
    const replyCoversLatestInbound = !latestInbound
      || latestManagerEvent.sentAt >= latestInbound.sentAt;
    const reconciledAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      for (const event of input.events) {
        const externalMessageId = `line-chat-manager:${event.managerMessageId}`;
        const matchedUser = event.ownerName
          ? userByName.get(event.ownerName.trim())
          : undefined;

        await tx.message.upsert({
          where: { externalMessageId },
          update: {
            deliveryStatus: MessageDeliveryStatus.DELIVERED,
            messageType: managerEventMessageType(event.messageType),
            originalText: event.text,
            fileName: event.fileName,
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
              reconciledAt: reconciledAt.toISOString(),
            },
          },
          create: {
            conversationId: input.conversationId,
            externalMessageId,
            direction: MessageDirection.OUTBOUND,
            deliveryStatus: MessageDeliveryStatus.DELIVERED,
            messageType: managerEventMessageType(event.messageType),
            originalText: event.text,
            fileName: event.fileName,
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
              reconciledAt: reconciledAt.toISOString(),
            },
          },
        });
      }

      for (const failedMessage of input.failedMessages) {
        await tx.message.update({
          where: { id: failedMessage.id },
          data: {
            deliveryStatus: MessageDeliveryStatus.FAILED,
            rawPayload: {
              ...jsonObject(failedMessage.rawPayload),
              queueState: "SUPERSEDED",
              hiddenFromTimeline: true,
              supersededAt: reconciledAt.toISOString(),
              supersededByManagerMessageIds: input.events.map(
                (event) => event.managerMessageId,
              ),
            },
          },
        });
      }

      await tx.lineChatMessageSendJob.updateMany({
        where: {
          conversationId: input.conversationId,
          messageId: { in: input.failedMessages.map((message) => message.id) },
        },
        data: {
          status: LineChatMessageSendJobStatus.FAILED,
          completedAt: reconciledAt,
          workerId: null,
          claimedAt: null,
          lockedUntil: null,
          lastError: "SUPERSEDED_BY_MANAGER_REPLY",
        },
      });

      await tx.conversation.update({
        where: { id: input.conversationId },
        data: {
          latestMessageAt: latestImportedAt,
          ...(replyCoversLatestInbound && !latestAttributed
            ? {
                bmReplyStatus: BmReplyStatus.REPLIED,
                followUpStatus: FollowUpStatus.COMPLETED,
              }
            : {}),
        },
      });

      if (replyCoversLatestInbound && latestAttributed) {
        await persistStaffOutboundReplyState(tx, {
          conversationId: input.conversationId,
          previousBmReplyStatus: conversation.bmReplyStatus,
          previousFollowUpStatus: conversation.followUpStatus,
          actor: {
            id: latestAttributed.userId,
            displayName: latestAttributed.displayName,
          },
          sentAt: latestAttributed.sentAt,
          description: "Reconciled staff reply already present in LINE OA Manager; failed black-app bubble hidden",
        });
      } else if (
        replyCoversLatestInbound
        && (
          conversation.bmReplyStatus !== BmReplyStatus.REPLIED
          || conversation.followUpStatus !== FollowUpStatus.COMPLETED
        )
      ) {
        await tx.activityHistory.create({
          data: {
            conversationId: input.conversationId,
            actionType: ActivityActionType.STATUS_CHANGED,
            previousStatus: conversation.followUpStatus,
            newStatus: FollowUpStatus.COMPLETED,
            previousBmReplyStatus: conversation.bmReplyStatus,
            newBmReplyStatus: BmReplyStatus.REPLIED,
            createdByName: latestManagerEvent.ownerName?.trim() || "LINE OA Manager",
            description: "Reconciled human reply already present in LINE OA Manager; failed black-app bubble hidden",
            metadata: {
              source: "LINE_CHAT_MANAGER_RECONCILIATION",
              managerMessageIds: input.events.map((event) => event.managerMessageId),
              hiddenFailedMessageIds: input.failedMessages.map((message) => message.id),
            },
          },
        });
      }
    });

    this.logger.log(JSON.stringify({
      event: "line_chat_failed_reply_reconciled_from_manager_history",
      conversationId: input.conversationId,
      hiddenFailedMessageCount: input.failedMessages.length,
      importedManagerMessageCount: input.events.length,
      replyCoversLatestInbound,
      attributed: Boolean(latestAttributed),
    }));
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

    if (await this.cancelMirrorOnlyJob(job.id)) {
      return true;
    }

    if (job.status === LineChatMessageSendJobStatus.VERIFY_PENDING) {
      await this.processVerification(job.id);
    } else {
      await this.processSend(job.id);
    }
    return true;
  }

  private async cancelMirrorOnlyJob(jobId: string): Promise<boolean> {
    const job = await this.prisma.lineChatMessageSendJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        conversationId: true,
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
      },
    });
    if (!job) return true;

    const storeCode = job.conversation?.store?.code?.trim()
      || job.conversation?.store?.storeMaster?.externalStoreId?.trim()
      || "";
    if (!isLineChatMirrorOnlyStore(storeCode)) return false;

    const completedAt = new Date();
    await this.prisma.lineChatMessageSendJob.update({
      where: { id: job.id },
      data: {
        status: LineChatMessageSendJobStatus.FAILED,
        completedAt,
        workerId: null,
        claimedAt: null,
        lockedUntil: null,
        lastError: "MIRROR_ONLY_CUTOVER_CANCELLED_NO_SEND",
      },
    });
    this.logger.warn(JSON.stringify({
      event: "line_chat_message_send_job_cancelled_mirror_only",
      jobId: job.id,
      conversationId: job.conversationId,
      storeCode,
      completedAt: completedAt.toISOString(),
    }));
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
    if (!isLineChatDurableSendQueueConversationEnabled({
      storeCode,
      conversationId: job.conversationId,
    })) {
      this.logger.warn(JSON.stringify({
        event: "line_chat_message_send_job_conversation_not_allowlisted",
        jobId: job.id,
        conversationId: job.conversationId,
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
    let sendActionInitiated = false;
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
          sendActionAt: null,
        },
      });
    });

    try {
      if (isLineChatCanaryPreSendFailureEnabled({
        storeCode,
        conversationId: job.conversationId,
        text: job.message.originalText,
      })) {
        this.logger.warn(JSON.stringify({
          event: "line_chat_manager_test_controlled_pre_send_failure",
          jobId: job.id,
          conversationId: job.conversationId,
          storeCode,
          text: job.message.originalText,
        }));
        throw new Error("CONTROLLED_CANARY_PRE_SEND_FAILURE: simulated pre-send failure for configured test text");
      }

      const result = await this.managerRelay.relayText({
        conversationId: job.conversationId,
        text: job.message.originalText,
        idempotencyKey: job.idempotencyKey,
        onSendAction: async (actionAt: Date) => {
          sendActionInitiated = true;
          await this.prisma.messageDeliveryAttempt.update({
            where: { id: attempt.id },
            data: { sendActionAt: actionAt },
          });
        },
      });
      if (!result.handled) {
        throw new Error("MANAGER_RELAY_NOT_HANDLED");
      }
      if (!hasManagerDeliveryEvidence(result)) {
        throw new Error("MANAGER_DELIVERY_EVIDENCE_REQUIRED");
      }
      await this.markDelivered(job.id, attempt.id, result.managerMessageId, result.managerSentAt);
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

      // If customer-facing send action was NEVER initiated, this is definitely a pre-send failure.
      // Must fail closed with attempt status FAILED and sendActionAt = null.
      if (!sendActionInitiated) {
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

      if (
        result.handled
        && result.presence === "PRESENT"
        && hasManagerDeliveryEvidence(result)
      ) {
        await this.markDelivered(
          job.id,
          job.attempts[0]?.id ?? null,
          result.managerMessageId,
          result.managerSentAt,
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
            lastError: result.handled && result.presence === "PRESENT"
              ? "MANAGER_DELIVERY_EVIDENCE_INCOMPLETE"
              : result.handled
                ? result.presence
                : "VERIFY_NOT_HANDLED",
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
            messageType: managerEventMessageType(event.messageType),
            originalText: event.text,
            fileName: event.fileName,
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
            direction: MessageDirection.OUTBOUND,
            deliveryStatus: MessageDeliveryStatus.DELIVERED,
            messageType: managerEventMessageType(event.messageType),
            originalText: event.text,
            fileName: event.fileName,
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
          ...(!latestAttributed
            ? {
                bmReplyStatus: BmReplyStatus.REPLIED,
                followUpStatus: FollowUpStatus.COMPLETED,
              }
            : {}),
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
      } else if (
        job.conversation.bmReplyStatus !== BmReplyStatus.REPLIED
        || job.conversation.followUpStatus !== FollowUpStatus.COMPLETED
      ) {
        const latestEvent = events.reduce(
          (latest, event) => event.sentAt > latest.sentAt ? event : latest,
          events[0],
        );
        await tx.activityHistory.create({
          data: {
            conversationId: job.conversationId,
            actionType: ActivityActionType.STATUS_CHANGED,
            previousStatus: job.conversation.followUpStatus,
            newStatus: FollowUpStatus.COMPLETED,
            previousBmReplyStatus: job.conversation.bmReplyStatus,
            newBmReplyStatus: BmReplyStatus.REPLIED,
            createdByName: latestEvent.ownerName?.trim() || "LINE OA Manager",
            description: "Reconciled human reply already present in LINE OA Manager; stale failed bubble hidden",
            metadata: {
              source: "LINE_CHAT_MANAGER_RECONCILIATION",
              managerMessageIds: events.map((event) => event.managerMessageId),
            },
          },
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
    managerMessageId: string,
    confirmedAt: Date,
  ): Promise<void> {
    const normalizedManagerMessageId = managerMessageId.trim();
    if (!normalizedManagerMessageId) {
      throw new Error("MANAGER_DELIVERY_EVIDENCE_REQUIRED");
    }
    if (!(confirmedAt instanceof Date) || !Number.isFinite(confirmedAt.getTime())) {
      throw new Error("MANAGER_DELIVERY_TIMESTAMP_REQUIRED");
    }

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
            managerMessageId: normalizedManagerMessageId,
          },
        },
      });
      await tx.lineChatMessageSendJob.update({
        where: { id: job.id },
        data: {
          status: LineChatMessageSendJobStatus.DELIVERED,
          managerMessageId: normalizedManagerMessageId,
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
            managerMessageId: normalizedManagerMessageId,
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
      managerMessageId: normalizedManagerMessageId,
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
