import { Injectable, NotFoundException } from "@nestjs/common";
import { ActivityActionType } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { classifyConversationText } from "./classification-engine";

const normalize = (value: string) => value.toLocaleLowerCase().replace(/[\s_-]+/g, "").replace(/oppo/g, "");

@Injectable()
export class ClassificationService {
  constructor(private readonly prisma: PrismaService) {}

  async analyze(conversationId: string, recordActivity = false) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId }, include: { messages: { where: { direction: "INBOUND" } }, products: true, topics: true } });
    if (!conversation) throw new NotFoundException("Conversation not found");
    const text = conversation.messages.map(({ originalText }) => originalText).join(" ").toLocaleLowerCase();
    const normalizedText = normalize(text);
    const models = await this.prisma.productModel.findMany({ where: { isActive: true }, include: { aliases: { where: { isActive: true } } } });
    const matchedModels = models.filter((model) => [model.name, ...model.aliases.map(({ alias }) => alias)].some((candidate) => { const value = normalize(candidate); return value.length >= 3 && normalizedText.includes(value); }));
    const suggestion = classifyConversationText(text, matchedModels.length > 0);
    const manualProductIds = new Set(conversation.products.filter(({ source }) => source === "MANUAL").map(({ productModelId }) => productModelId));
    const manualTopicIds = new Set(conversation.topics.filter(({ source }) => source === "MANUAL").map(({ topicId }) => topicId));

    await this.prisma.$transaction(async (tx) => {
      await tx.conversationProduct.deleteMany({ where: { conversationId, source: "RULE" } });
      await tx.conversationTopic.deleteMany({ where: { conversationId, source: "RULE" } });
      await tx.conversationProduct.createMany({ data: matchedModels.filter(({ id }) => !manualProductIds.has(id)).map(({ id }) => ({ conversationId, productModelId: id, confidence: 0.9, source: "RULE" })), skipDuplicates: true });
      const automaticTopics: Array<{ conversationId: string; topicId: string; confidence: number; source: string }> = [];
      for (const rule of suggestion.matchedRules) {
        const topic = await tx.topic.upsert({ where: { name: rule.name }, update: { isActive: true }, create: { name: rule.name, category: rule.category } });
        if (!manualTopicIds.has(topic.id)) automaticTopics.push({ conversationId, topicId: topic.id, confidence: 0.85, source: "RULE" });
      }
      await tx.conversationTopic.createMany({ data: automaticTopics, skipDuplicates: true });
      await tx.conversation.update({ where: { id: conversationId }, data: { productRelationship: suggestion.productRelationship, purchaseIntent: suggestion.purchaseIntent, priority: conversation.prioritySource === "MANUAL" ? undefined : suggestion.priority } });
      if (recordActivity) await tx.activityHistory.create({ data: { conversationId, actionType: ActivityActionType.CLASSIFICATION_UPDATED, description: "Conversation classification re-analyzed", createdByName: "OPPO LINE OA Specialist" } });
    });
    return this.prisma.conversation.findUnique({ where: { id: conversationId }, include: { products: { include: { productModel: { include: { productSeries: true } } } }, topics: { include: { topic: true } } } });
  }
}
