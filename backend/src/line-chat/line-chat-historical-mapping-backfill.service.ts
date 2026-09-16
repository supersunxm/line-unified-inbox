import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { LineChatNicknameSyncJobStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import {
  buildPilotMappingPlan,
  loadPilotMappingContext,
  PILOT_MAPPING_SESSION_KEY,
  PILOT_MAPPING_STORE_CODE,
} from "./line-chat-chat-mapping";
import { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";
import { LineChatSessionService } from "./line-chat-session.service";

const START_DELAY_MS = 10_000;
const SCAN_INTERVAL_MS = 2 * 60_000;
const DEFAULT_MAX_NEW_MAPPINGS_PER_RUN = 50;
const MAPPING_DEFERRAL_REASONS = [
  "RESOLVE_NO_MATCH",
  "RESOLVE_AMBIGUOUS",
  "RESOLVE_CONFLICT",
];

/**
 * Repairs the durable LINE Chat identity mapping needed by old Profile B
 * nickname jobs. The realtime resolver deliberately looks at only the recent
 * chat window; this service performs a full historical enumeration only when
 * mapping-blocked nickname jobs exist.
 *
 * Safety rules:
 * - Store 28375 / Profile B only.
 * - Full chat enumeration must be COMPLETE.
 * - Only buildPilotMappingPlan() rows classified EXACT_CONFIDENT are written.
 * - Existing Conversation.lineChatUserId values are never overwritten.
 * - Ambiguous, possible, no-match, and conflicting rows remain untouched.
 * - Browser access is serialized through the shared profile coordinator.
 */
@Injectable()
export class LineChatHistoricalMappingBackfillService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LineChatHistoricalMappingBackfillService.name);
  private startTimer: NodeJS.Timeout | null = null;
  private intervalTimer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LineChatSessionService) private readonly sessionService: LineChatSessionService,
    @Inject(LineChatProfileOperationCoordinator) private readonly profileCoordinator: LineChatProfileOperationCoordinator,
  ) {}

  onModuleInit(): void {
    if (
      process.env.NODE_ENV === "test"
      || process.env.DISABLE_NICKNAME_WORKER === "true"
      || process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE === "true"
      || process.env.DISABLE_LINE_CHAT_HISTORICAL_MAPPING_BACKFILL === "true"
    ) {
      return;
    }

    this.startTimer = setTimeout(() => void this.processCycle(), START_DELAY_MS);
    this.startTimer.unref?.();
    this.intervalTimer = setInterval(() => void this.processCycle(), SCAN_INTERVAL_MS);
    this.intervalTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.startTimer) clearTimeout(this.startTimer);
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    this.startTimer = null;
    this.intervalTimer = null;
  }

  public async processCycle(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const context = await loadPilotMappingContext(this.prisma, PILOT_MAPPING_STORE_CODE);
      const blockedJobs = await this.prisma.lineChatNicknameSyncJob.findMany({
        where: {
          lineOfficialAccountId: context.lineOfficialAccount.id,
          status: LineChatNicknameSyncJobStatus.PENDING,
          lastError: { in: MAPPING_DEFERRAL_REASONS },
        },
        select: {
          id: true,
          conversationId: true,
          lineChatUserId: true,
        },
      });
      if (blockedJobs.length === 0) return;

      const now = new Date();
      const existingMappings = new Map(
        context.conversations
          .filter((conversation) => Boolean(conversation.lineChatUserId?.trim()))
          .map((conversation) => [conversation.id, conversation.lineChatUserId!.trim()]),
      );

      let requeuedExisting = 0;
      for (const job of blockedJobs) {
        const mappedUserId = existingMappings.get(job.conversationId);
        if (!mappedUserId) continue;
        const updated = await this.prisma.lineChatNicknameSyncJob.updateMany({
          where: {
            id: job.id,
            status: LineChatNicknameSyncJobStatus.PENDING,
          },
          data: {
            lineChatUserId: mappedUserId,
            scheduledAt: now,
            lastError: null,
          },
        });
        requeuedExisting += updated.count;
      }

      const remainingConversationIds = new Set(
        blockedJobs
          .filter((job) => !existingMappings.has(job.conversationId))
          .map((job) => job.conversationId),
      );
      if (remainingConversationIds.size === 0) {
        this.logger.log(JSON.stringify({
          event: "line_chat_historical_mapping_backfill_requeued_existing",
          storeCode: PILOT_MAPPING_STORE_CODE,
          sessionKey: PILOT_MAPPING_SESSION_KEY,
          blockedJobs: blockedJobs.length,
          requeuedExisting,
        }));
        return;
      }

      const session = await this.prisma.lineChatSession.findFirst({
        where: { sessionKey: PILOT_MAPPING_SESSION_KEY },
        select: { id: true, sessionKey: true, profilePath: true, profileStorageKey: true },
      });
      if (!session) {
        this.logger.warn(JSON.stringify({
          event: "line_chat_historical_mapping_backfill_skipped",
          reason: "SESSION_NOT_FOUND",
          sessionKey: PILOT_MAPPING_SESSION_KEY,
        }));
        return;
      }

      const profilePath = this.sessionService.resolveProfilePath(session);
      const discoveryResult = await this.profileCoordinator.withProfileOperation(
        { sessionId: session.id, operationKind: "NICKNAME_UPDATE" },
        async () => this.sessionService.discoverChats({
          botId: context.lineOfficialAccount.chatBotId,
          profilePath,
          headless: true,
        }),
        { waitForLock: false },
      );
      if (!discoveryResult.acquired) {
        this.logger.log(JSON.stringify({
          event: "line_chat_historical_mapping_backfill_deferred",
          reason: discoveryResult.reason,
          retryAfterMs: discoveryResult.retryAfterMs,
          sessionKey: PILOT_MAPPING_SESSION_KEY,
          remainingBlocked: remainingConversationIds.size,
        }));
        return;
      }

      const discovery = discoveryResult.value;
      const plan = buildPilotMappingPlan(context, discovery);
      if (plan.enumerationStatus !== "COMPLETE") {
        this.logger.warn(JSON.stringify({
          event: "line_chat_historical_mapping_backfill_skipped",
          reason: "ENUMERATION_NOT_COMPLETE",
          enumerationStatus: plan.enumerationStatus,
          enumerationError: plan.enumerationError ?? null,
          pagesFetched: plan.pagesFetched ?? null,
          remainingBlocked: remainingConversationIds.size,
        }));
        return;
      }

      const configuredLimit = Number(process.env.LINE_CHAT_HISTORICAL_MAPPING_MAX_NEW_PER_RUN || DEFAULT_MAX_NEW_MAPPINGS_PER_RUN);
      const maxNewMappings = Number.isFinite(configuredLimit)
        ? Math.max(1, Math.min(100, Math.trunc(configuredLimit)))
        : DEFAULT_MAX_NEW_MAPPINGS_PER_RUN;
      const exactRows = plan.rows
        .filter((row) =>
          remainingConversationIds.has(row.conversationId)
          && row.confidence === "EXACT_CONFIDENT"
          && Boolean(row.candidateChatUserId),
        )
        .slice(0, maxNewMappings);

      let mapped = 0;
      let requeued = 0;
      for (const row of exactRows) {
        const candidateChatUserId = row.candidateChatUserId;
        if (!candidateChatUserId) continue;
        await this.prisma.$transaction(async (tx) => {
          const conversationUpdate = await tx.conversation.updateMany({
            where: {
              id: row.conversationId,
              storeId: plan.store.id,
              lineOfficialAccountId: plan.lineOfficialAccount.id,
              lineChatUserId: null,
            },
            data: { lineChatUserId: candidateChatUserId },
          });
          if (conversationUpdate.count !== 1) return;
          mapped += 1;
          const jobUpdate = await tx.lineChatNicknameSyncJob.updateMany({
            where: {
              conversationId: row.conversationId,
              lineOfficialAccountId: plan.lineOfficialAccount.id,
              status: LineChatNicknameSyncJobStatus.PENDING,
              lastError: { in: MAPPING_DEFERRAL_REASONS },
            },
            data: {
              lineChatUserId: candidateChatUserId,
              scheduledAt: now,
              lastError: null,
            },
          });
          requeued += jobUpdate.count;
        });
      }

      this.logger.log(JSON.stringify({
        event: "line_chat_historical_mapping_backfill_result",
        storeCode: PILOT_MAPPING_STORE_CODE,
        sessionKey: PILOT_MAPPING_SESSION_KEY,
        blockedJobs: blockedJobs.length,
        requeuedExisting,
        remainingBlockedBeforeDiscovery: remainingConversationIds.size,
        enumerationStatus: plan.enumerationStatus,
        pagesFetched: plan.pagesFetched ?? null,
        chatCandidatesDiscovered: plan.summary.chatCandidatesDiscovered,
        exactConfidentTotal: plan.summary.exactConfident,
        conflictsDetected: plan.summary.conflictsDetected,
        eligibleBlockedExact: exactRows.length,
        mapped,
        requeued,
        ambiguous: plan.summary.ambiguous,
        possible: plan.summary.possible,
        noMatch: plan.summary.noMatch,
      }));
    } catch (error: unknown) {
      this.logger.warn(JSON.stringify({
        event: "line_chat_historical_mapping_backfill_failed",
        error: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      this.running = false;
    }
  }
}
