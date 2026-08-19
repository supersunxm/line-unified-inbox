import { Injectable } from "@nestjs/common";
import { LineOaConnectionStatus } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import type { AnalyticsPeriod } from "./dashboard-analytics.service";
import { getPeriodDates } from "./follower-insights/follower-aggregation.helper";
import { toUtcDateForDb } from "./follower-insights/date-utils";

export type DashboardWatchIssue = "reach" | "block" | "inactive";

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

@Injectable()
export class DashboardExecutiveService {
  constructor(private readonly prisma: PrismaService) {}

  async getStoreHealth(
    period: AnalyticsPeriod,
    allowedStoreIds?: string[],
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
    const { targetIsoDate, baselineIsoDate } = getPeriodDates(period, now);
    const targetDate = toUtcDateForDb(targetIsoDate);
    const baselineDate = toUtcDateForDb(baselineIsoDate);

    const recentStart = new Date(targetDate);
    recentStart.setUTCDate(recentStart.getUTCDate() - 6);

    const snapshots = accountIds.length > 0
      ? await this.prisma.lineOaFollowerSnapshot.findMany({
          where: {
            lineOaId: { in: accountIds },
            status: "ready",
            snapshotDate: { gte: recentStart, lte: targetDate },
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

    const periodSnapshots = accountIds.length > 0
      ? await this.prisma.lineOaFollowerSnapshot.findMany({
          where: {
            lineOaId: { in: accountIds },
            status: "ready",
            snapshotDate: { in: [targetDate, baselineDate] },
          },
          select: {
            lineOaId: true,
            snapshotDate: true,
            followers: true,
            targetedReaches: true,
            blocks: true,
          },
        })
      : [];

    type Aggregate = {
      followers: number;
      reach: number;
      blocks: number;
      hasReach: boolean;
      hasBlocks: boolean;
    };

    const aggregateByStoreAndDate = (rows: typeof periodSnapshots) => {
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

    const periodAgg = aggregateByStoreAndDate(periodSnapshots);
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
      const growth = target.followers - baseline.followers;
      const reachPct = calcDashboardPercent(target.hasReach ? target.reach : null, target.followers);
      const blockPct = calcDashboardPercent(target.hasBlocks ? target.blocks : null, target.followers);
      return {
        storeId: store.id,
        storeName: store.name,
        partner: extractDashboardPartner(store.name),
        followers: target.followers,
        start: baseline.followers,
        growth,
        growthPct: baseline.followers > 0 ? Math.round((growth / baseline.followers) * 1000) / 10 : null,
        reach: target.hasReach ? target.reach : null,
        reachPct,
        blocks: target.hasBlocks ? target.blocks : null,
        blockPct,
        issues: getDashboardStoreIssues({ followers: target.followers, reachPct, blockPct }),
      };
    });

    const recentByDateAndStore = aggregateByStoreAndDate(snapshots);
    const followerTrend: Array<{ date: string; followers: number }> = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date(targetDate);
      day.setUTCDate(day.getUTCDate() - offset);
      let followers = 0;
      for (const store of stores) {
        followers += recentByDateAndStore.get(`${store.id}:${day.toISOString()}`)?.followers ?? 0;
      }
      followerTrend.push({ date: toBangkokDateString(day), followers });
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
    };
  }
}
