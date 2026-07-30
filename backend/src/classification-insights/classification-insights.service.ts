import { Injectable } from "@nestjs/common";
import { Prisma, ProductAliasSource, PurchaseIntent, TopicCategory } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import {
  catalogAliasSafety,
  productAliasSafety,
  PRODUCT_CATALOG,
} from "../classification/product-catalog";
import { ClassificationInsightsResponse, CoverageFunnelStep } from "./classification-insights.types";

type CompactAliasAggregate = {
  matchedPhrase: string;
  modelName: string;
  count: bigint | number;
  latestEvidenceAt: Date | null;
};

const activeConversation = { store: { archivedAt: null } } as const;
const textEligibleConversation = {
  ...activeConversation,
  messages: { some: { direction: "INBOUND" as const, messageType: "TEXT" as const } },
};
const opportunityIntents = [PurchaseIntent.HIGH, PurchaseIntent.MEDIUM, PurchaseIntent.AFTER_SALES];
const opportunityIntentSet = new Set<PurchaseIntent>(opportunityIntents);
const relevantTopicCategories = [
  TopicCategory.SALES,
  TopicCategory.PRODUCT_FEATURE,
  TopicCategory.PURCHASE_JOURNEY,
  TopicCategory.AFTER_SALES,
];
const relevantTopicCategorySet = new Set<TopicCategory>(relevantTopicCategories);

function percentage(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 10_000) / 100;
}

function funnelStep(
  key: CoverageFunnelStep["key"],
  count: number,
  eligible: number,
): CoverageFunnelStep {
  return { key, count, percentageOfEligible: percentage(count, eligible) };
}

@Injectable()
export class ClassificationInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async getInsights(): Promise<ClassificationInsightsResponse> {
    const [
      totalConversations,
      textEligibleConversations,
      classifiedConversations,
      ruleClassified,
      manualClassified,
      mixedSource,
      noProduct,
      highIntentWithoutProduct,
      opportunityByIntent,
      productCounts,
      productSourceCounts,
      compactModelCounts,
      compactAliasRows,
      totalCompactMatches,
      totalRuleMatches,
      reviewRows,
      activeModels,
      inactiveModels,
      activeAliases,
      inactiveAliases,
      catalogAliases,
      manualAliases,
      modelsWithoutActiveCatalogAliases,
    ] = await Promise.all([
      this.prisma.conversation.count({ where: activeConversation }),
      this.prisma.conversation.count({ where: textEligibleConversation }),
      this.prisma.conversation.count({
        where: { ...textEligibleConversation, products: { some: {} } },
      }),
      this.prisma.conversation.count({
        where: { ...textEligibleConversation, products: { some: { source: "RULE" } } },
      }),
      this.prisma.conversation.count({
        where: { ...textEligibleConversation, products: { some: { source: "MANUAL" } } },
      }),
      this.prisma.conversation.count({
        where: {
          ...textEligibleConversation,
          AND: [
            { products: { some: { source: "RULE" } } },
            { products: { some: { source: "MANUAL" } } },
          ],
        },
      }),
      this.prisma.conversation.count({
        where: { ...textEligibleConversation, products: { none: {} } },
      }),
      this.prisma.conversation.count({
        where: {
          ...textEligibleConversation,
          products: { none: {} },
          purchaseIntent: PurchaseIntent.HIGH,
        },
      }),
      this.prisma.conversation.groupBy({
        by: ["purchaseIntent"],
        where: {
          ...textEligibleConversation,
          products: { none: {} },
          purchaseIntent: { in: opportunityIntents },
        },
        _count: { _all: true },
        orderBy: { purchaseIntent: "asc" },
      }),
      this.prisma.conversationProduct.groupBy({
        by: ["productModelId"],
        where: { conversation: textEligibleConversation },
        _count: { _all: true },
        orderBy: { _count: { productModelId: "desc" } },
        take: 50,
      }),
      this.prisma.conversationProduct.groupBy({
        by: ["productModelId", "source"],
        where: { conversation: textEligibleConversation },
        _count: { _all: true },
        orderBy: [{ productModelId: "asc" }, { source: "asc" }],
      }),
      this.prisma.conversationProduct.groupBy({
        by: ["productModelId"],
        where: {
          conversation: textEligibleConversation,
          source: "RULE",
          detectionMethod: "COMPACT_VARIATION",
        },
        _count: { _all: true },
        orderBy: { productModelId: "asc" },
      }),
      this.compactAliasAggregates(),
      this.prisma.conversationProduct.count({
        where: {
          conversation: textEligibleConversation,
          source: "RULE",
          detectionMethod: "COMPACT_VARIATION",
        },
      }),
      this.prisma.conversationProduct.count({
        where: { conversation: textEligibleConversation, source: "RULE" },
      }),
      this.prisma.conversation.findMany({
        where: {
          ...textEligibleConversation,
          products: { none: {} },
          OR: [
            { purchaseIntent: { in: opportunityIntents } },
            { priority: { in: ["HIGH", "CRITICAL"] } },
            { topics: { some: { topic: { category: { in: relevantTopicCategories } } } } },
          ],
        },
        select: {
          id: true,
          latestMessageAt: true,
          priority: true,
          purchaseIntent: true,
          store: { select: { id: true, name: true } },
          lineOfficialAccount: { select: { id: true, name: true } },
          topics: { select: { topic: { select: { name: true, category: true } } } },
        },
        orderBy: [{ priority: "desc" }, { latestMessageAt: "desc" }],
        take: 25,
      }),
      this.prisma.productModel.count({ where: { isActive: true } }),
      this.prisma.productModel.count({ where: { isActive: false } }),
      this.prisma.productAlias.count({ where: { isActive: true } }),
      this.prisma.productAlias.count({ where: { isActive: false } }),
      this.prisma.productAlias.count({ where: { source: ProductAliasSource.CATALOG } }),
      this.prisma.productAlias.count({ where: { source: ProductAliasSource.MANUAL } }),
      this.prisma.productModel.count({
        where: {
          isActive: true,
          aliases: { none: { isActive: true, source: ProductAliasSource.CATALOG } },
        },
      }),
    ]);

    const modelIds = productCounts.map(({ productModelId }) => productModelId);
    const models = modelIds.length
      ? await this.prisma.productModel.findMany({
          where: { id: { in: modelIds } },
          select: {
            id: true,
            name: true,
            productSeries: { select: { name: true, productGroup: true } },
          },
        })
      : [];
    const modelById = new Map(models.map((model) => [model.id, model]));
    const sourceCountByModel = new Map(
      productSourceCounts.map((row) => [
        `${row.productModelId}:${row.source ?? "UNKNOWN"}`,
        row._count._all,
      ]),
    );
    const compactCountByModel = new Map(
      compactModelCounts.map((row) => [row.productModelId, row._count._all]),
    );

    const safetyCounts = {
      SAFE_EXACT: 0,
      SAFE_COMPACT: 0,
      REVIEW_REQUIRED: 0,
      BLOCKED: 0,
    };
    for (const entry of PRODUCT_CATALOG) {
      for (const alias of entry.aliases) safetyCounts[catalogAliasSafety(alias)]++;
    }

    const coverageRate = percentage(classifiedConversations, textEligibleConversations) ?? 0;
    const funnel: CoverageFunnelStep[] = [
      funnelStep("ACTIVE_CONVERSATIONS", totalConversations, textEligibleConversations),
      funnelStep("TEXT_ELIGIBLE", textEligibleConversations, textEligibleConversations),
      funnelStep("CLASSIFIED", classifiedConversations, textEligibleConversations),
      funnelStep("RULE", ruleClassified, textEligibleConversations),
      funnelStep("MANUAL", manualClassified, textEligibleConversations),
      funnelStep("NO_PRODUCT", noProduct, textEligibleConversations),
    ];

    return {
      generatedAt: new Date().toISOString(),
      definitions: {
        scope: "CURRENT_STATE",
        accuracyMeasured: false,
        eligibleDefinition: "Active-store conversations containing at least one inbound text message.",
      },
      coverage: {
        totalConversations,
        textEligibleConversations,
        classifiedConversations,
        coverageRate,
        ruleClassified,
        manualClassified,
        mixedSource,
        noProduct,
        highIntentWithoutProduct,
      },
      funnel,
      productRanking: productCounts.flatMap((row) => {
        const model = modelById.get(row.productModelId);
        if (!model) return [];
        return [{
          productModelId: model.id,
          modelName: model.name,
          familyName: model.productSeries.name,
          productGroup: model.productSeries.productGroup,
          conversationCount: row._count._all,
          ruleCount: sourceCountByModel.get(`${model.id}:RULE`) ?? 0,
          manualCount: sourceCountByModel.get(`${model.id}:MANUAL`) ?? 0,
          compactCount: compactCountByModel.get(model.id) ?? 0,
        }];
      }),
      reviewQueue: reviewRows.map((row) => {
        const commercialTopic = row.topics.some(({ topic }) =>
          relevantTopicCategorySet.has(topic.category),
        );
        const reasonCodes = [
          ...(row.purchaseIntent && opportunityIntentSet.has(row.purchaseIntent)
            ? [row.purchaseIntent === PurchaseIntent.AFTER_SALES
              ? "AFTER_SALES_WITHOUT_PRODUCT"
              : "HIGH_PURCHASE_INTENT"]
            : []),
          ...(["HIGH", "CRITICAL"].includes(row.priority) ? ["HIGH_PRIORITY"] : []),
          ...(commercialTopic ? ["COMMERCIAL_TOPIC"] : []),
        ];
        return {
          conversationId: row.id,
          store: row.store,
          lineOa: row.lineOfficialAccount,
          latestMessageAt: row.latestMessageAt.toISOString(),
          priority: row.priority,
          purchaseIntent: row.purchaseIntent,
          topics: row.topics.map(({ topic }) => topic.name),
          reasonCodes: [...new Set(reasonCodes)],
        };
      }),
      compactMonitoring: {
        totalCompactMatches,
        percentageOfRuleMatches: percentage(totalCompactMatches, totalRuleMatches),
        aliases: compactAliasRows.map((row) => ({
          matchedPhrase: row.matchedPhrase,
          modelName: row.modelName,
          safetyClass: productAliasSafety(row.modelName, row.matchedPhrase),
          count: Number(row.count),
          latestEvidenceAt: row.latestEvidenceAt?.toISOString() ?? null,
        })),
      },
      catalogHealth: {
        activeModels,
        inactiveModels,
        activeAliases,
        inactiveAliases,
        catalogAliases,
        manualAliases,
        modelsWithoutActiveCatalogAliases,
        safeExactDeclarations: safetyCounts.SAFE_EXACT,
        safeCompactDeclarations: safetyCounts.SAFE_COMPACT,
        reviewRequiredDeclarations: safetyCounts.REVIEW_REQUIRED,
        blockedDeclarations: safetyCounts.BLOCKED,
      },
      opportunityGap: {
        highIntentWithoutProduct,
        byIntent: Object.fromEntries(
          opportunityByIntent
            .filter(({ purchaseIntent }) => purchaseIntent)
            .map(({ purchaseIntent, _count }) => [purchaseIntent as string, _count._all]),
        ),
      },
    };
  }

  private compactAliasAggregates(): Prisma.PrismaPromise<CompactAliasAggregate[]> {
    return this.prisma.$queryRaw<CompactAliasAggregate[]>(Prisma.sql`
      SELECT
        cp."matchedPhrase" AS "matchedPhrase",
        pm."name" AS "modelName",
        COUNT(*)::int AS "count",
        MAX(m."sentAt") AS "latestEvidenceAt"
      FROM "ConversationProduct" cp
      JOIN "Conversation" c ON c."id" = cp."conversationId"
      JOIN "Store" s ON s."id" = c."storeId"
      JOIN "ProductModel" pm ON pm."id" = cp."productModelId"
      LEFT JOIN "Message" m ON m."id" = cp."sourceMessageId"
      WHERE cp."source" = 'RULE'
        AND cp."detectionMethod" = 'COMPACT_VARIATION'
        AND cp."matchedPhrase" IS NOT NULL
        AND s."archivedAt" IS NULL
        AND EXISTS (
          SELECT 1
          FROM "Message" eligible_message
          WHERE eligible_message."conversationId" = c."id"
            AND eligible_message."direction" = 'INBOUND'
            AND eligible_message."messageType" = 'TEXT'
        )
      GROUP BY cp."matchedPhrase", pm."name"
      ORDER BY COUNT(*) DESC, cp."matchedPhrase" ASC
      LIMIT 50
    `);
  }
}
