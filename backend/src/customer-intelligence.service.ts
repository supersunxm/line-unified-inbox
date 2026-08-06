import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { BmReplyStatus, ProductRelationship, PurchaseIntent, TopicCategory } from "@prisma/client";
import { PrismaService } from "./prisma.service";

export type CustomerIntelligenceResult = {
  customerId: string;
  profileSummary: string;
  customerStage: "NEW" | "INTERESTED" | "PURCHASED" | "EXISTING_CUSTOMER" | "UNKNOWN";
  intent: string[];
  interestedProducts: string[];
  recommendedActions: string[];
  confidenceScore: number;
  evidence: string[];
};

const normalizeName = (value: string | null | undefined) => value?.trim() || "";

@Injectable()
export class CustomerIntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  async analyze(customerId: string): Promise<CustomerIntelligenceResult> {
    if (!customerId || customerId.trim() === "" || customerId === "undefined" || customerId === "null") {
      throw new BadRequestException("Invalid customer ID");
    }
    const [customer, conversationCount] = await Promise.all([
      this.prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          nameHistory: { orderBy: { capturedAt: "desc" } },
          conversations: {
            take: 5,
            orderBy: { latestMessageAt: "desc" },
            include: {
              store: true,
              products: {
                include: {
                  productModel: {
                    include: { productSeries: true },
                  },
                },
              },
              topics: { include: { topic: true } },
              messages: {
                orderBy: { sentAt: "desc" },
                take: 15,
              },
            },
          },
        },
      }),
      this.prisma.conversation.count({ where: { customerId } }),
    ]);

    if (!customer) throw new NotFoundException("Customer not found");

    const recentConversations = customer.conversations;
    const latestConversation = recentConversations[0] ?? null;
    const latestStore = latestConversation?.store;
    const latestProducts = Array.from(
      new Set(
        recentConversations.flatMap((conversation) =>
          conversation.products.map((item) => item.productModel.name),
        ),
      ),
    );
    const topicNames = Array.from(
      new Set(
        recentConversations.flatMap((conversation) =>
          conversation.topics.map((item) => item.topic.name),
        ),
      ),
    );
    const topicCategories = Array.from(
      new Set(
        recentConversations.flatMap((conversation) =>
          conversation.topics.map((item) => item.topic.category),
        ),
      ),
    );
    const latestMessages = latestConversation?.messages
      .map((message) => normalizeName(message.originalText))
      .filter(Boolean) ?? [];

    const purchaseIntent = latestConversation?.purchaseIntent;
    const productRelationship = latestConversation?.productRelationship;
    const bmReplyStatus = latestConversation?.bmReplyStatus;
    const intentSet = new Set<string>();
    const evidence: string[] = [];
    const productSet = new Set<string>(latestProducts);

    if (customer.nameHistory.length > 0) {
      const historyNames = customer.nameHistory.map((history) => history.displayName).filter(Boolean);
      evidence.push(`Name history includes ${historyNames.length} change(s): ${historyNames.slice(0, 3).join(", ")}`);
    }

    if (latestConversation) {
      evidence.push(`Latest conversation at ${latestConversation.latestMessageAt.toISOString()} in ${latestStore?.name ?? "unknown store"}`);
      evidence.push(`BM reply status is ${bmReplyStatus}`);
      if (purchaseIntent) evidence.push(`Purchase intent is ${purchaseIntent}`);
      if (productRelationship) evidence.push(`Product relationship is ${productRelationship}`);
    } else {
      evidence.push("No conversation history available for this customer");
    }

    if (topicNames.length) {
      evidence.push(`Detected topics: ${topicNames.join(", ")}`);
    }

    if (latestProducts.length) {
      evidence.push(`Detected product interest: ${latestProducts.join(", ")}`);
    }

    if (latestMessages.length > 0) {
      const snippet = latestMessages[0].slice(0, 120);
      evidence.push(`Latest message snippet: "${snippet}${snippet.length < latestMessages[0].length ? "..." : ""}"`);
    }

    if (purchaseIntent === PurchaseIntent.HIGH) {
      intentSet.add("High purchase intent");
    } else if (purchaseIntent === PurchaseIntent.MEDIUM) {
      intentSet.add("Considering purchase");
    } else if (purchaseIntent === PurchaseIntent.AFTER_SALES) {
      intentSet.add("Seeking after-sales support");
    }

    if (productRelationship === ProductRelationship.INTERESTED) {
      intentSet.add("Interested in product options");
    }

    if (productRelationship === ProductRelationship.CURRENT_OWNER || purchaseIntent === PurchaseIntent.AFTER_SALES) {
      intentSet.add("Already owns a product and may need support");
    }

    if (topicCategories.includes(TopicCategory.SALES)) {
      intentSet.add("Sales-related inquiry");
    }
    if (topicCategories.includes(TopicCategory.PURCHASE_JOURNEY)) {
      intentSet.add("Purchase journey inquiry");
    }
    if (topicCategories.includes(TopicCategory.AFTER_SALES)) {
      intentSet.add("After-sales or support question");
    }
    if (topicCategories.includes(TopicCategory.COMPLAINT)) {
      intentSet.add("Customer complaint or issue");
    }

    if (latestProducts.length && intentSet.size === 0) {
      intentSet.add(`Asks about ${latestProducts.slice(0, 3).join(", ")}`);
    }

    if (latestStore) {
      const storeLocation = [latestStore.region, latestStore.area].filter(Boolean).join(" / ");
      if (storeLocation) evidence.push(`Latest store location: ${storeLocation}`);
    }

    const interestedProducts = Array.from(productSet).slice(0, 6);
    const conversationAge = latestConversation ? Math.floor((Date.now() - latestConversation.latestMessageAt.getTime()) / 86400000) : null;
    const customerStage = this.determineCustomerStage(conversationCount, purchaseIntent, productRelationship, topicCategories);
    const recommendedActions = this.buildRecommendedActions(customerStage, bmReplyStatus, latestStore?.name ?? null, purchaseIntent, latestProducts.length > 0);
    const profileSummary = this.buildProfileSummary(customer, latestConversation, latestStore, latestProducts, topicNames, customerStage);
    const confidenceScore = this.buildConfidenceScore(latestProducts.length, topicNames.length, intentSet.size, purchaseIntent, productRelationship, bmReplyStatus, customer.nameHistory.length, conversationCount, conversationAge);

    return {
      customerId,
      profileSummary,
      customerStage,
      intent: Array.from(intentSet),
      interestedProducts,
      recommendedActions,
      confidenceScore,
      evidence,
    };
  }

  private determineCustomerStage(
    conversationCount: number,
    purchaseIntent: PurchaseIntent | null,
    productRelationship: ProductRelationship | null,
    topicCategories: Array<TopicCategory>,
  ): CustomerIntelligenceResult["customerStage"] {
    if (conversationCount === 0) return "NEW";
    const hasAfterSales = purchaseIntent === PurchaseIntent.AFTER_SALES || productRelationship === ProductRelationship.CURRENT_OWNER || topicCategories.includes(TopicCategory.AFTER_SALES);
    const hasInterested = purchaseIntent === PurchaseIntent.HIGH || purchaseIntent === PurchaseIntent.MEDIUM || productRelationship === ProductRelationship.INTERESTED || topicCategories.includes(TopicCategory.SALES) || topicCategories.includes(TopicCategory.PURCHASE_JOURNEY);
    if (hasAfterSales) return "PURCHASED";
    if (hasInterested) return "INTERESTED";
    if (conversationCount > 1) return "EXISTING_CUSTOMER";
    return "UNKNOWN";
  }

  private buildRecommendedActions(
    customerStage: CustomerIntelligenceResult["customerStage"],
    bmReplyStatus: BmReplyStatus | null | undefined,
    storeName: string | null,
    purchaseIntent: PurchaseIntent | null,
    hasProductInterest: boolean,
  ) {
    const actions = new Set<string>();
    if (bmReplyStatus === BmReplyStatus.NOT_REPLIED) {
      actions.add("Respond to the customer promptly");
    }
    if (customerStage === "INTERESTED") {
      actions.add("Offer relevant product recommendations");
    }
    if (customerStage === "PURCHASED") {
      actions.add("Follow up on product ownership and after-sales needs");
    }
    if (customerStage === "NEW") {
      actions.add("Introduce product options and ask about customer needs");
    }
    if (customerStage === "EXISTING_CUSTOMER") {
      actions.add("Review the customer's recent history and strengthen the relationship");
    }
    if (purchaseIntent === PurchaseIntent.HIGH) {
      actions.add("Prioritize this opportunity with the store team");
    }
    if (hasProductInterest) {
      actions.add("Confirm the customer's interested products and next budget");
    }
    if (storeName) {
      actions.add(`Discuss with ${storeName} staff if needed`);
    }
    actions.add("Review the customer's latest LINE messages");
    return Array.from(actions);
  }

  private buildProfileSummary(
    customer: { displayName: string },
    latestConversation: { latestMessageAt: Date; store: { name: string } } | null,
    latestStore: { name: string } | undefined | null,
    latestProducts: string[],
    topicNames: string[],
    customerStage: CustomerIntelligenceResult["customerStage"],
  ) {
    const pieces: string[] = [];
    pieces.push(`Customer ${customer.displayName}`);
    if (latestStore) {
      pieces.push(`Last contacted through ${latestStore.name}`);
    }
    if (latestProducts.length) {
      pieces.push(`Interested in ${latestProducts.slice(0, 3).join(", ")}`);
    }
    if (topicNames.length) {
      pieces.push(`Conversation topics include ${topicNames.slice(0, 4).join(", ")}`);
    }
    pieces.push(`Stage: ${customerStage.replace("_", " ")}`);
    return pieces.join(". ");
  }

  private buildConfidenceScore(
    productCount: number,
    topicCount: number,
    intentCount: number,
    purchaseIntent: PurchaseIntent | null,
    productRelationship: ProductRelationship | null,
    bmReplyStatus: BmReplyStatus | null | undefined,
    historyCount: number,
    conversationCount: number,
    conversationAge: number | null,
  ) {
    let score = 0.35;
    score += Math.min(0.2, productCount * 0.05);
    score += Math.min(0.15, topicCount * 0.04);
    score += Math.min(0.1, intentCount * 0.05);
    if (purchaseIntent === PurchaseIntent.HIGH) score += 0.12;
    if (purchaseIntent === PurchaseIntent.MEDIUM) score += 0.08;
    if (purchaseIntent === PurchaseIntent.AFTER_SALES) score += 0.1;
    if (productRelationship === ProductRelationship.INTERESTED) score += 0.08;
    if (productRelationship === ProductRelationship.CURRENT_OWNER) score += 0.08;
    if (bmReplyStatus === BmReplyStatus.NOT_REPLIED) score += 0.03;
    if (historyCount > 0) score += 0.03;
    if (conversationCount > 1) score += 0.04;
    if (conversationAge !== null && conversationAge < 7) score += 0.03;
    return Math.min(1, Math.round(score * 100) / 100);
  }
}
