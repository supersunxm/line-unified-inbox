import { Inject, Injectable } from "@nestjs/common";
import { LineChatMirrorDirection, LineChatMirrorSyncStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";

export interface LineChatMirrorStoreStatus {
  lineOfficialAccountId: string;
  storeId: string | null;
  storeCode: string;
  enabled: boolean;
  status: LineChatMirrorSyncStatus;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastFailureAt: string | null;
  lastErrorCode: string | null;
  recentChatsObserved: number;
  mirroredChats: number;
  historiesCurrent: number;
  pendingChats: number;
  historyCoveragePercent: number | null;
  messagesStored: number;
  inboundMessages: number;
  outboundMessages: number;
  unknownDirectionMessages: number;
  latestMirroredMessageAt: string | null;
  lastCycleDurationMs: number | null;
}

@Injectable()
export class LineChatMirrorStatusService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async getStatus(): Promise<{
    generatedAt: string;
    summary: {
      stores: number;
      success: number;
      partial: number;
      failed: number;
      mirroredChats: number;
      historiesCurrent: number;
      pendingChats: number;
      historyCoveragePercent: number | null;
      messagesStored: number;
      inboundMessages: number;
      outboundMessages: number;
      unknownDirectionMessages: number;
    };
    stores: LineChatMirrorStoreStatus[];
  }> {
    const states = await this.prisma.lineChatMirrorStoreState.findMany({
      orderBy: [{ storeCode: "asc" }],
    });

    const stores: LineChatMirrorStoreStatus[] = [];
    for (const state of states) {
      const [chats, messageCounts, latestMessage] = await Promise.all([
        this.prisma.lineChatMirrorChat.findMany({
          where: { lineOfficialAccountId: state.lineOfficialAccountId },
          select: {
            lastMessageAt: true,
            historySyncedThroughAt: true,
          },
        }),
        this.prisma.lineChatMirrorMessage.groupBy({
          by: ["direction"],
          where: { lineOfficialAccountId: state.lineOfficialAccountId },
          _count: { _all: true },
        }),
        this.prisma.lineChatMirrorMessage.findFirst({
          where: { lineOfficialAccountId: state.lineOfficialAccountId },
          orderBy: { sentAt: "desc" },
          select: { sentAt: true },
        }),
      ]);

      const current = chats.filter((chat) =>
        chat.lastMessageAt
        && chat.historySyncedThroughAt
        && chat.historySyncedThroughAt.getTime() >= chat.lastMessageAt.getTime()
      ).length;
      const pending = chats.filter((chat) =>
        chat.lastMessageAt
        && (
          !chat.historySyncedThroughAt
          || chat.historySyncedThroughAt.getTime() < chat.lastMessageAt.getTime()
        )
      ).length;
      const totalWithActivity = current + pending;
      const historyCoveragePercent = totalWithActivity > 0
        ? Math.round((current / totalWithActivity) * 10_000) / 100
        : null;
      const counts = new Map(
        messageCounts.map((row) => [row.direction, row._count._all]),
      );
      const inboundMessages = counts.get(LineChatMirrorDirection.INBOUND) ?? 0;
      const outboundMessages = counts.get(LineChatMirrorDirection.OUTBOUND) ?? 0;
      const unknownDirectionMessages = counts.get(LineChatMirrorDirection.UNKNOWN) ?? 0;
      const messagesStored = inboundMessages + outboundMessages + unknownDirectionMessages;

      stores.push({
        lineOfficialAccountId: state.lineOfficialAccountId,
        storeId: state.storeId,
        storeCode: state.storeCode,
        enabled: state.enabled,
        status: state.status,
        lastStartedAt: state.lastStartedAt?.toISOString() ?? null,
        lastCompletedAt: state.lastCompletedAt?.toISOString() ?? null,
        lastSuccessfulSyncAt: state.lastSuccessfulSyncAt?.toISOString() ?? null,
        lastFailureAt: state.lastFailureAt?.toISOString() ?? null,
        lastErrorCode: state.lastErrorCode,
        recentChatsObserved: state.recentChatsObserved,
        mirroredChats: chats.length,
        historiesCurrent: current,
        pendingChats: pending,
        historyCoveragePercent,
        messagesStored,
        inboundMessages,
        outboundMessages,
        unknownDirectionMessages,
        latestMirroredMessageAt: latestMessage?.sentAt.toISOString() ?? null,
        lastCycleDurationMs: state.lastCycleDurationMs,
      });
    }

    const totals = stores.reduce(
      (acc, store) => {
        acc.mirroredChats += store.mirroredChats;
        acc.historiesCurrent += store.historiesCurrent;
        acc.pendingChats += store.pendingChats;
        acc.messagesStored += store.messagesStored;
        acc.inboundMessages += store.inboundMessages;
        acc.outboundMessages += store.outboundMessages;
        acc.unknownDirectionMessages += store.unknownDirectionMessages;
        return acc;
      },
      {
        mirroredChats: 0,
        historiesCurrent: 0,
        pendingChats: 0,
        messagesStored: 0,
        inboundMessages: 0,
        outboundMessages: 0,
        unknownDirectionMessages: 0,
      },
    );
    const denominator = totals.historiesCurrent + totals.pendingChats;

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        stores: stores.length,
        success: stores.filter((store) => store.status === LineChatMirrorSyncStatus.SUCCESS).length,
        partial: stores.filter((store) => store.status === LineChatMirrorSyncStatus.PARTIAL).length,
        failed: stores.filter((store) => store.status === LineChatMirrorSyncStatus.FAILED).length,
        ...totals,
        historyCoveragePercent: denominator > 0
          ? Math.round((totals.historiesCurrent / denominator) * 10_000) / 100
          : null,
      },
      stores,
    };
  }
}
