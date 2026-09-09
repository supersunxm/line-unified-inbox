import { Inject, Injectable } from "@nestjs/common";
import { LineChatNicknameSyncJobStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import type { LineChatHealthReport, LineChatQueueMetrics } from "./line-chat-operations.service";

const LINE_CHAT_HEALTH_RESET_TYPE = "LINE_CHAT_NICKNAME_HEALTH";

type FreshJob = {
  id: string;
  conversationId: string;
  lineOfficialAccountId: string;
  status: LineChatNicknameSyncJobStatus;
  lineChatUserId: string | null;
  createdAt: Date;
  conversation: { lineChatUserId: string | null };
};

function emptyQueue(): LineChatQueueMetrics {
  return { pending: 0, processing: 0, success: 0, failed: 0, failedAuth: 0, superseded: 0, total: 0 };
}

function addStatus(queue: LineChatQueueMetrics, status: LineChatNicknameSyncJobStatus) {
  switch (status) {
    case LineChatNicknameSyncJobStatus.PENDING:
      queue.pending += 1;
      break;
    case LineChatNicknameSyncJobStatus.PROCESSING:
      queue.processing += 1;
      break;
    case LineChatNicknameSyncJobStatus.SUCCESS:
      queue.success += 1;
      break;
    case LineChatNicknameSyncJobStatus.FAILED:
      queue.failed += 1;
      break;
    case LineChatNicknameSyncJobStatus.FAILED_AUTH:
      queue.failedAuth += 1;
      break;
    case LineChatNicknameSyncJobStatus.SUPERSEDED:
      queue.superseded += 1;
      break;
  }
  queue.total += 1;
}

function recalculateTotal(queue: LineChatQueueMetrics) {
  queue.total =
    queue.pending +
    queue.processing +
    queue.success +
    queue.failed +
    queue.failedAuth +
    queue.superseded;
}

/**
 * Presents LINE Chat nickname health from an isolated operational baseline.
 * Historical jobs remain untouched in the database.
 *
 * Success is intentionally cumulative across resets so the health page keeps
 * the historical number of nickname changes that really completed. Operational
 * counters (pending, processing, failed, failedAuth, superseded and mapping
 * backlog) are reset-scoped and only count jobs created at/after the latest
 * LINE_CHAT_NICKNAME_HEALTH reset.
 *
 * WAITING/DEFERRED work is never counted as Failed. Failed only comes from
 * terminal FAILED / FAILED_AUTH job states created after the reset baseline.
 */
@Injectable()
export class LineChatHealthReconciliationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async getOrCreateResetAt(): Promise<Date> {
    const existing = await this.prisma.operationalSession.findFirst({
      where: { type: LINE_CHAT_HEALTH_RESET_TYPE },
      orderBy: { resetAt: "desc" },
      select: { resetAt: true },
    });
    if (existing?.resetAt) return existing.resetAt;

    const created = await this.prisma.operationalSession.create({
      data: { type: LINE_CHAT_HEALTH_RESET_TYPE },
      select: { resetAt: true },
    });
    return created.resetAt;
  }

  async reconcile(report: LineChatHealthReport): Promise<LineChatHealthReport> {
    const resetAt = await this.getOrCreateResetAt();

    // The raw report is all-time. Keep only its successful totals before
    // rebuilding the operational counters from the reset baseline.
    const cumulativeSuccess = report.queue.success;
    const cumulativeSessionSuccess = new Map(
      report.sessions.map((session) => [session.id, session.jobs.success] as const),
    );

    const freshJobs = await this.prisma.lineChatNicknameSyncJob.findMany({
      where: { createdAt: { gte: resetAt } },
      select: {
        id: true,
        conversationId: true,
        lineOfficialAccountId: true,
        status: true,
        lineChatUserId: true,
        createdAt: true,
        conversation: { select: { lineChatUserId: true } },
      },
      orderBy: { createdAt: "asc" },
    }) as FreshJob[];

    const freshQueue = emptyQueue();
    for (const job of freshJobs) addStatus(freshQueue, job.status);
    freshQueue.success = cumulativeSuccess;
    recalculateTotal(freshQueue);
    report.queue = freshQueue;

    const oaIds = [...new Set(freshJobs.map((job) => job.lineOfficialAccountId))];
    const oas = oaIds.length > 0
      ? await this.prisma.lineOfficialAccount.findMany({
          where: { id: { in: oaIds } },
          select: { id: true, lineChatSessionId: true },
        })
      : [];
    const sessionIdByOa = new Map(
      oas.flatMap((oa) => oa.lineChatSessionId ? [[oa.id, oa.lineChatSessionId] as const] : []),
    );

    for (const session of report.sessions) {
      const cumulativeSessionCount = cumulativeSessionSuccess.get(session.id) ?? 0;
      session.jobs = emptyQueue();
      session.jobs.success = cumulativeSessionCount;
      recalculateTotal(session.jobs);
      session.recentFailures = session.recentFailures.filter((failure) => {
        const createdAt = new Date(failure.createdAt);
        return Number.isFinite(createdAt.getTime()) && createdAt >= resetAt;
      });
    }

    for (const job of freshJobs) {
      const sessionId = sessionIdByOa.get(job.lineOfficialAccountId);
      if (!sessionId) continue;
      const session = report.sessions.find((item) => item.id === sessionId);
      if (!session) continue;

      // Success is already represented by the all-time cumulative count above;
      // only baseline-scoped operational states are added here.
      if (job.status !== LineChatNicknameSyncJobStatus.SUCCESS) {
        addStatus(session.jobs, job.status);
      }
    }

    for (const session of report.sessions) recalculateTotal(session.jobs);

    const pending = freshJobs.filter((job) => job.status === LineChatNicknameSyncJobStatus.PENDING);
    const mappedReadyPending = pending.filter((job) =>
      Boolean(job.lineChatUserId?.trim() || job.conversation.lineChatUserId?.trim()),
    ).length;
    const waitingForMapping = pending.length - mappedReadyPending;
    const oldestPending = pending.reduce<Date | null>((oldest, job) => {
      if (!oldest || job.createdAt < oldest) return job.createdAt;
      return oldest;
    }, null);

    report.mapping = {
      mappedReadyPending,
      waitingForMapping,
      oldestPendingAt: oldestPending?.toISOString() ?? null,
    };

    return report;
  }
}
