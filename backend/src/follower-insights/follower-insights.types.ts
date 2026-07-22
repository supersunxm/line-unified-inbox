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
  lineOaIds?: string[];
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
