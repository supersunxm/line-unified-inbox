import { Injectable, Logger } from "@nestjs/common";
import { ActivityActionType, BmReplyStatus, FollowUpStatus, MessageDirection, MessageType, Prisma, Priority, WebhookProcessingStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../prisma.service";
import { CredentialEncryptionService } from "../../credentials/credential-encryption.service";
import { LineWebhookConfig } from "./line-webhook.config";
import { LineMessage, LineWebhookBody, LineWebhookEvent, messagePlaceholder } from "./line-webhook.types";
import { ClassificationService } from "../../classification/classification.service";
import { LineProfileService } from "../../line-profile.service";
import { LineImageService } from "../../media/line-image.service";
import { getFriendAttributionHashSecret, hashLineUserId } from "../../friend-source-links/friend-attribution.config";
import { NotificationEnqueueService } from "../../notifications/notification-enqueue.service";
import { RealtimeEventService } from "../../realtime/realtime-event.service";

const messageTypeMap: Record<string, MessageType> = {
  text: "TEXT", image: "IMAGE", video: "VIDEO", audio: "AUDIO", file: "FILE", location: "LOCATION", sticker: "STICKER",
};

export type LineCredentialResolution = {
  secret?: string;
  source: "database OA credential" | "none";
  oa?: { id: string; name: string; store: string; isActive?: boolean; isArchived?: boolean };
  channelSecretStored?: boolean;
  channelSecretDecryptable?: boolean;
  reason?: "webhook key not mapped" | "channel secret missing" | "credential decryption failed";
};

@Injectable()
export class LineWebhookService {
  private readonly logger = new Logger(LineWebhookService.name);
  constructor(private readonly prisma: PrismaService, private readonly config: LineWebhookConfig, private readonly encryption: CredentialEncryptionService, private readonly classification: ClassificationService, private readonly profiles: LineProfileService, private readonly images: LineImageService, private readonly notifications?: NotificationEnqueueService, private readonly realtime?: RealtimeEventService) {}

  async accept(payload: LineWebhookBody, resolvedOaId: string) {
    const results: boolean[] = [];
    for (const event of payload.events) results.push(await this.processEvent(payload.destination, event, resolvedOaId));
    const processingFailed = results.some((processed) => !processed);
    await this.prisma.lineOfficialAccount.update({ where: { id: resolvedOaId }, data: { connectionStatus: processingFailed ? "ERROR" : "CONNECTED", lastWebhookReceivedAt: new Date(), lastConnectionError: processingFailed ? "Latest webhook processing failed" : null, destinationId: payload.destination || undefined } });
    return { success: true };
  }

  async resolveSignatureCredentialByWebhookKey(webhookKey: string): Promise<LineCredentialResolution> {
    const oa = await this.prisma.lineOfficialAccount.findUnique({ where: { webhookKey }, include: { store: true } });
    if (!oa) return { source: "none", reason: "webhook key not mapped", channelSecretStored: false, channelSecretDecryptable: false };
    const safeOa = { id: oa.id, name: oa.name, store: oa.store?.name ?? "Main OA", isActive: oa.isActive, isArchived: Boolean(oa.archivedAt) };
    if (!oa.isActive) return { source: "none", oa: safeOa, reason: "webhook key not mapped", channelSecretStored: Boolean(oa.encryptedChannelSecret), channelSecretDecryptable: false };
    if (!oa.encryptedChannelSecret) return { source: "none", oa: safeOa, reason: "channel secret missing", channelSecretStored: false, channelSecretDecryptable: false };
    try { return { secret: this.encryption.decrypt(oa.encryptedChannelSecret), source: "database OA credential", oa: safeOa, channelSecretStored: true, channelSecretDecryptable: true }; }
    catch { return { source: "none", oa: safeOa, reason: "credential decryption failed", channelSecretStored: true, channelSecretDecryptable: false }; }
  }

  private eventId(event: LineWebhookEvent) {
    const messageId = event.type === "message" && "message" in event ? event.message.id : undefined;
    return event.webhookEventId ?? messageId ?? createHash("sha256").update(JSON.stringify(event)).digest("hex");
  }

  private async processEvent(destination: string | undefined, event: LineWebhookEvent, resolvedOaId: string) {
    const externalId = this.eventId(event);
    const messageId = event.type === "message" && "message" in event ? event.message.id : undefined;
    try {
      await this.prisma.webhookEvent.create({ data: { externalWebhookEventId: externalId, externalMessageId: messageId, eventType: event.type, destination, lineOfficialAccountId: resolvedOaId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        this.logger.log(`Duplicate LINE event ignored: ${externalId}`); return true;
      }
      throw error;
    }

    try {
      if (event.type === "follow") await this.processFollow(event, resolvedOaId);
      else if (event.type === "unfollow") { /* Historical data is intentionally retained. */ }
      else if (event.type === "message" && "message" in event) await this.processMessage(destination, event, event.message, resolvedOaId);
      else {
        await this.finish(externalId, "IGNORED");
        this.logger.warn(`Unsupported LINE event ignored: ${externalId} (${event.type})`); return true;
      }
      await this.finish(externalId, "PROCESSED");
      this.logger.log(`LINE event processed: ${externalId} (${event.type}) destination=${destination ?? "none"}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 300) : "Webhook processing failed";
      await this.finish(externalId, "FAILED", message);
      this.logger.warn(`LINE event failed: ${externalId} (${event.type}) destination=${destination ?? "none"}`);
      return false;
    }
  }

  private finish(externalWebhookEventId: string, processingStatus: WebhookProcessingStatus, errorMessage?: string) {
    return this.prisma.webhookEvent.update({ where: { externalWebhookEventId }, data: { processingStatus, errorMessage, processedAt: new Date() } });
  }

  private async processFollow(event: LineWebhookEvent, resolvedOaId: string) {
    if (!event.source.userId) return;
    await this.prisma.customer.upsert({ where: { lineUserId: event.source.userId }, update: {}, create: { lineUserId: event.source.userId, displayName: "LINE Customer" } });

    try {
      const hashSecret = getFriendAttributionHashSecret();
      const lineUserIdHash = hashLineUserId(event.source.userId, hashSecret);

      const recentSession = await this.prisma.friendAttributionSession.findFirst({
        where: {
          lineOaId: resolvedOaId,
          lineUserIdHash,
          attributionStatus: { in: ["IDENTIFIED", "ADD_FRIEND_PROMPTED", "ALREADY_FRIEND", "CLICKED"] },
          expiresAt: { gt: new Date() },
          confirmedFollowAt: null,
        },
        orderBy: { createdAt: "desc" },
      });

      if (recentSession) {
        await this.prisma.friendAttributionSession.update({
          where: { id: recentSession.id },
          data: {
            attributionStatus: "CONFIRMED",
            confirmedFollowAt: new Date(),
            friendshipAfter: true,
          },
        });

        await this.prisma.friendSourceAttribution.create({
          data: {
            friendSourceLinkId: recentSession.friendSourceLinkId,
            lineUserIdHash,
            followedAt: new Date(),
            status: "CONFIRMED",
          },
        });

        this.logger.log(`Friend attribution confirmed for OA ${resolvedOaId} session ${recentSession.id}`);
      } else {
        await this.prisma.friendAttributionUnmatchedFollow.create({
          data: {
            lineOaId: resolvedOaId,
            lineUserIdHash,
            receivedAt: new Date(),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          },
        });
        this.logger.log(`Early unmatched follow event stored for OA ${resolvedOaId}`);
      }
    } catch (err: unknown) {
      this.logger.warn(`Failed to process friend attribution for follow event: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async resolveOa(resolvedOaId: string) {
    const resolved = await this.prisma.lineOfficialAccount.findFirst({ where: { id: resolvedOaId, isActive: true, archivedAt: null }, include: { store: true } });
    if (resolved) return resolved;
    throw new Error("Resolved LINE OA is no longer active");
  }

  private async processMessage(destination: string | undefined, event: LineWebhookEvent, message: LineMessage, resolvedOaId: string) {
    if (!event.source.userId) throw new Error("LINE message has no source.userId");
    const oa = await this.resolveOa(resolvedOaId);
    const sentAt = new Date(event.timestamp);
    const customer = await this.prisma.customer.upsert({ where: { lineUserId: event.source.userId }, update: {}, create: { lineUserId: event.source.userId, displayName: "LINE Customer" } });
    const existing = await this.prisma.conversation.findFirst({ where: { customerId: customer.id, storeId: oa.storeId, lineOfficialAccountId: oa.id }, orderBy: { latestMessageAt: "desc" } });
    const rawPayload = { type: message.type } as Prisma.InputJsonObject;
    const fileName = message.type === "file" && "fileName" in message ? message.fileName : undefined;
    const latitude = message.type === "location" && "latitude" in message ? message.latitude : undefined;
    const longitude = message.type === "location" && "longitude" in message ? message.longitude : undefined;

    const stored = await this.prisma.$transaction(async (tx) => {
      let conversation;
      let prevBmStatus: BmReplyStatus | null = null;
      let shouldResetBm = false;

      if (existing) {
        const currentConv = await tx.conversation.findUnique({ where: { id: existing.id } });
        if (currentConv) {
          prevBmStatus = currentConv.bmReplyStatus;
          shouldResetBm = prevBmStatus !== BmReplyStatus.NOT_REPLIED;
        }
        conversation = await tx.conversation.update({
          where: { id: existing.id },
          data: {
            latestMessageAt: sentAt,
            followUpStatus: FollowUpStatus.FOLLOW_UP,
            ...(shouldResetBm ? { bmReplyStatus: BmReplyStatus.NOT_REPLIED } : {}),
          },
        });
      } else {
        conversation = await tx.conversation.create({
          data: {
            customerId: customer.id,
            storeId: oa.storeId,
            lineOfficialAccountId: oa.id,
            latestMessageAt: sentAt,
            priority: Priority.NORMAL,
            followUpStatus: FollowUpStatus.FOLLOW_UP,
          },
        });
      }

      const storedMessageType = messageTypeMap[message.type] ?? MessageType.UNSUPPORTED;
      const encryptedLineReplyToken = event.replyToken?.trim() ? this.encryption.encrypt(event.replyToken.trim()) : null;
      const lineReplyTokenReceivedAt = encryptedLineReplyToken ? new Date() : null;
      const storedMessage = await tx.message.create({
        data: {
          conversationId: conversation.id,
          externalMessageId: message.id,
          direction: MessageDirection.INBOUND,
          messageType: storedMessageType,
          originalText: messagePlaceholder(message),
          sentAt,
          rawPayload,
          fileName,
          latitude,
          longitude,
          encryptedLineReplyToken,
          lineReplyTokenReceivedAt,
        },
      });
      if (this.notifications && conversation.storeId) await this.notifications.enqueueInboundMessage(tx, { storeId: conversation.storeId, conversationId: conversation.id, messageId: storedMessage.id, customerName: customer.displayName, messageType: storedMessageType, preview: messagePlaceholder(message), sentAt: sentAt.toISOString() });
      const mediaType = message.type === "image" || message.type === "video" ? messageTypeMap[message.type] : null;
      const media = mediaType ? await tx.messageMedia.create({ data: { messageId: storedMessage.id, providerMessageId: message.id, mediaType } }) : null;
      await tx.activityHistory.create({ data: { conversationId: conversation.id, actionType: ActivityActionType.MESSAGE_RECEIVED, previousStatus: existing?.followUpStatus, newStatus: FollowUpStatus.FOLLOW_UP, description: `Inbound ${message.type} message received` } });
      if (shouldResetBm && prevBmStatus) {
        await tx.activityHistory.create({
          data: {
            conversationId: conversation.id,
            actionType: ActivityActionType.BM_REPLY_STATUS_CHANGED,
            previousBmReplyStatus: prevBmStatus,
            newBmReplyStatus: BmReplyStatus.NOT_REPLIED,
            description: "BM reply status reset by new inbound message",
          },
        });
      }
      return { conversation, messageId: storedMessage.id, mediaId: media?.id, mediaType };
    });
    const conversation = stored.conversation;
    this.realtime?.publish({
      type: "message.created",
      version: 1,
      conversationId: conversation.id,
      storeId: conversation.storeId,
      message: { id: stored.messageId, direction: "INBOUND", messageType: messageTypeMap[message.type] ?? MessageType.UNSUPPORTED, text: messagePlaceholder(message), sentAt: sentAt.toISOString(), media: stored.mediaId ? { processingStatus: "PENDING", mimeType: null, fileSize: null, url: null } : null },
      conversation: { id: conversation.id, latestMessageAt: sentAt.toISOString(), bmReplyStatus: conversation.bmReplyStatus },
    });
    if ((message.type === "image" || message.type === "video") && stored.mediaId) {
      await this.images.process(stored.mediaId, oa.id, message.id, sentAt, stored.mediaType ?? MessageType.UNSUPPORTED);
      if (this.realtime) {
        const media = await this.prisma.messageMedia.findUnique({ where: { id: stored.mediaId }, select: { processingStatus: true, mimeType: true, fileSize: true } });
        this.realtime.publish({ type: "message.media.updated", version: 1, conversationId: conversation.id, storeId: conversation.storeId, message: { id: stored.messageId, direction: "INBOUND", messageType: messageTypeMap[message.type] ?? MessageType.UNSUPPORTED, text: messagePlaceholder(message), sentAt: sentAt.toISOString(), media: { processingStatus: media?.processingStatus ?? "FAILED", mimeType: media?.mimeType ?? null, fileSize: media?.fileSize ?? null, url: media?.processingStatus === "READY" ? `/messages/${stored.messageId}/media` : null } } });
      }
    }
    if (message.type === "text") {
      try { await this.classification.analyze(conversation.id); }
      catch { this.logger.error(`Automatic classification failed for conversation ${conversation.id}`); }
    }
    await this.profiles.refresh(customer.id, oa.id).catch(() => undefined);
  }
}
