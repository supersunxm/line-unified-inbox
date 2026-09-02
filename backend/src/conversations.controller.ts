import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ConversationsService } from "./conversations.service";
import { BulkMarkRepliedByFilterDto, BulkMarkRepliedDto, BulkUpdateBmReplyStatusDto, ConversationQueryDto, CreateNoteDto, SendConversationMessageDto, UpdateBmReplyStatusDto, UpdatePriorityDto, UpdateStatusDto } from "./dto";
import { PrismaService } from "./prisma.service";
import { ClassificationService } from "./classification/classification.service";
import { LineProfileService } from "./line-profile.service";
import type { AuthRequest } from "./auth/auth.guard";
import { StoreAccessService } from "./auth/store-access.service";
import { FOCUS_STORE_GROUP_ID } from "./focus-store-group";

@Controller("conversations")
export class ConversationsController {
  constructor(private readonly service: ConversationsService, private readonly prisma: PrismaService, private readonly classification: ClassificationService, private readonly profiles: LineProfileService, private readonly storeAccess: StoreAccessService) { }
  @Get() async list(@Query() query: ConversationQueryDto, @Req() req: AuthRequest) {
    const storeIds = await this.storeAccess.accessibleStoreIds(req.user!);
    if (query.storeId && query.storeId !== FOCUS_STORE_GROUP_ID) await this.storeAccess.assertStoreAccess(req.user!, query.storeId);
    return this.service.list(query, storeIds);
  }
  @Get("bm-reply-status-summary") async bmReplyStatusSummary(@Req() req: AuthRequest) {
    const accessibleStoreIds = await this.storeAccess.accessibleStoreIds(req.user!);
    return this.service.getBmReplyStatusSummary(accessibleStoreIds);
  }
  @Get("store-priority-summary") async storePrioritySummary(@Req() req: AuthRequest) {
    const accessibleStoreIds = await this.storeAccess.accessibleStoreIds(req.user!);
    const summary = await this.service.getBmReplyStatusSummary(accessibleStoreIds);
    return {
      stores: summary.stores.filter((s) => s.storeId !== FOCUS_STORE_GROUP_ID).map((s) => ({
        id: s.storeId,
        name: s.storeName,
        notReplied: s.notReplied,
        notifiedBm: s.notifiedBm,
        replied: s.replied,
        oldestWaitingMinutes: s.oldestWaitingMinutes,
      })),
    };
  }
  @Post("bulk-mark-replied")
  async bulkMarkReplied(@Body() dto: BulkMarkRepliedDto, @Req() req: AuthRequest) {
    return this.service.bulkMarkReplied(dto.conversationIds, req.user!);
  }
  @Post("bulk-mark-replied-by-filter")
  async bulkMarkRepliedByFilter(@Body() dto: BulkMarkRepliedByFilterDto, @Req() req: AuthRequest) {
    return this.service.bulkMarkRepliedByFilter(dto, req.user!);
  }
  @Patch("bm-reply-status/bulk")
  async bulkBmReplyStatus(@Body() dto: BulkUpdateBmReplyStatusDto, @Req() req: AuthRequest) {
    await this.storeAccess.assertStoreAccess(req.user!, dto.storeId);
    const actingAdmin = req.user?.displayName || req.user?.email || "ADMIN";
    return this.service.bulkUpdateBmReplyStatus(dto, actingAdmin);
  }
  @Get(":id") async get(@Param("id") id: string, @Req() req: AuthRequest) { await this.storeAccess.assertConversationAccess(req.user!, id); return this.service.get(id); }
  @Patch(":id/status") async status(@Param("id") id: string, @Body() dto: UpdateStatusDto, @Req() req: AuthRequest) {
    await this.storeAccess.assertConversationAccess(req.user!, id);
    if (dto.bmReplyStatus) return this.service.updateBmReplyStatus(id, dto.bmReplyStatus);
    return this.service.updateStatus(id, dto.status ?? "FOLLOW_UP");
  }
  @Patch(":id/bm-reply-status") async bmReplyStatus(@Param("id") id: string, @Body() dto: UpdateBmReplyStatusDto, @Req() req: AuthRequest) {
    await this.storeAccess.assertConversationAccess(req.user!, id);
    const targetStatus = dto.status ?? dto.bmReplyStatus ?? "NOT_REPLIED";
    return this.service.updateBmReplyStatus(id, targetStatus);
  }
  @Patch(":id/owner") async owner(@Param("id") id: string, @Body() body: { userId?: string | null }, @Req() req: AuthRequest) {
    return this.service.updateOwner(id, body.userId ?? null, req.user!);
  }
  @Patch(":id/priority") async priority(@Param("id") id: string, @Body() dto: UpdatePriorityDto, @Req() req: AuthRequest) { await this.storeAccess.assertConversationAccess(req.user!, id); return this.prisma.conversation.update({ where: { id }, data: { priority: dto.priority, prioritySource: "MANUAL" } }); }
  @Get(":id/messages") async messages(@Param("id") id: string, @Query("page") page = "1", @Query("pageSize") pageSize = "30", @Req() req: AuthRequest) { await this.storeAccess.assertConversationAccess(req.user!, id); return this.service.messages(id, Number(page), Number(pageSize)); }
  @Post(":id/messages") async sendMessage(@Param("id") id: string, @Body() dto: SendConversationMessageDto, @Req() req: AuthRequest) {
    await this.storeAccess.assertConversationAccess(req.user!, id);
    return this.service.sendMessage(id, dto, req.user!);
  }
  @Post(":id/reanalyze") async reanalyze(@Param("id") id: string, @Req() req: AuthRequest) { await this.storeAccess.assertConversationAccess(req.user!, id); await this.classification.analyze(id, true); return this.service.get(id); }
  @Post(":id/refresh-profile") async refreshProfile(@Param("id") id: string, @Req() req: AuthRequest) { await this.storeAccess.assertConversationAccess(req.user!, id); const conversation = await this.service.get(id); return this.profiles.refresh(conversation.customerId, conversation.lineOfficialAccountId, true); }
  @Patch(":id/tags") async tags(@Param("id") id: string, @Body() body: { productModelIds?: string[]; topicIds?: string[] }, @Req() req: AuthRequest) { await this.storeAccess.assertConversationAccess(req.user!, id); return this.service.updateManualTags(id, body.productModelIds ?? [], body.topicIds ?? []); }
  @Get(":id/notes") async notes(@Param("id") id: string, @Req() req: AuthRequest) { await this.storeAccess.assertConversationAccess(req.user!, id); return this.prisma.internalNote.findMany({ where: { conversationId: id }, orderBy: { createdAt: "desc" } }); }
  @Post(":id/notes") async addNote(@Param("id") id: string, @Body() dto: CreateNoteDto, @Req() req: AuthRequest) { await this.storeAccess.assertConversationAccess(req.user!, id); return this.service.addNote(id, dto); }
  @Get(":id/activity") async activity(@Param("id") id: string, @Req() req: AuthRequest) { await this.storeAccess.assertConversationAccess(req.user!, id); return this.prisma.activityHistory.findMany({ where: { conversationId: id }, orderBy: { createdAt: "desc" } }); }
}
