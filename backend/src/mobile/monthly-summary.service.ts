import { BadRequestException, Injectable } from "@nestjs/common";
import { MessageDirection, Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import { PrismaService } from "../prisma.service";

export const REPORTING_TIMEZONE = "Asia/Bangkok";
export const RESPONSE_SAMPLE_THRESHOLD = 10;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export type AnalyticsMessage = {
  id: string;
  conversationId: string;
  direction: string;
  messageType: string;
  sentAt: Date;
  senderUserId: string | null;
};

export type ResponseCycle = {
  conversationId: string;
  startedAt: Date;
  answeredAt: Date | null;
  durationSeconds: number | null;
};

export type MonthBounds = { month: string; start: Date; end: Date };

export function bangkokMonthBounds(month: string): MonthBounds {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new BadRequestException("month must use YYYY-MM format");
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) throw new BadRequestException("month must use YYYY-MM format");
  return {
    month,
    start: new Date(Date.UTC(year, monthNumber - 1, 1) - BANGKOK_OFFSET_MS),
    end: new Date(Date.UTC(year, monthNumber, 1) - BANGKOK_OFFSET_MS),
  };
}

function bangkokMonthKey(date: Date): string {
  const local = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}

function localDate(date: Date): string {
  const local = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

function previousMonth(month: string): string {
  const bounds = bangkokMonthBounds(month);
  const localStart = new Date(bounds.start.getTime() + BANGKOK_OFFSET_MS);
  const previous = new Date(Date.UTC(localStart.getUTCFullYear(), localStart.getUTCMonth() - 1, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

function intervalContains(date: Date, start: Date, end: Date): boolean {
  return date >= start && date < end;
}

export function calculateResponseCycles(messages: AnalyticsMessage[]): ResponseCycle[] {
  const sorted = [...messages].sort((a, b) => {
    const timestamp = a.sentAt.getTime() - b.sentAt.getTime();
    return timestamp || a.conversationId.localeCompare(b.conversationId) || a.id.localeCompare(b.id);
  });
  const open = new Map<string, { startedAt: Date }>();
  const cycles: ResponseCycle[] = [];
  for (const message of sorted) {
    if (message.direction === MessageDirection.INBOUND) {
      if (!open.has(message.conversationId)) open.set(message.conversationId, { startedAt: message.sentAt });
      continue;
    }
    if (message.direction !== MessageDirection.OUTBOUND || !message.senderUserId) continue;
    const current = open.get(message.conversationId);
    if (!current) continue;
    cycles.push({
      conversationId: message.conversationId,
      startedAt: current.startedAt,
      answeredAt: message.sentAt,
      durationSeconds: Math.max(0, (message.sentAt.getTime() - current.startedAt.getTime()) / 1000),
    });
    open.delete(message.conversationId);
  }
  for (const [conversationId, current] of open) {
    cycles.push({ conversationId, startedAt: current.startedAt, answeredAt: null, durationSeconds: null });
  }
  return cycles.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime() || a.conversationId.localeCompare(b.conversationId));
}

export function responseMetrics(cycles: ResponseCycle[], start: Date, end: Date) {
  const selected = cycles.filter((cycle) => intervalContains(cycle.startedAt, start, end));
  const answered = selected.filter((cycle): cycle is ResponseCycle & { durationSeconds: number; answeredAt: Date } => cycle.durationSeconds !== null && cycle.answeredAt !== null);
  const durations = answered.map((cycle) => cycle.durationSeconds).sort((a, b) => a - b);
  const medianSeconds = durations.length === 0 ? null : durations.length % 2 === 1 ? durations[(durations.length - 1) / 2] : (durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2;
  const available = answered.length >= RESPONSE_SAMPLE_THRESHOLD;
  const buckets = {
    under4h: answered.filter((cycle) => cycle.durationSeconds < 4 * 3600).length,
    from4To12h: answered.filter((cycle) => cycle.durationSeconds >= 4 * 3600 && cycle.durationSeconds < 12 * 3600).length,
    from12To24h: answered.filter((cycle) => cycle.durationSeconds >= 12 * 3600 && cycle.durationSeconds < 24 * 3600).length,
    over24h: answered.filter((cycle) => cycle.durationSeconds >= 24 * 3600).length,
  };
  return {
    cyclesStarted: selected.length,
    cyclesAnswered: answered.length,
    unanswered: selected.length - answered.length,
    responseRate: available && selected.length > 0 ? answered.length / selected.length : null,
    averageSeconds: available && durations.length > 0 ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null,
    medianSeconds: available ? medianSeconds : null,
    buckets,
    sampleSize: answered.length,
    available,
  };
}

export function monthlyVolume(messages: AnalyticsMessage[], start: Date, end: Date) {
  const inbound = messages.filter((message) => message.direction === MessageDirection.INBOUND && intervalContains(message.sentAt, start, end));
  const replies = messages.filter((message) => message.direction === MessageDirection.OUTBOUND && Boolean(message.senderUserId) && intervalContains(message.sentAt, start, end));
  return {
    incomingMessages: inbound.length,
    incomingConversations: new Set(inbound.map((message) => message.conversationId)).size,
    bmReplies: replies.length,
  };
}

function comparisonChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

@Injectable()
export class MonthlySummaryService {
  constructor(private readonly prisma: PrismaService, private readonly storeAccess: StoreAccessService) {}

  async get(user: AuthUser, requestedMonth?: string) {
    const asOf = new Date();
    const currentMonth = bangkokMonthKey(asOf);
    const month = requestedMonth ?? currentMonth;
    const bounds = bangkokMonthBounds(month);
    if (month > currentMonth) throw new BadRequestException("Future months are not available");
    const isCurrentMonth = month === currentMonth;
    const periodEnd = isCurrentMonth ? asOf : bounds.end;
    const previous = bangkokMonthBounds(previousMonth(month));
    const comparisonEnd = isCurrentMonth
      ? new Date(Math.min(previous.end.getTime(), previous.start.getTime() + Math.max(0, asOf.getTime() - bounds.start.getTime())))
      : previous.end;
    const accessibleStoreIds = await this.storeAccess.accessibleStoreIds(user);
    const conversationScope: Prisma.ConversationWhereInput = {
      isQa: false,
      store: { isActive: true, archivedAt: null },
      ...(accessibleStoreIds === null ? {} : { storeId: { in: accessibleStoreIds } }),
    };
    const messages = await this.prisma.message.findMany({
      where: { conversation: conversationScope, sentAt: { lte: asOf } },
      orderBy: [{ sentAt: "asc" }, { id: "asc" }],
      select: { id: true, conversationId: true, direction: true, messageType: true, sentAt: true, senderUserId: true },
    });
    const analyticsMessages = messages as AnalyticsMessage[];
    const cycles = calculateResponseCycles(analyticsMessages);
    const periodVolume = monthlyVolume(analyticsMessages, bounds.start, periodEnd);
    const periodResponse = responseMetrics(cycles, bounds.start, periodEnd);
    const previousVolume = monthlyVolume(analyticsMessages, previous.start, comparisonEnd);
    const previousResponse = responseMetrics(cycles, previous.start, comparisonEnd);
    const earliestInbound = analyticsMessages.filter((message) => message.direction === MessageDirection.INBOUND).map((message) => message.sentAt).sort((a, b) => a.getTime() - b.getTime())[0];
    const comparisonAvailable = Boolean(earliestInbound && earliestInbound <= previous.start && previousVolume.incomingMessages > 0);
    const statuses = await this.prisma.conversation.findMany({ where: conversationScope, select: { bmReplyStatus: true } });
    const needReply = statuses.filter((conversation) => conversation.bmReplyStatus === "NOT_REPLIED" || conversation.bmReplyStatus === "NOTIFIED_BM").length;
    const completed = statuses.filter((conversation) => conversation.bmReplyStatus === "REPLIED").length;
    const ambiguousOutboundExcluded = analyticsMessages.filter((message) => message.direction === MessageDirection.OUTBOUND && !message.senderUserId && intervalContains(message.sentAt, bounds.start, periodEnd)).length;
    return {
      period: { month, timezone: REPORTING_TIMEZONE, isCurrentMonth, throughDate: localDate(periodEnd.getTime() === bounds.end.getTime() ? new Date(periodEnd.getTime() - 1) : periodEnd), asOf: asOf.toISOString(), comparisonBasis: isCurrentMonth ? "same_day_range" : "full_month" },
      volume: periodVolume,
      response: periodResponse,
      operational: { needReply, completed, asOf: asOf.toISOString() },
      comparison: comparisonAvailable
        ? {
            available: true,
            basis: isCurrentMonth ? "same_day_range" : "full_month",
            volume: previousVolume,
            response: previousResponse,
            changes: {
              incomingMessages: comparisonChange(periodVolume.incomingMessages, previousVolume.incomingMessages),
              incomingConversations: comparisonChange(periodVolume.incomingConversations, previousVolume.incomingConversations),
              bmReplies: comparisonChange(periodVolume.bmReplies, previousVolume.bmReplies),
            },
          }
        : { available: false, reason: "insufficient_previous_period_data" },
      dataQuality: { qaExcluded: true, ambiguousOutboundExcluded, responseMetricsAvailable: periodResponse.available },
    };
  }
}
