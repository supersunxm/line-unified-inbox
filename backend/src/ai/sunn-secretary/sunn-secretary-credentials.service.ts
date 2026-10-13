import { BadRequestException, ConflictException, HttpException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Prisma, type LineOfficialAccount } from "@prisma/client";
import { CredentialEncryptionService } from "../../credentials/credential-encryption.service";
import { PrismaService } from "../../prisma.service";
import { sunnSecretarySetupStatus } from "./sunn-secretary-owner-settings";

// A dedicated non-operational OA record. Never resolve an existing OA by name, channel or destination.
export const SECRETARY_CREDENTIAL_RECORD_ID = "5778f384-6abd-4df8-b5db-5c5635f742cd";
const RECORD_KEY = "sunn-secretary-credentials-v1";
export type CredentialInput = { channelId?: string; channelSecret?: string; accessToken?: string; botUserId?: string };
const FIELDS = ["channelId", "channelSecret", "accessToken", "botUserId"] as const;
export type ValidationState = "NOT_CONFIGURED" | "NOT_VALIDATED" | "VALIDATED" | "FAILED";

export function parseSecretaryCredentials(input: unknown): CredentialInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestException("Invalid credential payload");
  const values = input as Record<string, unknown>;
  if (Object.keys(values).some(key => !FIELDS.includes(key as typeof FIELDS[number]))) throw new BadRequestException("Invalid credential payload");
  const result: CredentialInput = {};
  for (const field of FIELDS) {
    const value = values[field];
    if (value === undefined) continue;
    if (typeof value !== "string") throw new BadRequestException("Invalid credential payload");
    const clean = value.trim();
    if (!clean) continue; // Blank fields preserve stored credentials.
    const valid = field === "channelId" ? /^\d{5,20}$/u.test(clean)
      : field === "channelSecret" ? /^[0-9a-f]{32}$/iu.test(clean)
      : field === "botUserId" ? /^U[0-9a-f]{32}$/iu.test(clean)
      : /^[A-Za-z0-9+/=_-]{20,4096}$/u.test(clean);
    if (!valid) throw new BadRequestException("Invalid credential payload");
    result[field] = clean;
  }
  if (!Object.keys(result).length) throw new BadRequestException("No credential changes submitted");
  return result;
}

@Injectable()
export class SunnSecretaryCredentialsService {
  constructor(private readonly prisma: PrismaService, private readonly encryption: CredentialEncryptionService) {}

  private assertRecord(record: LineOfficialAccount | null) {
    if (record && (record.webhookKey !== RECORD_KEY || record.accountType !== "HEAD_OFFICE" || record.storeId !== null || record.isActive || !record.archivedAt)) {
      throw new ServiceUnavailableException("Secretary credential storage unavailable");
    }
  }

  /** Inbound-only access: never return or decrypt the messaging access token. */
  async inboundIdentity(): Promise<{ botUserId: string; channelSecret: string }> {
    const record = await this.prisma.lineOfficialAccount.findUnique({ where: { id: SECRETARY_CREDENTIAL_RECORD_ID } });
    this.assertRecord(record);
    if (record) {
      if (!record.lastConnectionTestAt || record.lastConnectionError || !record.destinationId || !record.encryptedChannelSecret) {
        throw new ServiceUnavailableException("Secretary identity is not validated");
      }
      try { return { botUserId: record.destinationId, channelSecret: this.encryption.decrypt(record.encryptedChannelSecret) }; }
      catch { throw new ServiceUnavailableException("Secretary credentials cannot be read securely"); }
    }
    const botUserId = process.env.SUNN_SECRETARY_BOT_USER_ID;
    const channelSecret = process.env.SUNN_SECRETARY_CHANNEL_SECRET;
    if (!botUserId || !/^U[0-9a-f]{32}$/iu.test(botUserId) || !channelSecret) throw new ServiceUnavailableException("Secretary identity unavailable");
    return { botUserId, channelSecret };
  }

  async status() {
    const record = await this.prisma.lineOfficialAccount.findUnique({ where: { id: SECRETARY_CREDENTIAL_RECORD_ID } });
    this.assertRecord(record);
    if (record) {
      try {
        if (record.encryptedChannelSecret) this.encryption.decrypt(record.encryptedChannelSecret);
        if (record.encryptedChannelAccessToken) this.encryption.decrypt(record.encryptedChannelAccessToken);
      } catch { throw new ServiceUnavailableException("Secretary credentials cannot be read securely"); }
    }
    const presence = record ? {
      channelIdConfigured: Boolean(record.channelId), channelSecretConfigured: Boolean(record.encryptedChannelSecret),
      accessTokenConfigured: Boolean(record.encryptedChannelAccessToken), botUserIdConfigured: Boolean(record.destinationId),
    } : sunnSecretarySetupStatus(process.env);
    const complete = presence.channelIdConfigured && presence.channelSecretConfigured && presence.accessTokenConfigured && presence.botUserIdConfigured;
    const validationState: ValidationState = !complete ? "NOT_CONFIGURED" : !record?.lastConnectionTestAt ? "NOT_VALIDATED"
      : record.lastConnectionError ? "FAILED" : "VALIDATED";
    return {
      ...sunnSecretarySetupStatus(process.env), ...presence,
      storage: record ? "ENCRYPTED_DATABASE" : "ENVIRONMENT",
      validationState, lastValidatedAt: validationState === "VALIDATED" ? record?.lastConnectionTestAt?.toISOString() ?? null : null,
      validationFailureReason: validationState === "FAILED" && ["TOKEN_REJECTED", "BOT_IDENTITY_MISMATCH", "LINE_API_UNAVAILABLE"].includes(record?.lastConnectionError ?? "") ? record!.lastConnectionError : null,
    };
  }

  async consumeLimit(ownerId: string, action: "save" | "test") {
    const key = `sunn-secretary:${ownerId}:${action}`;
    const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000);
    const updated = await this.prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "AuthRateLimitBucket" ("id", "key", "windowStart", "count", "updatedAt")
      VALUES (gen_random_uuid(), ${key}, ${windowStart}, 1, NOW())
      ON CONFLICT ("key", "windowStart") DO UPDATE
      SET "count" = "AuthRateLimitBucket"."count" + 1, "updatedAt" = NOW()
      WHERE "AuthRateLimitBucket"."count" < 5 RETURNING "count";
    `;
    if (!updated.length) throw new HttpException("Too many requests", 429);
  }

  async save(ownerId: string, input: unknown) {
    const changes = parseSecretaryCredentials(input);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.prisma.$transaction(async tx => {
          const current = await tx.lineOfficialAccount.findUnique({ where: { id: SECRETARY_CREDENTIAL_RECORD_ID } });
          this.assertRecord(current);
          const base = current ? {
            channelId: current.channelId, botUserId: current.destinationId,
            channelSecret: current.encryptedChannelSecret, accessToken: current.encryptedChannelAccessToken,
          } : {
            channelId: process.env.SUNN_SECRETARY_CHANNEL_ID?.trim(), botUserId: process.env.SUNN_SECRETARY_BOT_USER_ID?.trim(),
            channelSecret: process.env.SUNN_SECRETARY_CHANNEL_SECRET ? this.encryption.encrypt(process.env.SUNN_SECRETARY_CHANNEL_SECRET) : null,
            accessToken: process.env.SUNN_SECRETARY_CHANNEL_ACCESS_TOKEN ? this.encryption.encrypt(process.env.SUNN_SECRETARY_CHANNEL_ACCESS_TOKEN) : null,
          };
          const secret = changes.channelSecret ? this.encryption.encrypt(changes.channelSecret) : base.channelSecret;
          const token = changes.accessToken ? this.encryption.encrypt(changes.accessToken) : base.accessToken;
          const channelId = changes.channelId ?? base.channelId;
          const destinationId = changes.botUserId ?? base.botUserId;
          if (!channelId || !destinationId || !secret || !token) throw new BadRequestException("All four credentials are required for initial setup");
          // Round-trip before persistence; wrong or damaged key never becomes a successful save.
          this.encryption.decrypt(secret);
          this.encryption.decrypt(token);
          const data = { channelId, destinationId, encryptedChannelSecret: secret, encryptedChannelAccessToken: token,
            lastConnectionTestAt: null, lastConnectionError: null, connectionStatus: "DISABLED" as const };
          if (current) await tx.lineOfficialAccount.update({ where: { id: current.id }, data });
          else await tx.lineOfficialAccount.create({ data: {
            ...data, id: SECRETARY_CREDENTIAL_RECORD_ID, webhookKey: RECORD_KEY, name: "Sunn Secretary credential vault",
            accountType: "HEAD_OFFICE", storeId: null, isActive: false, archivedAt: new Date(),
          } });
          await tx.auditLog.create({ data: { actorUserId: ownerId, action: "SUNN_SECRETARY_CREDENTIALS_UPDATED", metadata: { fields: Object.keys(changes) } } });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        return await this.status();
      } catch (error: unknown) {
        if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
        if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code) && attempt < 2) continue;
        throw new ServiceUnavailableException("Secretary credentials could not be saved securely");
      }
    }
    throw new ServiceUnavailableException("Secretary credentials could not be saved securely");
  }

  async testConnection(ownerId: string) {
    const record = await this.prisma.lineOfficialAccount.findUnique({ where: { id: SECRETARY_CREDENTIAL_RECORD_ID } });
    this.assertRecord(record);
    if (!record?.encryptedChannelAccessToken || !record.destinationId) throw new BadRequestException("Save credentials before testing");
    let token: string;
    try { token = this.encryption.decrypt(record.encryptedChannelAccessToken); }
    catch { throw new ServiceUnavailableException("Secretary credentials cannot be read securely"); }
    let code: string | null = null;
    try {
      // Read-only official API call. No reply, push, token issuance or webhook activation.
      const response = await fetch("https://api.line.me/v2/bot/info", {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000), redirect: "error",
      });
      if (!response.ok) code = response.status === 401 || response.status === 403 ? "TOKEN_REJECTED" : "LINE_API_UNAVAILABLE";
      else {
        const info: unknown = await response.json();
        if (!info || typeof info !== "object" || !("userId" in info) || info.userId !== record.destinationId) code = "BOT_IDENTITY_MISMATCH";
      }
    } catch { code = "LINE_API_UNAVAILABLE"; }
    // Rotation while a slow API request is running must never validate a different token.
    await this.prisma.$transaction(async tx => {
      const saved = await tx.lineOfficialAccount.updateMany({ where: {
        id: record.id, updatedAt: record.updatedAt, encryptedChannelAccessToken: record.encryptedChannelAccessToken,
        destinationId: record.destinationId, isActive: false, archivedAt: { not: null },
      }, data: { lastConnectionTestAt: new Date(), lastConnectionError: code } });
      if (saved.count !== 1) throw new ConflictException("Credentials changed; test the current configuration again");
      await tx.auditLog.create({ data: { actorUserId: ownerId, action: "SUNN_SECRETARY_CONNECTION_TESTED", metadata: { result: code ?? "BOT_TOKEN_VALIDATED" } } });
    });
    return { ...await this.status(), tokenAndBotValidated: code === null, channelSecretValidated: false, channelIdValidated: false };
  }
}
