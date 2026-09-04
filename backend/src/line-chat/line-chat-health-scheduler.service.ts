import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { LineChatNicknameSyncJobStatus, LineChatSessionStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { LineChatOaHealthProbeService } from "./line-chat-oa-health-probe.service";
import { LineChatSessionHealthProbeService } from "./line-chat-session-health-probe.service";

export const LINE_CHAT_HEALTH_SCHEDULER_TICK_MS = 60_000;
export const LINE_CHAT_SESSION_HEALTH_TARGET_MS = 12 * 60_000;
export const LINE_CHAT_OA_HEALTH_TARGET_MS = 3 * 60 * 60_000;
const SESSION_JITTER_WINDOW_MS = 2 * 60_000;
const OA_JITTER_WINDOW_MS = 15 * 60_000;

function stableJitterMs(key: string, windowMs: number): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = (hash >>> 0) / 0xffffffff;
  return Math.round((normalized * 2 - 1) * windowMs);
}

export function nextScheduledAt(
  entity: "SESSION" | "OA",
  entityId: string,
  checkedAt: Date,
): Date {
  const targetMs = entity === "SESSION"
    ? LINE_CHAT_SESSION_HEALTH_TARGET_MS
    : LINE_CHAT_OA_HEALTH_TARGET_MS;
  const jitterWindowMs = entity === "SESSION"
    ? SESSION_JITTER_WINDOW_MS
    : OA_JITTER_WINDOW_MS;
  return new Date(checkedAt.getTime() + targetMs + stableJitterMs(entityId, jitterWindowMs));
}

@Injectable()
export class LineChatHealthSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LineChatHealthSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LineChatSessionHealthProbeService)
    private readonly sessionProbe: LineChatSessionHealthProbeService,
    @Inject(LineChatOaHealthProbeService)
    private readonly oaProbe: LineChatOaHealthProbeService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === "test") return;
    if (process.env.LINE_CHAT_HEALTH_SCHEDULER_ENABLED !== "true") {
      this.logger.log(JSON.stringify({ event: "line_chat_health_scheduler_disabled" }));
      return;
    }
    if (process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE === "true") {
      this.logger.warn(JSON.stringify({ event: "line_chat_health_scheduler_blocked_maintenance" }));
      return;
    }
    if (process.env.DISABLE_NICKNAME_WORKER === "true") {
      this.logger.warn(JSON.stringify({ event: "line_chat_health_scheduler_blocked_worker_disabled" }));
      return;
    }

    this.logger.log(JSON.stringify({
      event: "line_chat_health_scheduler_started",
      tickMs: LINE_CHAT_HEALTH_SCHEDULER_TICK_MS,
      sessionTargetMs: LINE_CHAT_SESSION_HEALTH_TARGET_MS,
      oaTargetMs: LINE_CHAT_OA_HEALTH_TARGET_MS,
      maxOperationsPerTick: 1,
    }));
    this.timer = setInterval(() => void this.runTick(), LINE_CHAT_HEALTH_SCHEDULER_TICK_MS);
    this.timer.unref?.();
    void this.runTick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  public async runTick(now = new Date()): Promise<"SESSION" | "OA" | "SKIPPED_NICKNAME" | "IDLE" | "BUSY"> {
    if (this.running) return "BUSY";
    this.running = true;
    try {
      if (process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE === "true"
        || process.env.DISABLE_NICKNAME_WORKER === "true") {
        return "IDLE";
      }

      const nicknameBacklog = await this.prisma.lineChatNicknameSyncJob.count({
        where: {
          OR: [
            {
              status: LineChatNicknameSyncJobStatus.PENDING,
              scheduledAt: { lte: now },
            },
            { status: LineChatNicknameSyncJobStatus.PROCESSING },
          ],
        },
      });
      if (nicknameBacklog > 0) {
        this.logger.log(JSON.stringify({
          event: "line_chat_health_scheduler_deferred_nickname_backlog",
          count: nicknameBacklog,
        }));
        return "SKIPPED_NICKNAME";
      }

      const sessionDueBefore = new Date(now.getTime() - LINE_CHAT_SESSION_HEALTH_TARGET_MS);
      const session = await this.prisma.lineChatSession.findFirst({
        where: {
          status: LineChatSessionStatus.ACTIVE,
          lineOfficialAccounts: {
            some: {
              isActive: true,
              archivedAt: null,
              lineChatNicknameSyncEnabled: true,
              chatBotId: { not: null },
            },
          },
          OR: [
            { healthNextCheckAt: { lte: now } },
            {
              healthNextCheckAt: null,
              OR: [
                { healthLastCheckedAt: null },
                { healthLastCheckedAt: { lte: sessionDueBefore } },
              ],
            },
          ],
        },
        orderBy: [
          { healthNextCheckAt: "asc" },
          { healthLastCheckedAt: "asc" },
          { id: "asc" },
        ],
        select: { id: true },
      });

      if (session) {
        const result = await this.sessionProbe.probeSession(session.id, "SCHEDULED");
        if (result.outcome === "RECORDED") {
          const checkedAt = new Date();
          await this.prisma.lineChatSession.update({
            where: { id: session.id },
            data: { healthNextCheckAt: nextScheduledAt("SESSION", session.id, checkedAt) },
          });
          this.logger.log(JSON.stringify({
            event: "line_chat_health_scheduler_session_checked",
            sessionId: session.id,
            status: result.status,
            failureStage: result.failureStage,
          }));
        }
        return "SESSION";
      }

      const oaDueBefore = new Date(now.getTime() - LINE_CHAT_OA_HEALTH_TARGET_MS);
      const oa = await this.prisma.lineOfficialAccount.findFirst({
        where: {
          isActive: true,
          archivedAt: null,
          lineChatNicknameSyncEnabled: true,
          chatBotId: { not: null },
          lineChatSessionId: { not: null },
          OR: [
            { healthNextCheckAt: { lte: now } },
            {
              healthNextCheckAt: null,
              OR: [
                { healthLastCheckedAt: null },
                { healthLastCheckedAt: { lte: oaDueBefore } },
              ],
            },
          ],
        },
        orderBy: [
          { healthNextCheckAt: "asc" },
          { healthLastCheckedAt: "asc" },
          { id: "asc" },
        ],
        select: { id: true },
      });

      if (oa) {
        const result = await this.oaProbe.probeOa(oa.id, "SCHEDULED");
        if (result.outcome === "RECORDED") {
          const checkedAt = new Date();
          await this.prisma.lineOfficialAccount.update({
            where: { id: oa.id },
            data: { healthNextCheckAt: nextScheduledAt("OA", oa.id, checkedAt) },
          });
          this.logger.log(JSON.stringify({
            event: "line_chat_health_scheduler_oa_checked",
            lineOfficialAccountId: oa.id,
            status: result.status,
            failureStage: result.failureStage,
            sessionStatus: result.sessionStatus,
          }));
        }
        return "OA";
      }

      return "IDLE";
    } catch (error: unknown) {
      this.logger.error(JSON.stringify({
        event: "line_chat_health_scheduler_tick_failed",
        error: error instanceof Error ? error.message : String(error),
      }));
      return "IDLE";
    } finally {
      this.running = false;
    }
  }
}
