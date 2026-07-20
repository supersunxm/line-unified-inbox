import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ActivityActionType, FollowUpStatus, Prisma } from "@prisma/client";
import { ConversationQueryDto, CreateNoteDto } from "./dto";
import { PrismaService } from "./prisma.service";
import { isValidManagerUrl } from "./store-master/store-master.utils";
import { resolveLineOaManagerUrl } from "./store-master/line-oa-manager-url";

export const conversationInclude = {
  customer: true,
  store: { include: { storeMaster: true } },
  lineOfficialAccount: true,
  messages: { orderBy: { sentAt: "desc" as const }, include: { media: true } },
  products: { include: { productModel: { include: { productSeries: true } } } },
  topics: { include: { topic: true } },
  notes: { orderBy: { createdAt: "desc" as const } },
  activityHistory: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.ConversationInclude;
type IncludedConversation = Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>;

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}
  private async safe(item: IncludedConversation) {
    const value = item.customer.lineUserId;
    const { store: rawStore, lineOfficialAccount: rawLineOfficialAccount, ...conversation } = item;
    const { storeMaster, ...store } = rawStore;
    const resolvedLineOaManagerUrl = await resolveLineOaManagerUrl(this.prisma, item.store);
    const lineOfficialAccount = { id: rawLineOfficialAccount.id, name: rawLineOfficialAccount.name, basicId: rawLineOfficialAccount.basicId, connectionStatus: rawLineOfficialAccount.connectionStatus, isActive: rawLineOfficialAccount.isActive, lastWebhookReceivedAt: rawLineOfficialAccount.lastWebhookReceivedAt };
    return { ...conversation, resolvedLineOaManagerUrl, lineOfficialAccount, store: { ...store, lineManagerUrl: resolvedLineOaManagerUrl, lineManagerUrlStatus: resolvedLineOaManagerUrl ? "VALID" : storeMaster?.lineManagerUrl && !isValidManagerUrl(storeMaster.lineManagerUrl) ? "INVALID" : "MISSING" }, customer: { ...item.customer, lineUserId: value ? `${value.slice(0, 4)}••••${value.slice(-4)}` : null }, messages: item.messages.map((message) => this.safeMessage(message)) };
  }

  private safeMessage<T extends { id: string; media?: { processingStatus: string; mimeType: string | null; fileSize: number | null } | null }>(message: T) {
    const { media, ...safe } = message;
    return { ...safe, media: media ? { processingStatus: media.processingStatus, mimeType: media.mimeType, fileSize: media.fileSize, url: media.processingStatus === "READY" ? `/messages/${message.id}/media` : null } : null };
  }

  async list(query: ConversationQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.ConversationWhereInput = {
      store: { archivedAt: null },
      storeId: query.storeId,
      followUpStatus: query.followUpStatus,
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
    const orderBy: Prisma.ConversationOrderByWithRelationInput =
      query.sort === "latest-asc" ? { latestMessageAt: "asc" } :
      query.sort === "priority-desc" ? { priority: "desc" } : { latestMessageAt: "desc" };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({ where, include: conversationInclude, orderBy, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.conversation.count({ where }),
    ]);
    return { items: await Promise.all(items.map((item) => this.safe(item))), total, page: query.page, pageSize: query.pageSize };
  }

  async get(id: string) {
    const item = await this.prisma.conversation.findUnique({ where: { id }, include: conversationInclude });
    if (!item) throw new NotFoundException("Conversation not found");
    return this.safe(item);
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

  async updateManualTags(id: string, productModelIds: string[], topicIds: string[]) {
    await this.get(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.conversationProduct.deleteMany({ where: { conversationId: id, source: "MANUAL" } });
      await tx.conversationTopic.deleteMany({ where: { conversationId: id, source: "MANUAL" } });
      for (const productModelId of [...new Set(productModelIds)]) await tx.conversationProduct.upsert({ where: { conversationId_productModelId: { conversationId: id, productModelId } }, update: { source: "MANUAL", confidence: 1 }, create: { conversationId: id, productModelId, source: "MANUAL", confidence: 1 } });
      for (const topicId of [...new Set(topicIds)]) await tx.conversationTopic.upsert({ where: { conversationId_topicId: { conversationId: id, topicId } }, update: { source: "MANUAL", confidence: 1 }, create: { conversationId: id, topicId, source: "MANUAL", confidence: 1 } });
    });
    return this.get(id);
  }
}
