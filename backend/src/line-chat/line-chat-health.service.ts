import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import {
  LINE_CHAT_HEALTH_FAILURE_STAGES,
  type LineChatHealthEventSource,
  type LineChatHealthFailureStage,
  type RecordOaHealthResultInput,
  type RecordSessionHealthResultInput,
} from "./line-chat-health.types";

const FAILURE_STAGES = new Set<string>(LINE_CHAT_HEALTH_FAILURE_STAGES);

function safeDate(value: Date | undefined, label: string): Date {
  const date = value ? new Date(value.getTime()) : new Date();
  if (Number.isNaN(date.getTime())) throw new TypeError(`${label} must be a valid Date.`);
  return date;
}

function safeNullableHttpStatus(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

function safeNullableDuration(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number.isInteger(value) && value >= 0 && value <= 86_400_000 ? value : null;
}

function safeFailureStage(value: LineChatHealthFailureStage | null | undefined): LineChatHealthFailureStage | null {
  if (value === null || value === undefined) return null;
  return FAILURE_STAGES.has(value) ? value : null;
}

function transitionRequired(previousStatus: string, nextStatus: string, previousStage: string | null, nextStage: string | null): boolean {
  return previousStatus !== nextStatus || previousStage !== nextStage;
}

@Injectable()
export class LineChatHealthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Records one sanitized session observation. Snapshot and transition event
   * are committed together; no browser or network operation occurs here.
   */
  public async recordSessionHealthResult(input: RecordSessionHealthResultInput): Promise<{
    status: RecordSessionHealthResultInput["status"];
    failureStage: LineChatHealthFailureStage | null;
    transitionEventCreated: boolean;
  }> {
    const checkedAt = safeDate(input.checkedAt, "checkedAt");
    const failureStage = safeFailureStage(input.failureStage);
    const httpStatus = safeNullableHttpStatus(input.httpStatus);
    const durationMs = safeNullableDuration(input.durationMs);
    const source: LineChatHealthEventSource = input.source ?? "MANUAL";

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.lineChatSession.findUnique({
        where: { id: input.sessionId },
        select: {
          healthStatus: true,
          healthFailureStage: true,
          healthLastFailureAt: true,
          healthLastHealthyAt: true,
          healthNextCheckAt: true,
        },
      });
      if (!current) throw new NotFoundException(`Line chat session "${input.sessionId}" not found.`);

      const eventRequired = transitionRequired(
        current.healthStatus,
        input.status,
        current.healthFailureStage,
        failureStage,
      );
      const healthy = input.status === "CONNECTED";
      await tx.lineChatSession.update({
        where: { id: input.sessionId },
        data: {
          healthStatus: input.status,
          healthFailureStage: healthy ? null : failureStage,
          healthLastCheckedAt: checkedAt,
          healthLastHealthyAt: healthy ? checkedAt : current.healthLastHealthyAt,
          healthLastFailureAt: healthy ? current.healthLastFailureAt : checkedAt,
          healthLastHttpStatus: httpStatus,
          healthLastDurationMs: durationMs,
          healthConsecutiveFailures: healthy ? 0 : { increment: 1 },
          healthNextCheckAt: input.nextCheckAt === undefined ? current.healthNextCheckAt : input.nextCheckAt,
        },
      });

      if (eventRequired) {
        await tx.lineChatHealthEvent.create({
          data: {
            entityType: "SESSION",
            lineChatSessionId: input.sessionId,
            lineOfficialAccountId: null,
            status: input.status,
            failureStage: healthy ? null : failureStage,
            httpStatus,
            durationMs,
            source,
            detectedAt: checkedAt,
          },
        });
      }
      return { status: input.status, failureStage: healthy ? null : failureStage, transitionEventCreated: eventRequired };
    });
  }

  /**
   * Records one sanitized OA/Manager observation. Parent-session status is
   * deliberately not changed here; effective OA status is derived separately.
   */
  public async recordOaHealthResult(input: RecordOaHealthResultInput): Promise<{
    status: RecordOaHealthResultInput["status"];
    failureStage: LineChatHealthFailureStage | null;
    transitionEventCreated: boolean;
  }> {
    const checkedAt = safeDate(input.checkedAt, "checkedAt");
    const failureStage = safeFailureStage(input.failureStage);
    const httpStatus = safeNullableHttpStatus(input.httpStatus);
    const durationMs = safeNullableDuration(input.durationMs);
    const source: LineChatHealthEventSource = input.source ?? "MANUAL";

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.lineOfficialAccount.findUnique({
        where: { id: input.lineOfficialAccountId },
        select: {
          healthStatus: true,
          healthFailureStage: true,
          healthLastFailureAt: true,
          healthLastHealthyAt: true,
          healthNextCheckAt: true,
          healthSessionSnapshotAt: true,
        },
      });
      if (!current) throw new NotFoundException(`Line official account "${input.lineOfficialAccountId}" not found.`);

      const eventRequired = transitionRequired(
        current.healthStatus,
        input.status,
        current.healthFailureStage,
        failureStage,
      );
      const healthy = input.status === "CONNECTED";
      await tx.lineOfficialAccount.update({
        where: { id: input.lineOfficialAccountId },
        data: {
          healthStatus: input.status,
          healthFailureStage: healthy ? null : failureStage,
          healthLastCheckedAt: checkedAt,
          healthLastHealthyAt: healthy ? checkedAt : current.healthLastHealthyAt,
          healthLastFailureAt: healthy ? current.healthLastFailureAt : checkedAt,
          healthLastHttpStatus: httpStatus,
          healthLastDurationMs: durationMs,
          healthConsecutiveFailures: healthy ? 0 : { increment: 1 },
          healthNextCheckAt: input.nextCheckAt === undefined ? current.healthNextCheckAt : input.nextCheckAt,
          healthSessionSnapshotAt: input.healthSessionSnapshotAt === undefined
            ? current.healthSessionSnapshotAt
            : input.healthSessionSnapshotAt,
        },
      });

      if (eventRequired) {
        await tx.lineChatHealthEvent.create({
          data: {
            entityType: "OA",
            lineChatSessionId: null,
            lineOfficialAccountId: input.lineOfficialAccountId,
            status: input.status,
            failureStage: healthy ? null : failureStage,
            httpStatus,
            durationMs,
            source,
            detectedAt: checkedAt,
          },
        });
      }
      return { status: input.status, failureStage: healthy ? null : failureStage, transitionEventCreated: eventRequired };
    });
  }
}

export { safeNullableDuration, safeNullableHttpStatus, safeFailureStage, transitionRequired };
