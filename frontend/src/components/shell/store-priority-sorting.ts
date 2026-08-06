import { sortStoresBySlaPriority, type StoreBmCountsItem } from "./store-priority-score.ts";

// Sort stores by operational priority and SLA aging urgency.
// Stores with oldest unanswered customer conversations must appear first
// because they require immediate SLA action.
export function sortStoresByPriority<T extends { id: string; name: string }>(
  stores: T[],
  storeBmCounts: Record<string, StoreBmCountsItem>,
  getStoreDisplayName: (name: string) => string = (name) => name,
): T[] {
  return sortStoresBySlaPriority(stores, storeBmCounts, getStoreDisplayName);
}
