import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { LineChatSessionService } from "./line-chat-session.service";
import {
  LINE_CHAT_PILOT_BOT_ID,
  LINE_CHAT_PILOT_OA_NAME,
  LINE_CHAT_PILOT_SESSION_KEY,
  LINE_CHAT_PILOT_STORE_CODE,
} from "./line-chat-pilot.constants";

const MATCH_TOLERANCE_MS = 60_000;
const MAX_RECENT_PAGES = 5;
const MAX_RECENT_CHATS = 125;

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
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}

function pilotStoreCode(store: { code: string | null; storeMaster: { externalStoreId: string | null } | null } | null): string {
  return store?.code?.trim() || store?.storeMaster?.externalStoreId?.trim() || "";
}

@Injectable()
export class LineChatRecentResolverService {
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
            lineChatSession: { select: { sessionKey: true } },
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
    const identityMatches = pilotStoreCode(conversation.store) === LINE_CHAT_PILOT_STORE_CODE
      && conversation.storeId !== null
      && oa.storeId === conversation.storeId
      && oa.accountType === "STORE"
      && oa.isActive
      && oa.archivedAt === null
      && oa.name.trim() === LINE_CHAT_PILOT_OA_NAME
      && oa.chatBotId?.trim() === LINE_CHAT_PILOT_BOT_ID
      && oa.lineChatSession?.sessionKey.trim() === LINE_CHAT_PILOT_SESSION_KEY
      && input.botId.trim() === LINE_CHAT_PILOT_BOT_ID
      && input.sessionKey.trim() === LINE_CHAT_PILOT_SESSION_KEY;
    if (!identityMatches) return { status: "RESOLVE_CONFLICT" };

    let recent;
    try {
      recent = await this.sessionService.discoverRecentChats({
        botId: input.botId,
        profilePath: input.profilePath,
        headless: true,
        maxPages: MAX_RECENT_PAGES,
        maxChats: MAX_RECENT_CHATS,
      });
    } catch {
      return { status: "RESOLVE_TRANSPORT" };
    }
    if (recent.status === "FAILED") {
      return { status: recent.failureReason === "SESSION_AUTH" ? "RESOLVE_SESSION_AUTH" : "RESOLVE_TRANSPORT" };
    }

    const targetName = normalizeName(conversation.customer.displayName);
    const targetTimestamp = conversation.messages[0]?.sentAt ?? conversation.latestMessageAt;
    const candidates = recent.chats.filter((chat) => {
      if (!targetName || normalizeName(chat.displayName) !== targetName || !chat.lastMessageAt) return false;
      const candidateTime = new Date(chat.lastMessageAt).getTime();
      return Number.isFinite(candidateTime)
        && Math.abs(candidateTime - targetTimestamp.getTime()) <= MATCH_TOLERANCE_MS;
    });

    if (candidates.length === 0) return { status: "RESOLVE_NO_MATCH" };
    if (candidates.length > 1) return { status: "RESOLVE_AMBIGUOUS" };
    const resolvedId = candidates[0].chatUserId;

    try {
      return await this.prisma.$transaction(async (tx) => {
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
    } catch {
      return { status: "RESOLVE_CONFLICT" };
    }
  }
}
