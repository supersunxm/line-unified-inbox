/**
 * Read-only adapter over the existing month-scoped chat summary.
 * The caller MUST authorize both LINE sender and group before invoking.
 * Scope is explicit; null (global access) and undefined are forbidden here.
 */
export type StoreMonthlyRow = {
  storeId: string;
  storeName: string;
  total: number;
  notReplied: number;
};
export type MonthlySummary = {
  overview: { total: number; notReplied: number };
  stores: StoreMonthlyRow[];
  dataQuality: {
    sourceConversationCount: number;
    rowBudgetExceeded: boolean;
    unmappedStoreConversationCount: number;
    lineOaStoreIdentityMismatchCount: number;
    inactiveLineOaConversationCount: number;
    replyProjectionConversationCount: number;
    replyProjectionMissingCount: number;
    replyProjectionStaleCount: number;
    replyProjectionUnknownVersionCount: number;
  };
};
export type SecretaryMonthlyDataQuality = {
  status: "VERIFIED_OPERATIONAL_SNAPSHOT";
  timezone: "Asia/Bangkok";
  operationalCoverageStartMonth: "2026-09";
  sourceDataAsOf: string;
  mirrorFreshnessWindowHours: 2;
  replyProjection: "CURRENT_FOR_ALL_RETURNED_CONVERSATIONS";
  historicalMessageCompleteness: "NOT_CERTIFIED_BY_RECENT_MIRROR_SYNC";
};
export type SecretaryMonthlyAnswer = {
  month: string;
  totalUnansweredConversations: number;
  storesWithUnanswered: number;
  stores: StoreMonthlyRow[];
  calculatedAt: string;
  source: "bm-reply-status-summary";
  dataQuality: SecretaryMonthlyDataQuality | null;
};

const MONTH = /^20\d{2}-(0[1-9]|1[0-2])$/u;
const NONNEGATIVE_INTEGER = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/**
 * Does not use AI to compute totals. Rejects even small reconciliation differences.
 * The synthetic focus-seven-store-group_ID summary is excluded to avoid double counting.
 */
export function normalizeMonthlyReplySummary(
  month: string,
  summary: MonthlySummary,
  now: Date,
  dataQuality: SecretaryMonthlyDataQuality | null = null,
): SecretaryMonthlyAnswer {
  if (!MONTH.test(month) || !Number.isFinite(now.getTime())) throw new Error("Invalid month or as-of date");
  if (!summary || !Array.isArray(summary.stores) || !NONNEGATIVE_INTEGER(summary.overview?.total) ||
      !NONNEGATIVE_INTEGER(summary.overview?.notReplied) || !summary.dataQuality ||
      !NONNEGATIVE_INTEGER(summary.dataQuality.sourceConversationCount) ||
      typeof summary.dataQuality.rowBudgetExceeded !== "boolean" ||
      !NONNEGATIVE_INTEGER(summary.dataQuality.unmappedStoreConversationCount) ||
      !NONNEGATIVE_INTEGER(summary.dataQuality.lineOaStoreIdentityMismatchCount) ||
      !NONNEGATIVE_INTEGER(summary.dataQuality.inactiveLineOaConversationCount) ||
      !NONNEGATIVE_INTEGER(summary.dataQuality.replyProjectionConversationCount) ||
      !NONNEGATIVE_INTEGER(summary.dataQuality.replyProjectionMissingCount) ||
      !NONNEGATIVE_INTEGER(summary.dataQuality.replyProjectionStaleCount) ||
      !NONNEGATIVE_INTEGER(summary.dataQuality.replyProjectionUnknownVersionCount)) {
    throw new Error("Unverifiable monthly reply summary");
  }
  if (summary.dataQuality.rowBudgetExceeded || summary.dataQuality.sourceConversationCount !== summary.overview.total ||
      summary.dataQuality.unmappedStoreConversationCount !== 0 ||
      summary.dataQuality.lineOaStoreIdentityMismatchCount !== 0 ||
      summary.dataQuality.inactiveLineOaConversationCount !== 0 ||
      summary.dataQuality.replyProjectionConversationCount !== summary.overview.total ||
      summary.dataQuality.replyProjectionMissingCount !== 0 || summary.dataQuality.replyProjectionStaleCount !== 0 ||
      summary.dataQuality.replyProjectionUnknownVersionCount !== 0) {
    throw new Error("Monthly source completeness or reply-state freshness is unverified");
  }
  const seen = new Set<string>();
  const stores: StoreMonthlyRow[] = [];
  let focusRow: StoreMonthlyRow | undefined;
  for (const row of summary.stores) {
    if (row.storeId === "focus-seven-store-group") {
      if (focusRow || !row.storeName || !NONNEGATIVE_INTEGER(row.total) || !NONNEGATIVE_INTEGER(row.notReplied)) {
        throw new Error("Unverifiable synthetic focus-store summary");
      }
      focusRow = row;
      continue;
    }
    if (!row.storeId || !row.storeName || seen.has(row.storeId) || !NONNEGATIVE_INTEGER(row.total) ||
        !NONNEGATIVE_INTEGER(row.notReplied) || row.notReplied > row.total) {
      throw new Error("Unverifiable store-level reply summary");
    }
    seen.add(row.storeId);
    stores.push({ storeId: row.storeId, storeName: row.storeName, total: row.total, notReplied: row.notReplied });
  }
  const sourceTotal = stores.reduce((sum, row) => sum + row.total, 0);
  const total = stores.reduce((sum, row) => sum + row.notReplied, 0);
  if (!Number.isSafeInteger(sourceTotal) || sourceTotal !== summary.overview.total ||
      !Number.isSafeInteger(total) || total !== summary.overview.notReplied ||
      (focusRow && (focusRow.total !== sourceTotal || focusRow.notReplied !== total))) {
    throw new Error("Monthly reply totals are inconsistent; do not disclose a guessed total");
  }
  stores.sort((a, b) => b.notReplied - a.notReplied || a.storeName.localeCompare(b.storeName, "th"));
  return {
    month,
    totalUnansweredConversations: total,
    storesWithUnanswered: stores.filter((row) => row.notReplied > 0).length,
    stores: stores.filter((row) => row.notReplied > 0),
    calculatedAt: now.toISOString(),
    source: "bm-reply-status-summary",
    dataQuality,
  };
}

export async function fetchSecretaryMonthlyAnswer(
  month: string,
  allowedStoreIds: readonly string[],
  load: (storeIds: string[], month: string) => Promise<MonthlySummary>,
  now: Date = new Date(),
  dataQuality: SecretaryMonthlyDataQuality | null = null,
): Promise<SecretaryMonthlyAnswer> {
  const candidateIds: unknown = allowedStoreIds;
  if (!MONTH.test(month) || !Array.isArray(candidateIds) || candidateIds.length === 0 ||
      candidateIds.some((id: unknown) => typeof id !== "string" || !id.trim())) {
    throw new Error("Authorized explicit nonempty store scope required");
  }
  const validatedIds: string[] = candidateIds.filter((id: unknown): id is string => typeof id === "string");
  const scopedIds = [...new Set(validatedIds)];
  return normalizeMonthlyReplySummary(month, await load(scopedIds, month), now, dataQuality);
}
