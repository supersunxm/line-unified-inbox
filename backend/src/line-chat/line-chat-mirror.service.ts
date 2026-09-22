import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  LineAccountType,
  LineChatMirrorDirection,
  LineChatMirrorSyncStatus,
  LineChatSessionStatus,
} from "@prisma/client";
import * as fs from "node:fs";
import type { BrowserContext } from "playwright";
import { PrismaService } from "../prisma.service";
import { confirmLineManagerAuthentication } from "./line-chat-manager-auth-confirmation";
import { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";
import { LineChatSessionService } from "./line-chat-session.service";
import { selectLineChatStoreOa } from "./line-chat-store-oa-selector";

const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 30_000;
const START_DELAY_MS = 10_000;
const DEFAULT_MAX_CHANGED_CHATS_PER_CYCLE = 20;
const MAX_CHANGED_CHATS_PER_CYCLE = 50;
const RECENT_MAX_PAGES = 5;
const RECENT_MAX_CHATS = 125;

export interface LineChatMirrorCycleResult {
  storeCode: string;
  status: LineChatMirrorSyncStatus;
  recentChatsObserved: number;
  historiesFetched: number;
  messagesObserved: number;
  messagesInsertedOrUpdated: number;
  pendingChats: number;
  unknownDirectionEvents: number;
  durationMs: number;
}

interface MirrorHistoryEvent {
  managerMessageId: string;
  eventType: string;
  direction: LineChatMirrorDirection;
  messageType: string | null;
  text: string | null;
  fileName: string | null;
  sentAt: Date;
  bizId: string | null;
  ownerName: string | null;
}

interface PendingMirrorChat {
  lineChatUserId: string;
  lastMessageAt: Date;
}

export interface MirrorSessionTarget {
  id: string;
  sessionKey: string;
  status: LineChatSessionStatus;
  profilePath: string | null;
  profileStorageKey: string | null;
}

export type MirrorTargetResolution =
  | {
      ok: true;
      botId: string;
      session: MirrorSessionTarget;
      source: "EXISTING_OA" | "MANAGER_ACCOUNT_REDIRECT";
    }
  | {
      ok: false;
      errorCode:
        | "MIRROR_MANAGER_ACCOUNT_KEY_MISSING"
        | "MIRROR_MANAGER_TARGET_NOT_FOUND"
        | "MIRROR_MANAGER_TARGET_AMBIGUOUS";
      errorMessage: string;
    };

export type MirrorResolvedCandidate = {
  botId: string;
  session: MirrorSessionTarget;
};

export function selectMirrorResolvedCandidate(
  candidates: readonly MirrorResolvedCandidate[],
): MirrorResolvedCandidate | null | "AMBIGUOUS" {
  const uniqueCandidates = candidates.filter((candidate, index, all) =>
    all.findIndex((item) =>
      item.botId === candidate.botId && item.session.id === candidate.session.id
    ) === index,
  );
  if (uniqueCandidates.length === 0) return null;

  const uniqueBotIds = [...new Set(uniqueCandidates.map((candidate) => candidate.botId))];
  if (uniqueBotIds.length !== 1) return "AMBIGUOUS";

  return uniqueCandidates[0];
}

export function managerAccountKeyFromInputs(input: {
  lineChatWorkspaceUrl?: string | null;
  storeManagerUrl?: string | null;
  basicId?: string | null;
}): string | null {
  for (const raw of [input.lineChatWorkspaceUrl, input.storeManagerUrl]) {
    const value = raw?.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (
        url.protocol !== "https:"
        || (url.hostname !== "manager.line.biz" && url.hostname !== "chat.line.biz")
      ) {
        continue;
      }
      const match = /^\/account\/([^/]+)\/?$/u.exec(url.pathname);
      if (match?.[1]) return decodeURIComponent(match[1]).trim() || null;
    } catch {
      // Try the next source.
    }
  }
  const basicId = input.basicId?.trim();
  return basicId || null;
}

export function managerBotIdFromRedirect(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || url.hostname !== "chat.line.biz") return null;
    const firstSegment = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return /^U[0-9a-f]{32}$/iu.test(firstSegment) ? firstSegment : null;
  } catch {
    return null;
  }
}

export function configuredLineChatMirrorStoreCodes(): string[] {
  const raw = process.env.LINE_CHAT_MIRROR_STORE_CODES?.trim();
  if (!raw) return [];
  return [...new Set(
    raw
      .split(/[\s,;]+/u)
      .map((value) => value.trim())
      .filter(Boolean),
  )];
}

export function isLineChatMirrorEnabled(): boolean {
  return process.env.LINE_CHAT_MIRROR_ENABLED?.trim().toLowerCase() === "true";
}

export function lineChatMirrorIntervalMs(): number {
  const parsed = Number(process.env.LINE_CHAT_MIRROR_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
  if (!Number.isFinite(parsed)) return DEFAULT_INTERVAL_MS;
  return Math.max(MIN_INTERVAL_MS, Math.floor(parsed));
}

export function lineChatMirrorMaxChangedChatsPerCycle(): number {
  const parsed = Number(
    process.env.LINE_CHAT_MIRROR_MAX_CHANGED_CHATS_PER_CYCLE
      ?? DEFAULT_MAX_CHANGED_CHATS_PER_CYCLE,
  );
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_CHANGED_CHATS_PER_CYCLE;
  return Math.min(
    MAX_CHANGED_CHATS_PER_CYCLE,
    Math.max(1, Math.floor(parsed)),
  );
}

export function mirrorDirectionForManagerEvent(
  eventType: string | null | undefined,
): LineChatMirrorDirection {
  const normalized = eventType?.trim().toLowerCase() ?? "";
  if (normalized === "messagesent") return LineChatMirrorDirection.OUTBOUND;
  if (normalized === "messagereceived" || normalized === "message") {
    return LineChatMirrorDirection.INBOUND;
  }
  return LineChatMirrorDirection.UNKNOWN;
}

function safeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return String(error).slice(0, 500);
}

@Injectable()
export class LineChatMirrorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LineChatMirrorService.name);
  private timer: NodeJS.Timeout | null = null;
  private startupTimer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly targetCache = new Map<string, {
    botId: string;
    session: MirrorSessionTarget;
    source: "EXISTING_OA" | "MANAGER_ACCOUNT_REDIRECT";
  }>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LineChatSessionService) private readonly sessionService: LineChatSessionService,
    @Inject(LineChatProfileOperationCoordinator)
    private readonly coordinator: LineChatProfileOperationCoordinator,
  ) {}

  onModuleInit(): void {
    if (
      process.env.NODE_ENV === "test"
      || !isLineChatMirrorEnabled()
      || configuredLineChatMirrorStoreCodes().length === 0
    ) {
      return;
    }

    const intervalMs = lineChatMirrorIntervalMs();
    this.logger.log(JSON.stringify({
      event: "line_chat_mirror_worker_started",
      storeCount: configuredLineChatMirrorStoreCodes().length,
      intervalMs,
      maxChangedChatsPerCycle: lineChatMirrorMaxChangedChatsPerCycle(),
      mode: "READ_ONLY_MANAGER_SOURCE",
    }));

    this.startupTimer = setTimeout(() => void this.runCycle(), START_DELAY_MS);
    this.startupTimer.unref?.();
    this.timer = setInterval(() => void this.runCycle(), intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.timer = null;
    this.startupTimer = null;
  }

  public async runCycle(): Promise<LineChatMirrorCycleResult[]> {
    if (this.running) return [];
    this.running = true;
    const results: LineChatMirrorCycleResult[] = [];
    try {
      for (const storeCode of configuredLineChatMirrorStoreCodes()) {
        try {
          results.push(await this.syncStore(storeCode));
        } catch (error) {
          this.logger.warn(JSON.stringify({
            event: "line_chat_mirror_store_cycle_failed",
            storeCode,
            error: safeError(error),
          }));
        }
      }
      return results;
    } finally {
      this.running = false;
    }
  }

  private async syncStore(storeCode: string): Promise<LineChatMirrorCycleResult> {
    const startedAtMs = Date.now();
    const store = await this.prisma.store.findFirst({
      where: {
        isActive: true,
        archivedAt: null,
        OR: [
          { code: storeCode },
          { storeMaster: { externalStoreId: storeCode } },
        ],
      },
      select: {
        id: true,
        code: true,
        storeMaster: {
          select: {
            externalStoreId: true,
            lineManagerUrl: true,
            accountName: true,
            normalizedAccountName: true,
            lineId: true,
          },
        },
        lineOfficialAccounts: {
          where: {
            accountType: LineAccountType.STORE,
            isActive: true,
            archivedAt: null,
          },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            name: true,
            basicId: true,
            lineChatWorkspaceUrl: true,
            chatBotId: true,
            lineChatSession: {
              select: {
                id: true,
                sessionKey: true,
                status: true,
                profilePath: true,
                profileStorageKey: true,
              },
            },
          },
        },
      },
    });

    const effectiveStoreCode = store?.code?.trim()
      || store?.storeMaster?.externalStoreId?.trim()
      || storeCode;
    if (!store) {
      throw new Error("MIRROR_STORE_NOT_FOUND");
    }

    const oaSelection = selectLineChatStoreOa(
      store.storeMaster,
      store.lineOfficialAccounts.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        basicId: candidate.basicId,
      })),
    );
    if (!oaSelection.ok) {
      throw new Error(`MIRROR_OA_IDENTITY_${oaSelection.reason}`);
    }
    const oa = store.lineOfficialAccounts.find((candidate) => candidate.id === oaSelection.oaId);
    if (!oa) {
      throw new Error("MIRROR_SELECTED_OA_NOT_FOUND");
    }
    this.logger.log(JSON.stringify({
      event: "line_chat_mirror_oa_selected",
      storeCode: effectiveStoreCode,
      storeMasterAccountName: store.storeMaster?.accountName ?? null,
      storeMasterLineId: store.storeMaster?.lineId ?? null,
      lineOfficialAccountId: oa.id,
      lineOfficialAccountName: oa.name,
      selectionSource: oaSelection.source,
    }));

    await this.prisma.lineChatMirrorStoreState.upsert({
      where: { lineOfficialAccountId: oa.id },
      update: {
        storeId: store.id,
        storeCode: effectiveStoreCode,
        enabled: true,
        status: LineChatMirrorSyncStatus.RUNNING,
        lastStartedAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
      },
      create: {
        lineOfficialAccountId: oa.id,
        storeId: store.id,
        storeCode: effectiveStoreCode,
        enabled: true,
        status: LineChatMirrorSyncStatus.RUNNING,
        lastStartedAt: new Date(),
      },
    });

    const repairedUnknownDirections = await this.prisma.lineChatMirrorMessage.updateMany({
      where: {
        lineOfficialAccountId: oa.id,
        direction: LineChatMirrorDirection.UNKNOWN,
        eventType: "message",
      },
      data: { direction: LineChatMirrorDirection.INBOUND },
    });
    if (repairedUnknownDirections.count > 0) {
      this.logger.warn(JSON.stringify({
        event: "line_chat_mirror_unknown_direction_repaired",
        storeCode: effectiveStoreCode,
        lineOfficialAccountId: oa.id,
        repairedCount: repairedUnknownDirections.count,
      }));
    }

    const target = await this.resolveMirrorTarget({
      lineOfficialAccountId: oa.id,
      chatBotId: oa.chatBotId,
      basicId: oa.basicId,
      lineChatWorkspaceUrl: oa.lineChatWorkspaceUrl,
      storeManagerUrl: store.storeMaster?.lineManagerUrl ?? null,
      lineChatSession: oa.lineChatSession,
    });
    if (!target.ok) {
      const durationMs = Date.now() - startedAtMs;
      await this.markStoreFailure({
        lineOfficialAccountId: oa.id,
        status: LineChatMirrorSyncStatus.FAILED,
        errorCode: target.errorCode,
        errorMessage: target.errorMessage,
        durationMs,
      });
      return {
        storeCode: effectiveStoreCode,
        status: LineChatMirrorSyncStatus.FAILED,
        recentChatsObserved: 0,
        historiesFetched: 0,
        messagesObserved: 0,
        messagesInsertedOrUpdated: 0,
        pendingChats: 0,
        unknownDirectionEvents: 0,
        durationMs,
      };
    }

    const session = target.session;
    const botId = target.botId;
    const profilePath = this.sessionService.resolveProfilePath(session);
    if (!fs.existsSync(profilePath)) {
      const durationMs = Date.now() - startedAtMs;
      await this.markStoreFailure({
        lineOfficialAccountId: oa.id,
        status: LineChatMirrorSyncStatus.FAILED,
        errorCode: "PROFILE_MISSING",
        errorMessage: "LINE OA Manager browser profile does not exist.",
        durationMs,
      });
      return {
        storeCode: effectiveStoreCode,
        status: LineChatMirrorSyncStatus.FAILED,
        recentChatsObserved: 0,
        historiesFetched: 0,
        messagesObserved: 0,
        messagesInsertedOrUpdated: 0,
        pendingChats: 0,
        unknownDirectionEvents: 0,
        durationMs,
      };
    }

    let syncFailure: string | null = null;
    const operation = await this.coordinator.withProfileOperation(
      { sessionId: session.id, operationKind: "MIRROR_SYNC" },
      async (operationContext) => {
        operationContext.assertOwnership();
        const recent = await this.sessionService.discoverRecentChats({
          botId,
          profilePath,
          headless: true,
          maxPages: RECENT_MAX_PAGES,
          maxChats: RECENT_MAX_CHATS,
          operationContext,
        });
        operationContext.assertOwnership();
        if (recent.status !== "READY") {
          this.targetCache.delete(oa.id);
          this.logger.warn(JSON.stringify({
            event: "line_chat_mirror_target_cache_evicted",
            lineOfficialAccountId: oa.id,
            reason: `RECENT_DISCOVERY_${recent.failureReason ?? "FAILED"}`,
            sessionKey: session.sessionKey,
          }));
          throw new Error(`RECENT_DISCOVERY_${recent.failureReason ?? "FAILED"}`);
        }

        for (const chat of recent.chats) {
          const parsedLastMessageAt = chat.lastMessageAt
            ? new Date(chat.lastMessageAt)
            : null;
          const lastMessageAt = parsedLastMessageAt
            && Number.isFinite(parsedLastMessageAt.getTime())
            ? parsedLastMessageAt
            : null;
          await this.prisma.lineChatMirrorChat.upsert({
            where: {
              lineOfficialAccountId_lineChatUserId: {
                lineOfficialAccountId: oa.id,
                lineChatUserId: chat.chatUserId,
              },
            },
            update: {
              displayName: chat.displayName,
              lastMessageText: chat.lastMessageText,
              lastMessageAt,
              lastMessageDirection: chat.lastMessageDirection,
            },
            create: {
              lineOfficialAccountId: oa.id,
              lineChatUserId: chat.chatUserId,
              displayName: chat.displayName,
              lastMessageText: chat.lastMessageText,
              lastMessageAt,
              lastMessageDirection: chat.lastMessageDirection,
            },
          });
        }

        const mirrorChats = await this.prisma.lineChatMirrorChat.findMany({
          where: {
            lineOfficialAccountId: oa.id,
            lastMessageAt: { not: null },
          },
          orderBy: { lastMessageAt: "desc" },
          select: {
            lineChatUserId: true,
            lastMessageAt: true,
            historySyncedThroughAt: true,
          },
        });
        const pending = mirrorChats
          .filter((chat): chat is typeof chat & { lastMessageAt: Date } =>
            chat.lastMessageAt instanceof Date
            && (
              !chat.historySyncedThroughAt
              || chat.historySyncedThroughAt.getTime() < chat.lastMessageAt.getTime()
            ),
          )
          .slice(0, lineChatMirrorMaxChangedChatsPerCycle())
          .map((chat): PendingMirrorChat => ({
            lineChatUserId: chat.lineChatUserId,
            lastMessageAt: chat.lastMessageAt,
          }));

        if (pending.length === 0) {
          return {
            recentChatsObserved: recent.chats.length,
            historiesFetched: 0,
            messagesObserved: 0,
            messagesInsertedOrUpdated: 0,
            unknownDirectionEvents: 0,
            historyFailures: 0,
          };
        }

        return this.fetchAndPersistHistories({
          lineOfficialAccountId: oa.id,
          botId,
          profilePath,
          sessionId: session.id,
          pending,
          assertOwnership: () => operationContext.assertOwnership(),
        });
      },
      { waitForLock: false },
    ).catch((error) => {
      syncFailure = safeError(error);
      return null;
    });

    if (!operation) {
      const durationMs = Date.now() - startedAtMs;
      await this.markStoreFailure({
        lineOfficialAccountId: oa.id,
        status: LineChatMirrorSyncStatus.FAILED,
        errorCode: "MIRROR_SYNC_FAILED",
        errorMessage: syncFailure ?? "Mirror sync failed.",
        durationMs,
      });
      return {
        storeCode: effectiveStoreCode,
        status: LineChatMirrorSyncStatus.FAILED,
        recentChatsObserved: 0,
        historiesFetched: 0,
        messagesObserved: 0,
        messagesInsertedOrUpdated: 0,
        pendingChats: await this.countPendingChats(oa.id),
        unknownDirectionEvents: 0,
        durationMs,
      };
    }

    if (!operation.acquired) {
      const durationMs = Date.now() - startedAtMs;
      const pendingChats = await this.countPendingChats(oa.id);
      await this.prisma.lineChatMirrorStoreState.update({
        where: { lineOfficialAccountId: oa.id },
        data: {
          status: LineChatMirrorSyncStatus.PARTIAL,
          lastCompletedAt: new Date(),
          lastFailureAt: new Date(),
          lastErrorCode: "PROFILE_OPERATION_BUSY",
          lastErrorMessage: operation.reason,
          pendingChats,
          lastCycleDurationMs: durationMs,
        },
      });
      return {
        storeCode: effectiveStoreCode,
        status: LineChatMirrorSyncStatus.PARTIAL,
        recentChatsObserved: 0,
        historiesFetched: 0,
        messagesObserved: 0,
        messagesInsertedOrUpdated: 0,
        pendingChats,
        unknownDirectionEvents: 0,
        durationMs,
      };
    }

    const pendingChats = await this.countPendingChats(oa.id);
    const messagesStored = await this.prisma.lineChatMirrorMessage.count({
      where: { lineOfficialAccountId: oa.id },
    });
    const durationMs = Date.now() - startedAtMs;
    const status = operation.value.historyFailures > 0
      ? LineChatMirrorSyncStatus.PARTIAL
      : LineChatMirrorSyncStatus.SUCCESS;
    await this.prisma.lineChatMirrorStoreState.update({
      where: { lineOfficialAccountId: oa.id },
      data: {
        status,
        lastCompletedAt: new Date(),
        lastSuccessfulSyncAt: status === LineChatMirrorSyncStatus.SUCCESS ? new Date() : undefined,
        lastFailureAt: operation.value.historyFailures > 0 ? new Date() : undefined,
        lastErrorCode: operation.value.historyFailures > 0 ? "HISTORY_PARTIAL" : null,
        lastErrorMessage: operation.value.historyFailures > 0
          ? `${operation.value.historyFailures} chat histories failed in this cycle.`
          : null,
        recentChatsObserved: operation.value.recentChatsObserved,
        pendingChats,
        messagesStored,
        lastCycleDurationMs: durationMs,
      },
    });

    const [storedDirectionRows, storedEventTypeRows, storedMessageTypeRows] = await Promise.all([
      this.prisma.lineChatMirrorMessage.groupBy({
        by: ["direction"],
        where: { lineOfficialAccountId: oa.id },
        _count: { _all: true },
      }),
      this.prisma.lineChatMirrorMessage.groupBy({
        by: ["eventType"],
        where: { lineOfficialAccountId: oa.id },
        _count: { _all: true },
      }),
      this.prisma.lineChatMirrorMessage.groupBy({
        by: ["messageType"],
        where: { lineOfficialAccountId: oa.id },
        _count: { _all: true },
      }),
    ]);
    const storedDirectionBreakdown = Object.fromEntries(
      storedDirectionRows.map((row) => [row.direction, row._count._all]),
    );
    const storedEventTypeBreakdown = Object.fromEntries(
      storedEventTypeRows
        .map((row) => [row.eventType, row._count._all] as const)
        .sort(([left], [right]) => left.localeCompare(right)),
    );
    const storedMessageTypeBreakdown = Object.fromEntries(
      storedMessageTypeRows
        .map((row) => [row.messageType ?? "null", row._count._all] as const)
        .sort(([left], [right]) => left.localeCompare(right)),
    );

    const result: LineChatMirrorCycleResult = {
      storeCode: effectiveStoreCode,
      status,
      recentChatsObserved: operation.value.recentChatsObserved,
      historiesFetched: operation.value.historiesFetched,
      messagesObserved: operation.value.messagesObserved,
      messagesInsertedOrUpdated: operation.value.messagesInsertedOrUpdated,
      pendingChats,
      unknownDirectionEvents: operation.value.unknownDirectionEvents,
      durationMs,
    };
    this.logger.log(JSON.stringify({
      event: "line_chat_mirror_store_cycle_completed",
      ...result,
      messagesStored,
      storedDirectionBreakdown,
      storedEventTypeBreakdown,
      storedMessageTypeBreakdown,
    }));
    return result;
  }

  public async resolveMirrorTarget(input: {
    lineOfficialAccountId: string;
    chatBotId: string | null;
    basicId: string | null;
    lineChatWorkspaceUrl: string | null;
    storeManagerUrl: string | null;
    lineChatSession: MirrorSessionTarget | null;
  }): Promise<MirrorTargetResolution> {
    const cached = this.targetCache.get(input.lineOfficialAccountId);
    if (cached && cached.session.status === LineChatSessionStatus.ACTIVE) {
      return { ok: true, ...cached };
    }

    const existingBotId = input.chatBotId?.trim() || "";
    if (
      existingBotId
      && input.lineChatSession
      && input.lineChatSession.status === LineChatSessionStatus.ACTIVE
    ) {
      const resolved = {
        botId: existingBotId,
        session: input.lineChatSession,
        source: "EXISTING_OA" as const,
      };
      this.targetCache.set(input.lineOfficialAccountId, resolved);
      return { ok: true, ...resolved };
    }

    const managerAccountKey = managerAccountKeyFromInputs({
      lineChatWorkspaceUrl: input.lineChatWorkspaceUrl,
      storeManagerUrl: input.storeManagerUrl,
      basicId: input.basicId,
    });
    if (!managerAccountKey) {
      return {
        ok: false,
        errorCode: "MIRROR_MANAGER_ACCOUNT_KEY_MISSING",
        errorMessage: "No LINE Manager account URL or Basic ID is available for mirror discovery.",
      };
    }

    const activeSessions = await this.prisma.lineChatSession.findMany({
      where: { status: LineChatSessionStatus.ACTIVE },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        sessionKey: true,
        status: true,
        profilePath: true,
        profileStorageKey: true,
      },
    });
    const sessions: MirrorSessionTarget[] = [];
    if (
      input.lineChatSession
      && input.lineChatSession.status === LineChatSessionStatus.ACTIVE
    ) {
      sessions.push(input.lineChatSession);
    }
    for (const session of activeSessions) {
      if (!sessions.some((candidate) => candidate.id === session.id)) {
        sessions.push(session);
      }
    }

    const candidates: Array<{
      botId: string;
      session: MirrorSessionTarget;
    }> = [];
    for (const session of sessions) {
      let profilePath: string;
      try {
        profilePath = this.sessionService.resolveProfilePath(session);
      } catch {
        continue;
      }
      if (!fs.existsSync(profilePath)) continue;

      const resolved = await this.coordinator.withProfileOperation(
        { sessionId: session.id, operationKind: "MIRROR_SYNC" },
        async (operationContext) => {
          operationContext.assertOwnership();
          let context: BrowserContext | null = null;
          let resolvedBotId: string | null = null;
          try {
            context = await this.sessionService.launchManagedPersistentContext(
              profilePath,
              {
                profilePath,
                headless: true,
                viewport: { width: 1280, height: 800 },
                args: [
                  "--no-sandbox",
                  "--disable-setuid-sandbox",
                  "--disable-blink-features=AutomationControlled",
                ],
              },
              { sessionId: session.id, sessionKey: session.sessionKey },
            );
            const page = context.pages()[0] || await context.newPage();
            const targetUrl = `https://chat.line.biz/account/${encodeURIComponent(managerAccountKey)}`;
            await page.goto(targetUrl, {
              waitUntil: "domcontentloaded",
              timeout: 15_000,
            }).catch(() => {});
            await page.waitForTimeout(1_000).catch(() => {});
            const auth = await confirmLineManagerAuthentication(
              () => this.sessionService.probeApiAuthentication(context!),
              (ms) => page.waitForTimeout(ms),
            );
            if (auth.outcome === "AUTHENTICATED") {
              resolvedBotId = managerBotIdFromRedirect(page.url());
            }
          } finally {
            if (context) {
              await this.sessionService
                .closeManagedPersistentContext(context, profilePath)
                .catch(() => {});
            }
          }

          if (!resolvedBotId) return null;
          operationContext.assertOwnership();
          const verification = await this.sessionService.discoverRecentChats({
            botId: resolvedBotId,
            profilePath,
            headless: true,
            maxPages: 1,
            maxChats: 5,
            operationContext,
          });
          operationContext.assertOwnership();
          if (verification.status !== "READY") {
            this.logger.warn(JSON.stringify({
              event: "line_chat_mirror_target_candidate_rejected",
              sessionKey: session.sessionKey,
              reason: `RECENT_DISCOVERY_${verification.failureReason ?? "FAILED"}`,
              failureDetail: verification.failureDetail ?? null,
              botIdMasked: `${resolvedBotId.slice(0, 4)}...${resolvedBotId.slice(-4)}`,
            }));
            return null;
          }
          return resolvedBotId;
        },
        { waitForLock: false },
      );
      if (!resolved.acquired || !resolved.value) continue;
      candidates.push({
        botId: resolved.value,
        session,
      });
    }

    const candidate = selectMirrorResolvedCandidate(candidates);
    if (candidate === null) {
      return {
        ok: false,
        errorCode: "MIRROR_MANAGER_TARGET_NOT_FOUND",
        errorMessage: "No active LINE Manager session could open this OA account.",
      };
    }
    if (candidate === "AMBIGUOUS") {
      return {
        ok: false,
        errorCode: "MIRROR_MANAGER_TARGET_AMBIGUOUS",
        errorMessage: "More than one distinct LINE Manager OA bot resolved this account.",
      };
    }

    // Multiple authenticated Manager sessions may legitimately have access to
    // the same OA. When they all resolve to the exact same botId, the helper
    // preserves the existing deterministic session ordering and uses the first.

    const result = {
      botId: candidate.botId,
      session: candidate.session,
      source: "MANAGER_ACCOUNT_REDIRECT" as const,
    };
    this.targetCache.set(input.lineOfficialAccountId, result);
    this.logger.log(JSON.stringify({
      event: "line_chat_mirror_target_resolved",
      lineOfficialAccountId: input.lineOfficialAccountId,
      source: result.source,
      sessionKey: result.session.sessionKey,
      botIdMasked: `${result.botId.slice(0, 4)}...${result.botId.slice(-4)}`,
    }));
    return { ok: true, ...result };
  }

  private async fetchAndPersistHistories(input: {
    lineOfficialAccountId: string;
    botId: string;
    profilePath: string;
    sessionId: string;
    pending: PendingMirrorChat[];
    assertOwnership: () => void;
  }): Promise<{
    recentChatsObserved: number;
    historiesFetched: number;
    messagesObserved: number;
    messagesInsertedOrUpdated: number;
    unknownDirectionEvents: number;
    historyFailures: number;
  }> {
    let context: BrowserContext | null = null;
    let historiesFetched = 0;
    let messagesObserved = 0;
    let messagesInsertedOrUpdated = 0;
    let unknownDirectionEvents = 0;
    let historyFailures = 0;
    const eventTypeCounts = new Map<string, number>();
    const messageTypeCounts = new Map<string, number>();

    try {
      context = await this.sessionService.launchManagedPersistentContext(
        input.profilePath,
        {
          profilePath: input.profilePath,
          headless: true,
          viewport: { width: 1280, height: 800 },
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-blink-features=AutomationControlled",
          ],
        },
        { sessionId: input.sessionId },
      );
      const page = context.pages()[0] || await context.newPage();
      const targetUrl = this.sessionService.buildChatRefererUrl(
        input.botId,
        input.pending[0].lineChatUserId,
      );
      await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      }).catch(() => {});
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

      const auth = await confirmLineManagerAuthentication(
        () => this.sessionService.probeApiAuthentication(context!),
        (ms) => page.waitForTimeout(ms),
      );
      if (auth.outcome !== "AUTHENTICATED") {
        throw new Error(`MIRROR_MANAGER_AUTH_${auth.outcome}`);
      }

      const ownersUrl = `https://chat.line.biz/api/v1/bots/${encodeURIComponent(input.botId)}/owners`;
      const owners = await page.evaluate(async (url) => {
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) return [] as Array<{ bizId: string; name: string }>;
        const body = await response.json() as {
          list?: Array<{ bizId?: string; name?: string }>;
        };
        return (body.list ?? [])
          .filter((item) => typeof item.bizId === "string")
          .map((item) => ({
            bizId: item.bizId!,
            name: typeof item.name === "string" ? item.name.trim() : "",
          }));
      }, ownersUrl).catch(() => [] as Array<{ bizId: string; name: string }>);
      const ownerByBizId = new Map(
        owners.map((owner) => [owner.bizId, owner.name]),
      );

      for (const chat of input.pending) {
        input.assertOwnership();
        try {
          const historyUrl = `https://chat.line.biz/api/v3/bots/${encodeURIComponent(input.botId)}/chats/${encodeURIComponent(chat.lineChatUserId)}/messages`;
          const history = await page.evaluate(async (url) => {
            const response = await fetch(url, { credentials: "include" });
            if (!response.ok) {
              return {
                ok: false,
                status: response.status,
                list: [] as Array<{
                  type?: string;
                  timestamp?: number;
                  bizId?: string;
                  message?: {
                    id?: string;
                    type?: string;
                    text?: string;
                    fileName?: string;
                    name?: string;
                  };
                }>,
              };
            }
            const body = await response.json() as {
              list?: Array<{
                type?: string;
                timestamp?: number;
                bizId?: string;
                message?: {
                  id?: string;
                  type?: string;
                  text?: string;
                  fileName?: string;
                  name?: string;
                };
              }>;
            };
            return { ok: true, status: response.status, list: body.list ?? [] };
          }, historyUrl);

          if (!history.ok) {
            historyFailures += 1;
            await this.markMirrorChatFailure(
              input.lineOfficialAccountId,
              chat.lineChatUserId,
              `HISTORY_HTTP_${history.status}`,
              "LINE OA Manager history request failed.",
            );
            continue;
          }

          historiesFetched += 1;
          const events: MirrorHistoryEvent[] = [];
          for (const item of history.list) {
            const messageId = item.message?.id?.trim();
            const timestamp = Number(item.timestamp);
            if (!messageId || !Number.isFinite(timestamp)) continue;
            const eventType = typeof item.type === "string" && item.type.trim()
              ? item.type.trim()
              : "unknown";
            const direction = mirrorDirectionForManagerEvent(eventType);
            eventTypeCounts.set(
              eventType,
              (eventTypeCounts.get(eventType) ?? 0) + 1,
            );
            const rawMessageType = typeof item.message?.type === "string"
              ? item.message.type.trim()
              : "";
            const safeMessageType = rawMessageType || "unknown";
            messageTypeCounts.set(
              safeMessageType,
              (messageTypeCounts.get(safeMessageType) ?? 0) + 1,
            );
            if (direction === LineChatMirrorDirection.UNKNOWN) {
              unknownDirectionEvents += 1;
            }
            const bizId = typeof item.bizId === "string" ? item.bizId : null;
            const fileName = typeof item.message?.fileName === "string"
              ? item.message.fileName
              : typeof item.message?.name === "string"
                ? item.message.name
                : null;
            events.push({
              managerMessageId: messageId,
              eventType,
              direction,
              messageType: rawMessageType || null,
              text: typeof item.message?.text === "string"
                ? item.message.text
                : null,
              fileName,
              sentAt: new Date(timestamp),
              bizId,
              ownerName: bizId ? ownerByBizId.get(bizId) || null : null,
            });
          }

          messagesObserved += events.length;
          for (const event of events) {
            if (!Number.isFinite(event.sentAt.getTime())) continue;
            await this.prisma.lineChatMirrorMessage.upsert({
              where: {
                lineOfficialAccountId_managerMessageId: {
                  lineOfficialAccountId: input.lineOfficialAccountId,
                  managerMessageId: event.managerMessageId,
                },
              },
              update: {
                lineChatUserId: chat.lineChatUserId,
                eventType: event.eventType,
                direction: event.direction,
                messageType: event.messageType,
                text: event.text,
                fileName: event.fileName,
                bizId: event.bizId,
                ownerName: event.ownerName,
                sentAt: event.sentAt,
              },
              create: {
                lineOfficialAccountId: input.lineOfficialAccountId,
                lineChatUserId: chat.lineChatUserId,
                managerMessageId: event.managerMessageId,
                eventType: event.eventType,
                direction: event.direction,
                messageType: event.messageType,
                text: event.text,
                fileName: event.fileName,
                bizId: event.bizId,
                ownerName: event.ownerName,
                sentAt: event.sentAt,
              },
              // Keep the existing read-only mirror safe during staggered
              // backend/worker rollouts: this query only returns a legacy
              // column, so a worker can start before the additive
              // reconciliation migration is visible without selecting the
              // new columns.
              select: { id: true },
            });
            messagesInsertedOrUpdated += 1;
          }

          await this.prisma.lineChatMirrorChat.update({
            where: {
              lineOfficialAccountId_lineChatUserId: {
                lineOfficialAccountId: input.lineOfficialAccountId,
                lineChatUserId: chat.lineChatUserId,
              },
            },
            data: {
              historySyncedThroughAt: chat.lastMessageAt,
              lastHistorySyncedAt: new Date(),
              status: LineChatMirrorSyncStatus.SUCCESS,
              lastErrorCode: null,
              lastErrorMessage: null,
            },
          });
        } catch (error) {
          historyFailures += 1;
          await this.markMirrorChatFailure(
            input.lineOfficialAccountId,
            chat.lineChatUserId,
            "HISTORY_EXCEPTION",
            safeError(error),
          );
        }
      }
    } finally {
      if (context) {
        await this.sessionService
          .closeManagedPersistentContext(context, input.profilePath)
          .catch(() => {});
      }
    }

    const eventTypeBreakdown = Object.fromEntries(
      [...eventTypeCounts.entries()].sort(([left], [right]) => left.localeCompare(right)),
    );
    const messageTypeBreakdown = Object.fromEntries(
      [...messageTypeCounts.entries()].sort(([left], [right]) => left.localeCompare(right)),
    );
    this.logger.log(JSON.stringify({
      event: "line_chat_mirror_history_shape_observed",
      lineOfficialAccountId: input.lineOfficialAccountId,
      historiesFetched,
      messagesObserved,
      unknownDirectionEvents,
      eventTypeBreakdown,
      messageTypeBreakdown,
    }));

    return {
      recentChatsObserved: await this.prisma.lineChatMirrorChat.count({
        where: { lineOfficialAccountId: input.lineOfficialAccountId },
      }),
      historiesFetched,
      messagesObserved,
      messagesInsertedOrUpdated,
      unknownDirectionEvents,
      historyFailures,
    };
  }

  private async markMirrorChatFailure(
    lineOfficialAccountId: string,
    lineChatUserId: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<void> {
    await this.prisma.lineChatMirrorChat.update({
      where: {
        lineOfficialAccountId_lineChatUserId: {
          lineOfficialAccountId,
          lineChatUserId,
        },
      },
      data: {
        status: LineChatMirrorSyncStatus.FAILED,
        lastErrorCode: errorCode,
        lastErrorMessage: errorMessage,
      },
    });
  }

  private async countPendingChats(lineOfficialAccountId: string): Promise<number> {
    const chats = await this.prisma.lineChatMirrorChat.findMany({
      where: {
        lineOfficialAccountId,
        lastMessageAt: { not: null },
      },
      select: {
        lastMessageAt: true,
        historySyncedThroughAt: true,
      },
    });
    return chats.filter((chat) =>
      chat.lastMessageAt
      && (
        !chat.historySyncedThroughAt
        || chat.historySyncedThroughAt.getTime() < chat.lastMessageAt.getTime()
      ),
    ).length;
  }

  private async markStoreFailure(input: {
    lineOfficialAccountId: string;
    status: LineChatMirrorSyncStatus;
    errorCode: string;
    errorMessage: string;
    durationMs: number;
  }): Promise<void> {
    await this.prisma.lineChatMirrorStoreState.update({
      where: { lineOfficialAccountId: input.lineOfficialAccountId },
      data: {
        status: input.status,
        lastCompletedAt: new Date(),
        lastFailureAt: new Date(),
        lastErrorCode: input.errorCode,
        lastErrorMessage: input.errorMessage,
        lastCycleDurationMs: input.durationMs,
      },
    });
    this.logger.warn(JSON.stringify({
      event: "line_chat_mirror_store_cycle_failed",
      lineOfficialAccountId: input.lineOfficialAccountId,
      errorCode: input.errorCode,
      // Error messages are already bounded before reaching this helper. Keep
      // runtime diagnostics concise while exposing enough detail to distinguish
      // Manager transport, browser/profile, auth, and lease failures.
      failureDetail: input.errorMessage.slice(0, 240),
      durationMs: input.durationMs,
    }));
  }
}
