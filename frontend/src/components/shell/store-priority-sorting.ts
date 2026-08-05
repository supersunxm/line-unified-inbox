// Sort stores by operational priority.
// Stores with highest unanswered customer conversations
// must appear first because they require immediate action.
export function sortStoresByPriority<T extends { id: string; name: string }>(
  stores: T[],
  storeBmCounts: Record<string, { notReplied: number; notifiedBm: number; replied: number }>,
  getStoreDisplayName: (name: string) => string = (name) => name,
): T[] {
  return [...stores].sort((a, b) => {
    const aCounts = storeBmCounts[a.id] ?? { notReplied: 0, notifiedBm: 0, replied: 0 };
    const bCounts = storeBmCounts[b.id] ?? { notReplied: 0, notifiedBm: 0, replied: 0 };

    if (aCounts.notReplied !== bCounts.notReplied) {
      return bCounts.notReplied - aCounts.notReplied;
    }
    if (aCounts.notifiedBm !== bCounts.notifiedBm) {
      return bCounts.notifiedBm - aCounts.notifiedBm;
    }
    if (aCounts.replied !== bCounts.replied) {
      return bCounts.replied - aCounts.replied;
    }
    return getStoreDisplayName(a.name).localeCompare(getStoreDisplayName(b.name));
  });
}
