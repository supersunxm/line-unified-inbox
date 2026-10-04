import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { LineChatSessionService } from "./line-chat-session.service";
import type { LineChatDiscoveredChat } from "./line-chat.types";
import { classifyNickname, evidenceHash, NICKNAME_SOURCE_RULE_VERSION } from "./nickname-source-contract";

export type NicknameSnapshot = {
  storeId: string; lineOfficialAccountId: string; observedAt: Date;
  coverage: "BOUNDED_RECENT" | "COMPLETE";
  profileKey?: "A" | "B";
  chats: Pick<LineChatDiscoveredChat, "chatUserId" | "managerNickname" | "managerNicknameReadStatus">[];
};

@Injectable()
export class NicknameSourceObserverService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NicknameSourceObserverService.name);
  private readonly queue: NicknameSnapshot[] = [];
  private timer: NodeJS.Timeout | null = null;
  private flushing = false;
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LineChatSessionService) private readonly sessions: LineChatSessionService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === "test") return;
    this.timer = setInterval(() => void this.flush(), 5000);
    this.timer.unref();
  }
  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }

  /** Memory only inside the existing read. No DB wait, browser, lease or Manager request. */
  enqueue(snapshot: NicknameSnapshot): void {
    if (this.queue.length >= 512) {
      this.logger.error(JSON.stringify({ event: "nickname_source_capture_backpressure", queued: this.queue.length }));
      return; // No checkpoint is created: coverage cannot falsely pass.
    }
    this.queue.push({ ...snapshot, chats: snapshot.chats.map(c => ({
      chatUserId: c.chatUserId, managerNickname: c.managerNickname,
      managerNicknameReadStatus: c.managerNicknameReadStatus,
    })) });
  }

  async flush(): Promise<void> {
    if (this.flushing || this.sessions.isMirrorCycleActive()) return;
    this.flushing = true;
    try {
      while (this.queue.length && !this.sessions.isMirrorCycleActive()) {
        const snapshot = this.queue[0];
        try { await this.capture(snapshot); this.queue.shift(); }
        catch (error) {
          this.logger.error(JSON.stringify({ event: "nickname_source_capture_failed", errorType: error instanceof Error ? error.name : "UNKNOWN", queued: this.queue.length }));
          break; // Retry the same snapshot on the next cooldown; never fail a Mirror cycle.
        }
      }
    } finally { this.flushing = false; }
  }

  async capture(snapshot: NicknameSnapshot): Promise<void> {
    const started = Date.now();
    if (!Number.isFinite(snapshot.observedAt.getTime()) || snapshot.observedAt.getTime() > started) throw new Error("INVALID_CAPTURE_TIMESTAMP");
    const batchId = evidenceHash(JSON.stringify([snapshot.storeId, snapshot.lineOfficialAccountId, snapshot.observedAt.toISOString(), NICKNAME_SOURCE_RULE_VERSION]));
    await this.prisma.$transaction(async tx => {
      if (await tx.nicknameSourceCapture.findUnique({ where: { id: batchId } })) return;
      const oa = await tx.lineOfficialAccount.findFirst({ where: {
        id: snapshot.lineOfficialAccountId, storeId: snapshot.storeId, isActive: true, archivedAt: null,
        store: { isActive: true, archivedAt: null },
      }, select: { id: true } });
      if (!oa) throw new Error("NICKNAME_CAPTURE_SCOPE_CHANGED");
      const destinations = await tx.conversation.findMany({ where: {
        lineOfficialAccountId: snapshot.lineOfficialAccountId,
        lineChatUserId: { in: snapshot.chats.map(c => c.chatUserId) },
      }, select: { id: true, storeId: true, lineOfficialAccountId: true, lineChatUserId: true,
        nicknameSourceState: { select: { tag: true } } } });
      const uniqueChats = new Map(snapshot.chats.map(c => [c.chatUserId, c]));
      if (uniqueChats.size !== snapshot.chats.length) throw new Error("NICKNAME_CAPTURE_DUPLICATE_ID");
      const rows = [...uniqueChats.values()].map(chat => {
        const classified = classifyNickname({ ...snapshot, lineChatUserId: chat.chatUserId,
          nickname: chat.managerNickname ?? null, readable: chat.managerNicknameReadStatus === "READ",
          destinations: destinations.map(c => ({ ...c, tag: c.nicknameSourceState?.tag ?? null })),
        });
        return { id: evidenceHash(`${batchId}:${chat.chatUserId}`), batchId,
          storeId: snapshot.storeId, lineOfficialAccountId: snapshot.lineOfficialAccountId,
          lineChatUserId: chat.chatUserId, conversationId: classified.conversationId,
          nickname: chat.managerNickname ?? null, nicknameReadStatus: chat.managerNicknameReadStatus ?? "MISSING",
          observedAt: snapshot.observedAt, parsedTag: classified.parsed.tag,
          ruleVersion: NICKNAME_SOURCE_RULE_VERSION, ruleId: classified.parsed.ruleId,
          classification: classified.classification, reason: classified.reason,
          previousTag: classified.previousTag, resultingTag: classified.previousTag,
        };
      });
      await tx.nicknameSourceCapture.create({ data: { id: batchId, storeId: snapshot.storeId,
        lineOfficialAccountId: snapshot.lineOfficialAccountId, observedAt: snapshot.observedAt,
        chatCount: rows.length, coverage: snapshot.coverage, ruleVersion: NICKNAME_SOURCE_RULE_VERSION,
        profileKey: snapshot.profileKey, durationMs: Date.now() - started } });
      if (rows.length) await tx.nicknameSourceObservation.createMany({ data: rows });
      const ids = rows.map(c => c.conversationId).filter((id): id is string => id !== null);
      if (ids.length) {
        await tx.nicknameSourceState.createMany({ data: ids.map(conversationId => ({ conversationId, lastObservedAt: snapshot.observedAt })), skipDuplicates: true });
        await tx.nicknameSourceState.updateMany({ where: { conversationId: { in: ids }, lastObservedAt: { lt: snapshot.observedAt } }, data: { lastObservedAt: snapshot.observedAt } });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 5000, maxWait: 1000 });
    this.logger.log(JSON.stringify({ event: "nickname_source_capture_completed", chats: snapshot.chats.length,
      durationMs: Date.now() - started, incrementalProfileMs: 0 }));
  }
}
