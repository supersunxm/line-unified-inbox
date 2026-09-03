import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { LineChatSessionService } from "./line-chat-session.service";
import type { LineChatDiscoveredChat } from "./line-chat.types";
import {
  isLineChatRealtimeResolverEligible,
} from "./line-chat-pilot.constants";
import type { LineChatProfileOperationContext } from "./line-chat-profile-operation-coordinator.service";

const MATCH_TOLERANCE_MS = 60_000;
const MAX_RECENT_PAGES = 5;
const MAX_RECENT_CHATS = 125;

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

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LineChatSessionService) private readonly sessionService: LineChatSessionService,
  ) {}

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
      return { status: "RESOLVE_TRANSPORT" };
    }
    if (recent.status === "FAILED") {
      return { status: recent.failureReason === "SESSION_AUTH" ? "RESOLVE_SESSION_AUTH" : "RESOLVE_TRANSPORT" };
    }

    const targetName = normalizeName(conversation.customer.displayName);
    const targetMessage = conversation.messages[0]?.sentAt;
    const targetTimestamp = targetMessage ?? conversation.latestMessageAt;
    const targetTimestampSource: ResolverTargetTimestampSource = targetMessage
      ? "MESSAGE_SENT_AT"
      : "CONVERSATION_LATEST_MESSAGE_AT";

    // A tag save already identifies the target customer. For the pilot, resolve
    // the OA Manager chat by a unique normalized customer-name match only.
    // Message/event timestamps remain diagnostic context and never determine
    // whether a candidate is selected.
    const candidates = targetName
      ? recent.chats.filter((chat) => normalizeName(chat.displayName) === targetName)
      : [];

    if (candidates.length === 0) {
      this.emitDiagnostic(buildDiagnostic(
        conversation.id,
        recent.chats,
        targetName,
        targetTimestamp,
        targetTimestampSource,
        "RESOLVE_NO_MATCH",
      ));
      return { status: "RESOLVE_NO_MATCH" };
    }
    if (candidates.length > 1) {
      this.emitDiagnostic(buildDiagnostic(
        conversation.id,
        recent.chats,
        targetName,
        targetTimestamp,
        targetTimestampSource,
        "RESOLVE_AMBIGUOUS",
      ));
      return { status: "RESOLVE_AMBIGUOUS" };
    }
    const resolvedId = candidates[0].chatUserId;

    try {
      const mappingResult = await this.prisma.$transaction(async (tx) => {
        const conflict = await tx.conversation.findFirst({
          where: {
            lineOfficialAccountId: input.lineOfficialAccountId,
            lineChatUserId: resolvedId,
            id: { not: conversation.id },
          },
          select: { id: true },
        });
        if (conflict) return { status: "RESOLVE_CONFLICT" } as const;

        const write = await tx.conversation.updateMany({
          where: {
            id: conversation.id,
            lineOfficialAccountId: input.lineOfficialAccountId,
            lineChatUserId: null,
          },
          data: { lineChatUserId: resolvedId },
        });
        if (write.count === 1) return { status: "RESOLVED", lineChatUserId: resolvedId } as const;

        const current = await tx.conversation.findUnique({
          where: { id: conversation.id },
          select: { lineOfficialAccountId: true, lineChatUserId: true },
        });
        return current?.lineOfficialAccountId === input.lineOfficialAccountId
          && current.lineChatUserId?.trim() === resolvedId
          ? { status: "RESOLVED", lineChatUserId: resolvedId } as const
          : { status: "RESOLVE_CONFLICT" } as const;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      this.emitDiagnostic(buildDiagnostic(
        conversation.id,
        recent.chats,
        targetName,
        targetTimestamp,
        targetTimestampSource,
        mappingResult.status,
      ));
      return mappingResult;
    } catch {
      const mappingResult = { status: "RESOLVE_CONFLICT" } as const;
      this.emitDiagnostic(buildDiagnostic(
        conversation.id,
        recent.chats,
        targetName,
        targetTimestamp,
        targetTimestampSource,
        mappingResult.status,
      ));
      return mappingResult;
    }
  }

  private emitDiagnostic(diagnostic: LineChatRecentResolverDiagnostic): void {
    this.logger.log(JSON.stringify(diagnostic));
  }
}
