import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { LineChatNicknameSyncJobStatus, LineChatSessionStatus } from "@prisma/client";

export interface LineChatSessionSummary {
  id: string;
  sessionKey: string;
  displayName: string;
  status: LineChatSessionStatus;
  lastAuthenticatedAt: string | null;
  lastSuccessfulRequestAt: string | null;
  lastAuthFailureAt: string | null;
  consecutiveAuthFailures: number;
  mappedOaCount: number;
  enabledOaCount: number;
}

export interface LineChatQueueMetrics {
  pending: number;
  processing: number;
  success: number;
  failed: number;
  failedAuth: number;
  superseded: number;
  total: number;
}

export interface LineChatRolloutSummary {
  totalOas: number;
  enabledOas: number;
  disabledOas: number;
  missingChatBotId: number;
  missingSession: number;
}

export interface LineChatHealthReport {
  timestamp: string;
  sessions: LineChatSessionSummary[];
  queue: LineChatQueueMetrics;
  rollout: LineChatRolloutSummary;
}

@Injectable()
export class LineChatOperationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async getHealthSummary(): Promise<LineChatHealthReport> {
    const [sessions, oas, queueCounts] = await Promise.all([
      this.prisma.lineChatSession.findMany({
        include: {
          lineOfficialAccounts: {
            select: {
              id: true,
              lineChatNicknameSyncEnabled: true,
            },
          },
        },
        orderBy: { sessionKey: "asc" },
      }),
      this.prisma.lineOfficialAccount.findMany({
        where: { isActive: true, archivedAt: null },
        select: {
          id: true,
          chatBotId: true,
          lineChatSessionId: true,
          lineChatNicknameSyncEnabled: true,
        },
      }),
      this.prisma.lineChatNicknameSyncJob.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
    ]);

    const queueMap: Record<LineChatNicknameSyncJobStatus, number> = {
      PENDING: 0,
      PROCESSING: 0,
      SUCCESS: 0,
      FAILED: 0,
      FAILED_AUTH: 0,
      SUPERSEDED: 0,
    };

    let totalJobs = 0;
    for (const group of queueCounts) {
      queueMap[group.status] = group._count.id;
      totalJobs += group._count.id;
    }

    const sessionSummaries: LineChatSessionSummary[] = sessions.map((s) => ({
      id: s.id,
      sessionKey: s.sessionKey,
      displayName: s.displayName,
      status: s.status,
      lastAuthenticatedAt: s.lastAuthenticatedAt ? s.lastAuthenticatedAt.toISOString() : null,
      lastSuccessfulRequestAt: s.lastSuccessfulRequestAt ? s.lastSuccessfulRequestAt.toISOString() : null,
      lastAuthFailureAt: s.lastAuthFailureAt ? s.lastAuthFailureAt.toISOString() : null,
      consecutiveAuthFailures: s.consecutiveAuthFailures,
      mappedOaCount: s.lineOfficialAccounts.length,
      enabledOaCount: s.lineOfficialAccounts.filter((oa) => oa.lineChatNicknameSyncEnabled).length,
    }));

    let enabledCount = 0;
    let missingBotIdCount = 0;
    let missingSessionCount = 0;

    for (const oa of oas) {
      if (oa.lineChatNicknameSyncEnabled) {
        enabledCount++;
        if (!oa.chatBotId?.trim()) {
          missingBotIdCount++;
        }
        if (!oa.lineChatSessionId) {
          missingSessionCount++;
        }
      }
    }

    return {
      timestamp: new Date().toISOString(),
      sessions: sessionSummaries,
      queue: {
        pending: queueMap.PENDING,
        processing: queueMap.PROCESSING,
        success: queueMap.SUCCESS,
        failed: queueMap.FAILED,
        failedAuth: queueMap.FAILED_AUTH,
        superseded: queueMap.SUPERSEDED,
        total: totalJobs,
      },
      rollout: {
        totalOas: oas.length,
        enabledOas: enabledCount,
        disabledOas: oas.length - enabledCount,
        missingChatBotId: missingBotIdCount,
        missingSession: missingSessionCount,
      },
    };
  }

  public async retryFailedJobs(sessionKey?: string): Promise<{ retriedCount: number }> {
    let oaIds: string[] | undefined;

    if (sessionKey) {
      const session = await this.prisma.lineChatSession.findUnique({
        where: { sessionKey },
        include: { lineOfficialAccounts: { select: { id: true } } },
      });

      if (!session) {
        throw new NotFoundException(`Session "${sessionKey}" not found`);
      }

      oaIds = session.lineOfficialAccounts.map((oa) => oa.id);

      // If session was AUTH_REQUIRED, mark it back to ACTIVE when admin triggers retry
      await this.prisma.lineChatSession.update({
        where: { id: session.id },
        data: {
          status: LineChatSessionStatus.ACTIVE,
          consecutiveAuthFailures: 0,
        },
      });
    }

    const whereClause: {
      status: { in: LineChatNicknameSyncJobStatus[] };
      lineOfficialAccountId?: { in: string[] };
    } = {
      status: { in: [LineChatNicknameSyncJobStatus.FAILED_AUTH, LineChatNicknameSyncJobStatus.FAILED] },
    };

    if (oaIds) {
      whereClause.lineOfficialAccountId = { in: oaIds };
    }

    const result = await this.prisma.lineChatNicknameSyncJob.updateMany({
      where: whereClause,
      data: {
        status: LineChatNicknameSyncJobStatus.PENDING,
        attemptCount: 0,
        scheduledAt: new Date(),
        lastError: "Manually re-queued by admin operations",
        lockedUntil: null,
        workerId: null,
      },
    });

    return { retriedCount: result.count };
  }

  public async toggleOaNicknameSync(oaId: string, enabled: boolean): Promise<{ oaId: string; enabled: boolean }> {
    const oa = await this.prisma.lineOfficialAccount.findUnique({
      where: { id: oaId },
    });

    if (!oa) {
      throw new NotFoundException(`LineOfficialAccount "${oaId}" not found`);
    }

    await this.prisma.lineOfficialAccount.update({
      where: { id: oaId },
      data: { lineChatNicknameSyncEnabled: enabled },
    });

    return { oaId, enabled };
  }
}
