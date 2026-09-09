import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { LineChatSessionService } from "./line-chat-session.service";
import type { LineChatDiscoveredChat } from "./line-chat.types";
import {
  isLineChatRealtimeResolverEligible,
} from "./line-chat-pilot.constants";
import type { LineChatRealtimeResolverEligibilityParams } from "./line-chat-pilot.constants";
import type { LineChatProfileOperationContext } from "./line-chat-profile-operation-coordinator.service";

const MATCH_TOLERANCE_MS = 60_000;
const MAX_RECENT_PAGES = 5;
const MAX_RECENT_CHATS = 125;
export const RECENT_MAPPING_CACHE_TTL_MS = 60_000;
const RECENT_MAPPING_FAILURE_CACHE_TTL_MS = 30_000;

export type ResolverTargetTimestampSource = "MESSAGE_SENT_AT" | "CONVERSATION_LATEST_MESSAGE_AT";
export type ResolverTimestampDeltaBucket =
  | "<=15s"
  | "16s-30s"
  | "31s-60s"
  | "1m-2m"
  | "2m-5m"
  | "5m-15m"
  | "15m-60m"
  | ">60m"
  | "NO_VALID_TIMESTAMP";

export interface LineChatRecentResolverDiagnostic {
  event: "line_chat_recent_resolver_diagnostic";
  resolutionStatus: LineChatRecentResolutionResult["status"];
  conversationId: string;
  recentChatCount: number;
  validTimestampChatCount: number;
  exactNameMatchCount: number;
  timestampWithinToleranceCount: number;
  combinedMatchCount: number;
  closestExactNameTimestampDeltaBucket: ResolverTimestampDeltaBucket;
  targetTimestampSource: ResolverTargetTimestampSource;
  exactNameWithMissingTimestampCount: number;
}

export type LineChatRecentResolutionResult =
  | { status: "RESOLVED"; lineChatUserId: string }
  | { status: "RESOLVE_NO_MATCH" }
  | { status: "RESOLVE_AMBIGUOUS" }
  | { status: "RESOLVE_CONFLICT" }
  | { status: "RESOLVE_SESSION_AUTH" }
  | { status: "RESOLVE_TRANSPORT" };

export interface ResolveRecentLineChatInput {
  conversationId: string;
  lineOfficialAccountId: string;
  botId: string;
  sessionKey: string;
  profilePath: string;
  operationContext?: LineChatProfileOperationContext;
}

export interface RefreshRecentLineChatInput {
  lineOfficialAccountId: string;
  botId: string;
  sessionKey: string;
  profilePath: string;
  force?: boolean;
  operationContext?: LineChatProfileOperationContext;
}

export interface LineChatRecentMappingSnapshot {
  key: string;
  status: "READY" | "FAILED";
  chats: readonly LineChatDiscoveredChat[];
  refreshedAt: Date;
  expiresAt: Date;
  failureReason?: "SESSION_AUTH" | "TRANSPORT";
  pagesFetched: number;
  totalRawRecords: number;
}

export interface LineChatMappingBatchResult {
  status: "REFRESHED" | "RESOLVE_SESSION_AUTH" | "RESOLVE_TRANSPORT";
  conversationCount: number;
  candidateCount: number;
  mappedCount: number;
  noMatchCount: number;
  ambiguousCount: number;
  conflictCount: number;
  unresolvedReasons: Map<string, "RESOLVE_NO_MATCH" | "RESOLVE_AMBIGUOUS" | "RESOLVE_CONFLICT">;
}

export type LineChatMappingEligibility = Pick<
  LineChatRealtimeResolverEligibilityParams,
  | "oaStoreId"
  | "oaAccountType"
  | "oaIsActive"
  | "oaArchivedAt"
  | "oaChatBotId"
  | "oaSessionKey"
  | "oaSessionStatus"
  | "expectedBotId"
  | "expectedSessionKey"
>;

type ResolverConversation = {
  id: string;
  storeId: string | null;
  lineOfficialAccountId: string;
  lineChatUserId: string | null;
  latestMessageAt: Date;
  customer: { displayName: string };
  messages: Array<{ sentAt: Date }>;
  store: { code: string | null; storeMaster: { externalStoreId: string | null } | null } | null;
  lineOfficialAccount: {
    name: string;
    storeId: string | null;
    accountType: string;
    isActive: boolean;
    archivedAt: Date | null;
    chatBotId: string | null;
    lineChatSession: { sessionKey: string; status: string } | null;
  };
};

type BatchMappingConversation = {
  id: string;
  storeId: string | null;
  lineOfficialAccountId: string;
  lineChatUserId: string | null;
  customer: { displayName: string };
  store: { code: string | null; storeMaster: { externalStoreId: string | null } | null } | null;
};

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}

function pilotStoreCode(store: { code: string | null; storeMaster: { externalStoreId: string | null } | null } | null): string {
  return store?.code?.trim() || store?.storeMaster?.externalStoreId?.trim() || "";
}

function timestampDeltaBucket(deltaMs: number | null): ResolverTimestampDeltaBucket {
  if (deltaMs === null || !Number.isFinite(deltaMs)) return "NO_VALID_TIMESTAMP";
  if (deltaMs <= 15_000) return "<=15s";
  if (deltaMs <= 30_000) return "16s-30s";
  if (deltaMs <= 60_000) return "31s-60s";
  if (deltaMs <= 120_000) return "1m-2m";
  if (deltaMs <= 300_000) return "2m-5m";
  if (deltaMs <= 900_000) return "5m-15m";
  if (deltaMs <= 3_600_000) return "15m-60m";
  return ">60m";
}

function buildDiagnostic(
  conversationId: string,
  recentChats: readonly LineChatDiscoveredChat[],
  targetName: string,
  targetTimestamp: Date,
  targetTimestampSource: ResolverTargetTimestampSource,
  resolutionStatus: LineChatRecentResolutionResult["status"],
): LineChatRecentResolverDiagnostic {
  const targetMs = targetTimestamp.getTime();
  const targetIsValid = Number.isFinite(targetMs);
  const validTimestampChatCount = recentChats.filter((chat) => {
    const value = chat.lastMessageAt ? new Date(chat.lastMessageAt).getTime() : NaN;
    return Number.isFinite(value);
  }).length;
  const exactNameChats = targetName
    ? recentChats.filter((chat) => normalizeName(chat.displayName) === targetName)
    : [];
  const timestampWithinToleranceCount = targetIsValid
    ? recentChats.filter((chat) => {
      const value = chat.lastMessageAt ? new Date(chat.lastMessageAt).getTime() : NaN;
      return Number.isFinite(value) && Math.abs(value - targetMs) <= MATCH_TOLERANCE_MS;
    }).length
    : 0;
  const combinedMatchCount = targetIsValid
    ? exactNameChats.filter((chat) => {
      const value = chat.lastMessageAt ? new Date(chat.lastMessageAt).getTime() : NaN;
      return Number.isFinite(value) && Math.abs(value - targetMs) <= MATCH_TOLERANCE_MS;
    }).length
    : 0;
  const exactNameDeltas = exactNameChats
    .map((chat) => {
      const value = chat.lastMessageAt ? new Date(chat.lastMessageAt).getTime() : NaN;
      return targetIsValid && Number.isFinite(value) ? Math.abs(value - targetMs) : null;
    })
    .filter((value): value is number => value !== null);
  const closestDelta = exactNameDeltas.length > 0 ? Math.min(...exactNameDeltas) : null;
  return {
    event: "line_chat_recent_resolver_diagnostic",
    resolutionStatus,
    conversationId,
    recentChatCount: recentChats.length,
    validTimestampChatCount,
    exactNameMatchCount: exactNameChats.length,
    timestampWithinToleranceCount,
    combinedMatchCount,
    closestExactNameTimestampDeltaBucket: timestampDeltaBucket(closestDelta),
    targetTimestampSource,
    exactNameWithMissingTimestampCount: exactNameChats.length - exactNameDeltas.length,
  };
}

@Injectable()
export class LineChatRecentResolverService {
  private readonly logger = new Logger(LineChatRecentResolverService.name);
  private readonly snapshots = new Map<string, LineChatRecentMappingSnapshot>();
  private readonly refreshes = new Map<string, Promise<LineChatRecentMappingSnapshot>>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LineChatSessionService) private readonly sessionService: LineChatSessionService,
  ) {}

  /**
   * Returns the durable mapping first. This is intentionally a cheap read and
   * is used by the nickname worker before it considers any browser work.
   */
  public async findExistingMapping(input: {
    conversationId: string;
    lineOfficialAccountId: string;
  }): Promise<string | null> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: input.conversationId },
      select: { lineOfficialAccountId: true, lineChatUserId: true },
    });
    if (!conversation || conversation.lineOfficialAccountId !== input.lineOfficialAccountId) return null;
    return conversation.lineChatUserId?.trim() || null;
  }

  public async findExistingMappings(input: {
    conversationIds: readonly string[];
    lineOfficialAccountId?: string;
  }): Promise<Map<string, string>> {
    const conversationIds = [...new Set(input.conversationIds)].filter(Boolean);
    if (conversationIds.length === 0) return new Map();
    const rows = await this.prisma.conversation.findMany({
      where: {
        id: { in: conversationIds },
        ...(input.lineOfficialAccountId ? { lineOfficialAccountId: input.lineOfficialAccountId } : {}),
        lineChatUserId: { not: null },
      },
      select: { id: true, lineChatUserId: true },
    });
    return new Map(rows.flatMap((row) => row.lineChatUserId?.trim() ? [[row.id, row.lineChatUserId.trim()] as const] : []));
  }

  /**
   * Performs one bounded recent-chat scan per OA/session key. Concurrent callers
   * share the same in-flight scan and a fresh snapshot is reused for one minute.
   */
  public async refreshSnapshot(input: RefreshRecentLineChatInput): Promise<LineChatRecentMappingSnapshot> {
    const key = this.snapshotKey(input);
    const now = Date.now();
    const cached = this.snapshots.get(key);
    if (!input.force && cached && cached.expiresAt.getTime() > now) return cached;

    const inFlight = this.refreshes.get(key);
    if (inFlight) return inFlight;

    const refresh = this.performSnapshotRefresh(input, key);
    this.refreshes.set(key, refresh);
    try {
      return await refresh;
    } finally {
      if (this.refreshes.get(key) === refresh) this.refreshes.delete(key);
    }
  }

  /**
   * Applies one snapshot to many unresolved conversations. Every write is
   * guarded by OA identity, a null mapping, and same-OA candidate uniqueness.
   */
  public async applySnapshotMappings(input: {
    lineOfficialAccountId: string;
    conversationIds: readonly string[];
    snapshot: LineChatRecentMappingSnapshot;
    eligibility: LineChatMappingEligibility;
  }): Promise<LineChatMappingBatchResult> {
    if (input.snapshot.status === "FAILED") {
      return {
        status: input.snapshot.failureReason === "SESSION_AUTH" ? "RESOLVE_SESSION_AUTH" : "RESOLVE_TRANSPORT",
        conversationCount: 0,
        candidateCount: 0,
        mappedCount: 0,
        noMatchCount: 0,
        ambiguousCount: 0,
        conflictCount: 0,
        unresolvedReasons: new Map(),
      };
    }

    const conversationIds = [...new Set(input.conversationIds)].filter(Boolean);
    if (conversationIds.length === 0) {
      return {
        status: "REFRESHED",
        conversationCount: 0,
        candidateCount: 0,
        mappedCount: 0,
        noMatchCount: 0,
        ambiguousCount: 0,
        conflictCount: 0,
        unresolvedReasons: new Map(),
      };
    }

    const conversations = await this.prisma.conversation.findMany({
      where: {
        id: { in: conversationIds },
        lineOfficialAccountId: input.lineOfficialAccountId,
        lineChatUserId: null,
      },
      select: {
        id: true,
        storeId: true,
        lineOfficialAccountId: true,
        lineChatUserId: true,
        customer: { select: { displayName: true } },
        store: {
          select: {
            code: true,
            storeMaster: { select: { externalStoreId: true } },
          },
        },
      },
    }) as BatchMappingConversation[];

    const candidatesByName = new Map<string, LineChatDiscoveredChat[]>();
    for (const chat of input.snapshot.chats) {
      const name = normalizeName(chat.displayName);
      if (!name) continue;
      const candidates = candidatesByName.get(name) ?? [];
      candidates.push(chat);
      candidatesByName.set(name, candidates);
    }

    const result: LineChatMappingBatchResult = {
      status: "REFRESHED",
      conversationCount: conversations.length,
      candidateCount: 0,
      mappedCount: 0,
      noMatchCount: 0,
      ambiguousCount: 0,
      conflictCount: 0,
      unresolvedReasons: new Map(),
    };
    const proposed = new Map<string, string>();
    const proposedByChatId = new Map<string, string>();
    for (const conversation of conversations) {
      if (!isLineChatRealtimeResolverEligible({
        storeCode: pilotStoreCode(conversation.store),
        conversationStoreId: conversation.storeId,
        ...input.eligibility,
      })) {
        result.conflictCount++;
        result.unresolvedReasons.set(conversation.id, "RESOLVE_CONFLICT");
        continue;
      }
      const candidates = candidatesByName.get(normalizeName(conversation.customer.displayName)) ?? [];
      if (candidates.length === 0) {
        result.noMatchCount++;
        result.unresolvedReasons.set(conversation.id, "RESOLVE_NO_MATCH");
        continue;
      }
      if (candidates.length > 1) {
        result.ambiguousCount++;
        result.unresolvedReasons.set(conversation.id, "RESOLVE_AMBIGUOUS");
        continue;
      }
      result.candidateCount++;
      const chatUserId = candidates[0].chatUserId;
      const previousConversationId = proposedByChatId.get(chatUserId);
      if (previousConversationId) {
        proposed.delete(previousConversationId);
        result.conflictCount++;
        result.unresolvedReasons.set(previousConversationId, "RESOLVE_CONFLICT");
        result.unresolvedReasons.set(conversation.id, "RESOLVE_CONFLICT");
        continue;
      }
      proposed.set(conversation.id, chatUserId);
      proposedByChatId.set(chatUserId, conversation.id);
    }

    if (proposed.size === 0) return result;

    const existingMappings = await this.prisma.conversation.findMany({
      where: {
        lineOfficialAccountId: input.lineOfficialAccountId,
        lineChatUserId: { in: [...proposed.values()] },
      },
      select: { id: true, lineChatUserId: true },
    });
    const existingByChatId = new Map(existingMappings.flatMap((row) => row.lineChatUserId ? [[row.lineChatUserId, row.id] as const] : []));

    await this.prisma.$transaction(async (tx) => {
      for (const [conversationId, lineChatUserId] of proposed) {
        const existingConversationId = existingByChatId.get(lineChatUserId);
        if (existingConversationId && existingConversationId !== conversationId) {
          result.conflictCount++;
          result.unresolvedReasons.set(conversationId, "RESOLVE_CONFLICT");
          continue;
        }
        const conflict = await tx.conversation.findFirst({
          where: {
            lineOfficialAccountId: input.lineOfficialAccountId,
            lineChatUserId,
            id: { not: conversationId },
          },
          select: { id: true },
        });
        if (conflict) {
          result.conflictCount++;
          result.unresolvedReasons.set(conversationId, "RESOLVE_CONFLICT");
          continue;
        }
        const write = await tx.conversation.updateMany({
          where: {
            id: conversationId,
            lineOfficialAccountId: input.lineOfficialAccountId,
            lineChatUserId: null,
          },
          data: { lineChatUserId },
        });
        if (write.count === 1) {
          result.mappedCount++;
          continue;
        }
        const current = await tx.conversation.findUnique({
          where: { id: conversationId },
          select: { lineOfficialAccountId: true, lineChatUserId: true },
        });
        if (current?.lineOfficialAccountId !== input.lineOfficialAccountId || current.lineChatUserId !== lineChatUserId) {
          result.conflictCount++;
          result.unresolvedReasons.set(conversationId, "RESOLVE_CONFLICT");
        }
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return result;
  }

  public async resolve(input: ResolveRecentLineChatInput): Promise<LineChatRecentResolutionResult> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: input.conversationId },
      select: {
        id: true,
        storeId: true,
        lineOfficialAccountId: true,
        lineChatUserId: true,
        latestMessageAt: true,
        customer: { select: { displayName: true } },
        messages: {
          orderBy: { sentAt: "desc" },
          take: 1,
          select: { sentAt: true },
        },
        store: {
          select: {
            code: true,
            storeMaster: { select: { externalStoreId: true } },
          },
        },
        lineOfficialAccount: {
          select: {
            name: true,
            storeId: true,
            accountType: true,
            isActive: true,
            archivedAt: true,
            chatBotId: true,
            lineChatSession: { select: { sessionKey: true, status: true } },
          },
        },
      },
    });

    if (!conversation || conversation.lineOfficialAccountId !== input.lineOfficialAccountId) {
      return { status: "RESOLVE_CONFLICT" };
    }
    if (conversation.lineChatUserId?.trim()) {
      return { status: "RESOLVED", lineChatUserId: conversation.lineChatUserId.trim() };
    }

    const oa = conversation.lineOfficialAccount;
    const storeCode = pilotStoreCode(conversation.store);
    const eligible = isLineChatRealtimeResolverEligible({
      storeCode,
      conversationStoreId: conversation.storeId,
      oaStoreId: oa.storeId,
      oaAccountType: oa.accountType,
      oaIsActive: oa.isActive,
      oaArchivedAt: oa.archivedAt,
      oaChatBotId: oa.chatBotId,
      oaSessionKey: oa.lineChatSession?.sessionKey,
      oaSessionStatus: oa.lineChatSession?.status,
      expectedBotId: input.botId,
      expectedSessionKey: input.sessionKey,
    });
    if (!eligible) return { status: "RESOLVE_CONFLICT" };

    const targetName = normalizeName(conversation.customer.displayName);
    const targetMessage = conversation.messages[0]?.sentAt;
    const targetTimestamp = targetMessage ?? conversation.latestMessageAt;
    const targetTimestampSource: ResolverTargetTimestampSource = targetMessage
      ? "MESSAGE_SENT_AT"
      : "CONVERSATION_LATEST_MESSAGE_AT";

    let snapshot = this.getFreshSnapshot({
      lineOfficialAccountId: input.lineOfficialAccountId,
      botId: input.botId,
      sessionKey: input.sessionKey,
      profilePath: input.profilePath,
    });
    const usedExistingSnapshot = Boolean(snapshot);
    snapshot ??= await this.refreshSnapshot({ ...input, force: false });

    let result = await this.resolveFromSnapshot(conversation, input, snapshot, targetName, targetTimestamp, targetTimestampSource);
    // A background NO_MATCH snapshot is deliberately not allowed to make a
    // customer relay stale. Relay resolution gets one fresh bounded read.
    if (usedExistingSnapshot && ["RESOLVE_NO_MATCH", "RESOLVE_AMBIGUOUS", "RESOLVE_TRANSPORT"].includes(result.status)) {
      snapshot = await this.refreshSnapshot({ ...input, force: true });
      result = await this.resolveFromSnapshot(conversation, input, snapshot, targetName, targetTimestamp, targetTimestampSource);
    }
    return result;
  }

  private snapshotKey(input: Pick<RefreshRecentLineChatInput, "lineOfficialAccountId" | "botId" | "sessionKey">): string {
    return `${input.sessionKey.trim()}::${input.lineOfficialAccountId.trim()}::${input.botId.trim()}`;
  }

  private getFreshSnapshot(input: Pick<RefreshRecentLineChatInput, "lineOfficialAccountId" | "botId" | "sessionKey" | "profilePath">): LineChatRecentMappingSnapshot | null {
    const snapshot = this.snapshots.get(this.snapshotKey(input));
    return snapshot && snapshot.expiresAt.getTime() > Date.now() ? snapshot : null;
  }

  private async performSnapshotRefresh(
    input: RefreshRecentLineChatInput,
    key: string,
  ): Promise<LineChatRecentMappingSnapshot> {
    let recent;
    try {
      recent = await this.sessionService.discoverRecentChats({
        botId: input.botId,
        profilePath: input.profilePath,
        headless: true,
        maxPages: MAX_RECENT_PAGES,
        maxChats: MAX_RECENT_CHATS,
        operationContext: input.operationContext,
      });
    } catch {
      return this.cacheSnapshot({
        key,
        status: "FAILED",
        chats: [],
        failureReason: "TRANSPORT",
        pagesFetched: 0,
        totalRawRecords: 0,
      });
    }
    if (recent.status === "FAILED") {
      return this.cacheSnapshot({
        key,
        status: "FAILED",
        chats: [],
        failureReason: recent.failureReason === "SESSION_AUTH" ? "SESSION_AUTH" : "TRANSPORT",
        pagesFetched: recent.pagesFetched,
        totalRawRecords: recent.totalRawRecords,
      });
    }
    return this.cacheSnapshot({
      key,
      status: "READY",
      chats: recent.chats,
      pagesFetched: recent.pagesFetched,
      totalRawRecords: recent.totalRawRecords,
    });
  }

  private cacheSnapshot(snapshot: Omit<LineChatRecentMappingSnapshot, "refreshedAt" | "expiresAt">): LineChatRecentMappingSnapshot {
    const refreshedAt = new Date();
    const value: LineChatRecentMappingSnapshot = {
      ...snapshot,
      refreshedAt,
      expiresAt: new Date(refreshedAt.getTime() + (snapshot.status === "READY" ? RECENT_MAPPING_CACHE_TTL_MS : RECENT_MAPPING_FAILURE_CACHE_TTL_MS)),
    };
    this.snapshots.set(snapshot.key, value);
    return value;
  }

  private async resolveFromSnapshot(
    conversation: ResolverConversation,
    input: ResolveRecentLineChatInput,
    snapshot: LineChatRecentMappingSnapshot,
    targetName: string,
    targetTimestamp: Date,
    targetTimestampSource: ResolverTargetTimestampSource,
  ): Promise<LineChatRecentResolutionResult> {
    if (snapshot.status === "FAILED") {
      return snapshot.failureReason === "SESSION_AUTH" ? { status: "RESOLVE_SESSION_AUTH" } : { status: "RESOLVE_TRANSPORT" };
    }
    // A tag save already identifies the target customer. Resolve only by a
    // unique normalized customer-name match; timestamps remain diagnostic.
    const candidates = targetName
      ? snapshot.chats.filter((chat) => normalizeName(chat.displayName) === targetName)
      : [];
    if (candidates.length === 0) {
      const result = { status: "RESOLVE_NO_MATCH" } as const;
      this.emitDiagnostic(buildDiagnostic(conversation.id, snapshot.chats, targetName, targetTimestamp, targetTimestampSource, result.status));
      return result;
    }
    if (candidates.length > 1) {
      const result = { status: "RESOLVE_AMBIGUOUS" } as const;
      this.emitDiagnostic(buildDiagnostic(conversation.id, snapshot.chats, targetName, targetTimestamp, targetTimestampSource, result.status));
      return result;
    }
    const resolvedId = candidates[0].chatUserId;
    let result: LineChatRecentResolutionResult;
    try {
      result = await this.persistCandidateMapping(conversation.id, input.lineOfficialAccountId, resolvedId);
    } catch {
      result = { status: "RESOLVE_TRANSPORT" };
    }
    this.emitDiagnostic(buildDiagnostic(conversation.id, snapshot.chats, targetName, targetTimestamp, targetTimestampSource, result.status));
    return result;
  }

  private async persistCandidateMapping(
    conversationId: string,
    lineOfficialAccountId: string,
    resolvedId: string,
  ): Promise<LineChatRecentResolutionResult> {
    return this.prisma.$transaction(async (tx) => {
      const conflict = await tx.conversation.findFirst({
        where: {
          lineOfficialAccountId,
          lineChatUserId: resolvedId,
          id: { not: conversationId },
        },
        select: { id: true },
      });
      if (conflict) return { status: "RESOLVE_CONFLICT" } as const;
      const write = await tx.conversation.updateMany({
        where: { id: conversationId, lineOfficialAccountId, lineChatUserId: null },
        data: { lineChatUserId: resolvedId },
      });
      if (write.count === 1) return { status: "RESOLVED", lineChatUserId: resolvedId } as const;
      const current = await tx.conversation.findUnique({
        where: { id: conversationId },
        select: { lineOfficialAccountId: true, lineChatUserId: true },
      });
      return current?.lineOfficialAccountId === lineOfficialAccountId && current.lineChatUserId?.trim() === resolvedId
        ? { status: "RESOLVED", lineChatUserId: resolvedId } as const
        : { status: "RESOLVE_CONFLICT" } as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private emitDiagnostic(diagnostic: LineChatRecentResolverDiagnostic): void {
    this.logger.log(JSON.stringify(diagnostic));
  }
}
