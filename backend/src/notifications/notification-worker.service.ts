import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PushNotificationStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { FirebasePushProvider } from "./firebase-push.provider";
import { NotificationDispatcher } from "./notification-dispatcher.service";

@Injectable()
export class NotificationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  constructor(private readonly prisma: PrismaService, private readonly dispatcher: NotificationDispatcher, private readonly provider: FirebasePushProvider) {}

  onModuleInit() {
    if (process.env.NODE_ENV === "test") return;
    if (!this.provider.configured()) {
      this.logger.warn(JSON.stringify({ event: "push_worker_disabled", reason: "missing_fcm_configuration" }));
      return;
    }
    void this.processCycle();
    this.timer = setInterval(() => { void this.processCycle(); }, 5_000);
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  async processPending(limit = 50) { return this.process(PushNotificationStatus.PENDING, limit); }
  async retryFailed(limit = 50) { return this.process(PushNotificationStatus.FAILED, limit); }
  private async processCycle() {
    try {
      await this.processPending();
      await this.retryFailed();
    } catch (error) {
      this.logger.error(JSON.stringify({ event: "push_worker_cycle_failed", errorType: error instanceof Error ? error.constructor.name : "UnknownError" }));
    }
  }

  private async process(status: PushNotificationStatus, limit: number) {
    if (this.running) return 0;
    this.running = true;
    try {
      const pending = await this.prisma.pushNotification.findMany({ where: status === PushNotificationStatus.FAILED ? { status, attemptCount: { lt: 3 } } : { status }, orderBy: { createdAt: "asc" }, take: Math.min(100, Math.max(1, limit)), select: { id: true, userId: true, conversationId: true, messageId: true, type: true, payload: true } });
      let processed = 0;
      for (const notification of pending) {
        const claimed = await this.prisma.pushNotification.updateMany({ where: { id: notification.id, status }, data: { status: PushNotificationStatus.PROCESSING, attemptCount: { increment: 1 }, lastError: null } });
        if (claimed.count === 0) continue;
        try {
          await this.dispatcher.send(notification, this.provider, true);
        } catch (error) {
          this.logger.warn(JSON.stringify({ event: "push_notification_dispatch_failed", notificationId: notification.id, messageId: notification.messageId, errorType: error instanceof Error ? error.constructor.name : "UnknownError" }));
        }
        processed += 1;
      }
      return processed;
    } finally { this.running = false; }
  }
}
