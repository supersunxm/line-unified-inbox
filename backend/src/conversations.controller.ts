import { Body, Controller, Get, Param, Patch, Post, Query, Redirect, Req } from "@nestjs/common";
import { ConversationsService } from "./conversations.service";
import { BulkMarkRepliedByFilterDto, BulkMarkRepliedDto, BulkUpdateBmReplyStatusDto, ConversationQueryDto, CreateNoteDto, SendConversationMessageDto, UpdateBmReplyStatusDto, UpdatePriorityDto, UpdateStatusDto } from "./dto";
import { PrismaService } from "./prisma.service";
import { ClassificationService } from "./classification/classification.service";
import { LineProfileService } from "./line-profile.service";
import type { AuthRequest } from "./auth/auth.guard";
import { StoreAccessService } from "./auth/store-access.service";
import { FOCUS_STORE_GROUP_ID } from "./focus-store-group";
import { loadLatestManagerUrls, resolveLineOaManagerUrl } from "./store-master/line-oa-manager-url";
import { LineChatRecentResolverService } from "./line-chat/line-chat-recent-resolver.service";
import type { LineChatDiscoveredChat } from "./line-chat/line-chat.types";

const LINE_CHAT_USER_ID_PATTERN = /^U[0-9a-f]{32}$/iu;
const LINE_MANAGER_HOME = "https://manager.line.biz/";
const LINE_CHAT_CANDIDATE_TIMEOUT_MS = 25_000;

type DirectLineOaConversation = {
  lineOfficialAccountId: string;
  lineChatUserId: string | null;
  lineOfficialAccount: {
    id: string;
    storeId: string | null;
    accountType: string;
    isActive: boolean;
    archivedAt: Date | null;
    chatBotId: string | null;
    lineChatSession: {
      sessionKey: string;
      profileStorageKey: string | null;
      status: string;
    } | null;
  };
};

type WorkerCandidateSnapshot = {
  status: "READY" | "FAILED";
  chats: LineChatDiscoveredChat[];
  pagesFetched: number;
  totalRawRecords: number;
  failureReason?: "SESSION_AUTH" | "TRANSPORT";
};

function buildDirectLineOaManagerUrl(chatBotId: string | null | undefined, lineChatUserId: string | null | undefined): string | null {
  const botId = chatBotId?.trim() ?? "";
  const chatUserId = lineChatUserId?.trim() ?? "";
  if (!LINE_CHAT_USER_ID_PATTERN.test(botId) || !LINE_CHAT_USER_ID_PATTERN.test(chatUserId)) return null;
  return `https://chat.line.biz/${botId}/chat/${chatUserId}`;
}

@Controller("conversations")
export class ConversationsController {
  constructor(
    private readonly service: ConversationsService,
    private readonly prisma: PrismaService,
    private readonly classification: ClassificationService,
    private readonly profiles: LineProfileService,
    private readonly storeAccess: StoreAccessService,
    private readonly lineChatRecentResolver: LineChatRecentResolverService,
  ) { }

  private async fetchWorkerCandidateSnapshot(
    conversation: DirectLineOaConversation,
    force: boolean,
  ): Promise<WorkerCandidateSnapshot | null> {
    const workerUrl = process.env.LINE_CHAT_WORKER_INTERNAL_URL?.trim().replace(/\\\/+$/u, "");
    const workerSecret = process.env.LINE_CHAT_WORKER_INTERNAL_SECRET?.trim();
    const oa = conversation.lineOfficialAccount;
    const session = oa.lineChatSession;
    const botId = oa.chatBotId?.trim();
    if (!workerUrl || !workerSecret || !botId || !session?.sessionKey.trim()) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LINE_CHAT_CANDIDATE_TIMEOUT_MS);
    try {
      const response = await fetch(`${workerUrl}/internal/line-chat/candidates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Line-Chat-Internal-Secret": workerSecret,
        },
        body: JSON.stringify({
          lineOfficialAccountId: conversation.lineOfficialAccountId,
          botId,
          sessionKey: session.sessionKey.trim(),
          profileStorageKey: session.profileStorageKey?.trim() || null,
          force,
        }),
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const body = await response.json() as {
        success?: boolean;
        snapshot?: Partial<WorkerCandidateSnapshot>;
      };
      const snapshot = body.snapshot;
      if (
        !body.success
        || (snapshot?.status !== "READY" && snapshot?.status !== "FAILED")
        || !Array.isArray(snapshot.chats)
      ) return null;
      return {
        status: snapshot.status,
        chats: snapshot.chats,
        pagesFetched: Number(snapshot.pagesFetched ?? 0),
        totalRawRecords: Number(snapshot.totalRawRecords ?? 0),
        failureReason: snapshot.failureReason,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async resolveDirectLineOaManagerUrlOnDemand(
    conversationId: string,
    conversation: DirectLineOaConversation,
  ): Promise<string | null> {
    const oa = conversation.lineOfficialAccount;
    const session = oa.lineChatSession;
    const botId = oa.chatBotId?.trim();
    if (!botId || !session?.sessionKey.trim()) return null;

    for (const force of [false, true]) {
      const snapshot = await this.fetchWorkerCandidateSnapshot(conversation, force);
      if (!snapshot || snapshot.status !== "READY") continue;

      const now = new Date();
      await this.lineChatRecentResolver.applySnapshotMappings({
        lineOfficialAccountId: conversation.lineOfficialAccountId,
        conversationIds: [conversationId],
        snapshot: {
          status: "READY",
          chats: snapshot.chats,
          refreshedAt: now,
          expiresAt: new Date(now.getTime() + 60_000),
          pagesFetched: snapshot.pagesFetched,
          totalRawRecords: snapshot.totalRawRecords,
        },
        eligibility: {
          oaStoreId: oa.storeId,
          oaAccountType: oa.accountType,
          oaIsActive: oa.isActive,
          oaArchivedAt: oa.archivedAt,
          oaChatBotId: oa.chatBotId,
          oaSessionKey: session.sessionKey,
          oaSessionStatus: session.status,
          expectedBotId: botId,
          expectedSessionKey: session.sessionKey,
        },
      });

      const mappedUserId = await this.lineChatRecentResolver.findExistingMapping({
        conversationId,
        lineOfficialAccountId: conversation.lineOfficialAccountId,
      });
      const directUrl = buildDirectLineOaManagerUrl(botId, mappedUserId);
      if (directUrl) return directUrl;
    }
    return null;
  }
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
  @Get(":id/line-oa-manager-url")
  async lineOaManagerUrl(@Param("id") id: string, @Req() req: AuthRequest) {
    await this.storeAccess.assertConversationAccess(req.user!, id);
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      select: {
        lineChatUserId: true,
        lineOfficialAccount: { select: { chatBotId: true } },
      },
    });
    const url = buildDirectLineOaManagerUrl(
      conversation?.lineOfficialAccount.chatBotId,
      conversation?.lineChatUserId,
    );
    return { url, direct: Boolean(url) };
  }
  @Get(":id/open-line-oa-manager")
  @Redirect(LINE_MANAGER_HOME, 302)
  async openLineOaManager(@Param("id") id: string, @Req() req: AuthRequest) {
    await this.storeAccess.assertConversationAccess(req.user!, id);
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      select: {
        lineOfficialAccountId: true,
        lineChatUserId: true,
        lineOfficialAccount: {
          select: {
            id: true,
            storeId: true,
            accountType: true,
            isActive: true,
            archivedAt: true,
            chatBotId: true,
            lineChatSession: {
              select: {
                sessionKey: true,
                profileStorageKey: true,
                status: true,
              },
            },
          },
        },
        store: {
          select: {
            code: true,
            storeMaster: { select: { lineManagerUrl: true } },
          },
        },
      },
    });

    const directUrl = buildDirectLineOaManagerUrl(
      conversation?.lineOfficialAccount.chatBotId,
      conversation?.lineChatUserId,
    );
    if (directUrl) return { url: directUrl, statusCode: 302 };

    if (conversation) {
      const resolvedDirectUrl = await this.resolveDirectLineOaManagerUrlOnDemand(id, conversation);
      if (resolvedDirectUrl) return { url: resolvedDirectUrl, statusCode: 302 };
    }

    if (conversation?.store) {
      const latestManagerUrls = await loadLatestManagerUrls(this.prisma, [conversation.store.code]);
      const fallbackUrl = resolveLineOaManagerUrl(conversation.store, latestManagerUrls);
      if (fallbackUrl) return { url: fallbackUrl, statusCode: 302 };
    }

    return { url: LINE_MANAGER_HOME, statusCode: 302 };
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
  @Post(":id/messages/:messageId/retry") async retryMessage(@Param("id") id: string, @Param("messageId") messageId: string, @Req() req: AuthRequest) {
    await this.storeAccess.assertConversationAccess(req.user!, id);
    return this.service.retryFailedMessage(id, messageId, req.user!);
  }
  @Post(":id/reanalyze") async reanalyze(@Param("id") id: string, @Req() req: AuthRequest) { await this.storeAccess.assertConversationAccess(req.user!, id); await this.classification.analyze(id, true); return this.service.get(id); }
  @Post(":id/refresh-profile") async refreshProfile(@Param("id") id: string, @Req() req: AuthRequest) { await this.storeAccess.assertConversationAccess(req.user!, id); const conversation = await this.service.get(id); return this.profiles.refresh(conversation.customerId, conversation.lineOfficialAccountId, true); }
  @Patch(":id/tags") async tags(@Param("id") id: string, @Body() body: { productModelIds?: string[]; topicIds?: string[] }, @Req() req: AuthRequest) { await this.storeAccess.assertConversationAccess(req.user!, id); return this.service.updateManualTags(id, body.productModelIds ?? [], body.topicIds ?? []); }
  @Get(":id/notes") async notes(@Param("id") id: string, @Req() req: AuthRequest) { await this.storeAccess.assertConversationAccess(req.user!, id); return this.prisma.internalNote.findMany({ where: { conversationId: id }, orderBy: { createdAt: "desc" } }); }
  @Post(":id/notes") async addNote(@Param("id") id: string, @Body() dto: CreateNoteDto, @Req() req: AuthRequest) { await this.storeAccess.assertConversationAccess(req.user!, id); return this.service.addNote(id, dto); }
  @Get(":id/activity") async activity(@Param("id") id: string, @Req() req: AuthRequest) { await this.storeAccess.assertConversationAccess(req.user!, id); return this.prisma.activityHistory.findMany({ where: { conversationId: id }, orderBy: { createdAt: "desc" } }); }
}
