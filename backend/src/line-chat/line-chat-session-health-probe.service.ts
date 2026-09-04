import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import * as fs from "node:fs";
import { PrismaService } from "../prisma.service";
import { classifySessionHealth } from "./line-chat-health-classifier";
import { LineChatHealthService } from "./line-chat-health.service";
import type {
  LineChatHealthEventSource,
  LineChatHealthFailureStage,
  LineChatHealthManagerAuth,
  LineChatSessionHealthStatus,
} from "./line-chat-health.types";
import {
  LineChatProfileOperationCoordinator,
  ProfileOperationLeaseLostError,
} from "./line-chat-profile-operation-coordinator.service";
import { LineChatSessionService } from "./line-chat-session.service";
import type { DiagnosticsResult } from "./line-chat.types";

export type LineChatSessionHealthProbeResult =
  | {
      outcome: "RECORDED";
      sessionId: string;
      status: LineChatSessionHealthStatus;
      failureStage: LineChatHealthFailureStage | null;
      transitionEventCreated: boolean;
      durationMs: number;
    }
  | {
      outcome: "SKIPPED_BUSY";
      sessionId: string;
      retryAfterMs: number;
    }
  | {
      outcome: "SKIPPED_LEASE_LOST";
      sessionId: string;
    };

function boundedDurationMs(startedAt: number): number {
  const elapsed = Date.now() - startedAt;
  if (!Number.isFinite(elapsed) || elapsed < 0) return 0;
  return Math.min(86_400_000, Math.floor(elapsed));
}

function managerAuthFromDiagnostics(result: DiagnosticsResult): LineChatHealthManagerAuth {
  if (result.apiAuthenticated === "YES") return "CONFIRMED";
  if (result.apiAuthenticated === "NO" || result.authDestinationDetected) return "EXPLICIT_REQUIRED";
  return "UNKNOWN";
}

export function classifySessionProbeExecutionFailure(error: unknown): LineChatHealthFailureStage {
  const message = error instanceof Error ? error.message : String(error);
  if (/Singleton(?:Lock|Socket|Cookie)|profile[^\n]*(?:in use|locked)|ProcessSingleton/iu.test(message)) {
    return "PROFILE_LOCK";
  }
  if (/launchPersistentContext|Failed to launch|Executable doesn't exist|browserType\.launch/iu.test(message)) {
    return "CHROMIUM_LAUNCH";
  }
  return "UNKNOWN";
}

@Injectable()
export class LineChatSessionHealthProbeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LineChatSessionService) private readonly sessionService: LineChatSessionService,
    @Inject(LineChatProfileOperationCoordinator)
    private readonly profileCoordinator: LineChatProfileOperationCoordinator,
    @Inject(LineChatHealthService) private readonly healthService: LineChatHealthService,
  ) {}

  /**
   * Runs one bounded, read-only Manager-auth health observation for a session.
   *
   * This service has no scheduler and no controller. Nothing invokes it merely
   * by constructing the Nest module. The browser operation is serialized by
   * the shared profile coordinator so it cannot overlap nickname/resolver work
   * on the same persistent profile.
   */
  public async probeSession(
    sessionId: string,
    source: LineChatHealthEventSource = "MANUAL",
  ): Promise<LineChatSessionHealthProbeResult> {
    const startedAt = Date.now();
    const session = await this.prisma.lineChatSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        sessionKey: true,
        profileStorageKey: true,
        profilePath: true,
      },
    });
    if (!session) throw new NotFoundException(`Line chat session "${sessionId}" not found.`);

    let profilePath: string;
    try {
      profilePath = this.sessionService.resolveProfilePath(session);
    } catch {
      return this.recordFailure({
        sessionId,
        status: "CONFIG_ERROR",
        failureStage: "PROFILE_PATH_INVALID",
        source,
        startedAt,
      });
    }

    if (!fs.existsSync(profilePath)) {
      return this.recordFailure({
        sessionId,
        status: "CONFIG_ERROR",
        failureStage: "PROFILE_MISSING",
        source,
        startedAt,
      });
    }

    try {
      const coordinated = await this.profileCoordinator.withProfileOperation(
        { sessionId, operationKind: "HEALTH_SESSION" },
        async () => {
          try {
            const diagnostics = await this.sessionService.runDiagnostics({
              profilePath,
              surface: "bot",
              headless: true,
            });
            const managerAuth = managerAuthFromDiagnostics(diagnostics);
            const classification = classifySessionHealth({
              endpoint: "MANAGER",
              profileState: "PRESENT",
              managerAuth,
              loginRedirect: diagnostics.authDestinationDetected,
              httpStatus: diagnostics.apiAuthProbe.status ?? diagnostics.mainDocumentStatus,
              ...(managerAuth === "UNKNOWN"
                && !diagnostics.navigationSucceeded
                && diagnostics.apiAuthProbe.transport === "FAILED"
                ? { failure: "UNEXPECTED" as const }
                : {}),
            });
            const durationMs = boundedDurationMs(startedAt);
            const recorded = await this.healthService.recordSessionHealthResult({
              sessionId,
              status: classification.status,
              failureStage: classification.failureStage,
              checkedAt: new Date(),
              httpStatus: diagnostics.apiAuthProbe.status ?? diagnostics.mainDocumentStatus ?? null,
              durationMs,
              source,
            });
            return {
              outcome: "RECORDED" as const,
              sessionId,
              status: recorded.status,
              failureStage: recorded.failureStage,
              transitionEventCreated: recorded.transitionEventCreated,
              durationMs,
            };
          } catch (error: unknown) {
            const failureStage = classifySessionProbeExecutionFailure(error);
            return this.recordFailure({
              sessionId,
              status: "DEGRADED",
              failureStage,
              source,
              startedAt,
            });
          }
        },
      );

      if (!coordinated.acquired) {
        return {
          outcome: "SKIPPED_BUSY",
          sessionId,
          retryAfterMs: coordinated.retryAfterMs,
        };
      }
      return coordinated.value;
    } catch (error: unknown) {
      if (error instanceof ProfileOperationLeaseLostError) {
        return { outcome: "SKIPPED_LEASE_LOST", sessionId };
      }
      throw error;
    }
  }

  private async recordFailure(input: {
    sessionId: string;
    status: "DEGRADED" | "CONFIG_ERROR";
    failureStage: LineChatHealthFailureStage;
    source: LineChatHealthEventSource;
    startedAt: number;
  }): Promise<Extract<LineChatSessionHealthProbeResult, { outcome: "RECORDED" }>> {
    const durationMs = boundedDurationMs(input.startedAt);
    const recorded = await this.healthService.recordSessionHealthResult({
      sessionId: input.sessionId,
      status: input.status,
      failureStage: input.failureStage,
      checkedAt: new Date(),
      durationMs,
      source: input.source,
    });
    return {
      outcome: "RECORDED",
      sessionId: input.sessionId,
      status: recorded.status,
      failureStage: recorded.failureStage,
      transitionEventCreated: recorded.transitionEventCreated,
      durationMs,
    };
  }
}
