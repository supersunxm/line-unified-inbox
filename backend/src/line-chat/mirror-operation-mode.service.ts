import { ConflictException, Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { MirrorOperationState } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import {
  LINE_CHAT_HISTORICAL_LOWER_BOUND_ISO,
  LINE_CHAT_HISTORICAL_PILOT_STORE_CODES,
  HistoricalBackfillStatus,
} from "./line-chat-historical-backfill";

export const MIRROR_OPERATION_STATE_ID = "big-project-a";
export const DEFAULT_CATCH_UP_OVERLAP_SECONDS = 300;
export const MIRROR_BACKFILL_TARGET_START_AT = new Date(LINE_CHAT_HISTORICAL_LOWER_BOUND_ISO);
export const MIRROR_BACKFILL_RECONCILIATION_POLICY = "CONTINUE_DATABASE_ONLY" as const;
const MAX_CATCH_UP_OVERLAP_SECONDS = 3_600;

export type MirrorOperationModeValue = "NORMAL" | "BACKFILL" | "CATCH_UP";

type CoverageCounts = {
  conversationsObserved: number;
  conversationsComplete: number;
  conversationsBlocked: number;
  conversationsPending: number;
  conversationsFailed: number;
  conversationsFailedRetryable: number;
  conversationsFailedPermanent: number;
};

export interface MirrorBackfillCompletion extends CoverageCounts {
  status: "COMPLETE" | "BLOCKED" | "FAILED" | "PENDING" | "UNPROVEN";
  technicallyComplete: boolean;
  cohortInventoryStatus: "UNPROVEN" | "PROVEN";
  storesTotal: number;
  storesComplete: number;
  storesBlocked: number;
  storesPending: number;
  storesFailed: number;
  reason: string | null;
}

export interface MirrorCatchUpCompletion {
  status: "PROVEN" | "UNPROVEN";
  catchUpStartAt: string | null;
  evaluatedAt: string;
  observedThroughAt: string | null;
  storesTotal: number;
  storesComplete: number;
  storesPending: number;
  storesFailed: number;
  earliestUncoveredAt: string | null;
  reason: string | null;
}

function emptyBackfillCompletion(started = false): MirrorBackfillCompletion {
  return {
    status: "UNPROVEN",
    technicallyComplete: false,
    cohortInventoryStatus: "UNPROVEN",
    storesTotal: started ? LINE_CHAT_HISTORICAL_PILOT_STORE_CODES.length : 0,
    storesComplete: 0,
    storesBlocked: 0,
    storesPending: started ? LINE_CHAT_HISTORICAL_PILOT_STORE_CODES.length : 0,
    storesFailed: 0,
    conversationsObserved: 0,
    conversationsComplete: 0,
    conversationsBlocked: 0,
    conversationsPending: 0,
    conversationsFailed: 0,
    conversationsFailedRetryable: 0,
    conversationsFailedPermanent: 0,
    reason: started ? "SEPTEMBER_COHORT_INVENTORY_NOT_PERSISTED" : null,
  };
}

function configuredMirrorStoreCount(): number {
  const raw = process.env.LINE_CHAT_MIRROR_STORE_CODES?.trim();
  if (!raw) return 0;
  return new Set(raw.split(/[\s,;]+/u).map((value) => value.trim()).filter(Boolean)).size;
}

export function configuredMirrorCatchUpOverlapSeconds(): number {
  const parsed = Number(process.env.LINE_CHAT_MIRROR_CATCH_UP_OVERLAP_SECONDS
    ?? DEFAULT_CATCH_UP_OVERLAP_SECONDS);
  if (!Number.isFinite(parsed)) return DEFAULT_CATCH_UP_OVERLAP_SECONDS;
  return Math.min(MAX_CATCH_UP_OVERLAP_SECONDS, Math.max(0, Math.floor(parsed)));
}

function catchUpCompletion(
  state: MirrorOperationState,
  evaluatedAt: Date,
): MirrorCatchUpCompletion {
  const proven = state.catchUpCoverageStatus === "PROVEN"
    && state.catchUpObservedThroughAt !== null
    && state.catchUpStoresTotal > 0
    && state.catchUpStoresComplete === state.catchUpStoresTotal
    && state.catchUpStoresPending === 0
    && state.catchUpStoresFailed === 0
    && state.catchUpEarliestUncoveredAt === null;
  return {
    status: proven ? "PROVEN" : "UNPROVEN",
    catchUpStartAt: state.catchUpStartAt?.toISOString() ?? null,
    evaluatedAt: evaluatedAt.toISOString(),
    observedThroughAt: proven ? state.catchUpObservedThroughAt?.toISOString() ?? null : null,
    storesTotal: state.catchUpStoresTotal,
    storesComplete: state.catchUpStoresComplete,
    storesPending: state.catchUpStoresPending,
    storesFailed: state.catchUpStoresFailed,
    earliestUncoveredAt: state.catchUpEarliestUncoveredAt?.toISOString()
      ?? (proven ? null : state.catchUpStartAt?.toISOString() ?? null),
    reason: proven ? null : "LIVE_MIRROR_CYCLE_DOES_NOT_PROVE_FULL_GAP",
  };
}

/**
 * Persists the operator-controlled NORMAL/BACKFILL/CATCH_UP lifecycle.
 * Completion is deliberately fail-closed: current inventory/history APIs do
 * not persist exhaustive cohort proof or full-gap catch-up evidence.
 */
@Injectable()
export class MirrorOperationModeService {
  private readonly logger = new Logger(MirrorOperationModeService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getState(): Promise<MirrorOperationState> {
    return this.prisma.mirrorOperationState.upsert({
      where: { id: MIRROR_OPERATION_STATE_ID },
      update: {},
      create: {
        id: MIRROR_OPERATION_STATE_ID,
        mode: "NORMAL",
        catchUpOverlapSeconds: configuredMirrorCatchUpOverlapSeconds(),
      },
    });
  }

  async getStatus(): Promise<{
    mode: MirrorOperationModeValue;
    runId: string | null;
    freezeAt: string | null;
    backfillTargetStartAt: string | null;
    catchUpOverlapSeconds: number;
    catchUpStartAt: string | null;
    enteredAt: string;
    completedAt: string | null;
    recoveryRequired: boolean;
    emergencyResumedAt: string | null;
    backfill: MirrorBackfillCompletion;
    catchUp: MirrorCatchUpCompletion;
    reconciliationPolicy: typeof MIRROR_BACKFILL_RECONCILIATION_POLICY;
  }> {
    const state = await this.getState();
    if (
      state.mode === "BACKFILL"
      && state.runId
      && state.freezeAt
      && state.backfillTargetStartAt
    ) {
      await this.ensureBackfillCohortSeeded({
        runId: state.runId,
        freezeAt: state.freezeAt,
        targetStartAt: state.backfillTargetStartAt,
      });
    }
    const evaluatedAt = new Date();
    const [backfill, catchUp] = await Promise.all([
      this.evaluateBackfill(state),
      Promise.resolve(catchUpCompletion(state, evaluatedAt)),
    ]);
    return {
      mode: state.mode,
      runId: state.runId ?? null,
      freezeAt: state.freezeAt?.toISOString() ?? null,
      backfillTargetStartAt: state.backfillTargetStartAt?.toISOString() ?? null,
      catchUpOverlapSeconds: state.catchUpOverlapSeconds,
      catchUpStartAt: state.catchUpStartAt?.toISOString() ?? null,
      enteredAt: state.enteredAt.toISOString(),
      completedAt: state.completedAt?.toISOString() ?? null,
      recoveryRequired: state.recoveryRequired,
      emergencyResumedAt: state.emergencyResumedAt?.toISOString() ?? null,
      backfill,
      catchUp,
      reconciliationPolicy: MIRROR_BACKFILL_RECONCILIATION_POLICY,
    };
  }

  async transition(
    targetMode: MirrorOperationModeValue,
  ): Promise<Awaited<ReturnType<MirrorOperationModeService["getStatus"]>>> {
    const current = await this.getState();
    if (current.mode === targetMode) {
      return this.getStatus();
    }

    if (targetMode === "BACKFILL") {
      if (current.mode !== "NORMAL") {
        throw new ConflictException(`INVALID_MIRROR_MODE_TRANSITION:${current.mode}:BACKFILL`);
      }
      if (current.recoveryRequired) {
        throw new ConflictException("MIRROR_RECOVERY_REQUIRED");
      }
      const freezeAt = new Date();
      const runId = randomUUID();
      this.logger.log(JSON.stringify({
        event: "mirror_operation_mode_transition_started",
        previousMode: current.mode,
        mode: "BACKFILL",
        runId,
        freezeAt: freezeAt.toISOString(),
        targetStartAt: MIRROR_BACKFILL_TARGET_START_AT.toISOString(),
      }));
      const changed = await this.prisma.mirrorOperationState.updateMany({
        where: { id: MIRROR_OPERATION_STATE_ID, mode: "NORMAL" },
        data: {
          mode: "BACKFILL",
          runId,
          freezeAt,
          backfillTargetStartAt: MIRROR_BACKFILL_TARGET_START_AT,
          catchUpStartAt: null,
          backfillCoverageStatus: "UNPROVEN",
          catchUpCoverageStatus: "UNPROVEN",
          catchUpObservedThroughAt: null,
          catchUpStoresTotal: 0,
          catchUpStoresComplete: 0,
          catchUpStoresPending: 0,
          catchUpStoresFailed: 0,
          catchUpEarliestUncoveredAt: null,
          recoveryRequired: false,
          emergencyResumedAt: null,
          emergencyResumeReason: null,
          enteredAt: freezeAt,
          completedAt: null,
        },
      });
      if (changed.count === 0) {
        const latest = await this.getState();
        if (latest.mode === "BACKFILL") return this.getStatus();
        throw new ConflictException("MIRROR_MODE_TRANSITION_RACE");
      }
      this.logger.log(JSON.stringify({
        event: "mirror_operation_mode_transition_completed",
        previousMode: current.mode,
        mode: "BACKFILL",
        runId,
        freezeAt: freezeAt.toISOString(),
      }));
      await this.ensureBackfillCohortSeeded({
        runId,
        freezeAt,
        targetStartAt: MIRROR_BACKFILL_TARGET_START_AT,
      }).catch((error) => {
        this.logger.warn(JSON.stringify({
          event: "mirror_backfill_cohort_seed_deferred",
          mode: "BACKFILL",
          errorType: error instanceof Error ? error.name.slice(0, 80) : "UNKNOWN_ERROR",
        }));
      });
      return this.getStatus();
    }

    if (targetMode === "CATCH_UP") {
      if (current.mode !== "BACKFILL" || !current.freezeAt || !current.runId) {
        throw new ConflictException(`INVALID_MIRROR_MODE_TRANSITION:${current.mode}:CATCH_UP`);
      }
      const progress = await this.evaluateBackfill(current);
      if (progress.status !== "COMPLETE") {
        this.logger.warn(JSON.stringify({
          event: "mirror_backfill_blocked",
          mode: current.mode,
          conversationsObserved: progress.conversationsObserved,
          conversationsComplete: progress.conversationsComplete,
          conversationsBlocked: progress.conversationsBlocked,
          conversationsPending: progress.conversationsPending,
          conversationsFailed: progress.conversationsFailed,
          reason: progress.reason,
        }));
        throw new ConflictException("MIRROR_BACKFILL_COMPLETION_NOT_PROVEN");
      }
      const catchUpStartAt = new Date(
        current.freezeAt.getTime() - current.catchUpOverlapSeconds * 1_000,
      );
      this.logger.log(JSON.stringify({
        event: "mirror_operation_mode_transition_started",
        previousMode: "BACKFILL",
        mode: "CATCH_UP",
        freezeAt: current.freezeAt.toISOString(),
        catchUpStartAt: catchUpStartAt.toISOString(),
      }));
      const changed = await this.prisma.mirrorOperationState.updateMany({
        where: {
          id: MIRROR_OPERATION_STATE_ID,
          mode: "BACKFILL",
          freezeAt: current.freezeAt,
        },
        data: {
          mode: "CATCH_UP",
          catchUpStartAt,
          catchUpCoverageStatus: "UNPROVEN",
          catchUpObservedThroughAt: null,
          catchUpStoresTotal: configuredMirrorStoreCount(),
          catchUpStoresComplete: 0,
          catchUpStoresPending: configuredMirrorStoreCount(),
          catchUpStoresFailed: 0,
          catchUpEarliestUncoveredAt: catchUpStartAt,
          enteredAt: new Date(),
          completedAt: null,
        },
      });
      if (changed.count === 0) throw new ConflictException("MIRROR_MODE_TRANSITION_RACE");
      this.logger.log(JSON.stringify({
        event: "mirror_operation_mode_transition_completed",
        previousMode: "BACKFILL",
        mode: "CATCH_UP",
        freezeAt: current.freezeAt.toISOString(),
        catchUpStartAt: catchUpStartAt.toISOString(),
      }));
      return this.getStatus();
    }

    if (current.mode !== "CATCH_UP") {
      throw new ConflictException(`INVALID_MIRROR_MODE_TRANSITION:${current.mode}:NORMAL`);
    }
    const progress = catchUpCompletion(current, new Date());
    if (current.catchUpCoverageStatus !== "PROVEN" || progress.status !== "PROVEN") {
      throw new ConflictException("MIRROR_CATCH_UP_COMPLETION_NOT_PROVEN");
    }
    this.logger.log(JSON.stringify({
      event: "mirror_catchup_complete",
      freezeAt: current.freezeAt?.toISOString() ?? null,
      catchUpStartAt: current.catchUpStartAt?.toISOString() ?? null,
      observedThroughAt: progress.observedThroughAt,
      storesTotal: progress.storesTotal,
      storesComplete: progress.storesComplete,
    }));
    const changed = await this.prisma.mirrorOperationState.updateMany({
      where: {
        id: MIRROR_OPERATION_STATE_ID,
        mode: "CATCH_UP",
        freezeAt: current.freezeAt,
        catchUpCoverageStatus: "PROVEN",
      },
      data: {
        mode: "NORMAL",
        enteredAt: new Date(),
        completedAt: new Date(),
      },
    });
    if (changed.count === 0) throw new ConflictException("MIRROR_MODE_TRANSITION_RACE");
    this.logger.log(JSON.stringify({
      event: "mirror_operation_returned_to_normal",
      previousMode: "CATCH_UP",
      freezeAt: current.freezeAt?.toISOString() ?? null,
    }));
    return this.getStatus();
  }

  async emergencyResume(input: {
    acknowledgeUnprovenGap: boolean;
    reason: string;
  }): Promise<Awaited<ReturnType<MirrorOperationModeService["getStatus"]>>> {
    if (!input.acknowledgeUnprovenGap) {
      throw new ConflictException("MIRROR_EMERGENCY_RESUME_ACK_REQUIRED");
    }
    const reason = input.reason.trim().slice(0, 500);
    if (!reason) {
      throw new ConflictException("MIRROR_EMERGENCY_RESUME_REASON_REQUIRED");
    }

    const current = await this.getState();
    if (current.mode === "NORMAL") {
      return this.getStatus();
    }

    const resumedAt = new Date();
    const changed = await this.prisma.mirrorOperationState.updateMany({
      where: {
        id: MIRROR_OPERATION_STATE_ID,
        mode: current.mode,
        freezeAt: current.freezeAt,
      },
      data: {
        mode: "NORMAL",
        recoveryRequired: true,
        emergencyResumedAt: resumedAt,
        emergencyResumeReason: reason,
        enteredAt: resumedAt,
        completedAt: null,
      },
    });
    if (changed.count === 0) throw new ConflictException("MIRROR_MODE_TRANSITION_RACE");

    this.logger.warn(JSON.stringify({
      event: "mirror_operation_emergency_resume",
      previousMode: current.mode,
      freezeAt: current.freezeAt?.toISOString() ?? null,
      recoveryRequired: true,
    }));
    return this.getStatus();
  }

  async recordBackfillInventory(input: {
    storeCode: string;
    lineOfficialAccountId: string;
    conversations: ReadonlyArray<{
      lineChatUserId: string;
      lastMessageAt: Date | null;
    }>;
    inventoryComplete: boolean;
    exactSeptemberChats: number | null;
  }): Promise<void> {
    const state = await this.getState();
    if (
      state.mode !== "BACKFILL"
      || !state.runId
      || !state.freezeAt
      || !state.backfillTargetStartAt
      || !LINE_CHAT_HISTORICAL_PILOT_STORE_CODES.includes(
        input.storeCode as (typeof LINE_CHAT_HISTORICAL_PILOT_STORE_CODES)[number],
      )
    ) {
      return;
    }

    const rows = input.conversations.map((conversation) => ({
      runId: state.runId!,
      storeCode: input.storeCode,
      lineOfficialAccountId: input.lineOfficialAccountId,
      lineChatUserId: conversation.lineChatUserId,
      observedLastMessageAt: conversation.lastMessageAt,
    }));

    await this.prisma.mirrorBackfillStoreCohort.upsert({
      where: {
        runId_storeCode: {
          runId: state.runId,
          storeCode: input.storeCode,
        },
      },
      update: {
        lineOfficialAccountId: input.lineOfficialAccountId,
      },
      create: {
        runId: state.runId,
        storeCode: input.storeCode,
        lineOfficialAccountId: input.lineOfficialAccountId,
      },
    });

    if (input.inventoryComplete) {
      await this.prisma.mirrorBackfillConversation.deleteMany({
        where: {
          runId: state.runId,
          storeCode: input.storeCode,
        },
      });
    }
    if (rows.length > 0) {
      await this.prisma.mirrorBackfillConversation.createMany({
        data: rows,
        skipDuplicates: true,
      });
    }

    const observedConversations = await this.prisma.mirrorBackfillConversation.count({
      where: {
        runId: state.runId,
        storeCode: input.storeCode,
      },
    });
    const exactSeptemberChats = input.inventoryComplete
      ? input.exactSeptemberChats
      : null;
    const proofValid = input.inventoryComplete
      && exactSeptemberChats !== null
      && exactSeptemberChats === observedConversations;

    await this.prisma.mirrorBackfillStoreCohort.update({
      where: {
        runId_storeCode: {
          runId: state.runId,
          storeCode: input.storeCode,
        },
      },
      data: {
        inventoryStatus: proofValid ? "PROVEN" : "UNPROVEN",
        observedConversations,
        exactSeptemberChats: proofValid ? exactSeptemberChats : null,
        inventoryCompletedAt: proofValid ? new Date() : null,
      },
    });
    await this.prisma.mirrorOperationState.updateMany({
      where: {
        id: MIRROR_OPERATION_STATE_ID,
        mode: "BACKFILL",
        runId: state.runId,
      },
      data: { backfillCoverageStatus: "UNPROVEN" },
    });
  }

  private async ensureBackfillCohortSeeded(input: {
    runId: string;
    freezeAt: Date;
    targetStartAt: Date;
  }): Promise<void> {
    const storeStates = await this.prisma.lineChatMirrorStoreState.findMany({
      where: { storeCode: { in: [...LINE_CHAT_HISTORICAL_PILOT_STORE_CODES] } },
      select: { storeCode: true, lineOfficialAccountId: true },
    });

    for (const storeCode of LINE_CHAT_HISTORICAL_PILOT_STORE_CODES) {
      const matches = storeStates.filter((state) => state.storeCode === storeCode);
      if (matches.length !== 1) continue;
      const storeState = matches[0];
      await this.prisma.mirrorBackfillStoreCohort.upsert({
        where: {
          runId_storeCode: {
            runId: input.runId,
            storeCode,
          },
        },
        update: {},
        create: {
          runId: input.runId,
          storeCode,
          lineOfficialAccountId: storeState.lineOfficialAccountId,
          inventoryStatus: "UNPROVEN",
        },
      });

      const knownChats = await this.prisma.lineChatMirrorChat.findMany({
        where: {
          lineOfficialAccountId: storeState.lineOfficialAccountId,
          lastMessageAt: {
            gte: input.targetStartAt,
            lte: input.freezeAt,
          },
        },
        select: {
          lineChatUserId: true,
          lastMessageAt: true,
        },
      });
      if (knownChats.length > 0) {
        await this.prisma.mirrorBackfillConversation.createMany({
          data: knownChats.map((chat) => ({
            runId: input.runId,
            storeCode,
            lineOfficialAccountId: storeState.lineOfficialAccountId,
            lineChatUserId: chat.lineChatUserId,
            observedLastMessageAt: chat.lastMessageAt,
          })),
          skipDuplicates: true,
        });
      }
      const observedConversations = await this.prisma.mirrorBackfillConversation.count({
        where: { runId: input.runId, storeCode },
      });
      await this.prisma.mirrorBackfillStoreCohort.update({
        where: {
          runId_storeCode: {
            runId: input.runId,
            storeCode,
          },
        },
        data: { observedConversations },
      });
    }
  }

  private async evaluateBackfill(state: MirrorOperationState): Promise<MirrorBackfillCompletion> {
    if (!state.runId || !state.freezeAt || !state.backfillTargetStartAt) {
      return emptyBackfillCompletion(state.mode !== "NORMAL");
    }

    await this.ensureBackfillCohortSeeded({
      runId: state.runId,
      freezeAt: state.freezeAt,
      targetStartAt: state.backfillTargetStartAt,
    });

    const storeCohorts = await this.prisma.mirrorBackfillStoreCohort.findMany({
      where: {
        runId: state.runId,
        storeCode: { in: [...LINE_CHAT_HISTORICAL_PILOT_STORE_CODES] },
      },
      select: {
        storeCode: true,
        lineOfficialAccountId: true,
        inventoryStatus: true,
        observedConversations: true,
        exactSeptemberChats: true,
      },
    });

    let conversationsObserved = 0;
    let conversationsComplete = 0;
    let conversationsBlocked = 0;
    let conversationsPending = 0;
    let conversationsFailed = 0;
    let conversationsFailedRetryable = 0;
    let storesComplete = 0;
    let storesBlocked = 0;
    let storesPending = 0;
    let storesFailed = 0;
    let inventoryProvenForAllStores = true;

    for (const storeCode of LINE_CHAT_HISTORICAL_PILOT_STORE_CODES) {
      const store = storeCohorts.find((item) => item.storeCode === storeCode);
      if (
        !store
        || store.inventoryStatus !== "PROVEN"
        || store.exactSeptemberChats === null
      ) {
        inventoryProvenForAllStores = false;
        storesPending += 1;
        continue;
      }

      const cohortRows = await this.prisma.mirrorBackfillConversation.findMany({
        where: { runId: state.runId, storeCode },
        select: { lineOfficialAccountId: true, lineChatUserId: true },
      });
      conversationsObserved += cohortRows.length;
      if (cohortRows.length !== store.exactSeptemberChats) {
        inventoryProvenForAllStores = false;
        storesPending += 1;
        conversationsPending += Math.max(0, store.exactSeptemberChats - cohortRows.length);
        continue;
      }

      const ids = cohortRows.map((row) => row.lineChatUserId);
      const historicalRows = ids.length === 0
        ? []
        : await this.prisma.lineChatMirrorChat.findMany({
            where: {
              lineOfficialAccountId: store.lineOfficialAccountId,
              lineChatUserId: { in: ids },
            },
            select: {
              lineChatUserId: true,
              historicalBackfillStatus: true,
            },
          });
      const statusById = new Map(
        historicalRows.map((row) => [row.lineChatUserId, row.historicalBackfillStatus] as const),
      );

      let storeComplete = 0;
      let storeBlocked = 0;
      let storePending = 0;
      let storeFailed = 0;
      for (const cohort of cohortRows) {
        const status = statusById.get(cohort.lineChatUserId) ?? null;
        if (status === HistoricalBackfillStatus.FAST_PATH_COMPLETE) {
          storeComplete += 1;
        } else if (
          status === HistoricalBackfillStatus.NEEDS_BACKWARD_PAGINATION
          || status === HistoricalBackfillStatus.HISTORICAL_COVERAGE_UNPROVEN
        ) {
          storeBlocked += 1;
        } else if (status === HistoricalBackfillStatus.FAILED) {
          storeFailed += 1;
        } else {
          storePending += 1;
        }
      }

      conversationsComplete += storeComplete;
      conversationsBlocked += storeBlocked;
      conversationsPending += storePending;
      conversationsFailed += storeFailed;
      conversationsFailedRetryable += storeFailed;

      if (storeBlocked > 0) storesBlocked += 1;
      else if (storeFailed > 0) storesFailed += 1;
      else if (storePending > 0) storesPending += 1;
      else storesComplete += 1;
    }

    const technicallyComplete = inventoryProvenForAllStores
      && storesComplete === LINE_CHAT_HISTORICAL_PILOT_STORE_CODES.length
      && storesBlocked === 0
      && storesPending === 0
      && storesFailed === 0
      && conversationsBlocked === 0
      && conversationsPending === 0
      && conversationsFailed === 0;

    if (technicallyComplete && state.backfillCoverageStatus !== "PROVEN") {
      await this.prisma.mirrorOperationState.updateMany({
        where: {
          id: MIRROR_OPERATION_STATE_ID,
          mode: "BACKFILL",
          runId: state.runId,
        },
        data: { backfillCoverageStatus: "PROVEN" },
      });
    }

    const status = technicallyComplete
      ? "COMPLETE"
      : conversationsBlocked > 0
        ? "BLOCKED"
        : conversationsFailed > 0
          ? "FAILED"
          : conversationsPending > 0 || storesPending > 0
            ? "PENDING"
            : "UNPROVEN";

    return {
      status,
      technicallyComplete,
      cohortInventoryStatus: inventoryProvenForAllStores ? "PROVEN" : "UNPROVEN",
      storesTotal: LINE_CHAT_HISTORICAL_PILOT_STORE_CODES.length,
      storesComplete,
      storesBlocked,
      storesPending,
      storesFailed,
      conversationsObserved,
      conversationsComplete,
      conversationsBlocked,
      conversationsPending,
      conversationsFailed,
      conversationsFailedRetryable,
      conversationsFailedPermanent: 0,
      reason: conversationsBlocked > 0
        ? "BACKWARD_CONTRACT_UNPROVEN"
        : conversationsFailed > 0
          ? "HISTORICAL_FAILURES_REMAIN"
          : inventoryProvenForAllStores
            ? null
            : "SEPTEMBER_COHORT_INVENTORY_NOT_PERSISTED",
    };
  }
}
