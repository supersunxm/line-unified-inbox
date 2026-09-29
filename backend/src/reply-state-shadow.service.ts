import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import {
  normalizeReplyTimeline,
  resolveReplyState,
  type CanonicalReplyMessage,
  type HistoricalReplyMessage,
  type ReplyEventDirection,
} from "./reply-state-resolver";

const shadowConversationSelect = {
  id: true,
  storeId: true,
  lineOfficialAccountId: true,
  lineChatUserId: true,
  bmReplyStatus: true,
  replyStateProjection: {
    select: {
      state: true,
      decidingEventKind: true,
      decidingEventAt: true,
      evidenceBoundary: true,
      resolverVersion: true,
      canonicalMessageCount: true,
      historicalMessageCount: true,
      computedAt: true,
      updatedAt: true,
    },
  },
  messages: {
    orderBy: [{ sentAt: "asc" as const }, { id: "asc" as const }],
    select: {
      id: true,
      externalMessageId: true,
      direction: true,
      deliveryStatus: true,
      originalText: true,
      sentAt: true,
      senderUserId: true,
      senderDisplayName: true,
      rawPayload: true,
    },
  },
} satisfies Prisma.ConversationSelect;

type ShadowConversation = Prisma.ConversationGetPayload<{
  select: typeof shadowConversationSelect;
}>;

type HistoricalIdentity = {
  storeId: string;
  lineOfficialAccountId: string;
  historicalLineChatUserId: string;
};

export type ReplyStateShadowLinkMode =
  | "NONE"
  | "CROSSWALK"
  | "DIRECT_UNIQUE"
  | "CROSSWALK_AND_DIRECT";

export type ReplyStateShadowResult = {
  conversationId: string;
  storedBmReplyStatus: string;
  resolvedReplyState: "REPLIED" | "NOT_REPLIED" | "AMBIGUOUS";
  mismatch: boolean;
  confidence: "DETERMINISTIC" | "AMBIGUOUS";
  ambiguityReason: string | null;
  latestCycle: {
    startedAt: Date;
    answeredAt: Date | null;
    durationSeconds: number | null;
  } | null;
  persistedProjection: {
    state: "REPLIED" | "NOT_REPLIED";
    decidingEventKind: "CUSTOMER_INBOUND" | "HUMAN_STAFF_REPLY";
    decidingEventAt: Date;
    evidenceBoundary: Date;
    resolverVersion: string;
    canonicalMessageCount: number;
    historicalMessageCount: number;
    computedAt: Date;
    updatedAt: Date;
  } | null;
  projectionMatchesDynamic: boolean | null;
  evidence: {
    canonicalMessageCount: number;
    historicalMessageCount: number;
    historicalLinkMode: ReplyStateShadowLinkMode;
    safeCrosswalkCount: number;
    directIdentityUnique: boolean;
    linkageConflict: boolean;
    unknownOutboundActorCount: number;
  };
  databaseWrites: 0;
};

function direction(value: string): ReplyEventDirection {
  if (value === "INBOUND" || value === "OUTBOUND" || value === "SYSTEM") return value;
  throw new Error("Unexpected message direction: " + value);
}

function identityKey(identity: HistoricalIdentity): string {
  return [
    identity.storeId,
    identity.lineOfficialAccountId,
    identity.historicalLineChatUserId,
  ].join("\u0000");
}

function uniqueIdentities(items: readonly HistoricalIdentity[]): HistoricalIdentity[] {
  return [...new Map(items.map((item) => [identityKey(item), item])).values()];
}

@Injectable()
export class ReplyStateShadowService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveConversation(conversationId: string): Promise<ReplyStateShadowResult> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: shadowConversationSelect,
    });
    if (!conversation) throw new NotFoundException("Conversation not found");

    return this.resolveLoadedConversation(conversation);
  }

  private async resolveLoadedConversation(
    conversation: ShadowConversation,
  ): Promise<ReplyStateShadowResult> {
    const safeCrosswalks = await this.prisma.historicalConversationCrosswalk.findMany({
      where: {
        canonicalConversationId: conversation.id,
        classification: "LINK_SAFE",
        evidenceType: "SOURCE_EVENT_ID",
        anchorCount: { gt: 0 },
      },
      select: {
        storeId: true,
        lineOfficialAccountId: true,
        historicalLineChatUserId: true,
      },
    });

    const directIdentity: HistoricalIdentity | null =
      conversation.storeId && conversation.lineChatUserId
        ? {
            storeId: conversation.storeId,
            lineOfficialAccountId: conversation.lineOfficialAccountId,
            historicalLineChatUserId: conversation.lineChatUserId,
          }
        : null;

    let directIdentityUnique = false;
    let linkageConflict = false;

    if (directIdentity) {
      const [directCandidates, persistedCrosswalk] = await Promise.all([
        this.prisma.conversation.findMany({
          where: {
            storeId: directIdentity.storeId,
            lineOfficialAccountId: directIdentity.lineOfficialAccountId,
            lineChatUserId: directIdentity.historicalLineChatUserId,
          },
          select: { id: true },
          take: 2,
        }),
        this.prisma.historicalConversationCrosswalk.findFirst({
          where: {
            storeId: directIdentity.storeId,
            lineOfficialAccountId: directIdentity.lineOfficialAccountId,
            historicalLineChatUserId: directIdentity.historicalLineChatUserId,
          },
          select: {
            classification: true,
            canonicalConversationId: true,
            evidenceType: true,
            anchorCount: true,
          },
        }),
      ]);

      directIdentityUnique =
        directCandidates.length === 1 &&
        directCandidates[0]?.id === conversation.id;

      const persistedSafeTarget =
        persistedCrosswalk?.classification === "LINK_SAFE" &&
        persistedCrosswalk.evidenceType === "SOURCE_EVENT_ID" &&
        persistedCrosswalk.anchorCount > 0
          ? persistedCrosswalk.canonicalConversationId
          : null;

      if (
        directIdentityUnique &&
        persistedSafeTarget &&
        persistedSafeTarget !== conversation.id
      ) {
        linkageConflict = true;
        directIdentityUnique = false;
      }
    }

    const crosswalkIdentities: HistoricalIdentity[] = safeCrosswalks.map((link) => ({
      storeId: link.storeId,
      lineOfficialAccountId: link.lineOfficialAccountId,
      historicalLineChatUserId: link.historicalLineChatUserId,
    }));

    const historicalIdentities = uniqueIdentities([
      ...crosswalkIdentities,
      ...(directIdentity && directIdentityUnique ? [directIdentity] : []),
    ]);

    const historicalRows = historicalIdentities.length === 0
      ? []
      : await this.prisma.historicalTimelineMessage.findMany({
          where: {
            OR: historicalIdentities.map((identity) => ({
              storeId: identity.storeId,
              lineOfficialAccountId: identity.lineOfficialAccountId,
              lineChatUserId: identity.historicalLineChatUserId,
            })),
          },
          orderBy: [{ sentAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            sourceEventId: true,
            sourceEventType: true,
            direction: true,
            text: true,
            sentAt: true,
            senderBizId: true,
          },
        });

    const canonical: CanonicalReplyMessage[] = conversation.messages.map((message) => ({
      id: message.id,
      externalMessageId: message.externalMessageId,
      direction: direction(message.direction),
      deliveryStatus: message.deliveryStatus,
      originalText: message.originalText,
      sentAt: message.sentAt,
      senderUserId: message.senderUserId,
      senderDisplayName: message.senderDisplayName,
      rawPayload: message.rawPayload,
    }));

    const historical: HistoricalReplyMessage[] = historicalRows.map((message) => ({
      id: message.id,
      sourceEventId: message.sourceEventId,
      sourceEventType: message.sourceEventType,
      direction: direction(message.direction),
      text: message.text,
      sentAt: message.sentAt,
      senderBizId: message.senderBizId,
    }));

    const timeline = normalizeReplyTimeline({ canonical, historical });
    const resolution = resolveReplyState(timeline);
    const hasCrosswalkEvidence = safeCrosswalks.length > 0 && historical.length > 0;
    const hasDirectEvidence = Boolean(directIdentityUnique && historical.length > 0);
    const historicalLinkMode: ReplyStateShadowLinkMode =
      hasCrosswalkEvidence && hasDirectEvidence
        ? "CROSSWALK_AND_DIRECT"
        : hasCrosswalkEvidence
          ? "CROSSWALK"
          : hasDirectEvidence
            ? "DIRECT_UNIQUE"
            : "NONE";

    return {
      conversationId: conversation.id,
      storedBmReplyStatus: conversation.bmReplyStatus,
      resolvedReplyState: resolution.state,
      mismatch:
        resolution.state !== "AMBIGUOUS" &&
        conversation.bmReplyStatus !== resolution.state,
      confidence: resolution.confidence,
      ambiguityReason:
        resolution.state === "AMBIGUOUS" ? resolution.reason : null,
      latestCycle:
        resolution.state === "AMBIGUOUS" ? null : resolution.latestCycle,
      persistedProjection: conversation.replyStateProjection,
      projectionMatchesDynamic:
        conversation.replyStateProjection === null || resolution.state === "AMBIGUOUS"
          ? null
          : conversation.replyStateProjection.state === resolution.state,
      evidence: {
        canonicalMessageCount: canonical.length,
        historicalMessageCount: historical.length,
        historicalLinkMode,
        safeCrosswalkCount: safeCrosswalks.length,
        directIdentityUnique,
        linkageConflict,
        unknownOutboundActorCount: timeline.filter(
          (event) => event.direction === "OUTBOUND" && event.actor === "UNKNOWN",
        ).length,
      },
      databaseWrites: 0,
    };
  }
}
