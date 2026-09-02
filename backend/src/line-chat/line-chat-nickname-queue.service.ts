import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { LineChatNicknameSyncJobStatus } from "@prisma/client";
import { buildLineChatNickname } from "../line-chat-nickname";
import {
  LINE_CHAT_REALTIME_RESOLVER_ALLOWED_STORE_CODES,
} from "./line-chat-pilot.constants";

export function isLineChatRealtimeResolverEligible(params: {
  storeCode: string;
  conversationStoreId: string | null;
  oaStoreId: string | null;
  oaAccountType: string | null;
  oaIsActive: boolean;
  oaArchivedAt: Date | null;
  oaChatBotId: string | null;
  oaSessionKey: string | null;
  oaSessionStatus: string | null;
  oaSyncEnabled: boolean;
}): boolean {
  if (!params.oaSyncEnabled) {
    return false;
  }
  if (!params.conversationStoreId || !params.oaStoreId || params.conversationStoreId !== params.oaStoreId) {
    return false;
  }
  if (params.oaAccountType !== "STORE") {
    return false;
  }
  if (!params.oaIsActive || params.oaArchivedAt !== null) {
    return false;
  }
  if (!params.oaChatBotId || !params.oaSessionKey || params.oaSessionStatus === "DISABLED") {
    return false;
  }

  const cleanStoreCode = params.storeCode.trim();
  return (LINE_CHAT_REALTIME_RESOLVER_ALLOWED_STORE_CODES as readonly string[]).includes(cleanStoreCode);
}

export interface EnqueueNicknameSyncResult {
  enqueued: boolean;
  jobId?: string;
  nickname?: string;
  reason?: string;
  supersededCount?: number;
  existingJobStatus?: LineChatNicknameSyncJobStatus;
}

export interface EnqueueNicknameSyncOptions {
  skipIfMatchingJobExists?: boolean;
}

@Injectable()
export class LineChatNicknameQueueService {
  private readonly logger = new Logger(LineChatNicknameQueueService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Enqueues a nickname sync job for a conversation following a BM customer sales save.
   * Fails safe: Never throws or interrupts the main BM sales transaction.
   */
  public async enqueueSalesSync(
    conversationId: string,
    options: EnqueueNicknameSyncOptions = {},
  ): Promise<EnqueueNicknameSyncResult> {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          storeId: true,
          lineOfficialAccountId: true,
          lineChatUserId: true,
          customerSalesStatus: true,
          paymentMethod: true,
          salesRecordedAt: true,
          store: {
            select: {
              code: true,
              storeMaster: { select: { externalStoreId: true } },
            },
          },
          lineOfficialAccount: {
            select: {
              id: true,
              name: true,
              storeId: true,
              accountType: true,
              isActive: true,
              archivedAt: true,
              chatBotId: true,
              lineChatSessionId: true,
              lineChatNicknameSyncEnabled: true,
              lineChatSession: {
                select: {
                  id: true,
                  sessionKey: true,
                  status: true,
                },
              },
            },
          },
          salesProducts: {
            select: {
              customProductName: true,
              productModel: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!conversation) {
        this.logger.warn(`Cannot enqueue nickname sync: Conversation ${conversationId} not found`);
        return { enqueued: false, reason: "CONVERSATION_NOT_FOUND" };
      }

      const oa = conversation.lineOfficialAccount;
      if (!oa?.lineChatNicknameSyncEnabled) {
        this.logger.debug?.(
          `Skipping nickname sync for conversation ${conversationId}: LineOfficialAccount ${oa?.id ?? "unknown"} has lineChatNicknameSyncEnabled = false`
        );
        return { enqueued: false, reason: "ROLLOUT_DISABLED" };
      }

      const chatBotId = oa.chatBotId?.trim();
      const sessionId = oa.lineChatSessionId;
      if (!chatBotId || !sessionId) {
        this.logger.warn(
          `Skipping nickname sync for conversation ${conversationId}: LineOfficialAccount ${oa.id} is missing chatBotId or lineChatSessionId`
        );
        return { enqueued: false, reason: "MISSING_OA_MAPPING" };
      }

      if (oa.lineChatSession?.status === "DISABLED") {
        this.logger.warn(
          `Skipping nickname sync for conversation ${conversationId}: linked LineChatSession is DISABLED`
        );
        return { enqueued: false, reason: "SESSION_DISABLED" };
      }

      const nickname = buildLineChatNickname({
        status: conversation.customerSalesStatus,
        paymentMethod: conversation.paymentMethod,
        recordedAt: conversation.salesRecordedAt,
        products: (conversation.salesProducts || []).map((sp) => ({
          customProductName: sp.customProductName,
          model: sp.productModel ? { name: sp.productModel.name } : null,
        })),
      });

      if (!nickname) {
        // If state changed to a non-nickname state (e.g. INTERESTED), supersede pending jobs
        await this.prisma.lineChatNicknameSyncJob.updateMany({
          where: {
            conversationId: conversation.id,
            status: LineChatNicknameSyncJobStatus.PENDING,
          },
          data: {
            status: LineChatNicknameSyncJobStatus.SUPERSEDED,
            processedAt: new Date(),
          },
        });

        this.logger.log(
          JSON.stringify({
            event: "line_chat_nickname_job_skipped",
            conversationId: conversation.id,
            salesStatus: conversation.customerSalesStatus,
            paymentMethod: conversation.paymentMethod,
            reason: "no_nickname_needed",
          })
        );
        return { enqueued: false, reason: "NO_NICKNAME_NEEDED" };
      }

      const lineChatUserId = conversation.lineChatUserId?.trim() || null;
      const storeCode = conversation.store?.code?.trim()
        || conversation.store?.storeMaster?.externalStoreId?.trim()
        || "";
      const realtimeResolverEligible = isLineChatRealtimeResolverEligible({
        storeCode,
        conversationStoreId: conversation.storeId,
        oaStoreId: oa.storeId,
        oaAccountType: oa.accountType,
        oaIsActive: oa.isActive,
        oaArchivedAt: oa.archivedAt,
        oaChatBotId: chatBotId,
        oaSessionKey: oa.lineChatSession?.sessionKey.trim() || null,
        oaSessionStatus: oa.lineChatSession?.status || null,
        oaSyncEnabled: oa.lineChatNicknameSyncEnabled,
      });
      if (!lineChatUserId && !realtimeResolverEligible) {
        this.logger.log(
          JSON.stringify({
            event: "line_chat_nickname_job_skipped",
            conversationId: conversation.id,
            reason: "missing_line_chat_user_id",
          })
        );
        return { enqueued: false, reason: "MISSING_LINE_CHAT_USER_ID" };
      }

      if (options.skipIfMatchingJobExists) {
        const existingJob = await this.prisma.lineChatNicknameSyncJob.findFirst({
          where: {
            conversationId: conversation.id,
            nickname,
            status: { not: LineChatNicknameSyncJobStatus.SUPERSEDED },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true },
        });

        if (existingJob) {
          this.logger.log(
            JSON.stringify({
              event: "line_chat_nickname_job_skipped_matching_job_exists",
              conversationId: conversation.id,
              existingJobId: existingJob.id,
              existingJobStatus: existingJob.status,
              nickname,
            })
          );
          return {
            enqueued: false,
            nickname,
            reason: "MATCHING_JOB_EXISTS",
            existingJobStatus: existingJob.status,
          };
        }
      }

      // Latest-Wins: Supersede any existing pending jobs for this conversation
      const superseded = await this.prisma.lineChatNicknameSyncJob.updateMany({
        where: {
          conversationId: conversation.id,
          status: LineChatNicknameSyncJobStatus.PENDING,
        },
        data: {
          status: LineChatNicknameSyncJobStatus.SUPERSEDED,
          processedAt: new Date(),
        },
      });

      // Create new PENDING sync job
      const job = await this.prisma.lineChatNicknameSyncJob.create({
        data: {
          conversationId: conversation.id,
          lineOfficialAccountId: conversation.lineOfficialAccountId,
          lineChatUserId,
          lineUserId: lineChatUserId,
          nickname,
          status: LineChatNicknameSyncJobStatus.PENDING,
        },
      });

      this.logger.log(
        JSON.stringify({
          event: "line_chat_nickname_job_created",
          jobId: job.id,
          conversationId: conversation.id,
          lineOfficialAccountId: conversation.lineOfficialAccountId,
          chatMappingPresent: Boolean(lineChatUserId),
          nickname,
        })
      );

      return {
        enqueued: true,
        jobId: job.id,
        nickname,
        supersededCount: superseded.count,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        JSON.stringify({
          event: "line_chat_nickname_enqueue_failed",
          conversationId,
          error: errorMsg,
        })
      );
      // Fails safe: Return false rather than throwing
      return { enqueued: false, reason: errorMsg };
    }
  }
}
