export interface StoreBmCountsItem {
  notReplied: number;
  notifiedBm: number;
  replied: number;
  oldestWaitingMinutes?: number;
}

// Format waiting minutes into human-readable duration (e.g. 15m, 2h 15m, 1d 3h).
export function formatWaitingDuration(minutes: number, language: "th" | "en" | "zh" = "th"): string {
  if (!minutes || minutes <= 0) return "";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  if (language === "th") {
    if (days > 0) return hours > 0 ? `${days}วัน ${hours}ชม.` : `${days}วัน`;
    if (hours > 0) return mins > 0 ? `${hours}ชม. ${mins}นาที` : `${hours}ชม.`;
    return `${mins}นาที`;
  }
  if (language === "zh") {
    if (days > 0) return hours > 0 ? `${days}天 ${hours}小时` : `${days}天`;
    if (hours > 0) return mins > 0 ? `${hours}小时 ${mins}分` : `${hours}小时`;
    return `${mins}分`;
  }

  // English
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return `${mins}m`;
}

// Get SLA risk color variant for store waiting time:
// < 30 min   -> normal (neutral / slate)
// 30-120 min -> warning (amber / yellow)
// > 120 min  -> danger (red / orange)
export function getSlaRiskVariant(minutes: number): "normal" | "warning" | "danger" {
  if (!minutes || minutes < 30) return "normal";
  if (minutes <= 120) return "warning";
  return "danger";
}

// SLA urgency multiplier based on oldest unanswered waiting time.
//
// The multiplier amplifies the notReplied count by how severe the SLA breach is,
// so volume × urgency drives priority rather than raw age alone.
//
// Thresholds:
//   0 –  29 min  → ×1   (pre-SLA, low urgency)
//  30 –  59 min  → ×2   (approaching SLA)
//  60 – 119 min  → ×4   (at SLA threshold)
// 120 – 239 min  → ×8   (clear breach, escalate)
// 240+      min  → ×16  (severe breach, max priority)
export function getSlaMultiplier(minutes: number): number {
  if (!minutes || minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 4;
  if (minutes < 240) return 8;
  return 16;
}

// Calculate store priority score and sort stores by operational SLA urgency.
//
// priorityScore = notReplied × getSlaMultiplier(oldestWaitingMinutes)
//
// This combines volume (how many customers are waiting) with urgency (how long
// the oldest customer has been waiting) so that 50 chats at 2h beats 1 chat at 10h.
//
// Rule 1: priorityScore DESC           — combined impact signal
// Rule 2: oldestWaitingMinutes DESC    — tie-break: older breach surfaces first
// Rule 3: notReplied DESC              — tie-break: higher volume
// Rule 4: notifiedBm DESC             — tie-break: already-flagged stores
// Rule 5: Alphabetical store name ASC — final stable tie-break
export function sortStoresBySlaPriority<T extends { id: string; name: string }>(
  stores: T[],
  storeBmCounts: Record<string, StoreBmCountsItem>,
  getStoreDisplayName: (name: string) => string = (name) => name,
): T[] {
  return [...stores].sort((a, b) => {
    const aCounts = storeBmCounts[a.id] ?? { notReplied: 0, notifiedBm: 0, replied: 0, oldestWaitingMinutes: 0 };
    const bCounts = storeBmCounts[b.id] ?? { notReplied: 0, notifiedBm: 0, replied: 0, oldestWaitingMinutes: 0 };

    // Only count waiting time when there are unanswered chats.
    const aWaiting = aCounts.notReplied > 0 ? (aCounts.oldestWaitingMinutes ?? 0) : 0;
    const bWaiting = bCounts.notReplied > 0 ? (bCounts.oldestWaitingMinutes ?? 0) : 0;

    // Rule 1: Priority score (notReplied × urgency multiplier) DESC
    const aScore = aCounts.notReplied * getSlaMultiplier(aWaiting);
    const bScore = bCounts.notReplied * getSlaMultiplier(bWaiting);
    if (aScore !== bScore) return bScore - aScore;

    // Rule 2: Oldest waiting time DESC
    if (aWaiting !== bWaiting) return bWaiting - aWaiting;

    // Rule 3: Number of unanswered conversations DESC
    if (aCounts.notReplied !== bCounts.notReplied) return bCounts.notReplied - aCounts.notReplied;

    // Rule 4: Number of notified BM DESC
    if (aCounts.notifiedBm !== bCounts.notifiedBm) return bCounts.notifiedBm - aCounts.notifiedBm;

    // Rule 5: Alphabetical ASC
    return getStoreDisplayName(a.name).localeCompare(getStoreDisplayName(b.name));
  });
}
