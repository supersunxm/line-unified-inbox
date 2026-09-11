import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { MessageDirection, Prisma } from "@prisma/client";
import * as ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import type { AuthUser } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import { bangkokDateRangeToUtcBounds, getOffsetBangkokDateString, getTodayBangkokDateString } from "../follower-insights/date-utils";
import { PrismaService } from "../prisma.service";
import { isUsableCustomerVoiceAnalysis } from "./customer-voice-analyzer";
import { CUSTOMER_VOICE_ANALYSIS_VERSION, type CustomerVoiceTopic } from "./customer-voice-taxonomy";
import {
  StoreInsightsConversation,
  StoreInsightsExportDto,
  StoreInsightsFollowers,
  StoreInsightsPeriod,
  StoreInsightsQueryDto,
  StoreInsightsResponsePerformance,
  StoreInsightsResponder,
  StoreInsightsSales,
  StoreInsightsStore,
  STORE_INSIGHTS_EXPORT_MAX_STORES,
} from "./store-insights.types";

export const STORE_INSIGHTS_TIMEZONE = "Asia/Bangkok" as const;
export const AUTO_REPLY_BOT_DISPLAY_NAME = "Auto Reply Bot";
const MAX_PERIOD_DAYS = 90;
const MAX_EXPORT_CONVERSATIONS = 100_000;
const MINUTE = 60;
const HOUR = 60 * MINUTE;
const RESPONSE_EVALUATION_WINDOW_MS = 24 * HOUR * 1000;

const conversationSelect = {
  id: true,
  customerId: true,
  latestMessageAt: true,
  customer: { select: { id: true, displayName: true } },
  messages: {
    where: { sentAt: {} },
    orderBy: [{ sentAt: "asc" as const }, { id: "asc" as const }],
    select: {
      id: true,
      direction: true,
      sentAt: true,
      senderUserId: true,
      senderDisplayName: true,
      sender: { select: { id: true, displayName: true } },
      rawPayload: true,
    },
  },
  customerSalesStatus: true,
  sourceChannels: true,
  isInstallment: true,
  paymentMethod: true,
  purchaseRecordedAt: true,
  purchaseRecordedById: true,
  salesRecordedAt: true,
  salesRecordedById: true,
  salesProducts: {
    select: {
      customProductName: true,
      productModel: { select: { id: true, name: true, productSeries: { select: { name: true } } } },
    },
  },
  products: {
    where: { source: "MANUAL" },
    select: { productModel: { select: { id: true, name: true, productSeries: { select: { name: true } } } } },
  },
  topics: {
    select: { topic: { select: { name: true } } },
  },
  customerVoiceAnalyses: {
    where: { analysisVersion: CUSTOMER_VOICE_ANALYSIS_VERSION },
    select: {
      analysisVersion: true,
      source: true,
      primaryTopic: true,
      secondaryTopics: true,
      intent: true,
      productMentions: true,
      confidence: true,
      inputMessageCount: true,
      lastAnalyzedMessageAt: true,
      processedAt: true,
      modelProvider: true,
      modelName: true,
    },
  },
} satisfies Prisma.ConversationSelect;

type ConversationRow = Prisma.ConversationGetPayload<{ select: typeof conversationSelect }>;
type MessageRow = ConversationRow["messages"][number];

type PeriodBounds = StoreInsightsPeriod & {
  start: Date;
  end: Date;
};

type ResponseCase = {
  conversationId: string;
  customerId: string;
  customerName: string;
  inboundAt: Date;
  answeredAt: Date | null;
  durationSeconds: number | null;
  responderId: string | null;
  responderName: string | null;
};

type SalesInfo = {
  tagged: boolean;
  productNames: string[];
  paymentMethod: string | null;
  recordedById: string | null;
};

type StoreSnapshot = {
  store: StoreInsightsStore;
  period: PeriodBounds;
  followers: StoreInsightsFollowers;
  conversations: ConversationRow[];
  cases: ResponseCase[];
  salesByConversation: Map<string, SalesInfo>;
  ambiguousOutboundCount: number;
  automatedOutboundCount: number;
  inboundMessages: MessageRow[];
  followUpsByUserId: Map<string, number>;
};

type ExportCell = string | number | boolean | null;
type ExportRow = Record<string, ExportCell>;
type CurrentCustomerVoiceAnalysis = ConversationRow["customerVoiceAnalyses"][number];

function effectiveSenderName(message: MessageRow): string | null {
  return message.sender?.displayName?.trim() || message.senderDisplayName?.trim() || null;
}

function hasAutoResponsePayload(message: MessageRow): boolean {
  if (!message.rawPayload || typeof message.rawPayload !== "object" || Array.isArray(message.rawPayload)) return false;
  const source = (message.rawPayload as { source?: unknown }).source;
  return source === "AUTO_RESPONSE";
}

function isAutomatedOutbound(message: MessageRow): boolean {
  return message.direction === MessageDirection.OUTBOUND &&
    (effectiveSenderName(message) === AUTO_REPLY_BOT_DISPLAY_NAME || hasAutoResponsePayload(message));
}

function isHumanOutbound(message: MessageRow): boolean {
  return message.direction === MessageDirection.OUTBOUND &&
    Boolean(message.senderUserId) &&
    effectiveSenderName(message) !== AUTO_REPLY_BOT_DISPLAY_NAME;
}

function isAmbiguousOutbound(message: MessageRow): boolean {
  return message.direction === MessageDirection.OUTBOUND && !isHumanOutbound(message) && !isAutomatedOutbound(message);
}

function parseIsoDate(value: string | undefined, fallback: string): string {
  const resolved = value?.trim() || fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(resolved)) throw new BadRequestException("Dates must use YYYY-MM-DD");
  return resolved;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function bangkokHour(date: Date): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: STORE_INSIGHTS_TIMEZONE, hour: "2-digit", hour12: false }).format(date)) % 24;
}

function formatDateTime(date: Date): string {
  return date.toISOString();
}

function conversationSalesInfo(conversation: ConversationRow): SalesInfo {
  const productNames = [...new Set([
    ...conversation.salesProducts.map((product) => product.customProductName?.trim() || product.productModel.name),
    ...conversation.products.map((product) => product.productModel.name),
  ])];
  const paymentMethod = conversation.paymentMethod ?? (conversation.isInstallment ? "INSTALLMENT" : null);
  const tagged = Boolean(
    conversation.customerSalesStatus ||
    conversation.purchaseRecordedAt ||
    conversation.salesRecordedAt ||
    conversation.purchaseRecordedById ||
    conversation.salesRecordedById ||
    conversation.sourceChannels.length > 0 ||
    conversation.isInstallment ||
    productNames.length > 0,
  );
  return { tagged, productNames, paymentMethod, recordedById: conversation.salesRecordedById ?? conversation.purchaseRecordedById ?? null };
}

function formatTopics(conversation: ConversationRow): string | null {
  const names = topicNames(conversation);
  if (names.length === 0) return null;
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

function topicNames(conversation: ConversationRow): string[] {
  return [...new Set(conversation.topics.map((item) => item.topic.name.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function safeStoreId(store: StoreInsightsStore): string {
  return store.externalStoreId?.trim() || store.code?.trim() || store.id;
}

function conversationReference(conversationId: string): string {
  return `conv_${createHash("sha256").update(conversationId).digest("hex").slice(0, 16)}`;
}

function safeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "store";
}

function worksheetColumnWidth(values: Array<string | number | boolean | null>, header: string): number {
  const longest = values.reduce<number>((max, value) => Math.max(max, value === null ? 0 : String(value).length), header.length);
  return Math.min(60, Math.max(12, longest + 3));
}

function isClassifiedCustomerVoiceAnalysis(analysis: { primaryTopic: string | null; intent: CurrentCustomerVoiceAnalysis["intent"]; productMentions: string[] }): boolean {
  return isUsableCustomerVoiceAnalysis({
    primaryTopic: analysis.primaryTopic as CustomerVoiceTopic | null,
    intent: analysis.intent,
    productMentions: analysis.productMentions,
  });
}

function buildResponseCases(conversations: ConversationRow[], period: Pick<PeriodBounds, "start" | "end">): {
  cases: ResponseCase[];
  ambiguousOutboundCount: number;
  automatedOutboundCount: number;
  inboundMessages: MessageRow[];
} {
  let ambiguousOutboundCount = 0;
  let automatedOutboundCount = 0;
  const inboundMessages: MessageRow[] = [];
  const cases: ResponseCase[] = [];

  for (const conversation of conversations) {
    const inbound = conversation.messages.filter((message) => message.direction === MessageDirection.INBOUND && message.sentAt >= period.start && message.sentAt < period.end);
    const outbound = conversation.messages.filter((message) => message.direction === MessageDirection.OUTBOUND);
    inboundMessages.push(...inbound);
    for (const message of outbound) {
      if (isAutomatedOutbound(message)) automatedOutboundCount++;
      else if (isAmbiguousOutbound(message)) ambiguousOutboundCount++;
    }

    const firstInbound = inbound[0];
    if (!firstInbound) continue;
    const humanReply = conversation.messages.find((message) => isHumanOutbound(message) && message.sentAt >= firstInbound.sentAt);
    const durationSeconds = humanReply
      ? Math.max(0, (humanReply.sentAt.getTime() - firstInbound.sentAt.getTime()) / 1000)
      : null;
    cases.push({
      conversationId: conversation.id,
      customerId: conversation.customerId,
      customerName: conversation.customer.displayName,
      inboundAt: firstInbound.sentAt,
      answeredAt: humanReply?.sentAt ?? null,
      durationSeconds,
      responderId: humanReply?.senderUserId ?? null,
      responderName: humanReply ? effectiveSenderName(humanReply) : null,
    });
  }
  return { cases, ambiguousOutboundCount, automatedOutboundCount, inboundMessages };
}

@Injectable()
export class StoreInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeAccess: StoreAccessService,
  ) {}

  private period(query: StoreInsightsQueryDto = {}): PeriodBounds {
    const to = parseIsoDate(query.to, getTodayBangkokDateString());
    const from = parseIsoDate(query.from, getOffsetBangkokDateString(to, -29));
    const { startUtc: start, endExclusiveUtc: end } = bangkokDateRangeToUtcBounds(from, to);
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    if (end < start) throw new BadRequestException("to cannot be earlier than from");
    if (days > MAX_PERIOD_DAYS) throw new BadRequestException(`Store 360 date range cannot exceed ${MAX_PERIOD_DAYS} days`);
    return { from, to, start, end, timezone: STORE_INSIGHTS_TIMEZONE };
  }

  private async getStore(user: AuthUser, storeId: string): Promise<StoreInsightsStore> {
    await this.storeAccess.assertStoreAccess(user, storeId);
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, isActive: true, archivedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        region: true,
        storeMaster: { select: { externalStoreId: true, province: true, region: true } },
        lineOfficialAccounts: {
          where: { accountType: "STORE", isActive: true, archivedAt: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true, basicId: true, connectionStatus: true, lastWebhookReceivedAt: true },
        },
      },
    });
    if (!store) throw new NotFoundException("Store not found");
    return {
      id: store.id,
      name: store.name,
      code: store.code,
      externalStoreId: store.storeMaster?.externalStoreId ?? null,
      province: store.storeMaster?.province ?? null,
      region: store.storeMaster?.region ?? store.region ?? null,
      lineOas: store.lineOfficialAccounts.map((oa) => ({
        id: oa.id,
        name: oa.name,
        basicId: oa.basicId,
        connectionStatus: oa.connectionStatus,
        lastWebhookReceivedAt: oa.lastWebhookReceivedAt ? formatDateTime(oa.lastWebhookReceivedAt) : null,
      })),
    };
  }

  private async getFollowerMetrics(store: StoreInsightsStore, period: PeriodBounds): Promise<StoreInsightsFollowers> {
    const oaIds = store.lineOas.map((oa) => oa.id);
    if (oaIds.length === 0) return { current: null, growth: null, historicalAvailable: false, snapshotCoverage: "unavailable" };
    const snapshots = await this.prisma.lineOaFollowerSnapshot.findMany({
      where: { lineOaId: { in: oaIds }, snapshotDate: { lt: period.end }, status: "ready", followers: { not: null } },
      orderBy: [{ snapshotDate: "desc" }, { lineOaId: "asc" }],
      select: { lineOaId: true, snapshotDate: true, followers: true },
    });
    const byOa = new Map<string, typeof snapshots>();
    for (const snapshot of snapshots) byOa.set(snapshot.lineOaId, [...(byOa.get(snapshot.lineOaId) ?? []), snapshot]);

    let current = 0;
    let currentCount = 0;
    let growth = 0;
    let growthCount = 0;
    for (const oaId of oaIds) {
      const oaSnapshots = byOa.get(oaId) ?? [];
      const latest = oaSnapshots[0];
      if (latest?.followers !== null && latest?.followers !== undefined) {
        current += latest.followers;
        currentCount++;
      }
      const endSnapshot = oaSnapshots.find((snapshot) => snapshot.snapshotDate < period.end);
      const startSnapshot = oaSnapshots.find((snapshot) => snapshot.snapshotDate <= period.start);
      if (startSnapshot?.followers !== null && startSnapshot?.followers !== undefined && endSnapshot?.followers !== null && endSnapshot?.followers !== undefined) {
        growth += endSnapshot.followers - startSnapshot.followers;
        growthCount++;
      }
    }
    return {
      current: currentCount > 0 ? current : null,
      growth: growthCount > 0 ? growth : null,
      historicalAvailable: growthCount > 0,
      snapshotCoverage: growthCount === oaIds.length ? "available" : growthCount > 0 ? "partial" : "unavailable",
    };
  }

  private async getSnapshot(user: AuthUser, storeId: string, query: StoreInsightsQueryDto = {}): Promise<StoreSnapshot> {
    const [store, period] = await Promise.all([this.getStore(user, storeId), Promise.resolve(this.period(query))]);
    const responseWindowEnd = new Date(period.end.getTime() + RESPONSE_EVALUATION_WINDOW_MS);
    const conversations = await this.prisma.conversation.findMany({
      where: {
        storeId,
        isQa: false,
        lineOfficialAccount: { accountType: "STORE", isActive: true, archivedAt: null },
        messages: { some: { direction: MessageDirection.INBOUND, sentAt: { gte: period.start, lt: period.end } } },
        ...(query.customerVoiceTopic ? {
          customerVoiceAnalyses: {
            some: {
              analysisVersion: CUSTOMER_VOICE_ANALYSIS_VERSION,
              OR: [
                { primaryTopic: query.customerVoiceTopic },
                { secondaryTopics: { has: query.customerVoiceTopic } },
              ],
            },
          },
        } : {}),
      },
      select: {
        ...conversationSelect,
        messages: {
          ...conversationSelect.messages,
          where: { sentAt: { gte: period.start, lt: responseWindowEnd } },
        },
      },
      orderBy: [{ latestMessageAt: "desc" }, { id: "desc" }],
    });
    const response = buildResponseCases(conversations, period);
    const salesByConversation = new Map(conversations.map((conversation) => [conversation.id, conversationSalesInfo(conversation)]));
    const activity = await this.prisma.activityHistory.findMany({
      where: {
        actionType: "RETURNED_TO_FOLLOW_UP",
        createdAt: { gte: period.start, lt: period.end },
        conversation: { storeId, isQa: false, lineOfficialAccount: { accountType: "STORE", isActive: true, archivedAt: null } },
      },
      select: { createdByUserId: true },
    });
    const followUpsByUserId = new Map<string, number>();
    for (const row of activity) if (row.createdByUserId) followUpsByUserId.set(row.createdByUserId, (followUpsByUserId.get(row.createdByUserId) ?? 0) + 1);
    return {
      store,
      period,
      followers: await this.getFollowerMetrics(store, period),
      conversations,
      cases: response.cases,
      salesByConversation,
      ambiguousOutboundCount: response.ambiguousOutboundCount,
      automatedOutboundCount: response.automatedOutboundCount,
      inboundMessages: response.inboundMessages,
      followUpsByUserId,
    };
  }

  private responsePerformance(snapshot: StoreSnapshot): StoreInsightsResponsePerformance {
    const total = snapshot.cases.length;
    const answered = snapshot.cases.filter((item) => item.durationSeconds !== null);
    const available = snapshot.ambiguousOutboundCount === 0;
    const metric = (count: number): { count: number; percentage: number | null } => ({ count, percentage: available && total > 0 ? count / total : null });
    const volumeByHour = new Array<number>(24).fill(0);
    for (const message of snapshot.inboundMessages) volumeByHour[bangkokHour(message.sentAt)]++;
    return {
      totalConversations: total,
      repliedWithin15Minutes: metric(answered.filter((item) => (item.durationSeconds ?? Infinity) <= 15 * MINUTE).length),
      repliedWithin1Hour: metric(answered.filter((item) => (item.durationSeconds ?? Infinity) <= HOUR).length),
      repliedWithin24Hours: metric(answered.filter((item) => (item.durationSeconds ?? Infinity) <= 24 * HOUR).length),
      unanswered: metric(total - answered.length),
      medianFirstResponseSeconds: available ? median(answered.flatMap((item) => item.durationSeconds === null ? [] : [item.durationSeconds])) : null,
      volumeByHour,
      totalInboundMessages: snapshot.inboundMessages.length,
      available,
      dataQuality: { ambiguousOutboundCount: snapshot.ambiguousOutboundCount, automatedOutboundCount: snapshot.automatedOutboundCount },
    };
  }

  private responders(snapshot: StoreSnapshot): StoreInsightsResponder[] {
    const byResponder = new Map<string, { displayName: string; cases: ResponseCase[] }>();
    for (const responseCase of snapshot.cases) {
      if (!responseCase.responderId) continue;
      const current = byResponder.get(responseCase.responderId) ?? { displayName: responseCase.responderName || "Staff", cases: [] };
      current.cases.push(responseCase);
      if (current.displayName === "Staff" && responseCase.responderName) current.displayName = responseCase.responderName;
      byResponder.set(responseCase.responderId, current);
    }
    return [...byResponder.entries()]
      .map(([id, data]) => {
        const durations = data.cases.flatMap((item) => item.durationSeconds === null ? [] : [item.durationSeconds]);
        const salesTaggedCount = data.cases.filter((item) => {
          const sales = snapshot.salesByConversation.get(item.conversationId);
          return sales?.tagged && sales.recordedById === id;
        }).length;
        return {
          id,
          displayName: data.displayName,
          conversationsHandled: data.cases.length,
          repliedWithin24HoursPercentage: snapshot.ambiguousOutboundCount === 0 && data.cases.length > 0 ? data.cases.filter((item) => (item.durationSeconds ?? Infinity) <= 24 * HOUR).length / data.cases.length : null,
          medianResponseSeconds: snapshot.ambiguousOutboundCount === 0 ? median(durations) : null,
          followUpCount: snapshot.followUpsByUserId.get(id) ?? 0,
          salesTaggedCount,
        };
      })
      .sort((left, right) => right.conversationsHandled - left.conversationsHandled || left.displayName.localeCompare(right.displayName));
  }

  private sales(snapshot: StoreSnapshot): StoreInsightsSales {
    const customerIds = new Set(snapshot.cases.map((item) => item.customerId));
    const taggedCustomerIds = new Set<string>();
    let taggedConversations = 0;
    let missingSalesInformation = 0;
    const productCounts = new Map<string, number>();
    const paymentCounts = new Map<string, number>();
    for (const conversation of snapshot.conversations) {
      const info = snapshot.salesByConversation.get(conversation.id)!;
      if (info.tagged) {
        taggedConversations++;
        taggedCustomerIds.add(conversation.customerId);
      } else {
        missingSalesInformation++;
      }
      for (const productName of info.productNames) productCounts.set(productName, (productCounts.get(productName) ?? 0) + 1);
      if (info.paymentMethod) paymentCounts.set(info.paymentMethod, (paymentCounts.get(info.paymentMethod) ?? 0) + 1);
    }
    const ranked = (counts: Map<string, number>) => [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).map(([name, count]) => ({ name, count }));
    return {
      totalCustomers: customerIds.size,
      salesTaggedCustomers: taggedCustomerIds.size,
      salesTaggedCustomerPercentage: customerIds.size > 0 ? taggedCustomerIds.size / customerIds.size : null,
      totalConversations: snapshot.conversations.length,
      salesTaggedConversations: taggedConversations,
      productModels: ranked(productCounts),
      paymentMethods: ranked(paymentCounts),
      missingSalesInformation,
    };
  }

  private conversations(snapshot: StoreSnapshot, query: StoreInsightsQueryDto): { items: StoreInsightsConversation[]; total: number; page: number; pageSize: number } {
    const caseByConversation = new Map(snapshot.cases.map((item) => [item.conversationId, item]));
    const all = snapshot.conversations.map((conversation) => {
      const responseCase = caseByConversation.get(conversation.id)!;
      const sales = snapshot.salesByConversation.get(conversation.id)!;
      return {
        id: conversation.id,
        customer: conversation.customer,
        topic: formatTopics(conversation),
        responseStatus: responseCase.durationSeconds === null ? "UNANSWERED" : "REPLIED",
        responder: responseCase.responderId && responseCase.responderName ? { id: responseCase.responderId, displayName: responseCase.responderName } : null,
        firstResponseSeconds: responseCase.durationSeconds,
        salesProduct: sales.productNames.join(", ") || null,
        salesTagged: sales.tagged,
        lastActivity: formatDateTime(conversation.latestMessageAt),
      } satisfies StoreInsightsConversation;
    }).filter((item) => !query.responseStatus || item.responseStatus === query.responseStatus)
      .filter((item) => !query.responderId || item.responder?.id === query.responderId)
      .filter((item) => query.salesTagged === undefined || item.salesTagged === query.salesTagged);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    return { items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length, page, pageSize };
  }

  private baseResponse(snapshot: StoreSnapshot) {
    const performance = this.responsePerformance(snapshot);
    const sales = this.sales(snapshot);
    return {
      store: snapshot.store,
      period: { from: snapshot.period.from, to: snapshot.period.to, timezone: snapshot.period.timezone },
      followers: snapshot.followers,
      customers: sales.totalCustomers,
      response: performance,
      sales,
      limitations: [
        ...(snapshot.followers.snapshotCoverage !== "available" ? ["Historical follower growth is only shown where both period snapshots are available."] : []),
        ...(snapshot.ambiguousOutboundCount > 0 ? [`${snapshot.ambiguousOutboundCount} outbound message(s) lack reliable human/bot attribution; response KPIs are unavailable for this period.`] : []),
        ...(sales.missingSalesInformation > 0 ? [`${sales.missingSalesInformation} conversation(s) with inbound activity have no recorded sales/product/payment tag.`] : []),
      ],
    };
  }

  async getSummary(user: AuthUser, storeId: string, query: StoreInsightsQueryDto = {}) {
    const snapshot = await this.getSnapshot(user, storeId, query);
    const response = this.baseResponse(snapshot);
    const compareFrom = query.compareFrom;
    const compareTo = query.compareTo;
    let comparison: ReturnType<StoreInsightsService["baseResponse"]> | null = null;
    if (compareFrom || compareTo) {
      comparison = this.baseResponse(await this.getSnapshot(user, storeId, { from: compareFrom, to: compareTo }));
    }
    return { ...response, responders: this.responders(snapshot), comparison };
  }

  async getResponsePerformance(user: AuthUser, storeId: string, query: StoreInsightsQueryDto = {}) {
    const snapshot = await this.getSnapshot(user, storeId, query);
    return { storeId, period: snapshot.period, ...this.responsePerformance(snapshot) };
  }

  async getResponders(user: AuthUser, storeId: string, query: StoreInsightsQueryDto = {}) {
    const snapshot = await this.getSnapshot(user, storeId, query);
    return { storeId, period: snapshot.period, responders: this.responders(snapshot), unknownResponderConversations: snapshot.cases.filter((item) => !item.responderId).length };
  }

  async getSales(user: AuthUser, storeId: string, query: StoreInsightsQueryDto = {}) {
    const snapshot = await this.getSnapshot(user, storeId, query);
    return { storeId, period: snapshot.period, ...this.sales(snapshot) };
  }

  async getConversations(user: AuthUser, storeId: string, query: StoreInsightsQueryDto = {}) {
    const snapshot = await this.getSnapshot(user, storeId, query);
    return { storeId, period: snapshot.period, ...this.conversations(snapshot, query) };
  }

  private currentCustomerVoiceAnalysis(conversation: ConversationRow): CurrentCustomerVoiceAnalysis | null {
    return conversation.customerVoiceAnalyses.find(({ analysisVersion }) => analysisVersion === CUSTOMER_VOICE_ANALYSIS_VERSION) ?? null;
  }

  private customerVoiceExportCoverage(snapshot: StoreSnapshot) {
    const analyses = snapshot.conversations.flatMap((conversation) => {
      const analysis = this.currentCustomerVoiceAnalysis(conversation);
      return analysis ? [analysis] : [];
    });
    const classified = analyses.filter(isClassifiedCustomerVoiceAnalysis).length;
    const eligible = snapshot.conversations.length;
    return {
      eligible,
      analyzed: analyses.length,
      classified,
      coverage: eligible > 0 ? classified / eligible : 0,
    };
  }

  private exportSummaryRow(snapshot: StoreSnapshot): ExportRow {
    const performance = this.responsePerformance(snapshot);
    const sales = this.sales(snapshot);
    const customerVoice = this.customerVoiceExportCoverage(snapshot);
    return {
      "Store ID": safeStoreId(snapshot.store),
      "Store Name": snapshot.store.name,
      "Reporting Start Date": snapshot.period.from,
      "Reporting End Date": snapshot.period.to,
      "Eligible Customers": sales.totalCustomers,
      "Inbound Messages": performance.totalInboundMessages,
      Followers: snapshot.followers.current,
      "Follower Change": snapshot.followers.growth,
      "Replied Within 24h": performance.repliedWithin24Hours.count,
      "Reply Rate": performance.repliedWithin24Hours.percentage,
      "Median First Response": performance.medianFirstResponseSeconds,
      Unanswered: performance.unanswered.count,
      "Sales Tagged Customers": sales.salesTaggedCustomers,
      "Customer Voice Eligible": customerVoice.eligible,
      "Customer Voice Analyzed": customerVoice.analyzed,
      "Customer Voice Classified": customerVoice.classified,
      "Customer Voice Coverage": customerVoice.coverage,
      "Current Analysis Version": CUSTOMER_VOICE_ANALYSIS_VERSION,
    };
  }

  private exportConversationRows(snapshot: StoreSnapshot): ExportRow[] {
    const caseByConversation = new Map(snapshot.cases.map((responseCase) => [responseCase.conversationId, responseCase]));
    const storeId = safeStoreId(snapshot.store);
    return snapshot.conversations.map((conversation) => {
      const responseCase = caseByConversation.get(conversation.id);
      const sales = snapshot.salesByConversation.get(conversation.id)!;
      const analysis = this.currentCustomerVoiceAnalysis(conversation);
      const inbound = conversation.messages.filter((message) => message.direction === MessageDirection.INBOUND && message.sentAt >= snapshot.period.start && message.sentAt < snapshot.period.end);
      const humanOutboundCount = conversation.messages.filter((message) => isHumanOutbound(message) && message.sentAt >= snapshot.period.start && message.sentAt < snapshot.period.end).length;
      const productSalesInformation = [
        sales.productNames.join(", ") || null,
        sales.paymentMethod ? `Payment: ${sales.paymentMethod}` : null,
      ].filter((value): value is string => Boolean(value)).join(" | ") || null;
      return {
        "Store ID": storeId,
        "Store Name": snapshot.store.name,
        "Conversation Reference": conversationReference(conversation.id),
        "First Activity Date": inbound[0] ? formatDateTime(inbound[0].sentAt) : null,
        "Last Activity Date": formatDateTime(conversation.latestMessageAt),
        "Inbound Message Count": inbound.length,
        "Outbound Human Message Count": humanOutboundCount,
        Replied: responseCase?.durationSeconds !== null && responseCase?.durationSeconds !== undefined,
        "Replied Within 24h": responseCase?.durationSeconds !== null && responseCase?.durationSeconds !== undefined
          ? responseCase.durationSeconds <= 24 * HOUR
          : false,
        "First Response Seconds": responseCase?.durationSeconds ?? null,
        Responder: responseCase?.responderName ?? null,
        "Sales Status": conversation.customerSalesStatus,
        "Product Sales Information": productSalesInformation,
        "Existing Topic": topicNames(conversation).join(", ") || null,
        "Current Customer Voice Primary Topic": analysis?.primaryTopic ?? null,
        "Current Customer Voice Intent": analysis?.intent ?? null,
        "Current Customer Voice Analysis Version": analysis?.analysisVersion ?? null,
        "Customer Voice Classified / Unclassified": analysis && isClassifiedCustomerVoiceAnalysis(analysis) ? "CLASSIFIED" : "UNCLASSIFIED",
      };
    });
  }

  private exportCustomerVoiceRows(snapshot: StoreSnapshot): ExportRow[] {
    const storeId = safeStoreId(snapshot.store);
    return snapshot.conversations.flatMap((conversation) => {
      const analysis = this.currentCustomerVoiceAnalysis(conversation);
      if (!analysis) return [];
      const productFamilies = [...new Set([
        ...conversation.salesProducts.map((product) => product.productModel.productSeries.name),
        ...conversation.products.map((product) => product.productModel.productSeries.name),
      ].filter(Boolean))];
      return [{
        "Store ID": storeId,
        "Store Name": snapshot.store.name,
        "Conversation Reference": conversationReference(conversation.id),
        "Analysis Version": analysis.analysisVersion,
        "Source / Provenance": [analysis.source, analysis.modelProvider, analysis.modelName].filter(Boolean).join(" / "),
        "Primary Topic": analysis.primaryTopic,
        "Secondary Topics": analysis.secondaryTopics.join(", ") || null,
        Intent: analysis.intent,
        "Product Mentions": analysis.productMentions.join(", ") || null,
        "Product Family": productFamilies.join(", ") || null,
        "Exact Product Model if recognized": analysis.productMentions.join(", ") || null,
        Confidence: analysis.confidence,
        "Classified / Unclassified": isClassifiedCustomerVoiceAnalysis(analysis) ? "CLASSIFIED" : "UNCLASSIFIED",
        "Message Count Used": analysis.inputMessageCount,
        "Last Analyzed At": analysis.processedAt ? formatDateTime(analysis.processedAt) : null,
      }];
    });
  }

  private exportResponderRows(snapshot: StoreSnapshot): ExportRow[] {
    const existingResponders = this.responders(snapshot);
    const responderById = new Map(existingResponders.map((responder) => [responder.id, responder]));
    const repliesByResponder = new Map<string, { displayName: string; replies: number }>();
    for (const conversation of snapshot.conversations) {
      for (const message of conversation.messages) {
        if (!isHumanOutbound(message) || message.sentAt < snapshot.period.start || message.sentAt >= snapshot.period.end || !message.senderUserId) continue;
        const current = repliesByResponder.get(message.senderUserId) ?? { displayName: effectiveSenderName(message) ?? "Staff", replies: 0 };
        current.replies++;
        if (current.displayName === "Staff" && effectiveSenderName(message)) current.displayName = effectiveSenderName(message)!;
        repliesByResponder.set(message.senderUserId, current);
      }
    }
    const responderIds = new Set([...responderById.keys(), ...repliesByResponder.keys()]);
    const totalHumanReplies = [...repliesByResponder.values()].reduce((sum, responder) => sum + responder.replies, 0);
    const storeId = safeStoreId(snapshot.store);
    return [...responderIds]
      .map((id) => {
        const responder = responderById.get(id);
        const replyData = repliesByResponder.get(id);
        const replies = replyData?.replies ?? 0;
        return {
          "Store ID": storeId,
          "Store Name": snapshot.store.name,
          Responder: responder?.displayName ?? replyData?.displayName ?? "Staff",
          "Conversations Replied": responder?.conversationsHandled ?? 0,
          Replies: replies,
          "Median First Response Seconds": responder?.medianResponseSeconds ?? null,
          "Share of Human Replies": totalHumanReplies > 0 ? replies / totalHumanReplies : null,
        };
      })
      .sort((left, right) => String(left.Responder).localeCompare(String(right.Responder)));
  }

  private addExportWorksheet(workbook: ExcelJS.Workbook, name: string, headers: string[], rows: ExportRow[]) {
    const worksheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: worksheetColumnWidth(rows.map((row) => row[header]), header),
    }));
    worksheet.getRow(1).font = { bold: true };
    for (const row of rows) {
      const addedRow = worksheet.addRow(row);
      for (const header of ["Reply Rate", "Customer Voice Coverage", "Share of Human Replies"]) {
        const columnIndex = headers.indexOf(header);
        if (columnIndex < 0) continue;
        const cell = addedRow.getCell(columnIndex + 1);
        if (typeof cell.value === "number") cell.numFmt = "0.0%";
      }
    }
    if (rows.length > 0) worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: headers.length } };
    return worksheet;
  }

  async export(user: AuthUser, dto: StoreInsightsExportDto) {
    const storeIds = dto.storeIds.map((storeId) => storeId.trim());
    if (storeIds.length === 0 || storeIds.some((storeId) => !storeId)) throw new BadRequestException("At least one store ID is required");
    if (new Set(storeIds).size !== storeIds.length) throw new BadRequestException("Duplicate store IDs are not allowed");
    if (storeIds.length > STORE_INSIGHTS_EXPORT_MAX_STORES) throw new BadRequestException(`Store 360 export supports at most ${STORE_INSIGHTS_EXPORT_MAX_STORES} stores per request`);
    if (dto.timezone && dto.timezone !== STORE_INSIGHTS_TIMEZONE) throw new BadRequestException(`Store 360 export only supports ${STORE_INSIGHTS_TIMEZONE}`);

    // Authorize the complete requested set before reading any analytics data.
    await Promise.all(storeIds.map((storeId) => this.storeAccess.assertStoreAccess(user, storeId)));
    const query: StoreInsightsQueryDto = { from: dto.startDate, to: dto.endDate };
    const snapshots = await Promise.all(storeIds.map((storeId) => this.getSnapshot(user, storeId, query)));
    const conversationCount = snapshots.reduce((total, snapshot) => total + snapshot.conversations.length, 0);
    if (conversationCount > MAX_EXPORT_CONVERSATIONS) {
      throw new BadRequestException(`Store 360 export is too large (${conversationCount.toLocaleString()} conversations); narrow the date range or export fewer stores`);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "OPPO LINE OA Monitor Store 360";
    workbook.created = new Date();
    const summaryHeaders = ["Store ID", "Store Name", "Reporting Start Date", "Reporting End Date", "Eligible Customers", "Inbound Messages", "Followers", "Follower Change", "Replied Within 24h", "Reply Rate", "Median First Response", "Unanswered", "Sales Tagged Customers", "Customer Voice Eligible", "Customer Voice Analyzed", "Customer Voice Classified", "Customer Voice Coverage", "Current Analysis Version"];
    const conversationHeaders = ["Store ID", "Store Name", "Conversation Reference", "First Activity Date", "Last Activity Date", "Inbound Message Count", "Outbound Human Message Count", "Replied", "Replied Within 24h", "First Response Seconds", "Responder", "Sales Status", "Product Sales Information", "Existing Topic", "Current Customer Voice Primary Topic", "Current Customer Voice Intent", "Current Customer Voice Analysis Version", "Customer Voice Classified / Unclassified"];
    const customerVoiceHeaders = ["Store ID", "Store Name", "Conversation Reference", "Analysis Version", "Source / Provenance", "Primary Topic", "Secondary Topics", "Intent", "Product Mentions", "Product Family", "Exact Product Model if recognized", "Confidence", "Classified / Unclassified", "Message Count Used", "Last Analyzed At"];
    const responderHeaders = ["Store ID", "Store Name", "Responder", "Conversations Replied", "Replies", "Median First Response Seconds", "Share of Human Replies"];
    this.addExportWorksheet(workbook, "Summary", summaryHeaders, snapshots.map((snapshot) => this.exportSummaryRow(snapshot)));
    this.addExportWorksheet(workbook, "Conversations", conversationHeaders, snapshots.flatMap((snapshot) => this.exportConversationRows(snapshot)));
    this.addExportWorksheet(workbook, "Customer Voice", customerVoiceHeaders, snapshots.flatMap((snapshot) => this.exportCustomerVoiceRows(snapshot)));
    this.addExportWorksheet(workbook, "Responders", responderHeaders, snapshots.flatMap((snapshot) => this.exportResponderRows(snapshot)));

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const storePart = snapshots.length === 1 ? safeFilenamePart(safeStoreId(snapshots[0].store)) : "multi";
    const datePart = `${snapshots[0].period.from.replaceAll("-", "")}-${snapshots[0].period.to.replaceAll("-", "")}`;
    return {
      buffer,
      filename: `store-360_${storePart}_${datePart}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }
}
