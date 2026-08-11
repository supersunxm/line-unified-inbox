import { Injectable } from "@nestjs/common";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { PrismaService } from "../prisma.service";
import type { DispatchableNotification, PushNotificationProvider } from "./notification-dispatcher.service";

type FcmResponse = { success: boolean; error?: { code?: string } };
type FcmMessaging = { sendEachForMulticast(input: { tokens: string[]; notification: { title: string; body: string }; data: Record<string, string> }): Promise<{ responses: FcmResponse[] }> };
const invalidTokenCodes = new Set(["messaging/invalid-registration-token", "messaging/registration-token-not-registered"]);

@Injectable()
export class FirebasePushProvider implements PushNotificationProvider {
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
    if (usable.length === 0) throw new Error("No active device token is available");
    const response = await this.client().sendEachForMulticast({
      tokens: usable.map((device) => device.token),
      notification: { title: "New customer message", body: "Tap to open the conversation" },
      data: { conversationId: notification.conversationId, messageId: notification.messageId, notificationId: notification.id },
    });
    let accepted = 0;
    await Promise.all(response.responses.map(async (result, index) => {
      if (result.success) { accepted += 1; return; }
      if (invalidTokenCodes.has(result.error?.code ?? "")) {
        const device = usable[index];
        if (device) await this.prisma.deviceToken.update({ where: { id: device.id }, data: { isActive: false, lastSeenAt: new Date() } });
      }
    }));
    if (accepted === 0) throw new Error("FCM did not accept any active device token");
  }
}
