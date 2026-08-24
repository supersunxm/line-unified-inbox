import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { ProductAliasSource } from "@prisma/client";
import { ClassificationService } from "./classification.service";
import { PRODUCT_CATALOG, synchronizableCatalogAliases } from "./product-catalog";
import { compactProductText, normalizeProductText } from "./product-normalization";

export type ProductCorrectionEvent = {
  conversationId: string;
  predictedModel: string;
  correctedModel: string;
  matchedPhrase: string | null;
  detectionMethod: string | null;
  sourceMessageId: string | null;
  sampleText: string | null;
  correctedAt: Date;
  actorName: string | null;
  storeId?: string;
  storeName?: string;
};

export type AggregatedCorrectionPattern = {
  phrase: string;
  predictedModel: string;
  correctedModel: string;
  correctionCount: number;
  affectedConversations: string[];
  firstSeen: Date;
  lastSeen: Date;
  sampleTexts: string[];
  storeNames: string[];
  detectionMethods: string[];
};

export type AliasPreparedPayload = {
  model: string;
  alias: string;
  language: string;
  safety: "SAFE_EXACT";
};

export type AliasRecommendationStatus = "SUGGESTED" | "APPROVED" | "REJECTED";

export type AliasRecommendation = {
  phrase: string;
  recommendedModel: string;
  corrections: number;
  totalPhraseCorrections: number;
  dominancePct: number;
  collisionRisk: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  riskReason?: string;
  recommendation: "ADD_ALIAS" | "REVIEW" | "IGNORE";
  status: AliasRecommendationStatus;
  statusReason: string;
  firstSeen: Date;
  lastSeen: Date;
  affectedConversationsCount: number;
  sampleTexts: string[];
  preparedPayload?: AliasPreparedPayload;
};

export type ProductCorrectionInsightResponse = {
  generatedAt: Date;
  totalManualCorrections: number;
  uniqueCorrectedConversations: number;
  mostCorrectedProducts: Array<{ productModel: string; corrections: number }>;
  mostProblematicPredictedProducts: Array<{ productModel: string; corrections: number }>;
  mostProblematicPhrases: Array<{ phrase: string; corrections: number; topCorrectedModel: string }>;
  correctionPatterns: AggregatedCorrectionPattern[];
  aliasRecommendations: AliasRecommendation[];
  dataSufficiency: {
    hasSufficientData: boolean;
    currentSamples: number;
    minimumRequired: number;
    message: string;
  };
};

export type ApproveAliasResponse = {
  success: boolean;
  phrase: string;
  model: string;
  status: "APPROVED";
  normalizedAlias: string;
  affectedConversationsCount: number;
};

export type RejectAliasResponse = {
  success: boolean;
  phrase: string;
  model: string;
  status: "REJECTED";
  reason: string;
};

export type TargetedReanalysisResponse = {
  phrase: string;
  scanned: number;
  changed: number;
  unchanged: number;
  manualProtected: number;
  failed: number;
};

const BLOCKED_OR_NEGATIVE_PHRASES = new Set([
  "16 pro max",
  "iphone",
  "samsung",
  "xiaomi",
  "vivo",
  "huawei",
  "apple watch",
  "ipad",
  "pad thai",
  "generic case",
  "generic film",
  "screen protector",
  "type c cable",
  "generic smartwatch",
  "generic power bank",
  "generic smart home",
  "tp-link router",
  "renovation project",
  "เครื่อง 5g",
  "5g",
  "pro",
  "a6",
  "a",
  "pad",
  "watch",
  "air4",
  "x2",
]);

@Injectable()
export class ProductCorrectionInsightService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classificationService: ClassificationService,
  ) {}

  /**
   * Parse description text from ActivityHistory into structured correction fields.
   */
  parseCorrectionDescription(description: string): {
    predictedModel: string;
    correctedModel: string;
    matchedPhrase: string | null;
    detectionMethod: string | null;
    sourceMessageId: string | null;
  } | null {
    if (!description.startsWith("Manual product correction:")) return null;

    // Pattern: "Manual product correction: [prior] → [new] (phrase: "[phrase]", method: "[method]", sourceMessageId: "[id]")"
    const match = description.match(/^Manual product correction:\s*(.+?)\s*→\s*(.+?)(?:\s*\((.+?)\))?$/);
    if (!match) return null;

    const [, predictedModel, correctedModel, metaString] = match;
    let matchedPhrase: string | null = null;
    let detectionMethod: string | null = null;
    let sourceMessageId: string | null = null;

    if (metaString) {
      const phraseMatch = metaString.match(/phrase:\s*"([^"]+)"/);
      if (phraseMatch) matchedPhrase = phraseMatch[1];

      const methodMatch = metaString.match(/method:\s*"([^"]+)"/);
      if (methodMatch) detectionMethod = methodMatch[1];

      const srcMsgMatch = metaString.match(/sourceMessageId:\s*"([^"]+)"/);
      if (srcMsgMatch) sourceMessageId = srcMsgMatch[1];
    }

    return {
      predictedModel: predictedModel.trim(),
      correctedModel: correctedModel.trim(),
      matchedPhrase,
      detectionMethod,
      sourceMessageId,
    };
  }

  /**
   * Extract all raw structured correction events from ActivityHistory + Conversation data.
   */
  async extractCorrectionEvents(storeId?: string): Promise<ProductCorrectionEvent[]> {
    const activities = await this.prisma.activityHistory.findMany({
      where: {
        actionType: "CLASSIFICATION_UPDATED",
        description: { startsWith: "Manual product correction:" },
        ...(storeId ? { conversation: { storeId } } : {}),
      },
      include: {
        conversation: {
          select: {
            storeId: true,
            store: { select: { name: true } },
            messages: {
              where: { direction: "INBOUND" },
              select: { id: true, originalText: true, sentAt: true },
              orderBy: { sentAt: "desc" },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const events: ProductCorrectionEvent[] = [];

    for (const act of activities) {
      if (!act.description) continue;
      const parsed = this.parseCorrectionDescription(act.description);
      if (!parsed) continue;

      let sampleText: string | null = null;
      if (parsed.sourceMessageId) {
        const found = act.conversation.messages.find((m) => m.id === parsed.sourceMessageId);
        if (found?.originalText) sampleText = found.originalText;
      }
      if (!sampleText && act.conversation.messages.length > 0) {
        sampleText = act.conversation.messages[0].originalText;
      }

      events.push({
        conversationId: act.conversationId,
        predictedModel: parsed.predictedModel,
        correctedModel: parsed.correctedModel,
        matchedPhrase: parsed.matchedPhrase,
        detectionMethod: parsed.detectionMethod,
        sourceMessageId: parsed.sourceMessageId,
        sampleText,
        correctedAt: act.createdAt,
        actorName: act.createdByName,
        storeId: act.conversation.storeId ?? undefined,
        storeName: act.conversation.store?.name,
      });
    }

    return events;
  }

  /**
   * Group correction events by matched phrase, predicted model, and corrected model.
   */
  aggregateCorrectionPatterns(events: ProductCorrectionEvent[]): AggregatedCorrectionPattern[] {
    const patternMap = new Map<string, AggregatedCorrectionPattern>();

    for (const ev of events) {
      const phraseKey = (ev.matchedPhrase ?? "unknown").trim().toLowerCase();
      const key = `${phraseKey}::${ev.predictedModel}::${ev.correctedModel}`;
      const existing = patternMap.get(key);

      if (existing) {
        existing.correctionCount++;
        if (!existing.affectedConversations.includes(ev.conversationId)) {
          existing.affectedConversations.push(ev.conversationId);
        }
        if (ev.correctedAt < existing.firstSeen) existing.firstSeen = ev.correctedAt;
        if (ev.correctedAt > existing.lastSeen) existing.lastSeen = ev.correctedAt;
        if (ev.sampleText && !existing.sampleTexts.includes(ev.sampleText) && existing.sampleTexts.length < 5) {
          existing.sampleTexts.push(ev.sampleText);
        }
        if (ev.storeName && !existing.storeNames.includes(ev.storeName)) {
          existing.storeNames.push(ev.storeName);
        }
        if (ev.detectionMethod && !existing.detectionMethods.includes(ev.detectionMethod)) {
          existing.detectionMethods.push(ev.detectionMethod);
        }
      } else {
        patternMap.set(key, {
          phrase: ev.matchedPhrase ?? "unknown",
          predictedModel: ev.predictedModel,
          correctedModel: ev.correctedModel,
          correctionCount: 1,
          affectedConversations: [ev.conversationId],
          firstSeen: ev.correctedAt,
          lastSeen: ev.correctedAt,
          sampleTexts: ev.sampleText ? [ev.sampleText] : [],
          storeNames: ev.storeName ? [ev.storeName] : [],
          detectionMethods: ev.detectionMethod ? [ev.detectionMethod] : [],
        });
      }
    }

    return [...patternMap.values()].sort((a, b) => b.correctionCount - a.correctionCount);
  }

  /**
   * Build alias recommendations based on aggregated correction evidence.
   */
  async buildAliasRecommendations(
    events: ProductCorrectionEvent[],
  ): Promise<AliasRecommendation[]> {
    // 1. Fetch active aliases and models from DB + CATALOG for collision/existence checking
    const existingDbAliases = await this.prisma.productAlias.findMany({
      where: { isActive: true },
      include: { productModel: true },
    });

    const activeAliasSet = new Set<string>();
    const aliasModelMap = new Map<string, string>();

    for (const a of existingDbAliases) {
      const norm = a.normalizedAlias.toLowerCase();
      activeAliasSet.add(norm);
      aliasModelMap.set(norm, a.productModel.name);
    }

    for (const entry of PRODUCT_CATALOG) {
      for (const { alias } of synchronizableCatalogAliases(entry)) {
        const norm = compactProductText(alias).toLowerCase();
        activeAliasSet.add(norm);
        aliasModelMap.set(norm, entry.model);
      }
    }

    // 2. Fetch rejection history from ActivityHistory
    const rejectionActivities = await this.prisma.activityHistory.findMany({
      where: {
        actionType: "CLASSIFICATION_UPDATED",
        description: { startsWith: "Alias rejected:" },
      },
      select: { description: true },
    });

    const rejectedPhrases = new Set<string>();
    for (const act of rejectionActivities) {
      if (!act.description) continue;
      const m = act.description.match(/Alias rejected:\s*"([^"]+)"/);
      if (m) rejectedPhrases.add(compactProductText(m[1]).toLowerCase());
    }

    // 3. Group all corrections by phrase to calculate dominance across target models
    const phraseTotals = new Map<string, number>();
    const phraseModelCounts = new Map<string, Map<string, number>>();
    const phraseTimestamps = new Map<string, { firstSeen: Date; lastSeen: Date }>();
    const phraseSamples = new Map<string, Set<string>>();
    const phraseAffectedConvs = new Map<string, Set<string>>();

    for (const ev of events) {
      const phrase = (ev.matchedPhrase ?? "").trim();
      if (!phrase || phrase === "unknown") continue;

      const normPhrase = phrase.toLowerCase();
      phraseTotals.set(normPhrase, (phraseTotals.get(normPhrase) ?? 0) + 1);

      if (!phraseModelCounts.has(normPhrase)) {
        phraseModelCounts.set(normPhrase, new Map());
      }
      const modelCounts = phraseModelCounts.get(normPhrase)!;
      modelCounts.set(ev.correctedModel, (modelCounts.get(ev.correctedModel) ?? 0) + 1);

      const ts = phraseTimestamps.get(normPhrase);
      if (ts) {
        if (ev.correctedAt < ts.firstSeen) ts.firstSeen = ev.correctedAt;
        if (ev.correctedAt > ts.lastSeen) ts.lastSeen = ev.correctedAt;
      } else {
        phraseTimestamps.set(normPhrase, { firstSeen: ev.correctedAt, lastSeen: ev.correctedAt });
      }

      if (!phraseSamples.has(normPhrase)) phraseSamples.set(normPhrase, new Set());
      if (ev.sampleText) phraseSamples.get(normPhrase)!.add(ev.sampleText);

      if (!phraseAffectedConvs.has(normPhrase)) phraseAffectedConvs.set(normPhrase, new Set());
      phraseAffectedConvs.get(normPhrase)!.add(ev.conversationId);
    }

    const recommendations: AliasRecommendation[] = [];

    for (const [normPhrase, totalCorrections] of phraseTotals.entries()) {
      const modelCounts = phraseModelCounts.get(normPhrase)!;
      let dominantModel = "";
      let dominantCount = 0;

      for (const [model, count] of modelCounts.entries()) {
        if (count > dominantCount) {
          dominantCount = count;
          dominantModel = model;
        }
      }

      const dominancePct = Math.round((dominantCount / totalCorrections) * 100 * 10) / 10;
      const timestamps = phraseTimestamps.get(normPhrase) ?? { firstSeen: new Date(), lastSeen: new Date() };
      const compactKey = compactProductText(normPhrase).toLowerCase();
      const samples = [...(phraseSamples.get(normPhrase) ?? [])].slice(0, 5);
      const affectedCount = (phraseAffectedConvs.get(normPhrase) ?? new Set()).size;

      // Check collision risk
      let collisionRisk: "NONE" | "LOW" | "MEDIUM" | "HIGH" = "NONE";
      let riskReason: string | undefined;

      const hasReno = /\b(reno|รีโน|เรโน)\b/i.test(normPhrase);
      const hasFind = /\b(find|ไฟน์)\b/i.test(normPhrase);
      const hasAseries = /\b(a6|a6pro|เอ6)\b/i.test(normPhrase);
      const seriesKeywordCount = [hasReno, hasFind, hasAseries].filter(Boolean).length;

      if (seriesKeywordCount > 1) {
        collisionRisk = "HIGH";
        riskReason = "Phrase contains conflicting model family tokens (e.g. Reno and Find).";
      }

      // Check if already approved & active
      if (activeAliasSet.has(compactKey) || activeAliasSet.has(normPhrase)) {
        recommendations.push({
          phrase: normPhrase,
          recommendedModel: dominantModel,
          corrections: dominantCount,
          totalPhraseCorrections: totalCorrections,
          dominancePct,
          collisionRisk: "NONE",
          status: "APPROVED",
          statusReason: `Phrase is already an active catalog alias for ${aliasModelMap.get(compactKey) ?? dominantModel}.`,
          recommendation: "IGNORE",
          firstSeen: timestamps.firstSeen,
          lastSeen: timestamps.lastSeen,
          affectedConversationsCount: affectedCount,
          sampleTexts: samples,
        });
        continue;
      }

      // Check if rejected previously
      if (rejectedPhrases.has(compactKey)) {
        recommendations.push({
          phrase: normPhrase,
          recommendedModel: dominantModel,
          corrections: dominantCount,
          totalPhraseCorrections: totalCorrections,
          dominancePct,
          collisionRisk: "NONE",
          status: "REJECTED",
          statusReason: "Alias was previously reviewed and rejected by operator.",
          recommendation: "IGNORE",
          firstSeen: timestamps.firstSeen,
          lastSeen: timestamps.lastSeen,
          affectedConversationsCount: affectedCount,
          sampleTexts: samples,
        });
        continue;
      }

      // Check if blocked or negative pattern
      if (BLOCKED_OR_NEGATIVE_PHRASES.has(normPhrase) || BLOCKED_OR_NEGATIVE_PHRASES.has(compactKey)) {
        recommendations.push({
          phrase: normPhrase,
          recommendedModel: dominantModel,
          corrections: dominantCount,
          totalPhraseCorrections: totalCorrections,
          dominancePct,
          collisionRisk: "HIGH",
          riskReason: "Phrase is in the protected/blocked negative catalog list.",
          status: "SUGGESTED",
          statusReason: "Blocked or review-required generic/competitor phrase.",
          recommendation: "IGNORE",
          firstSeen: timestamps.firstSeen,
          lastSeen: timestamps.lastSeen,
          affectedConversationsCount: affectedCount,
          sampleTexts: samples,
        });
        continue;
      }

      // Check collision with another model
      if (collisionRisk === "HIGH") {
        recommendations.push({
          phrase: normPhrase,
          recommendedModel: dominantModel,
          corrections: dominantCount,
          totalPhraseCorrections: totalCorrections,
          dominancePct,
          collisionRisk,
          riskReason,
          status: "SUGGESTED",
          statusReason: "High collision risk: requires human review before aliasing.",
          recommendation: "REVIEW",
          firstSeen: timestamps.firstSeen,
          lastSeen: timestamps.lastSeen,
          affectedConversationsCount: affectedCount,
          sampleTexts: samples,
        });
        continue;
      }

      // Rule check: correctionCount >= 3 and dominancePct >= 80%
      if (dominantCount >= 3 && dominancePct >= 80.0) {
        const isThai = /[\u0E00-\u0E7F]/.test(normPhrase);
        const preparedPayload: AliasPreparedPayload = {
          model: dominantModel,
          alias: normPhrase,
          language: isThai ? "th" : "en",
          safety: "SAFE_EXACT",
        };

        recommendations.push({
          phrase: normPhrase,
          recommendedModel: dominantModel,
          corrections: dominantCount,
          totalPhraseCorrections: totalCorrections,
          dominancePct,
          collisionRisk: "NONE",
          status: "SUGGESTED",
          statusReason: `Consistently corrected to ${dominantModel} (${dominantCount}/${totalCorrections} times, ${dominancePct}%).`,
          recommendation: "ADD_ALIAS",
          firstSeen: timestamps.firstSeen,
          lastSeen: timestamps.lastSeen,
          affectedConversationsCount: affectedCount,
          sampleTexts: samples,
          preparedPayload,
        });
      } else {
        const reason = totalCorrections >= 3 && dominancePct < 80.0
          ? `Corrections split across multiple models (${totalCorrections} total, dominance ${dominancePct}% < 80% threshold).`
          : `Insufficient evidence (${dominantCount}/3 required corrections).`;

        recommendations.push({
          phrase: normPhrase,
          recommendedModel: dominantModel,
          corrections: dominantCount,
          totalPhraseCorrections: totalCorrections,
          dominancePct,
          collisionRisk: totalCorrections >= 3 ? "MEDIUM" : "LOW",
          riskReason: totalCorrections >= 3 ? "Split correction targets indicate ambiguity." : undefined,
          status: "SUGGESTED",
          statusReason: reason,
          recommendation: "REVIEW",
          firstSeen: timestamps.firstSeen,
          lastSeen: timestamps.lastSeen,
          affectedConversationsCount: affectedCount,
          sampleTexts: samples,
        });
      }
    }

    return recommendations.sort((a, b) => b.corrections - a.corrections);
  }

  /**
   * Produce the complete Product Intelligence corrections & learning insight report.
   */
  async getInsights(storeId?: string): Promise<ProductCorrectionInsightResponse> {
    const events = await this.extractCorrectionEvents(storeId);
    const correctionPatterns = this.aggregateCorrectionPatterns(events);
    const aliasRecommendations = await this.buildAliasRecommendations(events);

    const uniqueCorrectedConversations = new Set(events.map((e) => e.conversationId)).size;

    const correctedModelCounts = new Map<string, number>();
    const predictedModelCounts = new Map<string, number>();
    const phraseCounts = new Map<string, { count: number; model: string }>();

    for (const ev of events) {
      correctedModelCounts.set(ev.correctedModel, (correctedModelCounts.get(ev.correctedModel) ?? 0) + 1);
      predictedModelCounts.set(ev.predictedModel, (predictedModelCounts.get(ev.predictedModel) ?? 0) + 1);

      const p = (ev.matchedPhrase ?? "unknown").trim();
      const existing = phraseCounts.get(p);
      if (existing) {
        existing.count++;
      } else {
        phraseCounts.set(p, { count: 1, model: ev.correctedModel });
      }
    }

    const mostCorrectedProducts = [...correctedModelCounts.entries()]
      .map(([productModel, corrections]) => ({ productModel, corrections }))
      .sort((a, b) => b.corrections - a.corrections);

    const mostProblematicPredictedProducts = [...predictedModelCounts.entries()]
      .map(([productModel, corrections]) => ({ productModel, corrections }))
      .sort((a, b) => b.corrections - a.corrections);

    const mostProblematicPhrases = [...phraseCounts.entries()]
      .map(([phrase, { count, model }]) => ({ phrase, corrections: count, topCorrectedModel: model }))
      .sort((a, b) => b.corrections - a.corrections)
      .slice(0, 20);

    const minimumRequired = 10;
    const currentSamples = events.length;
    const hasSufficientData = currentSamples >= minimumRequired;

    const message = hasSufficientData
      ? `Sufficient production correction data accumulated (${currentSamples} samples).`
      : `Insufficient production correction data to calculate reliable production accuracy (${currentSamples}/${minimumRequired} samples).`;

    return {
      generatedAt: new Date(),
      totalManualCorrections: events.length,
      uniqueCorrectedConversations,
      mostCorrectedProducts,
      mostProblematicPredictedProducts,
      mostProblematicPhrases,
      correctionPatterns,
      aliasRecommendations,
      dataSufficiency: {
        hasSufficientData,
        currentSamples,
        minimumRequired,
        message,
      },
    };
  }

  /**
   * Safe Alias Approval: validates rules, activates MANUAL alias in ProductAlias, and logs audit record.
   */
  async approveAlias(input: {
    phrase: string;
    modelName: string;
    createdByName?: string;
  }): Promise<ApproveAliasResponse> {
    const rawPhrase = (input.phrase ?? "").trim();
    if (!rawPhrase) throw new BadRequestException("Alias phrase is required.");

    const normalizedAlias = compactProductText(rawPhrase).toLowerCase();

    // 1. Check blocked / negative list
    if (BLOCKED_OR_NEGATIVE_PHRASES.has(rawPhrase.toLowerCase()) || BLOCKED_OR_NEGATIVE_PHRASES.has(normalizedAlias)) {
      throw new BadRequestException(`Cannot approve blocked or unsafe token "${rawPhrase}".`);
    }

    // 2. Validate model exists
    const model = await this.prisma.productModel.findFirst({
      where: { name: input.modelName, isActive: true },
    });
    if (!model) {
      throw new NotFoundException(`Product model "${input.modelName}" not found or inactive.`);
    }

    // 3. Collision check against active aliases of other models
    const existingConflict = await this.prisma.productAlias.findFirst({
      where: {
        normalizedAlias,
        isActive: true,
        productModelId: { not: model.id },
      },
      include: { productModel: true },
    });
    if (existingConflict) {
      throw new BadRequestException(
        `Alias "${rawPhrase}" conflicts with existing active model "${existingConflict.productModel.name}".`,
      );
    }

    // 4. Upsert into ProductAlias with MANUAL source
    await this.prisma.productAlias.upsert({
      where: {
        normalizedAlias,
      },
      update: {
        productModelId: model.id,
        alias: rawPhrase,
        isActive: true,
        source: ProductAliasSource.MANUAL,
      },
      create: {
        productModelId: model.id,
        alias: rawPhrase,
        normalizedAlias,
        isActive: true,
        source: ProductAliasSource.MANUAL,
      },
    });

    // 5. Find any conversation to attach the audit entry
    const anyConv = await this.prisma.conversation.findFirst({
      select: { id: true },
    });

    if (anyConv) {
      await this.prisma.activityHistory.create({
        data: {
          conversationId: anyConv.id,
          actionType: "CLASSIFICATION_UPDATED",
          description: `Alias approved: "${rawPhrase}" → ${model.name} (normalized: "${normalizedAlias}")`,
          createdByName: input.createdByName ?? "OPPO Retail Operations",
        },
      });
    }

    // 6. Count affected conversations
    const affectedCount = await this.prisma.conversation.count({
      where: {
        messages: {
          some: {
            direction: "INBOUND",
            originalText: { contains: rawPhrase, mode: "insensitive" },
          },
        },
        products: {
          none: { source: "MANUAL" },
        },
      },
    });

    return {
      success: true,
      phrase: rawPhrase,
      model: model.name,
      status: "APPROVED",
      normalizedAlias,
      affectedConversationsCount: affectedCount,
    };
  }

  /**
   * Safe Alias Rejection: records audit rejection log so the phrase is marked REJECTED.
   */
  async rejectAlias(input: {
    phrase: string;
    modelName: string;
    reason?: string;
    createdByName?: string;
  }): Promise<RejectAliasResponse> {
    const rawPhrase = (input.phrase ?? "").trim();
    if (!rawPhrase) throw new BadRequestException("Alias phrase is required.");

    const anyConv = await this.prisma.conversation.findFirst({
      select: { id: true },
    });

    if (anyConv) {
      await this.prisma.activityHistory.create({
        data: {
          conversationId: anyConv.id,
          actionType: "CLASSIFICATION_UPDATED",
          description: `Alias rejected: "${rawPhrase}" for ${input.modelName} (reason: "${input.reason ?? "Operator rejected"}")`,
          createdByName: input.createdByName ?? "OPPO Retail Operations",
        },
      });
    }

    return {
      success: true,
      phrase: rawPhrase,
      model: input.modelName,
      status: "REJECTED",
      reason: input.reason ?? "Operator rejected",
    };
  }

  /**
   * Targeted Re-Analysis: processes only historical conversations containing the approved phrase.
   */
  async targetedReanalyze(input: { phrase: string }): Promise<TargetedReanalysisResponse> {
    const rawPhrase = (input.phrase ?? "").trim();
    if (!rawPhrase) throw new BadRequestException("Alias phrase is required for re-analysis.");

    // Query candidate conversations containing the phrase in inbound text
    const candidates = await this.prisma.conversation.findMany({
      where: {
        messages: {
          some: {
            direction: "INBOUND",
            originalText: { contains: rawPhrase, mode: "insensitive" },
          },
        },
      },
      include: {
        products: {
          include: { productModel: { select: { name: true } } },
        },
      },
      orderBy: { id: "asc" },
    });

    let scanned = 0;
    let changed = 0;
    let unchanged = 0;
    let manualProtected = 0;
    let failed = 0;

    for (const conv of candidates) {
      scanned++;

      // Guard: strictly skip conversations with MANUAL tags
      if (conv.products.some((p) => p.source === "MANUAL")) {
        manualProtected++;
        continue;
      }

      const priorModel = conv.products.find((p) => p.source === "RULE")?.productModel.name ?? null;

      try {
        await this.classificationService.analyze(conv.id);

        const updated = await this.prisma.conversationProduct.findFirst({
          where: { conversationId: conv.id, source: "RULE" },
          include: { productModel: { select: { name: true } } },
        });
        const newModel = updated?.productModel.name ?? null;

        if (priorModel !== newModel) {
          changed++;
        } else {
          unchanged++;
        }
      } catch (err) {
        failed++;
        console.error(`[Error] Targeted re-analysis on conversation ${conv.id}:`, err instanceof Error ? err.message : err);
      }
    }

    return {
      phrase: rawPhrase,
      scanned,
      changed,
      unchanged,
      manualProtected,
      failed,
    };
  }
}
