import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import { CustomerVoiceAnalysisSource, CustomerVoiceIntent, MessageDirection, Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import { automaticCatalogAliasesForModel, storedProductAliasSafety } from "../classification/product-catalog";
import type { MatchableModel } from "../classification/product-matcher";
import { bangkokDateRangeToUtcBounds, getOffsetBangkokDateString, getTodayBangkokDateString } from "../follower-insights/date-utils";
import { PrismaService } from "../prisma.service";
import {
  buildCustomerVoiceAnalysis,
  isUsableCustomerVoiceAnalysis,
  matchCustomerVoiceProducts,
  type CustomerVoiceAnalysisDraft,
} from "./customer-voice-analyzer";
import {
  CUSTOMER_VOICE_ANALYSIS_VERSION,
  canonicalizeCustomerVoiceTopic,
  type CustomerVoiceTopic,
} from "./customer-voice-taxonomy";
import type {
  StoreInsightsCustomerVoiceDimension,
  StoreInsightsCustomerVoiceDrilldownQueryDto,
  StoreInsightsCustomerVoiceDrilldownResponse,
  StoreInsightsPeriod,
  StoreInsightsQueryDto,
  StoreInsightsStore,
} from "./store-insights.types";

const MAX_PERIOD_DAYS = 90;
const TIMEZONE = "Asia/Bangkok" as const;
const RESPONSE_EVALUATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const AUTO_REPLY_BOT_DISPLAY_NAME = "Auto Reply Bot";

type PeriodBounds = StoreInsightsPeriod & { start: Date; end: Date };

type CustomerVoiceAnalysisRow = {
  source: CustomerVoiceAnalysisSource;
  primaryTopic: string | null;
  secondaryTopics: string[];
  intent: CustomerVoiceIntent | null;
  productMentions: string[];
  confidence: number | null;
  modelProvider?: string | null;
};

export type CustomerVoiceTrend = "UP" | "DOWN" | "FLAT" | "NEW" | "NO_COMPARISON";

export type CustomerVoiceRankedItem = {
  label: string;
  count: number;
  percentage: number;
  previousCount: number | null;
  trend: CustomerVoiceTrend;
  changePercentage: number | null;
};

export type CustomerVoiceCoverage = {
  totalConversations: number;
  analysisRows: number;
  analyzedConversations: number;
  classifiedConversations: number;
  unclassifiedConversations: number;
  persistedTopicConversations: number;
  ruleEnrichedConversations: number;
  aiEnrichedConversations: number;
  lowConfidenceConversations: number;
  analyzedPercentage: number | null;
  classifiedPercentage: number | null;
};

export type CustomerVoiceResponse = {
  storeId: string;
  period: StoreInsightsPeriod;
  comparisonPeriod: StoreInsightsPeriod | null;
  coverage: CustomerVoiceCoverage;
  topTopics: CustomerVoiceRankedItem[];
  topIntents: CustomerVoiceRankedItem[];
  topProducts: CustomerVoiceRankedItem[];
};

type AnalysisConversation = {
  id: string;
  storeId: string | null;
  isQa: boolean;
  lineOfficialAccount: { accountType: string; isActive: boolean; archivedAt: Date | null } | null;
  messages: Array<{ id: string; originalText: string; sentAt: Date }>;
  topics: Array<{ confidence: number | null; topic: { name: string } }>;
};

const analysisConversationSelect = {
  id: true,
  storeId: true,
  isQa: true,
  lineOfficialAccount: { select: { accountType: true, isActive: true, archivedAt: true } },
  messages: {
    where: { direction: MessageDirection.INBOUND },
    orderBy: [{ sentAt: "asc" as const }, { id: "asc" as const }],
    select: { id: true, originalText: true, sentAt: true },
  },
  topics: { select: { confidence: true, topic: { select: { name: true } } } },
} satisfies Prisma.ConversationSelect;

function parseIsoDate(value: string | undefined, fallback: string): string {
  const resolved = value?.trim() || fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(resolved)) throw new BadRequestException("Dates must use YYYY-MM-DD");
  return resolved;
}

function period(query: Pick<StoreInsightsQueryDto, "from" | "to"> = {}): PeriodBounds {
  const to = parseIsoDate(query.to, getTodayBangkokDateString());
  const from = parseIsoDate(query.from, getOffsetBangkokDateString(to, -29));
  const { startUtc: start, endExclusiveUtc: end } = bangkokDateRangeToUtcBounds(from, to);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (end < start) throw new BadRequestException("to cannot be earlier than from");
  if (days > MAX_PERIOD_DAYS) throw new BadRequestException(`Store 360 date range cannot exceed ${MAX_PERIOD_DAYS} days`);
  return { from, to, start, end, timezone: TIMEZONE };
}

function eligibleConversationWhere(storeId: string, bounds: PeriodBounds): Prisma.ConversationWhereInput {
  return {
    storeId,
    isQa: false,
    lineOfficialAccount: { accountType: "STORE", isActive: true, archivedAt: null },
    messages: { some: { direction: MessageDirection.INBOUND, sentAt: { gte: bounds.start, lt: bounds.end } } },
  };
}

function isEligibleConversation(conversation: AnalysisConversation): boolean {
  return Boolean(
    conversation.storeId &&
    !conversation.isQa &&
    conversation.lineOfficialAccount?.accountType === "STORE" &&
    conversation.lineOfficialAccount.isActive &&
    conversation.lineOfficialAccount.archivedAt === null,
  );
}

function rankKey(value: string): string {
  return value.trim();
}

function percentage(count: number, denominator: number): number {
  return denominator > 0 ? Math.round((count / denominator) * 10000) / 10000 : 0;
}

function trendFor(current: number, previous: number, hasComparison: boolean): { trend: CustomerVoiceTrend; changePercentage: number | null } {
  if (!hasComparison) return { trend: "NO_COMPARISON", changePercentage: null };
  if (current === previous) return { trend: "FLAT", changePercentage: 0 };
  if (previous === 0) return { trend: "NEW", changePercentage: null };
  const changePercentage = Math.round(((current - previous) / previous) * 10000) / 10000;
  return { trend: current > previous ? "UP" : "DOWN", changePercentage };
}

function rankedItems(
  currentCounts: Map<string, number>,
  previousCounts: Map<string, number> | null,
  totalConversations: number,
): CustomerVoiceRankedItem[] {
  return [...currentCounts.entries()]
    .map(([label, count]) => {
      const previousCount = previousCounts ? previousCounts.get(label) ?? 0 : null;
      const trend = trendFor(count, previousCount ?? 0, previousCounts !== null);
      return {
        label,
        count,
        percentage: percentage(count, totalConversations),
        previousCount,
        trend: trend.trend,
        changePercentage: trend.changePercentage,
      };
    })
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function aggregateCounts(rows: CustomerVoiceAnalysisRow[], totalConversations: number, previousRows: CustomerVoiceAnalysisRow[] | null) {
  const topics = new Map<string, number>();
  const intents = new Map<string, number>();
  const products = new Map<string, number>();
  const previousTopics = previousRows ? new Map<string, number>() : null;
  const previousIntents = previousRows ? new Map<string, number>() : null;
  const previousProducts = previousRows ? new Map<string, number>() : null;

  const add = (map: Map<string, number>, value: string) => map.set(value, (map.get(value) ?? 0) + 1);
  const addRows = (source: CustomerVoiceAnalysisRow[], topicMap: Map<string, number>, intentMap: Map<string, number>, productMap: Map<string, number>) => {
    for (const row of source) {
      const topicLabels = [...new Set([
        row.primaryTopic ? canonicalizeCustomerVoiceTopic(row.primaryTopic) ?? rankKey(row.primaryTopic) : null,
        ...row.secondaryTopics.map((topic) => canonicalizeCustomerVoiceTopic(topic) ?? rankKey(topic)),
      ].filter((value): value is string => Boolean(value)))];
      for (const topic of topicLabels) add(topicMap, topic);
      if (row.intent) add(intentMap, row.intent);
      for (const product of new Set(row.productMentions.map(rankKey).filter(Boolean))) add(productMap, product);
    }
  };
  addRows(rows, topics, intents, products);
  if (previousRows && previousTopics && previousIntents && previousProducts) addRows(previousRows, previousTopics, previousIntents, previousProducts);

  return {
    topTopics: rankedItems(topics, previousTopics, totalConversations),
    topIntents: rankedItems(intents, previousIntents, totalConversations),
    topProducts: rankedItems(products, previousProducts, totalConversations),
  };
}

function coverageFor(rows: CustomerVoiceAnalysisRow[], totalConversations: number): CustomerVoiceCoverage {
  const classifiedConversations = rows.filter((row) => isUsableCustomerVoiceAnalysis({ primaryTopic: row.primaryTopic as CustomerVoiceTopic | null, intent: row.intent, productMentions: row.productMentions })).length;
  const persistedTopicConversations = rows.filter((row) => row.source === CustomerVoiceAnalysisSource.EXISTING_TOPIC || row.source === CustomerVoiceAnalysisSource.MIXED_ENRICHED).length;
  const ruleEnrichedConversations = rows.filter((row) => row.source === CustomerVoiceAnalysisSource.RULE_ENRICHED || row.source === CustomerVoiceAnalysisSource.MIXED_ENRICHED).length;
  const aiEnrichedConversations = rows.filter((row) => row.source === CustomerVoiceAnalysisSource.AI_CLASSIFIED || (row.source === CustomerVoiceAnalysisSource.MIXED_ENRICHED && Boolean(row.modelProvider))).length;
  return {
    totalConversations,
    analysisRows: rows.length,
    analyzedConversations: rows.length,
    classifiedConversations,
    unclassifiedConversations: Math.max(0, totalConversations - classifiedConversations),
    persistedTopicConversations,
    ruleEnrichedConversations,
    aiEnrichedConversations,
    lowConfidenceConversations: rows.filter((row) => row.confidence !== null && row.confidence < 0.7).length,
    analyzedPercentage: percentage(rows.length, totalConversations),
    classifiedPercentage: percentage(classifiedConversations, totalConversations),
  };
}

function toRow(row: { source: CustomerVoiceAnalysisSource; primaryTopic: string | null; secondaryTopics: string[]; intent: CustomerVoiceIntent | null; productMentions: string[]; confidence: number | null; modelProvider?: string | null }): CustomerVoiceAnalysisRow {
  return row;
}

const customerVoiceDrilldownSelect = {
  id: true,
  latestMessageAt: true,
  customer: { select: { displayName: true } },
  messages: {
    where: { sentAt: {} },
    orderBy: [{ sentAt: "asc" as const }, { id: "asc" as const }],
    select: {
      id: true,
      direction: true,
      sentAt: true,
      senderUserId: true,
      senderDisplayName: true,
      sender: { select: { displayName: true } },
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
  salesProducts: { select: { customProductName: true, productModel: { select: { name: true } } } },
  products: { where: { source: "MANUAL" }, select: { productModel: { select: { name: true } } } },
  customerVoiceAnalyses: {
    where: { analysisVersion: CUSTOMER_VOICE_ANALYSIS_VERSION },
    select: { analysisVersion: true, source: true, primaryTopic: true, secondaryTopics: true, intent: true, productMentions: true, confidence: true, modelProvider: true },
  },
} satisfies Prisma.ConversationSelect;

type CustomerVoiceDrilldownConversation = Prisma.ConversationGetPayload<{ select: typeof customerVoiceDrilldownSelect }>;

function customerVoiceLabels(row: CustomerVoiceAnalysisRow, dimension: StoreInsightsCustomerVoiceDimension): string[] {
  if (dimension === "intent") return row.intent ? [row.intent] : [];
  if (dimension === "product") return [...new Set(row.productMentions.map(rankKey).filter(Boolean))];
  return [...new Set([
    row.primaryTopic ? canonicalizeCustomerVoiceTopic(row.primaryTopic) ?? rankKey(row.primaryTopic) : null,
    ...row.secondaryTopics.map((topic) => canonicalizeCustomerVoiceTopic(topic) ?? rankKey(topic)),
  ].filter((value): value is string => Boolean(value)))];
}

function drilldownDistribution(rows: CustomerVoiceAnalysisRow[], totalConversations: number, dimension: StoreInsightsCustomerVoiceDimension) {
  const counts = new Map<string, number>();
  for (const row of rows) for (const label of customerVoiceLabels(row, dimension)) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, percentage: percentage(count, totalConversations) }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function senderDisplayName(message: CustomerVoiceDrilldownConversation["messages"][number]): string | null {
  return message.sender?.displayName?.trim() || message.senderDisplayName?.trim() || null;
}

function isHumanOutboundMessage(message: CustomerVoiceDrilldownConversation["messages"][number]): boolean {
  return message.direction === MessageDirection.OUTBOUND && Boolean(message.senderUserId) && senderDisplayName(message) !== AUTO_REPLY_BOT_DISPLAY_NAME;
}

function salesTagged(conversation: CustomerVoiceDrilldownConversation): boolean {
  const productNames = [...conversation.salesProducts.map((product) => product.customProductName?.trim() || product.productModel.name), ...conversation.products.map((product) => product.productModel.name)].filter(Boolean);
  return Boolean(
    conversation.customerSalesStatus ||
    conversation.purchaseRecordedAt ||
    conversation.salesRecordedAt ||
    conversation.purchaseRecordedById ||
    conversation.salesRecordedById ||
    conversation.sourceChannels.length > 0 ||
    conversation.isInstallment ||
    productNames.length > 0,
  );
}

async function storeContext(prisma: PrismaService, storeId: string): Promise<StoreInsightsStore> {
  const store = await prisma.store.findFirst({
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
      lastWebhookReceivedAt: oa.lastWebhookReceivedAt ? oa.lastWebhookReceivedAt.toISOString() : null,
    })),
  };
}

function modelNameForAnalysis(draft: CustomerVoiceAnalysisDraft): string {
  return draft.source === CustomerVoiceAnalysisSource.AI_CLASSIFIED ? "ai" : CUSTOMER_VOICE_ANALYSIS_VERSION.replace("customer-voice-", "");
}

@Injectable()
export class CustomerVoiceService {
  private readonly logger = new Logger(CustomerVoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly storeAccess?: StoreAccessService,
  ) {}

  async loadProductModels(): Promise<MatchableModel[]> {
    const storedModels = await this.prisma.productModel.findMany({
      where: { isActive: true },
      include: { aliases: { where: { isActive: true } }, productSeries: true },
    });
    return storedModels.map((model) => ({
      id: model.id,
      name: model.name,
      classificationLevel: model.classificationLevel,
      priority: model.priority,
      productSeries: { name: model.productSeries.name, productGroup: model.productSeries.productGroup },
      aliases: [
        ...model.aliases.map((alias) => ({
          alias: alias.alias,
          priority: alias.priority,
          language: alias.language ?? undefined,
          safety: storedProductAliasSafety(model.name, alias.alias, alias.source),
        })),
        ...automaticCatalogAliasesForModel(model.name).map(({ alias, safety, language }) => ({ alias, safety, language, priority: 0 })),
      ],
    }));
  }

  async analyzeConversation(conversationId: string, models?: MatchableModel[]) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: analysisConversationSelect });
    if (!conversation) throw new NotFoundException("Conversation not found");
    if (!isEligibleConversation(conversation)) return null;

    const productModels = models ?? await this.loadProductModels();
    const inboundMessages = conversation.messages;
    const productMatches = matchCustomerVoiceProducts(inboundMessages, productModels);
    const draft = buildCustomerVoiceAnalysis(
      inboundMessages,
      conversation.topics.map(({ topic, confidence }) => ({ name: topic.name, confidence })),
      productMatches,
    );
    const row = await this.prisma.conversationAnalytics.upsert({
      where: { conversationId_analysisVersion: { conversationId, analysisVersion: CUSTOMER_VOICE_ANALYSIS_VERSION } },
      create: {
        conversationId,
        storeId: conversation.storeId!,
        analysisVersion: CUSTOMER_VOICE_ANALYSIS_VERSION,
        source: draft.source,
        primaryTopic: draft.primaryTopic,
        secondaryTopics: draft.secondaryTopics,
        intent: draft.intent,
        productMentions: draft.productMentions,
        rawProductMentions: draft.rawProductMentions,
        confidence: draft.confidence,
        summary: draft.summary,
        inputMessageCount: draft.inputMessageCount,
        lastAnalyzedMessageAt: draft.lastAnalyzedMessageAt,
        modelProvider: null,
        modelName: modelNameForAnalysis(draft),
      },
      update: {
        storeId: conversation.storeId!,
        source: draft.source,
        primaryTopic: draft.primaryTopic,
        secondaryTopics: draft.secondaryTopics,
        intent: draft.intent,
        productMentions: draft.productMentions,
        rawProductMentions: draft.rawProductMentions,
        confidence: draft.confidence,
        summary: draft.summary,
        inputMessageCount: draft.inputMessageCount,
        lastAnalyzedMessageAt: draft.lastAnalyzedMessageAt,
        processedAt: new Date(),
        modelProvider: null,
        modelName: modelNameForAnalysis(draft),
      },
      select: {
        source: true,
        primaryTopic: true,
        secondaryTopics: true,
        intent: true,
        productMentions: true,
        confidence: true,
      },
    });
    return row;
  }

  async getCustomerVoice(user: AuthUser, storeId: string, query: StoreInsightsQueryDto = {}): Promise<CustomerVoiceResponse> {
    if (!this.storeAccess) throw new ForbiddenException("Store access is unavailable");
    await this.storeAccess.assertStoreAccess(user, storeId);
    const store = await this.prisma.store.findFirst({ where: { id: storeId, isActive: true, archivedAt: null }, select: { id: true } });
    if (!store) throw new NotFoundException("Store not found");

    const currentPeriod = period(query);
    const compareRequested = Boolean(query.compareFrom || query.compareTo);
    const comparisonPeriod = compareRequested ? period({ from: query.compareFrom, to: query.compareTo }) : null;
    const currentWhere = eligibleConversationWhere(storeId, currentPeriod);
    const currentAnalysisWhere: Prisma.ConversationAnalyticsWhereInput = {
      storeId,
      analysisVersion: CUSTOMER_VOICE_ANALYSIS_VERSION,
      conversation: currentWhere,
    };
    const [totalConversations, rows, previousRows] = await Promise.all([
      this.prisma.conversation.count({ where: currentWhere }),
      this.prisma.conversationAnalytics.findMany({
        where: currentAnalysisWhere,
        select: { source: true, primaryTopic: true, secondaryTopics: true, intent: true, productMentions: true, confidence: true, modelProvider: true },
      }),
      comparisonPeriod ? this.prisma.conversationAnalytics.findMany({
        where: { storeId, analysisVersion: CUSTOMER_VOICE_ANALYSIS_VERSION, conversation: eligibleConversationWhere(storeId, comparisonPeriod) },
        select: { source: true, primaryTopic: true, secondaryTopics: true, intent: true, productMentions: true, confidence: true, modelProvider: true },
      }) : Promise.resolve([]),
    ]);
    const currentRows = rows.map(toRow);
    const priorRows = comparisonPeriod ? previousRows.map(toRow) : null;
    const ranked = aggregateCounts(currentRows, totalConversations, priorRows);
    this.logger.debug(`Customer Voice read store=${storeId} conversations=${totalConversations} analyses=${currentRows.length}`);
    return {
      storeId,
      period: { from: currentPeriod.from, to: currentPeriod.to, timezone: currentPeriod.timezone },
      comparisonPeriod: comparisonPeriod ? { from: comparisonPeriod.from, to: comparisonPeriod.to, timezone: comparisonPeriod.timezone } : null,
      coverage: coverageFor(currentRows, totalConversations),
      topTopics: ranked.topTopics,
      topIntents: ranked.topIntents,
      topProducts: ranked.topProducts,
    };
  }

  async getCustomerVoiceDrilldown(user: AuthUser, storeId: string, query: StoreInsightsCustomerVoiceDrilldownQueryDto = {}): Promise<StoreInsightsCustomerVoiceDrilldownResponse> {
    if (!this.storeAccess) throw new ForbiddenException("Store access is unavailable");
    await this.storeAccess.assertStoreAccess(user, storeId);
    const [store, currentPeriod] = await Promise.all([storeContext(this.prisma, storeId), Promise.resolve(period(query))]);
    const currentWhere = eligibleConversationWhere(storeId, currentPeriod);
    const responseWindowEnd = new Date(currentPeriod.end.getTime() + RESPONSE_EVALUATION_WINDOW_MS);
    const [totalConversations, conversations] = await Promise.all([
      this.prisma.conversation.count({ where: currentWhere }),
      this.prisma.conversation.findMany({
        where: currentWhere,
        select: {
          ...customerVoiceDrilldownSelect,
          messages: { ...customerVoiceDrilldownSelect.messages, where: { sentAt: { gte: currentPeriod.start, lt: responseWindowEnd } } },
        },
        orderBy: [{ latestMessageAt: "desc" }, { id: "desc" }],
      }),
    ]);
    const dimension = query.dimension ?? "topic";
    const currentRows = conversations.flatMap((conversation) => conversation.customerVoiceAnalyses.map(toRow));
    const coverage = coverageFor(currentRows, totalConversations);
    const distribution = drilldownDistribution(currentRows, totalConversations, dimension);
    const requestedValue = query.value?.trim() || null;
    const normalizedValue = requestedValue && dimension === "topic"
      ? canonicalizeCustomerVoiceTopic(requestedValue) ?? rankKey(requestedValue)
      : requestedValue;
    const normalizedSearch = query.search?.trim().toLocaleLowerCase() || null;
    const evidence = conversations.map((conversation) => {
      const analysis = conversation.customerVoiceAnalyses.find(({ analysisVersion }) => analysisVersion === CUSTOMER_VOICE_ANALYSIS_VERSION) ?? null;
      const analysisRow = analysis ? toRow(analysis) : null;
      const inbound = conversation.messages.find((message) => message.direction === MessageDirection.INBOUND && message.sentAt >= currentPeriod.start && message.sentAt < currentPeriod.end);
      const humanReply = inbound ? conversation.messages.find((message) => isHumanOutboundMessage(message) && message.sentAt >= inbound.sentAt) : undefined;
      const topicLabels = analysisRow ? customerVoiceLabels(analysisRow, "topic") : [];
      const productLabels = analysisRow ? customerVoiceLabels(analysisRow, "product") : [];
      const classified = analysisRow ? isUsableCustomerVoiceAnalysis({ primaryTopic: analysisRow.primaryTopic as CustomerVoiceTopic | null, intent: analysisRow.intent, productMentions: analysisRow.productMentions }) : false;
      const tagged = salesTagged(conversation);
      return {
        id: conversation.id,
        customer: { displayName: conversation.customer.displayName },
        topics: topicLabels,
        intent: analysisRow?.intent ?? null,
        products: productLabels,
        salesTagged: tagged,
        responseStatus: humanReply ? "REPLIED" as const : "UNANSWERED" as const,
        responder: humanReply && senderDisplayName(humanReply) ? { displayName: senderDisplayName(humanReply)! } : null,
        firstInboundAt: inbound?.sentAt.toISOString() ?? null,
        lastActivity: conversation.latestMessageAt.toISOString(),
        source: analysis?.source ?? CustomerVoiceAnalysisSource.UNCLASSIFIED,
        analysisVersion: analysis?.analysisVersion ?? CUSTOMER_VOICE_ANALYSIS_VERSION,
        classified,
        dimensionLabels: analysisRow ? customerVoiceLabels(analysisRow, dimension) : [],
      };
    }).filter((item) =>
      (!normalizedValue || item.dimensionLabels.includes(normalizedValue)) &&
      (!query.unclassified || !item.classified) &&
      (!query.responseStatus || item.responseStatus === query.responseStatus) &&
      (query.salesTagged === undefined || item.salesTagged === query.salesTagged) &&
      (!normalizedSearch || [item.customer.displayName, ...item.topics, item.intent, ...item.products, item.source, item.responseStatus, item.responder?.displayName].filter(Boolean).join(" ").toLocaleLowerCase().includes(normalizedSearch)),
    );
    const sort = query.sort ?? "date-desc";
    evidence.sort((left, right) => {
      const leftDate = left.firstInboundAt ? new Date(left.firstInboundAt).getTime() : new Date(left.lastActivity).getTime();
      const rightDate = right.firstInboundAt ? new Date(right.firstInboundAt).getTime() : new Date(right.lastActivity).getTime();
      const difference = leftDate - rightDate;
      return difference === 0 ? left.id.localeCompare(right.id) : sort === "date-asc" ? difference : -difference;
    });
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
    const total = evidence.length;
    const items = evidence.slice((page - 1) * pageSize, page * pageSize).map((item) => {
      const { dimensionLabels, ...safeItem } = item;
      void dimensionLabels;
      return safeItem;
    });
    this.logger.debug(`Customer Voice drilldown read store=${storeId} conversations=${totalConversations} matches=${total} dimension=${dimension}`);
    return {
      storeId,
      store,
      period: { from: currentPeriod.from, to: currentPeriod.to, timezone: currentPeriod.timezone },
      analysisVersion: CUSTOMER_VOICE_ANALYSIS_VERSION,
      dimension,
      value: requestedValue,
      coverage,
      distribution,
      items,
      total,
      page,
      pageSize,
      hasNextPage: page * pageSize < total,
    };
  }
}
