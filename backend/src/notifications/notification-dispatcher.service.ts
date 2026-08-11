import { Injectable } from "@nestjs/common";
import { PushNotificationStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";

export type DispatchableNotification = { id: string; userId: string; conversationId: string; messageId: string; type: string; payload: unknown };
export interface PushNotificationProvider {
  send(notification: DispatchableNotification): Promise<void>;
}

/**
 * Worker boundary for a future FCM provider. It is intentionally never invoked
 * by the LINE webhook; webhook processing only writes PENDING outbox records.
 */
@Injectable()
export class NotificationDispatcher {
  constructor(private readonly prisma: PrismaService) {}

  async send(notification: DispatchableNotification, provider: PushNotificationProvider, alreadyClaimed = false) {
    if (!alreadyClaimed) await this.prisma.pushNotification.update({ where: { id: notification.id }, data: { status: PushNotificationStatus.PROCESSING, attemptCount: { increment: 1 }, lastError: null } });
    try {
      await provider.send(notification);
      await this.prisma.pushNotification.update({ where: { id: notification.id }, data: { status: PushNotificationStatus.SENT, sentAt: new Date() } });
    } catch (error) {
      const lastError = error instanceof Error ? error.message.slice(0, 500) : "Notification delivery failed";
      await this.prisma.pushNotification.update({ where: { id: notification.id }, data: { status: PushNotificationStatus.FAILED, lastError } });
      throw error;
    }
  }
}
