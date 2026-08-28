import { BadRequestException, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, ServiceUnavailableException } from "@nestjs/common";
import { CredentialEncryptionService } from "./credential-encryption.service";
import { PrismaService } from "../prisma.service";

const TOKEN_ENDPOINT = "https://api.line.me/oauth2/v3/token";
const BOT_INFO_ENDPOINT = "https://api.line.me/v2/bot/info";
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const MANAGED_REFRESH_ERROR = "Automatic LINE stateless token refresh failed";

type StatelessTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
};

export type LineBotInfo = {
  userId?: string;
  basicId?: string;
  premiumId?: string;
  displayName?: string;
  pictureUrl?: string;
  chatMode?: string;
  markAsReadMode?: string;
};

@Injectable()
export class LineStatelessTokenService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(LineStatelessTokenService.name);
  private refreshTimer?: NodeJS.Timeout;
  private refreshRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: CredentialEncryptionService,
  ) {}

  async onApplicationBootstrap() {
    if (process.env.NODE_ENV === "test") return;
    await this.refreshAllHeadOfficeTokens();
    this.refreshTimer = setInterval(() => {
      void this.refreshAllHeadOfficeTokens();
    }, REFRESH_INTERVAL_MS);
    this.refreshTimer.unref?.();
  }

  onApplicationShutdown() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  async issueToken(channelId: string, channelSecret: string) {
    const clientId = channelId.trim();
    const clientSecret = channelSecret.trim();
    if (!clientId || !clientSecret) throw new BadRequestException("Channel ID and Channel Secret are required");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }),
        signal: controller.signal,
      });
    } catch {
      throw new ServiceUnavailableException("Unable to contact LINE to issue a channel access token");
    } finally {
      clearTimeout(timeout);
    }

    let body: StatelessTokenResponse = {};
    try { body = await response.json() as StatelessTokenResponse; } catch { /* LINE returned a non-JSON error body. */ }

    if (!response.ok || !body.access_token) {
      if (response.status === 400 || response.status === 401) {
        throw new BadRequestException("Channel ID or Channel Secret is invalid for this Messaging API channel");
      }
      throw new ServiceUnavailableException("LINE could not issue a channel access token");
    }

    return {
      accessToken: body.access_token,
      expiresIn: Number.isFinite(body.expires_in) ? Number(body.expires_in) : 900,
      tokenType: body.token_type || "Bearer",
    };
  }

  async getBotInfo(accessToken: string): Promise<LineBotInfo> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch(BOT_INFO_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
    } catch {
      throw new ServiceUnavailableException("Unable to contact LINE to verify the Messaging API channel");
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      if (response.status === 401) throw new BadRequestException("LINE rejected the generated channel access token");
      throw new ServiceUnavailableException("LINE could not verify the Messaging API channel");
    }

    try { return await response.json() as LineBotInfo; }
    catch { throw new ServiceUnavailableException("LINE returned an invalid bot information response"); }
  }

  async issueAndInspect(channelId: string, channelSecret: string) {
    const token = await this.issueToken(channelId, channelSecret);
    const botInfo = await this.getBotInfo(token.accessToken);
    return { ...token, botInfo };
  }

  async refreshAllHeadOfficeTokens() {
    if (this.refreshRunning) return;
    this.refreshRunning = true;
    try {
      const accounts = await this.prisma.lineOfficialAccount.findMany({
        where: {
          accountType: "HEAD_OFFICE",
          archivedAt: null,
          isActive: true,
          channelId: { not: null },
          encryptedChannelSecret: { not: null },
        },
        select: {
          id: true,
          channelId: true,
          encryptedChannelSecret: true,
          lastWebhookReceivedAt: true,
          lastConnectionError: true,
        },
      });

      await Promise.all(accounts.map(async (account) => {
        if (!account.channelId || !account.encryptedChannelSecret) return;
        try {
          const secret = this.encryption.decrypt(account.encryptedChannelSecret);
          const issued = await this.issueToken(account.channelId, secret);
          const recoveredFromManagedError = account.lastConnectionError?.startsWith(MANAGED_REFRESH_ERROR) ?? false;
          await this.prisma.lineOfficialAccount.update({
            where: { id: account.id },
            data: {
              encryptedChannelAccessToken: this.encryption.encrypt(issued.accessToken),
              lastConnectionTestAt: new Date(),
              ...(recoveredFromManagedError ? {
                connectionStatus: account.lastWebhookReceivedAt ? "CONNECTED" : "READY",
                lastConnectionError: null,
              } : {}),
            },
          });
        } catch (error) {
          this.logger.warn(`Stateless token refresh failed for Main OA ${account.id}`);
          await this.prisma.lineOfficialAccount.update({
            where: { id: account.id },
            data: {
              connectionStatus: "ERROR",
              lastConnectionTestAt: new Date(),
              lastConnectionError: `${MANAGED_REFRESH_ERROR}: ${this.safeErrorCategory(error)}`,
            },
          }).catch(() => undefined);
        }
      }));
    } finally {
      this.refreshRunning = false;
    }
  }

  private safeErrorCategory(error: unknown) {
    if (error instanceof BadRequestException) return "credentials rejected";
    if (error instanceof ServiceUnavailableException) return "LINE unavailable";
    return "credential refresh error";
  }
}
