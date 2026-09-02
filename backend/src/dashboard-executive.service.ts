import { Injectable } from "@nestjs/common";
import { LineOaConnectionStatus } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import type { AnalyticsPeriod } from "./dashboard-analytics.service";
import { getPeriodDates } from "./follower-insights/follower-aggregation.helper";
import { formatDbDateToIso, getOffsetBangkokDateString, toUtcDateForDb } from "./follower-insights/date-utils";

export type DashboardWatchIssue = "reach" | "block" | "inactive";
export type DashboardCustomRange = { from: string; to: string };
export type DashboardStoreFilters = {
  tier?: string;
  kpiPlan?: string;
  area?: string;
  bm?: string;
};

export type DashboardStoreHealthRow = {
  storeId: string | null;
  storeMasterId: string;
  storeCode: string | null;
  storeName: string;
  partner: string;
  tier: string | null;
  kpiPlan: string | null;
  area: string | null;
  bm: string | null;
  followers: number;
  start: number;
  growth: number;
  growthPct: number | null;
  reach: number | null;
  reachPct: number | null;
  blocks: number | null;
  blockPct: number | null;
  issues: DashboardWatchIssue[];
  peerRank: number | null;
  peerSize: number;
  peerAverageFollowers: number | null;
  needsAttention: boolean;
  isConnected: boolean;
};

export type DashboardExecutiveHealthResponse = {
  stores: DashboardStoreHealthRow[];
  followerTrend: Array<{ date: string; followers: number }>;
  connectedStoreCount: number;
  totalStoreCount: number;
  scopeStoreCount: number;
  filterOptions: {
    tiers: string[];
    kpiPlans: string[];
    areas: string[];
    bms: string[];
  };
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

export function matchesDashboardStoreFilters(
  row: Pick<DashboardStoreHealthRow, "tier" | "kpiPlan" | "area" | "bm">,
  filters: DashboardStoreFilters,
): boolean {
  if (filters.tier && row.tier !== filters.tier) return false;
  if (filters.kpiPlan && row.kpiPlan !== filters.kpiPlan) return false;
  if (filters.area && row.area !== filters.area) return false;
  if (filters.bm && row.bm !== filters.bm) return false;
  return true;
}

export function attachDashboardPeerMetrics(rows: DashboardStoreHealthRow[]): DashboardStoreHealthRow[] {
  const groups = new Map<string, DashboardStoreHealthRow[]>();
  for (const row of rows) {
    const key = row.kpiPlan ?? "__UNASSIGNED__";
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const peerStats = new Map<string, { rank: number; size: number; average: number }>();
  for (const group of groups.values()) {
    const ranked = [...group].sort((a, b) => b.followers - a.followers || a.storeName.localeCompare(b.storeName));
    const average = ranked.length > 0
      ? Math.round(ranked.reduce((sum, row) => sum + row.followers, 0) / ranked.length)
      : 0;
    ranked.forEach((row, index) => {
      peerStats.set(row.storeMasterId, { rank: index + 1, size: ranked.length, average });
    });
  }

  return rows.map((row) => {
    const peer = peerStats.get(row.storeMasterId);
    return {
      ...row,
      peerRank: peer?.rank ?? null,
      peerSize: peer?.size ?? 0,
      peerAverageFollowers: peer?.average ?? null,
    };
  });
}

function sortedUnique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))]
    .sort((a, b) => a.localeCompare(b));
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
    filters: DashboardStoreFilters = {},
  ): Promise<DashboardExecutiveHealthResponse> {
    const masters = await this.prisma.storeMaster.findMany({
      where: {
        isActive: true,
        dashboardTier: { not: null },
        ...(allowedStoreIds === undefined
          ? {}
          : {
              stores: {
                some: {
                  id: { in: allowedStoreIds },
                  isActive: true,
                  archivedAt: null,
                },
              },
            }),
      },
      select: {
        id: true,
        externalStoreId: true,
        storeName: true,
        dashboardTier: true,
        kpiPlan: true,
        dashboardArea: true,
        bmName: true,
        stores: {
          where: {
            isActive: true,
            archivedAt: null,
            ...(allowedStoreIds === undefined ? {} : { id: { in: allowedStoreIds } }),
          },
          select: {
            id: true,
            lineOfficialAccounts: {
              where: { isActive: true, archivedAt: null },
              select: { id: true, connectionStatus: true },
            },
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { storeName: "asc" },
    });

    const accountToMaster = new Map<string, string>();
    const accountIdsByMaster = new Map<string, string[]>();
    for (const master of masters) {
      const ids: string[] = [];
      for (const store of master.stores) {
        for (const account of store.lineOfficialAccounts) {
          accountToMaster.set(account.id, master.id);
          ids.push(account.id);
        }
      }
      accountIdsByMaster.set(master.id, ids);
    }
    const accountIds = [...accountToMaster.keys()];

    const now = new Date();
    const presetDates = getPeriodDates(period, now);
    const requestedTargetIsoDate = customRange?.to ?? presetDates.targetIsoDate;
    const requestedBaselineIsoDate = customRange
      ? getOffsetBangkokDateString(customRange.from, -1)
      : presetDates.baselineIsoDate;
    const requestedTrendStartIsoDate = customRange?.from ?? (period === "today"
      ? requestedTargetIsoDate
      : period === "7d"
        ? getOffsetBangkokDateString(requestedTargetIsoDate, -6)
        : getOffsetBangkokDateString(requestedTargetIsoDate, -29));

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

    const aggregateByMasterAndDate = (rows: typeof allSnapshots) => {
      const result = new Map<string, Aggregate>();
      for (const snapshot of rows) {
        const masterId = accountToMaster.get(snapshot.lineOaId);
        if (!masterId) continue;
        const key = `${masterId}:${snapshot.snapshotDate.toISOString()}`;
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

    const periodAgg = aggregateByMasterAndDate(allSnapshots);
    const baseRows: DashboardStoreHealthRow[] = masters.map((master) => {
      const target = periodAgg.get(`${master.id}:${targetDate.toISOString()}`) ?? {
        followers: 0,
        reach: 0,
        blocks: 0,
        hasReach: false,
        hasBlocks: false,
      };
      const baseline = periodAgg.get(`${master.id}:${baselineDate.toISOString()}`) ?? {
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
      const issues = getDashboardStoreIssues({ followers: target.followers, reachPct, blockPct });
      const primaryStore = master.stores[0] ?? null;
      const isConnected = master.stores.some((store) =>
        store.lineOfficialAccounts.some((account) =>
          account.connectionStatus === LineOaConnectionStatus.READY ||
          account.connectionStatus === LineOaConnectionStatus.CONNECTED,
        ),
      );

      return {
        storeId: primaryStore?.id ?? null,
        storeMasterId: master.id,
        storeCode: master.externalStoreId,
        storeName: master.storeName,
        partner: extractDashboardPartner(master.storeName),
        tier: master.dashboardTier,
        kpiPlan: master.kpiPlan,
        area: master.dashboardArea,
        bm: master.bmName,
        followers: target.followers,
        start: baseline.followers,
        growth,
        growthPct: hasComparableData ? Math.round((growth / baseline.followers) * 1000) / 10 : null,
        reach: target.hasReach ? target.reach : null,
        reachPct,
        blocks: target.hasBlocks ? target.blocks : null,
        blockPct,
        issues,
        peerRank: null,
        peerSize: 0,
        peerAverageFollowers: null,
        needsAttention: issues.length > 0,
        isConnected,
      };
    });

    const rowsWithPeers = attachDashboardPeerMetrics(baseRows);
    const selectedRows = rowsWithPeers.filter((row) => matchesDashboardStoreFilters(row, filters));
    const selectedMasterIds = new Set(selectedRows.map((row) => row.storeMasterId));
    const selectedAccountIds = accountIds.filter((accountId) => {
      const masterId = accountToMaster.get(accountId);
      return masterId ? selectedMasterIds.has(masterId) : false;
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
      for (const accountId of selectedAccountIds) {
        const list = snapshotsByAccount.get(accountId) ?? [];
        const latest = [...list].reverse().find((snapshot) => formatDbDateToIso(snapshot.snapshotDate) <= trendIso && snapshot.followers !== null);
        if (latest?.followers !== null && latest?.followers !== undefined) followers += latest.followers;
      }
      followerTrend.push({ date: trendIso, followers });
      trendIso = getOffsetBangkokDateString(trendIso, 1);
    }

    return {
      stores: selectedRows,
      followerTrend,
      connectedStoreCount: selectedRows.filter((row) => row.isConnected).length,
      totalStoreCount: selectedRows.length,
      scopeStoreCount: rowsWithPeers.length,
      filterOptions: {
        tiers: sortedUnique(rowsWithPeers.map((row) => row.tier)),
        kpiPlans: sortedUnique(rowsWithPeers.map((row) => row.kpiPlan)),
        areas: sortedUnique(rowsWithPeers.map((row) => row.area)),
        bms: sortedUnique(rowsWithPeers.map((row) => row.bm)),
      },
      effectiveTargetDate: effectiveTargetIsoDate,
      effectiveBaselineDate: effectiveBaselineIsoDate,
    };
  }
}
