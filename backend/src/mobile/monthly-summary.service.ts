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

export type TagAnalyticsConversation = {
  sourceChannels: string[];
  isInstallment: boolean;
  products: Array<{
    productModel: { id: string; name: string };
    productVariant: { ram: string | null; rom: string | null; color: string | null } | null;
  }>;
};

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

function delta(current: number | null, previous: number | null): number | null {
  return current === null || previous === null ? null : current - previous;
}

export function tagQuality(coverageRate: number): "LOW" | "PARTIAL" | "MODERATE" | "STRONG" {
  if (coverageRate < 0.2) return "LOW";
  if (coverageRate < 0.5) return "PARTIAL";
  if (coverageRate < 0.8) return "MODERATE";
  return "STRONG";
}

export function tagAnalytics(conversations: TagAnalyticsConversation[]) {
  const sourceCounts = { storeOnly: 0, onlineOnly: 0, storeAndOnline: 0, untagged: 0 };
  const productCounts = new Map<string, { productId: string; productName: string; count: number }>();
  const variantCounts = new Map<string, { productName: string; ram: string | null; rom: string | null; color: string | null; count: number }>();
  let taggedConversations = 0;
  let installmentCount = 0;

  for (const conversation of conversations) {
    const hasStore = conversation.sourceChannels.includes("STORE");
    const hasOnline = conversation.sourceChannels.includes("ONLINE");
    if (hasStore && hasOnline) sourceCounts.storeAndOnline++;
    else if (hasStore) sourceCounts.storeOnly++;
    else if (hasOnline) sourceCounts.onlineOnly++;
    else sourceCounts.untagged++;

    if (conversation.isInstallment) installmentCount++;
    if (hasStore || hasOnline || conversation.isInstallment || conversation.products.length > 0) taggedConversations++;

    for (const product of conversation.products) {
      const existingProduct = productCounts.get(product.productModel.id);
      if (existingProduct) existingProduct.count++;
      else productCounts.set(product.productModel.id, { productId: product.productModel.id, productName: product.productModel.name, count: 1 });

      if (product.productVariant) {
        const variant = product.productVariant;
        const key = [product.productModel.id, variant.ram ?? "", variant.rom ?? "", variant.color ?? ""].join("|");
        const existingVariant = variantCounts.get(key);
        if (existingVariant) existingVariant.count++;
        else variantCounts.set(key, { productName: product.productModel.name, ram: variant.ram, rom: variant.rom, color: variant.color, count: 1 });
      }
    }
  }

  const eligibleConversations = conversations.length;
  const coverageRate = eligibleConversations === 0 ? 0 : taggedConversations / eligibleConversations;
  return {
    mode: "CURRENT_TAG_SNAPSHOT" as const,
    coverage: {
      eligibleConversations,
      taggedConversations,
      coverageRate,
      quality: tagQuality(coverageRate),
    },
    sources: sourceCounts,
    installment: {
      count: installmentCount,
      eligibleRate: eligibleConversations === 0 ? 0 : installmentCount / eligibleConversations,
      taggedRate: taggedConversations === 0 ? 0 : installmentCount / taggedConversations,
    },
    topProducts: [...productCounts.values()].sort((a, b) => b.count - a.count || a.productName.localeCompare(b.productName)).slice(0, 5),
    topVariants: [...variantCounts.values()].sort((a, b) => b.count - a.count || a.productName.localeCompare(b.productName)).slice(0, 5),
  };
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
    const eligibleConversationIds = [...new Set(analyticsMessages
      .filter((message) => message.direction === MessageDirection.INBOUND && intervalContains(message.sentAt, bounds.start, periodEnd))
      .map((message) => message.conversationId))];
    const taggedConversationRows = eligibleConversationIds.length === 0 ? [] : await this.prisma.conversation.findMany({
      where: { ...conversationScope, id: { in: eligibleConversationIds } },
      select: {
        sourceChannels: true,
        isInstallment: true,
        products: {
          where: { source: "MANUAL" },
          select: {
            productModel: { select: { id: true, name: true } },
            productVariant: { select: { ram: true, rom: true, color: true } },
          },
        },
      },
    });
    const tags = tagAnalytics(taggedConversationRows.map((row) => ({
      sourceChannels: row.sourceChannels.map(String),
      isInstallment: row.isInstallment,
      products: row.products,
    })));
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
            responseChanges: {
              responseRate: periodResponse.available && previousResponse.available ? delta(periodResponse.responseRate, previousResponse.responseRate) : null,
              medianSeconds: periodResponse.available && previousResponse.available ? delta(periodResponse.medianSeconds, previousResponse.medianSeconds) : null,
              averageSeconds: periodResponse.available && previousResponse.available ? delta(periodResponse.averageSeconds, previousResponse.averageSeconds) : null,
              bucketPercentagePoints: periodResponse.available && previousResponse.available ? {
                under4h: periodResponse.sampleSize === 0 || previousResponse.sampleSize === 0 ? null : (periodResponse.buckets.under4h / periodResponse.sampleSize - previousResponse.buckets.under4h / previousResponse.sampleSize) * 100,
                from4To12h: periodResponse.sampleSize === 0 || previousResponse.sampleSize === 0 ? null : (periodResponse.buckets.from4To12h / periodResponse.sampleSize - previousResponse.buckets.from4To12h / previousResponse.sampleSize) * 100,
                from12To24h: periodResponse.sampleSize === 0 || previousResponse.sampleSize === 0 ? null : (periodResponse.buckets.from12To24h / periodResponse.sampleSize - previousResponse.buckets.from12To24h / previousResponse.sampleSize) * 100,
                over24h: periodResponse.sampleSize === 0 || previousResponse.sampleSize === 0 ? null : (periodResponse.buckets.over24h / periodResponse.sampleSize - previousResponse.buckets.over24h / previousResponse.sampleSize) * 100,
              } : null,
            },
          }
        : { available: false, reason: "insufficient_previous_period_data" },
      tags,
      dataQuality: {
        qaExcluded: true,
        ambiguousOutboundExcluded,
        responseMetricsAvailable: periodResponse.available,
        tagAnalyticsMode: tags.mode,
        tagCoverage: tags.coverage,
      },
    };
  }
}
