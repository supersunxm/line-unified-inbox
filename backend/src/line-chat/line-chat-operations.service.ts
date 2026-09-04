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
  healthStatus: string;
  healthFailureStage: string | null;
  healthLastCheckedAt: string | null;
  healthLastHealthyAt: string | null;
  activeProfileLeases: number;
  activeLeaseOperation: string | null;
  jobs: LineChatQueueMetrics;
  recentFailures: LineChatSafeJobFailure[];
}

export type LineChatFailureCategory = "AUTHENTICATION" | "TRANSPORT" | "EXECUTION" | "VALIDATION" | "TIMEOUT" | "PROFILE_LOCK" | "COORDINATOR" | "UNKNOWN";

export interface LineChatSafeJobFailure {
  jobId: string;
  oaId: string;
  oaName: string;
  failureCategory: LineChatFailureCategory;
  failureStage: string | null;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
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

export function classifyLineChatJobFailure(status: string, lastError?: string | null): LineChatFailureCategory {
  if (status === "FAILED_AUTH") return "AUTHENTICATION";
  const value = (lastError ?? "").toUpperCase();
  if (value.includes("PROFILE_LOCK") || value.includes("PROFILE OPERATION BUSY")) return "PROFILE_LOCK";
  if (value.includes("COORDINATOR") || value.includes("LEASE")) return "COORDINATOR";
  if (value.includes("TIMEOUT") || value.includes("ETIMEDOUT")) return "TIMEOUT";
  if (value.includes("NETWORK") || value.includes("ECONN") || value.includes("TRANSPORT")) return "TRANSPORT";
  if (value.includes("VALIDATION") || value.includes("MISSING") || value.includes("INVALID") || value.includes("NO_MATCH")) return "VALIDATION";
  if (value.includes("EXECUTION") || value.includes("HTTP") || value.includes("REQUEST")) return "EXECUTION";
  return value ? "EXECUTION" : "UNKNOWN";
}

function emptyQueue(): LineChatQueueMetrics {
  return { pending: 0, processing: 0, success: 0, failed: 0, failedAuth: 0, superseded: 0, total: 0 };
}

function addJobCount(queue: LineChatQueueMetrics, status: LineChatNicknameSyncJobStatus, count: number) {
  const keys: Record<LineChatNicknameSyncJobStatus, keyof Omit<LineChatQueueMetrics, "total">> = {
    PENDING: "pending", PROCESSING: "processing", SUCCESS: "success", FAILED: "failed", FAILED_AUTH: "failedAuth", SUPERSEDED: "superseded",
  };
  queue[keys[status]] += count;
  queue.total += count;
}

@Injectable()
export class LineChatOperationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async getHealthSummary(): Promise<LineChatHealthReport> {
    const now = new Date();
    const [sessions, oas, queueCounts, sessionQueueCounts, activeLeases, recentFailures] = await Promise.all([
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
      this.prisma.lineChatNicknameSyncJob.groupBy({
        by: ["lineOfficialAccountId", "status"],
        _count: { id: true },
      }),
      this.prisma.lineChatProfileOperationLease.findMany({
        where: { leaseUntil: { gt: now } },
        select: { lineChatSessionId: true, operationKind: true },
      }),
      this.prisma.lineChatNicknameSyncJob.findMany({
        where: { status: { in: [LineChatNicknameSyncJobStatus.FAILED_AUTH, LineChatNicknameSyncJobStatus.FAILED] } },
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: {
          id: true,
          status: true,
          lastError: true,
          attemptCount: true,
          createdAt: true,
          updatedAt: true,
          lineOfficialAccount: { select: { id: true, name: true, lineChatSessionId: true } },
        },
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

    const sessionSummaries: LineChatSessionSummary[] = sessions.map((s) => {
      const oaIds = new Set(s.lineOfficialAccounts.map((oa) => oa.id));
      const jobs = emptyQueue();
      for (const group of sessionQueueCounts) {
        if (oaIds.has(group.lineOfficialAccountId)) addJobCount(jobs, group.status, group._count.id);
      }
      const leases = activeLeases.filter((lease) => lease.lineChatSessionId === s.id);
      return {
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
        healthStatus: s.healthStatus,
        healthFailureStage: s.healthFailureStage,
        healthLastCheckedAt: s.healthLastCheckedAt?.toISOString() ?? null,
        healthLastHealthyAt: s.healthLastHealthyAt?.toISOString() ?? null,
        activeProfileLeases: leases.length,
        activeLeaseOperation: leases[0]?.operationKind ?? null,
        jobs,
        recentFailures: recentFailures
          .filter((job) => job.lineOfficialAccount.lineChatSessionId === s.id)
          .slice(0, 10)
          .map((job) => ({
            jobId: job.id,
            oaId: job.lineOfficialAccount.id,
            oaName: job.lineOfficialAccount.name,
            failureCategory: classifyLineChatJobFailure(job.status, job.lastError),
            failureStage: job.lastError?.startsWith("RESOLVE_") ? job.lastError : null,
            attemptCount: job.attemptCount,
            createdAt: job.createdAt.toISOString(),
            updatedAt: job.updatedAt.toISOString(),
          })),
      };
    });

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
