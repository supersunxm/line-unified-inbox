import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { RichMenuPublishJobStatus, RichMenuPublishStatus } from "@prisma/client";
import { RichMenuService } from "./rich-menu.service";
import { AuditLogService } from "../auth/audit-log.service";
import * as os from "node:os";

const DEFAULT_CONCURRENCY = 2;
const MAX_ALLOWED_CONCURRENCY = 5;
const HEARTBEAT_INTERVAL_MS = 10_000;
const WORKER_POLL_INTERVAL_MS = 2_500;

@Injectable()
export class RichMenuPublishWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RichMenuPublishWorkerService.name);
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private workerLoopTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private readonly workerId = `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

  constructor(
    private readonly prisma: PrismaService,
    private readonly richMenuService: RichMenuService,
    private readonly auditLog?: AuditLogService,
  ) {}

  async onModuleInit() {
    await this.recordHeartbeat();
    this.heartbeatTimer = setInterval(() => void this.recordHeartbeat(), HEARTBEAT_INTERVAL_MS);

    if (process.env.NODE_ENV !== "test") {
      this.workerLoopTimer = setInterval(() => void this.processQueueCycle(), WORKER_POLL_INTERVAL_MS);
      void this.processQueueCycle();
    }
  }

  onModuleDestroy() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.workerLoopTimer) clearInterval(this.workerLoopTimer);
    this.heartbeatTimer = null;
    this.workerLoopTimer = null;
  }

  async recordHeartbeat(): Promise<void> {
    try {
      await this.prisma.richMenuWorkerHeartbeat.upsert({
        where: { id: "singleton" },
        create: {
          id: "singleton",
          workerId: this.workerId,
          lastHeartbeatAt: new Date(),
          hostname: os.hostname(),
          metadata: { pid: process.pid, concurrency: this.getConcurrency() },
        },
        update: {
          workerId: this.workerId,
          lastHeartbeatAt: new Date(),
          hostname: os.hostname(),
          metadata: { pid: process.pid, concurrency: this.getConcurrency() },
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to record rich menu worker heartbeat: ${err?.message}`);
    }
  }

  getConcurrency(): number {
    const raw = parseInt(
      process.env.RICH_MENU_PUBLISH_CONCURRENCY ||
        process.env.RICH_MENU_BULK_CONCURRENCY ||
        String(DEFAULT_CONCURRENCY),
      10,
    );
    if (isNaN(raw) || raw < 1) return DEFAULT_CONCURRENCY;
    return Math.min(raw, MAX_ALLOWED_CONCURRENCY);
  }

  async processQueueCycle(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      // 1. Find oldest queued or running job with pending attempts
      const activeJob = await this.prisma.richMenuPublishJob.findFirst({
        where: {
          status: {
            in: [
              RichMenuPublishJobStatus.QUEUED,
              RichMenuPublishJobStatus.RUNNING,
              RichMenuPublishJobStatus.CANCELLING,
            ],
          },
        },
        orderBy: { createdAt: "asc" },
      });

      if (!activeJob) {
        return 0;
      }

      // Handle cancellation if requested
      if (activeJob.status === RichMenuPublishJobStatus.CANCELLING || activeJob.cancelRequestedAt) {
        await this.prisma.richMenuPublishAttempt.updateMany({
          where: {
            jobId: activeJob.id,
            status: RichMenuPublishStatus.PENDING,
          },
          data: {
            status: RichMenuPublishStatus.CANCELLED,
            errorMessage: "Publishing job was cancelled by administrator",
          },
        });

        const inFlight = await this.prisma.richMenuPublishAttempt.count({
          where: {
            jobId: activeJob.id,
            status: {
              in: [
                RichMenuPublishStatus.VALIDATING,
                RichMenuPublishStatus.CREATING,
                RichMenuPublishStatus.IMAGE_UPLOADING,
                RichMenuPublishStatus.SETTING_DEFAULT,
                RichMenuPublishStatus.VERIFYING,
                RichMenuPublishStatus.ROLLING_BACK,
              ],
            },
          },
        });

        if (inFlight === 0) {
          await this.syncJobCounters(activeJob.id);
          await this.prisma.richMenuPublishJob.update({
            where: { id: activeJob.id },
            data: {
              status: RichMenuPublishJobStatus.CANCELLED,
              completedAt: new Date(),
            },
          });
        }
        return 0;
      }

      // Transition QUEUED -> RUNNING
      if (activeJob.status === RichMenuPublishJobStatus.QUEUED) {
        await this.prisma.richMenuPublishJob.update({
          where: { id: activeJob.id },
          data: {
            status: RichMenuPublishJobStatus.RUNNING,
            startedAt: new Date(),
          },
        });

        if (this.auditLog && activeJob.createdByUserId) {
          await this.auditLog.record({
            actorUserId: activeJob.createdByUserId,
            action: "RICH_MENU_BULK_JOB_STARTED",
            metadata: {
              jobId: activeJob.id,
              templateId: activeJob.templateId,
              templateVersion: activeJob.templateVersion,
              totalCount: activeJob.totalCount,
            },
          });
        }
      }

      // 2. Claim pending attempts up to concurrency limit
      const concurrency = this.getConcurrency();
      const pendingAttempts = await this.prisma.richMenuPublishAttempt.findMany({
        where: {
          jobId: activeJob.id,
          status: RichMenuPublishStatus.PENDING,
        },
        orderBy: { createdAt: "asc" },
        take: concurrency,
      });

      if (pendingAttempts.length === 0) {
        // No pending left; check if all attempts are terminal to finalize job
        await this.checkAndFinalizeJob(activeJob.id);
        return 0;
      }

      const claimedAttempts: typeof pendingAttempts = [];
      for (const attempt of pendingAttempts) {
        const updateRes = await this.prisma.richMenuPublishAttempt.updateMany({
          where: {
            id: attempt.id,
            status: RichMenuPublishStatus.PENDING,
          },
          data: {
            status: RichMenuPublishStatus.VALIDATING,
            startedAt: new Date(),
          },
        });

        if (updateRes.count > 0) {
          claimedAttempts.push(attempt);
        }
      }

      if (claimedAttempts.length === 0) {
        return 0;
      }

      await this.syncJobCounters(activeJob.id);

      // 3. Process claimed attempts concurrently
      await Promise.allSettled(
        claimedAttempts.map(async (att) => {
          try {
            await this.richMenuService.publishOneStore({
              templateId: activeJob.templateId,
              lineOfficialAccountId: att.lineOfficialAccountId,
              actorUserId: activeJob.createdByUserId || undefined,
              attemptId: att.id,
              jobId: activeJob.id,
              expectedTemplateVersion: activeJob.templateVersion,
            });
          } catch (err: any) {
            this.logger.error(`Attempt ${att.id} failed in worker: ${err?.message}`);
          }
        }),
      );

      // 4. Update counters and check finalization
      await this.syncJobCounters(activeJob.id);
      await this.checkAndFinalizeJob(activeJob.id);

      return claimedAttempts.length;
    } catch (err: any) {
      this.logger.error(`Worker cycle error: ${err?.message}`);
      return 0;
    } finally {
      this.isProcessing = false;
    }
  }

  async syncJobCounters(jobId: string): Promise<void> {
    const attempts = await this.prisma.richMenuPublishAttempt.findMany({
      where: { jobId },
      select: { status: true },
    });

    let pendingCount = 0;
    let processingCount = 0;
    let publishedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let cancelledCount = 0;

    for (const a of attempts) {
      switch (a.status) {
        case RichMenuPublishStatus.PENDING:
          pendingCount++;
          break;
        case RichMenuPublishStatus.VALIDATING:
        case RichMenuPublishStatus.CREATING:
        case RichMenuPublishStatus.IMAGE_UPLOADING:
        case RichMenuPublishStatus.SETTING_DEFAULT:
        case RichMenuPublishStatus.VERIFYING:
        case RichMenuPublishStatus.ROLLING_BACK:
          processingCount++;
          break;
        case RichMenuPublishStatus.PUBLISHED:
        case RichMenuPublishStatus.ROLLED_BACK:
          publishedCount++;
          break;
        case RichMenuPublishStatus.FAILED:
          failedCount++;
          break;
        case RichMenuPublishStatus.SKIPPED:
          skippedCount++;
          break;
        case RichMenuPublishStatus.CANCELLED:
          cancelledCount++;
          break;
      }
    }

    await this.prisma.richMenuPublishJob.update({
      where: { id: jobId },
      data: {
        totalCount: attempts.length,
        pendingCount,
        processingCount,
        publishedCount,
        failedCount,
        skippedCount,
        cancelledCount,
      },
    });
  }

  private async checkAndFinalizeJob(jobId: string): Promise<void> {
    const job = await this.prisma.richMenuPublishJob.findUnique({
      where: { id: jobId },
      include: {
        attempts: { select: { status: true } },
      },
    });

    if (!job) return;

    const inFlightStatuses: RichMenuPublishStatus[] = [
      RichMenuPublishStatus.PENDING,
      RichMenuPublishStatus.VALIDATING,
      RichMenuPublishStatus.CREATING,
      RichMenuPublishStatus.IMAGE_UPLOADING,
      RichMenuPublishStatus.SETTING_DEFAULT,
      RichMenuPublishStatus.VERIFYING,
      RichMenuPublishStatus.ROLLING_BACK,
    ];

    const inFlightCount = job.attempts.filter((a) => inFlightStatuses.includes(a.status)).length;

    if (inFlightCount > 0) {
      return; // Still processing or pending
    }

    const publishedCount = job.attempts.filter((a) =>
      a.status === RichMenuPublishStatus.PUBLISHED || a.status === RichMenuPublishStatus.ROLLED_BACK,
    ).length;
    const failedCount = job.attempts.filter((a) => a.status === RichMenuPublishStatus.FAILED).length;
    const skippedCount = job.attempts.filter((a) => a.status === RichMenuPublishStatus.SKIPPED).length;
    const cancelledCount = job.attempts.filter((a) => a.status === RichMenuPublishStatus.CANCELLED).length;

    let finalStatus: RichMenuPublishJobStatus;
    if (job.status === RichMenuPublishJobStatus.CANCELLING || cancelledCount === job.attempts.length) {
      finalStatus = RichMenuPublishJobStatus.CANCELLED;
    } else if (publishedCount === job.attempts.length) {
      finalStatus = RichMenuPublishJobStatus.COMPLETED;
    } else if (publishedCount > 0 || skippedCount > 0 || (failedCount > 0 && publishedCount < job.attempts.length)) {
      finalStatus = RichMenuPublishJobStatus.COMPLETED_WITH_ERRORS;
    } else if (failedCount === job.attempts.length) {
      finalStatus = RichMenuPublishJobStatus.FAILED;
    } else {
      finalStatus = RichMenuPublishJobStatus.COMPLETED_WITH_ERRORS;
    }

    await this.prisma.richMenuPublishJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        publishedCount,
        failedCount,
        skippedCount,
        cancelledCount,
        pendingCount: 0,
        processingCount: 0,
      },
    });

    if (this.auditLog && job.createdByUserId) {
      await this.auditLog.record({
        actorUserId: job.createdByUserId,
        action: "RICH_MENU_BULK_JOB_COMPLETED",
        metadata: {
          jobId: job.id,
          templateId: job.templateId,
          templateVersion: job.templateVersion,
          status: finalStatus,
          totalCount: job.attempts.length,
          publishedCount,
          failedCount,
          skippedCount,
          cancelledCount,
        },
      });
    }
  }
}
