import {
  formatDbDateToIso,
  getOffsetBangkokDateString,
  getPreviousBangkokDateString,
  getTodayBangkokDateString,
  toUtcDateForDb,
} from "./date-utils";

export interface FollowerAccountScope {
  id: string;
  name: string;
  storeId?: string | null;
  store?: {
    id: string;
    name: string;
    storeMaster?: {
      externalStoreId?: string | null;
    } | null;
  } | null;
}

export interface FollowerSnapshotRecord {
  lineOaId: string;
  snapshotDate: Date;
  status: string;
  followers: number | null;
  targetedReaches?: number | null;
  blocks?: number | null;
}

export interface FollowerGrowthMetrics {
  totalFriends: number;
  addedToday: number;
  blockedToday: number;
  netToday: number;
  added: number;
  blocked: number;
  net: number;
  period: "today" | "7d" | "30d";
  growthAccountsCompared: number;
  growthAccountsMissingBaseline: number;
  totalEligibleAccounts: number;
}

export interface StoreFollowerRankingItem {
  storeId: string;
  storeName: string;
  followers: number;
}

export interface StoreFollowerRankingResult {
  validStoreFollowers: StoreFollowerRankingItem[];
  top10: StoreFollowerRankingItem[];
  bottom10: StoreFollowerRankingItem[];
  top10Average: number;
  bottom10Average: number;
  ratio: number;
  totalFollowersCount: number;
}

/**
 * Returns the target date and baseline date ISO strings for a given period in Bangkok calendar time.
 */
export function getPeriodDates(period: "today" | "7d" | "30d", referenceDate?: Date): {
  targetIsoDate: string;
  baselineIsoDate: string;
} {
  const targetIsoDate = getTodayBangkokDateString(referenceDate);
  let baselineIsoDate: string;

  if (period === "7d") {
    baselineIsoDate = getOffsetBangkokDateString(targetIsoDate, -7);
  } else if (period === "30d") {
    baselineIsoDate = getOffsetBangkokDateString(targetIsoDate, -30);
  } else {
    // "today"
    baselineIsoDate = getPreviousBangkokDateString(targetIsoDate);
  }

  return { targetIsoDate, baselineIsoDate };
}

/**
 * Pure calculation function for follower growth metrics.
 * Follows Follower Insights calculation semantics:
 * - Only includes an account in growth deltas if BOTH target and baseline snapshots are ready with valid followers.
 * - Missing baseline accounts are excluded from growth deltas (never assumed to be 0).
 * - Total friends is computed as stock from the latest ready snapshot per account.
 */
export function calculateFollowerGrowthMetrics(params: {
  accounts: FollowerAccountScope[];
  targetIsoDate: string;
  baselineIsoDate: string;
  period: "today" | "7d" | "30d";
  snapshots: FollowerSnapshotRecord[];
  latestFollowersPerOa: Map<string, number>;
}): FollowerGrowthMetrics {
  const { accounts, targetIsoDate, baselineIsoDate, period, snapshots, latestFollowersPerOa } = params;

  // Build lookup by date and lineOaId
  const snapByDateAndOa = new Map<string, Map<string, FollowerSnapshotRecord>>();
  for (const s of snapshots) {
    if (s.status !== "ready" || s.followers === null) continue;
    const dStr = formatDbDateToIso(s.snapshotDate);
    let mapForDate = snapByDateAndOa.get(dStr);
    if (!mapForDate) {
      mapForDate = new Map();
      snapByDateAndOa.set(dStr, mapForDate);
    }
    mapForDate.set(s.lineOaId, s);
  }

  const targetSnaps = snapByDateAndOa.get(targetIsoDate) || new Map();
  const baselineSnaps = snapByDateAndOa.get(baselineIsoDate) || new Map();

  let totalAdded = 0;
  let totalBlocked = 0;
  let growthAccountsCompared = 0;
  let growthAccountsMissingBaseline = 0;

  for (const acc of accounts) {
    const cur = targetSnaps.get(acc.id);
    const base = baselineSnaps.get(acc.id);

    if (!cur || cur.followers === null || !base || base.followers === null) {
      growthAccountsMissingBaseline++;
      continue;
    }

    growthAccountsCompared++;
    const fDelta = cur.followers - base.followers;
    totalAdded += fDelta;

    if (typeof cur.blocks === "number" && typeof base.blocks === "number") {
      const bDelta = cur.blocks - base.blocks;
      totalBlocked += bDelta;
    }
  }

  const netGrowth = totalAdded - totalBlocked;

  // Compute Total Friends stock metric from latest ready followers per account
  let totalFriends = 0;
  for (const acc of accounts) {
    const f = latestFollowersPerOa.get(acc.id);
    if (typeof f === "number") {
      totalFriends += f;
    }
  }

  return {
    totalFriends,
    addedToday: totalAdded,
    blockedToday: totalBlocked,
    netToday: netGrowth,
    added: totalAdded,
    blocked: totalBlocked,
    net: netGrowth,
    period,
    growthAccountsCompared,
    growthAccountsMissingBaseline,
    totalEligibleAccounts: accounts.length,
  };
}

/**
 * Pure calculation function for store follower rankings.
 */
export function calculateStoreFollowerRanking(params: {
  accounts: FollowerAccountScope[];
  latestFollowersPerOa: Map<string, number>;
}): StoreFollowerRankingResult {
  const { accounts, latestFollowersPerOa } = params;
  const storeFollowersMap = new Map<string, { storeId: string; storeName: string; followers: number }>();

  for (const oa of accounts) {
    if (oa.store) {
      const followers = latestFollowersPerOa.get(oa.id) ?? 0;
      if (followers > 0) {
        const existing = storeFollowersMap.get(oa.store.id) ?? {
          storeId: oa.store.id,
          storeName: oa.store.name,
          followers: 0,
        };
        existing.followers += followers;
        storeFollowersMap.set(oa.store.id, existing);
      }
    }
  }

  const validStoreFollowers = Array.from(storeFollowersMap.values())
    .filter((s) => s.followers > 0)
    .sort((a, b) => b.followers - a.followers);

  const top10 = validStoreFollowers.slice(0, 10);
  const bottom10 = [...validStoreFollowers].reverse().slice(0, 10).sort((a, b) => b.followers - a.followers);

  const top10Average = top10.length > 0 ? Math.round(top10.reduce((s, x) => s + x.followers, 0) / top10.length) : 0;
  const bottom10Average = bottom10.length > 0 ? Math.round(bottom10.reduce((s, x) => s + x.followers, 0) / bottom10.length) : 0;
  const ratio = bottom10Average > 0 ? +(top10Average / bottom10Average).toFixed(1) : 0;
  const totalFollowersCount = validStoreFollowers.reduce((s, x) => s + x.followers, 0);

  return {
    validStoreFollowers,
    top10,
    bottom10,
    top10Average,
    bottom10Average,
    ratio,
    totalFollowersCount,
  };
}
