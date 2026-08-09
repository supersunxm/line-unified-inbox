import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ActivityActionType } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { classifyConversationText } from "./classification-engine";
import { automaticCatalogAliasesForModel, storedProductAliasSafety } from "./product-catalog";
import { matchProduct } from "./product-matcher";

@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async analyze(conversationId: string, recordActivity = false) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: { where: { direction: "INBOUND" }, orderBy: { sentAt: "asc" } },
        products: true,
        topics: true,
      },
    });
    if (!conversation) throw new NotFoundException("Conversation not found");

    const text = conversation.messages.map(({ originalText }) => originalText).join(" ").toLocaleLowerCase();

    const storedModels = await this.prisma.productModel.findMany({
      where: { isActive: true },
      include: { aliases: { where: { isActive: true } }, productSeries: true },
    });

    const models = storedModels.map((model) => ({
      ...model,
      aliases: [
        // Thread language field so PHONETIC_ALIAS is detected correctly for Thai aliases
        ...model.aliases.map((alias) => ({
          ...alias,
          language: alias.language ?? undefined,
          safety: storedProductAliasSafety(model.name, alias.alias, alias.source),
        })),
        ...automaticCatalogAliasesForModel(model.name).map(({ alias, safety, language }) => ({
          alias,
          safety,
          language,
          priority: 0,
        })),
      ],
    }));

    // Skip messages with empty text to avoid matching against whitespace-only tokens
    const messages = conversation.messages
      .filter(({ originalText }) => originalText?.trim())
      .map((message) => ({ id: message.id, text: message.originalText, sentAt: message.sentAt }));

    const match = matchProduct(messages, models);
    const suggestion = classifyConversationText(text, Boolean(match));

    const manualProductIds = new Set(
      conversation.products.filter(({ source }) => source === "MANUAL").map(({ productModelId }) => productModelId),
    );
    const manualTopicIds = new Set(
      conversation.topics.filter(({ source }) => source === "MANUAL").map(({ topicId }) => topicId),
    );

    await this.prisma.$transaction(async (tx) => {
      // Phase 6: before deleting RULE rows, capture the prediction for audit trail
      const priorRuleProduct = conversation.products.find(({ source }) => source === "RULE");
      if (priorRuleProduct && match && manualProductIds.size === 0) {
        // Re-analysis is updating a prior RULE prediction — not a manual override scenario.
        // Log only when the predicted model changes.
        const priorModelName = storedModels.find(({ id }) => id === priorRuleProduct.productModelId)?.name;
        if (priorModelName && priorModelName !== match.model.name) {
          this.logger.log(`[Classification] Prediction changed: ${priorModelName} → ${match.model.name} (conversationId=${conversationId})`);
        }
      }

      await tx.conversationProduct.deleteMany({ where: { conversationId, source: "RULE" } });
      await tx.conversationTopic.deleteMany({ where: { conversationId, source: "RULE" } });

      if (match && manualProductIds.size === 0) {
        // detectionMethod comes from the matcher's semantic label (EXACT_ALIAS, PHONETIC_ALIAS, etc.)
        await tx.conversationProduct.create({
          data: {
            conversationId,
            productModelId: match.model.id,
            confidence: match.confidence,
            source: "RULE",
            matchedPhrase: match.matchedPhrase,
            detectionMethod: match.detectionMethod,
            sourceMessageId: match.sourceMessageId,
          },
        });
        this.logger.log(
          `[Classification] Matched ${match.model.name} via ${match.detectionMethod} ("${match.matchedPhrase}") conf=${match.confidence} (conversationId=${conversationId})`,
        );
      }

      const automaticTopics: Array<{ conversationId: string; topicId: string; confidence: number; source: string }> = [];
      for (const rule of suggestion.matchedRules) {
        const topic = await tx.topic.upsert({
          where: { name: rule.name },
          update: { isActive: true },
          create: { name: rule.name, category: rule.category },
        });
        if (!manualTopicIds.has(topic.id)) automaticTopics.push({ conversationId, topicId: topic.id, confidence: 0.85, source: "RULE" });
      }
      await tx.conversationTopic.createMany({ data: automaticTopics, skipDuplicates: true });
      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          productRelationship: suggestion.productRelationship,
          purchaseIntent: suggestion.purchaseIntent,
          priority: conversation.prioritySource === "MANUAL" ? undefined : suggestion.priority,
        },
      });

      if (recordActivity) {
        await tx.activityHistory.create({
          data: {
            conversationId,
            actionType: ActivityActionType.CLASSIFICATION_UPDATED,
            description: "Conversation classification re-analyzed",
            createdByName: "OPPO LINE OA Specialist",
          },
        });
      }
    });

    return this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        products: { include: { productModel: { include: { productSeries: true } } } },
        topics: { include: { topic: true } },
      },
    });
  }
}
