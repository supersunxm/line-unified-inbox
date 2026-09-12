import { ConflictException, Inject, Injectable, InternalServerErrorException, NotFoundException, Optional } from "@nestjs/common";
import { LineOaConnectionStatus, Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { PrismaService } from "../prisma.service";
import { CreateLineOfficialAccountDto, ExportLineOfficialAccountsDto, UpdateLineOfficialAccountDto } from "./line-official-account.dto";
import { isValidLineOaUrl } from "../store-master/store-master.utils";
import { LatestManagerUrlMap, loadLatestManagerUrls, resolveLineOaManagerUrl } from "../store-master/line-oa-manager-url";
import { getStoreGoogleMapsReadiness } from "../store-master/template-variable-resolver";
import { FollowerInsightsService } from "../follower-insights/follower-insights.service";

const safeInclude = { store: { include: { storeMaster: true } }, _count: { select: { conversations: true } } } satisfies Prisma.LineOfficialAccountInclude;
type IncludedOa = Prisma.LineOfficialAccountGetPayload<{ include: typeof safeInclude }>;
export type LineOaDuplicateConflicts = {
  channelId: boolean;
  basicId: boolean;
  storeCode: boolean;
  destinationId: boolean;
};

@Injectable()
export class LineOfficialAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: CredentialEncryptionService,
    @Optional() @Inject(FollowerInsightsService) private readonly followerInsightsService?: FollowerInsightsService,
  ) {}

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
    if (!item.isActive || item.archivedAt) return "DISABLED";
    if (item.connectionStatus === "ERROR" && item.lastConnectionError) return "ERROR";
    if (this.missingFields(item).length > 0) return "NOT_CONFIGURED";
    if (item.lastWebhookReceivedAt) return "CONNECTED";
    return "READY";
  }

  private decryptable(value: string | null) {
    if (!value) return false;
    try { this.encryption.decrypt(value); return true; } catch { return false; }
  }

  private safe(item: IncludedOa, latestManagerUrls: LatestManagerUrlMap, messagesReceivedToday = 0) {
    if (!item.store || item.accountType === "HEAD_OFFICE") throw new InternalServerErrorException("Store LINE OA is missing its store relationship");
    const webhook = this.webhookConfiguration(item.webhookKey);
    const resolvedLineOaManagerUrl = resolveLineOaManagerUrl(item.store, latestManagerUrls);
    const googleMapsReadiness = getStoreGoogleMapsReadiness(item.store.storeMaster?.googleMapsUrl);
    return {
      id: item.id, name: item.name, basicId: item.basicId, channelId: item.channelId,
      maskedChannelId: item.channelId ? `${item.channelId.slice(0, 4)}••••${item.channelId.slice(-4)}` : null,
      destinationId: item.destinationId, resolvedLineOaManagerUrl, store: { id: item.store.id, storeId: item.store.storeMaster?.externalStoreId ?? null, name: item.store.name, code: item.store.code, region: item.store.region, area: item.store.area, storeMasterId: item.store.storeMasterId, accountName: item.store.storeMaster?.accountName ?? null, externalStoreId: item.store.storeMaster?.externalStoreId ?? null, province: item.store.storeMaster?.province ?? item.store.area, lineId: item.store.storeMaster?.lineId ?? null, lineOaLink: isValidLineOaUrl(item.store.storeMaster?.lineOaLink ?? null) ? item.store.storeMaster?.lineOaLink ?? null : null, lineManagerUrl: resolvedLineOaManagerUrl, googleMapsUrl: item.store.storeMaster?.googleMapsUrl ?? null, googleMapsStatus: googleMapsReadiness.status, googleMapsStatusReason: googleMapsReadiness.reason, dataQualityStatus: item.store.storeMaster?.dataQualityStatus ?? null, dataSource: item.store.storeMaster ? "MASTER" : "MANUAL" },
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
    const items = await this.prisma.lineOfficialAccount.findMany({ where: showArchived ? { accountType: "STORE" } : { accountType: "STORE", archivedAt: null, store: { archivedAt: null } }, include: safeInclude, orderBy: { name: "asc" } });
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const [latestManagerUrls, conversationCounts] = await Promise.all([
      loadLatestManagerUrls(this.prisma, items.flatMap(({ store }) => store ? [store.code] : [])),
      this.prisma.conversation.findMany({
        where: { lineOfficialAccountId: { in: items.map(({ id }) => id) } },
        select: { lineOfficialAccountId: true, _count: { select: { messages: { where: { sentAt: { gte: start } } } } } },
      }),
    ]);
    const messagesByOa = new Map<string, number>();
    for (const conversation of conversationCounts) messagesByOa.set(conversation.lineOfficialAccountId, (messagesByOa.get(conversation.lineOfficialAccountId) ?? 0) + conversation._count.messages);
    return items.map((item) => this.safe(item, latestManagerUrls, messagesByOa.get(item.id) ?? 0));
  }

  async exportCsv(query: ExportLineOfficialAccountsDto) {
    const allItems = await this.list(query.showArchived === "true");
    const search = query.search?.trim().toLocaleLowerCase() ?? "";
    const items = allItems.filter((item) => {
      const matchesStatus = query.status === "all" || (query.status === "active"
        ? item.isActive
        : item.connectionStatus === "ERROR" || item.connectionStatus === "NOT_CONFIGURED");
      const matchesSearch = !search || [item.name, item.store.name, item.store.accountName, item.store.storeId, item.store.externalStoreId, item.store.code]
        .some((value) => value?.toLocaleLowerCase().includes(search));
      return matchesStatus && matchesSearch;
    });
    const columns = [
      "Store ID", "Store Name", "LINE OA Account Name", "Store Code", "Province", "Region",
      "LINE OA Basic ID", "LINE OA Account ID", "Connection Status", "Enabled / Disabled", "Webhook URL",
      "Webhook Status", "Last Webhook Activity", "Messages Today", "LINE Manager URL", "LINE OA URL", "Created At", "Updated At",
    ];
    const rows = items.map((item) => [
      item.store.externalStoreId ?? "", item.store.name, item.name, item.store.code ?? "", item.store.province, item.store.region,
      item.basicId, item.channelId, item.connectionStatus, item.isActive ? "Enabled" : "Disabled", item.webhookUrl,
      item.webhookConfigured ? "Configured" : "Not configured", this.formatBangkokDate(item.lastWebhookReceivedAt),
      item.messagesReceivedToday, item.store.lineManagerUrl, item.store.lineOaLink, this.formatBangkokDate(item.createdAt), this.formatBangkokDate(item.updatedAt),
    ]);
    const csv = `\uFEFF${[columns, ...rows].map((row) => row.map((value) => this.csvCell(value)).join(",")).join("\r\n")}\r\n`;
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    return { csv, filename: `line-oa-management-${date}.csv`, rowCount: rows.length };
  }

  private csvCell(value: string | number | Date | null | undefined) {
    let text = value === null || value === undefined ? "" : String(value);
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }

  private formatBangkokDate(value: Date | null | undefined) {
    if (!value) return "";
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(value);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")}`;
  }
  async get(id: string) {
    const item = await this.prisma.lineOfficialAccount.findUnique({ where: { id }, include: safeInclude });
    if (!item || item.accountType === "HEAD_OFFICE") throw new NotFoundException("LINE Official Account not found");
    return this.safe(item, await loadLatestManagerUrls(this.prisma, item.store ? [item.store.code] : []));
  }

  private identifierFilters(input: { basicId?: string | null; channelId?: string | null; destinationId?: string | null }) {
    const filters: Prisma.LineOfficialAccountWhereInput[] = [];
    if (input.basicId) filters.push({ basicId: input.basicId });
    if (input.channelId) filters.push({ channelId: input.channelId });
    if (input.destinationId) filters.push({ destinationId: input.destinationId });
    return filters;
  }

  private duplicateException(conflicts: LineOaDuplicateConflicts) {
    return new ConflictException({
      code: "LINE_ACCOUNT_DUPLICATE",
      conflicts,
      message: "One or more LINE OA identifiers are already used by an active account",
    });
  }

  private hasDuplicate(conflicts: LineOaDuplicateConflicts) {
    return Object.values(conflicts).some(Boolean);
  }

  private async findActiveDuplicateConflicts(
    client: Prisma.TransactionClient | PrismaService,
    input: { basicId?: string | null; channelId?: string | null; destinationId?: string | null },
    storeCode?: string,
    targetStoreId?: string,
    excludedId?: string,
  ): Promise<LineOaDuplicateConflicts> {
    const filters = this.identifierFilters(input);
    const [accounts, store] = await Promise.all([
      filters.length
        ? client.lineOfficialAccount.findMany({
            where: {
              isActive: true,
              archivedAt: null,
              ...(excludedId ? { id: { not: excludedId } } : {}),
              OR: filters,
            },
            select: { basicId: true, channelId: true, destinationId: true },
          })
        : Promise.resolve([]),
      storeCode
        ? client.store.findUnique({
            where: { code: storeCode },
            select: { id: true, isActive: true, archivedAt: true },
          })
        : Promise.resolve(null),
    ]);

    return {
      basicId: Boolean(input.basicId && accounts.some((account) => account.basicId === input.basicId)),
      channelId: Boolean(input.channelId && accounts.some((account) => account.channelId === input.channelId)),
      destinationId: Boolean(input.destinationId && accounts.some((account) => account.destinationId === input.destinationId)),
      storeCode: Boolean(store && store.id !== targetStoreId && store.isActive && !store.archivedAt),
    };
  }

  private conflictsFromPersistenceError(error: Prisma.PrismaClientKnownRequestError): LineOaDuplicateConflicts {
    const target = error.meta?.target;
    const targetText = Array.isArray(target) ? target.join(",") : typeof target === "string" ? target : "";
    return {
      basicId: targetText.includes("basicId"),
      channelId: targetText.includes("channelId"),
      destinationId: targetText.includes("destinationId"),
      storeCode: targetText.includes("Store_code") || targetText.includes("storeCode"),
    };
  }

  async create(dto: CreateLineOfficialAccountDto) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const webhookKey = this.generateWebhookKey();
      if (!this.webhookConfiguration(webhookKey).configured) throw new InternalServerErrorException("PUBLIC_WEBHOOK_BASE_URL is not configured for LINE OA creation");
      try {
        const item = await this.prisma.$transaction(async (tx) => {
          const basicId = this.clean(dto.basicId);
          const channelId = this.clean(dto.channelId);
          const destinationId = this.clean(dto.destinationId);
          const master = dto.storeMasterId
            ? await tx.storeMaster.findUnique({
                where: { id: dto.storeMasterId },
                include: { stores: { select: { id: true, code: true, storeMasterId: true, isActive: true, archivedAt: true } } },
              })
            : null;
          if (dto.storeMasterId && !master) throw new NotFoundException("Store Master record not found");

          const selectedStore = dto.storeId
            ? await tx.store.findUnique({ where: { id: dto.storeId }, select: { id: true, code: true, storeMasterId: true, isActive: true, archivedAt: true } })
            : null;
          if (dto.storeId && !selectedStore) throw new NotFoundException("Store not found");

          const requestedStoreCode = master?.externalStoreId ?? this.clean(dto.newStore?.code);
          const storeWithMatchingCode = requestedStoreCode
            ? await tx.store.findUnique({ where: { code: requestedStoreCode }, select: { id: true, code: true, storeMasterId: true, isActive: true, archivedAt: true } })
            : null;
          const masterStore = master?.stores[0] ?? null;

          if (masterStore && storeWithMatchingCode && masterStore.id !== storeWithMatchingCode.id) {
            throw this.duplicateException({ channelId: false, basicId: false, destinationId: false, storeCode: true });
          }
          if (selectedStore && storeWithMatchingCode && selectedStore.id !== storeWithMatchingCode.id) {
            throw this.duplicateException({ channelId: false, basicId: false, destinationId: false, storeCode: true });
          }
          if (!master && !selectedStore && storeWithMatchingCode?.isActive && !storeWithMatchingCode.archivedAt) {
            throw this.duplicateException({ channelId: false, basicId: false, destinationId: false, storeCode: true });
          }

          let storeId: string;
          const existingTargetStore = masterStore
            ?? selectedStore
            ?? (storeWithMatchingCode && (!storeWithMatchingCode.isActive || Boolean(storeWithMatchingCode.archivedAt)) ? storeWithMatchingCode : null);
          if (master) {
            if (existingTargetStore?.storeMasterId && existingTargetStore.storeMasterId !== master.id) {
              throw this.duplicateException({ channelId: false, basicId: false, destinationId: false, storeCode: true });
            }
            storeId = existingTargetStore?.id ?? (await tx.store.create({
              data: {
                name: master.storeName,
                code: master.externalStoreId,
                region: master.region,
                area: master.province,
                storeMasterId: master.id,
                provinceSource: "MASTER",
                regionSource: master.region ? "MASTER" : "PROVINCE_MAPPING",
              },
            })).id;
            await tx.store.update({
              where: { id: storeId },
              data: {
                name: master.storeName,
                code: master.externalStoreId,
                region: master.region,
                area: master.province,
                storeMasterId: master.id,
                provinceSource: "MASTER",
                regionSource: master.region ? "MASTER" : "PROVINCE_MAPPING",
                isActive: true,
                archivedAt: null,
              },
            });
          } else if (existingTargetStore) {
            if (!existingTargetStore.isActive || existingTargetStore.archivedAt) {
              await tx.store.update({ where: { id: existingTargetStore.id }, data: { isActive: true, archivedAt: null } });
            }
            storeId = existingTargetStore.id;
          } else if (dto.newStore) {
            storeId = (await tx.store.create({
              data: {
                name: dto.newStore.name.trim(),
                code: this.clean(dto.newStore.code),
                region: this.clean(dto.newStore.region),
                area: this.clean(dto.newStore.area),
              },
            })).id;
          } else {
            storeId = (await tx.store.create({ data: { name: dto.name.trim() } })).id;
          }

          const conflicts = await this.findActiveDuplicateConflicts(tx, { basicId, channelId, destinationId }, requestedStoreCode, storeId);
          if (this.hasDuplicate(conflicts)) throw this.duplicateException(conflicts);

          const reusable = this.identifierFilters({ basicId, channelId, destinationId }).length
            ? await tx.lineOfficialAccount.findMany({
                where: {
                  accountType: "STORE",
                  OR: this.identifierFilters({ basicId, channelId, destinationId }),
                  NOT: { isActive: true, archivedAt: null },
                },
                select: { id: true, storeId: true },
                orderBy: { updatedAt: "desc" },
              })
            : [];
          const retiredSameStore = reusable.find((account) => account.storeId === storeId);
          const lineData = {
            storeId,
            webhookKey,
            name: dto.name.trim(),
            basicId: basicId ?? null,
            channelId: channelId ?? null,
            destinationId: destinationId ?? null,
            encryptedChannelSecret: this.encryption.encrypt(dto.channelSecret.trim()),
            encryptedChannelAccessToken: this.encryption.encrypt(dto.channelAccessToken.trim()),
            isActive: dto.isActive,
            archivedAt: null,
            connectionStatus: dto.isActive && this.webhookConfiguration("pending-key").configured ? "READY" as const : dto.isActive ? "NOT_CONFIGURED" as const : "DISABLED" as const,
          };
          return retiredSameStore
            ? tx.lineOfficialAccount.update({ where: { id: retiredSameStore.id }, data: lineData, include: safeInclude })
            : tx.lineOfficialAccount.create({ data: lineData, include: safeInclude });
        });
        if (!item.webhookKey || item.webhookKey !== webhookKey) throw new InternalServerErrorException("LINE OA creation did not persist its webhook key");
        const response = this.safe(item, await loadLatestManagerUrls(this.prisma, item.store ? [item.store.code] : []));
        if (!response.webhookUrl || !response.webhookConfigured) throw new InternalServerErrorException("LINE OA creation could not produce a canonical webhook URL");
        void this.followerInsightsService?.enqueueAutoBackfillJob?.(response.id)?.catch?.(() => null);
        return response;
      } catch (error) {
        if (this.isWebhookKeyCollision(error) && attempt < 2) continue;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const inferred = this.conflictsFromPersistenceError(error);
          if (this.hasDuplicate(inferred)) throw this.duplicateException(inferred);
          throw this.duplicateException({
            channelId: Boolean(this.clean(dto.channelId)),
            basicId: Boolean(this.clean(dto.basicId)),
            destinationId: Boolean(this.clean(dto.destinationId)),
            storeCode: Boolean(this.clean(dto.newStore?.code)),
          });
        }
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
    const current = await this.prisma.lineOfficialAccount.findUnique({ where: { id }, select: { id: true, storeId: true, accountType: true } });
    if (!current || current.accountType === "HEAD_OFFICE") throw new NotFoundException("LINE Official Account not found");
    try {
      const encryptedChannelSecret = this.clean(dto.channelSecret) ? this.encryption.encrypt(dto.channelSecret!.trim()) : undefined;
      const encryptedChannelAccessToken = this.clean(dto.channelAccessToken) ? this.encryption.encrypt(dto.channelAccessToken!.trim()) : undefined;
      // Fail before persistence if a newly encrypted value cannot be decrypted with the current key.
      if (encryptedChannelSecret) this.encryption.decrypt(encryptedChannelSecret);
      if (encryptedChannelAccessToken) this.encryption.decrypt(encryptedChannelAccessToken);
      const basicId = dto.basicId === undefined ? undefined : this.clean(dto.basicId);
      const channelId = this.clean(dto.channelId);
      const destinationId = this.clean(dto.destinationId);
      const conflicts = await this.findActiveDuplicateConflicts(
        this.prisma,
        { basicId, channelId, destinationId },
        undefined,
        undefined,
        id,
      );
      if (this.hasDuplicate(conflicts)) throw this.duplicateException(conflicts);
      await this.prisma.lineOfficialAccount.update({ where: { id }, data: {
        name: this.clean(dto.name), basicId: dto.basicId === undefined ? undefined : basicId ?? null,
        channelId, destinationId, storeId: this.clean(dto.storeId),
        encryptedChannelSecret, encryptedChannelAccessToken,
        lastConnectionError: null,
      } });
      const saved = await this.prisma.lineOfficialAccount.findUniqueOrThrow({ where: { id } });
      if (encryptedChannelSecret) this.encryption.decrypt(saved.encryptedChannelSecret!);
      if (encryptedChannelAccessToken) this.encryption.decrypt(saved.encryptedChannelAccessToken!);

      if (this.followerInsightsService) {
        const { dateFrom, dateTo } = this.followerInsightsService.getAutoBackfillDates();
        const missingDates = await this.followerInsightsService.getMissingHistoricalDates(id, dateFrom, dateTo);
        if (missingDates.length > 0) {
          void this.followerInsightsService.enqueueAutoBackfillJob(id).catch(() => null);
        }
      }

      return this.get(id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const inferred = this.conflictsFromPersistenceError(error);
        throw this.duplicateException(this.hasDuplicate(inferred) ? inferred : {
          channelId: Boolean(this.clean(dto.channelId)),
          basicId: dto.basicId !== undefined && Boolean(this.clean(dto.basicId)),
          destinationId: Boolean(this.clean(dto.destinationId)),
          storeCode: false,
        });
      }
      throw error;
    }
  }

  async setStatus(id: string, isActive: boolean) {
    const current = await this.prisma.lineOfficialAccount.findUnique({ where: { id }, include: safeInclude });
    if (!current || current.accountType === "HEAD_OFFICE") throw new NotFoundException("LINE Official Account not found");
    if (isActive) {
      const conflicts = await this.findActiveDuplicateConflicts(this.prisma, current, undefined, undefined, id);
      if (this.hasDuplicate(conflicts)) throw this.duplicateException(conflicts);
    }
    const enabledStatus: LineOaConnectionStatus = this.missingFields({ ...current, isActive: true, archivedAt: null }).length === 0
      ? current.lastWebhookReceivedAt ? "CONNECTED" : "READY"
      : "NOT_CONFIGURED";
    await this.prisma.lineOfficialAccount.update({ where: { id }, data: {
      isActive,
      archivedAt: isActive ? null : current.archivedAt,
      connectionStatus: isActive ? enabledStatus : "DISABLED",
    } });
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
    return { webhookUrl, webhookKeyConfigured: Boolean(raw.webhookKey), routeConfigured: true, isActive: raw.isActive, isArchived: Boolean(raw.archivedAt), credentialsHealthy: credentialDecrypts, webhookUrlConfigured: configured, credentialsConfigured: Boolean(raw.encryptedChannelSecret), credentialDecrypts, channelIdConfigured: Boolean(raw.channelId), destinationIdConfigured: Boolean(raw.destinationId), lastWebhookReceivedAt: raw.lastWebhookReceivedAt, connectionStatus: this.calculatedStatus(raw), missingConfigurationFields: this.missingFields(raw), backendPort: Number(process.env.PORT ?? 3001), webhookPath: `/webhook/${raw.webhookKey}`, oa: { id: raw.id, name: raw.name, store: raw.store?.name ?? "Main OA", isActive: raw.isActive } };
  }

  async regenerateWebhook(id: string) {
    await this.get(id);
    await this.prisma.lineOfficialAccount.update({ where: { id }, data: { webhookKey: this.generateWebhookKey(), connectionStatus: "READY", lastWebhookReceivedAt: null, lastConnectionError: null } });
    return this.webhookInfo(id);
  }

  async archive(id: string) {
    const item = await this.prisma.lineOfficialAccount.findUnique({ where: { id }, select: { id: true, accountType: true } });
    if (!item || item.accountType === "HEAD_OFFICE") throw new NotFoundException("LINE Official Account not found");
    await this.prisma.lineOfficialAccount.update({ where: { id }, data: { isActive: false, archivedAt: new Date(), connectionStatus: "DISABLED" } });
    return { outcome: "archived" as const, id };
  }

  async restore(id: string) {
    const item = await this.prisma.lineOfficialAccount.findUnique({ where: { id }, select: { id: true, accountType: true, basicId: true, channelId: true, destinationId: true } });
    if (!item || item.accountType === "HEAD_OFFICE") throw new NotFoundException("LINE Official Account not found");
    const conflicts = await this.findActiveDuplicateConflicts(this.prisma, item, undefined, undefined, id);
    if (this.hasDuplicate(conflicts)) throw this.duplicateException(conflicts);
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
