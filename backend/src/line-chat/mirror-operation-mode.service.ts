import { ConflictException, Inject, Injectable, Logger } from "@nestjs/common";
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
    freezeAt: string | null;
    backfillTargetStartAt: string | null;
    catchUpOverlapSeconds: number;
    catchUpStartAt: string | null;
    enteredAt: string;
    completedAt: string | null;
    backfill: MirrorBackfillCompletion;
    catchUp: MirrorCatchUpCompletion;
    reconciliationPolicy: typeof MIRROR_BACKFILL_RECONCILIATION_POLICY;
  }> {
    const state = await this.getState();
    const evaluatedAt = new Date();
    const [backfill, catchUp] = await Promise.all([
      this.evaluateBackfill(state),
      Promise.resolve(catchUpCompletion(state, evaluatedAt)),
    ]);
    return {
      mode: state.mode,
      freezeAt: state.freezeAt?.toISOString() ?? null,
      backfillTargetStartAt: state.backfillTargetStartAt?.toISOString() ?? null,
      catchUpOverlapSeconds: state.catchUpOverlapSeconds,
      catchUpStartAt: state.catchUpStartAt?.toISOString() ?? null,
      enteredAt: state.enteredAt.toISOString(),
      completedAt: state.completedAt?.toISOString() ?? null,
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
      const freezeAt = new Date();
      this.logger.log(JSON.stringify({
        event: "mirror_operation_mode_transition_started",
        previousMode: current.mode,
        mode: "BACKFILL",
        freezeAt: freezeAt.toISOString(),
        targetStartAt: MIRROR_BACKFILL_TARGET_START_AT.toISOString(),
      }));
      const changed = await this.prisma.mirrorOperationState.updateMany({
        where: { id: MIRROR_OPERATION_STATE_ID, mode: "NORMAL" },
        data: {
          mode: "BACKFILL",
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
        freezeAt: freezeAt.toISOString(),
      }));
      return this.getStatus();
    }

    if (targetMode === "CATCH_UP") {
      if (current.mode !== "BACKFILL" || !current.freezeAt) {
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

  private async evaluateBackfill(state: MirrorOperationState): Promise<MirrorBackfillCompletion> {
    if (!state.freezeAt || !state.backfillTargetStartAt) {
      return emptyBackfillCompletion(state.mode !== "NORMAL");
    }
    const storeStates = await this.prisma.lineChatMirrorStoreState.findMany({
      where: { storeCode: { in: [...LINE_CHAT_HISTORICAL_PILOT_STORE_CODES] } },
      select: { storeCode: true, lineOfficialAccountId: true },
    });
    const statesByStore = new Map<string, typeof storeStates>();
    for (const item of storeStates) {
      const current = statesByStore.get(item.storeCode) ?? [];
      current.push(item);
      statesByStore.set(item.storeCode, current);
    }
    const storeCodeByAccountId = new Map(
      storeStates.map((item) => [item.lineOfficialAccountId, item.storeCode] as const),
    );
    const accountIds = [...new Set(storeStates.map((item) => item.lineOfficialAccountId))];
    const groups = accountIds.length === 0
      ? []
      : await this.prisma.lineChatMirrorChat.groupBy({
          by: ["lineOfficialAccountId", "historicalBackfillStatus"],
          where: {
            lineOfficialAccountId: { in: accountIds },
            lastMessageAt: {
              gte: state.backfillTargetStartAt,
              lte: state.freezeAt,
            },
          },
          _count: { _all: true },
        });

    let conversationsObserved = 0;
    let conversationsComplete = 0;
    let conversationsBlocked = 0;
    let conversationsPending = 0;
    let conversationsFailed = 0;
    let conversationsFailedRetryable = 0;
    const knownByStore = new Map<string, CoverageCounts>();
    for (const row of groups) {
      const count = row._count._all;
      conversationsObserved += count;
      const storeCode = storeCodeByAccountId.get(row.lineOfficialAccountId);
      if (!storeCode) continue;
      const storeCounts = knownByStore.get(storeCode) ?? {
        conversationsObserved: 0,
        conversationsComplete: 0,
        conversationsBlocked: 0,
        conversationsPending: 0,
        conversationsFailed: 0,
        conversationsFailedRetryable: 0,
        conversationsFailedPermanent: 0,
      };
      storeCounts.conversationsObserved += count;
      if (row.historicalBackfillStatus === HistoricalBackfillStatus.FAST_PATH_COMPLETE) {
        conversationsComplete += count;
        storeCounts.conversationsComplete += count;
      } else if (
        row.historicalBackfillStatus === HistoricalBackfillStatus.NEEDS_BACKWARD_PAGINATION
        || row.historicalBackfillStatus === HistoricalBackfillStatus.HISTORICAL_COVERAGE_UNPROVEN
      ) {
        conversationsBlocked += count;
        storeCounts.conversationsBlocked += count;
      } else if (row.historicalBackfillStatus === HistoricalBackfillStatus.FAILED) {
        conversationsFailed += count;
        conversationsFailedRetryable += count;
        storeCounts.conversationsFailed += count;
        storeCounts.conversationsFailedRetryable += count;
      } else {
        conversationsPending += count;
        storeCounts.conversationsPending += count;
      }
      knownByStore.set(storeCode, storeCounts);
    }

    let storesComplete = 0;
    let storesBlocked = 0;
    let storesPending = 0;
    let storesFailed = 0;
    for (const storeCode of LINE_CHAT_HISTORICAL_PILOT_STORE_CODES) {
      const configuredStates = statesByStore.get(storeCode) ?? [];
      const counts = knownByStore.get(storeCode);
      if (configuredStates.length !== 1 || !counts || counts.conversationsObserved === 0) {
        storesPending += 1;
      } else if (counts.conversationsBlocked > 0) {
        storesBlocked += 1;
      } else if (counts.conversationsFailed > 0) {
        storesFailed += 1;
      } else if (counts.conversationsPending > 0) {
        storesPending += 1;
      } else {
        storesComplete += 1;
      }
    }
    const technicallyComplete = conversationsObserved > 0
      && storesComplete === LINE_CHAT_HISTORICAL_PILOT_STORE_CODES.length
      && conversationsComplete === conversationsObserved
      && conversationsBlocked === 0
      && conversationsPending === 0
      && conversationsFailed === 0
      && state.backfillCoverageStatus === "PROVEN";
    const status = technicallyComplete
      ? "COMPLETE"
      : conversationsBlocked > 0
        ? "BLOCKED"
        : conversationsFailed > 0
          ? "FAILED"
          : conversationsPending > 0
            ? "PENDING"
            : "UNPROVEN";

    return {
      status,
      technicallyComplete,
      cohortInventoryStatus: state.backfillCoverageStatus,
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
          : "SEPTEMBER_COHORT_INVENTORY_NOT_PERSISTED",
    };
  }
}
