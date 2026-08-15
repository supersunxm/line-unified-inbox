import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import { ConversationsService } from "../conversations.service";
import { PrismaService } from "../prisma.service";
import { SendConversationMessageDto } from "../dto";
import { MobileConversationQueryDto, MobileMessageQueryDto, MobileProductQueryDto, UpdateMobileConversationTagsDto } from "./mobile-conversations.dto";

const previewText = (text: string, max = 160) => text.length <= max ? text : `${text.slice(0, max - 1)}…`;

@Injectable()
export class MobileConversationsService {
  constructor(private readonly prisma: PrismaService, private readonly storeAccess: StoreAccessService, private readonly conversations: ConversationsService) {}

  async list(user: AuthUser, query: MobileConversationQueryDto) {
    const accessibleStoreIds = await this.storeAccess.accessibleStoreIds(user);
    const pageSize = Math.min(50, Math.max(1, query.pageSize));
    const where: Prisma.ConversationWhereInput = {
      store: { isActive: true, archivedAt: null },
      ...(accessibleStoreIds === null ? {} : { storeId: { in: accessibleStoreIds } }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where,
        orderBy: [{ latestMessageAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          latestMessageAt: true,
          bmReplyStatus: true,
          followUpStatus: true,
          customer: { select: { id: true, displayName: true } },
          store: { select: { id: true, name: true, code: true } },
          messages: { orderBy: [{ sentAt: "desc" }, { id: "desc" }], take: 1, select: { id: true, direction: true, messageType: true, originalText: true, sentAt: true } },
          _count: { select: { pushNotifications: { where: { userId: user.id, readAt: null } } } },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);
    return {
      items: items.map((item) => {
        const message = item.messages[0] ?? null;
        return {
          id: item.id,
          customer: item.customer,
          store: item.store,
          latestMessageAt: item.latestMessageAt,
          bmReplyStatus: item.bmReplyStatus,
          followUpStatus: item.followUpStatus,
          unreadCount: item._count.pushNotifications,
          lastMessage: message ? { id: message.id, direction: message.direction, messageType: message.messageType, preview: previewText(message.originalText), sentAt: message.sentAt } : null,
        };
      }),
      total,
      page: query.page,
      pageSize,
    };
  }

  async get(user: AuthUser, conversationId: string, query: MobileMessageQueryDto = new MobileMessageQueryDto()) {
    await this.storeAccess.assertConversationAccess(user, conversationId);
    const cursor = query.before ? decodeCursor(query.before) : null;
    if (query.before && !cursor) throw new NotFoundException("Invalid message cursor");
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        latestMessageAt: true,
        bmReplyStatus: true,
        followUpStatus: true,
        sourceChannel: true,
        customer: { select: { id: true, displayName: true } },
        store: { select: { id: true, name: true, code: true } },
        products: {
          where: { source: "MANUAL" },
          take: 1,
          select: { productModel: { select: { id: true, name: true, productSeries: { select: { name: true, productGroup: true } } } } },
        },
        messages: {
          where: cursor ? { OR: [{ sentAt: { lt: cursor.sentAt } }, { sentAt: cursor.sentAt, id: { lt: cursor.id } }] } : undefined,
          orderBy: [{ sentAt: "desc" }, { id: "desc" }],
          take: query.limit + 1,
          select: { id: true, direction: true, messageType: true, originalText: true, sentAt: true, senderUserId: true, senderDisplayName: true, media: { select: { processingStatus: true, mimeType: true, fileSize: true } } },
        },
        _count: { select: { pushNotifications: { where: { userId: user.id, readAt: null } } } },
      },
    });
    if (!conversation) throw new NotFoundException("Conversation not found");
    const hasEarlier = conversation.messages.length > query.limit;
    const pageMessages = conversation.messages.slice(0, query.limit).reverse();
    const oldest = pageMessages[0];
    return {
      id: conversation.id,
      customer: conversation.customer,
      store: conversation.store,
      latestMessageAt: conversation.latestMessageAt,
      bmReplyStatus: conversation.bmReplyStatus,
      followUpStatus: conversation.followUpStatus,
      tags: {
        sourceChannel: conversation.sourceChannel,
        product: conversation.products?.[0]
          ? {
              id: conversation.products[0].productModel.id,
              productName: conversation.products[0].productModel.name,
              category: conversation.products[0].productModel.productSeries.productGroup,
              seriesName: conversation.products[0].productModel.productSeries.name,
            }
          : null,
      },
      unreadCount: conversation._count.pushNotifications,
      nextCursor: hasEarlier && oldest ? encodeCursor(oldest.sentAt, oldest.id) : null,
      messages: pageMessages.map((message) => ({
        id: message.id,
        direction: message.direction,
        messageType: message.messageType,
        text: message.originalText,
        sentAt: message.sentAt,
        sender: message.direction === "OUTBOUND" ? { userId: message.senderUserId, displayName: message.senderDisplayName ?? "Store" } : null,
        media: message.media ? { processingStatus: message.media.processingStatus, mimeType: message.media.mimeType, fileSize: message.media.fileSize, url: message.media.processingStatus === "READY" ? `/messages/${message.id}/media` : null } : null,
      })),
    };
  }

  async markRead(user: AuthUser, conversationId: string) {
    await this.storeAccess.assertConversationAccess(user, conversationId);
    await this.prisma.pushNotification.updateMany({
      where: { userId: user.id, conversationId, readAt: null },
      data: { readAt: new Date() },
    });
    return { conversationId, unreadCount: 0 };
  }

  async products(query: MobileProductQueryDto) {
    const search = query.search?.trim();
    const models = await this.prisma.productModel.findMany({
      where: {
        isActive: true,
        classificationLevel: "MODEL",
        productSeries: {
          isActive: true,
          ...(query.category ? { productGroup: query.category } : {}),
        },
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: Math.min(50, Math.max(1, query.limit)),
      select: { id: true, name: true, productSeries: { select: { name: true, productGroup: true } } },
    });
    return {
      items: models.map((model) => ({
        id: model.id,
        productName: model.name,
        category: model.productSeries.productGroup,
        seriesName: model.productSeries.name,
      })),
    };
  }

  async updateTags(user: AuthUser, conversationId: string, dto: UpdateMobileConversationTagsDto) {
    await this.storeAccess.assertConversationAccess(user, conversationId);
    await this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.findUnique({ where: { id: conversationId }, select: { id: true } });
      if (!conversation) throw new NotFoundException("Conversation not found");

      let productModel: { id: string } | null = null;
      if (dto.productId !== undefined && dto.productId !== null) {
        productModel = await tx.productModel.findFirst({
          where: { id: dto.productId, isActive: true, classificationLevel: "MODEL", productSeries: { isActive: true } },
          select: { id: true },
        });
        if (!productModel) throw new BadRequestException("Product model is unavailable");
      }

      if (dto.sourceChannel !== undefined) {
        await tx.conversation.update({ where: { id: conversationId }, data: { sourceChannel: dto.sourceChannel } });
      }

      if (dto.productId !== undefined) {
        await tx.conversationProduct.deleteMany({ where: { conversationId, source: "MANUAL" } });
        if (productModel) {
          await tx.conversationProduct.create({ data: { conversationId, productModelId: productModel.id, source: "MANUAL", confidence: 1 } });
        }
      }
    });
    return this.get(user, conversationId);
  }

  async send(user: AuthUser, conversationId: string, dto: SendConversationMessageDto) {
    await this.storeAccess.assertConversationAccess(user, conversationId);
    return this.conversations.sendMessage(conversationId, dto, user);
  }

  async sendImage(user: AuthUser, conversationId: string, file: { buffer: Buffer; mimetype: string; size: number }, idempotencyKey: string) {
    await this.storeAccess.assertConversationAccess(user, conversationId);
    return this.conversations.sendImage(conversationId, file, idempotencyKey, user);
  }
}

function encodeCursor(sentAt: Date, id: string) { return Buffer.from(JSON.stringify({ sentAt: sentAt.toISOString(), id }), "utf8").toString("base64url"); }
function decodeCursor(value: string): { sentAt: Date; id: string } | null { try { const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { sentAt?: string; id?: string }; if (!parsed.sentAt || !parsed.id) return null; const sentAt = new Date(parsed.sentAt); return Number.isNaN(sentAt.getTime()) ? null : { sentAt, id: parsed.id }; } catch { return null; } }
