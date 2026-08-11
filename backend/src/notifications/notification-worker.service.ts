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
    if (process.env.NODE_ENV === "test" || !this.provider.configured()) return;
    void this.processCycle();
    this.timer = setInterval(() => { void this.processCycle(); }, 5_000);
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  async processPending(limit = 50) { return this.process(PushNotificationStatus.PENDING, limit); }
  async retryFailed(limit = 50) { return this.process(PushNotificationStatus.FAILED, limit); }
  private async processCycle() { await this.processPending(); await this.retryFailed(); }

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
        } catch {
          this.logger.warn(`Push notification dispatch failed for ${notification.id}`);
        }
        processed += 1;
      }
      return processed;
    } finally { this.running = false; }
  }
}
