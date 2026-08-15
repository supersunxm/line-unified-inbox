import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ActivityActionType, BmReplyStatus, FollowUpStatus, MessageDirection, MessageType, Prisma } from "@prisma/client";
import { BulkUpdateBmReplyStatusDto, ConversationQueryDto, CreateNoteDto, SendConversationMessageDto } from "./dto";
import { OperationsService } from "./operations/operations.service";
import { PrismaService } from "./prisma.service";
import { isValidManagerUrl } from "./store-master/store-master.utils";
import { loadLatestManagerUrls, resolveLineOaManagerUrl } from "./store-master/line-oa-manager-url";
import { CredentialEncryptionService } from "./credentials/credential-encryption.service";
import { LineMessagingService } from "./line-messaging/line-messaging.service";
import { MediaStorageService } from "./media/media-storage";
import { createMediaPublicUrl } from "./media/media-public-url";
import type { AuthUser } from "./auth/auth.guard";

const conversationBaseInclude = {
  customer: true,
  store: { include: { storeMaster: true } },
  lineOfficialAccount: true,
  products: { include: { productModel: { include: { productSeries: true } } } },
  topics: { include: { topic: true } },
} satisfies Prisma.ConversationInclude;
export const conversationListInclude = {
  ...conversationBaseInclude,
  messages: { orderBy: { sentAt: "desc" as const }, take: 1, include: { media: true } },
  notes: { orderBy: { createdAt: "desc" as const }, take: 1 },
  activityHistory: { orderBy: { createdAt: "desc" as const }, take: 1 },
} satisfies Prisma.ConversationInclude;
export const conversationDetailInclude = {
  ...conversationBaseInclude,
  messages: { orderBy: { sentAt: "desc" as const }, include: { media: true } },
  notes: { orderBy: { createdAt: "desc" as const } },
  activityHistory: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.ConversationInclude;
type IncludedConversation = Prisma.ConversationGetPayload<{ include: typeof conversationDetailInclude }>;

export function detectImageMime(buffer: Buffer): string | null {
  if (buffer.subarray(0, 2).equals(Buffer.from([0xff, 0xd8]))) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer.subarray(0, 3).toString() === "GIF") return "image/gif";
  if (buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operations: OperationsService,
    private readonly encryption: CredentialEncryptionService = undefined as unknown as CredentialEncryptionService,
    private readonly lineMessaging: LineMessagingService = undefined as unknown as LineMessagingService,
    private readonly media: MediaStorageService = undefined as unknown as MediaStorageService,
  ) { }
  private safe(item: IncludedConversation, latestManagerUrls: ReadonlyMap<string, string | null>) {
    const value = item.customer.lineUserId;
    const { store: rawStore, lineOfficialAccount: rawLineOfficialAccount, ...conversation } = item;
    const { storeMaster, ...store } = rawStore;
    const resolvedLineOaManagerUrl = resolveLineOaManagerUrl(item.store, latestManagerUrls);
    const lineOfficialAccount = { id: rawLineOfficialAccount.id, name: rawLineOfficialAccount.name, basicId: rawLineOfficialAccount.basicId, connectionStatus: rawLineOfficialAccount.connectionStatus, isActive: rawLineOfficialAccount.isActive, lastWebhookReceivedAt: rawLineOfficialAccount.lastWebhookReceivedAt };
    return { ...conversation, resolvedLineOaManagerUrl, lineOfficialAccount, store: { ...store, lineManagerUrl: resolvedLineOaManagerUrl, lineManagerUrlStatus: resolvedLineOaManagerUrl ? "VALID" : storeMaster?.lineManagerUrl && !isValidManagerUrl(storeMaster.lineManagerUrl) ? "INVALID" : "MISSING" }, customer: { ...item.customer, lineUserId: value ? `${value.slice(0, 4)}••••${value.slice(-4)}` : null }, messages: item.messages.map((message) => this.safeMessage(message)) };
  }

  private safeMessage<T extends { id: string; direction: MessageDirection; senderUserId?: string | null; senderDisplayName?: string | null; media?: { processingStatus: string; mimeType: string | null; fileSize: number | null } | null }>(message: T) {
    const { media, senderUserId, senderDisplayName, ...safe } = message;
    const sender = safe.direction === MessageDirection.OUTBOUND
      ? { userId: senderUserId ?? null, displayName: senderDisplayName ?? "Store" }
      : null;
    return { ...safe, sender, media: media ? { processingStatus: media.processingStatus, mimeType: media.mimeType, fileSize: media.fileSize, url: media.processingStatus === "READY" ? `/messages/${message.id}/media` : null } : null };
  }

  async list(query: ConversationQueryDto, accessibleStoreIds: string[] | null = null) {
    const search = query.search?.trim();
    const storeFilter = accessibleStoreIds === null
      ? query.storeId
      : { in: query.storeId ? [query.storeId] : accessibleStoreIds };
    const resetFilter = await this.operations.getOperationalConversationFilter();
    const where: Prisma.ConversationWhereInput = {
      store: { archivedAt: null },
      ...resetFilter,
      storeId: storeFilter,
      lineOfficialAccountId: query.lineOaId,
      followUpStatus: query.followUpStatus,
      bmReplyStatus: query.bmReplyStatus,
      priority: query.priority,
      products: query.productModelId
        ? { some: { productModelId: query.productModelId } }
        : query.productSeriesId
          ? { some: { productModel: { productSeriesId: query.productSeriesId } } }
          : undefined,
      topics: query.topicId ? { some: { topicId: query.topicId } } : undefined,
      OR: search ? [
        { customer: { displayName: { contains: search, mode: "insensitive" } } },
        { store: { name: { contains: search, mode: "insensitive" } } },
        { messages: { some: { originalText: { contains: search, mode: "insensitive" } } } },
        {
          products: {
            some: {
              productModel: { name: { contains: search, mode: "insensitive" } },
            },
          },
        },
        {
          products: {
            some: {
              productModel: {
                productSeries: {
                  name: { contains: search, mode: "insensitive" },
                },
              },
            },
          },
        },
        {
          topics: {
            some: { topic: { name: { contains: search, mode: "insensitive" } } },
          },
        },
      ] : undefined,
    };
    const orderBy: Prisma.ConversationOrderByWithRelationInput[] =
      query.sort === "latest-asc"
        ? [{ latestMessageAt: "asc" }, { id: "asc" }]
        : query.sort === "priority-desc"
          ? [{ priority: "desc" }, { latestMessageAt: "desc" }, { id: "desc" }]
          : [{ latestMessageAt: "desc" }, { id: "desc" }];
    const pageSize = Math.min(100, Math.max(1, Math.floor(query.pageSize)));
    const [items, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({ where, include: conversationListInclude, orderBy, skip: (query.page - 1) * pageSize, take: pageSize }),
      this.prisma.conversation.count({ where }),
    ]);
    const latestManagerUrls = await loadLatestManagerUrls(this.prisma, items.map(({ store }) => store.code));
    return { items: items.map((item) => this.safe(item, latestManagerUrls)), total, page: query.page, pageSize };
  }

  async get(id: string) {
    const item = await this.prisma.conversation.findUnique({ where: { id }, include: conversationDetailInclude });
    if (!item) throw new NotFoundException("Conversation not found");
    const latestManagerUrls = await loadLatestManagerUrls(this.prisma, [item.store.code]);
    return this.safe(item, latestManagerUrls);
  }

  async updateStatus(id: string, status: FollowUpStatus) {
    const current = await this.get(id);
    if (current.followUpStatus === status) return { changed: false, conversation: current };
    const actionType = status === "FOLLOW_UP" ? ActivityActionType.RETURNED_TO_FOLLOW_UP :
      status === "REMINDED" ? ActivityActionType.REMINDER_SENT : status === "ACKNOWLEDGED" ? ActivityActionType.MANAGER_ACKNOWLEDGED :
        status === "COMPLETED" ? ActivityActionType.CONVERSATION_COMPLETED : ActivityActionType.ESCALATED;
    await this.prisma.$transaction([
      this.prisma.conversation.update({ where: { id }, data: { followUpStatus: status } }),
      this.prisma.activityHistory.create({ data: { conversationId: id, actionType, previousStatus: current.followUpStatus, newStatus: status } }),
    ]);
    return { changed: true, conversation: await this.get(id) };
  }

  async updateBmReplyStatus(id: string, status: BmReplyStatus) {
    const current = await this.get(id);
    if (current.bmReplyStatus === status) return { changed: false, conversation: current };
    const completesFollowUp = status === BmReplyStatus.REPLIED && current.followUpStatus !== FollowUpStatus.COMPLETED;
    await this.prisma.$transaction([
      this.prisma.conversation.update({
        where: { id },
        data: {
          bmReplyStatus: status,
          ...(completesFollowUp ? { followUpStatus: FollowUpStatus.COMPLETED } : {}),
        },
      }),
      this.prisma.activityHistory.create({
        data: {
          conversationId: id,
          actionType: ActivityActionType.BM_REPLY_STATUS_CHANGED,
          previousBmReplyStatus: current.bmReplyStatus,
          newBmReplyStatus: status,
          ...(completesFollowUp ? { previousStatus: current.followUpStatus, newStatus: FollowUpStatus.COMPLETED } : {}),
          description: "BM reply status changed manually",
        },
      }),
    ]);
    return { changed: true, conversation: await this.get(id) };
  }

  async bulkUpdateBmReplyStatus(dto: BulkUpdateBmReplyStatusDto, actingAdmin?: string) {
    const { storeId, status, fromStatuses } = dto;
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException("Store not found");

    const resetFilter = await this.operations.getOperationalConversationFilter();

    const where: Prisma.ConversationWhereInput = {
      storeId,
      store: { archivedAt: null },
      ...(resetFilter as Prisma.ConversationWhereInput),
      ...(fromStatuses && fromStatuses.length > 0
        ? { bmReplyStatus: { in: fromStatuses } }
        : {}),
    };

    const completesFollowUp = status === BmReplyStatus.REPLIED;
    const result = await this.prisma.conversation.updateMany({
      where,
      data: {
        bmReplyStatus: status,
        ...(completesFollowUp ? { followUpStatus: FollowUpStatus.COMPLETED } : {}),
      },
    });

    const auditEntry = {
      event: "BULK_BM_REPLY_STATUS_UPDATED",
      actingAdmin: actingAdmin || "admin",
      storeId,
      storeName: store.name,
      previousStatusScope: fromStatuses && fromStatuses.length > 0 ? fromStatuses : ["ALL"],
      targetStatus: status,
      affectedCount: result.count,
      timestamp: new Date().toISOString(),
    };
    Logger.log(JSON.stringify(auditEntry), "ConversationsService");

    return {
      updated: result.count,
      status,
    };
  }

  async addNote(id: string, dto: CreateNoteDto) {
    await this.get(id);
    const content = dto.content.trim();
    if (!content) throw new BadRequestException("Note content cannot be empty");
    const [note] = await this.prisma.$transaction([
      this.prisma.internalNote.create({ data: { conversationId: id, content, createdByName: dto.createdByName } }),
      this.prisma.activityHistory.create({ data: { conversationId: id, actionType: "NOTE_ADDED", description: "Internal note added", createdByName: dto.createdByName } }),
    ]);
    return note;
  }

  async messages(id: string, page: number, pageSize: number) {
    await this.get(id);
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeSize = Number.isFinite(pageSize) ? Math.min(100, Math.max(1, Math.floor(pageSize))) : 30;
    const total = await this.prisma.message.count({ where: { conversationId: id } });
    const items = await this.prisma.message.findMany({ where: { conversationId: id }, include: { media: true }, orderBy: [{ sentAt: "desc" }, { id: "desc" }], skip: (safePage - 1) * safeSize, take: safeSize });
    return { items: items.reverse().map((message) => this.safeMessage(message)), total, page: safePage, pageSize: safeSize, hasEarlier: safePage * safeSize < total };
  }

  async sendMessage(id: string, dto: SendConversationMessageDto, operator: AuthUser) {
    const text = dto.text.trim();
    if (!text) throw new BadRequestException("กรุณาพิมพ์ข้อความ");
    if (text.length > 5000) throw new BadRequestException("ข้อความต้องไม่เกิน 5,000 ตัวอักษร");

    const dedupeExternalId = `outbound:${dto.idempotencyKey}`;
    const priorMessage = await this.prisma.message.findUnique({ where: { externalMessageId: dedupeExternalId } });
    if (priorMessage) return { message: this.safeMessage(priorMessage), bmReplyStatus: BmReplyStatus.REPLIED, duplicate: true };

    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: { customer: true, lineOfficialAccount: true, store: true },
    });
    if (!conversation) throw new NotFoundException("ไม่พบการสนทนา");
    if (!conversation.customer.lineUserId) throw new BadRequestException("ไม่พบ LINE User ID ของลูกค้า");
    const oa = conversation.lineOfficialAccount;
    if (!oa || oa.archivedAt || !oa.isActive) throw new BadRequestException("LINE Official Account นี้ไม่ได้เปิดใช้งาน");
    if (!oa.encryptedChannelAccessToken) throw new BadRequestException("ไม่พบ Channel Access Token ของร้านนี้");

    let accessToken: string;
    try { accessToken = this.encryption.decrypt(oa.encryptedChannelAccessToken); }
    catch { throw new ServiceUnavailableException("ไม่สามารถอ่าน Channel Access Token ของร้านนี้ได้"); }

    const lineResult = await this.lineMessaging.pushText({
      accessToken,
      lineUserId: conversation.customer.lineUserId,
      text,
      retryKey: dto.idempotencyKey,
    });
    const sentAt = new Date();
    try {
      const message = await this.prisma.$transaction(async (tx) => {
        const created = await tx.message.create({
          data: {
            conversationId: conversation.id,
            externalMessageId: dedupeExternalId,
            direction: MessageDirection.OUTBOUND,
            messageType: MessageType.TEXT,
            originalText: text,
            sentAt,
            senderUserId: operator.id,
            senderDisplayName: operator.displayName?.trim() || "Store",
            rawPayload: {
              provider: "LINE",
              providerMessageId: lineResult.externalMessageId,
              requestId: lineResult.requestId,
              acceptedRequestId: lineResult.acceptedRequestId,
            },
          },
        });
        await tx.conversation.update({
          where: { id: conversation.id },
          data: { latestMessageAt: sentAt, bmReplyStatus: BmReplyStatus.REPLIED, followUpStatus: FollowUpStatus.COMPLETED },
        });
        await tx.activityHistory.create({
          data: {
            conversationId: conversation.id,
            actionType: ActivityActionType.STATUS_CHANGED,
            previousStatus: conversation.followUpStatus,
            newStatus: FollowUpStatus.COMPLETED,
            previousBmReplyStatus: conversation.bmReplyStatus,
            newBmReplyStatus: BmReplyStatus.REPLIED,
            createdByName: operator.displayName,
            description: `Customer message sent via LINE; storeId=${conversation.storeId}; lineOfficialAccountId=${conversation.lineOfficialAccountId}`,
          },
        });
        return created;
      });
      return { message: this.safeMessage(message), bmReplyStatus: BmReplyStatus.REPLIED, duplicate: lineResult.duplicateAccepted };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.prisma.message.findUnique({ where: { externalMessageId: dedupeExternalId } });
        if (existing) return { message: this.safeMessage(existing), bmReplyStatus: BmReplyStatus.REPLIED, duplicate: true };
      }
      Logger.error(`LINE accepted outbound message but persistence failed for conversation ${conversation.id}`, undefined, "ConversationsService");
      throw new InternalServerErrorException("LINE รับข้อความแล้ว แต่บันทึกประวัติไม่สำเร็จ กรุณาลองส่งคำขอเดิมอีกครั้ง");
    }
  }

  async sendImage(id: string, file: { buffer: Buffer; mimetype: string; size: number }, idempotencyKey: string, operator: AuthUser) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) throw new BadRequestException("idempotencyKey must be a UUID");
    const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp" };
    const mime = detectImageMime(file.buffer);
    if (!mime || !extensions[mime]) throw new BadRequestException("Unsupported image type");
    if (!file.buffer.length || file.buffer.length > 10 * 1024 * 1024) throw new BadRequestException("Image exceeds the 10 MB limit");
    const declaredMime = (file.mimetype ?? "").split(";", 1)[0].trim().toLowerCase();
    if (declaredMime && declaredMime !== "application/octet-stream" && declaredMime !== mime) throw new BadRequestException("Image content does not match its MIME type");
    const dedupeExternalId = `outbound:${idempotencyKey}`;
    const priorMessage = await this.prisma.message.findUnique({ where: { externalMessageId: dedupeExternalId }, include: { media: true } });
    if (priorMessage) return { message: this.safeMessage(priorMessage), bmReplyStatus: BmReplyStatus.REPLIED, duplicate: true };
    if (!this.media) throw new ServiceUnavailableException("Media storage is unavailable");
    const conversation = await this.prisma.conversation.findUnique({ where: { id }, include: { customer: true, lineOfficialAccount: true } });
    if (!conversation) throw new NotFoundException("ไม่พบการสนทนา");
    if (!conversation.customer.lineUserId) throw new BadRequestException("ไม่พบ LINE User ID ของลูกค้า");
    if (!conversation.lineOfficialAccount?.isActive || conversation.lineOfficialAccount.archivedAt || !conversation.lineOfficialAccount.encryptedChannelAccessToken) throw new BadRequestException("LINE Official Account นี้ไม่ได้เปิดใช้งาน");
    let accessToken: string; try { accessToken = this.encryption.decrypt(conversation.lineOfficialAccount.encryptedChannelAccessToken); } catch { throw new ServiceUnavailableException("ไม่สามารถอ่าน Channel Access Token ของร้านนี้ได้"); }
    const objectKey = `line-media/outbound/${conversation.id}/${idempotencyKey}.${extensions[mime]}`;
    const stored = await this.media.put(objectKey, file.buffer, mime);
    if (stored.provider !== "s3") throw new ServiceUnavailableException("Outbound image delivery requires S3-compatible media storage");
    try {
      const imageUrl = createMediaPublicUrl(objectKey);
      const lineResult = await this.lineMessaging.pushImage({ accessToken, lineUserId: conversation.customer.lineUserId, originalContentUrl: imageUrl, previewImageUrl: imageUrl, retryKey: idempotencyKey });
      const sentAt = new Date();
      const created = await this.prisma.$transaction(async (tx) => {
        const message = await tx.message.create({ data: { conversationId: conversation.id, externalMessageId: dedupeExternalId, direction: MessageDirection.OUTBOUND, messageType: MessageType.IMAGE, originalText: "[Image]", sentAt, senderUserId: operator.id, senderDisplayName: operator.displayName?.trim() || "Store", rawPayload: { provider: "LINE", providerMessageId: lineResult.externalMessageId, requestId: lineResult.requestId, acceptedRequestId: lineResult.acceptedRequestId } } });
        await tx.messageMedia.create({ data: { messageId: message.id, providerMessageId: dedupeExternalId, mediaType: MessageType.IMAGE, mimeType: stored.mimeType, objectKey, provider: stored.provider, fileId: stored.fileId, fileSize: stored.size, processingStatus: "READY" } });
        await tx.conversation.update({ where: { id: conversation.id }, data: { latestMessageAt: sentAt, bmReplyStatus: BmReplyStatus.REPLIED, followUpStatus: FollowUpStatus.COMPLETED } });
        return message;
      });
      return { message: this.safeMessage({ ...created, media: { processingStatus: "READY", mimeType: stored.mimeType, fileSize: stored.size } }), bmReplyStatus: BmReplyStatus.REPLIED, duplicate: lineResult.duplicateAccepted };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") { const existing = await this.prisma.message.findUnique({ where: { externalMessageId: dedupeExternalId }, include: { media: true } }); if (existing) return { message: this.safeMessage(existing), bmReplyStatus: BmReplyStatus.REPLIED, duplicate: true }; }
      throw error;
    }
  }

  async updateManualTags(id: string, productModelIds: string[], topicIds: string[]) {
    await this.get(id);
    await this.prisma.$transaction(async (tx) => {
      // Find prior RULE products to detect corrections
      const priorRuleProducts = await tx.conversationProduct.findMany({
        where: { conversationId: id, source: "RULE" },
        include: { productModel: true },
      });

      const uniqueModelIds = [...new Set(productModelIds)];
      const uniqueTopicIds = [...new Set(topicIds)];

      await tx.conversationProduct.deleteMany({ where: { conversationId: id, source: "MANUAL" } });
      await tx.conversationTopic.deleteMany({ where: { conversationId: id, source: "MANUAL" } });

      for (const productModelId of uniqueModelIds) {
        await tx.conversationProduct.upsert({
          where: { conversationId_productModelId: { conversationId: id, productModelId } },
          update: { source: "MANUAL", confidence: 1 },
          create: { conversationId: id, productModelId, source: "MANUAL", confidence: 1 },
        });
      }

      for (const topicId of uniqueTopicIds) {
        await tx.conversationTopic.upsert({
          where: { conversationId_topicId: { conversationId: id, topicId } },
          update: { source: "MANUAL", confidence: 1 },
          create: { conversationId: id, topicId, source: "MANUAL", confidence: 1 },
        });
      }

      // If there were prior RULE predictions and now a manual model is assigned, log correction
      if (priorRuleProducts.length > 0 && uniqueModelIds.length > 0) {
        const newModels = await tx.productModel.findMany({
          where: { id: { in: uniqueModelIds } },
          select: { name: true },
        });
        const priorNames = priorRuleProducts.map((p) => p.productModel.name).join(", ");
        const newNames = newModels.map((m) => m.name).join(", ");
        if (priorNames !== newNames) {
          const prior = priorRuleProducts[0];
          const phrase = prior?.matchedPhrase ? `phrase: "${prior.matchedPhrase}"` : "";
          const method = prior?.detectionMethod ? `method: "${prior.detectionMethod}"` : "";
          const srcMsg = prior?.sourceMessageId ? `sourceMessageId: "${prior.sourceMessageId}"` : "";
          const metaParts = [phrase, method, srcMsg].filter(Boolean).join(", ");

          await tx.activityHistory.create({
            data: {
              conversationId: id,
              actionType: ActivityActionType.CLASSIFICATION_UPDATED,
              description: `Manual product correction: ${priorNames} → ${newNames}${metaParts ? ` (${metaParts})` : ""}`,
              createdByName: "OPPO LINE OA Specialist",
            },
          });
        }
      }
    });
    return this.get(id);
  }

  async getBmReplyStatusSummary() {
    const stores = await this.prisma.store.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        storeMaster: { select: { externalStoreId: true } },
      },
    });

    const resetFilter = await this.operations.getOperationalConversationFilter();

    const grouped = await this.prisma.conversation.groupBy({
      by: ["storeId", "bmReplyStatus"],
      where: { store: { archivedAt: null }, ...(resetFilter as Prisma.ConversationWhereInput) },
      _count: { _all: true },
    });

    const overview = {
      notReplied: 0,
      notifiedBm: 0,
      replied: 0,
    };

    const storeMap = new Map<string, { notReplied: number; notifiedBm: number; replied: number }>();
    for (const store of stores) {
      storeMap.set(store.id, { notReplied: 0, notifiedBm: 0, replied: 0 });
    }

    for (const item of grouped) {
      const count = item._count._all;
      if (item.bmReplyStatus === BmReplyStatus.NOT_REPLIED) {
        overview.notReplied += count;
      } else if (item.bmReplyStatus === BmReplyStatus.NOTIFIED_BM) {
        overview.notifiedBm += count;
      } else if (item.bmReplyStatus === BmReplyStatus.REPLIED) {
        overview.replied += count;
      }

      const storeCounts = storeMap.get(item.storeId);
      if (storeCounts) {
        if (item.bmReplyStatus === BmReplyStatus.NOT_REPLIED) {
          storeCounts.notReplied += count;
        } else if (item.bmReplyStatus === BmReplyStatus.NOTIFIED_BM) {
          storeCounts.notifiedBm += count;
        } else if (item.bmReplyStatus === BmReplyStatus.REPLIED) {
          storeCounts.replied += count;
        }
      }
    }

    const oldestUnanswered = await this.prisma.conversation.groupBy({
      by: ["storeId"],
      where: {
        store: { archivedAt: null },
        bmReplyStatus: BmReplyStatus.NOT_REPLIED,
        ...(resetFilter as Prisma.ConversationWhereInput),
      },
      _min: { latestMessageAt: true },
    });

    const now = Date.now();
    const oldestMap = new Map<string, number>();
    for (const item of oldestUnanswered) {
      if (item._min && item._min.latestMessageAt) {
        const elapsedMinutes = Math.max(0, Math.floor((now - new Date(item._min.latestMessageAt).getTime()) / 60000));
        oldestMap.set(item.storeId, elapsedMinutes);
      }
    }

    const storesList = stores.map((store) => {
      const counts = storeMap.get(store.id) ?? { notReplied: 0, notifiedBm: 0, replied: 0 };
      return {
        id: store.id,
        storeId: store.id,
        masterStoreId: store.storeMaster?.externalStoreId ?? null,
        externalStoreId: store.storeMaster?.externalStoreId ?? null,
        storeName: store.name,
        notReplied: counts.notReplied,
        notifiedBm: counts.notifiedBm,
        replied: counts.replied,
        oldestWaitingMinutes: counts.notReplied > 0 ? (oldestMap.get(store.id) ?? 0) : 0,
      };
    });

    return {
      overview,
      stores: storesList,
    };
  }
}
