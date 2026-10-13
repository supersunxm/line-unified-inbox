export const MIRROR_CYCLE_ADMISSION_BUDGET_MS = 90 * 60_000;
export const MIRROR_HEALTH_RETRY_BUDGET_MS = 10 * 60_000;
export const MIRROR_HEALTH_RETRY_BACKOFF_MS = 5_000;

type RetryResult = { storeCode: string; status: string; healthSessionContention?: boolean };

/** One deferred attempt per health-contended store. Never owns a profile lock.
 * Deadlines bound admission and backoff; already-started browser work finishes
 * under its existing request limits and ownership checks, never a timeout race.
 */
export async function runMirrorFleetWithHealthRetry<T extends RetryResult>(input: {
  storeCodes: readonly string[];
  cycleStartedAt: number;
  retryHealthContention: boolean;
  shouldStop: () => boolean;
  attempt: (storeCode: string) => Promise<T>;
  onError: (storeCode: string, error: unknown) => void;
}, timing: {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  cycleBudgetMs: number;
  retryBudgetMs: number;
  backoffMs: number;
} = {
  now: Date.now,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  cycleBudgetMs: MIRROR_CYCLE_ADMISSION_BUDGET_MS,
  retryBudgetMs: MIRROR_HEALTH_RETRY_BUDGET_MS,
  backoffMs: MIRROR_HEALTH_RETRY_BACKOFF_MS,
}) {
  const results: T[] = [];
  const deferred: Array<{ index: number; storeCode: string }> = [];
  const cycleDeadline = input.retryHealthContention
    ? input.cycleStartedAt + timing.cycleBudgetMs : Number.POSITIVE_INFINITY;
  let storesAttempted = 0;
  let storeExceptions = 0;
  let retryAttempts = 0;
  let retryRecovered = 0;
  let retryExceptions = 0;
  for (const storeCode of [...new Set(input.storeCodes)]) {
    if (input.shouldStop() || timing.now() >= cycleDeadline) break;
    storesAttempted += 1;
    try {
      const result = await input.attempt(storeCode);
      const index = results.push(result) - 1;
      if (input.retryHealthContention && result.status === "PARTIAL" && result.healthSessionContention === true) {
        deferred.push({ index, storeCode });
      }
    } catch (error) {
      storeExceptions += 1;
      input.onError(storeCode, error);
    }
  }
  const retryDeadline = Math.min(cycleDeadline, timing.now() + timing.retryBudgetMs);
  let backoffNeeded = true;
  for (const item of deferred) {
    if (input.shouldStop() || timing.now() >= retryDeadline) break;
    // Give a short health probe a chance to finish. No browser/profile is held.
    if (backoffNeeded) {
      await timing.sleep(Math.min(timing.backoffMs, retryDeadline - timing.now()));
      if (input.shouldStop() || timing.now() >= retryDeadline) break;
    }
    retryAttempts += 1;
    try {
      const result = await input.attempt(item.storeCode);
      results[item.index] = result;
      if (result.status === "SUCCESS") retryRecovered += 1;
      backoffNeeded = result.status === "PARTIAL" && result.healthSessionContention === true;
    } catch (error) {
      retryExceptions += 1;
      // Preserve the first PARTIAL result; a failed retry is never a recovery.
      input.onError(item.storeCode, error);
      backoffNeeded = true;
    }
  }
  return {
    results, storesAttempted, storeExceptions,
    deferredStores: deferred.length, retryAttempts, retryRecovered, retryExceptions,
    retryBudgetExhausted: retryAttempts < deferred.length && timing.now() >= retryDeadline,
    cycleBudgetExhausted: timing.now() >= cycleDeadline,
  };
}
