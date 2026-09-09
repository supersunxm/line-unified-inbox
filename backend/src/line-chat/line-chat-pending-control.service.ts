import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { LineChatNicknameSyncJobStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";

const PROFILE_B_SESSION_KEY = "profile-b";
const PAUSE_MARKER = "OPERATOR_PAUSED_PENDING";
const PAUSE_UNTIL = new Date("2099-12-31T23:59:59.000Z");

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
    const result = await this.prisma.lineChatNicknameSyncJob.updateMany({
      where: {
        lineOfficialAccountId: { in: oaIds },
        status: LineChatNicknameSyncJobStatus.PENDING,
        lastError: PAUSE_MARKER,
        scheduledAt: PAUSE_UNTIL,
      },
      data: {
        scheduledAt: new Date(),
        lastError: null,
      },
    });

    return {
      sessionKey,
      paused: false,
      resumedPending: result.count,
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
