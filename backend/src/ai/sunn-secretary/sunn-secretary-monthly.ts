/**
 * Read-only adapter over the existing month-scoped chat summary.
 * The caller MUST authorize both LINE sender and group before invoking.
 * Scope is explicit; null (global access) and undefined are forbidden here.
 */
export type StoreMonthlyRow = {
  storeId: string;
  storeName: string;
  notReplied: number;
};
export type MonthlySummary = {
  overview: { notReplied: number };
  stores: StoreMonthlyRow[];
};
export type SecretaryMonthlyAnswer = {
  month: string;
  totalUnansweredConversations: number;
  storesWithUnanswered: number;
  stores: StoreMonthlyRow[];
  calculatedAt: string;
  source: "bm-reply-status-summary";
};

const MONTH = /^20\d{2}-(0[1-9]|1[0-2])$/u;
const NONNEGATIVE_INTEGER = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/**
 * Does not use AI to compute totals. Rejects even small reconciliation differences.
 * The synthetic focus-seven-store-group_ID summary is excluded to avoid double counting.
 */
export function normalizeMonthlyReplySummary(month: string, summary: MonthlySummary, now: Date): SecretaryMonthlyAnswer {
  if (!MONTH.test(month) || !Number.isFinite(now.getTime())) throw new Error("Invalid month or as-of date");
  if (!summary || !Array.isArray(summary.stores) || !NONNEGATIVE_INTEGER(summary.overview?.notReplied)) {
    throw new Error("Unverifiable monthly reply summary");
  }
  const seen = new Set<string>();
  const stores: StoreMonthlyRow[] = [];
  for (const row of summary.stores) {
    if (row.storeId === "focus-seven-store-group") continue;
    if (!row.storeId || !row.storeName || seen.has(row.storeId) || !NONNEGATIVE_INTEGER(row.notReplied)) {
      throw new Error("Unverifiable store-level reply summary");
    }
    seen.add(row.storeId);
    stores.push({ storeId: row.storeId, storeName: row.storeName, notReplied: row.notReplied });
  }
  const total = stores.reduce((sum, row) => sum + row.notReplied, 0);
  if (!Number.isSafeInteger(total) || total !== summary.overview.notReplied) {
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
  };
}

export async function fetchSecretaryMonthlyAnswer(
  month: string,
  allowedStoreIds: readonly string[],
  load: (storeIds: string[], month: string) => Promise<MonthlySummary>,
  now: Date = new Date(),
): Promise<SecretaryMonthlyAnswer> {
  if (!MONTH.test(month) || !Array.isArray(allowedStoreIds) || allowedStoreIds.length === 0 ||
      allowedStoreIds.some((id) => typeof id !== "string" || !id.trim())) {
    throw new Error("Authorized explicit nonempty store scope required");
  }
  const scopedIds = [...new Set(allowedStoreIds)];
  return normalizeMonthlyReplySummary(month, await load(scopedIds, month), now);
}
