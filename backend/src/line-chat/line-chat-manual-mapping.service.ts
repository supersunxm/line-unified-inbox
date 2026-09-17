import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  ActivityActionType,
  LineChatNicknameSyncJobStatus,
  MessageDirection,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { LineChatRecentResolverService } from "./line-chat-recent-resolver.service";
import { LineChatSessionService } from "./line-chat-session.service";

export interface UnresolvedMappingItem {
  conversationId: string;
  jobId: string | null;
  customerDisplayName: string;
  storeId: string | null;
  storeName: string;
  storeCode: string;
  lineOfficialAccountId: string;
  lineOfficialAccountName: string;
  latestMessageAt: string;
  latestInboundMessage: {
    text: string;
    sentAt: string;
  } | null;
  mappingReason: "RESOLVE_NO_MATCH" | "RESOLVE_AMBIGUOUS" | "RESOLVE_CONFLICT" | "UNRESOLVED";
  customerSalesStatus: string | null;
  paymentMethod: string | null;
  salesRecordedAt: string | null;
  nicknameTarget: string | null;
}

export interface CandidateChatInfo {
  chatUserId: string;
  displayName: string | null;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  lastMessageDirection: string | null;
  confidence: "EXACT_NAME" | "AMBIGUOUS_NAME" | "SEARCH_MATCH" | "RECENT_CANDIDATE";
  matchReason: string;
  conflict: {
    conflictingConversationId: string;
    conflictingCustomerName: string;
  } | null;
}

export interface MappingCandidatesResult {
  conversation: {
    id: string;
    customerDisplayName: string;
    storeName: string;
    storeCode: string;
    lineOfficialAccountId: string;
    lineOfficialAccountName: string;
    currentLineChatUserId: string | null;
    mappingSource: string | null;
    salesStatus: string | null;
    recentMessages: Array<{
      id: string;
      direction: MessageDirection;
      text: string;
      sentAt: string;
    }>;
  };
  candidates: CandidateChatInfo[];
  totalDiscovered: number;
}

export interface BindManualMappingInput {
  conversationId: string;
  lineOfficialAccountId: string;
  lineChatUserId: string;
  operatorId?: string;
  operatorDisplayName?: string;
  overrideConflict?: boolean;
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}

@Injectable()
export class LineChatManualMappingService {
  private readonly logger = new Logger(LineChatManualMappingService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LineChatRecentResolverService)
    private readonly recentResolver: LineChatRecentResolverService,
    @Inject(LineChatSessionService)
    private readonly sessionService: LineChatSessionService,
  ) {}

  /**
   * Retrieves all conversations currently waiting for LINE chat identity mapping.
   */
  public async getUnresolvedBacklog(): Promise<UnresolvedMappingItem[]> {
    // Query pending nickname sync jobs that lack a durable lineChatUserId on both the job and conversation
    const pendingJobs = await this.prisma.lineChatNicknameSyncJob.findMany({
      where: {
        status: LineChatNicknameSyncJobStatus.PENDING,
        lineChatUserId: null,
        conversation: { lineChatUserId: null },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        conversationId: true,
        nickname: true,
        lastError: true,
        createdAt: true,
        conversation: {
          select: {
            id: true,
            customerSalesStatus: true,
            paymentMethod: true,
            salesRecordedAt: true,
            latestMessageAt: true,
            customer: { select: { displayName: true } },
            store: {
              select: {
                id: true,
                name: true,
                code: true,
                storeMaster: { select: { externalStoreId: true } },
              },
            },
            lineOfficialAccount: { select: { id: true, name: true } },
            messages: {
              where: { direction: MessageDirection.INBOUND },
              orderBy: { sentAt: "desc" },
              take: 1,
              select: { originalText: true, sentAt: true },
            },
          },
        },
      },
    });

    const seenConversationIds = new Set<string>();
    const items: UnresolvedMappingItem[] = [];

    for (const job of pendingJobs) {
      if (seenConversationIds.has(job.conversationId)) continue;
      seenConversationIds.add(job.conversationId);

      const conv = job.conversation;
      const rawReason = job.lastError?.trim() ?? "";
      const mappingReason: UnresolvedMappingItem["mappingReason"] =
        rawReason === "RESOLVE_NO_MATCH" ||
        rawReason === "RESOLVE_AMBIGUOUS" ||
        rawReason === "RESOLVE_CONFLICT"
          ? rawReason
          : "UNRESOLVED";

      const storeCode = conv.store?.code?.trim() || conv.store?.storeMaster?.externalStoreId?.trim() || "";
      const latestInbound = conv.messages[0];

      items.push({
        conversationId: conv.id,
        jobId: job.id,
        customerDisplayName: conv.customer.displayName,
        storeId: conv.store?.id ?? null,
        storeName: conv.store?.name || "N/A",
        storeCode,
        lineOfficialAccountId: conv.lineOfficialAccount.id,
        lineOfficialAccountName: conv.lineOfficialAccount.name,
        latestMessageAt: conv.latestMessageAt.toISOString(),
        latestInboundMessage: latestInbound
          ? {
              text: latestInbound.originalText,
              sentAt: latestInbound.sentAt.toISOString(),
            }
          : null,
        mappingReason,
        customerSalesStatus: conv.customerSalesStatus,
        paymentMethod: conv.paymentMethod,
        salesRecordedAt: conv.salesRecordedAt?.toISOString() ?? null,
        nicknameTarget: job.nickname,
      });
    }

    return items;
  }

  /**
   * Retrieves candidate LINE Chat accounts for a specific conversation within the SAME LINE OA.
   */
  public async getMappingCandidates(
    conversationId: string,
    search?: string,
  ): Promise<MappingCandidatesResult> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        customer: { select: { displayName: true } },
        store: {
          select: {
            id: true,
            name: true,
            code: true,
            storeMaster: { select: { externalStoreId: true } },
          },
        },
        lineOfficialAccount: {
          select: {
            id: true,
            name: true,
            chatBotId: true,
            lineChatSession: {
              select: {
                id: true,
                sessionKey: true,
                profilePath: true,
                profileStorageKey: true,
                status: true,
              },
            },
          },
        },
        messages: {
          orderBy: { sentAt: "desc" },
          take: 10,
          select: {
            id: true,
            direction: true,
            originalText: true,
            sentAt: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException("ไม่พบการสนทนา");
    }

    const oa = conversation.lineOfficialAccount;
    const session = oa.lineChatSession;
    if (!oa.chatBotId?.trim() || !session) {
      throw new BadRequestException("LINE Official Account นี้ยังไม่ได้เชื่อมโยงกับ LINE Chat Session");
    }

    const profilePath = this.sessionService.resolveProfilePath(session);
    let snapshot = await this.recentResolver.refreshSnapshot({
      lineOfficialAccountId: oa.id,
      botId: oa.chatBotId.trim(),
      sessionKey: session.sessionKey,
      profilePath,
      force: false,
    });

    // If initial cached snapshot is empty or failed, attempt a forced refresh
    if (snapshot.status === "FAILED" || snapshot.chats.length === 0) {
      snapshot = await this.recentResolver.refreshSnapshot({
        lineOfficialAccountId: oa.id,
        botId: oa.chatBotId.trim(),
        sessionKey: session.sessionKey,
        profilePath,
        force: true,
      });
    }

    const chats = snapshot.chats;
    const cleanSearch = search?.trim().toLowerCase() || "";
    const targetNormalizedName = normalizeName(conversation.customer.displayName);

    // Find all chats with exact same name to detect ambiguity
    const exactNameCount = chats.filter(
      (c) => normalizeName(c.displayName) === targetNormalizedName,
    ).length;

    // Check which candidate chat user IDs are already assigned to active conversations in this same OA
    const candidateChatUserIds = chats.map((c) => c.chatUserId).filter(Boolean);
    const existingMappings = candidateChatUserIds.length
      ? await this.prisma.conversation.findMany({
          where: {
            lineOfficialAccountId: oa.id,
            lineChatUserId: { in: candidateChatUserIds },
          },
          select: {
            id: true,
            lineChatUserId: true,
            customer: { select: { displayName: true } },
          },
        })
      : [];

    const existingByChatUserId = new Map<string, { id: string; customerName: string }>();
    for (const m of existingMappings) {
      if (m.lineChatUserId && m.id !== conversation.id) {
        existingByChatUserId.set(m.lineChatUserId, {
          id: m.id,
          customerName: m.customer.displayName,
        });
      }
    }

    const candidateInfos: CandidateChatInfo[] = [];

    for (const chat of chats) {
      const chatNormName = normalizeName(chat.displayName);
      const isSearchMatch =
        cleanSearch &&
        (chatNormName.includes(cleanSearch) ||
          chat.chatUserId.toLowerCase().includes(cleanSearch) ||
          (chat.lastMessageText?.toLowerCase().includes(cleanSearch) ?? false));

      if (cleanSearch && !isSearchMatch) {
        continue;
      }

      let confidence: CandidateChatInfo["confidence"] = "RECENT_CANDIDATE";
      let matchReason = "การสนทนาล่าสุดใน LINE OA Manager";

      if (chatNormName === targetNormalizedName) {
        if (exactNameCount > 1) {
          confidence = "AMBIGUOUS_NAME";
          matchReason = `ชื่อตรงกับลูกค้า (${chat.displayName}) แต่พบ ${exactNameCount} รายการที่ชื่อตรงกัน`;
        } else {
          confidence = "EXACT_NAME";
          matchReason = `ชื่อตรงกับลูกค้าในระบบ (${chat.displayName})`;
        }
      } else if (cleanSearch) {
        confidence = "SEARCH_MATCH";
        matchReason = `ตรงกับคำค้นหา "${cleanSearch}"`;
      }

      const conflictInfo = existingByChatUserId.get(chat.chatUserId) || null;

      candidateInfos.push({
        chatUserId: chat.chatUserId,
        displayName: chat.displayName,
        lastMessageText: chat.lastMessageText,
        lastMessageAt: chat.lastMessageAt,
        lastMessageDirection: chat.lastMessageDirection,
        confidence,
        matchReason,
        conflict: conflictInfo
          ? {
              conflictingConversationId: conflictInfo.id,
              conflictingCustomerName: conflictInfo.customerName,
            }
          : null,
      });
    }

    // Sort: exact/ambiguous name matches first, then search matches, then by latest timestamp
    candidateInfos.sort((a, b) => {
      const score = (item: CandidateChatInfo) => {
        if (item.confidence === "EXACT_NAME") return 4;
        if (item.confidence === "AMBIGUOUS_NAME") return 3;
        if (item.confidence === "SEARCH_MATCH") return 2;
        return 1;
      };
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return timeB - timeA;
    });

    const storeCode =
      conversation.store?.code?.trim() ||
      conversation.store?.storeMaster?.externalStoreId?.trim() ||
      "";

    return {
      conversation: {
        id: conversation.id,
        customerDisplayName: conversation.customer.displayName,
        storeName: conversation.store?.name || "N/A",
        storeCode,
        lineOfficialAccountId: oa.id,
        lineOfficialAccountName: oa.name,
        currentLineChatUserId: conversation.lineChatUserId,
        mappingSource: conversation.lineChatMappingSource,
        salesStatus: conversation.customerSalesStatus,
        recentMessages: conversation.messages.map((m) => ({
          id: m.id,
          direction: m.direction,
          text: m.originalText,
          sentAt: m.sentAt.toISOString(),
        })),
      },
      candidates: candidateInfos,
      totalDiscovered: chats.length,
    };
  }

  /**
   * Binds a manual identity mapping between an internal Conversation and a LINE Chat customer.
   */
  public async bindManualMapping(input: BindManualMappingInput): Promise<{
    success: boolean;
    conversationId: string;
    lineChatUserId: string;
    mappedAt: string;
  }> {
    const conversationId = input.conversationId.trim();
    const lineOfficialAccountId = input.lineOfficialAccountId.trim();
    const targetLineChatUserId = input.lineChatUserId.trim();

    if (!conversationId || !lineOfficialAccountId || !targetLineChatUserId) {
      throw new BadRequestException("ข้อมูลสำหรับการ Manual Mapping ไม่ครบถ้วน");
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        customer: true,
        store: true,
        lineOfficialAccount: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException("ไม่พบการสนทนา");
    }

    // Strictly enforce same-OA isolation: conversation must belong to target OA
    if (conversation.lineOfficialAccountId !== lineOfficialAccountId) {
      throw new BadRequestException("ไม่สามารถผูกการสนทนาข้าม LINE Official Account หรือข้ามสาขาได้");
    }

    // Check conflict: is this lineChatUserId already assigned to another conversation in this same OA?
    const conflict = await this.prisma.conversation.findFirst({
      where: {
        lineOfficialAccountId,
        lineChatUserId: targetLineChatUserId,
        id: { not: conversationId },
      },
      select: {
        id: true,
        customer: { select: { displayName: true } },
      },
    });

    if (conflict && !input.overrideConflict) {
      throw new ConflictException({
        message: `LINE Chat ลูกค้านี้ถูกจับคู่อยู่กับการสนทนาอื่นแล้ว (${conflict.customer.displayName}) หากต้องการย้ายการจับคู่ กรุณายืนยันการแทนที่ (override)`,
        conflictingConversationId: conflict.id,
        conflictingCustomerName: conflict.customer.displayName,
      });
    }

    const now = new Date();

    await this.prisma.$transaction(
      async (tx) => {
        // If conflict override is requested, clear the old mapping from conflicting conversation
        if (conflict && input.overrideConflict) {
          await tx.conversation.update({
            where: { id: conflict.id },
            data: {
              lineChatUserId: null,
              lineChatMappingSource: null,
              lineChatMappedAt: null,
              lineChatMappedById: null,
            },
          });

          await tx.activityHistory.create({
            data: {
              conversationId: conflict.id,
              actionType: ActivityActionType.STATUS_CHANGED,
              createdByUserId: input.operatorId || null,
              createdByName: input.operatorDisplayName?.trim() || "Admin",
              description: `LINE Chat identity reallocated to conversation ${conversationId} by admin; cleared lineChatUserId=${targetLineChatUserId}`,
              metadata: {
                action: "LINE_CHAT_MAPPING_OVERRIDDEN",
                reassignedToConversationId: conversationId,
                lineChatUserId: targetLineChatUserId,
              },
            },
          });
        }

        // Apply manual mapping to target conversation
        await tx.conversation.update({
          where: { id: conversationId },
          data: {
            lineChatUserId: targetLineChatUserId,
            lineChatMappingSource: "MANUAL",
            lineChatMappedAt: now,
            lineChatMappedById: input.operatorId || null,
          },
        });

        // Immediately update any pending nickname sync jobs for this conversation
        await tx.lineChatNicknameSyncJob.updateMany({
          where: {
            conversationId,
            status: LineChatNicknameSyncJobStatus.PENDING,
          },
          data: {
            lineChatUserId: targetLineChatUserId,
            lineUserId: targetLineChatUserId,
            lastError: null,
            scheduledAt: now,
          },
        });

        // Record audit trails
        await tx.activityHistory.create({
          data: {
            conversationId,
            actionType: ActivityActionType.STATUS_CHANGED,
            createdByUserId: input.operatorId || null,
            createdByName: input.operatorDisplayName?.trim() || "Admin",
            description: `Manual LINE Chat mapping confirmed by admin (${input.operatorDisplayName?.trim() || "Admin"}); lineChatUserId=${targetLineChatUserId}`,
            metadata: {
              source: "MANUAL",
              lineChatUserId: targetLineChatUserId,
              lineOfficialAccountId,
              previousLineChatUserId: conversation.lineChatUserId,
              overrideConflict: Boolean(input.overrideConflict),
            },
          },
        });

        await tx.auditLog.create({
          data: {
            action: "LINE_CHAT_MANUAL_MAPPING",
            actorUserId: input.operatorId || null,
            metadata: {
              conversationId,
              lineOfficialAccountId,
              lineChatUserId: targetLineChatUserId,
              previousLineChatUserId: conversation.lineChatUserId,
              overrideConflict: Boolean(input.overrideConflict),
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.logger.log(
      JSON.stringify({
        event: "line_chat_manual_mapping_confirmed",
        conversationId,
        lineOfficialAccountId,
        lineChatUserId: targetLineChatUserId,
        operatorId: input.operatorId || null,
        overrideConflict: Boolean(input.overrideConflict),
      }),
    );

    return {
      success: true,
      conversationId,
      lineChatUserId: targetLineChatUserId,
      mappedAt: now.toISOString(),
    };
  }
}
