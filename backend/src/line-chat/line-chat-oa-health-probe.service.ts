import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import * as fs from "node:fs";
import { PrismaService } from "../prisma.service";
import { classifyOaHealth, classifySessionHealth } from "./line-chat-health-classifier";
import { LineChatHealthService } from "./line-chat-health.service";
import type {
  LineChatHealthEventSource,
  LineChatHealthFailureStage,
  LineChatHealthManagerAuth,
  LineChatOaHealthStatus,
  LineChatSessionHealthStatus,
} from "./line-chat-health.types";
import { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";
import { classifySessionProbeExecutionFailure } from "./line-chat-session-health-probe.service";
import { LineChatSessionService } from "./line-chat-session.service";
import type { DiagnosticsResult } from "./line-chat.types";

export type LineChatOaHealthProbeResult =
  | {
      outcome: "RECORDED";
      lineOfficialAccountId: string;
      status: LineChatOaHealthStatus;
      failureStage: LineChatHealthFailureStage | null;
      transitionEventCreated: boolean;
      sessionStatus: LineChatSessionHealthStatus;
      sessionTransitionEventCreated: boolean;
      durationMs: number;
    }
  | {
      outcome: "SKIPPED_BUSY";
      lineOfficialAccountId: string;
      retryAfterMs: number;
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

function chatListHttpStatus(result: DiagnosticsResult, botId: string): number | undefined {
  const expectedPath = `/api/v2/bots/${encodeURIComponent(botId.trim())}/chats`;
  const response = result.observedResponses.find((item) => {
    try {
      return new URL(item.url, "https://chat.line.biz").pathname === expectedPath;
    } catch {
      return item.url.includes(expectedPath);
    }
  });
  return response?.status;
}

function sessionClassificationFromDiagnostics(result: DiagnosticsResult) {
  const managerAuth = managerAuthFromDiagnostics(result);
  return classifySessionHealth({
    endpoint: "MANAGER",
    profileState: "PRESENT",
    managerAuth,
    loginRedirect: result.authDestinationDetected,
    httpStatus: result.apiAuthProbe.status ?? result.mainDocumentStatus,
    ...(managerAuth === "UNKNOWN"
      && !result.navigationSucceeded
      && result.apiAuthProbe.transport === "FAILED"
      ? { failure: "UNEXPECTED" as const }
      : {}),
  });
}

function oaClassificationFromDiagnostics(result: DiagnosticsResult, botId: string) {
  const managerAuth = managerAuthFromDiagnostics(result);

  if (managerAuth !== "CONFIRMED") {
    return classifyOaHealth({
      endpoint: "MANAGER",
      profileState: "PRESENT",
      managerAuth,
      loginRedirect: result.authDestinationDetected,
      httpStatus: result.apiAuthProbe.status ?? result.mainDocumentStatus,
      ...(managerAuth === "UNKNOWN"
        && !result.navigationSucceeded
        && result.apiAuthProbe.transport === "FAILED"
        ? { failure: "UNEXPECTED" as const }
        : {}),
    });
  }

  if (result.navigationSucceeded && result.finalOriginIsChatLine && !result.finalPathMatchesWorkspace) {
    return classifyOaHealth({
      endpoint: "OA",
      profileState: "PRESENT",
      managerAuth,
      oaAccess: "DENIED",
      httpStatus: result.mainDocumentStatus,
    });
  }

  const status = chatListHttpStatus(result, botId);
  if (status === undefined) {
    return {
      status: "DEGRADED" as const,
      failureStage: result.chatListResponseObserved
        ? "CHAT_LIST_RESPONSE" as const
        : "CHAT_LIST_REQUEST" as const,
    };
  }

  const validShape = status === 200
    && Boolean(result.chatListIdentifierShape)
    && Boolean(result.chatListPagination);

  return classifyOaHealth({
    endpoint: "CHAT_LIST",
    profileState: "PRESENT",
    managerAuth,
    httpStatus: status,
    ...(status === 401 || status === 403 ? { chatAccess: "DENIED" as const } : {}),
    ...(status === 200 ? {
      chatAccess: "GRANTED" as const,
      responseShape: validShape ? "VALID" as const : "MALFORMED" as const,
    } : {}),
  });
}

@Injectable()
export class LineChatOaHealthProbeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LineChatSessionService) private readonly sessionService: LineChatSessionService,
    @Inject(LineChatProfileOperationCoordinator)
    private readonly profileCoordinator: LineChatProfileOperationCoordinator,
    @Inject(LineChatHealthService) private readonly healthService: LineChatHealthService,
  ) {}

  /**
   * Runs one bounded, read-only OA health observation from the dedicated
   * profile-owning worker runtime. It validates Manager auth, OA workspace
   * access, and the natural chat-list response without opening a customer chat.
   */
  public async probeOa(
    lineOfficialAccountId: string,
    source: LineChatHealthEventSource = "MANUAL",
  ): Promise<LineChatOaHealthProbeResult> {
    const startedAt = Date.now();
    const oa = await this.prisma.lineOfficialAccount.findUnique({
      where: { id: lineOfficialAccountId },
      select: {
        id: true,
        chatBotId: true,
        lineChatSessionId: true,
        lineChatSession: {
          select: {
            id: true,
            sessionKey: true,
            profileStorageKey: true,
            profilePath: true,
          },
        },
      },
    });
    if (!oa) throw new NotFoundException(`Line official account "${lineOfficialAccountId}" not found.`);

    const botId = oa.chatBotId?.trim();
    const session = oa.lineChatSession;
    if (!botId || !oa.lineChatSessionId || !session) {
      return this.recordOaFailure({
        lineOfficialAccountId: oa.id,
        status: "CONFIG_ERROR",
        failureStage: "CONFIG_ERROR",
        source,
        startedAt,
        healthSessionSnapshotAt: null,
      });
    }

    let profilePath: string;
    try {
      profilePath = this.sessionService.resolveProfilePath(session);
    } catch {
      return this.recordOaFailure({
        lineOfficialAccountId: oa.id,
        status: "CONFIG_ERROR",
        failureStage: "PROFILE_PATH_INVALID",
        source,
        startedAt,
        healthSessionSnapshotAt: null,
      });
    }

    if (!fs.existsSync(profilePath)) {
      return this.recordOaFailure({
        lineOfficialAccountId: oa.id,
        status: "CONFIG_ERROR",
        failureStage: "PROFILE_MISSING",
        source,
        startedAt,
        healthSessionSnapshotAt: null,
      });
    }

    const coordinated = await this.profileCoordinator.withProfileOperation(
      { sessionId: session.id, operationKind: "HEALTH_OA" },
      async () => {
        try {
          const diagnostics = await this.sessionService.runDiagnostics({
            profilePath,
            botId,
            surface: "chat-list",
            headless: true,
          });
          const checkedAt = new Date();
          const durationMs = boundedDurationMs(startedAt);
          const sessionClassification = sessionClassificationFromDiagnostics(diagnostics);
          const sessionRecorded = await this.healthService.recordSessionHealthResult({
            sessionId: session.id,
            status: sessionClassification.status,
            failureStage: sessionClassification.failureStage,
            checkedAt,
            httpStatus: diagnostics.apiAuthProbe.status ?? diagnostics.mainDocumentStatus ?? null,
            durationMs,
            source,
          });

          const oaClassification = oaClassificationFromDiagnostics(diagnostics, botId);
          const oaRecorded = await this.healthService.recordOaHealthResult({
            lineOfficialAccountId: oa.id,
            status: oaClassification.status,
            failureStage: oaClassification.failureStage,
            checkedAt,
            httpStatus: chatListHttpStatus(diagnostics, botId) ?? diagnostics.mainDocumentStatus ?? null,
            durationMs,
            source,
            healthSessionSnapshotAt: checkedAt,
          });

          return {
            outcome: "RECORDED" as const,
            lineOfficialAccountId: oa.id,
            status: oaRecorded.status,
            failureStage: oaRecorded.failureStage,
            transitionEventCreated: oaRecorded.transitionEventCreated,
            sessionStatus: sessionRecorded.status,
            sessionTransitionEventCreated: sessionRecorded.transitionEventCreated,
            durationMs,
          };
        } catch (error: unknown) {
          const failureStage = classifySessionProbeExecutionFailure(error);
          return this.recordOaFailure({
            lineOfficialAccountId: oa.id,
            status: "DEGRADED",
            failureStage,
            source,
            startedAt,
            healthSessionSnapshotAt: null,
          });
        }
      },
    );

    if (!coordinated.acquired) {
      return {
        outcome: "SKIPPED_BUSY",
        lineOfficialAccountId: oa.id,
        retryAfterMs: coordinated.retryAfterMs,
      };
    }
    return coordinated.value;
  }

  private async recordOaFailure(input: {
    lineOfficialAccountId: string;
    status: "DEGRADED" | "CONFIG_ERROR";
    failureStage: LineChatHealthFailureStage;
    source: LineChatHealthEventSource;
    startedAt: number;
    healthSessionSnapshotAt: Date | null;
  }): Promise<Extract<LineChatOaHealthProbeResult, { outcome: "RECORDED" }>> {
    const durationMs = boundedDurationMs(input.startedAt);
    const recorded = await this.healthService.recordOaHealthResult({
      lineOfficialAccountId: input.lineOfficialAccountId,
      status: input.status,
      failureStage: input.failureStage,
      checkedAt: new Date(),
      durationMs,
      source: input.source,
      healthSessionSnapshotAt: input.healthSessionSnapshotAt,
    });
    return {
      outcome: "RECORDED",
      lineOfficialAccountId: input.lineOfficialAccountId,
      status: recorded.status,
      failureStage: recorded.failureStage,
      transitionEventCreated: recorded.transitionEventCreated,
      sessionStatus: "UNKNOWN",
      sessionTransitionEventCreated: false,
      durationMs,
    };
  }
}

export { chatListHttpStatus, managerAuthFromDiagnostics, oaClassificationFromDiagnostics };
