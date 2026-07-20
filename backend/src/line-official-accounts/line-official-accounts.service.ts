import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { LineOaConnectionStatus, Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { PrismaService } from "../prisma.service";
import { CreateLineOfficialAccountDto, UpdateLineOfficialAccountDto } from "./line-official-account.dto";
import { isValidLineOaUrl, isValidManagerUrl } from "../store-master/store-master.utils";

const safeInclude = { store: { include: { storeMaster: true } }, _count: { select: { conversations: true } } } satisfies Prisma.LineOfficialAccountInclude;
type IncludedOa = Prisma.LineOfficialAccountGetPayload<{ include: typeof safeInclude }>;

@Injectable()
export class LineOfficialAccountsService {
  constructor(private readonly prisma: PrismaService, private readonly encryption: CredentialEncryptionService) {}

  private clean(value?: string) { const result = value?.trim(); return result || undefined; }
  private generateWebhookKey() { return randomBytes(24).toString("base64url"); }
  private webhookConfiguration(webhookKey?: string) {
    const raw = process.env.PUBLIC_WEBHOOK_BASE_URL?.trim();
    if (!raw) return { webhookUrl: null, configured: false };
    try {
      const url = new URL(raw);
      const testMode = process.env.NODE_ENV === "test";
      const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
      if ((!testMode && url.protocol !== "https:") || (!testMode && localHost) || url.username || url.password) {
        return { webhookUrl: null, configured: false };
      }
      const base = raw.replace(/\/+$/, "");
      return webhookKey ? { webhookUrl: `${base}/webhook/${webhookKey}`, configured: true } : { webhookUrl: null, configured: false };
    } catch {
      return { webhookUrl: null, configured: false };
    }
  }

  private missingFields(item: IncludedOa) {
    const missing: string[] = [];
    if (!item.storeId) missing.push("store");
    if (!item.name.trim()) missing.push("name");
    if (!item.encryptedChannelSecret) missing.push("channelSecret");
    else {
      try { this.encryption.decrypt(item.encryptedChannelSecret); } catch { missing.push("credentialReentry"); }
    }
    if (!this.webhookConfiguration(item.webhookKey).configured) missing.push("publicWebhookUrl");
    return missing;
  }

  private calculatedStatus(item: IncludedOa): LineOaConnectionStatus {
    if (!item.isActive) return "DISABLED";
    if (item.connectionStatus === "ERROR" && item.lastConnectionError) return "ERROR";
    if (this.missingFields(item).length > 0) return "NOT_CONFIGURED";
    if (item.lastWebhookReceivedAt) return "CONNECTED";
    return "READY";
  }

  private decryptable(value: string | null) {
    if (!value) return false;
    try { this.encryption.decrypt(value); return true; } catch { return false; }
  }

  private safe(item: IncludedOa, messagesReceivedToday = 0) {
    const webhook = this.webhookConfiguration(item.webhookKey);
    return {
      id: item.id, name: item.name, basicId: item.basicId, channelId: item.channelId,
      maskedChannelId: item.channelId ? `${item.channelId.slice(0, 4)}••••${item.channelId.slice(-4)}` : null,
      destinationId: item.destinationId, store: { id: item.store.id, name: item.store.name, region: item.store.region, area: item.store.area, storeMasterId: item.store.storeMasterId, accountName: item.store.storeMaster?.accountName ?? null, externalStoreId: item.store.storeMaster?.externalStoreId ?? null, province: item.store.storeMaster?.province ?? item.store.area, lineId: item.store.storeMaster?.lineId ?? null, lineOaLink: isValidLineOaUrl(item.store.storeMaster?.lineOaLink ?? null) ? item.store.storeMaster?.lineOaLink ?? null : null, lineManagerUrl: isValidManagerUrl(item.store.storeMaster?.lineManagerUrl ?? null) ? item.store.storeMaster?.lineManagerUrl ?? null : null, dataQualityStatus: item.store.storeMaster?.dataQualityStatus ?? null, dataSource: item.store.storeMaster ? "MASTER" : "MANUAL" },
      connectionStatus: this.calculatedStatus(item), isActive: item.isActive, lastWebhookReceivedAt: item.lastWebhookReceivedAt,
      lastConnectionTestAt: item.lastConnectionTestAt, lastConnectionError: item.lastConnectionError,
      hasChannelSecret: Boolean(item.encryptedChannelSecret), hasChannelAccessToken: Boolean(item.encryptedChannelAccessToken),
      credentialsHealthy: this.decryptable(item.encryptedChannelSecret),
      conversationCount: item._count.conversations, messagesReceivedToday, createdAt: item.createdAt, updatedAt: item.updatedAt,
      archivedAt: item.archivedAt,
      webhookUrl: webhook.webhookUrl, webhookConfigured: Boolean(item.webhookKey) && webhook.configured,
    };
  }

  async list(showArchived = false) {
    const items = await this.prisma.lineOfficialAccount.findMany({ where: showArchived ? undefined : { archivedAt: null, store: { archivedAt: null } }, include: safeInclude, orderBy: { name: "asc" } });
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return Promise.all(items.map(async (item) => this.safe(item, await this.prisma.message.count({ where: { sentAt: { gte: start }, conversation: { lineOfficialAccountId: item.id } } }))));
  }
  async get(id: string) {
    const item = await this.prisma.lineOfficialAccount.findUnique({ where: { id }, include: safeInclude });
    if (!item) throw new NotFoundException("LINE Official Account not found");
    return this.safe(item);
  }

  async create(dto: CreateLineOfficialAccountDto) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const webhookKey = this.generateWebhookKey();
      if (!this.webhookConfiguration(webhookKey).configured) throw new InternalServerErrorException("PUBLIC_WEBHOOK_BASE_URL is not configured for LINE OA creation");
      try {
        const item = await this.prisma.$transaction(async (tx) => {
        const master = dto.storeMasterId ? await tx.storeMaster.findUnique({ where: { id: dto.storeMasterId }, include: { stores: { select: { id: true } } } }) : null;
        if (dto.storeMasterId && !master) throw new NotFoundException("Store Master record not found");
        const storeWithMatchingCode = master?.externalStoreId ? await tx.store.findUnique({ where: { code: master.externalStoreId } }) : null;
        if (master && storeWithMatchingCode && !storeWithMatchingCode.storeMasterId) await tx.store.update({ where: { id: storeWithMatchingCode.id }, data: { storeMasterId: master.id, name: master.storeName, region: master.region, area: master.province, provinceSource: "MASTER", regionSource: master.region ? "MASTER" : "PROVINCE_MAPPING" } });
        const storeId = master?.stores[0]?.id ?? storeWithMatchingCode?.id ?? (master
          ? (await tx.store.create({ data: { name: master.storeName, code: master.externalStoreId, region: master.region, area: master.province, storeMasterId: master.id, provinceSource: "MASTER", regionSource: master.region ? "MASTER" : "PROVINCE_MAPPING" } })).id
          : dto.newStore
          ? (await tx.store.create({ data: { name: dto.newStore.name.trim(), code: this.clean(dto.newStore.code), region: this.clean(dto.newStore.region), area: this.clean(dto.newStore.area) } })).id
          : dto.storeId ?? (await tx.store.create({ data: { name: dto.name.trim() } })).id);
        return tx.lineOfficialAccount.create({ data: {
          storeId, webhookKey, name: dto.name.trim(), basicId: this.clean(dto.basicId), channelId: this.clean(dto.channelId), destinationId: this.clean(dto.destinationId),
          encryptedChannelSecret: this.encryption.encrypt(dto.channelSecret.trim()),
          encryptedChannelAccessToken: this.encryption.encrypt(dto.channelAccessToken.trim()),
          isActive: dto.isActive, connectionStatus: dto.isActive && this.webhookConfiguration("pending-key").configured ? "READY" : dto.isActive ? "NOT_CONFIGURED" : "DISABLED",
        }, include: safeInclude });
        });
        if (!item.webhookKey || item.webhookKey !== webhookKey) throw new InternalServerErrorException("LINE OA creation did not persist its webhook key");
        const response = this.safe(item);
        if (!response.webhookUrl || !response.webhookConfigured) throw new InternalServerErrorException("LINE OA creation could not produce a canonical webhook URL");
        return response;
      } catch (error) {
        if (this.isWebhookKeyCollision(error) && attempt < 2) continue;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Channel ID, Basic ID, or store code already exists");
        throw error;
      }
    }
    throw new InternalServerErrorException("Unable to allocate a unique webhook key");
  }

  private isWebhookKeyCollision(error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
    const target = error.meta?.target;
    if (Array.isArray(target)) return target.some((value) => value === "webhookKey");
    return typeof target === "string" && target.includes("webhookKey");
  }

  async update(id: string, dto: UpdateLineOfficialAccountDto) {
    await this.get(id);
    try {
      const encryptedChannelSecret = this.clean(dto.channelSecret) ? this.encryption.encrypt(dto.channelSecret!.trim()) : undefined;
      const encryptedChannelAccessToken = this.clean(dto.channelAccessToken) ? this.encryption.encrypt(dto.channelAccessToken!.trim()) : undefined;
      // Fail before persistence if a newly encrypted value cannot be decrypted with the current key.
      if (encryptedChannelSecret) this.encryption.decrypt(encryptedChannelSecret);
      if (encryptedChannelAccessToken) this.encryption.decrypt(encryptedChannelAccessToken);
      await this.prisma.lineOfficialAccount.update({ where: { id }, data: {
        name: this.clean(dto.name), basicId: dto.basicId === undefined ? undefined : this.clean(dto.basicId) ?? null,
        channelId: this.clean(dto.channelId), destinationId: this.clean(dto.destinationId), storeId: this.clean(dto.storeId),
        encryptedChannelSecret, encryptedChannelAccessToken,
        lastConnectionError: null,
      } });
      const saved = await this.prisma.lineOfficialAccount.findUniqueOrThrow({ where: { id } });
      if (encryptedChannelSecret) this.encryption.decrypt(saved.encryptedChannelSecret!);
      if (encryptedChannelAccessToken) this.encryption.decrypt(saved.encryptedChannelAccessToken!);
      return this.get(id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Channel ID or Basic ID already exists");
      throw error;
    }
  }

  async setStatus(id: string, isActive: boolean) {
    await this.get(id);
    const current = await this.prisma.lineOfficialAccount.findUniqueOrThrow({ where: { id }, include: safeInclude });
    const enabledStatus: LineOaConnectionStatus = this.missingFields({ ...current, isActive: true }).length === 0 ? current.lastWebhookReceivedAt ? "CONNECTED" : "READY" : "NOT_CONFIGURED";
    await this.prisma.lineOfficialAccount.update({ where: { id }, data: { isActive, connectionStatus: isActive ? enabledStatus : "DISABLED" } });
    return this.get(id);
  }

  async testConnection(id: string) {
    const raw = await this.prisma.lineOfficialAccount.findUnique({ where: { id }, include: safeInclude });
    if (!raw) throw new NotFoundException("LINE Official Account not found");
    const { webhookUrl } = this.webhookConfiguration(raw.webhookKey);
    const missingConfigurationFields = this.missingFields(raw);
    let credentialDecryptionError = false;
    if (raw.encryptedChannelSecret) {
      try { this.encryption.decrypt(raw.encryptedChannelSecret); }
      catch { credentialDecryptionError = true; }
    }
    const complete = missingConfigurationFields.length === 0 && !credentialDecryptionError;
    const status: LineOaConnectionStatus = !raw.isActive ? "DISABLED" : credentialDecryptionError ? "ERROR" : !complete ? "NOT_CONFIGURED" : raw.lastWebhookReceivedAt ? "CONNECTED" : "READY";
    const error = credentialDecryptionError ? "Credential decryption error" : complete ? null : `Missing configuration: ${missingConfigurationFields.join(", ")}`;
    await this.prisma.lineOfficialAccount.update({ where: { id }, data: { connectionStatus: status, lastConnectionTestAt: new Date(), lastConnectionError: error } });
    return { status, configurationComplete: complete, credentialsAvailable: Boolean(raw.encryptedChannelSecret), accessTokenAvailable: Boolean(raw.encryptedChannelAccessToken), webhookUrl, webhookUrlConfigured: Boolean(webhookUrl), channelIdConfigured: Boolean(raw.channelId), destinationIdConfigured: Boolean(raw.destinationId), lastWebhookReceivedAt: raw.lastWebhookReceivedAt, matchingDestinationReceived: Boolean(raw.lastWebhookReceivedAt), missingConfigurationFields, credentialDecryptionError };
  }

  async credentialHealth(id: string) {
    const raw = await this.prisma.lineOfficialAccount.findUnique({ where: { id } });
    if (!raw) throw new NotFoundException("LINE Official Account not found");
    return {
      channelSecretStored: Boolean(raw.encryptedChannelSecret),
      channelSecretDecryptable: this.decryptable(raw.encryptedChannelSecret),
      accessTokenStored: Boolean(raw.encryptedChannelAccessToken),
      accessTokenDecryptable: this.decryptable(raw.encryptedChannelAccessToken),
      webhookKeyConfigured: Boolean(raw.webhookKey),
      isActive: raw.isActive,
    };
  }

  async webhookInfo(id: string) {
    const raw = await this.prisma.lineOfficialAccount.findUnique({ where: { id }, include: safeInclude });
    if (!raw) throw new NotFoundException("LINE Official Account not found");
    const { webhookUrl, configured } = this.webhookConfiguration(raw.webhookKey);
    let credentialDecrypts = false;
    if (raw.encryptedChannelSecret) {
      try { this.encryption.decrypt(raw.encryptedChannelSecret); credentialDecrypts = true; } catch { /* Safe diagnostic only. */ }
    }
    return { webhookUrl, webhookKeyConfigured: Boolean(raw.webhookKey), routeConfigured: true, isActive: raw.isActive, isArchived: Boolean(raw.archivedAt), credentialsHealthy: credentialDecrypts, webhookUrlConfigured: configured, credentialsConfigured: Boolean(raw.encryptedChannelSecret), credentialDecrypts, channelIdConfigured: Boolean(raw.channelId), destinationIdConfigured: Boolean(raw.destinationId), lastWebhookReceivedAt: raw.lastWebhookReceivedAt, connectionStatus: this.calculatedStatus(raw), missingConfigurationFields: this.missingFields(raw), backendPort: Number(process.env.PORT ?? 3001), webhookPath: `/webhook/${raw.webhookKey}`, oa: { id: raw.id, name: raw.name, store: raw.store.name, isActive: raw.isActive } };
  }

  async regenerateWebhook(id: string) {
    await this.get(id);
    await this.prisma.lineOfficialAccount.update({ where: { id }, data: { webhookKey: this.generateWebhookKey(), connectionStatus: "READY", lastWebhookReceivedAt: null, lastConnectionError: null } });
    return this.webhookInfo(id);
  }

  async archive(id: string) {
    await this.get(id);
    await this.prisma.lineOfficialAccount.update({ where: { id }, data: { isActive: false, archivedAt: new Date(), connectionStatus: "DISABLED" } });
    return { outcome: "archived" as const, id };
  }

  async restore(id: string) {
    await this.get(id);
    await this.prisma.lineOfficialAccount.update({ where: { id }, data: { isActive: true, archivedAt: null } });
    return { outcome: "restored" as const, id };
  }

  async remove(id: string) {
    const item = await this.prisma.lineOfficialAccount.findUnique({ where: { id }, include: { _count: { select: { conversations: true } } } });
    if (!item) throw new NotFoundException("LINE Official Account not found");
    if (item._count.conversations > 0) return this.archive(id);
    await this.prisma.lineOfficialAccount.delete({ where: { id } });
    return { outcome: "deleted" as const, id };
  }
}
