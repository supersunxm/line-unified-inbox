import { Injectable } from "@nestjs/common";
import { Prisma, PushNotificationStatus, UserStatus } from "@prisma/client";

type NotificationClient = Prisma.TransactionClient;

@Injectable()
export class NotificationEnqueueService {
  async enqueueInboundMessage(tx: NotificationClient, input: { storeId: string; conversationId: string; messageId: string; customerName: string; messageType: string; preview: string; sentAt: string }) {
    const memberships = await tx.userStoreMembership.findMany({
      where: {
        storeId: input.storeId,
        status: "ACTIVE",
        user: {
          isActive: true,
          status: UserStatus.ACTIVE,
          deviceTokens: { some: { isActive: true } },
        },
      },
      select: { userId: true },
    });
    if (memberships.length === 0) return { count: 0 };
    const result = await tx.pushNotification.createMany({
      data: memberships.map((membership) => ({
        userId: membership.userId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        type: "INBOUND_MESSAGE",
        payload: { conversationId: input.conversationId, messageId: input.messageId, customerName: input.customerName, messageType: input.messageType, preview: input.preview, sentAt: input.sentAt },
        status: PushNotificationStatus.PENDING,
      })),
      skipDuplicates: true,
    });
    return { count: result.count };
  }
}
