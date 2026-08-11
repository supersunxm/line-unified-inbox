import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class MobileNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async unreadCount(userId: string) {
    const unreadCount = await this.prisma.pushNotification.count({ where: { userId, readAt: null } });
    return { unreadCount };
  }

  async markRead(userId: string, notificationId: string) {
    await this.prisma.pushNotification.updateMany({ where: { id: notificationId, userId, readAt: null }, data: { readAt: new Date() } });
    return this.unreadCount(userId);
  }

  async markOpened(userId: string, notificationId: string) {
    const now = new Date();
    await this.prisma.pushNotification.updateMany({ where: { id: notificationId, userId }, data: { openedAt: now, readAt: now } });
    return this.unreadCount(userId);
  }
}
