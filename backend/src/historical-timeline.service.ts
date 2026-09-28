import { createHash } from "node:crypto";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { MessageDirection, MessageDeliveryStatus, MessageType, Prisma } from "@prisma/client";
import type { AuthUser } from "./auth/auth.guard";
import { StoreAccessService } from "./auth/store-access.service";
import { PrismaService } from "./prisma.service";
import { isValidManagerUrl } from "./store-master/store-master.utils";
import { isAutomatedOutboundMessage } from "./conversation-reply-state";

export const HISTORICAL_TIMELINE_START = new Date("2026-08-31T17:00:00.000Z");
export const HISTORICAL_VIRTUAL_ID_PREFIX = "historical:";

type HistoricalRecord = {
  id: string;
  direction: MessageDirection;
  text: string;
  sentAt: Date;
  senderBizId: string | null;
  sourceEventId: string;
  sourceEventType: string;
};

type VirtualChatRow = {
  storeId: string;
  storeName: string;
  lineManagerUrl: string | null;
  lineOfficialAccountId: string;
  oaName: string;
  basicId: string | null;
  connectionStatus: string;
  oaActive: boolean;
  lastWebhookReceivedAt: Date | null;
  lineChatUserId: string;
  latestMessageAt: Date;
  messageCount: number;
  previewId: string;
  previewText: string;
  previewDirection: MessageDirection;
  previewSentAt: Date;
  previewSenderBizId: string | null;
  customerId: string | null;
  customerDisplayName: string | null;
  customerPictureUrl: string | null;
  total: bigint;
};

type UnifiedReplyMessage = {
  direction: MessageDirection;
  messageType: MessageType;
  sentAt: Date;
  source: "CURRENT" | "HISTORICAL";
  sourceEventId: string | null;
  externalMessageId: string | null;
  senderUserId: string | null;
  senderDisplayName: string | null;
  senderBizId: string | null;
  deliveryStatus: MessageDeliveryStatus | null;
  rawPayload: unknown;
  text: string;
  id: string;
};

type ReplyCounts = {
  total: number;
  responded: number;
  within24h: number;
  over24h: number;
  pending: number;
  knownResponderReplies: number;
  unknownResponderReplies: number;
};

export type HistoricalResponseBucket = "under4h" | "between4and12h" | "between12and24h" | "over24h";

function emptyReplyCounts(): ReplyCounts {
  return { total: 0, responded: 0, within24h: 0, over24h: 0, pending: 0, knownResponderReplies: 0, unknownResponderReplies: 0 };
}

function parseBangkokDate(value: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new BadRequestException(`${field} must use YYYY-MM-DD`);
  const [year, month, day] = value.split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) {
    throw new BadRequestException(`${field} is invalid`);
  }
  return new Date(calendarDate.getTime() - 7 * 60 * 60 * 1000);
}

function bangkokDateKey(date: Date, granularity: "day" | "month"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    ...(granularity === "day" ? { day: "2-digit" } : {}),
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const year = values.get("year") ?? "0000";
  const month = values.get("month") ?? "00";
  return granularity === "month" ? `${year}-${month}` : `${year}-${month}-${values.get("day") ?? "00"}`;
}

function rate(count: number, total: number): number | null {
  return total === 0 ? null : Math.round((count / total) * 1000) / 10;
}

function deterministicVirtualCustomerId(lineOfficialAccountId: string, lineChatUserId: string): string {
  const hash = createHash("sha256").update(`${lineOfficialAccountId}\u0000${lineChatUserId}`).digest("hex");
  return `historical-customer:${hash}`;
}

export function buildHistoricalVirtualConversationId(lineOfficialAccountId: string, lineChatUserId: string): string {
  const identity = Buffer.from(JSON.stringify([lineOfficialAccountId, lineChatUserId])).toString("base64url");
  return `${HISTORICAL_VIRTUAL_ID_PREFIX}${identity}`;
}

function decodeHistoricalVirtualConversationId(id: string): [string, string] {
  if (!id.startsWith(HISTORICAL_VIRTUAL_ID_PREFIX)) throw new NotFoundException("Historical conversation not found");
  try {
    const value: unknown = JSON.parse(Buffer.from(id.slice(HISTORICAL_VIRTUAL_ID_PREFIX.length), "base64url").toString("utf8"));
    if (!Array.isArray(value) || value.length !== 2 || value.some((item) => typeof item !== "string" || item.length === 0)) {
      throw new Error("invalid identity");
    }
    return [value[0] as string, value[1] as string];
  } catch {
    throw new NotFoundException("Historical conversation not found");
  }
}

export function mapHistoricalTimelineMessage(record: HistoricalRecord) {
  const senderName = record.direction !== MessageDirection.OUTBOUND
    ? null
    : record.senderBizId === "__AUTO_RESPONSE"
      ? "Automated response"
      : record.senderBizId
        ? "Store staff"
        : null;
  return {
    id: record.id,
    direction: record.direction,
    messageType: MessageType.TEXT,
    originalText: record.text,
    originalLanguage: null,
    translatedThai: null,
    translatedEnglish: null,
    translatedChinese: null,
    sentAt: record.sentAt.toISOString(),
    fileName: null,
    sender: senderName ? { userId: null, displayName: senderName } : null,
    media: null,
    latitude: null,
    longitude: null,
    deliveryStatus: MessageDeliveryStatus.DELIVERED,
    historical: true,
    sourceEventId: record.sourceEventId,
    sourceEventType: record.sourceEventType,
  };
}

export function isKnownHistoricalStaffResponder(senderBizId: string | null): boolean {
  return Boolean(senderBizId?.trim()) && senderBizId !== "__AUTO_RESPONSE";
}

export function isHistoricalReplyEvidence(senderBizId: string | null): boolean {
  return senderBizId !== "__AUTO_RESPONSE";
}

function isCurrentReplyEvidence(message: {
  direction: MessageDirection;
  deliveryStatus: MessageDeliveryStatus | null;
  sentAt: Date;
  senderUserId: string | null;
  senderDisplayName: string | null;
  rawPayload: unknown;
}): boolean {
  return message.direction === MessageDirection.OUTBOUND
    && message.deliveryStatus === MessageDeliveryStatus.DELIVERED
    && !isAutomatedOutboundMessage({
      direction: message.direction,
      deliveryStatus: message.deliveryStatus,
      sentAt: message.sentAt,
      senderUserId: message.senderUserId,
      senderDisplayName: message.senderDisplayName,
      rawPayload: message.rawPayload,
    });
}


export function classifyResponseDuration(firstInboundAt: Date, firstReplyAt: Date): "WITHIN_24H" | "OVER_24H" {
  return firstReplyAt.getTime() - firstInboundAt.getTime() <= 24 * 60 * 60 * 1000 ? "WITHIN_24H" : "OVER_24H";
}

function pageNumber(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.min(5000, Math.floor(value)) : fallback;
}

@Injectable()
export class HistoricalTimelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeAccess: StoreAccessService,
  ) {}

  private async assertStoreAccess(user: AuthUser, storeId: string): Promise<void> {
    const accessibleStoreIds = await this.storeAccess.accessibleStoreIds(user);
    if (accessibleStoreIds !== null && !accessibleStoreIds.includes(storeId)) {
      throw new ForbiddenException("Historical conversation is outside the user store scope");
    }
  }

  async listVirtualChats(user: AuthUser, input: {
    storeId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const safePage = pageNumber(input.page ?? 1, 1);
    const safePageSize = Math.min(100, Math.max(1, pageNumber(input.pageSize ?? 30, 30)));
    const search = input.search?.trim().slice(0, 120) ?? "";
    const accessibleStoreIds = await this.storeAccess.accessibleStoreIds(user);
    if (input.storeId && accessibleStoreIds !== null && !accessibleStoreIds.includes(input.storeId)) {
      throw new ForbiddenException("Historical conversation is outside the user store scope");
    }

    const filters: Prisma.Sql[] = [
      Prisma.sql`h."sentAt" >= ${HISTORICAL_TIMELINE_START}`,
      Prisma.sql`NOT EXISTS (
        SELECT 1 FROM public."Conversation" c
        WHERE c."storeId" = h."storeId"
          AND c."lineOfficialAccountId" = h."lineOfficialAccountId"
          AND c."lineChatUserId" = h."lineChatUserId"
      )`,
      Prisma.sql`NOT EXISTS (
        SELECT 1 FROM public."HistoricalConversationCrosswalk" x
        WHERE x."storeId" = h."storeId"
          AND x."lineOfficialAccountId" = h."lineOfficialAccountId"
          AND x."historicalLineChatUserId" = h."lineChatUserId"
          AND x."classification" = 'LINK_SAFE'
          AND x."canonicalConversationId" IS NOT NULL
      )`,
      Prisma.sql`NOT EXISTS (
        SELECT 1
        FROM public."HistoricalTimelineMessage" h2
        JOIN public."Message" m
          ON m."externalMessageId" = h2."sourceEventId"
          OR m."externalMessageId" = 'line-chat-manager:' || h2."sourceEventId"
        WHERE h2."storeId" = h."storeId"
          AND h2."lineOfficialAccountId" = h."lineOfficialAccountId"
          AND h2."lineChatUserId" = h."lineChatUserId"
          AND h2."sentAt" >= ${HISTORICAL_TIMELINE_START}
      )`,
    ];
    if (accessibleStoreIds !== null) {
      if (accessibleStoreIds.length === 0) return { items: [], total: 0, page: safePage, pageSize: safePageSize, hasNextPage: false };
      filters.push(Prisma.sql`h."storeId" IN (${Prisma.join(accessibleStoreIds)})`);
    }
    if (input.storeId) filters.push(Prisma.sql`h."storeId" = ${input.storeId}`);
    if (search) {
      const pattern = `%${search}%`;
      filters.push(Prisma.sql`(
        s."name" ILIKE ${pattern}
        OR h."lineChatUserId" ILIKE ${pattern}
        OR EXISTS (SELECT 1 FROM public."Customer" cu WHERE cu."lineUserId" = h."lineChatUserId" AND cu."displayName" ILIKE ${pattern})
      )`);
    }
    const whereClause = Prisma.join(filters, " AND ");
    const totalRows = await this.prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM (
        SELECT h."storeId", h."lineOfficialAccountId", h."lineChatUserId"
        FROM public."HistoricalTimelineMessage" h
        JOIN public."Store" s ON s."id" = h."storeId"
        JOIN public."LineOfficialAccount" oa ON oa."id" = h."lineOfficialAccountId"
        WHERE ${whereClause}
          AND s."isActive" = true AND s."archivedAt" IS NULL
          AND oa."storeId" = h."storeId" AND oa."accountType" = 'STORE'
        GROUP BY h."storeId", h."lineOfficialAccountId", h."lineChatUserId"
      ) chats
    `);
    const total = Number(totalRows[0]?.total ?? 0n);
    const rows = await this.prisma.$queryRaw<VirtualChatRow[]>(Prisma.sql`
      WITH chats AS (
        SELECT h."storeId", h."lineOfficialAccountId", h."lineChatUserId",
          MAX(h."sentAt") AS "latestMessageAt", COUNT(*)::int AS "messageCount"
        FROM public."HistoricalTimelineMessage" h
        JOIN public."Store" s ON s."id" = h."storeId"
        JOIN public."LineOfficialAccount" oa ON oa."id" = h."lineOfficialAccountId"
        WHERE ${whereClause}
          AND s."isActive" = true AND s."archivedAt" IS NULL
          AND oa."storeId" = h."storeId" AND oa."accountType" = 'STORE'
        GROUP BY h."storeId", h."lineOfficialAccountId", h."lineChatUserId"
      )
      SELECT c."storeId", s."name" AS "storeName", sm."lineManagerUrl",
        c."lineOfficialAccountId", oa."name" AS "oaName", oa."basicId",
        oa."connectionStatus"::text AS "connectionStatus", oa."isActive" AS "oaActive",
        oa."lastWebhookReceivedAt", c."lineChatUserId", c."latestMessageAt", c."messageCount",
        latest."id" AS "previewId", latest."text" AS "previewText",
        latest."direction" AS "previewDirection", latest."sentAt" AS "previewSentAt",
        latest."senderBizId" AS "previewSenderBizId", cu."id" AS "customerId",
        cu."displayName" AS "customerDisplayName", cu."pictureUrl" AS "customerPictureUrl",
        COUNT(*) OVER()::bigint AS total
      FROM chats c
      JOIN public."Store" s ON s."id" = c."storeId"
      LEFT JOIN public."StoreMaster" sm ON sm."id" = s."storeMasterId"
      JOIN public."LineOfficialAccount" oa ON oa."id" = c."lineOfficialAccountId"
      LEFT JOIN public."Customer" cu ON cu."lineUserId" = c."lineChatUserId"
      JOIN LATERAL (
        SELECT h."id", h."text", h."direction", h."sentAt", h."senderBizId"
        FROM public."HistoricalTimelineMessage" h
        WHERE h."storeId" = c."storeId"
          AND h."lineOfficialAccountId" = c."lineOfficialAccountId"
          AND h."lineChatUserId" = c."lineChatUserId"
        ORDER BY h."sentAt" DESC, h."id" DESC
        LIMIT 1
      ) latest ON true
      ORDER BY c."latestMessageAt" DESC, c."lineOfficialAccountId", c."lineChatUserId"
      LIMIT ${safePageSize} OFFSET ${(safePage - 1) * safePageSize}
    `);
    return {
      items: rows.map((row) => this.toVirtualConversation(row)),
      total,
      page: safePage,
      pageSize: safePageSize,
      hasNextPage: safePage * safePageSize < total,
    };
  }

  private toVirtualConversation(row: VirtualChatRow) {
    const message = mapHistoricalTimelineMessage({
      id: row.previewId,
      direction: row.previewDirection,
      text: row.previewText,
      sentAt: row.previewSentAt,
      senderBizId: row.previewSenderBizId,
      sourceEventId: "",
      sourceEventType: "message",
    });
    return {
      id: buildHistoricalVirtualConversationId(row.lineOfficialAccountId, row.lineChatUserId),
      historicalOnly: true,
      historicalMessageCount: row.messageCount,
      latestMessageAt: row.latestMessageAt.toISOString(),
      priority: "NORMAL" as const,
      followUpStatus: "FOLLOW_UP" as const,
      bmReplyStatus: "NOT_REPLIED" as const,
      owner: null,
      productRelationship: null,
      purchaseIntent: null,
      resolvedLineOaManagerUrl: null,
      customer: {
        id: row.customerId ?? deterministicVirtualCustomerId(row.lineOfficialAccountId, row.lineChatUserId),
        lineUserId: null,
        displayName: row.customerDisplayName?.trim() || "Historical LINE chat",
        pictureUrl: row.customerPictureUrl,
        statusMessage: null,
        preferredLanguage: null,
        profileFetchStatus: "NOT_REQUESTED",
        profileFetchError: null,
      },
      store: {
        id: row.storeId,
        name: row.storeName,
        lineManagerUrl: row.lineManagerUrl,
        lineManagerUrlStatus: row.lineManagerUrl ? isValidManagerUrl(row.lineManagerUrl) ? "VALID" as const : "INVALID" as const : "MISSING" as const,
      },
      lineOfficialAccount: {
        id: row.lineOfficialAccountId,
        name: row.oaName,
        basicId: row.basicId,
        connectionStatus: row.connectionStatus,
        isActive: row.oaActive,
        lastWebhookReceivedAt: row.lastWebhookReceivedAt?.toISOString() ?? null,
      },
      messages: [message],
      products: [],
      topics: [],
      notes: [],
      activityHistory: [],
    };
  }

  async getVirtualChat(user: AuthUser, id: string) {
    const [lineOfficialAccountId, lineChatUserId] = decodeHistoricalVirtualConversationId(id);
    const record = await this.prisma.historicalTimelineMessage.findFirst({
      where: { lineOfficialAccountId, lineChatUserId, sentAt: { gte: HISTORICAL_TIMELINE_START } },
      orderBy: [{ sentAt: "desc" }, { id: "desc" }],
      include: { store: { include: { storeMaster: true } }, lineOfficialAccount: true },
    });
    if (!record) throw new NotFoundException("Historical conversation not found");
    if (record.lineOfficialAccount.storeId !== record.storeId || record.lineOfficialAccount.accountType !== "STORE") {
      throw new NotFoundException("Historical conversation mapping is no longer valid");
    }
    await this.assertStoreAccess(user, record.storeId);
    const canonical = await this.prisma.conversation.findFirst({
      where: { storeId: record.storeId, lineOfficialAccountId, lineChatUserId },
      select: { id: true },
    });
    if (canonical) throw new NotFoundException("Conversation is available in the current chat list");
    const [count, customer] = await Promise.all([
      this.prisma.historicalTimelineMessage.count({
        where: { storeId: record.storeId, lineOfficialAccountId, lineChatUserId, sentAt: { gte: HISTORICAL_TIMELINE_START } },
      }),
      this.prisma.customer.findUnique({ where: { lineUserId: lineChatUserId } }),
    ]);
    const row: VirtualChatRow = {
      storeId: record.storeId,
      storeName: record.store.name,
      lineManagerUrl: record.store.storeMaster?.lineManagerUrl ?? null,
      lineOfficialAccountId,
      oaName: record.lineOfficialAccount.name,
      basicId: record.lineOfficialAccount.basicId,
      connectionStatus: record.lineOfficialAccount.connectionStatus,
      oaActive: record.lineOfficialAccount.isActive,
      lastWebhookReceivedAt: record.lineOfficialAccount.lastWebhookReceivedAt,
      lineChatUserId,
      latestMessageAt: record.sentAt,
      messageCount: count,
      previewId: record.id,
      previewText: record.text,
      previewDirection: record.direction,
      previewSentAt: record.sentAt,
      previewSenderBizId: record.senderBizId,
      customerId: customer?.id ?? null,
      customerDisplayName: customer?.displayName ?? null,
      customerPictureUrl: customer?.pictureUrl ?? null,
      total: BigInt(count),
    };
    return this.toVirtualConversation(row);
  }

  async virtualMessages(user: AuthUser, id: string, page: number, pageSize: number) {
    await this.getVirtualChat(user, id);
    const [lineOfficialAccountId, lineChatUserId] = decodeHistoricalVirtualConversationId(id);
    const safePage = pageNumber(page, 1);
    const safeSize = Math.min(100, Math.max(1, pageNumber(pageSize, 30)));
    const where = { lineOfficialAccountId, lineChatUserId, sentAt: { gte: HISTORICAL_TIMELINE_START } };
    const [total, records] = await Promise.all([
      this.prisma.historicalTimelineMessage.count({ where }),
      this.prisma.historicalTimelineMessage.findMany({
        where,
        orderBy: [{ sentAt: "desc" }, { id: "desc" }],
        skip: (safePage - 1) * safeSize,
        take: safeSize,
      }),
    ]);
    return {
      items: records.reverse().map((record) => mapHistoricalTimelineMessage(record)),
      total,
      page: safePage,
      pageSize: safeSize,
      hasEarlier: safePage * safeSize < total,
    };
  }

  async responseBucketDetails(user: AuthUser, input: {
    bucket: HistoricalResponseBucket;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }) {
    if (!input.dateFrom || !input.dateTo) throw new BadRequestException("dateFrom and dateTo are required");
    const startAt = parseBangkokDate(input.dateFrom, "dateFrom");
    const endDateExclusive = parseBangkokDate(input.dateTo, "dateTo");
    if (startAt.getTime() > endDateExclusive.getTime()) throw new BadRequestException("dateFrom must not be after dateTo");
    const days = Math.floor((endDateExclusive.getTime() - startAt.getTime()) / 86_400_000) + 1;
    if (days > 90) throw new BadRequestException("Dashboard date range cannot exceed 90 days");
    endDateExclusive.setUTCDate(endDateExclusive.getUTCDate() + 1);
    const responseWindowEnd = new Date(endDateExclusive.getTime() + 24 * 60 * 60 * 1000);
    const accessibleStoreIds = await this.storeAccess.accessibleStoreIds(user);
    const stores = await this.prisma.store.findMany({
      where: {
        isActive: true,
        archivedAt: null,
        ...(accessibleStoreIds === null ? {} : { id: { in: accessibleStoreIds } }),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const storeIds = stores.map((store) => store.id);
    if (storeIds.length === 0) return { bucket: input.bucket, dateFrom: input.dateFrom, dateTo: input.dateTo, total: 0, shown: 0, items: [] };

    const [conversations, historicalRows] = await Promise.all([
      this.prisma.conversation.findMany({
        where: {
          storeId: { in: storeIds },
          isQa: false,
          lineOfficialAccount: { accountType: "STORE", isActive: true, archivedAt: null },
          messages: { some: { direction: MessageDirection.INBOUND, sentAt: { gte: startAt, lt: endDateExclusive } } },
        },
        select: {
          id: true,
          storeId: true,
          lineOfficialAccountId: true,
          lineChatUserId: true,
          customer: { select: { displayName: true } },
          store: { select: { name: true } },
          messages: {
            where: { sentAt: { gte: startAt, lt: responseWindowEnd } },
            select: {
              id: true,
              externalMessageId: true,
              direction: true,
              messageType: true,
              deliveryStatus: true,
              originalText: true,
              sentAt: true,
              senderUserId: true,
              senderDisplayName: true,
              rawPayload: true,
            },
            orderBy: [{ sentAt: "asc" }, { id: "asc" }],
          },
        },
      }),
      this.prisma.historicalTimelineMessage.findMany({
        where: {
          storeId: { in: storeIds },
          sentAt: { gte: startAt > HISTORICAL_TIMELINE_START ? startAt : HISTORICAL_TIMELINE_START, lt: responseWindowEnd },
          lineOfficialAccount: { accountType: "STORE", isActive: true, archivedAt: null },
        },
        select: {
          id: true,
          storeId: true,
          lineOfficialAccountId: true,
          lineChatUserId: true,
          sourceEventId: true,
          direction: true,
          text: true,
          sentAt: true,
          senderBizId: true,
        },
        orderBy: [{ sentAt: "asc" }, { id: "asc" }],
      }),
    ]);

    const storeNames = new Map(stores.map((store) => [store.id, store.name]));
    const customerIds = [...new Set(historicalRows.map((row) => row.lineChatUserId))];
    const customers = customerIds.length > 0
      ? await this.prisma.customer.findMany({
          where: { lineUserId: { in: customerIds } },
          select: { lineUserId: true, displayName: true },
        })
      : [];
    const customerNames = new Map(customers.flatMap((customer) => customer.lineUserId
      ? [[customer.lineUserId, customer.displayName] as const]
      : []));
    const chats = new Map<string, {
      conversationId: string;
      storeId: string;
      storeName: string;
      customerName: string;
      messages: UnifiedReplyMessage[];
    }>();
    const keyFor = (storeId: string, lineOfficialAccountId: string, lineChatUserId: string | null, conversationId: string) =>
      `${storeId}\u0000${lineOfficialAccountId}\u0000${lineChatUserId ?? `conversation:${conversationId}`}`;

    for (const conversation of conversations) {
      if (!conversation.storeId) continue;
      const key = keyFor(conversation.storeId, conversation.lineOfficialAccountId, conversation.lineChatUserId, conversation.id);
      const chat = chats.get(key) ?? {
        conversationId: conversation.id,
        storeId: conversation.storeId,
        storeName: conversation.store?.name ?? "ไม่ระบุร้าน",
        customerName: conversation.customer.displayName || "ลูกค้า LINE",
        messages: [],
      };
      chat.messages.push(...conversation.messages.map((message) => ({
        id: message.id,
        direction: message.direction,
        messageType: message.messageType,
        sentAt: message.sentAt,
        source: "CURRENT" as const,
        sourceEventId: null,
        externalMessageId: message.externalMessageId,
        senderUserId: message.senderUserId,
        senderDisplayName: message.senderDisplayName,
        senderBizId: null,
        deliveryStatus: message.deliveryStatus,
        rawPayload: message.rawPayload,
        text: message.originalText,
      })));
      chats.set(key, chat);
    }

    for (const message of historicalRows) {
      const key = keyFor(message.storeId, message.lineOfficialAccountId, message.lineChatUserId, "");
      const chat = chats.get(key) ?? {
        conversationId: buildHistoricalVirtualConversationId(message.lineOfficialAccountId, message.lineChatUserId),
        storeId: message.storeId,
        storeName: storeNames.get(message.storeId) ?? "ไม่ระบุร้าน",
        customerName: customerNames.get(message.lineChatUserId)?.trim() || "Historical LINE chat",
        messages: [],
      };
      const duplicate = chat.messages.some((current) => {
        const sameSource = current.externalMessageId === message.sourceEventId
          || current.externalMessageId === `line-chat-manager:${message.sourceEventId}`;
        return sameSource
          && current.messageType === MessageType.TEXT
          && current.direction === message.direction
          && current.sentAt.getTime() === message.sentAt.getTime()
          && current.text === message.text;
      });
      if (!duplicate) {
        chat.messages.push({
          id: message.id,
          direction: message.direction,
          messageType: MessageType.TEXT,
          sentAt: message.sentAt,
          source: "HISTORICAL",
          sourceEventId: message.sourceEventId,
          externalMessageId: null,
          senderUserId: null,
          senderDisplayName: null,
          senderBizId: message.senderBizId,
          deliveryStatus: MessageDeliveryStatus.DELIVERED,
          rawPayload: null,
          text: message.text,
        });
      }
      chats.set(key, chat);
    }

    const matchesBucket = (durationMinutes: number) => {
      if (input.bucket === "under4h") return durationMinutes < 240;
      if (input.bucket === "between4and12h") return durationMinutes >= 240 && durationMinutes < 720;
      if (input.bucket === "between12and24h") return durationMinutes >= 720 && durationMinutes < 1440;
      return durationMinutes >= 1440;
    };
    const matched = [...chats.values()].flatMap((chat) => {
      chat.messages.sort((left, right) => left.sentAt.getTime() - right.sentAt.getTime() || left.id.localeCompare(right.id));
      const firstInbound = chat.messages.find((message) => message.direction === MessageDirection.INBOUND
        && message.sentAt >= startAt && message.sentAt < endDateExclusive);
      if (!firstInbound) return [];
      const firstReply = chat.messages.find((message) => {
        if (message.direction !== MessageDirection.OUTBOUND || message.sentAt < firstInbound.sentAt) return false;
        if (message.source === "HISTORICAL") return isHistoricalReplyEvidence(message.senderBizId);
        return isCurrentReplyEvidence({
          direction: message.direction,
          deliveryStatus: message.deliveryStatus,
          sentAt: message.sentAt,
          senderUserId: message.senderUserId,
          senderDisplayName: message.senderDisplayName,
          rawPayload: message.rawPayload,
        });
      });
      if (!firstReply) return [];
      const elapsed = firstReply.sentAt.getTime() - firstInbound.sentAt.getTime();
      if (elapsed < 0) return [];
      const responseMinutes = Math.floor(elapsed / 60_000);
      if (!matchesBucket(responseMinutes)) return [];
      return [{
        conversationId: chat.conversationId,
        storeId: chat.storeId,
        storeName: chat.storeName,
        customerName: chat.customerName,
        inboundText: firstInbound.text.trim() || "(ไม่มีข้อความตัวอักษร)",
        firstInboundAt: firstInbound.sentAt.toISOString(),
        firstOutboundAt: firstReply.sentAt.toISOString(),
        responseMinutes,
      }];
    }).sort((left, right) => right.firstInboundAt.localeCompare(left.firstInboundAt)
      || left.conversationId.localeCompare(right.conversationId));
    const safeLimit = Math.min(200, Math.max(1, pageNumber(input.limit ?? 100, 100)));
    return {
      bucket: input.bucket,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      total: matched.length,
      shown: Math.min(safeLimit, matched.length),
      items: matched.slice(0, safeLimit),
    };
  }

  async replyAnalytics(user: AuthUser, input: { dateFrom?: string; dateTo?: string; storeId?: string }) {
    if (!input.dateFrom || !input.dateTo) throw new BadRequestException("dateFrom and dateTo are required");
    const startAt = parseBangkokDate(input.dateFrom, "dateFrom");
    const endDateExclusive = parseBangkokDate(input.dateTo, "dateTo");
    if (startAt.getTime() > endDateExclusive.getTime()) throw new BadRequestException("dateFrom must not be after dateTo");
    const days = Math.floor((endDateExclusive.getTime() - startAt.getTime()) / 86_400_000) + 1;
    if (days > 90) throw new BadRequestException("Dashboard date range cannot exceed 90 days");
    endDateExclusive.setUTCDate(endDateExclusive.getUTCDate() + 1);
    const responseWindowEnd = new Date(endDateExclusive.getTime() + 24 * 60 * 60 * 1000);
    const accessibleStoreIds = await this.storeAccess.accessibleStoreIds(user);
    if (input.storeId && accessibleStoreIds !== null && !accessibleStoreIds.includes(input.storeId)) {
      throw new ForbiddenException("Store is outside the user store scope");
    }
    const storeWhere = {
      isActive: true,
      archivedAt: null,
      ...(input.storeId ? { id: input.storeId } : accessibleStoreIds === null ? {} : { id: { in: accessibleStoreIds } }),
    };
    const stores = await this.prisma.store.findMany({
      where: storeWhere,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const storeIds = stores.map((store) => store.id);
    if (storeIds.length === 0) {
      return {
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        timezone: "Asia/Bangkok",
        targetStart: HISTORICAL_TIMELINE_START.toISOString(),
        overview: { storeCount: 0, total: 0, responded: 0, within24h: 0, over24h: 0, pending: 0, responseRate24h: null, knownResponderReplies: 0, unknownResponderReplies: 0 },
        stores: [],
        dates: [],
        months: [],
        responders: [],
        sources: { historicalTextMessages: 0, currentMessages: 0, exactDuplicatesSuppressed: 0, historicalChats: 0 },
      };
    }

    const [historicalRows, conversations] = await Promise.all([
      this.prisma.historicalTimelineMessage.findMany({
        where: {
          storeId: { in: storeIds },
          sentAt: { gte: startAt, lt: responseWindowEnd },
          lineOfficialAccount: { accountType: "STORE", isActive: true, archivedAt: null },
        },
        select: {
          id: true,
          storeId: true,
          lineOfficialAccountId: true,
          lineChatUserId: true,
          sourceEventId: true,
          sourceEventType: true,
          direction: true,
          text: true,
          sentAt: true,
          senderBizId: true,
        },
        orderBy: [{ sentAt: "asc" }, { id: "asc" }],
      }),
      this.prisma.conversation.findMany({
        where: {
          storeId: { in: storeIds },
          isQa: false,
          lineOfficialAccount: { accountType: "STORE", isActive: true, archivedAt: null },
          messages: { some: { direction: MessageDirection.INBOUND, sentAt: { gte: startAt, lt: endDateExclusive } } },
        },
        select: {
          id: true,
          storeId: true,
          lineOfficialAccountId: true,
          lineChatUserId: true,
          messages: {
            where: { sentAt: { gte: startAt, lt: responseWindowEnd } },
            select: {
              id: true,
              externalMessageId: true,
              direction: true,
              messageType: true,
              deliveryStatus: true,
              originalText: true,
              sentAt: true,
              senderUserId: true,
              senderDisplayName: true,
              rawPayload: true,
            },
            orderBy: [{ sentAt: "asc" }, { id: "asc" }],
          },
        },
      }),
    ]);

    const chatMessages = new Map<string, UnifiedReplyMessage[]>();
    const chatScopes = new Map<string, { storeId: string; lineOfficialAccountId: string; lineChatUserId: string | null }>();
    const chatKey = (storeId: string, lineOfficialAccountId: string, lineChatUserId: string | null, conversationId: string) =>
      `${storeId}\u0000${lineOfficialAccountId}\u0000${lineChatUserId ?? `conversation:${conversationId}`}`;
    let currentMessageCount = 0;
    for (const conversation of conversations) {
      if (!conversation.storeId) continue;
      const key = chatKey(conversation.storeId, conversation.lineOfficialAccountId, conversation.lineChatUserId, conversation.id);
      chatScopes.set(key, { storeId: conversation.storeId, lineOfficialAccountId: conversation.lineOfficialAccountId, lineChatUserId: conversation.lineChatUserId });
      const messages = chatMessages.get(key) ?? [];
      for (const message of conversation.messages) {
        currentMessageCount += 1;
        messages.push({
          id: message.id,
          direction: message.direction,
          messageType: message.messageType,
          sentAt: message.sentAt,
          source: "CURRENT",
          sourceEventId: null,
          externalMessageId: message.externalMessageId,
          senderUserId: message.senderUserId,
          senderDisplayName: message.senderDisplayName,
          senderBizId: null,
          deliveryStatus: message.deliveryStatus,
          rawPayload: message.rawPayload,
          text: message.originalText,
        });
      }
      chatMessages.set(key, messages);
    }
    let duplicateHistoricalRows = 0;
    for (const message of historicalRows) {
      const key = chatKey(message.storeId, message.lineOfficialAccountId, message.lineChatUserId, "");
      chatScopes.set(key, { storeId: message.storeId, lineOfficialAccountId: message.lineOfficialAccountId, lineChatUserId: message.lineChatUserId });
      const messages = chatMessages.get(key) ?? [];
      const duplicate = messages.some((current) => {
        const hasSameSource = current.externalMessageId === message.sourceEventId
          || current.externalMessageId === `line-chat-manager:${message.sourceEventId}`;
        return hasSameSource
          && current.messageType === MessageType.TEXT
          && current.direction === message.direction
          && current.sentAt.getTime() === message.sentAt.getTime()
          && current.text === message.text;
      });
      if (duplicate) {
        duplicateHistoricalRows += 1;
        continue;
      }
      messages.push({
        id: message.id,
        direction: message.direction,
        messageType: MessageType.TEXT,
        sentAt: message.sentAt,
        source: "HISTORICAL",
        sourceEventId: message.sourceEventId,
        externalMessageId: null,
        senderUserId: null,
        senderDisplayName: null,
        senderBizId: message.senderBizId,
        deliveryStatus: MessageDeliveryStatus.DELIVERED,
        rawPayload: null,
        text: message.text,
      });
      chatMessages.set(key, messages);
    }

    const storeNames = new Map(stores.map((store) => [store.id, store.name]));
    const storeCounts = new Map<string, ReplyCounts>(stores.map((store) => [store.id, emptyReplyCounts()]));
    const dateCounts = new Map<string, ReplyCounts>();
    const monthCounts = new Map<string, ReplyCounts>();
    const responderCounts = new Map<string, { storeId: string; responderId: string; source: "LINE_MANAGER_BIZ_ID" | "CANONICAL_USER_ID"; total: number; within24h: number; over24h: number }>();
    let exactHistoricalResponders = 0;
    let unknownResponderReplies = 0;
    let historicalChatCount = 0;

    for (const [key, messages] of chatMessages) {
      const scope = chatScopes.get(key);
      if (!scope) continue;
      const storeCountsForStore = storeCounts.get(scope.storeId);
      if (!storeCountsForStore) continue;
      messages.sort((left, right) => left.sentAt.getTime() - right.sentAt.getTime() || left.id.localeCompare(right.id));
      const historicalInChat = messages.some((message) => message.source === "HISTORICAL");
      if (historicalInChat) historicalChatCount += 1;
      const firstInbound = messages.find((message) =>
        message.direction === MessageDirection.INBOUND
        && message.sentAt >= startAt
        && message.sentAt < endDateExclusive);
      if (!firstInbound) continue;

      const humanReply = messages.find((message) => {
        if (message.direction !== MessageDirection.OUTBOUND || message.sentAt < firstInbound.sentAt) return false;
        if (message.source === "HISTORICAL") return isHistoricalReplyEvidence(message.senderBizId);
        return isCurrentReplyEvidence({
          direction: message.direction,
          deliveryStatus: message.deliveryStatus,
          sentAt: message.sentAt,
          senderUserId: message.senderUserId,
          senderDisplayName: message.senderDisplayName,
          rawPayload: message.rawPayload,
        });
      });
      const dateKey = bangkokDateKey(firstInbound.sentAt, "day");
      const monthKey = bangkokDateKey(firstInbound.sentAt, "month");
      const dateCount = dateCounts.get(dateKey) ?? emptyReplyCounts();
      const monthCount = monthCounts.get(monthKey) ?? emptyReplyCounts();
      const responseCounts = [storeCountsForStore, dateCount, monthCount];
      for (const count of responseCounts) count.total += 1;
      if (!humanReply) {
        for (const count of responseCounts) count.pending += 1;
      } else {
        const replyClass = classifyResponseDuration(firstInbound.sentAt, humanReply.sentAt);
        const within24h = replyClass === "WITHIN_24H";
        const responderId = humanReply.source === "HISTORICAL" ? humanReply.senderBizId : humanReply.senderUserId;
        const responderKnown = Boolean(responderId?.trim());
        for (const count of responseCounts) {
          count.responded += 1;
          if (within24h) count.within24h += 1;
          else count.over24h += 1;
          if (responderKnown) count.knownResponderReplies += 1;
          else count.unknownResponderReplies += 1;
        }
        if (!responderKnown) unknownResponderReplies += 1;
        if (responderId) {
          const responderSource = humanReply.source === "HISTORICAL" ? "LINE_MANAGER_BIZ_ID" : "CANONICAL_USER_ID";
          const responderKey = `${scope.storeId}\u0000${responderSource}\u0000${responderId}`;
          const responder = responderCounts.get(responderKey) ?? {
            storeId: scope.storeId,
            responderId,
            source: responderSource,
            total: 0,
            within24h: 0,
            over24h: 0,
          };
          responder.total += 1;
          if (within24h) responder.within24h += 1;
          else responder.over24h += 1;
          responderCounts.set(responderKey, responder);
          if (humanReply.source === "HISTORICAL") exactHistoricalResponders += 1;
        }
      }
      dateCounts.set(dateKey, dateCount);
      monthCounts.set(monthKey, monthCount);
    }

    const serializeCounts = (counts: ReplyCounts) => ({
      ...counts,
      responseRate24h: rate(counts.within24h, counts.total),
    });
    const storeRows = stores.map((store) => ({
      storeId: store.id,
      storeName: store.name,
      ...serializeCounts(storeCounts.get(store.id) ?? emptyReplyCounts()),
    }));
    const overviewCounts = storeRows.reduce((aggregate, row) => {
      aggregate.total += row.total;
      aggregate.responded += row.responded;
      aggregate.within24h += row.within24h;
      aggregate.over24h += row.over24h;
      aggregate.pending += row.pending;
      aggregate.knownResponderReplies += row.knownResponderReplies;
      aggregate.unknownResponderReplies += row.unknownResponderReplies;
      return aggregate;
    }, emptyReplyCounts());
    const responderRowsInternal = [...responderCounts.values()].map((row) => ({
      ...row,
      storeName: storeNames.get(row.storeId) ?? "Unknown store",
    })).sort((left, right) => right.total - left.total || left.storeName.localeCompare(right.storeName) || left.responderId.localeCompare(right.responderId));
    const distinctHistoricalResponderCount = new Set(responderRowsInternal
      .filter((row) => row.source === "LINE_MANAGER_BIZ_ID")
      .map((row) => `${row.storeId}\u0000${row.responderId}`)).size;
    const responderRows = responderRowsInternal.map(({ responderId, ...row }) => ({
      ...row,
      responderKey: createHash("sha256").update(`${row.storeId}\u0000${row.source}\u0000${responderId}`).digest("hex").slice(0, 10),
    }));
    return {
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      timezone: "Asia/Bangkok",
      targetStart: HISTORICAL_TIMELINE_START.toISOString(),
      overview: {
        storeCount: storeRows.length,
        ...serializeCounts(overviewCounts),
      },
      stores: storeRows,
      dates: [...dateCounts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, counts]) => ({ date, ...serializeCounts(counts) })),
      months: [...monthCounts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([month, counts]) => ({ month, ...serializeCounts(counts) })),
      responders: responderRows,
      responderCoverage: {
        status: "KNOWN_RESPONDER_OR_UNKNOWN_RESPONDER",
        knownHistoricalReplyCycles: exactHistoricalResponders,
        unknownResponderReplies,
        distinctKnownResponders: distinctHistoricalResponderCount,
      },
      sources: {
        historicalTextMessages: historicalRows.length - duplicateHistoricalRows,
        currentMessages: currentMessageCount,
        exactDuplicatesSuppressed: duplicateHistoricalRows,
        historicalChats: historicalChatCount,
      },
    };
  }
}
