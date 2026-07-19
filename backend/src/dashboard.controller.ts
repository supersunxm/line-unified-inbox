import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}
  @Get("summary")
  async summary() {
    const activeConversation = { store: { archivedAt: null } } as const;
    const [total, byStatus, byPriority, stores, products, topics, recentActivity] = await this.prisma.$transaction([
      this.prisma.conversation.count({ where: activeConversation }),
      this.prisma.conversation.groupBy({ by: ["followUpStatus"], where: activeConversation, _count: true, orderBy: { followUpStatus: "asc" } }),
      this.prisma.conversation.groupBy({ by: ["priority"], where: activeConversation, _count: true, orderBy: { priority: "asc" } }),
      this.prisma.store.findMany({ where: { isActive: true, archivedAt: null }, include: { conversations: { select: { followUpStatus: true, priority: true } } } }),
      this.prisma.conversationProduct.groupBy({ by: ["productModelId"], where: { conversation: activeConversation }, _count: true, orderBy: { _count: { productModelId: "desc" } } }),
      this.prisma.conversationTopic.groupBy({ by: ["topicId"], where: { conversation: activeConversation }, _count: true, orderBy: { _count: { topicId: "desc" } } }),
      this.prisma.activityHistory.findMany({ where: { conversation: activeConversation }, take: 10, orderBy: { createdAt: "desc" }, include: { conversation: { include: { customer: true, store: true } } } }),
    ]);
    const productRecords = await this.prisma.productModel.findMany({ where: { id: { in: products.map((item) => item.productModelId) } } });
    const topicRecords = await this.prisma.topic.findMany({ where: { id: { in: topics.map((item) => item.topicId) } } });
    const storeMonitoring = stores.map((store) => ({ store: { id: store.id, name: store.name }, total: store.conversations.length, byStatus: Object.fromEntries(["FOLLOW_UP", "REMINDED", "ACKNOWLEDGED", "COMPLETED", "ESCALATED"].map((status) => [status, store.conversations.filter((item) => item.followUpStatus === status).length])), highestPriority: store.conversations.some((item) => item.priority === "CRITICAL") ? "CRITICAL" : store.conversations.some((item) => item.priority === "HIGH") ? "HIGH" : store.conversations.some((item) => item.priority === "NORMAL") ? "NORMAL" : "LOW" }));
    return {
      totalConversations: total,
      countByStatus: Object.fromEntries(byStatus.map((item) => [item.followUpStatus, item._count])),
      countByPriority: Object.fromEntries(byPriority.map((item) => [item.priority, item._count])),
      storeMonitoring,
      mostDiscussedProductModels: products.map((item) => ({ productModel: productRecords.find((record) => record.id === item.productModelId), count: item._count })),
      topConversationTopics: topics.map((item) => ({ topic: topicRecords.find((record) => record.id === item.topicId), count: item._count })),
      storesRequiringAttention: storeMonitoring.filter((item) => item.byStatus.FOLLOW_UP || item.byStatus.REMINDED || item.byStatus.ESCALATED),
      recentActivity,
    };
  }
}
