import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import {
  LineChatMessageSendJobStatus,
  LineChatSessionStatus,
  MessageDeliveryStatus,
  MessageDirection,
  MessageType,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma.service";
import {
  getLineChatManagerRelayStoreConfig,
  isLineChatDurableSendQueueStoreEnabled,
  isLineChatManagerRelayStoreEnabled,
} from "./line-chat-pilot.constants";

export type DurableManagerQueueResult =
  | { handled: false }
  | {
      handled: true;
      duplicate: boolean;
      message: {
        id: string;
        conversationId: string;
        externalMessageId: string | null;
        direction: MessageDirection;
        deliveryStatus: MessageDeliveryStatus;
        messageType: MessageType;
        originalText: string;
        senderUserId: string | null;
        senderDisplayName: string | null;
        sentAt: Date;
        createdAt: Date;
        rawPayload: Prisma.JsonValue | null;
      };
      jobId: string;
    };

type QueueActor = {
  id: string;
  displayName?: string | null;
};

@Injectable()
export class LineChatMessageSendQueueService {
  constructor(private readonly prisma: PrismaService) {}

  enabled(): boolean {
    return process.env.LINE_CHAT_DURABLE_SEND_QUEUE_ENABLED === "true";
  }

  isStoreEnabled(storeCode: string | null | undefined): boolean {
    return isLineChatDurableSendQueueStoreEnabled(storeCode);
  }

  async enqueueText(input: {
    conversationId: string;
    text: string;
    idempotencyKey: string;
    actor: QueueActor;
  }): Promise<DurableManagerQueueResult> {
    if (!this.enabled()) return { handled: false };

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: input.conversationId },
      select: {
        id: true,
        storeId: true,
        latestMessageAt: true,
        lineChatUserId: true,
        store: {
          select: {
            code: true,
            name: true,
            storeMaster: { select: { externalStoreId: true } },
          },
        },
        lineOfficialAccount: {
          select: {
            id: true,
            name: true,
            storeId: true,
            accountType: true,
            isActive: true,
            archivedAt: true,
            chatBotId: true,
            lineChatSession: {
              select: {
                id: true,
                sessionKey: true,
                status: true,
              },
            },
          },
        },
      },
    });
    if (!conversation) return { handled: false };

    const storeCode = conversation.store?.code?.trim()
      || conversation.store?.storeMaster?.externalStoreId?.trim()
      || "";
    if (!this.isStoreEnabled(storeCode)) return { handled: false };
    if (!isLineChatManagerRelayStoreEnabled(storeCode)) return { handled: false };

    const config = getLineChatManagerRelayStoreConfig(storeCode);
    const oa = conversation.lineOfficialAccount;
    const session = oa.lineChatSession;
    if (
      !config
      || conversation.storeId !== oa.storeId
      || oa.accountType !== "STORE"
      || !oa.isActive
      || oa.archivedAt !== null
      || oa.name.trim() !== config.storeName
      || !oa.chatBotId?.trim()
      || ("expectedBotId" in config && oa.chatBotId.trim() !== config.expectedBotId)
      || !session
      || session.sessionKey.trim() !== config.sessionKey
      || session.status !== LineChatSessionStatus.ACTIVE
    ) {
      throw new ServiceUnavailableException(
        `การตั้งค่า LINE OA Manager ของร้าน ${storeCode} ไม่พร้อมใช้งาน`,
      );
    }

    const dedupeExternalId = `outbound:${input.idempotencyKey}`;
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.message.findUnique({
        where: { externalMessageId: dedupeExternalId },
      });

      if (existing) {
        const existingJob = await tx.lineChatMessageSendJob.findUnique({
          where: { messageId: existing.id },
        });

        if (existing.deliveryStatus === MessageDeliveryStatus.DELIVERED) {
          return {
            handled: true as const,
            duplicate: true,
            message: existing,
            jobId: existingJob?.id ?? "",
          };
        }

        const message = await tx.message.update({
          where: { id: existing.id },
          data: {
            deliveryStatus: MessageDeliveryStatus.PENDING,
            senderUserId: input.actor.id,
            senderDisplayName: input.actor.displayName?.trim() || "Store",
            rawPayload: {
              provider: "LINE_MANAGER",
              deliveryMethod: "MANAGER_QUEUE",
              queueState: "QUEUED",
              queuedAt: now.toISOString(),
            },
          },
        });

        const job = existingJob
          ? await tx.lineChatMessageSendJob.update({
              where: { id: existingJob.id },
              data: {
                lineChatUserId: conversation.lineChatUserId,
                status: LineChatMessageSendJobStatus.QUEUED,
                scheduledAt: now,
                claimedAt: null,
                lockedUntil: null,
                workerId: null,
                lastError: null,
                completedAt: null,
              },
            })
          : await tx.lineChatMessageSendJob.create({
              data: {
                messageId: message.id,
                conversationId: conversation.id,
                lineOfficialAccountId: oa.id,
                lineChatSessionId: session.id,
                lineChatUserId: conversation.lineChatUserId,
                idempotencyKey: input.idempotencyKey,
                // A legacy FAILED row predates the durable queue. Seed one
                // historical attempt so the worker performs Manager-history
                // precheck before any customer-facing retry.
                attemptCount:
                  existing.deliveryStatus === MessageDeliveryStatus.FAILED
                    ? 1
                    : 0,
                lastError:
                  existing.deliveryStatus === MessageDeliveryStatus.FAILED
                    ? "LEGACY_FAILED_RETRY_REQUIRES_PRECHECK"
                    : null,
              },
            });

        if (conversation.latestMessageAt < message.sentAt) {
          await tx.conversation.update({
            where: { id: conversation.id },
            data: { latestMessageAt: message.sentAt },
          });
        }

        return {
          handled: true as const,
          duplicate: true,
          message,
          jobId: job.id,
        };
      }

      const message = await tx.message.create({
        data: {
          conversationId: conversation.id,
          externalMessageId: dedupeExternalId,
          direction: MessageDirection.OUTBOUND,
          deliveryStatus: MessageDeliveryStatus.PENDING,
          messageType: MessageType.TEXT,
          originalText: input.text,
          senderUserId: input.actor.id,
          senderDisplayName: input.actor.displayName?.trim() || "Store",
          sentAt: now,
          rawPayload: {
            provider: "LINE_MANAGER",
            deliveryMethod: "MANAGER_QUEUE",
            queueState: "QUEUED",
            queuedAt: now.toISOString(),
          },
        },
      });

      const job = await tx.lineChatMessageSendJob.create({
        data: {
          messageId: message.id,
          conversationId: conversation.id,
          lineOfficialAccountId: oa.id,
          lineChatSessionId: session.id,
          lineChatUserId: conversation.lineChatUserId,
          idempotencyKey: input.idempotencyKey,
        },
      });

      if (conversation.latestMessageAt < now) {
        await tx.conversation.update({
          where: { id: conversation.id },
          data: { latestMessageAt: now },
        });
      }

      return {
        handled: true as const,
        duplicate: false,
        message,
        jobId: job.id,
      };
    });
  }
}
