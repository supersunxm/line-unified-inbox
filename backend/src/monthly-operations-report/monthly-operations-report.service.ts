import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { LineChatMirrorDirection, MessageDeliveryStatus, MessageDirection, MessageType, Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import { formatDbDateToIso, getTodayBangkokDateString, toUtcDateForDb } from "../follower-insights/date-utils";
import { type AnalyticsMessage, bangkokMonthBounds } from "../mobile/monthly-summary.service";
import { HistoricalTimelineService } from "../historical-timeline.service";
import { PrismaService } from "../prisma.service";
import * as ExcelJS from "exceljs";

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

export type ReplyKpiCoverage = "complete" | "partial" | "not_covered";

type ReplyCoverageInput = {
  mirrorAvailable: boolean;
  eligibleCycles: number;
  coveredCycles: number;
};

export function classifyReplyKpiCoverage(input: ReplyCoverageInput): ReplyKpiCoverage {
  if (input.eligibleCycles === 0) return input.mirrorAvailable ? "complete" : "not_covered";
  if (input.coveredCycles === input.eligibleCycles) return "complete";
  if (input.coveredCycles > 0 || input.mirrorAvailable) return "partial";
  return "not_covered";
}

export function isReplyCycleEligible(cycle: ReportResponseCycle, periodEnd: Date): boolean {
  if (cycle.answeredAt) return true;
  return cycle.startedAt.getTime() + RESPONSE_WINDOW_MS <= periodEnd.getTime();
}

export function isReplyCycleCovered(
  cycle: ReportResponseCycle,
  periodEnd: Date,
  input: {
    mirrorEnabled: boolean;
    lastSuccessfulSyncAt: Date | null;
    historicalBackfillOldestAt: Date | null;
  },
): boolean {
  if (!isReplyCycleEligible(cycle, periodEnd)) return false;

  if (
    cycle.durationSeconds !== null
    && cycle.durationSeconds <= RESPONSE_WINDOW_MS / 1000
  ) {
    return true;
  }

  if (!input.mirrorEnabled || !input.lastSuccessfulSyncAt || !input.historicalBackfillOldestAt) {
    return false;
  }

  const deadline = new Date(cycle.startedAt.getTime() + RESPONSE_WINDOW_MS);
  return input.historicalBackfillOldestAt.getTime() <= cycle.startedAt.getTime()
    && input.lastSuccessfulSyncAt.getTime() >= deadline.getTime();
}

function managerMessageIdFromCanonical(message: {
  externalMessageId: string | null;
  rawPayload: Prisma.JsonValue | null;
}): string | null {
  const raw = jsonObject(message.rawPayload);
  if (typeof raw.managerMessageId === "string" && raw.managerMessageId.trim()) {
    return raw.managerMessageId.trim();
  }
  const external = message.externalMessageId?.trim() || "";
  if (external.startsWith("line-chat-manager:")) {
    return external.slice("line-chat-manager:".length);
  }
  return external || null;
}

function mirrorConversationKey(lineOfficialAccountId: string, lineChatUserId: string): string {
  return lineOfficialAccountId + "::" + lineChatUserId;
}

function setUniqueConversation(
  map: Map<string, string | null>,
  key: string,
  conversationId: string,
): void {
  if (!map.has(key)) {
    map.set(key, conversationId);
    return;
  }
  if (map.get(key) !== conversationId) map.set(key, null);
}

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
    observedReplyRateWithin24h: number | null;
    observedFocusReplyRateWithin24h: number | null;
    replyCoverage: ReplyKpiCoverage;
    mirrorFallbackReplies: number;
    mirrorFallbackUnmapped: number;
    coveredResponseCycles: number;
    coveredFocusResponseCycles: number;
  };
  dataQuality: {
    followerCoverage: "complete" | "partial" | "missing";
    chatCoverage: "canonical_plus_manager_fallback";
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
  private readonly logger = new Logger(MonthlyOperationsReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storeAccess: StoreAccessService,
    private readonly historicalTimeline: HistoricalTimelineService,
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

    const kpiThroughDate = isCurrentMonth
      ? new Date(now.getTime() - 48 * 60 * 60 * 1000)
      : new Date(bounds.end.getTime() - 1);
    const kpiThroughIso = localDate(kpiThroughDate);
    const hasMaturedKpiWindow = kpiThroughDate.getTime() >= bounds.start.getTime();
    const historicalMonthAnalytics = hasMaturedKpiWindow
      ? await this.historicalTimeline.replyAnalytics(user, {
          dateFrom: monthStartIso,
          dateTo: kpiThroughIso,
        })
      : null;
    const historicalFocusAnalytics = hasMaturedKpiWindow && kpiThroughDate.getTime() >= effectiveFocusStart.getTime()
      ? await this.historicalTimeline.replyAnalytics(user, {
          dateFrom: focusStartIso,
          dateTo: kpiThroughIso,
        })
      : null;
    const historicalMonthByStore = new Map(
      (historicalMonthAnalytics?.stores ?? []).map((row) => [row.storeId, row] as const),
    );
    const historicalFocusByStore = new Map(
      (historicalFocusAnalytics?.stores ?? []).map((row) => [row.storeId, row] as const),
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

    const [messages, conversations, mirrorStates, mirrorChats, mirrorRows] = accountIds.length === 0
      ? [[], [], [], [], []] as const
      : await Promise.all([
          this.prisma.message.findMany({
            where: {
              conversation: conversationScope,
              sentAt: { gte: bounds.start, lt: responseReadEnd },
            },
            select: {
              id: true,
              conversationId: true,
              externalMessageId: true,
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
          }),
          this.prisma.conversation.findMany({
            where: conversationScope,
            select: {
              id: true,
              lineOfficialAccountId: true,
              lineChatUserId: true,
            },
          }),
          this.prisma.lineChatMirrorStoreState.findMany({
            where: { lineOfficialAccountId: { in: accountIds } },
            select: {
              lineOfficialAccountId: true,
              enabled: true,
              lastSuccessfulSyncAt: true,
            },
          }),
          this.prisma.lineChatMirrorChat.findMany({
            where: {
              lineOfficialAccountId: { in: accountIds },
            },
            select: {
              lineOfficialAccountId: true,
              lineChatUserId: true,
              historicalBackfillOldestAt: true,
            },
          }),
          this.prisma.lineChatMirrorMessage.findMany({
            where: {
              lineOfficialAccountId: { in: accountIds },
              sentAt: { gte: bounds.start, lt: responseReadEnd },
            },
            select: {
              id: true,
              lineOfficialAccountId: true,
              lineChatUserId: true,
              managerMessageId: true,
              direction: true,
              bizId: true,
              ownerName: true,
              sentAt: true,
              canonicalConversationId: true,
              canonicalMessageId: true,
            },
            orderBy: [{ sentAt: "asc" }, { id: "asc" }],
          }),
        ]);

    const messagesByAccount = new Map<string, ReportAnalyticsMessage[]>();
    const canonicalMessageIds = new Set<string>();
    const canonicalExternalIds = new Set<string>();
    const canonicalManagerMessageIds = new Set<string>();
    const canonicalExternalConversation = new Map<string, string>();

    for (const message of messages) {
      canonicalMessageIds.add(message.id);
      if (message.externalMessageId) {
        canonicalExternalIds.add(message.externalMessageId);
        canonicalExternalConversation.set(message.externalMessageId, message.conversationId);
      }
      const managerMessageId = managerMessageIdFromCanonical(message);
      if (managerMessageId) canonicalManagerMessageIds.add(managerMessageId);

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

    const conversationAccountById = new Map(
      conversations.map((conversation) => [conversation.id, conversation.lineOfficialAccountId] as const),
    );
    const conversationManagerUserById = new Map(
      conversations.map((conversation) => [conversation.id, conversation.lineChatUserId?.trim() || null] as const),
    );
    const directConversationByManagerUser = new Map<string, string | null>();
    for (const conversation of conversations) {
      const lineChatUserId = conversation.lineChatUserId?.trim();
      if (!lineChatUserId) continue;
      setUniqueConversation(
        directConversationByManagerUser,
        mirrorConversationKey(conversation.lineOfficialAccountId, lineChatUserId),
        conversation.id,
      );
    }

    const exactEvidenceConversationByManagerUser = new Map<string, string | null>();
    for (const row of mirrorRows) {
      if (row.direction !== LineChatMirrorDirection.INBOUND) continue;
      const canonicalConversationId = canonicalExternalConversation.get(row.managerMessageId);
      if (!canonicalConversationId) continue;
      setUniqueConversation(
        exactEvidenceConversationByManagerUser,
        mirrorConversationKey(row.lineOfficialAccountId, row.lineChatUserId),
        canonicalConversationId,
      );
    }

    const mirrorFallbackRepliesByAccount = new Map<string, number>();
    const mirrorFallbackUnmappedByAccount = new Map<string, number>();
    for (const row of mirrorRows) {
      if (row.direction !== LineChatMirrorDirection.OUTBOUND || row.bizId === "__AUTO_RESPONSE") {
        continue;
      }
      const managerMessageId = row.managerMessageId.trim();
      const prefixedExternalId = "line-chat-manager:" + managerMessageId;
      if (
        (row.canonicalMessageId && canonicalMessageIds.has(row.canonicalMessageId))
        || canonicalManagerMessageIds.has(managerMessageId)
        || canonicalExternalIds.has(managerMessageId)
        || canonicalExternalIds.has(prefixedExternalId)
      ) {
        continue;
      }

      const key = mirrorConversationKey(row.lineOfficialAccountId, row.lineChatUserId);
      let conversationId: string | null = null;
      if (
        row.canonicalConversationId
        && conversationAccountById.get(row.canonicalConversationId) === row.lineOfficialAccountId
      ) {
        conversationId = row.canonicalConversationId;
      } else {
        conversationId = directConversationByManagerUser.get(key)
          ?? exactEvidenceConversationByManagerUser.get(key)
          ?? null;
      }

      if (!conversationId) {
        mirrorFallbackUnmappedByAccount.set(
          row.lineOfficialAccountId,
          (mirrorFallbackUnmappedByAccount.get(row.lineOfficialAccountId) ?? 0) + 1,
        );
        continue;
      }

      const current = messagesByAccount.get(row.lineOfficialAccountId) ?? [];
      current.push({
        id: "mirror-fallback:" + row.id,
        conversationId,
        direction: MessageDirection.OUTBOUND,
        messageType: MessageType.TEXT,
        sentAt: row.sentAt,
        senderUserId: null,
        senderDisplayName: row.ownerName?.trim() || "LINE OA Manager Staff",
        deliveryStatus: MessageDeliveryStatus.DELIVERED,
        rawPayload: {
          provider: "LINE_MANAGER",
          source: "REPORT_MIRROR_FALLBACK",
          managerMessageId,
          managerBizId: row.bizId,
          reportReadOnlyFallback: true,
        },
      });
      messagesByAccount.set(row.lineOfficialAccountId, current);
      mirrorFallbackRepliesByAccount.set(
        row.lineOfficialAccountId,
        (mirrorFallbackRepliesByAccount.get(row.lineOfficialAccountId) ?? 0) + 1,
      );
    }

    const mirrorStateByAccount = new Map(
      mirrorStates.map((state) => [state.lineOfficialAccountId, state] as const),
    );
    const mirrorChatByManagerUser = new Map(
      mirrorChats.map((chat) => [
        mirrorConversationKey(chat.lineOfficialAccountId, chat.lineChatUserId),
        chat,
      ] as const),
    );

    const stores: MonthlyOperationsStoreRow[] = accounts
      .filter((account): account is typeof account & { storeId: string; store: NonNullable<typeof account.store> } =>
        Boolean(account.storeId && account.store),
      )
      .map((account) => {
        const accountMessages = messagesByAccount.get(account.id) ?? [];
        const historicalMonthKpi = historicalMonthByStore.get(account.store.id);
        const historicalFocusKpi = historicalFocusByStore.get(account.store.id);
        const cycles = calculateReportResponseCycles(accountMessages);
        const periodCycles = cycles.filter((cycle) => intervalContains(cycle.startedAt, bounds.start, periodEnd));
        const focusCycles = cycles.filter((cycle) => intervalContains(cycle.startedAt, effectiveFocusStart, periodEnd));
        const eligiblePeriodCycles = periodCycles.filter((cycle) => isReplyCycleEligible(cycle, periodEnd));
        const eligibleFocusCycles = focusCycles.filter((cycle) => isReplyCycleEligible(cycle, periodEnd));

        const state = mirrorStateByAccount.get(account.id);
        const mirrorAvailable = state?.enabled === true && Boolean(state.lastSuccessfulSyncAt);
        const cycleCovered = (cycle: ReportResponseCycle) => {
          const lineChatUserId = conversationManagerUserById.get(cycle.conversationId);
          const mirrorChat = lineChatUserId
            ? mirrorChatByManagerUser.get(mirrorConversationKey(account.id, lineChatUserId))
            : undefined;
          return isReplyCycleCovered(cycle, periodEnd, {
            mirrorEnabled: state?.enabled === true,
            lastSuccessfulSyncAt: state?.lastSuccessfulSyncAt ?? null,
            historicalBackfillOldestAt: mirrorChat?.historicalBackfillOldestAt ?? null,
          });
        };

        const coveredPeriodCycles = eligiblePeriodCycles.filter(cycleCovered);
        const coveredFocusCycles = eligibleFocusCycles.filter(cycleCovered);
        const repliedWithin24h = eligiblePeriodCycles.filter(
          (cycle) => cycle.durationSeconds !== null && cycle.durationSeconds <= RESPONSE_WINDOW_MS / 1000,
        ).length;
        const focusRepliedWithin24h = eligibleFocusCycles.filter(
          (cycle) => cycle.durationSeconds !== null && cycle.durationSeconds <= RESPONSE_WINDOW_MS / 1000,
        ).length;
        const observedReplyRateWithin24h = eligiblePeriodCycles.length === 0
          ? null
          : repliedWithin24h / eligiblePeriodCycles.length;
        const observedFocusReplyRateWithin24h = eligibleFocusCycles.length === 0
          ? null
          : focusRepliedWithin24h / eligibleFocusCycles.length;
        const inboundMessages = accountMessages.filter(
          (message) => message.direction === MessageDirection.INBOUND && intervalContains(message.sentAt, bounds.start, periodEnd),
        ).length;
        const focusInboundMessages = accountMessages.filter(
          (message) => message.direction === MessageDirection.INBOUND && intervalContains(message.sentAt, effectiveFocusStart, periodEnd),
        ).length;

        const historicalResponseCycles = historicalMonthKpi?.total ?? 0;
        const historicalRepliesWithin24h = historicalMonthKpi?.within24h ?? 0;
        const historicalFocusResponseCycles = historicalFocusKpi?.total ?? 0;
        const historicalFocusRepliesWithin24h = historicalFocusKpi?.within24h ?? 0;
        const historicalReplyRate = historicalMonthKpi?.responseRate24h == null
          ? null
          : historicalMonthKpi.responseRate24h / 100;
        const historicalFocusReplyRate = historicalFocusKpi?.responseRate24h == null
          ? null
          : historicalFocusKpi.responseRate24h / 100;
        const replyCoverage: ReplyKpiCoverage = hasMaturedKpiWindow ? "complete" : "not_covered";
        const mirrorFallbackReplies = mirrorFallbackRepliesByAccount.get(account.id) ?? 0;
        const mirrorFallbackUnmapped = mirrorFallbackUnmappedByAccount.get(account.id) ?? 0;

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
        if (replyCoverage !== "complete") notes.push("reply_coverage_" + replyCoverage);
        if (hasMaturedKpiWindow) {
          notes.push("reply_kpi_source=historical_timeline_service");
          notes.push("reply_kpi_through=" + kpiThroughIso);
        }
        if (mirrorFallbackReplies > 0) notes.push("live_mirror_diagnostic_replies=" + mirrorFallbackReplies);
        if (mirrorFallbackUnmapped > 0) notes.push("live_mirror_diagnostic_unmapped=" + mirrorFallbackUnmapped);

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
            responseCycles: historicalResponseCycles,
            repliedWithin24h: historicalRepliesWithin24h,
            focusResponseCycles: historicalFocusResponseCycles,
            focusRepliedWithin24h: historicalFocusRepliesWithin24h,
            replyRateWithin24h: replyCoverage === "complete" ? historicalReplyRate : null,
            focusReplyRateWithin24h: replyCoverage === "complete" ? historicalFocusReplyRate : null,
            observedReplyRateWithin24h,
            observedFocusReplyRateWithin24h,
            replyCoverage,
            mirrorFallbackReplies,
            mirrorFallbackUnmapped,
            coveredResponseCycles: historicalResponseCycles,
            coveredFocusResponseCycles: historicalFocusResponseCycles,
          },
          dataQuality: {
            followerCoverage: followerPoints === 3 ? "complete" : followerPoints === 0 ? "missing" : "partial",
            chatCoverage: "canonical_plus_manager_fallback",
            notes,
          },
        };
      });

    const totals = stores.reduce(
      (summary, store) => {
        summary.inboundMessages += store.chat.inboundMessages;
        summary.focusInboundMessages += store.chat.focusInboundMessages;
        summary.observedResponseCycles += store.chat.responseCycles;
        summary.observedRepliedWithin24h += store.chat.repliedWithin24h;
        summary.observedFocusResponseCycles += store.chat.focusResponseCycles;
        summary.observedFocusRepliedWithin24h += store.chat.focusRepliedWithin24h;
        summary.mirrorFallbackReplies += store.chat.mirrorFallbackReplies;
        summary.mirrorFallbackUnmapped += store.chat.mirrorFallbackUnmapped;
        if (store.chat.replyCoverage === "complete") {
          summary.responseCycles += store.chat.responseCycles;
          summary.repliedWithin24h += store.chat.repliedWithin24h;
          summary.focusResponseCycles += store.chat.focusResponseCycles;
          summary.focusRepliedWithin24h += store.chat.focusRepliedWithin24h;
        }
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
        observedResponseCycles: 0,
        observedRepliedWithin24h: 0,
        observedFocusResponseCycles: 0,
        observedFocusRepliedWithin24h: 0,
        mirrorFallbackReplies: 0,
        mirrorFallbackUnmapped: 0,
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
        replyKpiThrough: hasMaturedKpiWindow ? kpiThroughIso : null,
      },
      scope: {
        stores: stores.length,
        lineAccounts: accounts.length,
        followerComplete: stores.filter((store) => store.dataQuality.followerCoverage === "complete").length,
        followerPartial: stores.filter((store) => store.dataQuality.followerCoverage === "partial").length,
        followerMissing: stores.filter((store) => store.dataQuality.followerCoverage === "missing").length,
        replyComplete: stores.filter((store) => store.chat.replyCoverage === "complete").length,
        replyPartial: stores.filter((store) => store.chat.replyCoverage === "partial").length,
        replyNotCovered: stores.filter((store) => store.chat.replyCoverage === "not_covered").length,
      },
      totals: {
        ...totals,
        replyRateWithin24h: totals.responseCycles === 0 ? null : totals.repliedWithin24h / totals.responseCycles,
        focusReplyRateWithin24h: totals.focusResponseCycles === 0 ? null : totals.focusRepliedWithin24h / totals.focusResponseCycles,
        observedReplyRateWithin24h: totals.observedResponseCycles === 0
          ? null
          : totals.observedRepliedWithin24h / totals.observedResponseCycles,
        observedFocusReplyRateWithin24h: totals.observedFocusResponseCycles === 0
          ? null
          : totals.observedFocusRepliedWithin24h / totals.observedFocusResponseCycles,
      },
      stores,
      dataContract: {
        followerSource: "LineOaFollowerSnapshot",
        chatSource: "HistoricalTimelineService merged historical + canonical timeline",
        responseDefinition: "first human reply after the first inbound in each chat, using the completed Historical Timeline read model merged with canonical messages; current-month KPI is cut off at a fully matured date",
        replyCoverageDefinition: "Historical project completion is the reply-KPI source of truth. Current-month KPI excludes the latest two Bangkok calendar days so every included chat has a full 24-hour response window.",
        lineChatMirrorRead: true,
        historicalTimelineRead: true,
        liveMirrorWrite: false,
        historicalMirrorWrite: false,
      },
    };
  }

  async exportXlsx(user: AuthUser, requestedMonth?: string): Promise<{
    buffer: Buffer;
    filename: string;
    contentType: string;
  }> {
    const startedAt = Date.now();
    try {
      const report = await this.get(user, requestedMonth);
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "OPPO LINE OA Monitor";

      const detail = workbook.addWorksheet("Operations Detail");
      const detailColumns = [
        ["No.", "seq", 8],
        ["Source Account", "sourceAccount", 14],
        ["Standard Store Name", "storeName", 30],
        ["Backend Account Name", "backendAccountName", 28],
        ["Google Account Name", "googleAccountName", 28],
        ["STORE ID", "externalStoreId", 14],
        ["AM", "amName", 16],
        ["BM NAME", "bmName", 28],
        ["LINE Account ID", "lineBasicId", 18],
        ["Province", "province", 18],
        ["Region", "region", 16],
        ["Match Status", "matchStatus", 14],
        ["Match Method", "matchMethod", 16],
        ["Followers - Month Start", "followerStart", 18],
        ["Followers - Day 20", "followerFocus", 18],
        ["Followers - Period End", "followerEnd", 18],
        ["Follower Growth - Month", "monthGrowth", 20],
        ["Follower Growth - Since Day 20", "focusGrowth", 22],
        ["Inbound Messages - Month", "inbound", 20],
        ["Inbound Messages - Since Day 20", "focusInbound", 24],
        ["Replies Within 24h - Month", "replied24h", 22],
        ["Replies Within 24h - Since Day 20", "focusReplied24h", 26],
        ["24h Reply Rate - Month", "replyRate24h", 20],
        ["24h Reply Rate - Since Day 20", "focusReplyRate24h", 24],
        ["Tagged Customers - Month", "tagged", 20],
        ["Untagged Customers - Month", "untagged", 22],
        ["Tag Base - Month", "tagBase", 18],
        ["Tag Coverage - Month", "tagRate", 20],
        ["Tagged Customers - Since Day 20", "focusTagged", 24],
        ["Untagged Customers - Since Day 20", "focusUntagged", 26],
        ["Tag Base - Since Day 20", "focusTagBase", 22],
        ["Tag Coverage - Since Day 20", "focusTagRate", 24],
        ["Response Cycles", "responseCycles", 18],
        ["Data Status", "dataStatus", 14],
        ["Notes", "notes", 40],
      ] as const;
      detail.columns = detailColumns.map(([header, key, width]) => ({ header, key, width }));
      detail.views = [{ state: "frozen", ySplit: 1 }];
      detail.getRow(1).font = { bold: true };
      detail.getRow(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };

      for (const [index, store] of report.stores.entries()) {
        const dataStatus = store.dataQuality.followerCoverage === "missing" || store.chat.replyCoverage === "not_covered"
          ? "MISSING"
          : store.dataQuality.followerCoverage === "complete" && store.chat.replyCoverage === "complete"
            ? "COMPLETE"
            : "PARTIAL";
        const replyKpiEligible = store.chat.replyCoverage === "complete";
        detail.addRow({
          seq: index + 1,
          sourceAccount: "STORE",
          storeName: store.storeName,
          backendAccountName: store.accountName ?? "",
          googleAccountName: store.accountName ?? "",
          externalStoreId: store.externalStoreId ?? "",
          amName: store.amName ?? "",
          bmName: store.bmName ?? "",
          lineBasicId: store.lineBasicId ?? "",
          province: store.province ?? "",
          region: store.region ?? "",
          matchStatus: store.externalStoreId ? "MATCHED" : "UNMATCHED",
          matchMethod: store.externalStoreId ? "STORE_MASTER" : "STORE_FALLBACK",
          followerStart: store.followers.monthStart,
          followerFocus: store.followers.focusStart,
          followerEnd: store.followers.periodEnd,
          monthGrowth: store.followers.monthGrowth,
          focusGrowth: store.followers.focusGrowth,
          inbound: store.chat.inboundMessages,
          focusInbound: store.chat.focusInboundMessages,
          replied24h: replyKpiEligible ? store.chat.repliedWithin24h : null,
          focusReplied24h: replyKpiEligible ? store.chat.focusRepliedWithin24h : null,
          replyRate24h: store.chat.replyRateWithin24h,
          focusReplyRate24h: store.chat.focusReplyRateWithin24h,
          tagged: null,
          untagged: null,
          tagBase: null,
          tagRate: null,
          focusTagged: null,
          focusUntagged: null,
          focusTagBase: null,
          focusTagRate: null,
          responseCycles: replyKpiEligible ? store.chat.responseCycles : null,
          dataStatus,
          notes: [...store.dataQuality.notes, "tag_history_unavailable"].join("; "),
        });
      }
      detail.getColumn("replyRate24h").numFmt = "0.0%";
      detail.getColumn("focusReplyRate24h").numFmt = "0.0%";
      detail.getColumn("tagRate").numFmt = "0.0%";
      detail.getColumn("focusTagRate").numFmt = "0.0%";
      if (report.stores.length > 0) {
        detail.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: report.stores.length + 1, column: detailColumns.length },
        };
      }

      const summary = workbook.addWorksheet("Summary");
      summary.columns = [
        { header: "Metric", key: "metric", width: 30 },
        { header: "Value", key: "value", width: 18 },
        { header: "Period / Definition", key: "period", width: 32 },
        { header: "Notes", key: "note", width: 48 },
      ];
      summary.getRow(1).font = { bold: true };
      const monthPeriod = report.period.start + " → " + report.period.through;
      const focusPeriod = report.period.focusStart + " → " + report.period.through;
      const summaryRows = [
        ["Store Count", report.scope.stores, report.period.month, ""],
        ["LINE OA Count", report.scope.lineAccounts, report.period.month, ""],
        ["Follower Snapshot - Complete", report.scope.followerComplete, report.period.start + " / " + report.period.focusStart + " / " + report.period.through, ""],
        ["Follower Snapshot - Partial", report.scope.followerPartial, report.period.month, ""],
        ["Follower Snapshot - Missing", report.scope.followerMissing, report.period.month, ""],
        ["Reply KPI Coverage - Complete Stores", report.scope.replyComplete, report.period.month, "Included in official 24h KPI"],
        ["Reply KPI Coverage - Partial Stores", report.scope.replyPartial, report.period.month, "Excluded from official 24h KPI"],
        ["Reply KPI Coverage - Not Covered Stores", report.scope.replyNotCovered, report.period.month, "Excluded from official 24h KPI"],
        ["Historical KPI Through", report.period.replyKpiThrough ?? "", report.period.month, "Current-month KPI excludes the latest two Bangkok calendar days to guarantee a full 24h response window"],
        ["Historical Text Messages", historicalMonthAnalytics?.sources.historicalTextMessages ?? 0, report.period.month, "Historical Timeline read model rows used by reply analytics"],
        ["Canonical Messages in KPI", historicalMonthAnalytics?.sources.currentMessages ?? 0, report.period.month, "Current canonical messages merged into the Historical Timeline analytics"],
        ["Follower Growth - Month", report.totals.monthFollowerGrowth, monthPeriod, ""],
        ["Follower Growth - Since Day 20", report.totals.focusFollowerGrowth, focusPeriod, ""],
        ["Inbound Messages - Month", report.totals.inboundMessages, monthPeriod, "Canonical Message inbound"],
        ["Inbound Messages - Since Day 20", report.totals.focusInboundMessages, focusPeriod, "Canonical Message inbound"],
        ["Response Cycles - Month", report.totals.responseCycles, monthPeriod, "Complete-coverage stores only"],
        ["Replies Within 24h - Month", report.totals.repliedWithin24h, monthPeriod, "Complete-coverage stores only; delivered human reply <= 24h"],
        ["24h Reply Rate - Month", report.totals.replyRateWithin24h, monthPeriod, "Official KPI: complete-coverage stores only"],
        ["Replies Within 24h - Since Day 20", report.totals.focusRepliedWithin24h, focusPeriod, ""],
        ["24h Reply Rate - Since Day 20", report.totals.focusReplyRateWithin24h, focusPeriod, ""],
      ] as const;
      for (const [metric, value, period, note] of summaryRows) {
        const row = summary.addRow({ metric, value, period, note });
        if (String(metric).includes("Reply Rate")) row.getCell("value").numFmt = "0.0%";
      }

      const regionSummary = workbook.addWorksheet("Region Summary");
      regionSummary.columns = [
        { header: "Region", key: "region", width: 18 },
        { header: "Stores", key: "stores", width: 12 },
        { header: "KPI Covered Stores", key: "coveredStores", width: 18 },
        { header: "Inbound", key: "inbound", width: 14 },
        { header: "Response Cycles", key: "cycles", width: 18 },
        { header: "<=24h Replies", key: "replies", width: 16 },
        { header: "24h Reply Rate", key: "rate", width: 16 },
        { header: "Follower Growth", key: "growth", width: 16 },
      ];
      regionSummary.getRow(1).font = { bold: true };
      const byRegion = new Map<string, { stores: number; coveredStores: number; inbound: number; cycles: number; replies: number; growth: number }>();
      for (const store of report.stores) {
        const key = store.region || "Unspecified";
        const current = byRegion.get(key) ?? { stores: 0, coveredStores: 0, inbound: 0, cycles: 0, replies: 0, growth: 0 };
        current.stores += 1;
        current.inbound += store.chat.inboundMessages;
        if (store.chat.replyCoverage === "complete") {
          current.coveredStores += 1;
          current.cycles += store.chat.responseCycles;
          current.replies += store.chat.repliedWithin24h;
        }
        current.growth += store.followers.monthGrowth ?? 0;
        byRegion.set(key, current);
      }
      for (const [region, values] of [...byRegion.entries()].sort(([left], [right]) => left.localeCompare(right))) {
        const row = regionSummary.addRow({
          region,
          stores: values.stores,
          coveredStores: values.coveredStores,
          inbound: values.inbound,
          cycles: values.cycles,
          replies: values.replies,
          rate: values.cycles === 0 ? null : values.replies / values.cycles,
          growth: values.growth,
        });
        row.getCell("rate").numFmt = "0.0%";
      }

      const methodology = workbook.addWorksheet("Methodology");
      methodology.columns = [
        { header: "Item", key: "item", width: 24 },
        { header: "Definition", key: "definition", width: 100 },
      ];
      methodology.getRow(1).font = { bold: true };
      const methodologyRows = [
        ["Timezone", "Asia/Bangkok"],
        ["Follower", "Reads LineOaFollowerSnapshot. Month-start, day-20, and period-end values use the latest available snapshot on or before the requested date within the same month; no fallback to the previous month."],
        ["Inbound Messages - Month", "Count of direction=INBOUND messages in the canonical Message timeline."],
        ["Response Cycle", "Consecutive inbound messages in the same conversation form one response cycle until the first delivered human outbound."],
        ["Human Reply", "Human reply is identified by internal senderUserId or canonical LINE Manager metadata (source=LINE_MANAGER_MIRROR / provider=LINE_MANAGER). Automated replies are excluded."],
        ["24h Reply", "The first human reply occurs within 24 hours from the start of the response cycle."],
        ["Reply KPI Source", "Uses HistoricalTimelineService, which merges the completed Historical Timeline read model with canonical messages and suppresses exact source duplicates."],
        ["Current-Month Cutoff", "The official 24h KPI excludes the latest two Bangkok calendar days so every included chat has a fully elapsed 24-hour response window."],
        ["Tag Fields", "Reliable historical tag snapshots are not yet available in P0, so columns Y:AF remain blank and Notes contains tag_history_unavailable."],
        ["Mirror Isolation", "The report reads the completed Historical Timeline service, canonical Message data, follower snapshots, and Store Master. It does not write to Live Mirror or Historical Mirror."],
        ["Generated At", report.period.generatedAt],
      ] as const;
      for (const [item, definition] of methodologyRows) methodology.addRow({ item, definition });
      methodology.getColumn("definition").alignment = { wrapText: true, vertical: "top" };

      const arrayBuffer = await workbook.xlsx.writeBuffer();
      const buffer = Buffer.from(arrayBuffer);
      this.logger.log(JSON.stringify({
        event: "monthly_operations_report_xlsx_exported",
        month: report.period.month,
        storeCount: report.scope.stores,
        bytes: buffer.length,
        durationMs: Date.now() - startedAt,
      }));
      return {
        buffer,
        filename: "OPPO_LINE_monthly_operations_" + report.period.month + "_" + report.scope.stores + "stores.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    } catch (error) {
      this.logger.error(JSON.stringify({
        event: "monthly_operations_report_xlsx_failed",
        month: requestedMonth ?? null,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
        durationMs: Date.now() - startedAt,
      }));
      throw error;
    }
  }

}
