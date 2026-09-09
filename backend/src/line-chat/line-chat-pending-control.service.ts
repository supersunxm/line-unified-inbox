import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { LineChatNicknameSyncJobStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";

const PROFILE_B_SESSION_KEY = "profile-b";
const PAUSE_MARKER = "OPERATOR_PAUSED_PENDING";
const PAUSE_UNTIL = new Date("2099-12-31T23:59:59.000Z");
const MAX_RUN_JOBS = 500;

function sanitizeRunError(value: string | null): string | null {
  if (!value) return null;
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/(token|authorization|cookie|secret)=?[:\s]+[^\s,;]+/gi, "$1=[REDACTED]")
    .slice(0, 240);
}

@Injectable()
export class LineChatPendingControlService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async status(sessionKey: string) {
    const oaIds = await this.resolveOaIds(sessionKey);
    const [pausedPending, running] = await Promise.all([
      this.prisma.lineChatNicknameSyncJob.count({
        where: {
          lineOfficialAccountId: { in: oaIds },
          status: LineChatNicknameSyncJobStatus.PENDING,
          lastError: PAUSE_MARKER,
          scheduledAt: PAUSE_UNTIL,
        },
      }),
      this.prisma.lineChatNicknameSyncJob.count({
        where: {
          lineOfficialAccountId: { in: oaIds },
          status: LineChatNicknameSyncJobStatus.PROCESSING,
        },
      }),
    ]);

    return {
      sessionKey,
      paused: pausedPending > 0,
      pausedPending,
      running,
    };
  }

  public async pause(sessionKey: string) {
    const oaIds = await this.resolveOaIds(sessionKey);
    const result = await this.prisma.lineChatNicknameSyncJob.updateMany({
      where: {
        lineOfficialAccountId: { in: oaIds },
        status: LineChatNicknameSyncJobStatus.PENDING,
      },
      data: {
        scheduledAt: PAUSE_UNTIL,
        lastError: PAUSE_MARKER,
      },
    });

    const running = await this.prisma.lineChatNicknameSyncJob.count({
      where: {
        lineOfficialAccountId: { in: oaIds },
        status: LineChatNicknameSyncJobStatus.PROCESSING,
      },
    });

    return {
      sessionKey,
      paused: true,
      pausedPending: result.count,
      running,
      note: running > 0 ? "Running job is not force-killed; no pending job will be eligible while paused." : null,
    };
  }

  public async resume(sessionKey: string) {
    const oaIds = await this.resolveOaIds(sessionKey);
    const candidates = await this.prisma.lineChatNicknameSyncJob.findMany({
      where: {
        lineOfficialAccountId: { in: oaIds },
        status: LineChatNicknameSyncJobStatus.PENDING,
        lastError: PAUSE_MARKER,
        scheduledAt: PAUSE_UNTIL,
      },
      orderBy: { createdAt: "asc" },
      take: MAX_RUN_JOBS,
      select: { id: true },
    });
    const jobIds = candidates.map((job) => job.id);
    const resumedAt = new Date();

    const result = jobIds.length
      ? await this.prisma.lineChatNicknameSyncJob.updateMany({
          where: {
            id: { in: jobIds },
            lineOfficialAccountId: { in: oaIds },
            status: LineChatNicknameSyncJobStatus.PENDING,
            lastError: PAUSE_MARKER,
            scheduledAt: PAUSE_UNTIL,
          },
          data: {
            scheduledAt: resumedAt,
            lastError: null,
          },
        })
      : { count: 0 };

    return {
      sessionKey,
      paused: false,
      resumedPending: result.count,
      resumedAt: resumedAt.toISOString(),
      jobIds,
    };
  }

  public async runProgress(sessionKey: string, requestedJobIds: string[]) {
    const oaIds = await this.resolveOaIds(sessionKey);
    const jobIds = [...new Set(requestedJobIds.map((value) => value.trim()).filter(Boolean))];
    if (jobIds.length === 0) throw new BadRequestException("At least one run job ID is required.");
    if (jobIds.length > MAX_RUN_JOBS) throw new BadRequestException(`A run can contain at most ${MAX_RUN_JOBS} jobs.`);

    const trackedJobs = await this.prisma.lineChatNicknameSyncJob.findMany({
      where: {
        id: { in: jobIds },
        lineOfficialAccountId: { in: oaIds },
      },
      select: {
        id: true,
        status: true,
        lineChatUserId: true,
        lastError: true,
        updatedAt: true,
        createdAt: true,
        conversationId: true,
      },
    });

    // A tracked job can remain deferred in PENDING while a newer job for the same
    // conversation becomes the authoritative Latest-Wins job and succeeds. Read
    // the newest job per conversation so the progress UI reflects the real outcome
    // instead of leaving the older deferred job stuck in "Waiting map".
    const conversationIds = [...new Set(trackedJobs.map((job) => job.conversationId))];
    const conversationJobs = conversationIds.length
      ? await this.prisma.lineChatNicknameSyncJob.findMany({
          where: {
            conversationId: { in: conversationIds },
            lineOfficialAccountId: { in: oaIds },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            lineChatUserId: true,
            lastError: true,
            updatedAt: true,
            createdAt: true,
            conversationId: true,
          },
        })
      : [];

    const latestByConversation = new Map<string, (typeof conversationJobs)[number]>();
    for (const job of conversationJobs) {
      if (!latestByConversation.has(job.conversationId)) latestByConversation.set(job.conversationId, job);
    }

    let success = 0;
    let processing = 0;
    let waitingForMapping = 0;
    let mappedReady = 0;
    let failed = 0;
    let superseded = 0;
    let reconciledWithNewerJob = 0;
    const effectiveJobs: typeof trackedJobs = [];

    for (const trackedJob of trackedJobs) {
      const latestJob = latestByConversation.get(trackedJob.conversationId);
      const job = latestJob && latestJob.createdAt >= trackedJob.createdAt ? latestJob : trackedJob;
      effectiveJobs.push(job);
      if (job.id !== trackedJob.id) reconciledWithNewerJob += 1;

      switch (job.status) {
        case LineChatNicknameSyncJobStatus.SUCCESS:
          success += 1;
          break;
        case LineChatNicknameSyncJobStatus.PROCESSING:
          processing += 1;
          break;
        case LineChatNicknameSyncJobStatus.FAILED:
        case LineChatNicknameSyncJobStatus.FAILED_AUTH:
          failed += 1;
          break;
        case LineChatNicknameSyncJobStatus.SUPERSEDED:
          superseded += 1;
          break;
        case LineChatNicknameSyncJobStatus.PENDING:
          if (job.lineChatUserId?.trim()) mappedReady += 1;
          else waitingForMapping += 1;
          break;
      }
    }

    const total = jobIds.length;
    const completed = success + failed + superseded;
    const remaining = Math.max(0, total - completed);
    const missing = Math.max(0, total - trackedJobs.length);

    return {
      sessionKey,
      total,
      success,
      processing,
      waitingForMapping,
      mappedReady,
      failed,
      superseded,
      reconciledWithNewerJob,
      missing,
      completed,
      remaining,
      progressPercent: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
      finished: remaining === 0,
      checkedAt: new Date().toISOString(),
      failures: effectiveJobs
        .filter((job) => job.status === LineChatNicknameSyncJobStatus.FAILED || job.status === LineChatNicknameSyncJobStatus.FAILED_AUTH)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, 20)
        .map((job) => ({
          jobId: job.id,
          conversationId: job.conversationId,
          status: job.status,
          error: sanitizeRunError(job.lastError),
          updatedAt: job.updatedAt.toISOString(),
        })),
    };
  }

  private async resolveOaIds(sessionKey: string): Promise<string[]> {
    if (sessionKey !== PROFILE_B_SESSION_KEY) {
      throw new NotFoundException("Pending queue pause is currently enabled only for profile-b.");
    }

    const session = await this.prisma.lineChatSession.findUnique({
      where: { sessionKey },
      select: {
        lineOfficialAccounts: {
          select: { id: true },
        },
      },
    });

    if (!session) throw new NotFoundException("LINE Chat session not found.");
    const oaIds = session.lineOfficialAccounts.map((oa) => oa.id);
    if (oaIds.length === 0) throw new NotFoundException("No LINE OA is mapped to this session.");
    return oaIds;
  }
}
