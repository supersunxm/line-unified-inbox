import { Injectable, Logger } from "@nestjs/common";
import { ActivityActionType, FollowUpStatus, MessageDirection, MessageType, Prisma, Priority, WebhookProcessingStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../prisma.service";
import { CredentialEncryptionService } from "../../credentials/credential-encryption.service";
import { LineWebhookConfig } from "./line-webhook.config";
import { LineMessage, LineWebhookBody, LineWebhookEvent, messagePlaceholder } from "./line-webhook.types";
import { ClassificationService } from "../../classification/classification.service";
import { LineProfileService } from "../../line-profile.service";

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
  constructor(private readonly prisma: PrismaService, private readonly config: LineWebhookConfig, private readonly encryption: CredentialEncryptionService, private readonly classification: ClassificationService, private readonly profiles: LineProfileService) {}

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
    const safeOa = { id: oa.id, name: oa.name, store: oa.store.name, isActive: oa.isActive, isArchived: Boolean(oa.archivedAt) };
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
      if (event.type === "follow") await this.processFollow(event);
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

  private async processFollow(event: LineWebhookEvent) {
    if (!event.source.userId) return;
    await this.prisma.customer.upsert({ where: { lineUserId: event.source.userId }, update: {}, create: { lineUserId: event.source.userId, displayName: "LINE Customer" } });
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

    const conversation = await this.prisma.$transaction(async (tx) => {
      const conversation = existing
        ? await tx.conversation.update({ where: { id: existing.id }, data: { latestMessageAt: sentAt, followUpStatus: FollowUpStatus.FOLLOW_UP } })
        : await tx.conversation.create({ data: { customerId: customer.id, storeId: oa.storeId, lineOfficialAccountId: oa.id, latestMessageAt: sentAt, priority: Priority.NORMAL, followUpStatus: FollowUpStatus.FOLLOW_UP } });
      await tx.message.create({ data: { conversationId: conversation.id, externalMessageId: message.id, direction: MessageDirection.INBOUND, messageType: messageTypeMap[message.type] ?? MessageType.UNSUPPORTED, originalText: messagePlaceholder(message), sentAt, rawPayload, fileName, latitude, longitude } });
      await tx.activityHistory.create({ data: { conversationId: conversation.id, actionType: ActivityActionType.MESSAGE_RECEIVED, previousStatus: existing?.followUpStatus, newStatus: FollowUpStatus.FOLLOW_UP, description: `Inbound ${message.type} message received` } });
      return conversation;
    });
    if (message.type === "text") {
      try { await this.classification.analyze(conversation.id); }
      catch { this.logger.error(`Automatic classification failed for conversation ${conversation.id}`); }
    }
    await this.profiles.refresh(customer.id, oa.id).catch(() => undefined);
  }
}
