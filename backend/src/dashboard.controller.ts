import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { Prisma } from "@prisma/client";
import { OperationsService } from "./operations/operations.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly prisma: PrismaService, private readonly operations: OperationsService) {}
  @Get("summary")
  async summary() {
    const resetFilter = (await this.operations.getOperationalConversationFilter()) as Prisma.ConversationWhereInput;
    const operationalWhere = { store: { archivedAt: null }, ...resetFilter };
    const historicalWhere = { store: { archivedAt: null } } as const;

    const [total, byStatus, byPriority, stores, products, topics, recentActivity, storeByStatusGroups, storeByPriorityGroups] = await this.prisma.$transaction([
      // operational counts
      this.prisma.conversation.count({ where: operationalWhere }),
      this.prisma.conversation.groupBy({ by: ["followUpStatus"], where: operationalWhere, _count: true, orderBy: { followUpStatus: "asc" } }),
      this.prisma.conversation.groupBy({ by: ["priority"], where: operationalWhere, _count: true, orderBy: { priority: "asc" } }),
      // stores list (no conversations included)
      this.prisma.store.findMany({ where: { isActive: true, archivedAt: null }, select: { id: true, name: true } }),
      // historical analytics (no reset filter)
      this.prisma.conversationProduct.groupBy({ by: ["productModelId"], where: { conversation: historicalWhere }, _count: true, orderBy: { _count: { productModelId: "desc" } } }),
      this.prisma.conversationTopic.groupBy({ by: ["topicId"], where: { conversation: historicalWhere }, _count: true, orderBy: { _count: { topicId: "desc" } } }),
      // operational recent activity
      this.prisma.activityHistory.findMany({ where: { conversation: operationalWhere }, take: 10, orderBy: { createdAt: "desc" }, include: { conversation: { include: { customer: true, store: true } } } }),
      // per-store operational groupings used to build storeMonitoring
      this.prisma.conversation.groupBy({ by: ["storeId", "followUpStatus"], where: operationalWhere, _count: true, orderBy: { storeId: "asc" } }),
      this.prisma.conversation.groupBy({ by: ["storeId", "priority"], where: operationalWhere, _count: true, orderBy: { storeId: "asc" } }),
    ]);
    const productRecords = await this.prisma.productModel.findMany({ where: { id: { in: products.map((item) => item.productModelId) } } });
    const topicRecords = await this.prisma.topic.findMany({ where: { id: { in: topics.map((item) => item.topicId) } } });

    const byStatusMap = new Map<string, Record<string, number>>();
    for (const g of storeByStatusGroups) {
      const m = byStatusMap.get(g.storeId) ?? {};
      const count = (g._count as unknown as number) ?? 0;
      m[g.followUpStatus] = count;
      byStatusMap.set(g.storeId, m);
    }
    const byPriorityMap = new Map<string, Record<string, number>>();
    for (const g of storeByPriorityGroups) {
      const m = byPriorityMap.get(g.storeId) ?? {};
      const pcount = (g._count as unknown as number) ?? 0;
      m[g.priority] = pcount;
      byPriorityMap.set(g.storeId, m);
    }

    const storeMonitoring = stores.map((store) => {
      const statusCounts = byStatusMap.get(store.id) ?? {};
      const priorityCounts = byPriorityMap.get(store.id) ?? {};
      const highestPriority = priorityCounts.CRITICAL ? "CRITICAL" : priorityCounts.HIGH ? "HIGH" : priorityCounts.NORMAL ? "NORMAL" : "LOW";
      return { store: { id: store.id, name: store.name }, total: Object.values(statusCounts).reduce((s, v) => s + v, 0), byStatus: Object.fromEntries(["FOLLOW_UP", "REMINDED", "ACKNOWLEDGED", "COMPLETED", "ESCALATED"].map((status) => [status, statusCounts[status] ?? 0])), highestPriority };
    });
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
