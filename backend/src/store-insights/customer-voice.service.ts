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
import type { StoreInsightsQueryDto, StoreInsightsPeriod } from "./store-insights.types";

const MAX_PERIOD_DAYS = 90;
const TIMEZONE = "Asia/Bangkok" as const;

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
}
