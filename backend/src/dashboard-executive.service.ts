import { Injectable } from "@nestjs/common";
import { LineOaConnectionStatus } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import type { AnalyticsPeriod } from "./dashboard-analytics.service";
import { getPeriodDates } from "./follower-insights/follower-aggregation.helper";
import { formatDbDateToIso, getOffsetBangkokDateString, toUtcDateForDb } from "./follower-insights/date-utils";

export type DashboardWatchIssue = "reach" | "block" | "inactive";
export type DashboardCustomRange = { from: string; to: string };

export type DashboardStoreHealthRow = {
  storeId: string;
  storeName: string;
  partner: string;
  followers: number;
  start: number;
  growth: number;
  growthPct: number | null;
  reach: number | null;
  reachPct: number | null;
  blocks: number | null;
  blockPct: number | null;
  issues: DashboardWatchIssue[];
};

export type DashboardExecutiveHealthResponse = {
  stores: DashboardStoreHealthRow[];
  followerTrend: Array<{ date: string; followers: number }>;
  connectedStoreCount: number;
  totalStoreCount: number;
  effectiveTargetDate?: string;
  effectiveBaselineDate?: string;
};

export function extractDashboardPartner(storeName: string): string {
  const match = storeName.match(/By\s+(.+)$/i);
  return match ? match[1].trim() : "ไม่ระบุ";
}

export function calcDashboardPercent(value: number | null, total: number): number | null {
  if (value === null || total <= 0) return null;
  return Math.round((value / total) * 1000) / 10;
}

export function getDashboardStoreIssues(input: {
  followers: number;
  reachPct: number | null;
  blockPct: number | null;
}): DashboardWatchIssue[] {
  const issues: DashboardWatchIssue[] = [];
  if (input.followers < 10) issues.push("inactive");
  if (input.reachPct !== null && input.reachPct < 80) issues.push("reach");
  if (input.blockPct !== null && input.blockPct > 10) issues.push("block");
  return issues;
}

function toBangkokDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function pickReliableDate(
  snapshots: Array<{ lineOaId: string; snapshotDate: Date; followers: number | null }>,
  requestedIsoDate: string,
): string {
  const eligible = snapshots.filter((snapshot) => formatDbDateToIso(snapshot.snapshotDate) <= requestedIsoDate && snapshot.followers !== null);
  if (eligible.length === 0) return requestedIsoDate;

  const coverage = new Map<string, Set<string>>();
  for (const snapshot of eligible) {
    const iso = formatDbDateToIso(snapshot.snapshotDate);
    const set = coverage.get(iso) ?? new Set<string>();
    set.add(snapshot.lineOaId);
    coverage.set(iso, set);
  }
  const maxCoverage = Math.max(...[...coverage.values()].map((set) => set.size));
  return [...coverage.entries()]
    .filter(([, set]) => set.size === maxCoverage)
    .map(([iso]) => iso)
    .sort()
    .at(-1) ?? requestedIsoDate;
}

@Injectable()
export class DashboardExecutiveService {
  constructor(private readonly prisma: PrismaService) {}

  async getStoreHealth(
    period: AnalyticsPeriod,
    allowedStoreIds?: string[],
    customRange?: DashboardCustomRange,
  ): Promise<DashboardExecutiveHealthResponse> {
    const stores = await this.prisma.store.findMany({
      where: {
        isActive: true,
        archivedAt: null,
        ...(allowedStoreIds === undefined ? {} : { id: { in: allowedStoreIds } }),
      },
      select: {
        id: true,
        name: true,
        lineOfficialAccounts: {
          where: { isActive: true, archivedAt: null },
          select: { id: true, connectionStatus: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const accountToStore = new Map<string, { storeId: string; storeName: string }>();
    for (const store of stores) {
      for (const account of store.lineOfficialAccounts) {
        accountToStore.set(account.id, { storeId: store.id, storeName: store.name });
      }
    }
    const accountIds = [...accountToStore.keys()];
    const now = new Date();
    const presetDates = getPeriodDates(period, now);
    const requestedTargetIsoDate = customRange?.to ?? presetDates.targetIsoDate;
    const requestedBaselineIsoDate = customRange
      ? getOffsetBangkokDateString(customRange.from, -1)
      : presetDates.baselineIsoDate;
    const requestedTrendStartIsoDate = customRange?.from ?? (period === "today" ? requestedTargetIsoDate : period === "7d" ? getOffsetBangkokDateString(requestedTargetIsoDate, -6) : getOffsetBangkokDateString(requestedTargetIsoDate, -29));

    const lookupStartIso = getOffsetBangkokDateString(requestedBaselineIsoDate, -14);
    const lookupStartDate = toUtcDateForDb(lookupStartIso);
    const requestedTargetDate = toUtcDateForDb(requestedTargetIsoDate);

    const allSnapshots = accountIds.length > 0
      ? await this.prisma.lineOaFollowerSnapshot.findMany({
          where: {
            lineOaId: { in: accountIds },
            status: "ready",
            snapshotDate: { gte: lookupStartDate, lte: requestedTargetDate },
          },
          select: {
            lineOaId: true,
            snapshotDate: true,
            followers: true,
            targetedReaches: true,
            blocks: true,
          },
          orderBy: { snapshotDate: "asc" },
        })
      : [];

    const effectiveTargetIsoDate = pickReliableDate(allSnapshots, requestedTargetIsoDate);
    const effectiveBaselineIsoDate = pickReliableDate(allSnapshots, requestedBaselineIsoDate);
    const targetDate = toUtcDateForDb(effectiveTargetIsoDate);
    const baselineDate = toUtcDateForDb(effectiveBaselineIsoDate);

    type Aggregate = {
      followers: number;
      reach: number;
      blocks: number;
      hasReach: boolean;
      hasBlocks: boolean;
    };

    const aggregateByStoreAndDate = (rows: typeof allSnapshots) => {
      const result = new Map<string, Aggregate>();
      for (const snapshot of rows) {
        const owner = accountToStore.get(snapshot.lineOaId);
        if (!owner) continue;
        const key = `${owner.storeId}:${snapshot.snapshotDate.toISOString()}`;
        const current = result.get(key) ?? {
          followers: 0,
          reach: 0,
          blocks: 0,
          hasReach: false,
          hasBlocks: false,
        };
        current.followers += snapshot.followers ?? 0;
        if (typeof snapshot.targetedReaches === "number") {
          current.reach += snapshot.targetedReaches;
          current.hasReach = true;
        }
        if (typeof snapshot.blocks === "number") {
          current.blocks += snapshot.blocks;
          current.hasBlocks = true;
        }
        result.set(key, current);
      }
      return result;
    };

    const periodAgg = aggregateByStoreAndDate(allSnapshots);
    const rows: DashboardStoreHealthRow[] = stores.map((store) => {
      const target = periodAgg.get(`${store.id}:${targetDate.toISOString()}`) ?? {
        followers: 0,
        reach: 0,
        blocks: 0,
        hasReach: false,
        hasBlocks: false,
      };
      const baseline = periodAgg.get(`${store.id}:${baselineDate.toISOString()}`) ?? {
        followers: 0,
        reach: 0,
        blocks: 0,
        hasReach: false,
        hasBlocks: false,
      };
      const hasComparableData = target.followers > 0 && baseline.followers > 0;
      const growth = hasComparableData ? target.followers - baseline.followers : 0;
      const reachPct = calcDashboardPercent(target.hasReach ? target.reach : null, target.followers);
      const blockPct = calcDashboardPercent(target.hasBlocks ? target.blocks : null, target.followers);
      return {
        storeId: store.id,
        storeName: store.name,
        partner: extractDashboardPartner(store.name),
        followers: target.followers,
        start: baseline.followers,
        growth,
        growthPct: hasComparableData ? Math.round((growth / baseline.followers) * 1000) / 10 : null,
        reach: target.hasReach ? target.reach : null,
        reachPct,
        blocks: target.hasBlocks ? target.blocks : null,
        blockPct,
        issues: getDashboardStoreIssues({ followers: target.followers, reachPct, blockPct }),
      };
    });

    const snapshotsByAccount = new Map<string, typeof allSnapshots>();
    for (const snapshot of allSnapshots) {
      const list = snapshotsByAccount.get(snapshot.lineOaId) ?? [];
      list.push(snapshot);
      snapshotsByAccount.set(snapshot.lineOaId, list);
    }

    const followerTrend: Array<{ date: string; followers: number }> = [];
    let trendIso = requestedTrendStartIsoDate;
    while (trendIso <= effectiveTargetIsoDate) {
      let followers = 0;
      for (const accountId of accountIds) {
        const list = snapshotsByAccount.get(accountId) ?? [];
        const latest = [...list].reverse().find((snapshot) => formatDbDateToIso(snapshot.snapshotDate) <= trendIso && snapshot.followers !== null);
        if (latest?.followers !== null && latest?.followers !== undefined) followers += latest.followers;
      }
      followerTrend.push({ date: trendIso, followers });
      trendIso = getOffsetBangkokDateString(trendIso, 1);
    }

    const connectedStoreCount = stores.filter((store) =>
      store.lineOfficialAccounts.some((account) =>
        account.connectionStatus === LineOaConnectionStatus.READY ||
        account.connectionStatus === LineOaConnectionStatus.CONNECTED,
      ),
    ).length;

    return {
      stores: rows,
      followerTrend,
      connectedStoreCount,
      totalStoreCount: stores.length,
      effectiveTargetDate: effectiveTargetIsoDate,
      effectiveBaselineDate: effectiveBaselineIsoDate,
    };
  }
}