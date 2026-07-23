import { Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import {
  formatDbDateToIso,
  formatToIsoDate,
  formatToLineApiDate,
  getDateRangeArray,
  getPreviousBangkokDateString,
  getTodayBangkokDateString,
  toUtcDateForDb,
} from "./date-utils";
import {
  BackfillBatchResult,
  BackfillFollowerInsightsDto,
  BackfillJobResponseDto,
  ByStoreAccountRow,
  ByStoreQueryDto,
  LineFollowerInsightResponse,
  QueueSummaryDto,
  SanitizedSyncError,
  SummaryDailyRow,
  SummaryQueryDto,
  SyncBatchResult,
  SyncFollowerInsightsDto,
} from "./follower-insights.types";

// ---------------------------------------------------------------------------
// Environment configuration with safe defaults
// ---------------------------------------------------------------------------
function getBoolEnv(key: string, defaultValue: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  return val === "1" || val.toLowerCase() === "true";
}

function getNumEnv(key: string, defaultValue: number): number {
  const val = parseInt(process.env[key] ?? "", 10);
  return Number.isFinite(val) && val >= 0 ? val : defaultValue;
}

export const BackfillConfig = {
  /**
   * Enable the worker polling loop on this instance.
   * Default: false — must be explicitly opted-in.
   * Web service: FOLLOWER_BACKFILL_WORKER_ENABLED=false
   * Worker service: FOLLOWER_BACKFILL_WORKER_ENABLED=true
   */
  get workerEnabled() { return getBoolEnv("FOLLOWER_BACKFILL_WORKER_ENABLED", false); },
  /**
   * Enable periodic reconciliation on this instance.
   * Default: false — must be explicitly opted-in.
   * Worker service: FOLLOWER_BACKFILL_RECONCILIATION_ENABLED=true
   */
  get reconciliationEnabled() { return getBoolEnv("FOLLOWER_BACKFILL_RECONCILIATION_ENABLED", false); },
  /** Maximum jobs enqueued per reconciliation cycle */
  get maxEnqueuePerCycle() { return getNumEnv("FOLLOWER_BACKFILL_MAX_ENQUEUE_PER_CYCLE", 10); },
  /** Worker polling interval in ms */
  get pollIntervalMs() { return getNumEnv("FOLLOWER_BACKFILL_POLL_INTERVAL_MS", 5000); },
  /** Periodic reconciliation interval in ms (0 = run only at startup, default: 300000 = 5 min) */
  get reconciliationIntervalMs() { return getNumEnv("FOLLOWER_BACKFILL_RECONCILIATION_INTERVAL_MS", 300000); },
  /** Inter-date delay in ms (avoid LINE API rate limits) */
  get apiDelayMs() { return getNumEnv("FOLLOWER_BACKFILL_API_DELAY_MS", 200); },
  /** Reconciliation accounts inspected per cycle */
  get reconciliationBatchSize() { return getNumEnv("FOLLOWER_BACKFILL_RECONCILIATION_BATCH_SIZE", 10); },
};

// ---------------------------------------------------------------------------
// Sleep helper
// ---------------------------------------------------------------------------
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class FollowerInsightsService implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(FollowerInsightsService.name);
  private workerTimer: NodeJS.Timeout | null = null;
  private reconciliationTimer: NodeJS.Timeout | null = null;
  private isWorkerProcessing = false;
  private isReconciling = false;
  private isShuttingDown = false;
  public readonly workerId = `worker-${process.pid}-${randomBytes(4).toString("hex")}`;

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialEncryptionService: CredentialEncryptionService
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV !== "test" && BackfillConfig.reconciliationEnabled) {
      // Fire once at startup; subsequent cycles run on the reconciliationTimer
      void this.runReconciliationCycle().catch((err) =>
        this.logger.error("Startup backfill reconciliation failed", err)
      );
    }
  }

  onApplicationBootstrap() {
    if (process.env.NODE_ENV !== "test" && BackfillConfig.workerEnabled && !this.workerTimer) {
      this.workerTimer = setInterval(() => {
        void this.pollAndProcessJobs();
      }, BackfillConfig.pollIntervalMs);
      this.logger.log(`Backfill worker started (id=${this.workerId}, pollInterval=${BackfillConfig.pollIntervalMs}ms, concurrency=1-per-instance)`);
    }

    const reconcIntervalMs = BackfillConfig.reconciliationIntervalMs;
    if (process.env.NODE_ENV !== "test" && BackfillConfig.reconciliationEnabled && reconcIntervalMs > 0 && !this.reconciliationTimer) {
      this.reconciliationTimer = setInterval(() => {
        void this.runReconciliationCycle().catch((err) =>
          this.logger.error("Periodic reconciliation failed", err)
        );
      }, reconcIntervalMs);
      this.logger.log(`Periodic reconciliation scheduled every ${reconcIntervalMs}ms`);
    }
  }

  onModuleDestroy() {
    this.isShuttingDown = true;
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
      this.logger.log("Backfill worker timer cleared on shutdown");
    }
    if (this.reconciliationTimer) {
      clearInterval(this.reconciliationTimer);
      this.reconciliationTimer = null;
      this.logger.log("Reconciliation timer cleared on shutdown");
    }
  }

  /**
   * Guard wrapper: prevents overlapping reconciliation cycles.
   * Called both at startup (once) and by the periodic timer.
   */
  async runReconciliationCycle(options?: { batchSize?: number; maxEnqueue?: number }): Promise<number> {
    if (this.isReconciling) {
      this.logger.debug("Reconciliation already in progress, skipping this cycle.");
      return 0;
    }
    this.isReconciling = true;
    try {
      return await this.reconcileUncoveredAccounts(options);
    } finally {
      this.isReconciling = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Worker polling loop – prevents overlapping executions
  // ---------------------------------------------------------------------------
  async pollAndProcessJobs(): Promise<void> {
    if (this.isWorkerProcessing) return;
    this.isWorkerProcessing = true;
    try {
      await this.recoverStaleJobs();
      await this.claimAndProcessNextJob();
    } catch (error) {
      this.logger.error("Error in backfill worker loop", error);
    } finally {
      this.isWorkerProcessing = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Stale job recovery
  // ---------------------------------------------------------------------------
  async recoverStaleJobs(staleThresholdMs = 5 * 60 * 1000): Promise<number> {
    if (!this.prisma.lineOaBackfillJob?.findMany) return 0;
    const staleCutoff = new Date(Date.now() - staleThresholdMs);

    const staleJobs = await this.prisma.lineOaBackfillJob.findMany({
      where: {
        status: "RUNNING",
        OR: [
          { heartbeatAt: { lte: staleCutoff } },
          { heartbeatAt: null, claimedAt: { lte: staleCutoff } },
          { heartbeatAt: null, claimedAt: null, startedAt: { lte: staleCutoff } },
        ],
      },
    });

    let recoveredCount = 0;
    for (const job of staleJobs) {
      if (job.attempts >= job.maxAttempts) {
        await this.prisma.lineOaBackfillJob.updateMany({
          where: { id: job.id, status: "RUNNING" },
          data: {
            status: "FAILED",
            errorMessage: `Stale job execution exceeded maximum attempts (${job.maxAttempts})`,
            completedAt: new Date(),
          },
        });
      } else {
        await this.prisma.lineOaBackfillJob.updateMany({
          where: { id: job.id, status: "RUNNING" },
          data: {
            status: "QUEUED",
            workerId: null,
            claimedAt: null,
            heartbeatAt: null,
            startedAt: null,
          },
        });
        recoveredCount++;
      }
    }
    return recoveredCount;
  }

  // ---------------------------------------------------------------------------
  // Heartbeat
  // ---------------------------------------------------------------------------
  async updateHeartbeat(jobId: string, workerId: string): Promise<boolean> {
    const updated = await this.prisma.lineOaBackfillJob.updateMany({
      where: { id: jobId, status: "RUNNING", workerId },
      data: { heartbeatAt: new Date() },
    });
    return updated.count > 0;
  }

  // ---------------------------------------------------------------------------
  // Shared full-range historical date inspector
  // ---------------------------------------------------------------------------
  async getMissingHistoricalDates(lineOaId: string, dateFrom: string, dateTo: string): Promise<string[]> {
    if (!this.prisma.lineOaFollowerSnapshot) return getDateRangeArray(dateFrom, dateTo);
    const allDates = getDateRangeArray(dateFrom, dateTo);
    if (allDates.length === 0) return [];
    const startUtc = toUtcDateForDb(dateFrom);
    const endUtc = toUtcDateForDb(dateTo);

    const snapshots = await this.prisma.lineOaFollowerSnapshot.findMany({
      where: {
        lineOaId,
        snapshotDate: { gte: startUtc, lte: endUtc },
        status: "ready",
        followers: { not: null },
      },
      select: { snapshotDate: true },
    });

    const readyDatesSet = new Set(snapshots.map((s) => formatDbDateToIso(s.snapshotDate)));
    return allDates.filter((d) => !readyDatesSet.has(d));
  }

  // ---------------------------------------------------------------------------
  // Atomic job claim (shutdown-safe, FIFO)
  // ---------------------------------------------------------------------------
  async claimAndProcessNextJob(overrideWorkerId?: string): Promise<boolean> {
    if (this.isShuttingDown || !this.prisma.lineOaBackfillJob?.findFirst) return false;
    const now = new Date();
    const currentWorker = overrideWorkerId || this.workerId;

    const candidate = await this.prisma.lineOaBackfillJob.findFirst({
      where: {
        status: "QUEUED",
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      orderBy: { createdAt: "asc" },
    });

    if (!candidate) return false;

    const updated = await this.prisma.lineOaBackfillJob.updateMany({
      where: { id: candidate.id, status: "QUEUED" },
      data: {
        status: "RUNNING",
        workerId: currentWorker,
        claimedAt: now,
        heartbeatAt: now,
        startedAt: candidate.startedAt || now,
        attempts: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      return false; // another instance claimed it first
    }

    await this.processClaimedJob(candidate.id, currentWorker);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Bounded, coverage-driven reconciliation with keyset cursor (starvation-free)
  // ---------------------------------------------------------------------------
  /**
   * Reconcile uncovered accounts using a keyset cursor so every account is
   * eventually inspected across successive cycles.
   *
   * Strategy:
   * - Accounts are sorted by id (stable, independent of insertion order).
   * - Each cycle fetches `batchSize` accounts whose id > reconciliationCursor.
   * - After the last account, the cursor wraps to null (restart from beginning).
   * - Added/deleted accounts are naturally handled: new ids appear in subsequent
   *   cycles and deleted ids are never fetched from the database.
   * - All snapshot/coverage queries remain bounded (3 SQL queries total).
   *
   * Concurrency:  3 bounded SQL queries regardless of account count.
   * Expected cycles to visit all 150 accounts with batchSize=10: 15 cycles.
   */
  async reconcileUncoveredAccounts(options?: { batchSize?: number; maxEnqueue?: number }): Promise<number> {
    if (!this.prisma.lineOfficialAccount || !this.prisma.lineOaFollowerSnapshot || !this.prisma.lineOaBackfillJob) {
      return 0;
    }

    const batchSize = options?.batchSize ?? BackfillConfig.reconciliationBatchSize;
    const maxEnqueue = options?.maxEnqueue ?? BackfillConfig.maxEnqueuePerCycle;

    const { dateFrom, dateTo } = this.getAutoBackfillDates();

    // Durable starvation-free query:
    // Accounts ordered by lastBackfillReconciledAt (nulls first), then id ASC
    const pageBatch = await this.prisma.lineOfficialAccount.findMany({
      where: {
        isActive: true,
        archivedAt: null,
      },
      orderBy: [
        { lastBackfillReconciledAt: { sort: "asc", nulls: "first" } },
        { id: "asc" },
      ],
      take: batchSize,
      select: { id: true },
    });

    if (pageBatch.length === 0) {
      this.logger.log("Reconciliation: no active accounts, skipping.");
      return 0;
    }

    const batchIds = pageBatch.map((a) => a.id);
    const now = new Date();
    const startUtc = toUtcDateForDb(dateFrom);
    const endUtc = toUtcDateForDb(dateTo);

    // 1 bounded snapshot query for this batch
    const snapshots = await this.prisma.lineOaFollowerSnapshot.findMany({
      where: {
        lineOaId: { in: batchIds },
        snapshotDate: { gte: startUtc, lte: endUtc },
        status: "ready",
        followers: { not: null },
      },
      select: { lineOaId: true, snapshotDate: true },
    });

    // 1 bounded active-jobs query for this batch
    const activeJobs = await this.prisma.lineOaBackfillJob.findMany({
      where: { lineOaId: { in: batchIds }, status: { in: ["QUEUED", "RUNNING"] } },
      select: { lineOaId: true },
    });
    const activeJobOaIds = new Set(activeJobs.map((j) => j.lineOaId));

    const readyDatesByOa = new Map<string, Set<string>>();
    for (const snap of snapshots) {
      let set = readyDatesByOa.get(snap.lineOaId);
      if (!set) {
        set = new Set<string>();
        readyDatesByOa.set(snap.lineOaId, set);
      }
      set.add(formatDbDateToIso(snap.snapshotDate));
    }

    const requiredDates = getDateRangeArray(dateFrom, dateTo);

    let enqueuedCount = 0;
    let skippedCollisions = 0;
    const errors: string[] = [];
    const inspectedAndSuccessfulIds: string[] = [];

    for (const acc of pageBatch) {
      // 1. Account already has an active job → inspection complete (job is handling coverage)
      if (activeJobOaIds.has(acc.id)) {
        inspectedAndSuccessfulIds.push(acc.id);
        continue;
      }

      // 2. Account coverage complete → inspection complete (no backfill needed)
      const readySet = readyDatesByOa.get(acc.id);
      const isComplete = readySet ? requiredDates.every((d) => readySet.has(d)) : false;

      if (isComplete) {
        inspectedAndSuccessfulIds.push(acc.id);
        continue;
      }

      // 3. Account incomplete and no active job → attempt enqueue subject to maxEnqueue cap
      if (enqueuedCount >= maxEnqueue) {
        // Enqueue quota reached for this cycle; remaining incomplete accounts are left for subsequent cycles
        break;
      }

      try {
        await this.enqueueAutoBackfillJob(acc.id);
        enqueuedCount++;
        inspectedAndSuccessfulIds.push(acc.id);
      } catch (err) {
        if ((err as { code?: string })?.code === "P2002") {
          skippedCollisions++;
          inspectedAndSuccessfulIds.push(acc.id);
          this.logger.debug(`Reconciliation: collision for ${acc.id} (expected in multi-instance)`);
        } else {
          errors.push(acc.id);
          this.logger.warn(`Reconciliation: failed to enqueue for ${acc.id}`, err);
          // Unexpected failure → do NOT mark acc.id as reconciled so it can be retried
        }
      }
    }

    // Persist lastBackfillReconciledAt ONLY for accounts whose inspection/enqueue succeeded or collided on P2002
    if (inspectedAndSuccessfulIds.length > 0) {
      await this.prisma.lineOfficialAccount.updateMany({
        where: { id: { in: inspectedAndSuccessfulIds } },
        data: { lastBackfillReconciledAt: now },
      });
    }

    this.logger.log(
      `Reconciliation done: inspected=${inspectedAndSuccessfulIds.length} enqueued=${enqueuedCount} skippedCollisions=${skippedCollisions} errors=${errors.length}`
    );

    return enqueuedCount;
  }

  // ---------------------------------------------------------------------------
  // Date math helpers
  // ---------------------------------------------------------------------------
  getAutoBackfillDates(targetTodayIso?: string): { dateFrom: string; dateTo: string; totalDays: number } {
    const todayIso = targetTodayIso || getTodayBangkokDateString();
    const dateTo = getPreviousBangkokDateString(todayIso);
    const dateToObj = new Date(dateTo + "T00:00:00.000Z");
    const dateFromObj = new Date(dateToObj.getTime() - (29 * 24 * 60 * 60 * 1000));
    const dateFrom = dateFromObj.toISOString().split("T")[0];
    const totalDays = getDateRangeArray(dateFrom, dateTo).length;
    return { dateFrom, dateTo, totalDays };
  }

  // ---------------------------------------------------------------------------
  // LINE API fetch with 429 / Retry-After support
  // ---------------------------------------------------------------------------
  private async fetchLineFollowerInsight(
    encryptedToken: string,
    lineApiDateStr: string,
    timeoutMs = 10000
  ): Promise<{ data?: LineFollowerInsightResponse; errorCode?: string; retryAfterMs?: number }> {
    let token: string;
    try {
      token = this.credentialEncryptionService.decrypt(encryptedToken);
    } catch {
      return { errorCode: "LINE_CREDENTIAL_ERROR" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `https://api.line.me/v2/bot/insight/followers?date=${lineApiDateStr}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfterHeader = response.headers.get("Retry-After") ?? "60";
          let retryAfterMs: number;
          // Retry-After can be a delay-seconds integer or an HTTP-date string
          const asSeconds = parseInt(retryAfterHeader, 10);
          if (Number.isFinite(asSeconds) && asSeconds >= 0) {
            retryAfterMs = asSeconds * 1000;
          } else {
            // HTTP-date format: e.g. "Wed, 21 Oct 2015 07:28:00 GMT"
            const parsed = Date.parse(retryAfterHeader);
            retryAfterMs = Number.isFinite(parsed) ? Math.max(0, parsed - Date.now()) : 60_000;
          }
          return { errorCode: "LINE_API_ERROR_429", retryAfterMs };
        }
        if (response.status === 401) return { errorCode: "LINE_API_ERROR_401" };
        if (response.status === 403) return { errorCode: "LINE_API_ERROR_403" };
        if (response.status === 404) return { errorCode: "LINE_API_ERROR_404" };
        if (response.status >= 500) return { errorCode: "LINE_API_ERROR_500" };
        return { errorCode: "LINE_API_HTTP_ERROR" };
      }

      const body = (await response.json()) as Record<string, unknown>;
      return {
        data: {
          status: typeof body?.status === "string" ? body.status : "unready",
          followers: typeof body?.followers === "number" ? body.followers : null,
          targetedReaches: typeof body?.targetedReaches === "number" ? body.targetedReaches : null,
          blocks: typeof body?.blocks === "number" ? body.blocks : null,
        },
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err && typeof err === "object" && "name" in err && err.name === "AbortError") {
        return { errorCode: "LINE_API_TIMEOUT" };
      }
      return { errorCode: "LINE_API_NETWORK_ERROR" };
    }
  }

  async sync(
    dto: SyncFollowerInsightsDto,
    targetLineOaIds?: string[],
    force = false
  ): Promise<SyncBatchResult> {
    const isoDate = formatToIsoDate(dto.date);
    const lineApiDate = formatToLineApiDate(isoDate);
    const dbDate = toUtcDateForDb(isoDate);

    const accounts = await this.prisma.lineOfficialAccount.findMany({
      where: {
        isActive: true,
        archivedAt: null,
        encryptedChannelAccessToken: { not: null },
        ...(targetLineOaIds && targetLineOaIds.length > 0 ? { id: { in: targetLineOaIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        encryptedChannelAccessToken: true,
      },
    });

    const sanitizedErrors: SanitizedSyncError[] = [];
    let succeeded = 0;
    let unready = 0;
    let failed = 0;
    let skipped = 0;

    const processAccount = async (account: typeof accounts[number]) => {
      try {
        if (!account.encryptedChannelAccessToken) {
          skipped++;
          return;
        }

        if (!force && this.prisma.lineOaFollowerSnapshot?.findUnique) {
          const existingSnapshot = await this.prisma.lineOaFollowerSnapshot
            .findUnique({
              where: {
                lineOaId_snapshotDate: {
                  lineOaId: account.id,
                  snapshotDate: dbDate,
                },
              },
            })
            .catch(() => null);

          if (existingSnapshot && existingSnapshot.status === "ready" && existingSnapshot.followers !== null) {
            skipped++;
            return;
          }
        }

        const { data, errorCode } = await this.fetchLineFollowerInsight(
          account.encryptedChannelAccessToken,
          lineApiDate
        );

        if (errorCode) {
          failed++;
          sanitizedErrors.push({
            lineOaId: account.id,
            accountName: account.name,
            date: isoDate,
            code: errorCode,
          });
          return;
        }

        if (!data) {
          failed++;
          sanitizedErrors.push({
            lineOaId: account.id,
            accountName: account.name,
            date: isoDate,
            code: "LINE_API_NO_DATA",
          });
          return;
        }

        const status = data.status || "unready";

        await this.prisma.lineOaFollowerSnapshot.upsert({
          where: {
            lineOaId_snapshotDate: {
              lineOaId: account.id,
              snapshotDate: dbDate,
            },
          },
          update: {
            status,
            followers: data.followers,
            targetedReaches: data.targetedReaches,
            blocks: data.blocks,
            fetchedAt: new Date(),
          },
          create: {
            lineOaId: account.id,
            snapshotDate: dbDate,
            status,
            followers: data.followers,
            targetedReaches: data.targetedReaches,
            blocks: data.blocks,
            fetchedAt: new Date(),
          },
        });

        if (status === "ready" && data.followers !== null) {
          succeeded++;
        } else {
          unready++;
        }
      } catch {
        failed++;
        sanitizedErrors.push({
          lineOaId: account.id,
          accountName: account.name,
          date: isoDate,
          code: "DATABASE_WRITE_ERROR",
        });
      }
    };

    // Sequential processing to stay within LINE rate limits (configurable concurrency via mapConcurrently)
    for (const account of accounts) {
      await processAccount(account);
    }

    return {
      date: isoDate,
      requested: accounts.length,
      succeeded,
      unready,
      failed,
      skipped,
      errors: sanitizedErrors,
    };
  }

  // ---------------------------------------------------------------------------
  // Backfill: sequential date iteration with configurable inter-date delay
  // ---------------------------------------------------------------------------
  async backfill(dto: BackfillFollowerInsightsDto): Promise<BackfillBatchResult> {
    if (dto.lineOaId) {
      const account = await this.prisma.lineOfficialAccount.findFirst({
        where: { id: dto.lineOaId, isActive: true, archivedAt: null },
      });
      if (!account) {
        throw new NotFoundException("Active LINE Official Account not found");
      }
    }

    const dates = getDateRangeArray(dto.dateFrom, dto.dateTo);
    const results: SyncBatchResult[] = [];
    const targetLineOaIds = dto.lineOaIds
      ? dto.lineOaIds
      : dto.lineOaId
        ? [dto.lineOaId]
        : undefined;

    // Sequential iteration — no Promise.all over dates
    for (const date of dates) {
      const result = await this.sync({ date }, targetLineOaIds, dto.force);
      results.push(result);
      if (BackfillConfig.apiDelayMs > 0 && dates.indexOf(date) < dates.length - 1) {
        await sleep(BackfillConfig.apiDelayMs);
      }
    }

    return {
      dateFrom: dates[0],
      dateTo: dates[dates.length - 1],
      totalDays: dates.length,
      results,
    };
  }

  async getSummary(query: SummaryQueryDto): Promise<SummaryDailyRow[]> {
    const todayIso = getTodayBangkokDateString();
    const dateFrom = query.dateFrom ? formatToIsoDate(query.dateFrom) : todayIso;
    const dateTo = query.dateTo ? formatToIsoDate(query.dateTo) : todayIso;

    const dates = getDateRangeArray(dateFrom, dateTo);

    const accountsWhereClause: Record<string, unknown> = {
      isActive: true,
      archivedAt: null,
      ...(query.lineOaId ? { id: query.lineOaId } : {}),
      ...(query.storeId || query.region || query.province
        ? {
            store: {
              ...(query.storeId ? { id: query.storeId } : {}),
              ...(query.region ? { region: query.region } : {}),
              ...(query.province
                ? {
                    OR: [
                      { storeMaster: { province: query.province } },
                    ],
                  }
                : {}),
            },
          }
        : {}),
    };

    const matchingAccounts = await this.prisma.lineOfficialAccount.findMany({
      where: accountsWhereClause,
      select: { id: true },
    });

    const accountsExpected = matchingAccounts.length;
    const accountIds = matchingAccounts.map((a) => a.id);

    if (accountIds.length === 0) {
      return dates.map((d) => ({
        date: d,
        followers: null,
        targetedReaches: null,
        blocks: null,
        dailyIncrease: null,
        accountsExpected: 0,
        accountsWithData: 0,
        accountsReady: 0,
        accountsUnready: 0,
        accountsMissing: 0,
      }));
    }

    const minDateUtc = toUtcDateForDb(dates[0]);
    const maxDateUtc = toUtcDateForDb(dates[dates.length - 1]);

    const snapshots = await this.prisma.lineOaFollowerSnapshot.findMany({
      where: {
        lineOaId: { in: accountIds },
        snapshotDate: { gte: minDateUtc, lte: maxDateUtc },
      },
    });

    const snapshotsByDate = new Map<string, typeof snapshots>();
    for (const snap of snapshots) {
      const dStr = formatDbDateToIso(snap.snapshotDate);
      if (!snapshotsByDate.has(dStr)) {
        snapshotsByDate.set(dStr, []);
      }
      snapshotsByDate.get(dStr)!.push(snap);
    }

    let comparableAccountIds: Set<string> | null = null;
    if (query.comparisonMode === "comparable") {
      const usableDates = dates.filter((dStr) => {
        const snaps = snapshotsByDate.get(dStr) || [];
        return snaps.some((s) => s.status === "ready" && s.followers !== null);
      });

      if (usableDates.length === 0) {
        comparableAccountIds = new Set<string>();
      } else {
        comparableAccountIds = new Set(
          accountIds.filter((accId) => {
            return usableDates.every((dStr) => {
              const snaps = snapshotsByDate.get(dStr) || [];
              return snaps.some((s) => s.lineOaId === accId && s.status === "ready" && s.followers !== null);
            });
          })
        );
      }
    }

    const rows: SummaryDailyRow[] = [];

    for (const dStr of dates) {
      const daySnapshots = snapshotsByDate.get(dStr) || [];
      const readySnapshots = daySnapshots.filter((s) =>
        s.status === "ready" && (comparableAccountIds === null || comparableAccountIds.has(s.lineOaId))
      );
      const accountsExpectedForDay = comparableAccountIds !== null ? comparableAccountIds.size : accountsExpected;
      const accountsWithData = comparableAccountIds !== null ? comparableAccountIds.size : daySnapshots.length;
      const accountsReady = comparableAccountIds !== null ? comparableAccountIds.size : readySnapshots.length;
      const accountsUnready = comparableAccountIds !== null ? 0 : accountsWithData - accountsReady;
      const accountsMissing = comparableAccountIds !== null ? 0 : accountsExpectedForDay - accountsWithData;

      let followers: number | null = null;
      let targetedReaches: number | null = null;
      let blocks: number | null = null;

      for (const s of readySnapshots) {
        if (s.followers !== null) {
          followers = (followers ?? 0) + s.followers;
        }
        if (s.targetedReaches !== null) {
          targetedReaches = (targetedReaches ?? 0) + s.targetedReaches;
        }
        if (s.blocks !== null) {
          blocks = (blocks ?? 0) + s.blocks;
        }
      }

      let aggregateIncrease: number | null = null;
      let validIncreaseCount = 0;

      const prevIsoDate = getPreviousBangkokDateString(dStr);
      const prevDaySnapshots = snapshotsByDate.get(prevIsoDate) || [];
      const prevSnapMap = new Map<string, typeof snapshots[0]>();
      for (const pSnap of prevDaySnapshots) {
        if (pSnap.status === "ready" && pSnap.followers !== null && (comparableAccountIds === null || comparableAccountIds.has(pSnap.lineOaId))) {
          prevSnapMap.set(pSnap.lineOaId, pSnap);
        }
      }

      for (const snap of readySnapshots) {
        if (snap.followers === null) continue;
        const prevSnap = prevSnapMap.get(snap.lineOaId);

        if (prevSnap && prevSnap.followers !== null) {
          const increase = snap.followers - prevSnap.followers;
          aggregateIncrease = (aggregateIncrease ?? 0) + increase;
          validIncreaseCount++;
        }
      }

      rows.push({
        date: dStr,
        followers,
        targetedReaches,
        blocks,
        dailyIncrease: validIncreaseCount > 0 ? aggregateIncrease : null,
        accountsExpected: accountsExpectedForDay,
        accountsWithData,
        accountsReady,
        accountsUnready,
        accountsMissing,
      });
    }

    return rows;
  }

  // ---------------------------------------------------------------------------
  // Enqueue with full-range coverage check
  // ---------------------------------------------------------------------------
  async enqueueAutoBackfillJob(lineOaId: string): Promise<BackfillJobResponseDto> {
    const account = await this.prisma.lineOfficialAccount.findFirst({
      where: { id: lineOaId, isActive: true, archivedAt: null },
    });
    if (!account) {
      throw new NotFoundException("Active LINE Official Account not found");
    }

    const activeJob = await this.prisma.lineOaBackfillJob.findFirst({
      where: { lineOaId, status: { in: ["QUEUED", "RUNNING"] } },
      orderBy: { createdAt: "desc" },
    });
    if (activeJob) {
      return this.mapJobToDto(activeJob);
    }

    const { dateFrom, dateTo, totalDays } = this.getAutoBackfillDates();
    const missingDates = await this.getMissingHistoricalDates(lineOaId, dateFrom, dateTo);

    if (missingDates.length === 0) {
      const completedJob = await this.prisma.lineOaBackfillJob.findFirst({
        where: { lineOaId, dateFrom, dateTo, status: { in: ["COMPLETED", "COMPLETED_WITH_ERRORS"] } },
        orderBy: { createdAt: "desc" },
      });
      if (completedJob) {
        return this.mapJobToDto(completedJob);
      }
    }

    try {
      const job = await this.prisma.lineOaBackfillJob.create({
        data: {
          lineOaId,
          status: "QUEUED",
          dateFrom,
          dateTo,
          totalDays: missingDates.length > 0 ? missingDates.length : totalDays,
          maxAttempts: 3,
        },
      });

      if (BackfillConfig.workerEnabled) {
        setImmediate(() => {
          void this.pollAndProcessJobs().catch(() => null);
        });
      }

      return this.mapJobToDto(job);
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") {
        const existing = await this.prisma.lineOaBackfillJob.findFirst({
          where: { lineOaId, status: { in: ["QUEUED", "RUNNING"] } },
          orderBy: { createdAt: "desc" },
        });
        if (existing) return this.mapJobToDto(existing);
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Process a claimed job – guarded heartbeat and completion writes
  // ---------------------------------------------------------------------------
  async processClaimedJob(jobId: string, currentWorkerId?: string): Promise<boolean> {
    const worker = currentWorkerId || this.workerId;
    const job = await this.prisma.lineOaBackfillJob.findFirst({
      where: { id: jobId, status: "RUNNING", workerId: worker },
    });
    if (!job) {
      this.logger.warn(`Worker ${worker} cannot process job ${jobId} because ownership was lost or status is not RUNNING.`);
      return false;
    }

    const initialHeartbeat = await this.updateHeartbeat(jobId, worker);
    if (!initialHeartbeat) return false;

    try {
      const res = await this.backfill({
        dateFrom: job.dateFrom,
        dateTo: job.dateTo,
        lineOaId: job.lineOaId,
      });

      let requested = 0;
      let succeeded = 0;
      let skipped = 0;
      let unready = 0;
      let failed = 0;

      for (const r of res.results) {
        requested += r.requested;
        succeeded += r.succeeded;
        skipped += r.skipped;
        unready += r.unready;
        failed += r.failed;
      }

      let finalStatus: "COMPLETED" | "COMPLETED_WITH_ERRORS" | "FAILED" = "COMPLETED";
      if (failed > 0 || unready > 0) {
        finalStatus = succeeded > 0 || skipped > 0 ? "COMPLETED_WITH_ERRORS" : "FAILED";
      }

      const updated = await this.prisma.lineOaBackfillJob.updateMany({
        where: { id: jobId, status: "RUNNING", workerId: worker },
        data: {
          status: finalStatus,
          requested,
          succeeded,
          skipped,
          unready,
          failed,
          completedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        this.logger.warn(`Worker ${worker} failed guarded completion write for job ${jobId} (ownership lost).`);
        return false;
      }
      return true;
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : "Backfill execution error";

      // Honor Retry-After from 429 errors
      const retryAfterMs = (error as { retryAfterMs?: number })?.retryAfterMs;

      if (job.attempts < job.maxAttempts) {
        const baseBackoffMs = retryAfterMs ?? Math.pow(2, job.attempts) * 60 * 1000;
        // Add jitter (±10%)
        const jitter = baseBackoffMs * 0.1 * (Math.random() * 2 - 1);
        const nextAttemptAt = new Date(Date.now() + baseBackoffMs + jitter);

        await this.prisma.lineOaBackfillJob.updateMany({
          where: { id: jobId, status: "RUNNING", workerId: worker },
          data: {
            status: "QUEUED",
            workerId: null,
            claimedAt: null,
            heartbeatAt: null,
            nextAttemptAt,
            errorMessage: `Attempt ${job.attempts} failed: ${errMessage}`,
          },
        });
      } else {
        await this.prisma.lineOaBackfillJob.updateMany({
          where: { id: jobId, status: "RUNNING", workerId: worker },
          data: {
            status: "FAILED",
            errorMessage: errMessage,
            completedAt: new Date(),
          },
        });
      }
      return false;
    }
  }

  async executeBackfillJob(jobId: string): Promise<void> {
    await this.processClaimedJob(jobId);
  }

  // ---------------------------------------------------------------------------
  // Job status and queue summary
  // ---------------------------------------------------------------------------
  async getJobStatus(lineOaId: string): Promise<BackfillJobResponseDto> {
    const job = await this.prisma.lineOaBackfillJob.findFirst({
      where: { lineOaId },
      orderBy: { createdAt: "desc" },
    });
    if (!job) {
      throw new NotFoundException(`No backfill job found for LINE OA ID '${lineOaId}'`);
    }
    return this.mapJobToDto(job);
  }

  async getQueueSummary(): Promise<QueueSummaryDto> {
    const [statusCounts, oldestQueued, unresolvedJobs] = await Promise.all([
      this.prisma.lineOaBackfillJob.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      this.prisma.lineOaBackfillJob.findFirst({
        where: { status: "QUEUED" },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      /**
       * For estimatedRemainingAccountDateCalls we sum (totalDays - succeeded - skipped)
       * across all QUEUED and RUNNING jobs.
       * - totalDays = the number of calendar dates in the job's range
       * - succeeded + skipped = dates already processed successfully
       * This gives the actual remaining LINE API calls needed for unresolved work.
       * Credentials are never selected.
       */
      this.prisma.lineOaBackfillJob.findMany({
        where: { status: { in: ["QUEUED", "RUNNING"] } },
        select: { totalDays: true, succeeded: true, skipped: true },
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of statusCounts) {
      byStatus[row.status] = row._count.id;
    }

    let estimatedRemainingAccountDateCalls = 0;
    for (const job of unresolvedJobs) {
      const remaining = job.totalDays - job.succeeded - job.skipped;
      estimatedRemainingAccountDateCalls += Math.max(0, remaining);
    }

    return {
      queued: byStatus["QUEUED"] ?? 0,
      running: byStatus["RUNNING"] ?? 0,
      completed: byStatus["COMPLETED"] ?? 0,
      completedWithErrors: byStatus["COMPLETED_WITH_ERRORS"] ?? 0,
      failed: byStatus["FAILED"] ?? 0,
      oldestQueuedAt: oldestQueued?.createdAt ?? null,
      estimatedRemainingAccountDateCalls,
    };
  }


  async retryBackfillJob(lineOaId: string): Promise<BackfillJobResponseDto> {
    return this.enqueueAutoBackfillJob(lineOaId);
  }

  private mapJobToDto(job: {
    id: string;
    lineOaId: string;
    status: string;
    dateFrom: string;
    dateTo: string;
    totalDays: number;
    requested: number;
    succeeded: number;
    skipped: number;
    unready: number;
    failed: number;
    attempts?: number;
    maxAttempts?: number;
    errorMessage: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
  }): BackfillJobResponseDto {
    return {
      id: job.id,
      lineOaId: job.lineOaId,
      status: job.status as BackfillJobResponseDto["status"],
      dateFrom: job.dateFrom,
      dateTo: job.dateTo,
      totalDays: job.totalDays,
      requested: job.requested,
      succeeded: job.succeeded,
      skipped: job.skipped,
      unready: job.unready,
      failed: job.failed,
      attempts: job.attempts ?? 0,
      maxAttempts: job.maxAttempts ?? 3,
      errorMessage: job.errorMessage,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
    };
  }

  async getByStore(query: ByStoreQueryDto): Promise<ByStoreAccountRow[]> {
    const todayIso = getTodayBangkokDateString();
    const targetIsoDate = query.dateTo ? formatToIsoDate(query.dateTo) : (query.date ? formatToIsoDate(query.date) : todayIso);
    const targetUtcDate = toUtcDateForDb(targetIsoDate);

    const startIsoDate = query.dateFrom ? formatToIsoDate(query.dateFrom) : targetIsoDate;
    const startUtcDate = toUtcDateForDb(startIsoDate);

    const prevTargetIsoDate = getPreviousBangkokDateString(targetIsoDate);
    const prevTargetUtcDate = toUtcDateForDb(prevTargetIsoDate);

    const accounts = await this.prisma.lineOfficialAccount.findMany({
      where: {
        isActive: true,
        archivedAt: null,
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
          },
        },
        followerSnapshots: {
          where: {
            snapshotDate: { in: [startUtcDate, targetUtcDate, prevTargetUtcDate] },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const rows: ByStoreAccountRow[] = [];

    for (const account of accounts) {
      const endSnap = account.followerSnapshots.find(s => formatDbDateToIso(s.snapshotDate) === targetIsoDate);
      const isReady = endSnap?.status === "ready";
      const currentFollowers = isReady && endSnap.followers !== null ? endSnap.followers : null;

      let startFollowers: number | null = null;
      let periodIncrease: number | null = null;
      let status = endSnap?.status || "missing";

      const startSnap = account.followerSnapshots.find(s => formatDbDateToIso(s.snapshotDate) === startIsoDate);
      if (!startSnap || startSnap.status !== "ready") {
        status = status === "ready" ? "missing-baseline" : status;
      } else {
        startFollowers = startSnap.followers !== null ? startSnap.followers : null;
      }

      if (currentFollowers !== null && startFollowers !== null) {
        periodIncrease = currentFollowers - startFollowers;
      }

      const prevSnapForDaily = account.followerSnapshots.find(
        s => formatDbDateToIso(s.snapshotDate) === prevTargetIsoDate && s.status === "ready"
      );

      const previousFollowers = prevSnapForDaily?.followers ?? null;
      let dailyIncrease: number | null = null;
      if (currentFollowers !== null && previousFollowers !== null) {
        dailyIncrease = currentFollowers - previousFollowers;
      }

      rows.push({
        lineOaId: account.id,
        accountName: account.name,
        storeId: account.store.id,
        storeName: account.store.name,
        date: targetIsoDate,
        followers: currentFollowers,
        previousFollowers,
        startFollowers,
        dailyIncrease,
        periodIncrease,
        targetedReaches: isReady ? endSnap?.targetedReaches ?? null : null,
        blocks: isReady ? endSnap?.blocks ?? null : null,
        status,
        fetchedAt: endSnap?.fetchedAt ?? null,
      });
    }

    return rows;
  }
}
