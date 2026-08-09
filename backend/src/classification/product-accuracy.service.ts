/**
 * ProductAccuracyService
 *
 * Provides admin-facing accuracy insights using existing ConversationProduct data.
 * No new DB tables — reads only ConversationProduct.source (RULE | MANUAL | SEED).
 *
 * Accuracy is estimated as:
 *   (ruleTagged - estimatedErrors) / ruleTagged * 100
 *
 * Limitations:
 *   - manualOnlyCount may include conversations manually tagged without a prior RULE
 *     tag (fresh manual tagging, not correction). This is an upper-bound overestimate
 *     of AI errors. Phase 6 prediction logging will enable precise tracking.
 *   - SEED-sourced records are excluded (test/demo data, not real classifications).
 */
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

export type ModelAccuracyDetail = {
  productModel: string;
  ruleTagged: number;
  manualTagged: number;
  manualConfirmations: number;
  manualCorrections: number;
  correctionRate: number | null;
  estimatedAccuracy: number | null;
  primaryDetectionMethod: string | null;
  topProblematicPhrases: string[];
};

export type ProblematicPhrase = {
  phrase: string;
  predictedModel: string;
  correctedModel: string;
  count: number;
};

export type NetworkAccuracyReport = {
  generatedAt: Date;
  totalConversations: number;
  conversationsWithProductSignals: number;
  ruleClassificationsCount: number;
  manualClassificationsCount: number;
  unclassifiedCount: number;
  manualCorrectionsCount: number;
  overallCorrectionRate: number | null;
  hasSufficientData: boolean;
  sufficiencyMessage: string;
  perModel: ModelAccuracyDetail[];
  flaggedModels: ModelAccuracyDetail[];
  topProblematicPhrases: ProblematicPhrase[];
};

@Injectable()
export class ProductAccuracyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a full accuracy report across all product models.
   * Scoped to a single store when storeId is provided.
   */
  async generateReport(storeId?: string): Promise<NetworkAccuracyReport> {
    const totalConversations = await this.prisma.conversation.count({
      where: storeId ? { storeId } : {},
    });

    // Fetch all active product models
    const models = await this.prisma.productModel.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    // Fetch ConversationProduct rows, optionally scoped by store
    const conversationFilter = storeId
      ? { conversation: { storeId } }
      : {};

    const allCPs = await this.prisma.conversationProduct.findMany({
      where: {
        ...conversationFilter,
        source: { not: "SEED" }, // exclude demo/seed data
      },
      select: {
        productModelId: true,
        source: true,
        detectionMethod: true,
        matchedPhrase: true,
        conversationId: true,
      },
    });

    // Fetch manual correction activities from ActivityHistory
    const correctionActivities = await this.prisma.activityHistory.findMany({
      where: {
        actionType: "CLASSIFICATION_UPDATED",
        description: { startsWith: "Manual product correction:" },
        ...(storeId ? { conversation: { storeId } } : {}),
      },
      select: { description: true, conversationId: true },
    });

    const problematicPhraseMap = new Map<string, ProblematicPhrase>();
    const modelCorrectionCounts = new Map<string, number>();
    const modelProblematicPhrases = new Map<string, Set<string>>();

    for (const act of correctionActivities) {
      if (!act.description) continue;
      // Pattern: "Manual product correction: [prior] → [new] (phrase: "[phrase]", method: "[method]", ...)"
      const match = act.description.match(/^Manual product correction:\s*(.+?)\s*→\s*(.+?)(?:\s*\((.+?)\))?$/);
      if (match) {
        const [, predictedModel, correctedModel, metaString] = match;
        let phrase = "unknown";
        if (metaString) {
          const phraseMatch = metaString.match(/phrase:\s*"([^"]+)"/);
          if (phraseMatch) phrase = phraseMatch[1];
        }

        // Increment model-level error counts for the predicted model that was corrected
        modelCorrectionCounts.set(predictedModel, (modelCorrectionCounts.get(predictedModel) ?? 0) + 1);
        if (!modelProblematicPhrases.has(predictedModel)) {
          modelProblematicPhrases.set(predictedModel, new Set());
        }
        if (phrase && phrase !== "unknown") {
          modelProblematicPhrases.get(predictedModel)!.add(phrase);
        }

        const key = `${phrase}::${predictedModel}::${correctedModel}`;
        const existing = problematicPhraseMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          problematicPhraseMap.set(key, {
            phrase,
            predictedModel,
            correctedModel,
            count: 1,
          });
        }
      }
    }

    const topProblematicPhrases = [...problematicPhraseMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Group by productModelId
    const byModel = new Map<string, typeof allCPs>();
    for (const cp of allCPs) {
      if (!byModel.has(cp.productModelId)) byModel.set(cp.productModelId, []);
      byModel.get(cp.productModelId)!.push(cp);
    }

    // Build per-model reports
    const perModel: ModelAccuracyDetail[] = [];
    for (const model of models) {
      const rows = byModel.get(model.id) ?? [];
      const ruleRows = rows.filter((r) => r.source === "RULE");
      const manualRows = rows.filter((r) => r.source === "MANUAL");

      const ruleTagged = ruleRows.length;
      const manualTagged = manualRows.length;
      const manualCorrections = modelCorrectionCounts.get(model.name) ?? 0;
      const manualConfirmations = Math.max(0, ruleTagged - manualCorrections);

      let correctionRate: number | null = null;
      let estimatedAccuracy: number | null = null;

      if (ruleTagged > 0) {
        correctionRate = Math.round((manualCorrections / ruleTagged) * 100 * 10) / 10;
        estimatedAccuracy = Math.round(((ruleTagged - manualCorrections) / ruleTagged) * 100 * 10) / 10;
      }

      // Most common detectionMethod among RULE rows
      const methodCounts = new Map<string, number>();
      for (const row of ruleRows) {
        if (row.detectionMethod) {
          methodCounts.set(row.detectionMethod, (methodCounts.get(row.detectionMethod) ?? 0) + 1);
        }
      }
      let primaryDetectionMethod: string | null = null;
      let maxCount = 0;
      for (const [method, count] of methodCounts) {
        if (count > maxCount) {
          maxCount = count;
          primaryDetectionMethod = method;
        }
      }

      const modelPhrases = modelProblematicPhrases.get(model.name);

      perModel.push({
        productModel: model.name,
        ruleTagged,
        manualTagged,
        manualConfirmations,
        manualCorrections,
        correctionRate,
        estimatedAccuracy,
        primaryDetectionMethod,
        topProblematicPhrases: modelPhrases ? [...modelPhrases].slice(0, 5) : [],
      });
    }

    // Summary stats
    const conversationsWithProductSignals = new Set(allCPs.map((r) => r.conversationId)).size;
    const ruleClassificationsCount = allCPs.filter((r) => r.source === "RULE").length;
    const manualClassificationsCount = allCPs.filter((r) => r.source === "MANUAL").length;
    const unclassifiedCount = Math.max(0, totalConversations - conversationsWithProductSignals);
    const manualCorrectionsCount = correctionActivities.length;

    let overallCorrectionRate: number | null = null;
    if (ruleClassificationsCount > 0) {
      overallCorrectionRate = Math.round((manualCorrectionsCount / ruleClassificationsCount) * 100 * 10) / 10;
    }

    const minimumCorrectionsForReliability = 10;
    const hasSufficientData = manualCorrectionsCount >= minimumCorrectionsForReliability;
    const sufficiencyMessage = hasSufficientData
      ? `Sufficient production correction data (${manualCorrectionsCount} corrections recorded).`
      : `Insufficient production correction data (${manualCorrectionsCount}/${minimumCorrectionsForReliability} required corrections).`;

    // Flag models with high correction rate (>20%) or zero rule coverage with positive manual coverage
    const flaggedModels = perModel.filter(
      (m) =>
        (m.correctionRate !== null && m.correctionRate > 20) ||
        (m.ruleTagged === 0 && m.manualTagged > 0),
    );

    return {
      generatedAt: new Date(),
      totalConversations,
      conversationsWithProductSignals,
      ruleClassificationsCount,
      manualClassificationsCount,
      unclassifiedCount,
      manualCorrectionsCount,
      overallCorrectionRate,
      hasSufficientData,
      sufficiencyMessage,
      perModel,
      flaggedModels,
      topProblematicPhrases,
    };
  }
}
