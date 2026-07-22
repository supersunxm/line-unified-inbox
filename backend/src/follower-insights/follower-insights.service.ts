import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import {
  formatDbDateToIso,
  formatToIsoDate,
  formatToLineApiDate,
  getDateRangeArray,
  getTodayBangkokDateString,
  toUtcDateForDb,
} from "./date-utils";
import {
  BackfillBatchResult,
  BackfillFollowerInsightsDto,
  ByStoreAccountRow,
  ByStoreQueryDto,
  LineFollowerInsightResponse,
  SanitizedSyncError,
  SummaryDailyRow,
  SummaryQueryDto,
  SyncBatchResult,
  SyncFollowerInsightsDto,
} from "./follower-insights.types";

async function mapConcurrently<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
  return results;
}

@Injectable()
export class FollowerInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialEncryptionService: CredentialEncryptionService
  ) {}

  private async fetchLineFollowerInsight(
    encryptedToken: string,
    lineApiDateStr: string,
    timeoutMs = 10000
  ): Promise<{ data?: LineFollowerInsightResponse; errorCode?: string }> {
    let token: string;
    try {
      token = this.credentialEncryptionService.decrypt(encryptedToken);
    } catch {
      return { errorCode: "LINE_CREDENTIAL_ERROR" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `https://api.line.me/v2/bot/insight/followers?date=${lineApiDateStr}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) return { errorCode: "LINE_API_ERROR_401" };
        if (response.status === 403) return { errorCode: "LINE_API_ERROR_403" };
        if (response.status === 404) return { errorCode: "LINE_API_ERROR_404" };
        if (response.status >= 500) return { errorCode: "LINE_API_ERROR_500" };
        return { errorCode: "LINE_API_HTTP_ERROR" };
      }

      const body = (await response.json()) as Record<string, unknown>;
      return {
        data: {
          status: typeof body?.status === "string" ? body.status : "unready",
          followers: typeof body?.followers === "number" ? body.followers : null,
          targetedReaches: typeof body?.targetedReaches === "number" ? body.targetedReaches : null,
          blocks: typeof body?.blocks === "number" ? body.blocks : null,
        },
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err && typeof err === "object" && "name" in err && err.name === "AbortError") {
        return { errorCode: "LINE_API_TIMEOUT" };
      }
      return { errorCode: "LINE_API_NETWORK_ERROR" };
    }
  }

  async sync(dto: SyncFollowerInsightsDto, targetLineOaIds?: string[]): Promise<SyncBatchResult> {
    const isoDate = formatToIsoDate(dto.date);
    const lineApiDate = formatToLineApiDate(isoDate);
    const dbDate = toUtcDateForDb(isoDate);

    const accounts = await this.prisma.lineOfficialAccount.findMany({
      where: {
        isActive: true,
        archivedAt: null,
        encryptedChannelAccessToken: { not: null },
        ...(targetLineOaIds && targetLineOaIds.length > 0 ? { id: { in: targetLineOaIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        encryptedChannelAccessToken: true,
      },
    });

    const sanitizedErrors: SanitizedSyncError[] = [];
    let succeeded = 0;
    let unready = 0;
    let failed = 0;
    let skipped = 0;

    const processAccount = async (account: typeof accounts[number]) => {
      try {
        if (!account.encryptedChannelAccessToken) {
          skipped++;
          return;
        }

        const { data, errorCode } = await this.fetchLineFollowerInsight(
          account.encryptedChannelAccessToken,
          lineApiDate
        );

        if (errorCode) {
          failed++;
          sanitizedErrors.push({
            lineOaId: account.id,
            accountName: account.name,
            date: isoDate,
            code: errorCode,
          });
          return;
        }

        if (!data) {
          failed++;
          sanitizedErrors.push({
            lineOaId: account.id,
            accountName: account.name,
            date: isoDate,
            code: "LINE_API_NO_DATA",
          });
          return;
        }

        const status = data.status || "unready";

        await this.prisma.lineOaFollowerSnapshot.upsert({
          where: {
            lineOaId_snapshotDate: {
              lineOaId: account.id,
              snapshotDate: dbDate,
            },
          },
          create: {
            lineOaId: account.id,
            snapshotDate: dbDate,
            status,
            followers: data.followers ?? null,
            targetedReaches: data.targetedReaches ?? null,
            blocks: data.blocks ?? null,
            fetchedAt: new Date(),
          },
          update: {
            status,
            followers: data.followers ?? null,
            targetedReaches: data.targetedReaches ?? null,
            blocks: data.blocks ?? null,
            fetchedAt: new Date(),
          },
        });

        if (status === "ready") {
          succeeded++;
        } else {
          unready++;
        }
      } catch {
        failed++;
        sanitizedErrors.push({
          lineOaId: account.id,
          accountName: account.name,
          date: isoDate,
          code: "DATABASE_WRITE_ERROR",
        });
      }
    };

    await mapConcurrently(accounts, 5, processAccount);

    return {
      date: isoDate,
      requested: accounts.length,
      succeeded,
      unready,
      failed,
      skipped,
      errors: sanitizedErrors,
    };
  }

  async backfill(dto: BackfillFollowerInsightsDto): Promise<BackfillBatchResult> {
    const dates = getDateRangeArray(dto.dateFrom, dto.dateTo);
    const results: SyncBatchResult[] = [];

    for (const date of dates) {
      const result = await this.sync({ date }, dto.lineOaIds);
      results.push(result);
    }

    return {
      dateFrom: dates[0],
      dateTo: dates[dates.length - 1],
      totalDays: dates.length,
      results,
    };
  }

  async getSummary(query: SummaryQueryDto): Promise<SummaryDailyRow[]> {
    const todayIso = getTodayBangkokDateString();
    const dateFrom = query.dateFrom ? formatToIsoDate(query.dateFrom) : todayIso;
    const dateTo = query.dateTo ? formatToIsoDate(query.dateTo) : todayIso;

    const dates = getDateRangeArray(dateFrom, dateTo);

    const accountsWhereClause: Record<string, unknown> = {
      isActive: true,
      archivedAt: null,
      ...(query.lineOaId ? { id: query.lineOaId } : {}),
      ...(query.storeId || query.region || query.province
        ? {
            store: {
              ...(query.storeId ? { id: query.storeId } : {}),
              ...(query.region ? { region: query.region } : {}),
              ...(query.province
                ? {
                    OR: [
                      { storeMaster: { province: query.province } },
                    ],
                  }
                : {}),
            },
          }
        : {}),
    };

    const matchingAccounts = await this.prisma.lineOfficialAccount.findMany({
      where: accountsWhereClause,
      select: { id: true },
    });

    const accountsExpected = matchingAccounts.length;
    const accountIds = matchingAccounts.map((a) => a.id);

    if (accountIds.length === 0) {
      return dates.map((d) => ({
        date: d,
        followers: null,
        targetedReaches: null,
        blocks: null,
        dailyIncrease: null,
        accountsExpected: 0,
        accountsWithData: 0,
        accountsReady: 0,
        accountsUnready: 0,
        accountsMissing: 0,
      }));
    }

    const minDateUtc = toUtcDateForDb(dates[0]);
    const maxDateUtc = toUtcDateForDb(dates[dates.length - 1]);

    const snapshots = await this.prisma.lineOaFollowerSnapshot.findMany({
      where: {
        lineOaId: { in: accountIds },
        snapshotDate: { gte: minDateUtc, lte: maxDateUtc },
      },
    });

    const snapshotsByDate = new Map<string, typeof snapshots>();
    for (const snap of snapshots) {
      const dStr = formatDbDateToIso(snap.snapshotDate);
      if (!snapshotsByDate.has(dStr)) {
        snapshotsByDate.set(dStr, []);
      }
      snapshotsByDate.get(dStr)!.push(snap);
    }

    const rows: SummaryDailyRow[] = [];

    for (const dStr of dates) {
      const daySnapshots = snapshotsByDate.get(dStr) || [];
      const accountsWithData = daySnapshots.length;
      const readySnapshots = daySnapshots.filter((s) => s.status === "ready");
      const accountsReady = readySnapshots.length;
      const accountsUnready = accountsWithData - accountsReady;
      const accountsMissing = accountsExpected - accountsWithData;

      let followers: number | null = null;
      let targetedReaches: number | null = null;
      let blocks: number | null = null;

      for (const s of readySnapshots) {
        if (s.followers !== null) {
          followers = (followers ?? 0) + s.followers;
        }
        if (s.targetedReaches !== null) {
          targetedReaches = (targetedReaches ?? 0) + s.targetedReaches;
        }
        if (s.blocks !== null) {
          blocks = (blocks ?? 0) + s.blocks;
        }
      }

      let aggregateIncrease: number | null = null;
      let validIncreaseCount = 0;

      for (const snap of readySnapshots) {
        if (snap.followers === null) continue;
        const currentUtc = toUtcDateForDb(dStr);

        const prevSnap = await this.prisma.lineOaFollowerSnapshot.findFirst({
          where: {
            lineOaId: snap.lineOaId,
            status: "ready",
            followers: { not: null },
            snapshotDate: { lt: currentUtc },
          },
          orderBy: { snapshotDate: "desc" },
        });

        if (prevSnap && prevSnap.followers !== null) {
          const increase = snap.followers - prevSnap.followers;
          aggregateIncrease = (aggregateIncrease ?? 0) + increase;
          validIncreaseCount++;
        }
      }

      rows.push({
        date: dStr,
        followers,
        targetedReaches,
        blocks,
        dailyIncrease: validIncreaseCount > 0 ? aggregateIncrease : null,
        accountsExpected,
        accountsWithData,
        accountsReady,
        accountsUnready,
        accountsMissing,
      });
    }

    return rows;
  }

  async getByStore(query: ByStoreQueryDto): Promise<ByStoreAccountRow[]> {
    const todayIso = getTodayBangkokDateString();
    const targetIsoDate = query.dateTo ? formatToIsoDate(query.dateTo) : (query.date ? formatToIsoDate(query.date) : todayIso);
    const targetUtcDate = toUtcDateForDb(targetIsoDate);

    const startIsoDate = query.dateFrom ? formatToIsoDate(query.dateFrom) : targetIsoDate;
    const startUtcDate = toUtcDateForDb(startIsoDate);

    const accounts = await this.prisma.lineOfficialAccount.findMany({
      where: {
        isActive: true,
        archivedAt: null,
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
          },
        },
        followerSnapshots: {
          where: {
            snapshotDate: { in: [startUtcDate, targetUtcDate] },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const rows: ByStoreAccountRow[] = [];

    for (const account of accounts) {
      const endSnap = account.followerSnapshots.find(s => s.snapshotDate.getTime() === targetUtcDate.getTime());
      const isReady = endSnap?.status === "ready";
      const currentFollowers = isReady && endSnap.followers !== null ? endSnap.followers : null;

      let startFollowers: number | null = null;
      let periodIncrease: number | null = null;
      let status = endSnap?.status || "missing";

      const startSnap = account.followerSnapshots.find(s => s.snapshotDate.getTime() === startUtcDate.getTime());
      if (!startSnap || startSnap.status !== "ready") {
        status = status === "ready" ? "missing-baseline" : status;
      } else {
        startFollowers = startSnap.followers !== null ? startSnap.followers : null;
      }

      if (currentFollowers !== null && startFollowers !== null) {
        periodIncrease = currentFollowers - startFollowers;
      }

      const prevSnapForDaily = await this.prisma.lineOaFollowerSnapshot.findFirst({
        where: {
          lineOaId: account.id,
          status: "ready",
          followers: { not: null },
          snapshotDate: { lt: targetUtcDate },
        },
        orderBy: { snapshotDate: "desc" },
      });

      const previousFollowers = prevSnapForDaily?.followers ?? null;
      let dailyIncrease: number | null = null;
      if (currentFollowers !== null && previousFollowers !== null) {
        dailyIncrease = currentFollowers - previousFollowers;
      }

      rows.push({
        lineOaId: account.id,
        accountName: account.name,
        storeId: account.store.id,
        storeName: account.store.name,
        date: targetIsoDate,
        followers: currentFollowers,
        previousFollowers,
        startFollowers,
        dailyIncrease,
        periodIncrease,
        targetedReaches: isReady ? endSnap?.targetedReaches ?? null : null,
        blocks: isReady ? endSnap?.blocks ?? null : null,
        status,
        fetchedAt: endSnap?.fetchedAt ?? null,
      });
    }

    return rows;
  }
}
