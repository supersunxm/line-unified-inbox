export type LineChatJobActivityRisk = "NORMAL" | "WARNING" | "CRITICAL";

// These defaults match the worker's existing five-minute lease recovery window
// and keep the dashboard's age classification independent from job outcome counts.
export const LINE_CHAT_JOB_WARNING_AGE_MS = 5 * 60_000;
export const LINE_CHAT_JOB_CRITICAL_AGE_MS = 15 * 60_000;
export const LINE_CHAT_FAILURE_ACTIONABLE_WINDOW_MS = 15 * 60_000;

export interface ActiveLineChatJobSnapshot {
  status: string;
  createdAt: Date;
  updatedAt: Date;
  scheduledAt: Date;
  claimedAt: Date | null;
  lockedUntil: Date | null;
}

export interface LineChatJobRiskSummary {
  risk: LineChatJobActivityRisk;
  ageMs: number;
  isDue: boolean;
}

const riskRank: Record<LineChatJobActivityRisk, number> = {
  NORMAL: 0,
  WARNING: 1,
  CRITICAL: 2,
};

export function classifyActiveLineChatJob(
  job: ActiveLineChatJobSnapshot,
  now: Date = new Date(),
): LineChatJobRiskSummary {
  const nowMs = now.getTime();

  if (job.status === "PENDING") {
    const scheduledMs = job.scheduledAt.getTime();
    const isDue = scheduledMs <= nowMs;
    const ageMs = isDue ? Math.max(0, nowMs - scheduledMs) : 0;
    return {
      risk: !isDue
        ? "NORMAL"
        : ageMs >= LINE_CHAT_JOB_CRITICAL_AGE_MS
          ? "CRITICAL"
          : ageMs >= LINE_CHAT_JOB_WARNING_AGE_MS
            ? "WARNING"
            : "NORMAL",
      ageMs,
      isDue,
    };
  }

  const startedAtMs = (job.claimedAt ?? job.updatedAt ?? job.createdAt).getTime();
  const ageMs = Math.max(0, nowMs - startedAtMs);
  const leaseExpired = !job.lockedUntil || job.lockedUntil.getTime() <= nowMs;
  const isCritical = ageMs >= LINE_CHAT_JOB_CRITICAL_AGE_MS || (
    leaseExpired && ageMs >= LINE_CHAT_JOB_WARNING_AGE_MS
  );

  return {
    risk: isCritical ? "CRITICAL" : ageMs >= LINE_CHAT_JOB_WARNING_AGE_MS ? "WARNING" : "NORMAL",
    ageMs,
    isDue: true,
  };
}

export function summarizeActiveLineChatJobs(
  jobs: ActiveLineChatJobSnapshot[],
  now: Date = new Date(),
): { risk: LineChatJobActivityRisk; warningJobs: number; criticalJobs: number } {
  let risk: LineChatJobActivityRisk = "NORMAL";
  let warningJobs = 0;
  let criticalJobs = 0;

  for (const job of jobs) {
    const result = classifyActiveLineChatJob(job, now);
    if (result.risk === "WARNING") warningJobs += 1;
    if (result.risk === "CRITICAL") criticalJobs += 1;
    if (riskRank[result.risk] > riskRank[risk]) risk = result.risk;
  }

  return { risk, warningJobs, criticalJobs };
}

export function isRecentLineChatFailure(
  updatedAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!updatedAt) return false;
  const ageMs = now.getTime() - updatedAt.getTime();
  return ageMs >= 0 && ageMs <= LINE_CHAT_FAILURE_ACTIONABLE_WINDOW_MS;
}
