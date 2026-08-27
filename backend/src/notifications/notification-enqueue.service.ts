import { Injectable, Logger } from "@nestjs/common";
import { Prisma, PushNotificationStatus, UserRole, UserStatus } from "@prisma/client";
import { buildNotificationContent, DEFAULT_CUSTOMER_NAME } from "./notification-content";

type NotificationClient = Prisma.TransactionClient;

@Injectable()
export class NotificationEnqueueService {
  private readonly logger = new Logger(NotificationEnqueueService.name);

  async enqueueInboundMessage(tx: NotificationClient, input: { storeId: string; storeName?: string | null; conversationId: string; messageId: string; customerName?: string | null; messageType: string; preview: string; sentAt: string }) {
    const users = await tx.user.findMany({
      where: {
        isActive: true,
        status: UserStatus.ACTIVE,
        canAccessMobile: true,
        deviceTokens: { some: { isActive: true } },
        OR: [
          { role: UserRole.ADMIN },
          { canAccessAllStores: true },
          { memberships: { some: { storeId: input.storeId, status: "ACTIVE", store: { isActive: true, archivedAt: null } } } },
        ],
      },
      select: { id: true },
    });
    if (users.length === 0) {
      this.logger.log(JSON.stringify({ event: "push_notification_enqueued", messageId: input.messageId, conversationId: input.conversationId, targetedUserCount: 0 }));
      return { count: 0 };
    }
    const content = buildNotificationContent({
      customerName: input.customerName || DEFAULT_CUSTOMER_NAME,
      storeName: input.storeName,
      messageType: input.messageType,
      preview: input.preview,
    });
    const payload = {
      conversationId: input.conversationId,
      messageId: input.messageId,
      customerName: input.customerName || DEFAULT_CUSTOMER_NAME,
      ...(input.storeName?.trim() ? { storeName: input.storeName.trim() } : {}),
      messageType: input.messageType,
      preview: content.body,
      title: content.title,
      body: content.body,
      sentAt: input.sentAt,
    };
    const result = await tx.pushNotification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        conversationId: input.conversationId,
        messageId: input.messageId,
        type: "INBOUND_MESSAGE",
        payload,
        status: PushNotificationStatus.PENDING,
      })),
      skipDuplicates: true,
    });
    this.logger.log(JSON.stringify({ event: "push_notification_enqueued", messageId: input.messageId, conversationId: input.conversationId, targetedUserCount: users.length, enqueuedCount: result.count }));
    return { count: result.count };
  }
}
