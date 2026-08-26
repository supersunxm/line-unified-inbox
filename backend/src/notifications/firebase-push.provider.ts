import { Injectable, Logger } from "@nestjs/common";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { PrismaService } from "../prisma.service";
import type { DispatchableNotification, PushNotificationProvider } from "./notification-dispatcher.service";

type FcmResponse = { success: boolean; error?: { code?: string } };
type FcmMessaging = { sendEachForMulticast(input: { tokens: string[]; data: Record<string, string>; notification: { title: string; body: string }; android: { priority: "high"; notification: { channelId: string; sound: "default" } } }): Promise<{ responses: FcmResponse[] }> };
type NotificationPayload = { customerName?: unknown; messageType?: unknown; preview?: unknown; sentAt?: unknown };
const invalidTokenCodes = new Set(["messaging/invalid-registration-token", "messaging/registration-token-not-registered"]);
export const ANDROID_NOTIFICATION_CHANNEL_ID = "line_oa_messages";

@Injectable()
export class FirebasePushProvider implements PushNotificationProvider {
  private readonly logger = new Logger(FirebasePushProvider.name);
  private messaging: FcmMessaging | null = null;
  constructor(private readonly prisma: PrismaService, private readonly encryption: CredentialEncryptionService) {}

  configured(environment = process.env) { return Boolean(environment.FCM_PROJECT_ID?.trim() && environment.FCM_CLIENT_EMAIL?.trim() && environment.FCM_PRIVATE_KEY?.trim()); }

  private client() {
    if (this.messaging) return this.messaging;
    const projectId = process.env.FCM_PROJECT_ID?.trim();
    const clientEmail = process.env.FCM_CLIENT_EMAIL?.trim();
    const privateKey = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
    if (!projectId || !clientEmail || !privateKey) throw new Error("FCM configuration is incomplete");
    const appName = "oppo-line-oa-mobile-push";
    const app = getApps().some((candidate) => candidate.name === appName) ? getApp(appName) : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, appName);
    this.messaging = getMessaging(app);
    return this.messaging;
  }

  async send(notification: DispatchableNotification) {
    const devices = await this.prisma.deviceToken.findMany({ where: { userId: notification.userId, isActive: true }, select: { id: true, token: true } });
    const usable: Array<{ id: string; token: string }> = [];
    for (const device of devices) {
      try { usable.push({ id: device.id, token: this.encryption.decrypt(device.token) }); }
      catch { await this.prisma.deviceToken.update({ where: { id: device.id }, data: { isActive: false, lastSeenAt: new Date() } }); }
    }
    this.logger.log(JSON.stringify({ event: "push_delivery_targeted", notificationId: notification.id, messageId: notification.messageId, targetedDeviceCount: usable.length }));
    if (usable.length === 0) throw new Error("No active device token is available");
    const payload = notification.payload as NotificationPayload;
    const value = (input: unknown, fallback = "") => typeof input === "string" ? input : fallback;
    let response: { responses: FcmResponse[] };
    try {
      response = await this.client().sendEachForMulticast({
        tokens: usable.map((device) => device.token),
        data: {
          title: "New customer message",
          body: "Tap to open the conversation",
          channelId: ANDROID_NOTIFICATION_CHANNEL_ID,
          conversationId: notification.conversationId,
          messageId: notification.messageId,
          notificationId: notification.id,
          customerName: value(payload.customerName, "Customer"),
          messageType: value(payload.messageType, "UNSUPPORTED"),
          preview: value(payload.preview, "New customer message"),
          sentAt: value(payload.sentAt),
        },
        notification: { title: "New customer message", body: "Tap to open the conversation" },
        android: { priority: "high", notification: { channelId: ANDROID_NOTIFICATION_CHANNEL_ID, sound: "default" } },
      });
    } catch (error) {
      this.logger.error(JSON.stringify({ event: "push_delivery_failed", notificationId: notification.id, messageId: notification.messageId, targetedDeviceCount: usable.length, errorType: error instanceof Error ? error.constructor.name : "UnknownError" }));
      throw error;
    }
    let accepted = 0;
    let rejected = 0;
    let invalidated = 0;
    await Promise.all(response.responses.map(async (result, index) => {
      if (result.success) { accepted += 1; return; }
      rejected += 1;
      if (invalidTokenCodes.has(result.error?.code ?? "")) {
        const device = usable[index];
        if (device) await this.prisma.deviceToken.update({ where: { id: device.id }, data: { isActive: false, lastSeenAt: new Date() } });
        invalidated += 1;
      }
    }));
    this.logger.log(JSON.stringify({ event: "push_delivery_result", notificationId: notification.id, messageId: notification.messageId, targetedDeviceCount: usable.length, acceptedCount: accepted, rejectedCount: rejected, invalidatedTokenCount: invalidated }));
    if (accepted === 0) throw new Error("FCM did not accept any active device token");
  }
}
