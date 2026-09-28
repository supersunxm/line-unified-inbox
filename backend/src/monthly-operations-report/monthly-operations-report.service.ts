import { BadRequestException, Injectable } from "@nestjs/common";
import { MessageDeliveryStatus, MessageDirection, Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import { formatDbDateToIso, getTodayBangkokDateString, toUtcDateForDb } from "../follower-insights/date-utils";
import { type AnalyticsMessage, bangkokMonthBounds } from "../mobile/monthly-summary.service";
import { PrismaService } from "../prisma.service";

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const RESPONSE_WINDOW_MS = 24 * 60 * 60 * 1000;


type ReportAnalyticsMessage = AnalyticsMessage & {
  deliveryStatus: MessageDeliveryStatus;
  rawPayload: Prisma.JsonValue | null;
};

type ReportResponseCycle = {
  conversationId: string;
  startedAt: Date;
  answeredAt: Date | null;
  durationSeconds: number | null;
};

const AUTO_REPLY_BOT_DISPLAY_NAME = "Auto Reply Bot";

function jsonObject(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Prisma.JsonValue>
    : {};
}

export function isReportHumanReply(message: ReportAnalyticsMessage) {
  if (
    message.direction !== MessageDirection.OUTBOUND
    || message.deliveryStatus !== MessageDeliveryStatus.DELIVERED
  ) {
    return false;
  }
  const raw = jsonObject(message.rawPayload);
  const automated = message.senderDisplayName?.trim() === AUTO_REPLY_BOT_DISPLAY_NAME
    || raw.source === "AUTO_RESPONSE"
    || raw.managerBizId === "__AUTO_RESPONSE";
  if (automated) return false;
  return Boolean(message.senderUserId)
    || raw.source === "LINE_MANAGER_MIRROR"
    || raw.provider === "LINE_MANAGER";
}

export function calculateReportResponseCycles(messages: ReportAnalyticsMessage[]): ReportResponseCycle[] {
  const sorted = [...messages].sort((left, right) => {
    const timestamp = left.sentAt.getTime() - right.sentAt.getTime();
    return timestamp
      || left.conversationId.localeCompare(right.conversationId)
      || left.id.localeCompare(right.id);
  });
  const open = new Map<string, Date>();
  const cycles: ReportResponseCycle[] = [];
  for (const message of sorted) {
    if (message.direction === MessageDirection.INBOUND) {
      if (!open.has(message.conversationId)) open.set(message.conversationId, message.sentAt);
      continue;
    }
    if (!isReportHumanReply(message)) continue;
    const startedAt = open.get(message.conversationId);
    if (!startedAt) continue;
    cycles.push({
      conversationId: message.conversationId,
      startedAt,
      answeredAt: message.sentAt,
      durationSeconds: Math.max(0, (message.sentAt.getTime() - startedAt.getTime()) / 1000),
    });
    open.delete(message.conversationId);
  }
  for (const [conversationId, startedAt] of open) {
    cycles.push({ conversationId, startedAt, answeredAt: null, durationSeconds: null });
  }
  return cycles.sort((left, right) =>
    left.startedAt.getTime() - right.startedAt.getTime()
    || left.conversationId.localeCompare(right.conversationId),
  );
}

type Snapshot = {
  lineOaId: string;
  snapshotDate: Date;
  followers: number | null;
};

export type MonthlyOperationsStoreRow = {
  storeId: string;
  externalStoreId: string | null;
  storeName: string;
  accountName: string | null;
  lineOaId: string;
  lineBasicId: string | null;
  province: string | null;
  region: string | null;
  amName: null;
  bmName: string | null;
  followers: {
    monthStart: number | null;
    monthStartDate: string | null;
    focusStart: number | null;
    focusStartDate: string | null;
    periodEnd: number | null;
    periodEndDate: string | null;
    monthGrowth: number | null;
    focusGrowth: number | null;
  };
  chat: {
    inboundMessages: number;
    focusInboundMessages: number;
    responseCycles: number;
    repliedWithin24h: number;
    focusResponseCycles: number;
    focusRepliedWithin24h: number;
    replyRateWithin24h: number | null;
    focusReplyRateWithin24h: number | null;
  };
  dataQuality: {
    followerCoverage: "complete" | "partial" | "missing";
    chatCoverage: "canonical_message_timeline";
    notes: string[];
  };
};

function monthKeyInBangkok(date: Date): string {
  const local = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dayBoundary(month: string, day: number): Date {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new BadRequestException("month must use YYYY-MM format");
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  return new Date(Date.UTC(year, monthNumber - 1, day) - BANGKOK_OFFSET_MS);
}

function localDate(date: Date): string {
  const local = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

export function pickLatestSnapshotOnOrBefore(
  snapshots: Snapshot[],
  lineOaId: string,
  requestedIsoDate: string,
  minimumIsoDate: string,
): Snapshot | null {
  return snapshots
    .filter((snapshot) => snapshot.lineOaId === lineOaId && snapshot.followers !== null)
    .filter((snapshot) => {
      const date = formatDbDateToIso(snapshot.snapshotDate);
      return date >= minimumIsoDate && date <= requestedIsoDate;
    })
    .sort((left, right) => right.snapshotDate.getTime() - left.snapshotDate.getTime())[0] ?? null;
}

function snapshotValue(snapshot: Snapshot | null) {
  return {
    value: snapshot?.followers ?? null,
    date: snapshot ? formatDbDateToIso(snapshot.snapshotDate) : null,
  };
}

function growth(end: number | null, start: number | null) {
  return end === null || start === null ? null : end - start;
}

function intervalContains(date: Date, start: Date, end: Date) {
  return date >= start && date < end;
}

@Injectable()
export class MonthlyOperationsReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeAccess: StoreAccessService,
  ) {}

  async get(user: AuthUser, requestedMonth?: string) {
    const now = new Date();
    const currentMonth = monthKeyInBangkok(now);
    const month = requestedMonth ?? currentMonth;
    const bounds = bangkokMonthBounds(month);
    if (month > currentMonth) throw new BadRequestException("Future months are not available");

    const isCurrentMonth = month === currentMonth;
    const periodEnd = isCurrentMonth ? now : bounds.end;
    const focusStart = dayBoundary(month, 20);
    const effectiveFocusStart = focusStart < bounds.start ? bounds.start : focusStart;
    const responseReadEnd = new Date(periodEnd.getTime() + RESPONSE_WINDOW_MS);
    const monthStartIso = localDate(bounds.start);
    const focusStartIso = localDate(effectiveFocusStart);
    const periodEndIso = getTodayBangkokDateString(
      isCurrentMonth ? now : new Date(bounds.end.getTime() - 1),
    );

    const accessibleStoreIds = await this.storeAccess.accessibleStoreIds(user);
    const accountWhere: Prisma.LineOfficialAccountWhereInput = {
      accountType: "STORE",
      isActive: true,
      archivedAt: null,
      storeId: accessibleStoreIds === null ? { not: null } : { in: accessibleStoreIds },
      store: { isActive: true, archivedAt: null },
    };

    const accounts = await this.prisma.lineOfficialAccount.findMany({
      where: accountWhere,
      select: {
        id: true,
        name: true,
        basicId: true,
        storeId: true,
        store: {
          select: {
            id: true,
            name: true,
            code: true,
            region: true,
            storeMaster: {
              select: {
                externalStoreId: true,
                storeName: true,
                accountName: true,
                province: true,
                region: true,
                bmName: true,
              },
            },
          },
        },
      },
      orderBy: [{ store: { name: "asc" } }, { name: "asc" }],
    });

    const accountIds = accounts.map((account) => account.id);
    const snapshots = accountIds.length === 0
      ? []
      : await this.prisma.lineOaFollowerSnapshot.findMany({
          where: {
            lineOaId: { in: accountIds },
            status: "ready",
            followers: { not: null },
            snapshotDate: {
              gte: toUtcDateForDb(monthStartIso),
              lte: toUtcDateForDb(periodEndIso),
            },
          },
          select: { lineOaId: true, snapshotDate: true, followers: true },
          orderBy: [{ snapshotDate: "asc" }, { lineOaId: "asc" }],
        });

    const conversationScope: Prisma.ConversationWhereInput = {
      isQa: false,
      lineOfficialAccountId: { in: accountIds },
      ...(accessibleStoreIds === null ? {} : { storeId: { in: accessibleStoreIds } }),
      store: { isActive: true, archivedAt: null },
    };
    const messages = accountIds.length === 0
      ? []
      : await this.prisma.message.findMany({
          where: {
            conversation: conversationScope,
            sentAt: { gte: bounds.start, lt: responseReadEnd },
          },
          select: {
            id: true,
            conversationId: true,
            direction: true,
            messageType: true,
            sentAt: true,
            senderUserId: true,
            senderDisplayName: true,
            deliveryStatus: true,
            rawPayload: true,
            conversation: {
              select: {
                lineOfficialAccountId: true,
              },
            },
          },
          orderBy: [{ sentAt: "asc" }, { id: "asc" }],
        });

    const messagesByAccount = new Map<string, ReportAnalyticsMessage[]>();
    for (const message of messages) {
      const lineOaId = message.conversation.lineOfficialAccountId;
      const current = messagesByAccount.get(lineOaId) ?? [];
      current.push({
        id: message.id,
        conversationId: message.conversationId,
        direction: message.direction,
        messageType: message.messageType,
        sentAt: message.sentAt,
        senderUserId: message.senderUserId,
        senderDisplayName: message.senderDisplayName,
        deliveryStatus: message.deliveryStatus,
        rawPayload: message.rawPayload,
      });
      messagesByAccount.set(lineOaId, current);
    }

    const stores: MonthlyOperationsStoreRow[] = accounts
      .filter((account): account is typeof account & { storeId: string; store: NonNullable<typeof account.store> } =>
        Boolean(account.storeId && account.store),
      )
      .map((account) => {
        const accountMessages = messagesByAccount.get(account.id) ?? [];
        const cycles = calculateReportResponseCycles(accountMessages);
        const periodCycles = cycles.filter((cycle) => intervalContains(cycle.startedAt, bounds.start, periodEnd));
        const focusCycles = cycles.filter((cycle) => intervalContains(cycle.startedAt, effectiveFocusStart, periodEnd));
        const repliedWithin24h = periodCycles.filter(
          (cycle) => cycle.durationSeconds !== null && cycle.durationSeconds <= 24 * 60 * 60,
        ).length;
        const focusRepliedWithin24h = focusCycles.filter(
          (cycle) => cycle.durationSeconds !== null && cycle.durationSeconds <= 24 * 60 * 60,
        ).length;
        const inboundMessages = accountMessages.filter(
          (message) => message.direction === MessageDirection.INBOUND && intervalContains(message.sentAt, bounds.start, periodEnd),
        ).length;
        const focusInboundMessages = accountMessages.filter(
          (message) => message.direction === MessageDirection.INBOUND && intervalContains(message.sentAt, effectiveFocusStart, periodEnd),
        ).length;

        const startSnapshot = pickLatestSnapshotOnOrBefore(snapshots, account.id, monthStartIso, monthStartIso);
        const focusSnapshot = pickLatestSnapshotOnOrBefore(snapshots, account.id, focusStartIso, monthStartIso);
        const endSnapshot = pickLatestSnapshotOnOrBefore(snapshots, account.id, periodEndIso, monthStartIso);
        const start = snapshotValue(startSnapshot);
        const focus = snapshotValue(focusSnapshot);
        const end = snapshotValue(endSnapshot);
        const followerPoints = [start.value, focus.value, end.value].filter((value) => value !== null).length;
        const notes: string[] = [];
        if (!account.store.storeMaster) notes.push("store_master_missing");
        if (!startSnapshot) notes.push("follower_month_start_missing");
        if (!focusSnapshot) notes.push("follower_focus_start_missing");
        if (!endSnapshot) notes.push("follower_period_end_missing");

        return {
          storeId: account.store.id,
          externalStoreId: account.store.storeMaster?.externalStoreId ?? account.store.code ?? null,
          storeName: account.store.storeMaster?.storeName ?? account.store.name,
          accountName: account.store.storeMaster?.accountName ?? account.name,
          lineOaId: account.id,
          lineBasicId: account.basicId,
          province: account.store.storeMaster?.province ?? null,
          region: account.store.storeMaster?.region ?? account.store.region ?? null,
          amName: null,
          bmName: account.store.storeMaster?.bmName ?? null,
          followers: {
            monthStart: start.value,
            monthStartDate: start.date,
            focusStart: focus.value,
            focusStartDate: focus.date,
            periodEnd: end.value,
            periodEndDate: end.date,
            monthGrowth: growth(end.value, start.value),
            focusGrowth: growth(end.value, focus.value),
          },
          chat: {
            inboundMessages,
            focusInboundMessages,
            responseCycles: periodCycles.length,
            repliedWithin24h,
            focusResponseCycles: focusCycles.length,
            focusRepliedWithin24h,
            replyRateWithin24h: periodCycles.length === 0 ? null : repliedWithin24h / periodCycles.length,
            focusReplyRateWithin24h: focusCycles.length === 0 ? null : focusRepliedWithin24h / focusCycles.length,
          },
          dataQuality: {
            followerCoverage: followerPoints === 3 ? "complete" : followerPoints === 0 ? "missing" : "partial",
            chatCoverage: "canonical_message_timeline",
            notes,
          },
        };
      });

    const totals = stores.reduce(
      (summary, store) => {
        summary.inboundMessages += store.chat.inboundMessages;
        summary.focusInboundMessages += store.chat.focusInboundMessages;
        summary.responseCycles += store.chat.responseCycles;
        summary.repliedWithin24h += store.chat.repliedWithin24h;
        summary.focusResponseCycles += store.chat.focusResponseCycles;
        summary.focusRepliedWithin24h += store.chat.focusRepliedWithin24h;
        if (store.followers.monthGrowth !== null) summary.monthFollowerGrowth += store.followers.monthGrowth;
        if (store.followers.focusGrowth !== null) summary.focusFollowerGrowth += store.followers.focusGrowth;
        return summary;
      },
      {
        inboundMessages: 0,
        focusInboundMessages: 0,
        responseCycles: 0,
        repliedWithin24h: 0,
        focusResponseCycles: 0,
        focusRepliedWithin24h: 0,
        monthFollowerGrowth: 0,
        focusFollowerGrowth: 0,
      },
    );

    return {
      period: {
        month,
        timezone: "Asia/Bangkok",
        isCurrentMonth,
        start: monthStartIso,
        focusStart: focusStartIso,
        through: periodEndIso,
        generatedAt: now.toISOString(),
      },
      scope: {
        stores: stores.length,
        lineAccounts: accounts.length,
        followerComplete: stores.filter((store) => store.dataQuality.followerCoverage === "complete").length,
        followerPartial: stores.filter((store) => store.dataQuality.followerCoverage === "partial").length,
        followerMissing: stores.filter((store) => store.dataQuality.followerCoverage === "missing").length,
      },
      totals: {
        ...totals,
        replyRateWithin24h: totals.responseCycles === 0 ? null : totals.repliedWithin24h / totals.responseCycles,
        focusReplyRateWithin24h: totals.focusResponseCycles === 0 ? null : totals.focusRepliedWithin24h / totals.focusResponseCycles,
      },
      stores,
      dataContract: {
        followerSource: "LineOaFollowerSnapshot",
        chatSource: "Message",
        responseDefinition: "first delivered human staff outbound after an inbound response cycle, including LINE Manager mirrored human replies, within 24 hours",
        historicalTimelineRead: false,
        liveMirrorWrite: false,
        historicalMirrorWrite: false,
      },
    };
  }
}
