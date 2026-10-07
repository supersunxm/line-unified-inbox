import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { buildNicknameV3ProductResolver } from "../line-chat/nickname-parser-v3-products";
import { PrismaService } from "../prisma.service";
import { NICKNAME_PARSER_V4_RULE_VERSION, parseNicknameV4, type ParserV4Result } from "./nickname-parser-v4";

/** Serialises re-derive batches across processes (pg_advisory_xact_lock key). */
const TAG_REDERIVE_LOCK_KEY = 732_017_003;
export const TAG_REDERIVE_BATCH_SIZE = 500;
/** Upper bound of batches per call (scheduler tick or admin request): 20 × 500 conversations. */
export const TAG_REDERIVE_MAX_BATCHES_PER_CALL = 20;
/** Observations read per incremental call. */
export const TAG_REDERIVE_INCREMENTAL_OBSERVATIONS = 20_000;
/** Incremental runs start this long before the full run began, so nothing captured during it is missed. */
const FULL_RUN_OVERLAP_MS = 60 * 60 * 1000;
/**
 * Each incremental pass re-reads this much before the previous watermark: a capture can commit
 * after a later one, so its observedAt can be behind the watermark. Re-reading is idempotent.
 */
const INCREMENTAL_OVERLAP_MS = 15 * 60 * 1000;
/** Pages of TAG_REDERIVE_INCREMENTAL_OBSERVATIONS read per incremental call. */
const INCREMENTAL_MAX_PAGES = 10;
export const TAG_REDERIVE_CHECK_INTERVAL_MS = 10 * 60 * 1000;

export const MODE_FULL = "FULL";
export const MODE_INCREMENTAL = "INCREMENTAL";

type Db = PrismaService | PrismaClient;
type Tx = Prisma.TransactionClient;
type ProductResolver = ReturnType<typeof buildNicknameV3ProductResolver>["resolveProduct"];

/** Counts only: no names, no free text, no per-customer values. */
export type RederiveCounts = {
  conversations: number;
  withReadNickname: number;
  noReadNickname: number;
  written: number;
  unchanged: number;
  tagged: number;
  noSignal: number;
  withPeriod: number;
  withFreeText: number;
  withConflicts: number;
  invalidDateTokens: number;
  byType: { online: number; source: number; product: number; film: number; payment: number; finance: number; period: number; date: number };
  v3Tagged: number;
  gainedVsV3: number;
  lostVsV3: number;
};

export function emptyCounts(): RederiveCounts {
  return {
    conversations: 0, withReadNickname: 0, noReadNickname: 0, written: 0, unchanged: 0, tagged: 0, noSignal: 0,
    withPeriod: 0, withFreeText: 0, withConflicts: 0, invalidDateTokens: 0,
    byType: { online: 0, source: 0, product: 0, film: 0, payment: 0, finance: 0, period: 0, date: 0 },
    v3Tagged: 0, gainedVsV3: 0, lostVsV3: 0,
  };
}

function addCounts(total: RederiveCounts, next: RederiveCounts): RederiveCounts {
  const sum = { ...total, byType: { ...total.byType } };
  for (const key of Object.keys(next) as Array<keyof RederiveCounts>) {
    if (key === "byType") continue;
    sum[key] = total[key] + next[key];
  }
  for (const key of Object.keys(next.byType) as Array<keyof RederiveCounts["byType"]>) sum.byType[key] = total.byType[key] + next.byType[key];
  return sum;
}

function readCounts(value: Prisma.JsonValue): RederiveCounts {
  const base = emptyCounts();
  const stored = (value ?? {}) as Partial<RederiveCounts>;
  return { ...base, ...stored, byType: { ...base.byType, ...(stored.byType ?? {}) } };
}

type CandidateRow = { conversationId: string; storeId: string | null; observationId: string | null; nickname: string | null; observedAt: Date | null };

/** Each conversation with its latest READ nickname observation of the same Store/OA/chat identity. */
async function loadCandidates(tx: Tx, selection: { afterId: string | null } | { ids: string[] }): Promise<CandidateRow[]> {
  const where = "ids" in selection
    ? Prisma.sql`c."id" IN (${Prisma.join(selection.ids)})`
    : selection.afterId === null ? Prisma.sql`TRUE` : Prisma.sql`c."id" > ${selection.afterId}`;
  return tx.$queryRaw<CandidateRow[]>(Prisma.sql`
    SELECT c."id" AS "conversationId", c."storeId", o."id" AS "observationId", o."nickname", o."observedAt"
    FROM "Conversation" c
    LEFT JOIN LATERAL (
      SELECT o."id", o."nickname", o."observedAt"
      FROM "NicknameSourceObservation" o
      WHERE o."lineOfficialAccountId" = c."lineOfficialAccountId"
        AND o."lineChatUserId" = c."lineChatUserId"
        AND o."storeId" = c."storeId"
        AND o."nicknameReadStatus" = 'READ'
      ORDER BY o."observedAt" DESC, o."id" DESC
      LIMIT 1
    ) o ON TRUE
    WHERE c."lineChatUserId" IS NOT NULL AND ${where}
    ORDER BY c."id"
    LIMIT ${TAG_REDERIVE_BATCH_SIZE}
  `);
}

function tally(counts: RederiveCounts, parsed: ParserV4Result) {
  const { values } = parsed;
  if (parsed.decision === "TAGGED") counts.tagged++; else counts.noSignal++;
  if (values.period) counts.withPeriod++;
  if (parsed.hasFreeText) counts.withFreeText++;
  if (parsed.conflicts.length > 0) counts.withConflicts++;
  counts.invalidDateTokens += parsed.invalidDateTokens;
  if (values.customerType) counts.byType.online++;
  if (values.source) counts.byType.source++;
  if (values.products.length > 0) counts.byType.product++;
  if (values.services.length > 0) counts.byType.film++;
  if (values.paymentMethod) counts.byType.payment++;
  if (values.financeProvider) counts.byType.finance++;
  if (values.period) counts.byType.period++;
  if (values.date) counts.byType.date++;
}

/**
 * Re-derives one batch inside an advisory-locked transaction. Reads observations and the v3 state
 * (for the comparison counts only); writes only NicknameTagV4 rows of the v4 version.
 */
export async function rederiveBatch(db: Db, selection: { afterId: string | null } | { ids: string[] }, resolveProduct: ProductResolver) {
  return (db as PrismaClient).$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${TAG_REDERIVE_LOCK_KEY})`;
    const counts = emptyCounts();
    const rows = "ids" in selection && selection.ids.length === 0 ? [] : await loadCandidates(tx, selection);
    const ids = rows.map((row) => row.conversationId);
    const [existing, v3] = ids.length === 0 ? [[], []] : await Promise.all([
      tx.nicknameTagV4.findMany({ where: { conversationId: { in: ids }, parserVersion: NICKNAME_PARSER_V4_RULE_VERSION }, select: { conversationId: true, sourceObservationId: true } }),
      tx.nicknameDerivedMetadataState.findMany({ where: { conversationId: { in: ids } }, select: { conversationId: true } }),
    ]);
    const existingObservation = new Map(existing.map((row) => [row.conversationId, row.sourceObservationId]));
    const v3Tagged = new Set(v3.map((row) => row.conversationId));
    for (const row of rows) {
      counts.conversations++;
      if (v3Tagged.has(row.conversationId)) counts.v3Tagged++;
      if (!row.observationId || !row.observedAt || !row.storeId) {
        counts.noReadNickname++;
        continue;
      }
      counts.withReadNickname++;
      const parsed = parseNicknameV4(row.nickname, true, resolveProduct);
      tally(counts, parsed);
      if (parsed.decision === "TAGGED" && !v3Tagged.has(row.conversationId)) counts.gainedVsV3++;
      if (parsed.decision !== "TAGGED" && v3Tagged.has(row.conversationId)) counts.lostVsV3++;
      if (existingObservation.get(row.conversationId) === row.observationId) {
        counts.unchanged++;
        continue;
      }
      const { values } = parsed;
      const data = {
        storeId: row.storeId,
        sourceObservationId: row.observationId,
        observedAt: row.observedAt,
        derivedAt: new Date(),
        decision: parsed.decision,
        source: values.source,
        customerType: values.customerType,
        paymentMethod: values.paymentMethod,
        financeProvider: values.financeProvider,
        services: values.services,
        productModelIds: values.products.map((product) => product.id),
        periodYear: values.period?.year ?? null,
        periodMonth: values.period?.month ?? null,
        eventDate: values.date ? new Date(Date.UTC(values.date.year, values.date.month - 1, values.date.day)) : null,
        hasFreeText: parsed.hasFreeText,
        conflicts: parsed.conflicts,
        ruleIds: parsed.ruleIds,
      };
      await tx.nicknameTagV4.upsert({
        where: { conversationId_parserVersion: { conversationId: row.conversationId, parserVersion: NICKNAME_PARSER_V4_RULE_VERSION } },
        create: { conversationId: row.conversationId, parserVersion: NICKNAME_PARSER_V4_RULE_VERSION, ...data },
        update: data,
      });
      counts.written++;
    }
    return { counts, lastId: ids.at(-1) ?? null, size: rows.length };
  }, { timeout: 120_000 });
}

async function loadResolver(db: Db): Promise<ProductResolver> {
  const [models, aliases] = await Promise.all([
    db.productModel.findMany({ where: { isActive: true }, select: { id: true, name: true, classificationLevel: true } }),
    db.productAlias.findMany({ where: { isActive: true }, select: { alias: true, source: true, productModel: { select: { id: true, name: true, isActive: true } } } }),
  ]);
  return buildNicknameV3ProductResolver(models, aliases).resolveProduct;
}

const bangkokDay = (date: Date) => new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * Parser v4 re-derive. A FULL run walks every conversation in id order, in bounded batches,
 * resumable across calls; afterwards INCREMENTAL calls pick up conversations with new READ
 * observations (one audit row per Bangkok day). v3 rows and raw observations are never modified.
 */
@Injectable()
export class NicknameTagsV4Service {
  constructor(private readonly prisma: PrismaService) {}

  async runs(limit = 50) {
    return this.prisma.nicknameTagRederiveRun.findMany({ where: { parserVersion: NICKNAME_PARSER_V4_RULE_VERSION }, orderBy: { startedAt: "desc" }, take: Math.min(Math.max(limit, 1), 200) });
  }

  /** Starts a full re-derive unless one is already in progress (then that one continues). */
  async startFull(input: { trigger: "SYSTEM" | "ADMIN"; actorName: string; reason?: string | null }) {
    const open = await this.prisma.nicknameTagRederiveRun.findFirst({ where: { parserVersion: NICKNAME_PARSER_V4_RULE_VERSION, mode: MODE_FULL, finishedAt: null }, orderBy: { startedAt: "desc" } });
    if (open) return open;
    return this.prisma.nicknameTagRederiveRun.create({
      data: { parserVersion: NICKNAME_PARSER_V4_RULE_VERSION, mode: MODE_FULL, trigger: input.trigger, actorName: input.actorName, reason: input.reason?.trim() || null, counts: emptyCounts() },
    });
  }

  /** One bounded step: continue an open full run, start the first one, or run an incremental pass. */
  async step(maxBatches = TAG_REDERIVE_MAX_BATCHES_PER_CALL, now = new Date()) {
    const openFull = await this.prisma.nicknameTagRederiveRun.findFirst({ where: { parserVersion: NICKNAME_PARSER_V4_RULE_VERSION, mode: MODE_FULL, finishedAt: null }, orderBy: { startedAt: "desc" } });
    if (openFull) return this.continueFull(openFull.id, maxBatches);
    const lastFull = await this.prisma.nicknameTagRederiveRun.findFirst({ where: { parserVersion: NICKNAME_PARSER_V4_RULE_VERSION, mode: MODE_FULL }, orderBy: { startedAt: "desc" } });
    if (!lastFull) {
      const run = await this.startFull({ trigger: "SYSTEM", actorName: "system" });
      return this.continueFull(run.id, maxBatches);
    }
    return this.incremental(lastFull.startedAt, now);
  }

  async continueFull(runId: string, maxBatches = TAG_REDERIVE_MAX_BATCHES_PER_CALL) {
    const resolveProduct = await loadResolver(this.prisma);
    let run = await this.prisma.nicknameTagRederiveRun.findUniqueOrThrow({ where: { id: runId } });
    for (let index = 0; index < maxBatches && !run.finishedAt; index++) {
      const batch = await rederiveBatch(this.prisma, { afterId: run.cursor }, resolveProduct);
      const done = batch.size < TAG_REDERIVE_BATCH_SIZE;
      run = await this.prisma.nicknameTagRederiveRun.update({
        where: { id: run.id },
        data: {
          cursor: batch.lastId ?? run.cursor,
          batches: run.batches + 1,
          counts: addCounts(readCounts(run.counts), batch.counts),
          finishedAt: done ? new Date() : null,
        },
      });
    }
    return run;
  }

  /** Conversations whose identity has READ observations after the watermark. */
  async incremental(fullStartedAt: Date, now = new Date()) {
    const latest = await this.prisma.nicknameTagRederiveRun.findFirst({ where: { parserVersion: NICKNAME_PARSER_V4_RULE_VERSION, mode: MODE_INCREMENTAL }, orderBy: { startedAt: "desc" } });
    let afterAt = latest?.watermark ? new Date(latest.watermark.getTime() - INCREMENTAL_OVERLAP_MS) : new Date(fullStartedAt.getTime() - FULL_RUN_OVERLAP_MS);
    let afterId = "";
    const observations: Array<{ id: string; observedAt: Date; lineOfficialAccountId: string; lineChatUserId: string }> = [];
    for (let page = 0; page < INCREMENTAL_MAX_PAGES; page++) {
      const rows = await this.prisma.$queryRaw<typeof observations>(Prisma.sql`
        SELECT "id", "observedAt", "lineOfficialAccountId", "lineChatUserId"
        FROM "NicknameSourceObservation"
        WHERE "nicknameReadStatus" = 'READ' AND ("observedAt", "id") > (${afterAt}, ${afterId})
        ORDER BY "observedAt", "id"
        LIMIT ${TAG_REDERIVE_INCREMENTAL_OBSERVATIONS}
      `);
      observations.push(...rows);
      if (rows.length < TAG_REDERIVE_INCREMENTAL_OBSERVATIONS) break;
      afterAt = rows.at(-1)!.observedAt;
      afterId = rows.at(-1)!.id;
    }
    if (observations.length === 0) return latest;
    const identities = [...new Map(observations.map((row) => [`${row.lineOfficialAccountId}\u0000${row.lineChatUserId}`, row])).values()];
    const conversationIds: string[] = [];
    for (let index = 0; index < identities.length; index += 1000) {
      const chunk = identities.slice(index, index + 1000);
      const rows = await this.prisma.conversation.findMany({ where: { OR: chunk.map((row) => ({ lineOfficialAccountId: row.lineOfficialAccountId, lineChatUserId: row.lineChatUserId })) }, select: { id: true } });
      conversationIds.push(...rows.map((row) => row.id));
    }
    const resolveProduct = await loadResolver(this.prisma);
    let counts = emptyCounts();
    let batches = 0;
    const sorted = [...new Set(conversationIds)].sort();
    for (let index = 0; index < sorted.length; index += TAG_REDERIVE_BATCH_SIZE) {
      const batch = await rederiveBatch(this.prisma, { ids: sorted.slice(index, index + TAG_REDERIVE_BATCH_SIZE) }, resolveProduct);
      counts = addCounts(counts, batch.counts);
      batches++;
    }
    const last = observations.at(-1)!;
    const sameDay = latest && bangkokDay(latest.startedAt) === bangkokDay(now);
    const data = { watermark: latest?.watermark && latest.watermark > last.observedAt ? latest.watermark : last.observedAt, cursor: last.id, finishedAt: now };
    if (latest && sameDay) {
      return this.prisma.nicknameTagRederiveRun.update({
        where: { id: latest.id },
        data: { ...data, batches: latest.batches + batches, counts: addCounts(readCounts(latest.counts), counts) },
      });
    }
    return this.prisma.nicknameTagRederiveRun.create({
      data: { parserVersion: NICKNAME_PARSER_V4_RULE_VERSION, mode: MODE_INCREMENTAL, trigger: "SYSTEM", actorName: "system", startedAt: now, batches, counts: counts, ...data },
    });
  }
}

/**
 * In-process scheduler (the backend's existing pattern, as BroadcastSchedulerService). Each tick is
 * one bounded step. Disable with V2_TAG_REDERIVE_SCHEDULER_DISABLED=true.
 */
@Injectable()
export class NicknameTagsV4Scheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NicknameTagsV4Scheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly tags: NicknameTagsV4Service) {}

  onModuleInit() {
    if (process.env.NODE_ENV === "test" || process.env.V2_TAG_REDERIVE_SCHEDULER_DISABLED === "true") return;
    this.timer = setInterval(() => void this.tick(), TAG_REDERIVE_CHECK_INTERVAL_MS);
    this.timer.unref?.();
    setTimeout(() => void this.tick(), 90_000).unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const run = await this.tags.step();
      if (run) {
        const counts = readCounts(run.counts);
        // Counts only (no names, no text): readable from the service logs for the run report.
        this.logger.log(`tag_rederive version=${run.parserVersion} mode=${run.mode} batches=${run.batches} finished=${Boolean(run.finishedAt)} counts=${JSON.stringify(counts)}`);
      }
    } catch (error) {
      this.logger.error(`tag_rederive tick failed: ${error instanceof Error ? error.message : "unknown"}`);
    } finally {
      this.running = false;
    }
  }
}
