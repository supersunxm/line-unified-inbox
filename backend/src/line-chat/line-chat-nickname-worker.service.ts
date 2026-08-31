import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { LineChatNicknameSyncJobStatus, LineChatSessionStatus } from "@prisma/client";
import { LineChatSessionService } from "./line-chat-session.service";
import { hostname } from "node:os";

const WORKER_POLL_INTERVAL_MS = 3_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const LEASE_DURATION_MS = 60_000; // 1 minute per job execution lease
const STUCK_JOB_TIMEOUT_MS = 5 * 60_000; // 5 minutes max stuck duration

@Injectable()
export class LineChatNicknameWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LineChatNicknameWorkerService.name);
  private readonly workerId = `${process.env.RAILWAY_REPLICA_ID || hostname()}-${process.pid}`;
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LineChatSessionService) private readonly sessionService: LineChatSessionService
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV !== "test" && process.env.DISABLE_NICKNAME_WORKER !== "true") {
      this.timer = setInterval(() => void this.processQueueCycle(), WORKER_POLL_INTERVAL_MS);
      void this.processQueueCycle();
    }
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Recovers jobs that were stuck in PROCESSING due to worker crashes or timeouts.
   */
  public async recoverStuckJobs(): Promise<number> {
    try {
      const threshold = new Date(Date.now() - STUCK_JOB_TIMEOUT_MS);
      const now = new Date();

      const stuckJobs = await this.prisma.lineChatNicknameSyncJob.findMany({
        where: {
          status: LineChatNicknameSyncJobStatus.PROCESSING,
          OR: [
            { lockedUntil: { lt: now } },
            { lockedUntil: null, claimedAt: { lt: threshold } },
          ],
        },
        take: 20,
      });

      let recovered = 0;
      for (const job of stuckJobs) {
        const nextAttempts = job.attemptCount + 1;
        const maxAttempts = job.maxAttempts || DEFAULT_MAX_ATTEMPTS;

        if (nextAttempts >= maxAttempts) {
          await this.prisma.lineChatNicknameSyncJob.update({
            where: { id: job.id },
            data: {
              status: LineChatNicknameSyncJobStatus.FAILED,
              processedAt: new Date(),
              lastError: "Job timed out and exceeded maximum recovery attempts",
            },
          });
        } else {
          await this.prisma.lineChatNicknameSyncJob.update({
            where: { id: job.id },
            data: {
              status: LineChatNicknameSyncJobStatus.PENDING,
              attemptCount: { increment: 1 },
              lockedUntil: null,
              workerId: null,
              scheduledAt: new Date(Date.now() + 10_000), // Retry in 10s
              lastError: "Worker lease expired or worker crashed; resetting to PENDING",
            },
          });
        }
        recovered++;
      }

      if (recovered > 0) {
        this.logger.warn(
          JSON.stringify({
            event: "line_chat_nickname_stuck_jobs_recovered",
            count: recovered,
          })
        );
      }
      return recovered;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        JSON.stringify({
          event: "line_chat_nickname_recovery_failed",
          error: errorMsg,
        })
      );
      return 0;
    }
  }

  /**
   * Main processing cycle: claims and processes pending nickname jobs.
   */
  public async processQueueCycle(limit = 10): Promise<number> {
    if (this.isProcessing) {
      return 0;
    }
    this.isProcessing = true;

    try {
      // Step 1: Recover any stuck/crashed jobs
      await this.recoverStuckJobs();

      const now = new Date();
      const pendingJobs = await this.prisma.lineChatNicknameSyncJob.findMany({
        where: {
          status: LineChatNicknameSyncJobStatus.PENDING,
          scheduledAt: { lte: now },
        },
        orderBy: { createdAt: "asc" },
        take: Math.min(50, Math.max(1, limit)),
      });

      let processedCount = 0;

      for (const job of pendingJobs) {
        const lockedUntil = new Date(Date.now() + LEASE_DURATION_MS);

        // Atomic claim with lease and worker ID
        const claimResult = await this.prisma.lineChatNicknameSyncJob.updateMany({
          where: {
            id: job.id,
            status: LineChatNicknameSyncJobStatus.PENDING,
          },
          data: {
            status: LineChatNicknameSyncJobStatus.PROCESSING,
            claimedAt: now,
            workerId: this.workerId,
            lockedUntil,
          },
        });

        if (claimResult.count === 0) {
          continue; // Claimed by another worker
        }

        await this.processSingleJob(job.id);
        processedCount++;

        // Inter-request delay if configured
        const syncDelayMs = Number(process.env.LINE_CHAT_SYNC_DELAY_MS || "0");
        if (syncDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, syncDelayMs));
        }
      }

      return processedCount;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        JSON.stringify({
          event: "line_chat_nickname_worker_cycle_failed",
          error: errorMsg,
        })
      );
      return 0;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Processes a single claimed job.
   */
  public async processSingleJob(jobId: string): Promise<void> {
    const job = await this.prisma.lineChatNicknameSyncJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return;
    }

    // Latest-Wins double guard: Check if a newer job exists for the same conversation
    const newerJob = await this.prisma.lineChatNicknameSyncJob.findFirst({
      where: {
        conversationId: job.conversationId,
        createdAt: { gt: job.createdAt },
      },
    });

    if (newerJob) {
      await this.prisma.lineChatNicknameSyncJob.update({
        where: { id: job.id },
        data: {
          status: LineChatNicknameSyncJobStatus.SUPERSEDED,
          processedAt: new Date(),
          lockedUntil: null,
        },
      });

      this.logger.log(
        JSON.stringify({
          event: "line_chat_nickname_job_superseded",
          jobId: job.id,
          conversationId: job.conversationId,
          supersededByJobId: newerJob.id,
        })
      );
      return;
    }

    // Resolve OA and Session Configuration
    const oa = await this.prisma.lineOfficialAccount.findUnique({
      where: { id: job.lineOfficialAccountId },
      include: {
        lineChatSession: true,
      },
    });

    const botId = oa?.chatBotId?.trim();

    if (!botId) {
      const errorMsg = `No authoritative chatBotId configured for LineOfficialAccount ${job.lineOfficialAccountId}`;
      await this.prisma.lineChatNicknameSyncJob.update({
        where: { id: job.id },
        data: {
          status: LineChatNicknameSyncJobStatus.FAILED,
          processedAt: new Date(),
          lastError: errorMsg,
          lockedUntil: null,
        },
      });

      this.logger.error(
        JSON.stringify({
          event: "line_chat_nickname_job_failed_missing_bot_id",
          jobId: job.id,
          lineOfficialAccountId: job.lineOfficialAccountId,
          error: errorMsg,
        })
      );
      return;
    }

    const session = oa?.lineChatSession;
    if (!session) {
      const errorMsg = `No LineChatSession linked to LineOfficialAccount ${job.lineOfficialAccountId}`;
      await this.prisma.lineChatNicknameSyncJob.update({
        where: { id: job.id },
        data: {
          status: LineChatNicknameSyncJobStatus.FAILED,
          processedAt: new Date(),
          lastError: errorMsg,
          lockedUntil: null,
        },
      });

      this.logger.error(
        JSON.stringify({
          event: "line_chat_nickname_job_failed_missing_session",
          jobId: job.id,
          lineOfficialAccountId: job.lineOfficialAccountId,
          error: errorMsg,
        })
      );
      return;
    }

    // Session health check circuit breaker
    if (session.status === LineChatSessionStatus.AUTH_REQUIRED) {
      const errorMsg = `LineChatSession ${session.sessionKey} is in AUTH_REQUIRED status. Job paused.`;
      await this.prisma.lineChatNicknameSyncJob.update({
        where: { id: job.id },
        data: {
          status: LineChatNicknameSyncJobStatus.FAILED_AUTH,
          processedAt: new Date(),
          lastError: errorMsg,
          lockedUntil: null,
        },
      });

      this.logger.warn(
        JSON.stringify({
          event: "line_chat_nickname_job_skipped_session_auth_required",
          jobId: job.id,
          sessionKey: session.sessionKey,
        })
      );
      return;
    }

    if (session.status === LineChatSessionStatus.DISABLED) {
      const errorMsg = `LineChatSession ${session.sessionKey} is DISABLED.`;
      await this.prisma.lineChatNicknameSyncJob.update({
        where: { id: job.id },
        data: {
          status: LineChatNicknameSyncJobStatus.FAILED,
          processedAt: new Date(),
          lastError: errorMsg,
          lockedUntil: null,
        },
      });
      return;
    }

    const profilePath = this.sessionService.resolveProfilePath(session);

    this.logger.log(
      JSON.stringify({
        event: "line_chat_nickname_job_processing",
        jobId: job.id,
        conversationId: job.conversationId,
        lineOfficialAccountId: job.lineOfficialAccountId,
        lineUserId: job.lineUserId,
        nickname: job.nickname,
        botId,
        sessionKey: session.sessionKey,
      })
    );

    const result = await this.sessionService.updateNickname({
      botId,
      lineUserId: job.lineUserId,
      nickname: job.nickname,
      profilePath,
      headless: true,
    });

    if (result.success) {
      await this.prisma.lineChatNicknameSyncJob.update({
        where: { id: job.id },
        data: {
          status: LineChatNicknameSyncJobStatus.SUCCESS,
          processedAt: new Date(),
          lastError: null,
          lockedUntil: null,
        },
      });

      await this.prisma.lineChatSession.update({
        where: { id: session.id },
        data: {
          lastAuthenticatedAt: new Date(),
          lastSuccessfulRequestAt: new Date(),
          consecutiveAuthFailures: 0,
          status: LineChatSessionStatus.ACTIVE,
        },
      }).catch(() => {});

      this.logger.log(
        JSON.stringify({
          event: "line_chat_nickname_job_success",
          jobId: job.id,
          conversationId: job.conversationId,
          lineOfficialAccountId: job.lineOfficialAccountId,
          lineUserId: job.lineUserId,
          nickname: job.nickname,
          status: result.status,
          tokenSource: result.tokenSource,
        })
      );
      return;
    }

    // Authentication failure: FAILED_AUTH
    if (result.status === 401 || result.error?.includes("not authenticated or has expired")) {
      await this.prisma.lineChatNicknameSyncJob.update({
        where: { id: job.id },
        data: {
          status: LineChatNicknameSyncJobStatus.FAILED_AUTH,
          processedAt: new Date(),
          lastError: result.error || "LINE chat session unauthenticated",
          lockedUntil: null,
        },
      });

      await this.prisma.lineChatSession.update({
        where: { id: session.id },
        data: {
          status: LineChatSessionStatus.AUTH_REQUIRED,
          lastAuthFailureAt: new Date(),
          consecutiveAuthFailures: { increment: 1 },
        },
      }).catch(() => {});

      this.logger.error(
        JSON.stringify({
          event: "line_chat_nickname_job_failed_auth",
          jobId: job.id,
          lineOfficialAccountId: job.lineOfficialAccountId,
          sessionKey: session.sessionKey,
          error: result.error,
        })
      );
      return;
    }

    // Check if retryable failure: 429, 5xx, or network error
    const isRetryable =
      result.status === 429 ||
      (result.status !== undefined && result.status >= 500) ||
      result.error?.includes("Network failure") ||
      result.error?.includes("ETIMEDOUT") ||
      result.error?.includes("ECONNRESET");

    const maxAttempts = job.maxAttempts || DEFAULT_MAX_ATTEMPTS;
    const nextAttempt = job.attemptCount + 1;

    if (isRetryable && nextAttempt < maxAttempts) {
      const delaySeconds = Math.pow(2, job.attemptCount) * 15; // 15s, 30s, 60s
      const scheduledAt = new Date(Date.now() + delaySeconds * 1000);

      await this.prisma.lineChatNicknameSyncJob.update({
        where: { id: job.id },
        data: {
          status: LineChatNicknameSyncJobStatus.PENDING,
          attemptCount: { increment: 1 },
          scheduledAt,
          lastError: result.error,
          lockedUntil: null,
        },
      });

      this.logger.warn(
        JSON.stringify({
          event: "line_chat_nickname_job_retry_scheduled",
          jobId: job.id,
          attemptCount: nextAttempt,
          maxAttempts,
          retryAfterSeconds: delaySeconds,
          error: result.error,
        })
      );
      return;
    }

    // Permanent failure
    await this.prisma.lineChatNicknameSyncJob.update({
      where: { id: job.id },
      data: {
        status: LineChatNicknameSyncJobStatus.FAILED,
        processedAt: new Date(),
        lastError: result.error || "Execution failed",
        lockedUntil: null,
      },
    });

    this.logger.error(
      JSON.stringify({
        event: "line_chat_nickname_job_permanently_failed",
        jobId: job.id,
        conversationId: job.conversationId,
        lineOfficialAccountId: job.lineOfficialAccountId,
        attemptCount: nextAttempt,
        error: result.error,
      })
    );
  }
}

