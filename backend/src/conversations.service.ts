import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ActivityActionType, BmReplyStatus, FollowUpStatus, MessageDirection, MessageType, Prisma } from "@prisma/client";
import { BulkMarkRepliedByFilterDto, BulkUpdateBmReplyStatusDto, ConversationQueryDto, CreateNoteDto, SendConversationMessageDto } from "./dto";
import { OperationsService } from "./operations/operations.service";
import { PrismaService } from "./prisma.service";
import { isValidManagerUrl } from "./store-master/store-master.utils";
import { loadLatestManagerUrls, resolveLineOaManagerUrl } from "./store-master/line-oa-manager-url";
import { CredentialEncryptionService } from "./credentials/credential-encryption.service";
import { LineMessagingService } from "./line-messaging/line-messaging.service";
import { MediaStorageService } from "./media/media-storage";
import { createMediaPublicUrl } from "./media/media-public-url";
import type { AuthUser } from "./auth/auth.guard";
import { StoreAccessService } from "./auth/store-access.service";
import { AuditLogService } from "./auth/audit-log.service";
import { buildAiInsight, buildCustomerSalesInformation, buildOperationalState, buildPurchaseInformation } from "./conversation-data-contract";
import { RealtimeEventService } from "./realtime/realtime-event.service";

const conversationBaseInclude = {
  customer: true,
  store: { include: { storeMaster: true } },
  lineOfficialAccount: true,
  purchaseRecordedBy: { select: { id: true, displayName: true } },
  salesRecordedBy: { select: { id: true, displayName: true } },
  salesProducts: { include: { productModel: { include: { productSeries: true } }, productVariant: true } },
  products: { include: { productModel: { include: { productSeries: true } }, productVariant: true } },
  topics: { include: { topic: true } },
} satisfies Prisma.ConversationInclude;
export const conversationListInclude = {
  ...conversationBaseInclude,
  messages: { orderBy: { sentAt: "desc" as const }, take: 1, include: { media: true, sender: { select: { id: true, displayName: true } } } },
  notes: { orderBy: { createdAt: "desc" as const }, take: 1 },
  activityHistory: { orderBy: { createdAt: "desc" as const }, take: 1 },
} satisfies Prisma.ConversationInclude;
export const conversationDetailInclude = {
  ...conversationBaseInclude,
  messages: { orderBy: { sentAt: "desc" as const }, include: { media: true, sender: { select: { id: true, displayName: true } } } },
  notes: { orderBy: { createdAt: "desc" as const } },
  activityHistory: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.ConversationInclude;
type IncludedConversation = Prisma.ConversationGetPayload<{ include: typeof conversationDetailInclude }>;

/**
 * Serialize the persisted author of a message without leaking User fields.
 * The relation is preferred for the canonical current display name; the
 * snapshot remains useful for historical rows created before the relation was
 * populated. An outbound row with no author stays unattributed rather than
 * being guessed as the current operator.
 */
export function resolveMessageSender(message: {
  direction: MessageDirection;
  senderUserId?: string | null;
  senderDisplayName?: string | null;
  sender?: { id: string; displayName: string | null } | null;
}) {
  if (message.direction !== MessageDirection.OUTBOUND) return null;
  const displayName = message.sender?.displayName?.trim() || message.senderDisplayName?.trim() || null;
  if (!message.senderUserId && !message.sender) return null;
  return {
    userId: message.senderUserId ?? message.sender?.id ?? null,
    displayName: displayName ?? "Staff",
  };
}

export function getReplyTokenAgeBucket(ageMs: number): string {
  if (ageMs < 30_000) return "< 30 seconds";
  if (ageMs < 60_000) return "30-60 seconds";
  if (ageMs < 120_000) return "1-2 minutes";
  if (ageMs < 300_000) return "2-5 minutes";
  if (ageMs < 600_000) return "5-10 minutes";
  return "> 10 minutes";
}

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
    private readonly storeAccess?: StoreAccessService,
    private readonly auditLog?: AuditLogService,
    private readonly realtime?: RealtimeEventService,
  ) { }
  private safe(item: IncludedConversation, latestManagerUrls: ReadonlyMap<string, string | null>) {
    const value = item.customer.lineUserId;
    const { store: rawStore, lineOfficialAccount: rawLineOfficialAccount, purchaseRecordedBy, salesRecordedBy, purchaseRecordedById: _purchaseRecordedById, purchaseRecordedAt: _purchaseRecordedAt, salesRecordedById: _salesRecordedById, salesRecordedAt: _salesRecordedAt, ...conversation } = item;
    void _purchaseRecordedById;
    void _purchaseRecordedAt;
    void _salesRecordedById;
    void _salesRecordedAt;
    const storeMaster = rawStore?.storeMaster ?? null;
    const store = rawStore ? ((value) => { const { storeMaster: omittedStoreMaster, ...safeStore } = value; void omittedStoreMaster; return safeStore; })(rawStore) : { id: "", name: "Main OA", code: null, region: null, area: null, isActive: true, archivedAt: null, createdAt: item.createdAt, updatedAt: item.updatedAt, storeMasterId: null, provinceSource: null, regionSource: null };
    const resolvedLineOaManagerUrl = rawStore ? resolveLineOaManagerUrl(rawStore, latestManagerUrls) : null;
    const lineOfficialAccount = { id: rawLineOfficialAccount.id, name: rawLineOfficialAccount.name, basicId: rawLineOfficialAccount.basicId, connectionStatus: rawLineOfficialAccount.connectionStatus, isActive: rawLineOfficialAccount.isActive, lastWebhookReceivedAt: rawLineOfficialAccount.lastWebhookReceivedAt };
    return {
      ...conversation,
      resolvedLineOaManagerUrl,
      lineOfficialAccount,
      store: { ...store, lineManagerUrl: resolvedLineOaManagerUrl, lineManagerUrlStatus: resolvedLineOaManagerUrl ? "VALID" : storeMaster?.lineManagerUrl && !isValidManagerUrl(storeMaster.lineManagerUrl) ? "INVALID" : "MISSING" },
      customer: { ...item.customer, lineUserId: value ? `${value.slice(0, 4)}••••${value.slice(-4)}` : null },
      messages: item.messages.map((message) => this.safeMessage(message)),
      customerSalesInformation: buildCustomerSalesInformation({ ...item, purchaseRecordedBy, salesRecordedBy }),
      purchaseInformation: buildPurchaseInformation({ ...item, purchaseRecordedBy, salesRecordedBy }),
      aiInsight: buildAiInsight(item),
      operationalState: buildOperationalState({ replyStatus: item.bmReplyStatus, priority: item.priority }),
    };
  }

  private safeMessage<T extends { id: string; direction: MessageDirection; senderUserId?: string | null; senderDisplayName?: string | null; sender?: { id: string; displayName: string | null } | null; media?: { processingStatus: string; mimeType: string | null; fileSize: number | null } | null }>(message: T) {
    const { media, sender: senderUser, senderUserId, senderDisplayName, encryptedLineReplyToken: _encToken, lineReplyTokenReceivedAt: _tokenRecv, lineReplyTokenUsedAt: _tokenUsed, ...safe } = message as T & { encryptedLineReplyToken?: string | null; lineReplyTokenReceivedAt?: Date | null; lineReplyTokenUsedAt?: Date | null };
    void _encToken;
    void _tokenRecv;
    void _tokenUsed;
    const sender = resolveMessageSender({ direction: safe.direction, senderUserId, senderDisplayName, sender: senderUser });
    return { ...safe, sender, media: media ? { processingStatus: media.processingStatus, mimeType: media.mimeType, fileSize: media.fileSize, url: media.processingStatus === "READY" ? `/messages/${message.id}/media` : null } : null };
  }

  private publishOutboundMessage(conversation: { id: string; storeId: string | null; bmReplyStatus: string }, message: { id: string; direction?: MessageDirection; messageType: string; originalText: string; sentAt: Date; senderUserId?: string | null; senderDisplayName?: string | null }, media: { processingStatus: string; mimeType?: string | null; fileSize?: number | null } | null = null) {
    if (!this.realtime) return;
    this.realtime.publish({
      type: "message.created",
      version: 1,
      conversationId: conversation.id,
      storeId: conversation.storeId,
      message: {
        id: message.id,
        direction: MessageDirection.OUTBOUND,
        messageType: message.messageType,
        text: message.originalText,
        sentAt: message.sentAt.toISOString(),
        sender: resolveMessageSender({ ...message, direction: MessageDirection.OUTBOUND }),
        media: media
          ? { processingStatus: media.processingStatus, mimeType: media.mimeType ?? null, fileSize: media.fileSize ?? null, url: media.processingStatus === "READY" ? `/messages/${message.id}/media` : null }
          : null,
      },
      conversation: { id: conversation.id, latestMessageAt: message.sentAt.toISOString(), bmReplyStatus: conversation.bmReplyStatus },
    });
  }

  async list(query: ConversationQueryDto, accessibleStoreIds: string[] | null = null, accountType: "STORE" | "HEAD_OFFICE" = "STORE") {
    const search = query.search?.trim();
    const storeFilter = accessibleStoreIds === null
      ? query.storeId
      : { in: query.storeId ? [query.storeId] : accessibleStoreIds };
    const resetFilter = await this.operations.getOperationalConversationFilter();
    const where: Prisma.ConversationWhereInput = {
      store: accountType === "STORE" ? { archivedAt: null } : undefined,
      lineOfficialAccount: { accountType },
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
    const latestManagerUrls = await loadLatestManagerUrls(this.prisma, items.flatMap(({ store }) => store ? [store.code] : []));
    return { items: items.map((item) => this.safe(item, latestManagerUrls)), total, page: query.page, pageSize };
  }

  async get(id: string) {
    const item = await this.prisma.conversation.findUnique({ where: { id }, include: conversationDetailInclude });
    if (!item) throw new NotFoundException("Conversation not found");
    const latestManagerUrls = await loadLatestManagerUrls(this.prisma, item.store ? [item.store.code] : []);
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

  async bulkMarkReplied(conversationIds: string[], user: AuthUser) {
    if (!conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
      throw new BadRequestException("conversationIds must be a non-empty array");
    }

    const uniqueIds = Array.from(new Set(conversationIds.filter((id) => typeof id === "string" && id.trim().length > 0)));
    if (uniqueIds.length === 0) {
      throw new BadRequestException("conversationIds must contain at least one valid id");
    }

    const conversations = await this.prisma.conversation.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        storeId: true,
        bmReplyStatus: true,
        followUpStatus: true,
        store: { select: { id: true, name: true } },
      },
    });

    if (conversations.length === 0) {
      throw new NotFoundException("No conversations found");
    }

    if (conversations.length !== uniqueIds.length) {
      throw new NotFoundException("One or more conversations not found");
    }

    const storeIds = Array.from(new Set(conversations.map((c) => c.storeId).filter((id): id is string => Boolean(id))));
    if (storeIds.length === 0) throw new NotFoundException("One or more conversations not found");
    if (storeIds.length > 1) {
      throw new ForbiddenException("Bulk operation across multiple stores is not permitted");
    }

    const targetStoreId = storeIds[0];
    if (this.storeAccess) {
      await this.storeAccess.assertStoreAccess(user, targetStoreId);
    }

    const now = new Date();
    const actorName = user.displayName || user.email || (user.role === "ADMIN" ? "Admin" : "User");

    await this.prisma.$transaction(async (tx) => {
      await tx.conversation.updateMany({
        where: { id: { in: uniqueIds } },
        data: {
          bmReplyStatus: BmReplyStatus.REPLIED,
          followUpStatus: FollowUpStatus.COMPLETED,
          updatedAt: now,
        },
      });

      for (const conv of conversations) {
        await tx.activityHistory.create({
          data: {
            conversationId: conv.id,
            actionType: ActivityActionType.BM_REPLY_STATUS_CHANGED,
            previousBmReplyStatus: conv.bmReplyStatus,
            newBmReplyStatus: BmReplyStatus.REPLIED,
            ...(conv.followUpStatus !== FollowUpStatus.COMPLETED
              ? { previousStatus: conv.followUpStatus, newStatus: FollowUpStatus.COMPLETED }
              : {}),
            description: "Bulk marked as replied",
            createdByUserId: user.id,
            createdByName: actorName,
            metadata: {
              actionType: "BULK_MARK_REPLIED",
              storeId: targetStoreId,
              actorUserId: user.id,
            },
          },
        });
      }
    });

    if (this.auditLog) {
      await this.auditLog.record({
        actorUserId: user.id,
        action: "BULK_MARK_REPLIED",
        metadata: {
          affectedCount: conversations.length,
          storeId: targetStoreId,
          storeName: conversations[0]?.store?.name,
          actorUserId: user.id,
          conversationIds: uniqueIds,
        },
      });
    }

    Logger.log(
      JSON.stringify({
        event: "BULK_MARK_REPLIED",
        actorUserId: user.id,
        actorName,
        storeId: targetStoreId,
        storeName: conversations[0]?.store?.name,
        affectedCount: conversations.length,
        timestamp: now.toISOString(),
      }),
      "ConversationsService",
    );

    return {
      success: true,
      updatedCount: conversations.length,
      affectedCount: conversations.length,
      storeId: targetStoreId,
      status: BmReplyStatus.REPLIED,
    };
  }

  async bulkMarkRepliedByFilter(dto: BulkMarkRepliedByFilterDto, user: AuthUser) {
    const targetStatus = dto.bmReplyStatus || BmReplyStatus.NOT_REPLIED;
    const requestedStoreId = dto.storeId;

    let effectiveStoreFilter: string | undefined;
    let storeScopeName = "all";

    if (this.storeAccess) {
      const accessibleStores = await this.storeAccess.accessibleStoreIds(user);
      if (requestedStoreId && requestedStoreId !== "all") {
        await this.storeAccess.assertStoreAccess(user, requestedStoreId);
        effectiveStoreFilter = requestedStoreId;
        const store = await this.prisma.store.findUnique({ where: { id: requestedStoreId }, select: { name: true } });
        storeScopeName = store?.name || requestedStoreId;
      } else {
        if (accessibleStores === null) {
          effectiveStoreFilter = undefined;
          storeScopeName = "all";
        } else {
          throw new ForbiddenException("Bulk update across all stores is restricted to ADMIN users");
        }
      }
    } else {
      if (requestedStoreId && requestedStoreId !== "all") {
        effectiveStoreFilter = requestedStoreId;
      }
    }

    const operationalWhere = this.operations
      ? await this.operations.getOperationalConversationFilter()
      : {};

    const whereClause: Prisma.ConversationWhereInput = {
      ...operationalWhere,
      bmReplyStatus: targetStatus,
      ...(effectiveStoreFilter ? { storeId: effectiveStoreFilter } : {}),
    };

    const matchingConversations = await this.prisma.conversation.findMany({
      where: whereClause,
      select: {
        id: true,
        storeId: true,
        bmReplyStatus: true,
        followUpStatus: true,
      },
    });

    if (matchingConversations.length === 0) {
      return {
        success: true,
        updatedCount: 0,
        affectedCount: 0,
        storeId: requestedStoreId || "all",
        status: BmReplyStatus.REPLIED,
      };
    }

    const matchingIds = matchingConversations.map((c) => c.id);
    const now = new Date();
    const actorName = user.displayName || user.email || (user.role === "ADMIN" ? "Admin" : "User");

    await this.prisma.$transaction(async (tx) => {
      await tx.conversation.updateMany({
        where: { id: { in: matchingIds } },
        data: {
          bmReplyStatus: BmReplyStatus.REPLIED,
          followUpStatus: FollowUpStatus.COMPLETED,
          updatedAt: now,
        },
      });

      const batchSize = 100;
      for (let i = 0; i < matchingConversations.length; i += batchSize) {
        const batch = matchingConversations.slice(i, i + batchSize);
        await tx.activityHistory.createMany({
          data: batch.map((conv) => ({
            conversationId: conv.id,
            actionType: ActivityActionType.BM_REPLY_STATUS_CHANGED,
            previousBmReplyStatus: conv.bmReplyStatus,
            newBmReplyStatus: BmReplyStatus.REPLIED,
            previousStatus: conv.followUpStatus !== FollowUpStatus.COMPLETED ? conv.followUpStatus : undefined,
            newStatus: FollowUpStatus.COMPLETED,
            description: "Bulk marked as replied via filter",
            createdByUserId: user.id,
            createdByName: actorName,
            metadata: {
              actionType: "BULK_MARK_REPLIED",
              storeId: conv.storeId,
              actorUserId: user.id,
            },
          })),
        });
      }
    });

    if (this.auditLog) {
      await this.auditLog.record({
        actorUserId: user.id,
        action: "BULK_MARK_REPLIED",
        metadata: {
          affectedCount: matchingConversations.length,
          storeId: requestedStoreId || "all",
          storeName: storeScopeName,
          targetFilterStatus: targetStatus,
          actorUserId: user.id,
        },
      });
    }

    Logger.log(
      JSON.stringify({
        event: "BULK_MARK_REPLIED_BY_FILTER",
        actorUserId: user.id,
        actorName,
        storeId: requestedStoreId || "all",
        storeName: storeScopeName,
        affectedCount: matchingConversations.length,
        timestamp: now.toISOString(),
      }),
      "ConversationsService",
    );

    return {
      success: true,
      updatedCount: matchingConversations.length,
      affectedCount: matchingConversations.length,
      storeId: requestedStoreId || "all",
      status: BmReplyStatus.REPLIED,
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
    const items = await this.prisma.message.findMany({ where: { conversationId: id }, include: { media: true, sender: { select: { id: true, displayName: true } } }, orderBy: [{ sentAt: "desc" }, { id: "desc" }], skip: (safePage - 1) * safeSize, take: safeSize });
    return { items: items.reverse().map((message) => this.safeMessage(message)), total, page: safePage, pageSize: safeSize, hasEarlier: safePage * safeSize < total };
  }

  private async claimEligibleReplyToken(conversationId: string): Promise<{ messageId: string; replyToken: string; ageMs: number; ageBucket: string } | null> {
    if (typeof this.prisma.message?.findFirst !== "function" || typeof this.prisma.message?.updateMany !== "function") {
      return null;
    }

    const eligible = await this.prisma.message.findFirst({
      where: {
        conversationId,
        direction: MessageDirection.INBOUND,
        encryptedLineReplyToken: { not: null },
        lineReplyTokenUsedAt: null,
      },
      orderBy: [{ lineReplyTokenReceivedAt: "desc" }, { sentAt: "desc" }, { id: "desc" }],
      select: { id: true, encryptedLineReplyToken: true, lineReplyTokenReceivedAt: true, sentAt: true },
    });

    if (eligible?.encryptedLineReplyToken) {
      const claimedAt = new Date();
      const updateResult = await this.prisma.message.updateMany({
        where: {
          id: eligible.id,
          lineReplyTokenUsedAt: null,
        },
        data: {
          lineReplyTokenUsedAt: claimedAt,
        },
      });

      if (updateResult.count === 1) {
        try {
          const replyToken = this.encryption.decrypt(eligible.encryptedLineReplyToken);
          const receivedAt = eligible.lineReplyTokenReceivedAt ?? eligible.sentAt ?? claimedAt;
          const ageMs = Math.max(0, claimedAt.getTime() - receivedAt.getTime());
          const ageBucket = getReplyTokenAgeBucket(ageMs);
          return { messageId: eligible.id, replyToken, ageMs, ageBucket };
        } catch {
          Logger.warn(`Failed to decrypt reply token for message ${eligible.id}`, "ConversationsService");
        }
      }
    }

    return null;
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

    const claimed = await this.claimEligibleReplyToken(conversation.id);
    let lineResult: { requestId: string | null; acceptedRequestId: string | null; externalMessageId: string | null; duplicateAccepted: boolean };
    let deliveryMethod: "REPLY" | "PUSH" = "PUSH";

    if (claimed) {
      const replyRes = await this.lineMessaging.replyText({
        accessToken,
        replyToken: claimed.replyToken,
        text,
        context: {
          conversationId: conversation.id,
          userId: operator.id,
          storeId: conversation.storeId ?? undefined,
          storeName: conversation.store?.name,
          channelId: oa.channelId || oa.id,
          replyTokenAgeMs: claimed.ageMs,
          replyTokenAgeBucket: claimed.ageBucket,
        },
      });

      if (replyRes.success) {
        lineResult = {
          requestId: replyRes.requestId,
          acceptedRequestId: null,
          externalMessageId: replyRes.externalMessageId,
          duplicateAccepted: false,
        };
        deliveryMethod = "REPLY";
      } else if (replyRes.invalidReplyToken) {
        lineResult = await this.lineMessaging.pushText({
          accessToken,
          lineUserId: conversation.customer.lineUserId,
          text,
          retryKey: dto.idempotencyKey,
          context: {
            conversationId: conversation.id,
            userId: operator.id,
            storeId: conversation.storeId ?? undefined,
            storeName: conversation.store?.name,
            channelId: oa.channelId || oa.id,
            replyTokenAgeMs: claimed.ageMs,
            replyTokenAgeBucket: claimed.ageBucket,
            fallbackReason: "INVALID_REPLY_TOKEN",
          },
        });
        deliveryMethod = "PUSH";
      } else {
        throw new ServiceUnavailableException("ส่งข้อความไม่สำเร็จ กรุณาลองอีกครั้ง");
      }
    } else {
      lineResult = await this.lineMessaging.pushText({
        accessToken,
        lineUserId: conversation.customer.lineUserId,
        text,
        retryKey: dto.idempotencyKey,
        context: {
          conversationId: conversation.id,
          userId: operator.id,
          storeId: conversation.storeId ?? undefined,
          storeName: conversation.store?.name,
          channelId: oa.channelId || oa.id,
        },
      });
      deliveryMethod = "PUSH";
    }

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
              deliveryMethod,
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
            description: `Customer message sent via LINE (${deliveryMethod}); storeId=${conversation.storeId}; lineOfficialAccountId=${conversation.lineOfficialAccountId}`,
          },
        });
        return created;
      });
      this.publishOutboundMessage(conversation, message);
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
    const conversation = await this.prisma.conversation.findUnique({ where: { id }, include: { customer: true, lineOfficialAccount: true, store: true } });
    if (!conversation) throw new NotFoundException("ไม่พบการสนทนา");
    if (!conversation.customer.lineUserId) throw new BadRequestException("ไม่พบ LINE User ID ของลูกค้า");
    if (!conversation.lineOfficialAccount?.isActive || conversation.lineOfficialAccount.archivedAt || !conversation.lineOfficialAccount.encryptedChannelAccessToken) throw new BadRequestException("LINE Official Account นี้ไม่ได้เปิดใช้งาน");
    let accessToken: string; try { accessToken = this.encryption.decrypt(conversation.lineOfficialAccount.encryptedChannelAccessToken); } catch { throw new ServiceUnavailableException("ไม่สามารถอ่าน Channel Access Token ของร้านนี้ได้"); }
    const objectKey = `line-media/outbound/${conversation.id}/${idempotencyKey}.${extensions[mime]}`;
    const stored = await this.media.put(objectKey, file.buffer, mime);
    if (!stored.fileId && !stored.provider) throw new ServiceUnavailableException("Media storage failed to persist outbound image");
    try {
      const imageUrl = createMediaPublicUrl(objectKey);
      let domain: string | undefined;
      try { domain = new URL(imageUrl).hostname; } catch { /* ignore */ }

      const claimed = await this.claimEligibleReplyToken(conversation.id);
      let lineResult: { requestId: string | null; acceptedRequestId: string | null; externalMessageId: string | null; duplicateAccepted: boolean };
      let deliveryMethod: "REPLY" | "PUSH" = "PUSH";

      if (claimed) {
        const replyRes = await this.lineMessaging.replyImage({
          accessToken,
          replyToken: claimed.replyToken,
          originalContentUrl: imageUrl,
          previewImageUrl: imageUrl,
          context: {
            conversationId: conversation.id,
            userId: operator.id,
            storeId: conversation.storeId ?? undefined,
            storeName: conversation.store?.name,
            channelId: conversation.lineOfficialAccount.channelId || conversation.lineOfficialAccount.id,
            replyTokenAgeMs: claimed.ageMs,
            replyTokenAgeBucket: claimed.ageBucket,
            imageUrlDomain: domain,
          },
        });

        if (replyRes.success) {
          lineResult = {
            requestId: replyRes.requestId,
            acceptedRequestId: null,
            externalMessageId: replyRes.externalMessageId,
            duplicateAccepted: false,
          };
          deliveryMethod = "REPLY";
        } else if (replyRes.invalidReplyToken) {
          lineResult = await this.lineMessaging.pushImage({
            accessToken,
            lineUserId: conversation.customer.lineUserId,
            originalContentUrl: imageUrl,
            previewImageUrl: imageUrl,
            retryKey: idempotencyKey,
            context: {
              conversationId: conversation.id,
              userId: operator.id,
              storeId: conversation.storeId ?? undefined,
              storeName: conversation.store?.name,
              channelId: conversation.lineOfficialAccount.channelId || conversation.lineOfficialAccount.id,
              imageUrlDomain: domain,
              replyTokenAgeMs: claimed.ageMs,
              replyTokenAgeBucket: claimed.ageBucket,
              fallbackReason: "INVALID_REPLY_TOKEN",
            },
          });
          deliveryMethod = "PUSH";
        } else {
          throw new ServiceUnavailableException("ส่งรูปภาพไม่สำเร็จ กรุณาลองอีกครั้ง");
        }
      } else {
        lineResult = await this.lineMessaging.pushImage({
          accessToken,
          lineUserId: conversation.customer.lineUserId,
          originalContentUrl: imageUrl,
          previewImageUrl: imageUrl,
          retryKey: idempotencyKey,
          context: {
            conversationId: conversation.id,
            userId: operator.id,
            storeId: conversation.storeId ?? undefined,
            storeName: conversation.store?.name,
            channelId: conversation.lineOfficialAccount.channelId || conversation.lineOfficialAccount.id,
            imageUrlDomain: domain,
          },
        });
        deliveryMethod = "PUSH";
      }

      const sentAt = new Date();
      const created = await this.prisma.$transaction(async (tx) => {
        const message = await tx.message.create({ data: { conversationId: conversation.id, externalMessageId: dedupeExternalId, direction: MessageDirection.OUTBOUND, messageType: MessageType.IMAGE, originalText: "[Image]", sentAt, senderUserId: operator.id, senderDisplayName: operator.displayName?.trim() || "Store", rawPayload: { provider: "LINE", deliveryMethod, providerMessageId: lineResult.externalMessageId, requestId: lineResult.requestId, acceptedRequestId: lineResult.acceptedRequestId } } });
        await tx.messageMedia.create({ data: { messageId: message.id, providerMessageId: dedupeExternalId, mediaType: MessageType.IMAGE, mimeType: stored.mimeType, objectKey, provider: stored.provider, fileId: stored.fileId, fileSize: stored.size, processingStatus: "READY" } });
        await tx.conversation.update({ where: { id: conversation.id }, data: { latestMessageAt: sentAt, bmReplyStatus: BmReplyStatus.REPLIED, followUpStatus: FollowUpStatus.COMPLETED } });
        return message;
      });
      this.publishOutboundMessage(conversation, created, { processingStatus: "READY", mimeType: stored.mimeType, fileSize: stored.size });
      return { message: this.safeMessage({ ...created, media: { processingStatus: "READY", mimeType: stored.mimeType, fileSize: stored.size } }), bmReplyStatus: BmReplyStatus.REPLIED, duplicate: lineResult.duplicateAccepted };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") { const existing = await this.prisma.message.findUnique({ where: { externalMessageId: dedupeExternalId }, include: { media: true } }); if (existing) return { message: this.safeMessage(existing), bmReplyStatus: BmReplyStatus.REPLIED, duplicate: true }; }
      throw error;
    }
  }

  async updateManualTags(id: string, productModelIds: string[], topicIds: string[]) {
    if (productModelIds.length > 0) {
      throw new BadRequestException("Purchase products must be updated through /mobile/conversations/:id/purchase-information");
    }
    await this.get(id);
    await this.prisma.$transaction(async (tx) => {
      const uniqueTopicIds = [...new Set(topicIds)];

      await tx.conversationTopic.deleteMany({ where: { conversationId: id, source: "MANUAL" } });

      for (const topicId of uniqueTopicIds) {
        await tx.conversationTopic.upsert({
          where: { conversationId_topicId: { conversationId: id, topicId } },
          update: { source: "MANUAL", confidence: 1 },
          create: { conversationId: id, topicId, source: "MANUAL", confidence: 1 },
        });
      }

    });
    return this.get(id);
  }

  async getBmReplyStatusSummary(accessibleStoreIds: string[] | null | undefined) {
    if (accessibleStoreIds === undefined) throw new ForbiddenException("Store scope is required");
    const storeScope: Prisma.StoreWhereInput = {
      isActive: true,
      archivedAt: null,
      ...(accessibleStoreIds === null ? {} : { id: { in: accessibleStoreIds } }),
    };
    const stores = await this.prisma.store.findMany({
      where: storeScope,
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
      where: { store: storeScope, lineOfficialAccount: { accountType: "STORE" }, ...(resetFilter as Prisma.ConversationWhereInput) },
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

      const storeCounts = item.storeId ? storeMap.get(item.storeId) : undefined;
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
        store: storeScope,
        lineOfficialAccount: { accountType: "STORE" },
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
        if (item.storeId) oldestMap.set(item.storeId, elapsedMinutes);
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
