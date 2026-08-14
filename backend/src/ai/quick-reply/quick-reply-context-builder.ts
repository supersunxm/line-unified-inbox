import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../../prisma.service";
import { StoreAccessService } from "../../auth/store-access.service";
import type { AuthUser } from "../../auth/auth.guard";
import type { GenerateQuickRepliesDto } from "./quick-reply.dto";
import type { QuickReplyContext, QuickReplyContextMessage, QuickReplyFact } from "./quick-reply.types";

const RECENT_MESSAGE_LIMIT = 20;
const MESSAGE_TEXT_LIMIT = 1_000;
const TOTAL_CONTEXT_TEXT_LIMIT = 8_000;
const PRODUCT_LIMIT = 10;
const TOPIC_LIMIT = 10;

const trimMessage = (value: string | null | undefined) => (value ?? "").trim().slice(0, MESSAGE_TEXT_LIMIT);

@Injectable()
export class QuickReplyContextBuilder {
  constructor(private readonly prisma: PrismaService, private readonly storeAccess: StoreAccessService) {}

  async build(user: AuthUser, conversationId: string, dto: GenerateQuickRepliesDto, ttlSeconds: number): Promise<QuickReplyContext> {
    const authorizedStoreId = await this.storeAccess.assertConversationAccess(user, conversationId);
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        storeId: true,
        latestMessageAt: true,
        purchaseIntent: true,
        productRelationship: true,
        customer: { select: { displayName: true } },
        store: {
          select: {
            id: true,
            name: true,
            code: true,
            isActive: true,
            archivedAt: true,
            storeMaster: { select: { storeName: true, region: true, province: true, dataQualityStatus: true, updatedAt: true } },
          },
        },
        products: {
          orderBy: { productModel: { name: "asc" } },
          take: PRODUCT_LIMIT,
          select: { productModelId: true, source: true, confidence: true, productModel: { select: { name: true, isActive: true, productSeries: { select: { name: true, isActive: true } } } } },
        },
        topics: { orderBy: { topic: { name: "asc" } }, take: TOPIC_LIMIT, select: { confidence: true, source: true, topic: { select: { name: true, category: true, isActive: true } } } },
      },
    });
    if (!conversation) throw new NotFoundException("Conversation not found");
    if (conversation.storeId !== authorizedStoreId) throw new ForbiddenException("Store access is forbidden");
    if (!conversation.store.isActive || conversation.store.archivedAt) throw new ForbiddenException("Store access is forbidden");

    const [recentRows, latestInbound] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: [{ sentAt: "desc" }, { id: "desc" }],
        take: RECENT_MESSAGE_LIMIT,
        select: { id: true, direction: true, messageType: true, originalText: true, sentAt: true },
      }),
      this.prisma.message.findFirst({
        where: { conversationId, direction: "INBOUND" },
        orderBy: [{ sentAt: "desc" }, { id: "desc" }],
        select: { id: true, direction: true, messageType: true, originalText: true, sentAt: true },
      }),
    ]);
    if (!latestInbound) throw new NotFoundException("No inbound message available");

    const rows = recentRows.some((message) => message.id === latestInbound.id) ? recentRows : [latestInbound, ...recentRows].slice(0, RECENT_MESSAGE_LIMIT);
    let totalText = 0;
    const boundedMessages: QuickReplyContextMessage[] = rows.map((message) => {
      const text = trimMessage(message.originalText);
      const remaining = Math.max(0, TOTAL_CONTEXT_TEXT_LIMIT - totalText);
      const boundedText = text.slice(0, remaining);
      totalText += boundedText.length;
      return { id: message.id, role: message.direction === "INBOUND" ? "CUSTOMER" : "BM", direction: message.direction as "INBOUND" | "OUTBOUND", messageType: message.messageType, ...(boundedText ? { text: boundedText } : {}), sentAt: message.sentAt.toISOString() };
    });
    const recentMessages = boundedMessages.reverse();

    const productModels = conversation.products.filter((item) => item.productModel.isActive && item.productModel.productSeries.isActive).map((item) => item.productModel.name);
    const topics = conversation.topics.filter((item) => item.topic.isActive).map((item) => item.topic.name);
    const approvedFacts = this.buildStoreFacts(conversation.store.storeMaster, conversation.store.name, conversation.store.code);
    const builtAt = new Date();
    const expiresAt = new Date(builtAt.getTime() + ttlSeconds * 1000);
    const contextVersion = this.hashContext({
      conversationId: conversation.id,
      latestInboundMessageId: latestInbound.id,
      messageVersion: recentMessages.map((message) => [message.id, message.sentAt, message.messageType]),
      locale: dto.locale,
      productVersion: conversation.products.map((item) => [item.productModelId, item.source, item.confidence]),
      topicVersion: conversation.topics.map((item) => [item.topic.name, item.source, item.confidence]),
      storeMasterUpdatedAt: conversation.store.storeMaster?.updatedAt?.toISOString() ?? null,
      rulesVersion: "deterministic-v1",
    });

    return {
      conversationId: conversation.id,
      storeId: conversation.storeId,
      contextMessageId: latestInbound.id,
      contextVersion,
      locale: dto.locale,
      customerDisplayName: conversation.customer.displayName || undefined,
      storeName: conversation.store.name,
      storeCode: conversation.store.code ?? undefined,
      recentMessages,
      signals: { topics, productModels, purchaseIntent: conversation.purchaseIntent ?? undefined, productRelationship: conversation.productRelationship ?? undefined },
      approvedFacts,
      builtAt: builtAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  private buildStoreFacts(storeMaster: { storeName: string; region: string | null; province: string | null; dataQualityStatus: string; updatedAt: Date } | null, storeName: string, storeCode: string | null): QuickReplyFact[] {
    const verifiedAt = (storeMaster?.updatedAt ?? new Date()).toISOString();
    const facts: QuickReplyFact[] = [{ key: "store_name", value: storeName, source: "STORE_MASTER", verifiedAt }];
    if (storeCode) facts.push({ key: "store_code", value: storeCode, source: "STORE_MASTER", verifiedAt });
    if (storeMaster?.dataQualityStatus === "COMPLETE") {
      const location = [storeMaster.province, storeMaster.region].filter(Boolean).join(" / ");
      if (location) facts.push({ key: "store_location", value: location, source: "STORE_MASTER", verifiedAt });
    }
    return facts;
  }

  private hashContext(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }
}
