import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CHAT_REPLY_STATUS_COVERAGE_MONTH } from "../../chat-period";
import { PrismaService } from "../../prisma.service";
import { configuredSunnUsers, parseInboundPlan, prepareSunnReadOnlyCommand, senderHash, type InboundPlan, type InboundState } from "./sunn-secretary-inbound";
import { bangkokMonth } from "./sunn-secretary-intent";
import { normalizeMonthlyReplySummary, type MonthlySummary, type SecretaryMonthlyAnswer, type SecretaryMonthlyDataQuality } from "./sunn-secretary-monthly";
import { formatSunnMonthlyReply } from "./sunn-secretary-reply";

export const SUNN_SECRETARY_SUMMARY_READER = Symbol("SUNN_SECRETARY_SUMMARY_READER");
export const SUNN_SECRETARY_MAX_SCOPED_STORES = 200;
export const SUNN_SECRETARY_MAX_ACTIVE_OAS = 800;
export const SUNN_SECRETARY_MAX_MONTHLY_CONVERSATIONS = 10_000;
export const SUNN_SECRETARY_MIRROR_FRESHNESS_MS = 2 * 60 * 60 * 1000;
const TRANSACTION_TIMEOUT_MS = 7_000;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu;
const MONTH = /^20\d{2}-(0[1-9]|1[0-2])$/u;

export type SunnSecretarySummaryReader = {
  read(storeIds: string[], month: string, client: Prisma.TransactionClient, maxRows: number): Promise<MonthlySummary>;
};

export type SunnSecretaryExecutionRequest = {
  state: InboundState;
  plan: unknown;
};

export type SunnSecretaryKpiFailure = {
  ok: false;
  reason:
    | "COMMAND_NOT_PREPARED"
    | "WEBHOOK_DISABLED"
    | "INVALID_INTENT"
    | "UNAUTHORIZED_SENDER"
    | "BLOCKED_STORE_SCOPE"
    | "INACTIVE_OR_UNRESOLVED_STORE_SCOPE"
    | "STORE_OA_COVERAGE_UNAVAILABLE"
    | "MIRROR_DATA_STALE_OR_PARTIAL"
    | "HISTORICAL_COVERAGE_UNSUPPORTED"
    | "FUTURE_MONTH_UNAVAILABLE"
    | "SUMMARY_INCONSISTENT_OR_INCOMPLETE"
    | "READ_QUERY_TIMEOUT"
    | "DATA_SOURCE_UNAVAILABLE";
};

export type SunnSecretaryKpiSuccess = {
  ok: true;
  answer: SecretaryMonthlyAnswer;
  responseText: string;
};

export type SunnSecretaryKpiResult = SunnSecretaryKpiSuccess | SunnSecretaryKpiFailure;

type ScopeResolution =
  | { ok: true; userId: string; storeIds: string[] }
  | { ok: false; reason: "UNAUTHORIZED_SENDER" | "BLOCKED_STORE_SCOPE" };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function resolveAuthorizedScope(plan: InboundPlan): ScopeResolution {
  const users = configuredSunnUsers();
  const userId = users.find((id) => senderHash(id) === plan.senderHash);
  if (!userId) return { ok: false, reason: "UNAUTHORIZED_SENDER" };

  let scopes: unknown;
  try {
    scopes = JSON.parse(process.env.SUNN_SECRETARY_STORE_SCOPE_BY_USER ?? "{}");
  } catch {
    return { ok: false, reason: "BLOCKED_STORE_SCOPE" };
  }
  if (!isObject(scopes) || prepareSunnReadOnlyCommand(plan, users, scopes) !== "PREPARED") {
    return { ok: false, reason: "BLOCKED_STORE_SCOPE" };
  }
  const rawIds: unknown = scopes[userId];
  if (!Array.isArray(rawIds) || rawIds.length === 0 || rawIds.length > SUNN_SECRETARY_MAX_SCOPED_STORES ||
      !rawIds.every((id) => typeof id === "string" && UUID.test(id))) {
    return { ok: false, reason: "BLOCKED_STORE_SCOPE" };
  }
  return { ok: true, userId, storeIds: [...new Set(rawIds as string[])] };
}

function validateIntent(plan: InboundPlan, now: Date): SunnSecretaryKpiFailure | null {
  if (plan.version !== 1 || plan.classification !== "AUTHORIZED" || plan.intent?.kind !== "UNANSWERED_BY_STORE" ||
      !MONTH.test(plan.intent.month) || !Number.isFinite(now.getTime())) return { ok: false, reason: "INVALID_INTENT" };
  if (plan.intent.month < CHAT_REPLY_STATUS_COVERAGE_MONTH) return { ok: false, reason: "HISTORICAL_COVERAGE_UNSUPPORTED" };
  if (plan.intent.month > bangkokMonth(now)) return { ok: false, reason: "FUTURE_MONTH_UNAVAILABLE" };
  return null;
}

function isQueryTimeout(error: unknown): boolean {
  if (!isObject(error)) return false;
  const meta = isObject(error.meta) ? error.meta : null;
  return error.code === "P2024" || error.code === "P2028" || error.code === "57014" ||
    meta?.code === "57014" || meta?.database_error_code === "57014";
}

/**
 * Executes a prepared deterministic KPI intent against the established monthly summary only.
 * The call is read-only, scope-bound, time-bounded and intentionally not called by receipt recovery.
 */
@Injectable()
export class SunnSecretaryReadOnlyKpiService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SUNN_SECRETARY_SUMMARY_READER) private readonly summaryReader: SunnSecretarySummaryReader,
  ) {}

  protected currentTime(): Date { return new Date(); }

  async executePrepared(request: SunnSecretaryExecutionRequest): Promise<SunnSecretaryKpiResult> {
    if (request.state !== "PREPARED") return { ok: false, reason: "COMMAND_NOT_PREPARED" };
    if (process.env.SUNN_SECRETARY_WEBHOOK_ENABLED !== "true") return { ok: false, reason: "WEBHOOK_DISABLED" };

    let plan: InboundPlan;
    try { plan = parseInboundPlan(JSON.stringify(request.plan) ?? ""); }
    catch { return { ok: false, reason: "INVALID_INTENT" }; }

    const now = this.currentTime();
    const invalidIntent = validateIntent(plan, now);
    if (invalidIntent) return invalidIntent;
    const intent = plan.intent;
    if (!intent || intent.kind !== "UNANSWERED_BY_STORE") return { ok: false, reason: "INVALID_INTENT" };
    const initialScope = resolveAuthorizedScope(plan);
    if (!initialScope.ok) return { ok: false, reason: initialScope.reason };

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // No durable writes are allowed in this transaction, including accidental future additions.
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        await tx.$executeRaw`SET LOCAL statement_timeout = '5000ms'`;

        // Reauthorize immediately before resolving active data scope and reading KPI rows.
        const currentScope = resolveAuthorizedScope(plan);
        if (!currentScope.ok) return currentScope;
        if (currentScope.userId !== initialScope.userId) return { ok: false as const, reason: "UNAUTHORIZED_SENDER" as const };

        const stores = await tx.store.findMany({
          where: { id: { in: currentScope.storeIds }, isActive: true, archivedAt: null },
          select: { id: true },
          take: SUNN_SECRETARY_MAX_SCOPED_STORES + 1,
        });
        const activeStoreIds = new Set(stores.map((store) => store.id));
        if (activeStoreIds.size !== currentScope.storeIds.length || currentScope.storeIds.some((id) => !activeStoreIds.has(id))) {
          return { ok: false as const, reason: "INACTIVE_OR_UNRESOLVED_STORE_SCOPE" as const };
        }

        const oas = await tx.lineOfficialAccount.findMany({
          where: { storeId: { in: currentScope.storeIds }, accountType: "STORE", isActive: true, archivedAt: null },
          select: { id: true, storeId: true },
          take: SUNN_SECRETARY_MAX_ACTIVE_OAS + 1,
        });
        if (oas.length === 0 || oas.length > SUNN_SECRETARY_MAX_ACTIVE_OAS ||
            oas.some((oa) => !oa.storeId || !activeStoreIds.has(oa.storeId)) ||
            currentScope.storeIds.some((storeId) => !oas.some((oa) => oa.storeId === storeId))) {
          return { ok: false as const, reason: "STORE_OA_COVERAGE_UNAVAILABLE" as const };
        }

        const mirrorStates = await tx.lineChatMirrorStoreState.findMany({
          where: { lineOfficialAccountId: { in: oas.map((oa) => oa.id) } },
          select: { lineOfficialAccountId: true, storeId: true, enabled: true, status: true, lastSuccessfulSyncAt: true, lastErrorCode: true },
          take: SUNN_SECRETARY_MAX_ACTIVE_OAS + 1,
        });
        const mirrorByOa = new Map(mirrorStates.map((state) => [state.lineOfficialAccountId, state]));
        const asOf = now.getTime() - SUNN_SECRETARY_MIRROR_FRESHNESS_MS;
        const sourceSyncDates: Date[] = [];
        for (const oa of oas) {
          const state = mirrorByOa.get(oa.id);
          const syncedAt = state?.lastSuccessfulSyncAt;
          if (!state || !state.enabled || state.storeId !== oa.storeId || state.lastErrorCode !== null ||
              (state.status !== "SUCCESS" && state.status !== "RUNNING") || !syncedAt ||
              syncedAt.getTime() < asOf || syncedAt.getTime() > now.getTime()) {
            return { ok: false as const, reason: "MIRROR_DATA_STALE_OR_PARTIAL" as const };
          }
          sourceSyncDates.push(syncedAt);
        }
        if (mirrorStates.length !== oas.length) return { ok: false as const, reason: "MIRROR_DATA_STALE_OR_PARTIAL" as const };

        const summary = await this.summaryReader.read(
          currentScope.storeIds,
          intent.month,
          tx,
          SUNN_SECRETARY_MAX_MONTHLY_CONVERSATIONS,
        );
        const scopeStoreRows = summary.stores.filter((row) => row.storeId !== "focus-seven-store-group");
        const summaryStoreIds = new Set(scopeStoreRows.map((row) => row.storeId));
        if (summaryStoreIds.size !== currentScope.storeIds.length || currentScope.storeIds.some((id) => !summaryStoreIds.has(id))) {
          return { ok: false as const, reason: "SUMMARY_INCONSISTENT_OR_INCOMPLETE" as const };
        }

        const sourceDataAsOf = new Date(Math.min(...sourceSyncDates.map((date) => date.getTime()))).toISOString();
        const dataQuality: SecretaryMonthlyDataQuality = {
          status: "VERIFIED_OPERATIONAL_SNAPSHOT",
          timezone: "Asia/Bangkok",
          operationalCoverageStartMonth: CHAT_REPLY_STATUS_COVERAGE_MONTH,
          sourceDataAsOf,
          mirrorFreshnessWindowHours: 2,
          replyProjection: "CURRENT_FOR_ALL_RETURNED_CONVERSATIONS",
          historicalMessageCompleteness: "NOT_CERTIFIED_BY_RECENT_MIRROR_SYNC",
        };
        try {
          const answer = normalizeMonthlyReplySummary(intent.month, summary, now, dataQuality);
          return { ok: true as const, answer, responseText: formatSunnMonthlyReply(answer) };
        } catch {
          return { ok: false as const, reason: "SUMMARY_INCONSISTENT_OR_INCOMPLETE" as const };
        }
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: 1_000,
        timeout: TRANSACTION_TIMEOUT_MS,
      });
      return result;
    } catch (error) {
      return { ok: false, reason: isQueryTimeout(error) ? "READ_QUERY_TIMEOUT" : "DATA_SOURCE_UNAVAILABLE" };
    }
  }
}
