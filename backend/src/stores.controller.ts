import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Query } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { Prisma } from "@prisma/client";
import { OperationsService } from "./operations/operations.service";
import { isPermanentDeleteConfirmed } from "./store-removal-policy";

type PermanentDeleteBody = { confirmation?: string };

@Controller("stores")
export class StoresController {
  constructor(private readonly prisma: PrismaService, private readonly operations: OperationsService) {}
  @Get() list(@Query("showArchived") showArchived?: string) { return this.prisma.store.findMany({ where: showArchived === "true" ? undefined : { archivedAt: null }, orderBy: { name: "asc" }, include: { _count: { select: { conversations: true, lineOfficialAccounts: true } } } }); }
  @Get(":id") async get(@Param("id") id: string) {
    const store = await this.prisma.store.findUnique({ where: { id }, include: { lineOfficialAccounts: true } });
    if (!store) throw new NotFoundException("Store not found");
    return store;
  }
  @Get(":id/summary") async summary(@Param("id") id: string) {
    const store = await this.get(id);
    const resetFilter = (await this.operations.getOperationalConversationFilter()) as Prisma.ConversationWhereInput;
    const groups = await this.prisma.conversation.groupBy({ by: ["followUpStatus"], where: { storeId: id, ...resetFilter }, _count: true });
    return { store, total: groups.reduce((sum, group) => sum + group._count, 0), byStatus: Object.fromEntries(groups.map((group) => [group.followUpStatus, group._count])) };
  }
  private async deletionPreview(id: string) {
    const store = await this.prisma.store.findUnique({ where: { id }, include: { lineOfficialAccounts: { select: { id: true, isActive: true, archivedAt: true } } } });
    if (!store) throw new NotFoundException("Store not found");
    const [conversations, messages, notes, activityHistory] = await Promise.all([
      this.prisma.conversation.count({ where: { storeId: id } }),
      this.prisma.message.count({ where: { conversation: { storeId: id } } }),
      this.prisma.internalNote.count({ where: { conversation: { storeId: id } } }),
      this.prisma.activityHistory.count({ where: { conversation: { storeId: id } } }),
    ]);
    const customerIds = await this.prisma.conversation.findMany({ where: { storeId: id }, distinct: ["customerId"], select: { customerId: true } });
    const customersWithOtherConversations = customerIds.length ? await this.prisma.customer.count({ where: { id: { in: customerIds.map(({ customerId }) => customerId) }, conversations: { some: { storeId: { not: id } } } } }) : 0;
    return { store, relatedCounts: { lineOfficialAccounts: store.lineOfficialAccounts.length, activeLineOfficialAccounts: store.lineOfficialAccounts.filter((oa) => oa.isActive && !oa.archivedAt).length, conversations, messages, notes, activityHistory }, customerRecordsThatWillRemain: customersWithOtherConversations, customerRecordsThatWillBeDeleted: customerIds.length - customersWithOtherConversations };
  }
  @Get(":id/deletion-preview") async preview(@Param("id") id: string) { const { store, relatedCounts, customerRecordsThatWillRemain, customerRecordsThatWillBeDeleted } = await this.deletionPreview(id); return { storeId: store.id, storeName: store.name, lineOfficialAccountCount: relatedCounts.lineOfficialAccounts, conversationCount: relatedCounts.conversations, messageCount: relatedCounts.messages, noteCount: relatedCounts.notes, activityCount: relatedCounts.activityHistory, customerRecordsThatWillRemain, customerRecordsThatWillBeDeleted }; }
  @Post(":id/archive") async archive(@Param("id") id: string) { const { relatedCounts } = await this.deletionPreview(id); await this.prisma.store.update({ where: { id }, data: { isActive: false, archivedAt: new Date() } }); return { result: "archived" as const, message: "Store archived; historical data was preserved", relatedCounts }; }
  @Post(":id/restore") async restore(@Param("id") id: string) { await this.get(id); await this.prisma.store.update({ where: { id }, data: { isActive: true, archivedAt: null } }); return { result: "restored" as const, message: "Store restored" }; }
  @Delete(":id") async remove(@Param("id") id: string, @Query("mode") mode: string | undefined, @Body() body: PermanentDeleteBody) {
    if (mode !== "permanent") throw new BadRequestException("Choose archive or permanent deletion explicitly");
    const { store, relatedCounts } = await this.deletionPreview(id);
    if (!isPermanentDeleteConfirmed(store.name, body.confirmation)) throw new BadRequestException("Permanent deletion confirmation is incorrect");
    await this.prisma.$transaction(async (tx) => {
      const conversations = await tx.conversation.findMany({ where: { storeId: id }, select: { id: true, customerId: true } });
      const conversationIds = conversations.map(({ id: conversationId }) => conversationId);
      const customerIds = [...new Set(conversations.map(({ customerId }) => customerId))];
      const oas = await tx.lineOfficialAccount.findMany({ where: { storeId: id }, select: { id: true, destinationId: true } });
      const oaIds = oas.map(({ id: oaId }) => oaId);
      const destinations = oas.flatMap(({ destinationId }) => destinationId ? [destinationId] : []);
      await tx.webhookEvent.deleteMany({ where: { OR: [{ lineOfficialAccountId: { in: oaIds } }, { destination: { in: destinations } }] } });
      await tx.conversationProduct.deleteMany({ where: { conversationId: { in: conversationIds } } });
      await tx.conversationTopic.deleteMany({ where: { conversationId: { in: conversationIds } } });
      await tx.internalNote.deleteMany({ where: { conversationId: { in: conversationIds } } });
      await tx.activityHistory.deleteMany({ where: { conversationId: { in: conversationIds } } });
      await tx.message.deleteMany({ where: { conversationId: { in: conversationIds } } });
      await tx.conversation.deleteMany({ where: { storeId: id } });
      await tx.lineOfficialAccount.deleteMany({ where: { storeId: id } });
      for (const customerId of customerIds) {
        const remaining = await tx.conversation.count({ where: { customerId } });
        if (remaining === 0) await tx.customer.delete({ where: { id: customerId } });
      }
      await tx.store.delete({ where: { id } });
    });
    return { result: "deleted" as const, message: "Store and related data permanently deleted", relatedCounts };
  }
}
