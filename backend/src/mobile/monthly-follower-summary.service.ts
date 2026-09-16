import { BadRequestException, Injectable } from "@nestjs/common";
import type { AuthUser } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import {
  formatDbDateToIso,
  getOffsetBangkokDateString,
  getTodayBangkokDateString,
  toUtcDateForDb,
} from "../follower-insights/date-utils";
import { PrismaService } from "../prisma.service";

export type MonthlyFollowerSummary = {
  available: boolean;
  reason: "no_store_line_oa" | "no_follower_snapshots" | "no_target_snapshot" | null;
  totalFollowers: number | null;
  monthlyGrowth: number | null;
  growthRate: number | null;
  targetedReaches: number | null;
  blocks: number | null;
  asOfDate: string | null;
  baselineDate: string | null;
  accountsExpected: number;
  accountsWithData: number;
  accountsCompared: number;
  coverageRate: number;
};

type SnapshotForSummary = {
  lineOaId: string;
  snapshotDate: Date;
  followers: number | null;
  targetedReaches: number | null;
  blocks: number | null;
};

function monthParts(month: string): { year: number; monthNumber: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new BadRequestException("month must use YYYY-MM format");
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) {
    throw new BadRequestException("month must use YYYY-MM format");
  }
  return { year, monthNumber };
}

function isoDate(year: number, monthNumber: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${monthNumber.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function lastDateOfMonth(year: number, monthNumber: number): string {
  const value = new Date(Date.UTC(year, monthNumber, 0));
  return isoDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

/**
 * Pick the latest date with the best account coverage. This mirrors the
 * follower dashboard's reliability rule while allowing a lower bound so a
 * monthly card never silently falls back to a previous month's stock value.
 */
export function pickReliableFollowerDate(
  snapshots: Array<Pick<SnapshotForSummary, "lineOaId" | "snapshotDate" | "followers">>,
  requestedIsoDate: string,
  minimumIsoDate?: string,
): string | null {
  const coverage = new Map<string, Set<string>>();
  for (const snapshot of snapshots) {
    if (snapshot.followers === null) continue;
    const date = formatDbDateToIso(snapshot.snapshotDate);
    if (date > requestedIsoDate) continue;
    if (minimumIsoDate && date < minimumIsoDate) continue;
    const accounts = coverage.get(date) ?? new Set<string>();
    accounts.add(snapshot.lineOaId);
    coverage.set(date, accounts);
  }
  if (coverage.size === 0) return null;
  const maxCoverage = Math.max(...[...coverage.values()].map((accounts) => accounts.size));
  return [...coverage.entries()]
    .filter(([, accounts]) => accounts.size === maxCoverage)
    .map(([date]) => date)
    .sort()
    .at(-1) ?? null;
}

@Injectable()
export class MonthlyFollowerSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeAccess: StoreAccessService,
  ) {}

  async get(user: AuthUser, requestedMonth?: string, now = new Date()): Promise<MonthlyFollowerSummary> {
    const todayIso = getTodayBangkokDateString(now);
    const currentMonth = todayIso.slice(0, 7);
    const month = requestedMonth ?? currentMonth;
    const { year, monthNumber } = monthParts(month);
    if (month > currentMonth) throw new BadRequestException("Future months are not available");

    const monthStartIso = isoDate(year, monthNumber, 1);
    const requestedTargetIso = month === currentMonth
      ? todayIso
      : lastDateOfMonth(year, monthNumber);
    const requestedBaselineIso = getOffsetBangkokDateString(monthStartIso, -1);
    const baselineLookupStartIso = getOffsetBangkokDateString(requestedBaselineIso, -14);

    const accessibleStoreIds = await this.storeAccess.accessibleStoreIds(user);
    const accounts = await this.prisma.lineOfficialAccount.findMany({
      where: {
        accountType: "STORE",
        storeId: accessibleStoreIds === null ? { not: null } : { in: accessibleStoreIds },
        isActive: true,
        archivedAt: null,
        store: { isActive: true, archivedAt: null },
      },
      select: { id: true },
      orderBy: { id: "asc" },
    });

    if (accounts.length === 0) {
      return {
        available: false,
        reason: "no_store_line_oa",
        totalFollowers: null,
        monthlyGrowth: null,
        growthRate: null,
        targetedReaches: null,
        blocks: null,
        asOfDate: null,
        baselineDate: null,
        accountsExpected: 0,
        accountsWithData: 0,
        accountsCompared: 0,
        coverageRate: 0,
      };
    }

    const accountIds = accounts.map((account) => account.id);
    const snapshots = await this.prisma.lineOaFollowerSnapshot.findMany({
      where: {
        lineOaId: { in: accountIds },
        status: "ready",
        followers: { not: null },
        snapshotDate: {
          gte: toUtcDateForDb(baselineLookupStartIso),
          lte: toUtcDateForDb(requestedTargetIso),
        },
      },
      select: {
        lineOaId: true,
        snapshotDate: true,
        followers: true,
        targetedReaches: true,
        blocks: true,
      },
      orderBy: [{ snapshotDate: "asc" }, { lineOaId: "asc" }],
    });

    if (snapshots.length === 0) {
      return {
        available: false,
        reason: "no_follower_snapshots",
        totalFollowers: null,
        monthlyGrowth: null,
        growthRate: null,
        targetedReaches: null,
        blocks: null,
        asOfDate: null,
        baselineDate: null,
        accountsExpected: accounts.length,
        accountsWithData: 0,
        accountsCompared: 0,
        coverageRate: 0,
      };
    }

    const targetIso = pickReliableFollowerDate(snapshots, requestedTargetIso, monthStartIso);
    const baselineIso = pickReliableFollowerDate(snapshots, requestedBaselineIso, baselineLookupStartIso);
    if (!targetIso) {
      return {
        available: false,
        reason: "no_target_snapshot",
        totalFollowers: null,
        monthlyGrowth: null,
        growthRate: null,
        targetedReaches: null,
        blocks: null,
        asOfDate: null,
        baselineDate: baselineIso,
        accountsExpected: accounts.length,
        accountsWithData: 0,
        accountsCompared: 0,
        coverageRate: 0,
      };
    }

    const targetByAccount = new Map<string, SnapshotForSummary>();
    const baselineByAccount = new Map<string, SnapshotForSummary>();
    for (const snapshot of snapshots) {
      const date = formatDbDateToIso(snapshot.snapshotDate);
      if (date === targetIso && snapshot.followers !== null) {
        targetByAccount.set(snapshot.lineOaId, snapshot);
      }
      if (baselineIso && date === baselineIso && snapshot.followers !== null) {
        baselineByAccount.set(snapshot.lineOaId, snapshot);
      }
    }

    const targetRows = [...targetByAccount.values()];
    const totalFollowers = targetRows.reduce((sum, snapshot) => sum + (snapshot.followers ?? 0), 0);
    const reachRows = targetRows.filter((snapshot) => typeof snapshot.targetedReaches === "number");
    const blockRows = targetRows.filter((snapshot) => typeof snapshot.blocks === "number");
    const targetedReaches = reachRows.length === 0
      ? null
      : reachRows.reduce((sum, snapshot) => sum + (snapshot.targetedReaches ?? 0), 0);
    const blocks = blockRows.length === 0
      ? null
      : blockRows.reduce((sum, snapshot) => sum + (snapshot.blocks ?? 0), 0);

    let monthlyGrowth = 0;
    let comparableBaselineFollowers = 0;
    let accountsCompared = 0;
    for (const [lineOaId, target] of targetByAccount) {
      const baseline = baselineByAccount.get(lineOaId);
      if (!baseline || target.followers === null || baseline.followers === null) continue;
      monthlyGrowth += target.followers - baseline.followers;
      comparableBaselineFollowers += baseline.followers;
      accountsCompared++;
    }

    return {
      available: targetRows.length > 0,
      reason: targetRows.length > 0 ? null : "no_target_snapshot",
      totalFollowers: targetRows.length > 0 ? totalFollowers : null,
      monthlyGrowth: accountsCompared > 0 ? monthlyGrowth : null,
      growthRate: accountsCompared > 0 && comparableBaselineFollowers > 0
        ? monthlyGrowth / comparableBaselineFollowers
        : null,
      targetedReaches,
      blocks,
      asOfDate: targetIso,
      baselineDate: baselineIso,
      accountsExpected: accounts.length,
      accountsWithData: targetByAccount.size,
      accountsCompared,
      coverageRate: accounts.length === 0 ? 0 : targetByAccount.size / accounts.length,
    };
  }
}
