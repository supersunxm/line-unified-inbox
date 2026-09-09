import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { LineChatNicknameSyncJobStatus, LineChatSessionStatus } from "@prisma/client";
import { LineChatSessionService } from "./line-chat-session.service";
import { hostname } from "node:os";
import { resolve } from "node:path";
import { LineChatRecentResolverService } from "./line-chat-recent-resolver.service";
import {
  LineChatProfileOperationCoordinator,
  type LineChatProfileOperationContext,
  type ProfileOperationResult,
} from "./line-chat-profile-operation-coordinator.service";
import type { LineChatMappingBatchResult } from "./line-chat-recent-resolver.service";

const WORKER_POLL_INTERVAL_MS = 3_000;
const MAINTENANCE_KEEPALIVE_INTERVAL_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const LEASE_DURATION_MS = 60_000; // 1 minute per job execution lease
const STUCK_JOB_TIMEOUT_MS = 5 * 60_000; // 5 minutes max stuck duration
const MAPPING_NO_MATCH_BACKOFF_MS = 45 * 60_000;
const MAPPING_AMBIGUOUS_BACKOFF_MS = 60 * 60_000;
const MAPPING_TRANSPORT_BACKOFF_BASE_MS = 30_000;
const MAPPING_TRANSPORT_BACKOFF_MAX_MS = 15 * 60_000;
const DATABASE_RETRY_BACKOFF_MS = 30_000;

type MappingDeferralReason = "RESOLVE_NO_MATCH" | "RESOLVE_AMBIGUOUS" | "RESOLVE_CONFLICT";

type PendingNicknameJob = {
  id: string;
  conversationId: string;
  lineOfficialAccountId: string;
  lineChatUserId: string | null;
  attemptCount: number;
  maxAttempts: number;
};

function isDatabaseConnectivityError(error: unknown): boolean {
  const rawCode = typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: unknown }).code
    : null;
  const code = typeof rawCode === "string" ? rawCode : "";
  const message = error instanceof Error ? error.message : String(error);
  return ["P1001", "P1002", "P1017", "P2024"].includes(code)
    || /can't reach database server|connection.*closed|connection.*reset|econnrefused|enetunreach|etimedout|timeout.*database/iu.test(message);
}

@Injectable()
export class LineChatNicknameWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LineChatNicknameWorkerService.name);
  private readonly railwayServiceName = process.env.RAILWAY_SERVICE_NAME?.trim() || null;
  private readonly railwayReplicaId = process.env.RAILWAY_REPLICA_ID?.trim() || null;
  private readonly workerId = `${this.railwayServiceName || "local"}:${this.railwayReplicaId || hostname()}:${process.pid}`;
  private readonly profileRoot = resolve(
    process.env.LINE_CHAT_PROFILE_ROOT?.trim() ||
      (process.env.NODE_ENV === "production" ? "/data/line-chat-profiles" : "./local-data")
  );
  private timer: NodeJS.Timeout | null = null;
  private maintenanceTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LineChatSessionService) private readonly sessionService: LineChatSessionService,
    @Inject(LineChatRecentResolverService) private readonly recentResolver?: LineChatRecentResolverService,
    @Inject(LineChatProfileOperationCoordinator) private readonly profileCoordinator?: LineChatProfileOperationCoordinator,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === "test") {
      return;
    }

    if (process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE === "true") {
      this.logger.warn(JSON.stringify({
        event: "line_chat_nickname_worker_maintenance_mode",
        ...this.workerIdentity(),
      }));
      // This referenced timer intentionally keeps the standalone ApplicationContext alive
      // while polling is paused and the profile volume remains available to operators.
      this.maintenanceTimer = setInterval(() => undefined, MAINTENANCE_KEEPALIVE_INTERVAL_MS);
      return;
    }

    if (process.env.DISABLE_NICKNAME_WORKER === "true") {
      this.logger.warn(JSON.stringify({
        event: "line_chat_nickname_worker_disabled",
        ...this.workerIdentity(),
      }));
      return;
    }

    this.logger.log(JSON.stringify({
      event: "line_chat_nickname_worker_started",
      ...this.workerIdentity(),
    }));
    this.timer = setInterval(() => void this.processQueueCycle(), WORKER_POLL_INTERVAL_MS);
    void this.processQueueCycle();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = null;
    }
  }

  private workerIdentity() {
    return {
      railwayServiceName: this.railwayServiceName,
      railwayReplicaId: this.railwayReplicaId,
      workerId: this.workerId,
      profileRoot: this.profileRoot,
    };
  }

  private safeExecutionError(status: number | undefined): string {
    if (status === 400) return "LINE_NICKNAME_VALIDATION_FAILED";
    if (status === 401) return "LINE_NICKNAME_AUTH";
    if (status === 403) return "LINE_NICKNAME_FORBIDDEN";
    if (status === 404) return "LINE_NICKNAME_TARGET_NOT_FOUND";
    if (status === 429) return "LINE_NICKNAME_RATE_LIMITED";
    if (status !== undefined && status >= 500) return "LINE_NICKNAME_SERVER_ERROR";
    return "LINE_NICKNAME_TRANSPORT_OR_EXECUTION";
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
      this.logDatabaseOrWorkerError("line_chat_nickname_recovery_failed", err);
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

      // Refresh each OA/session once before claiming jobs. This operation is
      // profile-scoped and bounded; unmapped jobs remain unclaimed until the
      // shared snapshot has had a chance to map them.
      await this.refreshPendingMappings(pendingJobs);

      let processedCount = 0;

      for (const job of pendingJobs) {
        const lockedUntil = new Date(Date.now() + LEASE_DURATION_MS);

        // Atomic claim with lease and worker ID
        const claimResult = await this.prisma.lineChatNicknameSyncJob.updateMany({
          where: {
            id: job.id,
            status: LineChatNicknameSyncJobStatus.PENDING,
            scheduledAt: { lte: new Date() },
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

        this.logger.log(
          JSON.stringify({
            event: "line_chat_nickname_job_claimed",
            jobId: job.id,
            ...this.workerIdentity(),
          })
        );

        try {
          await this.processSingleJob(job.id);
        } catch (err: unknown) {
          if (isDatabaseConnectivityError(err)) {
            this.logDatabaseOrWorkerError("line_chat_nickname_database_unavailable", err);
            await this.requeueClaimedJob(job.id);
            break;
          }
          throw err;
        }
        processedCount++;

        // Inter-request delay if configured
        const syncDelayMs = Number(process.env.LINE_CHAT_SYNC_DELAY_MS || "0");
        if (syncDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, syncDelayMs));
        }
      }

      return processedCount;
    } catch (err: unknown) {
      this.logDatabaseOrWorkerError("line_chat_nickname_worker_cycle_failed", err);
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

    let mappedLineChatUserId = job.lineChatUserId?.trim() || null;
    if (!mappedLineChatUserId) {
      mappedLineChatUserId = await this.findConversationMapping(job.conversationId, job.lineOfficialAccountId);
      if (mappedLineChatUserId) {
        await this.prisma.lineChatNicknameSyncJob.update({
          where: { id: job.id },
          data: { lineChatUserId: mappedLineChatUserId, lineUserId: mappedLineChatUserId },
        });
      }
    }
    if (!mappedLineChatUserId) {
      await this.deferMissingMapping(job);
      return;
    }

    // Session health check circuit breaker
    if (session.status === LineChatSessionStatus.AUTH_REQUIRED) {
      const errorMsg = "LINE chat session is in AUTH_REQUIRED status. Job paused.";
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
        })
      );
      return;
    }

    if (session.status === LineChatSessionStatus.DISABLED) {
      const errorMsg = "LINE chat session is DISABLED.";
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
    const operation = await this.withProfileOperation(
      session.id,
      "NICKNAME_UPDATE",
      (operationContext) => this.processBrowserOperation(
        { ...job, lineChatUserId: mappedLineChatUserId },
        session,
        botId,
        profilePath,
        operationContext,
      ),
    );
    if (!operation.acquired) {
      await this.deferProfileOperationBusy(job.id, operation.retryAfterMs);
    }
  }

  private async withProfileOperation<T>(
    sessionId: string,
    operationKind: "NICKNAME_UPDATE" | "RECENT_RESOLUTION",
    callback: (context: LineChatProfileOperationContext) => Promise<T>,
    options: { waitForLock?: boolean } = {},
  ): Promise<ProfileOperationResult<T>> {
    if (this.profileCoordinator) {
      return this.profileCoordinator.withProfileOperation({ sessionId, operationKind }, callback, options);
    }

    // Never allow a production worker to touch a persistent profile without
    // the coordinator. Direct construction is retained only for non-production
    // unit tests that provide their own browser fakes.
    if (process.env.NODE_ENV === "production") {
      throw new Error("PROFILE_OPERATION_COORDINATOR_UNAVAILABLE");
    }

    // Directly constructed worker instances are used by unit tests. Production
    // composition always injects the coordinator through the worker module.
    const testContext: LineChatProfileOperationContext = {
      sessionId,
      ownerToken: "test-only",
      operationKind,
      assertOwnership: () => undefined,
    };
    return {
      acquired: true,
      value: await callback(testContext),
      sessionId,
      operationKind,
    };
  }

  private async deferProfileOperationBusy(jobId: string, retryAfterMs: number): Promise<void> {
    await this.prisma.lineChatNicknameSyncJob.update({
      where: { id: jobId },
      data: {
        status: LineChatNicknameSyncJobStatus.PENDING,
        scheduledAt: new Date(Date.now() + retryAfterMs),
        lastError: "PROFILE_OPERATION_BUSY",
        lockedUntil: null,
        workerId: null,
      },
    });
    this.logger.warn(JSON.stringify({
      event: "line_chat_nickname_job_profile_operation_busy",
      jobId,
      retryAfterMs,
    }));
  }

  private async findConversationMapping(conversationId: string, lineOfficialAccountId: string): Promise<string | null> {
    const conversationTable = (this.prisma as unknown as { conversation?: {
      findUnique?: (args: unknown) => Promise<{ lineOfficialAccountId: string; lineChatUserId: string | null } | null>;
    } }).conversation;
    if (!conversationTable || typeof conversationTable.findUnique !== "function") return null;
    const conversation = await conversationTable.findUnique({
      where: { id: conversationId },
      select: { lineOfficialAccountId: true, lineChatUserId: true },
    });
    return conversation?.lineOfficialAccountId === lineOfficialAccountId
      ? conversation.lineChatUserId?.trim() || null
      : null;
  }

  private async refreshPendingMappings(pendingJobs: PendingNicknameJob[]): Promise<void> {
    if (!this.recentResolver || pendingJobs.length === 0) return;
    const unmappedJobs = pendingJobs.filter((job) => !job.lineChatUserId?.trim());
    if (unmappedJobs.length === 0) return;

    const conversationIds = [...new Set(unmappedJobs.map((job) => job.conversationId))];
    const existingMappings = this.recentResolver.findExistingMappings
      ? await this.recentResolver.findExistingMappings({ conversationIds })
      : new Map<string, string>();
    const unresolvedJobs = unmappedJobs.filter((job) => !existingMappings.has(job.conversationId));
    if (unresolvedJobs.length === 0) return;

    const oaIds = [...new Set(unresolvedJobs.map((job) => job.lineOfficialAccountId))];
    const oas = await this.prisma.lineOfficialAccount.findMany({
      where: { id: { in: oaIds } },
      include: { lineChatSession: true },
    });
    const jobsByOa = new Map<string, PendingNicknameJob[]>();
    for (const job of unresolvedJobs) {
      const jobs = jobsByOa.get(job.lineOfficialAccountId) ?? [];
      jobs.push(job);
      jobsByOa.set(job.lineOfficialAccountId, jobs);
    }

    for (const oa of oas) {
      const jobs = jobsByOa.get(oa.id);
      const session = oa.lineChatSession;
      const botId = oa.chatBotId?.trim();
      if (!jobs?.length || !session || !botId || session.status !== LineChatSessionStatus.ACTIVE) continue;
      const profilePath = this.sessionService.resolveProfilePath(session);
      const operation = await this.withProfileOperation(
        session.id,
        "RECENT_RESOLUTION",
        (operationContext) => this.recentResolver!.refreshSnapshot({
          lineOfficialAccountId: oa.id,
          botId,
          sessionKey: session.sessionKey,
          profilePath,
          operationContext,
        }),
        { waitForLock: false },
      );
      if (!operation.acquired) {
        this.logger.warn(JSON.stringify({
          event: "line_chat_nickname_mapping_refresh_deferred_profile_busy",
          sessionId: session.id,
          operationKind: "RECENT_RESOLUTION",
          retryAfterMs: operation.retryAfterMs,
        }));
        await this.deferMappingJobs(jobs, "PROFILE_OPERATION_BUSY", operation.retryAfterMs);
        continue;
      }
      const result = await this.recentResolver.applySnapshotMappings({
        lineOfficialAccountId: oa.id,
        conversationIds: jobs.map((job) => job.conversationId),
        snapshot: operation.value,
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
      this.logMappingBatch(oa.id, session.sessionKey, result);
      if (result.status !== "REFRESHED") {
        await this.deferMappingJobs(
          jobs,
          result.status,
          result.status === "RESOLVE_SESSION_AUTH"
            ? MAPPING_NO_MATCH_BACKOFF_MS
            : this.mappingTransportBackoffMs(jobs),
        );
        if (result.status === "RESOLVE_SESSION_AUTH") {
          await this.prisma.lineChatSession.update({
            where: { id: session.id },
            data: {
              status: LineChatSessionStatus.AUTH_REQUIRED,
              lastAuthFailureAt: new Date(),
              consecutiveAuthFailures: { increment: 1 },
            },
          }).catch(() => {});
        }
      } else {
        for (const job of jobs) {
          const reason = result.unresolvedReasons?.get(job.conversationId);
          if (reason) await this.deferMissingMapping(job, reason, LineChatNicknameSyncJobStatus.PENDING);
        }
      }
    }
  }

  private logMappingBatch(lineOfficialAccountId: string, sessionKey: string, result: LineChatMappingBatchResult): void {
    this.logger.log(JSON.stringify({
      event: "line_chat_nickname_mapping_batch_result",
      lineOfficialAccountId,
      sessionKey,
      status: result.status,
      conversationCount: result.conversationCount,
      candidateCount: result.candidateCount,
      mappedCount: result.mappedCount,
      noMatchCount: result.noMatchCount,
      ambiguousCount: result.ambiguousCount,
      conflictCount: result.conflictCount,
    }));
  }

  private async deferMissingMapping(
    job: { id: string },
    reason: MappingDeferralReason = "RESOLVE_NO_MATCH",
    expectedStatus: LineChatNicknameSyncJobStatus = LineChatNicknameSyncJobStatus.PROCESSING,
  ): Promise<void> {
    const delayMs = reason === "RESOLVE_AMBIGUOUS" || reason === "RESOLVE_CONFLICT"
      ? MAPPING_AMBIGUOUS_BACKOFF_MS
      : MAPPING_NO_MATCH_BACKOFF_MS;
    await this.prisma.lineChatNicknameSyncJob.updateMany({
      where: { id: job.id, status: expectedStatus },
      data: {
        status: LineChatNicknameSyncJobStatus.PENDING,
        scheduledAt: new Date(Date.now() + delayMs),
        lastError: reason,
        lockedUntil: null,
        workerId: null,
      },
    });
    this.logger.warn(JSON.stringify({
      event: "line_chat_nickname_job_waiting_for_mapping",
      jobId: job.id,
      reason,
      retryAfterMs: delayMs,
    }));
  }

  private async deferMappingJobs(
    jobs: PendingNicknameJob[],
    reason: "PROFILE_OPERATION_BUSY" | "RESOLVE_SESSION_AUTH" | "RESOLVE_TRANSPORT",
    retryAfterMs: number,
  ): Promise<void> {
    if (jobs.length === 0) return;
    const data = reason === "RESOLVE_SESSION_AUTH"
      ? {
        status: LineChatNicknameSyncJobStatus.FAILED_AUTH,
        processedAt: new Date(),
        lastError: reason,
        lockedUntil: null,
      }
      : {
        status: LineChatNicknameSyncJobStatus.PENDING,
        scheduledAt: new Date(Date.now() + retryAfterMs),
        lastError: reason,
        lockedUntil: null,
        workerId: null,
        ...(reason === "RESOLVE_TRANSPORT" ? { attemptCount: { increment: 1 } } : {}),
      };
    await this.prisma.lineChatNicknameSyncJob.updateMany({
      where: {
        id: { in: jobs.map((job) => job.id) },
        status: LineChatNicknameSyncJobStatus.PENDING,
      },
      data,
    });
    this.logger.warn(JSON.stringify({
      event: "line_chat_nickname_mapping_jobs_deferred",
      reason,
      jobCount: jobs.length,
      retryAfterMs: reason === "RESOLVE_SESSION_AUTH" ? null : retryAfterMs,
    }));
  }

  private mappingTransportBackoffMs(jobs: PendingNicknameJob[]): number {
    const maxAttemptCount = Math.max(...jobs.map((job) => job.attemptCount), 0);
    return Math.min(
      MAPPING_TRANSPORT_BACKOFF_MAX_MS,
      MAPPING_TRANSPORT_BACKOFF_BASE_MS * Math.pow(2, maxAttemptCount),
    );
  }

  private async requeueClaimedJob(jobId: string): Promise<void> {
    try {
      await this.prisma.lineChatNicknameSyncJob.updateMany({
        where: {
          id: jobId,
          status: LineChatNicknameSyncJobStatus.PROCESSING,
          workerId: this.workerId,
        },
        data: {
          status: LineChatNicknameSyncJobStatus.PENDING,
          scheduledAt: new Date(Date.now() + DATABASE_RETRY_BACKOFF_MS),
          lastError: "DATABASE_UNAVAILABLE",
          lockedUntil: null,
          workerId: null,
        },
      });
    } catch (err: unknown) {
      this.logDatabaseOrWorkerError("line_chat_nickname_requeue_after_database_error_failed", err);
    }
  }

  private logDatabaseOrWorkerError(event: string, error: unknown): void {
    if (isDatabaseConnectivityError(error)) {
      this.logger.warn(JSON.stringify({ event, status: "RETRYABLE_DATABASE_UNAVAILABLE" }));
      return;
    }
    this.logger.error(JSON.stringify({
      event,
      status: "WORKER_ERROR",
      error: error instanceof Error ? error.message : String(error),
    }));
  }

  private async processBrowserOperation(
    job: {
      id: string;
      conversationId: string;
      lineOfficialAccountId: string;
      lineChatUserId: string | null;
      nickname: string;
      attemptCount: number;
      maxAttempts: number;
      createdAt: Date;
    },
    session: {
      id: string;
      sessionKey: string;
    },
    botId: string,
    profilePath: string,
    operationContext: LineChatProfileOperationContext,
  ): Promise<void> {
    operationContext.assertOwnership();
    const targetChatUserId = job.lineChatUserId?.trim();
    if (!targetChatUserId) throw new Error("MISSING_LINE_CHAT_USER_ID_AFTER_CHEAP_LOOKUP");

    // Resolution can take several seconds. Re-check latest-wins immediately
    // before dispatch so an older save cannot overwrite a newer nickname.
    const newerBeforeDispatch = await this.prisma.lineChatNicknameSyncJob.findFirst({
      where: {
        conversationId: job.conversationId,
        createdAt: { gt: job.createdAt },
      },
    });
    if (newerBeforeDispatch) {
      await this.prisma.lineChatNicknameSyncJob.update({
        where: { id: job.id },
        data: {
          status: LineChatNicknameSyncJobStatus.SUPERSEDED,
          processedAt: new Date(),
          lockedUntil: null,
        },
      });
      return;
    }

    this.logger.log(
      JSON.stringify({
        event: "line_chat_nickname_job_processing",
        jobId: job.id,
        conversationId: job.conversationId,
        lineOfficialAccountId: job.lineOfficialAccountId,
        chatMappingPresent: true,
      })
    );

    const result = await this.sessionService.updateNickname({
      botId,
      lineUserId: targetChatUserId,
      nickname: job.nickname,
      profilePath,
      headless: true,
      operationContext,
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
          errorCategory: this.safeExecutionError(result.status),
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
          errorCategory: this.safeExecutionError(result.status),
        })
      );
      return;
    }

    // Permanent failure
    await this.prisma.lineChatNicknameSyncJob.update({
      where: { id: job.id },
      data: {
        status: LineChatNicknameSyncJobStatus.FAILED,
        attemptCount: { increment: 1 },
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
        errorCategory: this.safeExecutionError(result.status),
      })
    );
  }
}
