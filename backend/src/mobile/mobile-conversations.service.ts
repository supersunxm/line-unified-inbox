import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import { ConversationsService } from "../conversations.service";
import { PrismaService } from "../prisma.service";
import { SendConversationMessageDto } from "../dto";
import { MobileConversationQueryDto } from "./mobile-conversations.dto";

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

  async get(user: AuthUser, conversationId: string) {
    await this.storeAccess.assertConversationAccess(user, conversationId);
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        latestMessageAt: true,
        bmReplyStatus: true,
        followUpStatus: true,
        customer: { select: { id: true, displayName: true } },
        store: { select: { id: true, name: true, code: true } },
        messages: {
          orderBy: [{ sentAt: "desc" }, { id: "desc" }],
          take: 50,
          select: { id: true, direction: true, messageType: true, originalText: true, sentAt: true, media: { select: { processingStatus: true, mimeType: true, fileSize: true } } },
        },
        _count: { select: { pushNotifications: { where: { userId: user.id, readAt: null } } } },
      },
    });
    if (!conversation) throw new NotFoundException("Conversation not found");
    return {
      id: conversation.id,
      customer: conversation.customer,
      store: conversation.store,
      latestMessageAt: conversation.latestMessageAt,
      bmReplyStatus: conversation.bmReplyStatus,
      followUpStatus: conversation.followUpStatus,
      unreadCount: conversation._count.pushNotifications,
      messages: conversation.messages.reverse().map((message) => ({
        id: message.id,
        direction: message.direction,
        messageType: message.messageType,
        text: message.originalText,
        sentAt: message.sentAt,
        media: message.media ? { processingStatus: message.media.processingStatus, mimeType: message.media.mimeType, fileSize: message.media.fileSize, url: message.media.processingStatus === "READY" ? `/messages/${message.id}/media` : null } : null,
      })),
    };
  }

  async send(user: AuthUser, conversationId: string, dto: SendConversationMessageDto) {
    await this.storeAccess.assertConversationAccess(user, conversationId);
    return this.conversations.sendMessage(conversationId, dto, user);
  }
}
