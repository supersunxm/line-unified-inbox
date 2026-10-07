import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient, UserRole } from "@prisma/client";
import type { AuthUser } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import { CHAT_REPLY_STATUS_COVERAGE_MONTH } from "../chat-period";
import { ConversationsService } from "../conversations.service";
import { FOCUS_STORE_GROUP_ID } from "../focus-store-group";
import { HistoricalTimelineService } from "../historical-timeline.service";
import { OperationsService } from "../operations/operations.service";
import { PrismaService } from "../prisma.service";
import { closeDueAt, isBackfill, isMonth, MONTH_CLOSE_DEFINITION_VERSION, monthDays, monthHasEnded, monthsDueForClose } from "./month-close-rules";

export const CLOSED_BY_SYSTEM = "SYSTEM";
export const CLOSED_BY_ADMIN = "ADMIN";
/** Serialises closes across processes (pg_advisory_xact_lock key). */
const MONTH_CLOSE_LOCK_KEY = 732_017_002;
/** How often the in-process scheduler checks for months due to close. */
export const MONTH_CLOSE_CHECK_INTERVAL_MS = 10 * 60 * 1000;

/** The system actor used to read every store's numbers (ADMIN scope = all stores). */
const SYSTEM_ACTOR: AuthUser = { id: "system:month-close", email: "", displayName: "system (month close)", role: UserRole.ADMIN, isActive: true };

type StoreValues = {
  storeUuid: string;
  storeId: string | null;
  storeName: string;
  chatsTotal: number;
  chatsUnreplied: number;
  chatsReplied: number;
  oldestWaitingMinutes: number | null;
  rate24Total: number;
  rate24Within: number;
};

export type MonthValues = {
  month: string;
  computedAt: Date;
  network: { chatsTotal: number; chatsUnreplied: number; chatsReplied: number; rate24Total: number; rate24Within: number };
  stores: StoreValues[];
};

export type CloseOutcome =
  | { status: "closed"; closeId: string; month: string; revision: number; backfill: boolean; storeCount: number }
  | { status: "already-closed"; month: string; revision: number };

type Db = PrismaService | PrismaClient;

/**
 * Month close. The numbers are computed by the same functions as /chats
 * (getBmReplyStatusSummary for the month, effective two-state counts) and /replymessage
 * (replyAnalytics for the month's Bangkok days), so a snapshot equals what those pages showed
 * at close time. A close is never overwritten: an admin re-close writes a new revision and keeps
 * the earlier rows.
 */
@Injectable()
export class MonthCloseService {
  private readonly conversations: ConversationsService;
  private readonly timeline: HistoricalTimelineService;

  constructor(private readonly prisma: PrismaService, operations: OperationsService, storeAccess: StoreAccessService) {
    this.conversations = new ConversationsService(prisma, operations);
    this.timeline = new HistoricalTimelineService(prisma, storeAccess);
  }

  async compute(month: string): Promise<MonthValues> {
    const computedAt = new Date();
    const summary = await this.conversations.getBmReplyStatusSummary(null, month);
    const { dateFrom, dateTo } = monthDays(month);
    const rates = await this.timeline.replyAnalytics(SYSTEM_ACTOR, { dateFrom, dateTo });
    const rateByStore = new Map(rates.stores.map((row: { storeId: string; total: number; within24h: number }) => [row.storeId, row]));
    const stores = summary.stores
      .filter((store) => store.storeId !== FOCUS_STORE_GROUP_ID)
      .map((store): StoreValues => {
        const rate = rateByStore.get(store.storeId);
        return {
          storeUuid: store.storeId,
          storeId: store.externalStoreId ?? null,
          storeName: store.storeName,
          chatsTotal: store.total,
          chatsUnreplied: store.notReplied + store.notifiedBm,
          chatsReplied: store.replied,
          oldestWaitingMinutes: store.notReplied + store.notifiedBm > 0 ? store.oldestWaitingMinutes : null,
          rate24Total: rate?.total ?? 0,
          rate24Within: rate?.within24h ?? 0,
        };
      });
    return {
      month,
      computedAt,
      network: {
        chatsTotal: summary.overview.total,
        chatsUnreplied: summary.overview.notReplied + summary.overview.notifiedBm,
        chatsReplied: summary.overview.replied,
        rate24Total: rates.overview.total,
        rate24Within: rates.overview.within24h,
      },
      stores,
    };
  }

  /** First close (system or admin) or an admin re-close (needs a reason). */
  async close(month: string, input: { closedBy: typeof CLOSED_BY_SYSTEM | typeof CLOSED_BY_ADMIN; actorId?: string | null; actorName: string; reason?: string | null }, now = new Date()): Promise<CloseOutcome> {
    if (!isMonth(month) || month < CHAT_REPLY_STATUS_COVERAGE_MONTH) throw new BadRequestException(`month must be YYYY-MM from ${CHAT_REPLY_STATUS_COVERAGE_MONTH}`);
    if (!monthHasEnded(month, now)) throw new BadRequestException("A month can be closed only after it ends");
    const values = await this.compute(month);
    return writeClose(this.prisma, values, input, now);
  }

  /** Closes every month whose due time has passed and that has no close yet (never re-closes). */
  async closeDueMonths(now = new Date()): Promise<CloseOutcome[]> {
    const outcomes: CloseOutcome[] = [];
    for (const month of monthsDueForClose(now)) {
      const existing = await this.prisma.monthlyKpiClose.findFirst({ where: { month }, select: { id: true } });
      if (existing) continue;
      outcomes.push(await this.close(month, { closedBy: CLOSED_BY_SYSTEM, actorId: null, actorName: "system" }, now));
    }
    return outcomes;
  }

  async closes(month?: string) {
    return this.prisma.monthlyKpiClose.findMany({
      where: month ? { month } : undefined,
      orderBy: [{ month: "desc" }, { revision: "desc" }],
      take: 100,
    });
  }

  /** The current (latest-revision) snapshot of a month, limited to the caller's stores. */
  async snapshot(month: string, accessibleStoreIds: string[] | null) {
    return readSnapshot(this.prisma, month, accessibleStoreIds);
  }
}

/** Writes a close inside an advisory lock; a system close never touches an existing close. */
export async function writeClose(
  db: Db,
  values: MonthValues,
  input: { closedBy: string; actorId?: string | null; actorName: string; reason?: string | null },
  now = new Date(),
): Promise<CloseOutcome> {
  return (db as PrismaClient).$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MONTH_CLOSE_LOCK_KEY})`;
    const latest = await tx.monthlyKpiClose.findFirst({ where: { month: values.month }, orderBy: { revision: "desc" }, select: { revision: true } });
    if (latest && input.closedBy === CLOSED_BY_SYSTEM) return { status: "already-closed" as const, month: values.month, revision: latest.revision };
    const reason = input.reason?.trim() || null;
    if (latest && !reason) throw new BadRequestException("Re-closing a month needs a reason");
    const revision = (latest?.revision ?? 0) + 1;
    const dueAt = closeDueAt(values.month);
    // "ปิดย้อนหลัง": a first close made more than a day after its due time (values as of now).
    const backfill = revision === 1 && isBackfill(dueAt, now);
    const close = await tx.monthlyKpiClose.create({
      data: {
        month: values.month,
        revision,
        closedBy: input.closedBy,
        actorId: input.actorId ?? null,
        actorName: input.actorName,
        reason,
        backfill,
        dueAt,
        closedAt: now,
        definitionVersion: MONTH_CLOSE_DEFINITION_VERSION,
        storeCount: values.stores.length,
        ...values.network,
      },
    });
    if (values.stores.length > 0) {
      await tx.monthlyStoreKpiSnapshot.createMany({
        data: values.stores.map((store) => ({
          closeId: close.id,
          month: values.month,
          revision,
          ...store,
          hasChatData: store.chatsTotal > 0,
          rate24Measured: store.rate24Total > 0,
          replyStatusCovered: values.month >= CHAT_REPLY_STATUS_COVERAGE_MONTH,
          computedAt: values.computedAt,
          definitionVersion: MONTH_CLOSE_DEFINITION_VERSION,
          closedBy: input.closedBy,
        })),
      });
    }
    return { status: "closed" as const, closeId: close.id, month: values.month, revision, backfill, storeCount: values.stores.length };
  }, { timeout: 120_000 });
}

export async function readSnapshot(db: Db, month: string, accessibleStoreIds: string[] | null) {
  const close = await db.monthlyKpiClose.findFirst({ where: { month }, orderBy: { revision: "desc" } });
  if (!close) return { close: null, stores: [], network: null };
  const stores = await db.monthlyStoreKpiSnapshot.findMany({
    where: { closeId: close.id, ...(accessibleStoreIds === null ? {} : { storeUuid: { in: accessibleStoreIds } }) },
    orderBy: { storeName: "asc" },
  });
  const sum = (key: "chatsTotal" | "chatsUnreplied" | "chatsReplied" | "rate24Total" | "rate24Within") => stores.reduce((total, row) => total + row[key], 0);
  // All-store callers get the close's own network totals (= /chats overview at close time).
  const network = accessibleStoreIds === null
    ? { chatsTotal: close.chatsTotal, chatsUnreplied: close.chatsUnreplied, chatsReplied: close.chatsReplied, rate24Total: close.rate24Total, rate24Within: close.rate24Within }
    : { chatsTotal: sum("chatsTotal"), chatsUnreplied: sum("chatsUnreplied"), chatsReplied: sum("chatsReplied"), rate24Total: sum("rate24Total"), rate24Within: sum("rate24Within") };
  return { close, stores, network };
}

/**
 * The in-process scheduler (the backend's existing pattern: an interval in the API, as in
 * BroadcastSchedulerService). Every MONTH_CLOSE_CHECK_INTERVAL_MS it closes months whose due time
 * has passed. Idempotent: advisory-locked, never re-closes.
 */
@Injectable()
export class MonthCloseScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonthCloseScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly monthClose: MonthCloseService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === "test" || process.env.V2_MONTH_CLOSE_SCHEDULER_DISABLED === "true") return;
    this.timer = setInterval(() => void this.tick(), MONTH_CLOSE_CHECK_INTERVAL_MS);
    this.timer.unref?.();
    setTimeout(() => void this.tick(), 60_000).unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      for (const outcome of await this.monthClose.closeDueMonths()) {
        if (outcome.status === "closed") this.logger.log(`month_close month=${outcome.month} revision=${outcome.revision} backfill=${outcome.backfill} stores=${outcome.storeCount}`);
      }
    } catch (error) {
      this.logger.error(`month_close tick failed: ${error instanceof Error ? error.message : "unknown"}`);
    } finally {
      this.running = false;
    }
  }
}
