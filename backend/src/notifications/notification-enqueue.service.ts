import { Injectable, Logger } from "@nestjs/common";
import { Prisma, PushNotificationStatus, UserRole, UserStatus } from "@prisma/client";

type NotificationClient = Prisma.TransactionClient;

@Injectable()
export class NotificationEnqueueService {
  private readonly logger = new Logger(NotificationEnqueueService.name);

  async enqueueInboundMessage(tx: NotificationClient, input: { storeId: string; conversationId: string; messageId: string; customerName: string; messageType: string; preview: string; sentAt: string }) {
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
    const result = await tx.pushNotification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        conversationId: input.conversationId,
        messageId: input.messageId,
        type: "INBOUND_MESSAGE",
        payload: { conversationId: input.conversationId, messageId: input.messageId, customerName: input.customerName, messageType: input.messageType, preview: input.preview, sentAt: input.sentAt },
        status: PushNotificationStatus.PENDING,
      })),
      skipDuplicates: true,
    });
    this.logger.log(JSON.stringify({ event: "push_notification_enqueued", messageId: input.messageId, conversationId: input.conversationId, targetedUserCount: users.length, enqueuedCount: result.count }));
    return { count: result.count };
  }
}
