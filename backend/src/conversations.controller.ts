import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ConversationsService } from "./conversations.service";
import { ConversationQueryDto, CreateNoteDto, UpdateBmReplyStatusDto, UpdatePriorityDto, UpdateStatusDto } from "./dto";
import { PrismaService } from "./prisma.service";
import { ClassificationService } from "./classification/classification.service";
import { LineProfileService } from "./line-profile.service";

@Controller("conversations")
export class ConversationsController {
  constructor(private readonly service: ConversationsService, private readonly prisma: PrismaService, private readonly classification: ClassificationService, private readonly profiles: LineProfileService) {}
  @Get() list(@Query() query: ConversationQueryDto) { return this.service.list(query); }
  @Get("bm-reply-status-summary") bmReplyStatusSummary() { return this.service.getBmReplyStatusSummary(); }
  @Get("store-priority-summary") async storePrioritySummary() {
    const summary = await this.service.getBmReplyStatusSummary();
    return {
      stores: summary.stores.map((s) => ({
        id: s.storeId,
        name: s.storeName,
        notReplied: s.notReplied,
        notifiedBm: s.notifiedBm,
        replied: s.replied,
        oldestWaitingMinutes: s.oldestWaitingMinutes,
      })),
    };
  }
  @Get(":id") get(@Param("id") id: string) { return this.service.get(id); }
  @Patch(":id/status") status(@Param("id") id: string, @Body() dto: UpdateStatusDto) { return this.service.updateStatus(id, dto.status); }
  @Patch(":id/bm-reply-status") bmReplyStatus(@Param("id") id: string, @Body() dto: UpdateBmReplyStatusDto) { return this.service.updateBmReplyStatus(id, dto.status); }
  @Patch(":id/priority") priority(@Param("id") id: string, @Body() dto: UpdatePriorityDto) { return this.prisma.conversation.update({ where: { id }, data: { priority: dto.priority, prioritySource: "MANUAL" } }); }
  @Get(":id/messages") messages(@Param("id") id: string, @Query("page") page = "1", @Query("pageSize") pageSize = "30") { return this.service.messages(id, Number(page), Number(pageSize)); }
  @Post(":id/reanalyze") async reanalyze(@Param("id") id: string) { await this.classification.analyze(id, true); return this.service.get(id); }
  @Post(":id/refresh-profile") async refreshProfile(@Param("id") id: string) { const conversation = await this.service.get(id); return this.profiles.refresh(conversation.customerId, conversation.lineOfficialAccountId, true); }
  @Patch(":id/tags") tags(@Param("id") id: string, @Body() body: { productModelIds?: string[]; topicIds?: string[] }) { return this.service.updateManualTags(id, body.productModelIds ?? [], body.topicIds ?? []); }
  @Get(":id/notes") notes(@Param("id") id: string) { return this.prisma.internalNote.findMany({ where: { conversationId: id }, orderBy: { createdAt: "desc" } }); }
  @Post(":id/notes") addNote(@Param("id") id: string, @Body() dto: CreateNoteDto) { return this.service.addNote(id, dto); }
  @Get(":id/activity") activity(@Param("id") id: string) { return this.prisma.activityHistory.findMany({ where: { conversationId: id }, orderBy: { createdAt: "desc" } }); }
}
