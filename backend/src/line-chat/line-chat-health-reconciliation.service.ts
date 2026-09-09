import { Inject, Injectable } from "@nestjs/common";
import { LineChatNicknameSyncJobStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import type { LineChatHealthReport } from "./line-chat-operations.service";

type ActiveJob = {
  id: string;
  conversationId: string;
  lineOfficialAccountId: string;
  status: LineChatNicknameSyncJobStatus;
  lineChatUserId: string | null;
  createdAt: Date;
  conversation: { lineChatUserId: string | null };
};

type LatestJob = {
  id: string;
  conversationId: string;
  createdAt: Date;
};

/**
 * Makes the operations health view reflect the actionable/latest nickname job
 * for each conversation without mutating queue history.
 *
 * The worker already enforces Latest-Wins. A deferred PENDING predecessor can
 * therefore remain stored until its next eligibility window even after a newer
 * job for the same conversation has succeeded. Health reporting must not show
 * that predecessor as actionable backlog.
 */
@Injectable()
export class LineChatHealthReconciliationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async reconcile(report: LineChatHealthReport): Promise<LineChatHealthReport> {
    const activeJobs = await this.prisma.lineChatNicknameSyncJob.findMany({
      where: {
        status: {
          in: [LineChatNicknameSyncJobStatus.PENDING, LineChatNicknameSyncJobStatus.PROCESSING],
        },
      },
      select: {
        id: true,
        conversationId: true,
        lineOfficialAccountId: true,
        status: true,
        lineChatUserId: true,
        createdAt: true,
        conversation: { select: { lineChatUserId: true } },
      },
    }) as ActiveJob[];

    if (activeJobs.length === 0) return report;

    const conversationIds = [...new Set(activeJobs.map((job) => job.conversationId))];
    const candidateJobs = await this.prisma.lineChatNicknameSyncJob.findMany({
      where: { conversationId: { in: conversationIds } },
      select: { id: true, conversationId: true, createdAt: true },
      orderBy: [{ conversationId: "asc" }, { createdAt: "desc" }],
    }) as LatestJob[];

    const latestByConversation = new Map<string, LatestJob>();
    for (const job of candidateJobs) {
      if (!latestByConversation.has(job.conversationId)) {
        latestByConversation.set(job.conversationId, job);
      }
    }

    const staleActiveJobs = activeJobs.filter((job) => {
      const latest = latestByConversation.get(job.conversationId);
      return Boolean(latest && latest.createdAt.getTime() > job.createdAt.getTime());
    });
    const staleIds = new Set(staleActiveJobs.map((job) => job.id));
    const effectiveActiveJobs = activeJobs.filter((job) => !staleIds.has(job.id));

    if (staleActiveJobs.length > 0) {
      const staleOaIds = [...new Set(staleActiveJobs.map((job) => job.lineOfficialAccountId))];
      const oas = await this.prisma.lineOfficialAccount.findMany({
        where: { id: { in: staleOaIds } },
        select: { id: true, lineChatSessionId: true },
      });
      const sessionIdByOa = new Map(
        oas.flatMap((oa) => oa.lineChatSessionId ? [[oa.id, oa.lineChatSessionId] as const] : []),
      );

      for (const stale of staleActiveJobs) {
        if (stale.status === LineChatNicknameSyncJobStatus.PENDING && report.queue.pending > 0) {
          report.queue.pending -= 1;
        } else if (stale.status === LineChatNicknameSyncJobStatus.PROCESSING && report.queue.processing > 0) {
          report.queue.processing -= 1;
        }
        report.queue.superseded += 1;

        const sessionId = sessionIdByOa.get(stale.lineOfficialAccountId);
        const session = sessionId ? report.sessions.find((item) => item.id === sessionId) : undefined;
        if (session) {
          if (stale.status === LineChatNicknameSyncJobStatus.PENDING && session.jobs.pending > 0) {
            session.jobs.pending -= 1;
          } else if (stale.status === LineChatNicknameSyncJobStatus.PROCESSING && session.jobs.processing > 0) {
            session.jobs.processing -= 1;
          }
          session.jobs.superseded += 1;
        }
      }
    }

    const pending = effectiveActiveJobs.filter((job) => job.status === LineChatNicknameSyncJobStatus.PENDING);
    const mappedReadyPending = pending.filter((job) => Boolean(job.lineChatUserId?.trim() || job.conversation.lineChatUserId?.trim())).length;
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
