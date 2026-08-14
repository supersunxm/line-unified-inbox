export interface LineFollowerInsightResponse {
  status: string;
  followers?: number | null;
  targetedReaches?: number | null;
  blocks?: number | null;
}

export interface SyncFollowerInsightsDto {
  date?: string;
}

export interface BackfillFollowerInsightsDto {
  dateFrom: string;
  dateTo: string;
  lineOaId?: string;
  lineOaIds?: string[];
  force?: boolean;
}

export interface SanitizedSyncError {
  lineOaId: string;
  accountName: string;
  date: string;
  code: string;
}

export interface SyncBatchResult {
  date: string;
  requested: number;
  succeeded: number;
  unready: number;
  failed: number;
  skipped: number;
  errors: SanitizedSyncError[];
}

export interface BackfillBatchResult {
  dateFrom: string;
  dateTo: string;
  totalDays: number;
  results: SyncBatchResult[];
}

export interface SummaryQueryDto {
  dateFrom?: string;
  dateTo?: string;
  lineOaId?: string;
  storeId?: string;
  region?: string;
  province?: string;
  comparisonMode?: "comparable" | "available";
}

export interface BackfillJobResponseDto {
  id: string;
  lineOaId: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "COMPLETED_WITH_ERRORS" | "FAILED";
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
  errorMessage?: string | null;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  createdAt: Date | string;
}

export interface SummaryDailyRow {
  date: string;
  followers: number | null;
  targetedReaches: number | null;
  blocks: number | null;
  dailyIncrease: number | null;
  accountsExpected: number;
  accountsWithData: number;
  accountsReady: number;
  accountsUnready: number;
  accountsMissing: number;
}

export interface ByStoreQueryDto {
  dateFrom?: string;
  dateTo?: string;
  date?: string;
}

export interface ByStoreAccountRow {
  lineOaId: string;
  accountName: string;
  storeId: string;
  masterStoreId?: string | null;
  externalStoreId?: string | null;
  storeName: string;
  date: string;
  followers: number | null;
  previousFollowers: number | null;
  startFollowers: number | null;
  dailyIncrease: number | null;
  periodIncrease: number | null;
  targetedReaches: number | null;
  blocks: number | null;
  status: string;
  fetchedAt: Date | string | null;
}

export interface QueueSummaryDto {
  queued: number;
  running: number;
  completed: number;
  completedWithErrors: number;
  failed: number;
  oldestQueuedAt: Date | null;
  /** Informational: total remaining account-date API calls across all queued jobs */
  estimatedRemainingAccountDateCalls: number | null;
}
