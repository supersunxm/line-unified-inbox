import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { LineChatNicknameSyncJobStatus } from "@prisma/client";
import { buildLineChatNickname } from "../line-chat-nickname";

export interface EnqueueNicknameSyncResult {
  enqueued: boolean;
  jobId?: string;
  nickname?: string;
  reason?: string;
}

@Injectable()
export class LineChatNicknameQueueService {
  private readonly logger = new Logger(LineChatNicknameQueueService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Enqueues a nickname sync job for a conversation following a BM customer sales save.
   * Fails safe: Never throws or interrupts the main BM sales transaction.
   */
  public async enqueueSalesSync(conversationId: string): Promise<EnqueueNicknameSyncResult> {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          lineOfficialAccountId: true,
          customerSalesStatus: true,
          paymentMethod: true,
          salesRecordedAt: true,
          lineOfficialAccount: {
            select: {
              id: true,
              name: true,
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
          customer: {
            select: {
              id: true,
              lineUserId: true,
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
          `Skipping nickname sync for conversation ${conversationId}: LineChatSession ${oa.lineChatSession.sessionKey} is DISABLED`
        );
        return { enqueued: false, reason: "SESSION_DISABLED" };
      }

      const lineUserId = conversation.customer?.lineUserId?.trim();
      if (!lineUserId) {
        this.logger.debug?.(`Skipping nickname sync for conversation ${conversationId}: No customer LINE User ID found`);
        return { enqueued: false, reason: "MISSING_LINE_USER_ID" };
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

      // Latest-Wins: Supersede any existing pending jobs for this conversation
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

      // Create new PENDING sync job
      const job = await this.prisma.lineChatNicknameSyncJob.create({
        data: {
          conversationId: conversation.id,
          lineOfficialAccountId: conversation.lineOfficialAccountId,
          lineUserId,
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
          lineUserId,
          nickname,
        })
      );

      return { enqueued: true, jobId: job.id, nickname };
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
