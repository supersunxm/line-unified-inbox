import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

export type ProductReviewReason =
  | "UNCLASSIFIED"
  | "AMBIGUOUS"
  | "LOW_CONFIDENCE"
  | "SERIES_ONLY"
  | "RECENTLY_CORRECTED"
  | "GOOD";

export type ProductReviewPriority = "P0" | "P1" | "P2" | "P3" | "P4" | "P5";

export type PredictedProductDetail = {
  productModelId: string;
  productModelName: string;
  confidence: number | null;
  source: string;
  detectionMethod: string | null;
  matchedPhrase: string | null;
};

export type ProductReviewQueueItem = {
  conversationId: string;
  customerName: string;
  storeId: string;
  storeName: string;
  latestInboundText: string;
  predictedProducts: PredictedProductDetail[];
  reviewReason: ProductReviewReason;
  reviewPriority: ProductReviewPriority;
  createdAt: Date;
  latestMessageAt: Date | null;
};

export type ProductReviewQueueSummary = {
  totalNeedsReview: number;
  unclassified: number;
  lowConfidence: number;
  ambiguous: number;
  seriesOnly: number;
  recentlyCorrected: number;
  good: number;
  reviewedTotal: number;
  confirmedCount: number;
  correctedCount: number;
  noProductCount: number;
  observedAccuracyPct: number | null;
  hasSufficientData: boolean;
};

export type ProductReviewQueueResponse = {
  summary: ProductReviewQueueSummary;
  items: ProductReviewQueueItem[];
  page: number;
  pageSize: number;
  total: number;
};

export type ConfirmProductReviewDto = {
  conversationId: string;
  productModelId?: string;
  createdByName?: string;
};

export type CorrectProductReviewDto = {
  conversationId: string;
  productModelId: string;
  createdByName?: string;
};

export type NoProductReviewDto = {
  conversationId: string;
  createdByName?: string;
};

@Injectable()
export class ProductReviewQueueService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Determine deterministic review reason and priority for a single conversation.
   */
  classifyReviewNeed(
    products: Array<{
      productModelId: string;
      productModel: { name: string };
      confidence: number | null;
      source: string | null;
      detectionMethod: string | null;
      matchedPhrase: string | null;
    }>,
    activities: Array<{ description: string | null }>,
    hasInboundText: boolean,
  ): { reason: ProductReviewReason; priority: ProductReviewPriority } {
    if (!hasInboundText) {
      return { reason: "GOOD", priority: "P5" };
    }

    const hasNoProductConfirmed = activities.some(
      (a) => a.description?.startsWith("No product confirmed:") || a.description?.includes("no product confirmed"),
    );

    const hasManualTag = products.some((p) => p.source === "MANUAL");
    const hasTagConfirmed = activities.some((a) => a.description?.startsWith("Product tag confirmed:"));

    if (hasNoProductConfirmed || hasManualTag || hasTagConfirmed) {
      return { reason: "RECENTLY_CORRECTED", priority: "P4" };
    }

    if (products.length === 0) {
      return { reason: "UNCLASSIFIED", priority: "P0" };
    }

    if (products.length > 1) {
      return { reason: "AMBIGUOUS", priority: "P1" };
    }

    const single = products[0];
    const modelName = single.productModel.name;
    const isSeries =
      modelName.endsWith("Series") ||
      modelName.includes("Series") ||
      modelName === "OPPO Smartphone" ||
      single.detectionMethod === "SERIES_MATCH";

    if (isSeries) {
      return { reason: "SERIES_ONLY", priority: "P3" };
    }

    const isLowConfidence =
      (single.confidence !== null && single.confidence < 0.85) ||
      single.detectionMethod === "COMPACT_ALIAS";

    if (isLowConfidence) {
      return { reason: "LOW_CONFIDENCE", priority: "P2" };
    }

    return { reason: "GOOD", priority: "P5" };
  }

  /**
   * Fetch review queue items and summary metrics.
   */
  async getReviewQueue(filters: {
    storeId?: string;
    reason?: string;
    productModelId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<ProductReviewQueueResponse> {
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(filters.pageSize) || 20));

    // 1. Fetch conversations with relevant relations
    const conversations = await this.prisma.conversation.findMany({
      where: {
        ...(filters.storeId ? { storeId: filters.storeId } : {}),
      },
      include: {
        store: { select: { id: true, name: true } },
        lineOfficialAccount: { select: { id: true, name: true } },
        customer: { select: { displayName: true } },
        messages: {
          where: { direction: "INBOUND" },
          select: { id: true, originalText: true, sentAt: true },
          orderBy: { sentAt: "desc" },
        },
        products: {
          include: { productModel: { select: { id: true, name: true } } },
        },
        activityHistory: {
          where: { actionType: "CLASSIFICATION_UPDATED" },
          select: { description: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    let unclassifiedCount = 0;
    let ambiguousCount = 0;
    let lowConfidenceCount = 0;
    let seriesOnlyCount = 0;
    let recentlyCorrectedCount = 0;
    let goodCount = 0;

    const allItems: ProductReviewQueueItem[] = [];

    for (const conv of conversations) {
      const inboundMessages = conv.messages.filter((m) => Boolean(m.originalText?.trim()));
      const hasInboundText = inboundMessages.length > 0;
      const latestInboundText = inboundMessages[0]?.originalText?.trim() ?? "";

      const { reason, priority } = this.classifyReviewNeed(
        conv.products,
        conv.activityHistory,
        hasInboundText,
      );

      if (reason === "UNCLASSIFIED") unclassifiedCount++;
      else if (reason === "AMBIGUOUS") ambiguousCount++;
      else if (reason === "LOW_CONFIDENCE") lowConfidenceCount++;
      else if (reason === "SERIES_ONLY") seriesOnlyCount++;
      else if (reason === "RECENTLY_CORRECTED") recentlyCorrectedCount++;
      else if (reason === "GOOD") goodCount++;

      const predictedProducts: PredictedProductDetail[] = conv.products.map((p) => ({
        productModelId: p.productModelId,
        productModelName: p.productModel.name,
        confidence: p.confidence,
        source: p.source ?? "RULE",
        detectionMethod: p.detectionMethod,
        matchedPhrase: p.matchedPhrase,
      }));

      // Filter by productModelId if requested
      if (filters.productModelId && !predictedProducts.some((p) => p.productModelId === filters.productModelId)) {
        continue;
      }

      allItems.push({
        conversationId: conv.id,
        customerName: conv.customer?.displayName ?? "OPPO Customer",
        storeId: conv.storeId ?? "",
        storeName: conv.store?.name ?? "Main OA",
        latestInboundText,
        predictedProducts,
        reviewReason: reason,
        reviewPriority: priority,
        createdAt: conv.createdAt,
        latestMessageAt: conv.messages[0]?.sentAt ?? null,
      });
    }

    // 2. Count human verification metrics from ActivityHistory
    const allActivities = await this.prisma.activityHistory.findMany({
      where: {
        actionType: "CLASSIFICATION_UPDATED",
        ...(filters.storeId ? { conversation: { storeId: filters.storeId } } : {}),
      },
      select: { description: true },
    });

    let confirmedCount = 0;
    let correctedCount = 0;
    let noProductCount = 0;

    for (const act of allActivities) {
      if (!act.description) continue;
      if (act.description.startsWith("Product tag confirmed:")) confirmedCount++;
      else if (act.description.startsWith("Manual product correction:")) correctedCount++;
      else if (act.description.startsWith("No product confirmed:")) noProductCount++;
    }

    const reviewedTotal = confirmedCount + correctedCount + noProductCount;
    const verifiedSamples = confirmedCount + correctedCount;
    const minimumForReliability = 10;
    const hasSufficientData = verifiedSamples >= minimumForReliability;
    const observedAccuracyPct = hasSufficientData
      ? Math.round((confirmedCount / verifiedSamples) * 100 * 10) / 10
      : null;

    const totalNeedsReview = unclassifiedCount + ambiguousCount + lowConfidenceCount + seriesOnlyCount;

    const summary: ProductReviewQueueSummary = {
      totalNeedsReview,
      unclassified: unclassifiedCount,
      lowConfidence: lowConfidenceCount,
      ambiguous: ambiguousCount,
      seriesOnly: seriesOnlyCount,
      recentlyCorrected: recentlyCorrectedCount,
      good: goodCount,
      reviewedTotal,
      confirmedCount,
      correctedCount,
      noProductCount,
      observedAccuracyPct,
      hasSufficientData,
    };

    // 3. Filter items by requested review reason
    let filteredItems = allItems;
    if (filters.reason && filters.reason !== "ALL" && filters.reason !== "ALL_NEEDS_REVIEW") {
      filteredItems = allItems.filter((item) => item.reviewReason === filters.reason);
    } else if (!filters.reason || filters.reason === "ALL_NEEDS_REVIEW") {
      // Default view: all items that actually need review (P0, P1, P2, P3)
      filteredItems = allItems.filter((item) =>
        ["UNCLASSIFIED", "AMBIGUOUS", "LOW_CONFIDENCE", "SERIES_ONLY"].includes(item.reviewReason),
      );
    }

    // Sort by priority (P0 -> P1 -> P2 -> P3 -> P4 -> P5) and then latest message time desc
    const priorityOrder: Record<ProductReviewPriority, number> = {
      P0: 0,
      P1: 1,
      P2: 2,
      P3: 3,
      P4: 4,
      P5: 5,
    };

    filteredItems.sort((a, b) => {
      const pDiff = priorityOrder[a.reviewPriority] - priorityOrder[b.reviewPriority];
      if (pDiff !== 0) return pDiff;
      const aTime = a.latestMessageAt?.getTime() ?? 0;
      const bTime = b.latestMessageAt?.getTime() ?? 0;
      return bTime - aTime;
    });

    const total = filteredItems.length;
    const paginatedItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);

    return {
      summary,
      items: paginatedItems,
      page,
      pageSize,
      total,
    };
  }

  /**
   * Action A: Confirm current RULE product tag.
   */
  async confirmProduct(dto: ConfirmProductReviewDto) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
      include: {
        products: { include: { productModel: { select: { name: true } } } },
      },
    });

    if (!conv) {
      throw new NotFoundException(`Conversation "${dto.conversationId}" not found.`);
    }

    if (conv.products.length === 0) {
      throw new BadRequestException("Cannot confirm product on a conversation with no predicted products.");
    }

    const modelNames = conv.products.map((p) => p.productModel.name).join(", ");

    // Update all RULE tags on this conversation to MANUAL so they are permanently protected
    await this.prisma.$transaction(async (tx) => {
      await tx.conversationProduct.updateMany({
        where: { conversationId: dto.conversationId },
        data: { source: "MANUAL", confidence: 1.0 },
      });

      await tx.activityHistory.create({
        data: {
          conversationId: dto.conversationId,
          actionType: "CLASSIFICATION_UPDATED",
          description: `Product tag confirmed: ${modelNames}`,
          createdByName: dto.createdByName ?? "OPPO Retail Operations",
        },
      });
    });

    return {
      success: true,
      conversationId: dto.conversationId,
      action: "CONFIRM",
      confirmedProducts: modelNames,
    };
  }

  /**
   * Action B: Correct product tag to a new ProductModel.
   */
  async correctProduct(dto: CorrectProductReviewDto) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
      include: {
        products: { include: { productModel: { select: { id: true, name: true } } } },
      },
    });

    if (!conv) {
      throw new NotFoundException(`Conversation "${dto.conversationId}" not found.`);
    }

    const newModel = await this.prisma.productModel.findUnique({
      where: { id: dto.productModelId },
      select: { id: true, name: true },
    });

    if (!newModel) {
      throw new NotFoundException(`Product model "${dto.productModelId}" not found.`);
    }

    const priorRuleProducts = conv.products.filter((p) => p.source === "RULE");
    const priorNames = conv.products.map((p) => p.productModel.name).join(", ") || "None";
    const prior = priorRuleProducts[0];
    const phrase = prior?.matchedPhrase ? `phrase: "${prior.matchedPhrase}"` : "";
    const method = prior?.detectionMethod ? `method: "${prior.detectionMethod}"` : "";
    const srcMsg = prior?.sourceMessageId ? `sourceMessageId: "${prior.sourceMessageId}"` : "";
    const metaParts = [phrase, method, srcMsg].filter(Boolean).join(", ");

    await this.prisma.$transaction(async (tx) => {
      // Clean up previous products
      await tx.conversationProduct.deleteMany({
        where: { conversationId: dto.conversationId },
      });

      // Upsert new MANUAL tag
      await tx.conversationProduct.create({
        data: {
          conversationId: dto.conversationId,
          productModelId: newModel.id,
          source: "MANUAL",
          confidence: 1.0,
        },
      });

      // Record structured correction in ActivityHistory
      await tx.activityHistory.create({
        data: {
          conversationId: dto.conversationId,
          actionType: "CLASSIFICATION_UPDATED",
          description: `Manual product correction: ${priorNames} → ${newModel.name}${metaParts ? ` (${metaParts})` : ""}`,
          createdByName: dto.createdByName ?? "OPPO Retail Operations",
        },
      });
    });

    return {
      success: true,
      conversationId: dto.conversationId,
      action: "CORRECT",
      priorModel: priorNames,
      newModel: newModel.name,
    };
  }

  /**
   * Action C: Confirm NO product in this conversation.
   */
  async confirmNoProduct(dto: NoProductReviewDto) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
      include: {
        products: { include: { productModel: { select: { name: true } } } },
      },
    });

    if (!conv) {
      throw new NotFoundException(`Conversation "${dto.conversationId}" not found.`);
    }

    const priorNames = conv.products.map((p) => p.productModel.name).join(", ");

    await this.prisma.$transaction(async (tx) => {
      // Remove all product tags
      await tx.conversationProduct.deleteMany({
        where: { conversationId: dto.conversationId },
      });

      // Record no-product confirmation
      await tx.activityHistory.create({
        data: {
          conversationId: dto.conversationId,
          actionType: "CLASSIFICATION_UPDATED",
          description: `No product confirmed: human verified no product mentioned${priorNames ? ` (prior: ${priorNames})` : ""}`,
          createdByName: dto.createdByName ?? "OPPO Retail Operations",
        },
      });
    });

    return {
      success: true,
      conversationId: dto.conversationId,
      action: "NO_PRODUCT",
      priorModel: priorNames || null,
    };
  }
}
