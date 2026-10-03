import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma.service";

export const PROFILE_OPERATION_LEASE_DURATION_MS = 90_000;
export const PROFILE_OPERATION_HEARTBEAT_INTERVAL_MS = 20_000;
export const PROFILE_OPERATION_RETRY_AFTER_MS = 5_000;
export const PROFILE_OPERATION_HIGH_PRIORITY_WAIT_MS = 15_000;
export const PROFILE_OPERATION_MIRROR_WAIT_MS = 90_000;

export type LineChatProfileOperationKind =
  | "NICKNAME_UPDATE"
  | "RECENT_RESOLUTION"
  | "HEALTH_SESSION"
  | "HEALTH_OA"
  | "MANUAL_DIAGNOSTIC"
  | "MIRROR_SYNC"
  | "HISTORICAL_BACKFILL"
  | "TARGET_PROOF";

export interface LineChatProfileOperationContext {
  readonly sessionId: string;
  readonly ownerToken: string;
  readonly operationKind: LineChatProfileOperationKind;
  assertOwnership(): void;
}

export interface ProfileOperationBusyResult {
  acquired: false;
  reason: "PROFILE_OPERATION_BUSY";
  retryAfterMs: number;
  sessionId: string;
  operationKind: LineChatProfileOperationKind;
  requestId: string;
  busyStage: "LOCAL_LOCK" | "DATABASE_LEASE";
  waitedMs: number;
  holderOperationKind?: LineChatProfileOperationKind;
  holderRequestId?: string;
  holderAcquiredAt?: Date;
  holderLeaseUntil?: Date;
}

export interface ProfileOperationAcquiredResult<T> {
  acquired: true;
  value: T;
  sessionId: string;
  operationKind: LineChatProfileOperationKind;
  requestId: string;
}

export type ProfileOperationResult<T> =
  | ProfileOperationBusyResult
  | ProfileOperationAcquiredResult<T>;

export class ProfileOperationLeaseLostError extends Error {
  constructor(sessionId: string) {
    super(`Profile operation lease was lost for session "${sessionId}".`);
    this.name = "ProfileOperationLeaseLostError";
  }
}

interface LocalLock {
  release: () => void;
  operationKind: LineChatProfileOperationKind;
  requestId: string;
  acquiredAt: Date;
}

interface LocalWaiter {
  id: string;
  requestId: string;
  requestedAtMs: number;
  operationKind: LineChatProfileOperationKind;
  priority: number;
  sequence: number;
  resolve: (lock: LocalLock | null) => void;
  timer: NodeJS.Timeout | null;
}

interface DatabaseLease {
  id: string;
  ownerToken: string;
  acquiredAt: Date;
  leaseUntil: Date;
}

interface ActiveDatabaseLease {
  operationKind: LineChatProfileOperationKind;
  acquiredAt: Date;
  leaseUntil: Date;
}

const OPERATION_PRIORITY: Record<LineChatProfileOperationKind, number> = {
  MANUAL_DIAGNOSTIC: 400,
  RECENT_RESOLUTION: 300,
  NICKNAME_UPDATE: 100,
  HEALTH_SESSION: 50,
  HEALTH_OA: 50,
  MIRROR_SYNC: 25,
  HISTORICAL_BACKFILL: 10,
  TARGET_PROOF: 5,
};

@Injectable()
export class LineChatProfileOperationCoordinator {
  private readonly logger = new Logger(LineChatProfileOperationCoordinator.name);
  private readonly localLocks = new Map<string, LocalLock>();
  private readonly localWaiters = new Map<string, LocalWaiter[]>();
  private waiterSequence = 0;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Runs one browser-dependent operation while holding both the process-local
   * and database-backed profile lease. Customer-facing relay work waits briefly
   * behind an already-running maintenance job and is always selected before the
   * next nickname/health job. Background operations remain non-blocking.
   */
  public async withProfileOperation<T>(input: {
    sessionId: string;
    operationKind: LineChatProfileOperationKind;
  }, callback: (context: LineChatProfileOperationContext) => Promise<T>, options: {
    waitForLock?: boolean;
    waitForLockMs?: number;
  } = {}): Promise<ProfileOperationResult<T>> {
    const requestId = randomUUID();
    const requestedAtMs = Date.now();
    const localLock = await this.acquireLocalLock(
      input.sessionId,
      input.operationKind,
      requestId,
      options.waitForLock !== false,
      options.waitForLockMs,
    );
    if (!localLock) {
      return this.busy(input, {
        requestId,
        busyStage: "LOCAL_LOCK",
        waitedMs: Date.now() - requestedAtMs,
        holder: this.localLocks.get(input.sessionId),
      });
    }

    const ownerToken = randomUUID();
    let lease: DatabaseLease | null = null;
    let heartbeatTimer: NodeJS.Timeout | null = null;
    let ownershipLost = false;

    try {
      lease = await this.acquireDatabaseLease(input.sessionId, ownerToken, input.operationKind);
      if (!lease) {
        const holder = await this.readActiveDatabaseLease(input.sessionId).catch(() => null);
        return this.busy(input, {
          requestId,
          busyStage: "DATABASE_LEASE",
          waitedMs: Date.now() - requestedAtMs,
          holder,
        });
      }

      this.logger.log(JSON.stringify({
        event: "line_chat_profile_operation_acquired",
        sessionId: input.sessionId,
        operationKind: input.operationKind,
        requestId,
        acquiredAt: lease.acquiredAt.toISOString(),
        waitedMs: Date.now() - requestedAtMs,
      }));

      const context: LineChatProfileOperationContext = {
        sessionId: input.sessionId,
        ownerToken,
        operationKind: input.operationKind,
        assertOwnership: () => {
          if (ownershipLost) throw new ProfileOperationLeaseLostError(input.sessionId);
        },
      };

      heartbeatTimer = setInterval(() => {
        void this.renewDatabaseLease(input.sessionId, ownerToken)
          .then((renewed) => {
            if (!renewed) ownershipLost = true;
          })
          .catch(() => {
            ownershipLost = true;
          });
      }, PROFILE_OPERATION_HEARTBEAT_INTERVAL_MS);
      heartbeatTimer.unref?.();

      const value = await callback(context);
      if (!(await this.renewDatabaseLease(input.sessionId, ownerToken))) {
        ownershipLost = true;
      }
      if (ownershipLost) throw new ProfileOperationLeaseLostError(input.sessionId);

      return {
        acquired: true,
        value,
        sessionId: input.sessionId,
        operationKind: input.operationKind,
        requestId,
      };
    } finally {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (lease) {
        await this.releaseDatabaseLease(input.sessionId, ownerToken).catch((error: unknown) => {
          this.logger.warn(JSON.stringify({
            event: "line_chat_profile_operation_lease_release_failed",
            sessionId: input.sessionId,
            operationKind: input.operationKind,
            error: error instanceof Error ? error.message : String(error),
          }));
        });
      }
      this.logger.log(JSON.stringify({
        event: "line_chat_profile_operation_released",
        sessionId: input.sessionId,
        operationKind: input.operationKind,
        requestId,
        acquiredAt: lease?.acquiredAt?.toISOString() ?? localLock.acquiredAt.toISOString(),
        heldMs: Date.now() - localLock.acquiredAt.getTime(),
      }));
      localLock.release();
    }
  }

  private busy(input: {
    sessionId: string;
    operationKind: LineChatProfileOperationKind;
  }, details: {
    requestId: string;
    busyStage: "LOCAL_LOCK" | "DATABASE_LEASE";
    waitedMs: number;
    holder?: LocalLock | ActiveDatabaseLease | null;
  }): ProfileOperationBusyResult {
    const holder = details.holder;
    const result: ProfileOperationBusyResult = {
      acquired: false,
      reason: "PROFILE_OPERATION_BUSY",
      retryAfterMs: PROFILE_OPERATION_RETRY_AFTER_MS,
      sessionId: input.sessionId,
      operationKind: input.operationKind,
      requestId: details.requestId,
      busyStage: details.busyStage,
      waitedMs: details.waitedMs,
    };
    if (holder) {
      result.holderOperationKind = holder.operationKind;
      result.holderAcquiredAt = holder.acquiredAt;
      if ("leaseUntil" in holder) result.holderLeaseUntil = holder.leaseUntil;
      if ("requestId" in holder) result.holderRequestId = holder.requestId;
    }
    this.logger.warn(JSON.stringify({
      event: "line_chat_profile_operation_busy",
      sessionId: input.sessionId,
      operationKind: input.operationKind,
      requestId: details.requestId,
      busyStage: details.busyStage,
      waitedMs: details.waitedMs,
      retryAfterMs: PROFILE_OPERATION_RETRY_AFTER_MS,
      holderOperationKind: result.holderOperationKind,
      holderRequestId: result.holderRequestId,
      holderAcquiredAt: result.holderAcquiredAt?.toISOString(),
      holderLeaseUntil: result.holderLeaseUntil?.toISOString(),
    }));
    return result;
  }

  private waitBudgetMs(
    operationKind: LineChatProfileOperationKind,
    overrideMs?: number,
  ): number {
    if (overrideMs !== undefined) {
      if (!Number.isFinite(overrideMs) || overrideMs <= 0) return 0;
      return Math.min(PROFILE_OPERATION_HIGH_PRIORITY_WAIT_MS, Math.floor(overrideMs));
    }
    if (operationKind === "MIRROR_SYNC") return PROFILE_OPERATION_MIRROR_WAIT_MS;
    return operationKind === "MANUAL_DIAGNOSTIC" || operationKind === "RECENT_RESOLUTION"
      ? PROFILE_OPERATION_HIGH_PRIORITY_WAIT_MS
      : 0;
  }

  private async acquireLocalLock(
    sessionId: string,
    operationKind: LineChatProfileOperationKind,
    requestId: string,
    waitForLock: boolean,
    waitForLockMs?: number,
  ): Promise<LocalLock | null> {
    const immediate = this.tryAcquireLocalLock(sessionId, operationKind, requestId);
    if (immediate) return immediate;

    const waitMs = waitForLock ? this.waitBudgetMs(operationKind, waitForLockMs) : 0;
    if (waitMs <= 0) return null;

    return new Promise<LocalLock | null>((resolve) => {
      const waiter: LocalWaiter = {
        id: randomUUID(),
        requestId,
        requestedAtMs: Date.now(),
        operationKind,
        priority: OPERATION_PRIORITY[operationKind],
        sequence: this.waiterSequence++,
        resolve,
        timer: null,
      };
      const waiters = this.localWaiters.get(sessionId) ?? [];
      waiters.push(waiter);
      this.localWaiters.set(sessionId, waiters);

      waiter.timer = setTimeout(() => {
        const current = this.localWaiters.get(sessionId);
        if (current) {
          const index = current.findIndex((candidate) => candidate.id === waiter.id);
          if (index >= 0) current.splice(index, 1);
          if (current.length === 0) this.localWaiters.delete(sessionId);
        }
        this.logger.warn(JSON.stringify({
          event: "line_chat_profile_operation_priority_wait_timeout",
          sessionId,
          operationKind,
          requestId,
          waitMs,
          waitedMs: Date.now() - waiter.requestedAtMs,
        }));
        resolve(null);
      }, waitMs);

      this.logger.log(JSON.stringify({
        event: "line_chat_profile_operation_priority_waiting",
        sessionId,
        operationKind,
        requestId,
        waitMs,
      }));
    });
  }

  private tryAcquireLocalLock(
    sessionId: string,
    operationKind: LineChatProfileOperationKind,
    requestId: string,
  ): LocalLock | null {
    if (this.localLocks.has(sessionId)) return null;
    return this.createLocalLock(sessionId, operationKind, requestId);
  }

  private createLocalLock(
    sessionId: string,
    operationKind: LineChatProfileOperationKind,
    requestId: string,
  ): LocalLock {
    let released = false;
    const acquiredAt = new Date();
    const lock: LocalLock = {
      operationKind,
      requestId,
      acquiredAt,
      release: () => {
        if (released) return;
        released = true;
        if (this.localLocks.get(sessionId) === lock) this.localLocks.delete(sessionId);
        this.grantNextLocalWaiter(sessionId);
      },
    };
    this.localLocks.set(sessionId, lock);
    return lock;
  }

  private grantNextLocalWaiter(sessionId: string): void {
    if (this.localLocks.has(sessionId)) return;
    const waiters = this.localWaiters.get(sessionId);
    if (!waiters?.length) return;

    waiters.sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
    const next = waiters.shift();
    if (!next) return;
    if (waiters.length === 0) this.localWaiters.delete(sessionId);
    if (next.timer) clearTimeout(next.timer);

    const lock = this.createLocalLock(sessionId, next.operationKind, next.requestId);
    this.logger.log(JSON.stringify({
      event: "line_chat_profile_operation_priority_granted",
      sessionId,
      operationKind: next.operationKind,
      requestId: next.requestId,
      acquiredAt: lock.acquiredAt.toISOString(),
      waitedMs: Date.now() - next.requestedAtMs,
      remainingWaiters: waiters.length,
    }));
    next.resolve(lock);
  }

  private async acquireDatabaseLease(
    sessionId: string,
    ownerToken: string,
    operationKind: LineChatProfileOperationKind,
  ): Promise<DatabaseLease | null> {
    const rows = await this.prisma.$queryRaw<DatabaseLease[]>`
      INSERT INTO "LineChatProfileOperationLease"
        ("id", "lineChatSessionId", "ownerToken", "operationKind", "acquiredAt", "heartbeatAt", "leaseUntil", "createdAt", "updatedAt")
      VALUES
        (${randomUUID()}, ${sessionId}, ${ownerToken}, ${operationKind}::"LineChatProfileOperationKind", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '90 seconds', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("lineChatSessionId") DO UPDATE
        SET "ownerToken" = EXCLUDED."ownerToken",
            "operationKind" = EXCLUDED."operationKind",
            "acquiredAt" = CURRENT_TIMESTAMP,
            "heartbeatAt" = CURRENT_TIMESTAMP,
            "leaseUntil" = EXCLUDED."leaseUntil",
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "LineChatProfileOperationLease"."leaseUntil" <= CURRENT_TIMESTAMP
      RETURNING "id", "ownerToken", "acquiredAt", "leaseUntil"
    `;
    const acquired = rows[0];
    if (!acquired || acquired.ownerToken !== ownerToken) return null;
    return acquired;
  }

  private async readActiveDatabaseLease(sessionId: string): Promise<ActiveDatabaseLease | null> {
    const rows = await this.prisma.$queryRaw<ActiveDatabaseLease[]>`
      SELECT "operationKind", "acquiredAt", "leaseUntil"
      FROM "LineChatProfileOperationLease"
      WHERE "lineChatSessionId" = ${sessionId}
        AND "leaseUntil" > CURRENT_TIMESTAMP
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  private async renewDatabaseLease(sessionId: string, ownerToken: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE "LineChatProfileOperationLease"
      SET "heartbeatAt" = CURRENT_TIMESTAMP,
          "leaseUntil" = CURRENT_TIMESTAMP + INTERVAL '90 seconds',
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "lineChatSessionId" = ${sessionId}
        AND "ownerToken" = ${ownerToken}
        AND "leaseUntil" > CURRENT_TIMESTAMP
      RETURNING "id"
    `;
    return rows.length === 1;
  }

  private async releaseDatabaseLease(sessionId: string, ownerToken: string): Promise<void> {
    await this.prisma.$executeRaw`
      DELETE FROM "LineChatProfileOperationLease"
      WHERE "lineChatSessionId" = ${sessionId}
        AND "ownerToken" = ${ownerToken}
    `;
  }
}
