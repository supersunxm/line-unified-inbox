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
import {
  HistoricalBackfillStatus,
  LINE_CHAT_HISTORICAL_PILOT_STORE_CODES,
  classifyHistoricalPage,
  historicalBackfillCanResume,
  historicalFetchFailurePatch,
  historicalFetchResultPatch,
  historicalFetchStartedPatch,
  lineChatHistoricalLowerBound,
  parseManagerHistoryPage,
  persistHistoricalEvents,
  runIndependently,
} from "./line-chat-historical-backfill";
import {
  SEPTEMBER_CHAT_LOWER_BOUND_ISO,
  SEPTEMBER_CHAT_UPPER_BOUND_EXCLUSIVE_ISO,
  isSeptemberHistoricalChatCandidate,
} from "./line-chat-september-inventory";
import { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";
import { LineChatSessionService } from "./line-chat-session.service";
import { selectLineChatStoreOa, type LineChatStoreOaSelection } from "./line-chat-store-oa-selector";

const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 30_000;
const START_DELAY_MS = 10_000;
const DEFAULT_MAX_CHANGED_CHATS_PER_CYCLE = 20;
const MAX_CHANGED_CHATS_PER_CYCLE = 50;
const RECENT_MAX_PAGES = 5;
const RECENT_MAX_CHATS = 125;
const HISTORICAL_MAX_CONVERSATIONS_PER_STORE_CYCLE = 1;

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

interface PendingHistoricalMirrorChat extends PendingMirrorChat {
  historicalBackfillStatus: string | null;
}

interface HistoricalMirrorTarget {
  storeCode: string;
  lineOfficialAccountId: string;
  botId: string;
  profilePath: string;
  session: MirrorSessionTarget;
  liveMirrorStatus: LineChatMirrorSyncStatus;
}

interface HistoricalBackfillConversationResult {
  status: string;
  eventsObserved: number;
  validEventsPersisted: number;
  upsertOperations: number;
  existingBeforeWrite: number;
  invalidEventCount: number;
  oldestValidTimestamp: Date | null;
  newestValidTimestamp: Date | null;
  errorCode: string | null;
  retried: boolean;
}

export interface MirrorSessionTarget {
  id: string;
  sessionKey: string;
  status: LineChatSessionStatus;
  profilePath: string | null;
  profileStorageKey: string | null;
}

export interface MirrorStoreTargetInputs {
  storeId: string;
  effectiveStoreCode: string;
  storeMasterAccountName: string | null;
  storeMasterLineId: string | null;
  storeManagerUrl: string | null;
  selectionSource: Extract<LineChatStoreOaSelection, { ok: true }>['source'];
  oa: {
    id: string;
    name: string;
    basicId: string | null;
    lineChatWorkspaceUrl: string | null;
    chatBotId: string | null;
    lineChatSession: MirrorSessionTarget | null;
  };
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
        | "MIRROR_MANAGER_TARGET_BUSY"
        | "MIRROR_MANAGER_TARGET_NOT_FOUND"
        | "MIRROR_MANAGER_TARGET_AMBIGUOUS";
      errorMessage: string;
    };

type MirrorTargetResolutionOutcome =
  | "CACHE_HIT"
  | "EXISTING_OA"
  | "MANAGER_ACCOUNT_REDIRECT"
  | "NO_MANAGER_ACCOUNT_KEY"
  | "NO_ACTIVE_SESSION"
  | "NO_USABLE_SESSION"
  | "PROFILE_BUSY"
  | "AUTH_NOT_CONFIRMED"
  | "REDIRECT_BOT_ID_NOT_FOUND"
  | "RECENT_DISCOVERY_REJECTED"
  | "AMBIGUOUS"
  | "TRUE_TARGET_NOT_FOUND";

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

export function isLineChatHistoricalBackfillEnabled(): boolean {
  return process.env.LINE_CHAT_HISTORICAL_BACKFILL_ENABLED?.trim().toLowerCase() === "true";
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
  const message = error instanceof Error ? error.message : String(error);
  const browserLogsIndex = message.indexOf("Browser logs:");
  if (
    browserLogsIndex >= 0
    && message.includes("browserType.launchPersistentContext:")
  ) {
    const summary = message.slice(0, browserLogsIndex).replace(/\s+/gu, " ").trim();
    // Playwright's launch command can fill the log limit before Chromium emits
    // its exit detail. Keep the output tail, omit that command, and redact profiles.
    const browserOutput = message
      .slice(browserLogsIndex + "Browser logs:".length)
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("<launching>"))
      .map((line) =>
        line.replace(/\/data\/line-chat-profiles\/[^\s]+/gu, "/data/line-chat-profiles/[profile]"),
      )
      .join(" | ");
    const diagnostic = browserOutput || "No browser stderr captured after launch command.";
    return `${summary.slice(0, 80)} | browser: ${diagnostic.slice(-150)}`.slice(0, 240);
  }
  return message.slice(0, 500);
}

function safeErrorType(error: unknown): string {
  return error instanceof Error ? error.name.slice(0, 80) : "UNKNOWN_ERROR";
}

function maskIdentifier(value: string): string {
  return value.length <= 8 ? "[masked]" : `${value.slice(0, 4)}...${value.slice(-4)}`;
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
  private readonly historicalTargetsForCycle = new Map<string, HistoricalMirrorTarget>();

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
      historicalBackfillEnabled: isLineChatHistoricalBackfillEnabled(),
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
    this.historicalTargetsForCycle.clear();
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
      if (isLineChatHistoricalBackfillEnabled()) {
        const pilotTargetStatuses = LINE_CHAT_HISTORICAL_PILOT_STORE_CODES
          .map((storeCode) => this.historicalTargetsForCycle.get(storeCode))
          .filter((target): target is HistoricalMirrorTarget => target !== undefined)
          .map((target) => ({
            ...target,
            liveMirrorStatus: results.find((result) => result.storeCode === target.storeCode)?.status
              ?? LineChatMirrorSyncStatus.FAILED,
          }));
        const pilotTargets = pilotTargetStatuses.filter((target) => {
          if (target.liveMirrorStatus === LineChatMirrorSyncStatus.SUCCESS) return true;
          this.logger.log(JSON.stringify({
            event: "line_chat_historical_backfill_store_deferred",
            storeCode: target.storeCode,
            reason: "LIVE_MIRROR_NOT_SUCCESSFUL",
            liveMirrorStatus: target.liveMirrorStatus,
          }));
          return false;
        });
        await runIndependently({
          items: pilotTargets,
          process: (target) => this.runHistoricalBackfillStore(target),
          onFailure: (target, error) => {
            this.logger.warn(JSON.stringify({
              event: "line_chat_historical_backfill_store_failed",
              storeCode: target.storeCode,
              errorType: safeErrorType(error),
            }));
            return Promise.resolve();
          },
        });
      }
      return results;
    } finally {
      this.running = false;
    }
  }

  /**
   * Read-only canonical store/OA selection shared by Live Mirror and inventory.
   * The caller decides when to persist cycle state or resolve the browser target.
   */
  public async getStoreMirrorTargetInputs(storeCode: string): Promise<MirrorStoreTargetInputs> {
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
    return {
      storeId: store.id,
      effectiveStoreCode,
      storeMasterAccountName: store.storeMaster?.accountName ?? null,
      storeMasterLineId: store.storeMaster?.lineId ?? null,
      storeManagerUrl: store.storeMaster?.lineManagerUrl ?? null,
      selectionSource: oaSelection.source,
      oa: {
        id: oa.id,
        name: oa.name,
        basicId: oa.basicId,
        lineChatWorkspaceUrl: oa.lineChatWorkspaceUrl,
        chatBotId: oa.chatBotId,
        lineChatSession: oa.lineChatSession,
      },
    };
  }

  private async syncStore(storeCode: string): Promise<LineChatMirrorCycleResult> {
    const startedAtMs = Date.now();
    const storeTarget = await this.getStoreMirrorTargetInputs(storeCode);
    const effectiveStoreCode = storeTarget.effectiveStoreCode;
    const oa = storeTarget.oa;
    this.logger.log(JSON.stringify({
      event: "line_chat_mirror_oa_selected",
      storeCode: effectiveStoreCode,
      storeMasterAccountName: storeTarget.storeMasterAccountName,
      storeMasterLineId: storeTarget.storeMasterLineId,
      lineOfficialAccountId: oa.id,
      lineOfficialAccountName: oa.name,
      selectionSource: storeTarget.selectionSource,
    }));

    await this.prisma.lineChatMirrorStoreState.upsert({
      where: { lineOfficialAccountId: oa.id },
      update: {
        storeId: storeTarget.storeId,
        storeCode: effectiveStoreCode,
        enabled: true,
        status: LineChatMirrorSyncStatus.RUNNING,
        lastStartedAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
      },
      create: {
        lineOfficialAccountId: oa.id,
        storeId: storeTarget.storeId,
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
      storeCode: effectiveStoreCode,
      lineOfficialAccountId: oa.id,
      chatBotId: oa.chatBotId,
      basicId: oa.basicId,
      lineChatWorkspaceUrl: oa.lineChatWorkspaceUrl,
      storeManagerUrl: storeTarget.storeManagerUrl,
      lineChatSession: oa.lineChatSession,
    });
    if (!target.ok) {
      const durationMs = Date.now() - startedAtMs;
      if (target.errorCode === "MIRROR_MANAGER_TARGET_BUSY") {
        const pendingChats = await this.markStoreProfileOperationBusy({
          lineOfficialAccountId: oa.id,
          durationMs,
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

    if (
      isLineChatHistoricalBackfillEnabled()
      && LINE_CHAT_HISTORICAL_PILOT_STORE_CODES.some((code) => code === effectiveStoreCode)
    ) {
      this.historicalTargetsForCycle.set(effectiveStoreCode, {
        storeCode: effectiveStoreCode,
        lineOfficialAccountId: oa.id,
        botId,
        profilePath,
        session,
        liveMirrorStatus: LineChatMirrorSyncStatus.RUNNING,
      });
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
          }));
          const failureDetail = recent.failureDetail?.replace(/\s+/gu, " ").trim();
          throw new Error(
            `RECENT_DISCOVERY_${recent.failureReason ?? "FAILED"}${failureDetail ? `: ${failureDetail}` : ""}`,
          );
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
      const pendingChats = await this.markStoreProfileOperationBusy({
        lineOfficialAccountId: oa.id,
        durationMs,
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
    storeCode?: string;
    lineOfficialAccountId: string;
    chatBotId: string | null;
    basicId: string | null;
    lineChatWorkspaceUrl: string | null;
    storeManagerUrl: string | null;
    lineChatSession: MirrorSessionTarget | null;
  }): Promise<MirrorTargetResolution> {
    const diagnostics = {
      sessionsConsidered: 0,
      sessionsWithProfile: 0,
      sessionsBusy: 0,
      sessionsAttempted: 0,
      authenticatedSessions: 0,
      redirectCandidates: 0,
      verifiedCandidates: 0,
      authenticationNotConfirmed: 0,
      redirectsWithoutBotId: 0,
      recentDiscoveryRejected: 0,
    };
    const emitSummary = (outcome: MirrorTargetResolutionOutcome): void => {
      this.logger.log(JSON.stringify({
        event: "line_chat_mirror_target_resolution_summary",
        ...(input.storeCode ? { storeCode: input.storeCode } : {}),
        ...diagnostics,
        outcome,
      }));
    };
    const fail = (
      errorCode: Extract<MirrorTargetResolution, { ok: false }>['errorCode'],
      errorMessage: string,
      outcome: MirrorTargetResolutionOutcome,
    ): MirrorTargetResolution => {
      emitSummary(outcome);
      return { ok: false, errorCode, errorMessage };
    };

    const cached = this.targetCache.get(input.lineOfficialAccountId);
    if (cached && cached.session.status === LineChatSessionStatus.ACTIVE) {
      emitSummary("CACHE_HIT");
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
      emitSummary("EXISTING_OA");
      return { ok: true, ...resolved };
    }

    const managerAccountKey = managerAccountKeyFromInputs({
      lineChatWorkspaceUrl: input.lineChatWorkspaceUrl,
      storeManagerUrl: input.storeManagerUrl,
      basicId: input.basicId,
    });
    if (!managerAccountKey) {
      return fail(
        "MIRROR_MANAGER_ACCOUNT_KEY_MISSING",
        "No LINE Manager account URL or Basic ID is available for mirror discovery.",
        "NO_MANAGER_ACCOUNT_KEY",
      );
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
    diagnostics.sessionsConsidered = sessions.length;

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
      diagnostics.sessionsWithProfile += 1;

      const resolved = await this.coordinator.withProfileOperation(
        { sessionId: session.id, operationKind: "MIRROR_SYNC" },
        async (operationContext) => {
          diagnostics.sessionsAttempted += 1;
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
              diagnostics.authenticatedSessions += 1;
              resolvedBotId = managerBotIdFromRedirect(page.url());
              if (resolvedBotId) diagnostics.redirectCandidates += 1;
              else diagnostics.redirectsWithoutBotId += 1;
            } else {
              diagnostics.authenticationNotConfirmed += 1;
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
            diagnostics.recentDiscoveryRejected += 1;
            this.logger.warn(JSON.stringify({
              event: "line_chat_mirror_target_candidate_rejected",
              ...(input.storeCode ? { storeCode: input.storeCode } : {}),
              reason: `RECENT_DISCOVERY_${verification.failureReason ?? "FAILED"}`,
              botIdMasked: `${resolvedBotId.slice(0, 4)}...${resolvedBotId.slice(-4)}`,
            }));
            return null;
          }
          diagnostics.verifiedCandidates += 1;
          return resolvedBotId;
        },
        { waitForLock: false },
      );
      if (!resolved.acquired) {
        diagnostics.sessionsBusy += 1;
        continue;
      }
      if (!resolved.value) continue;
      candidates.push({
        botId: resolved.value,
        session,
      });
    }

    const candidate = selectMirrorResolvedCandidate(candidates);
    if (candidate === null) {
      if (diagnostics.sessionsBusy > 0) {
        return fail(
          "MIRROR_MANAGER_TARGET_BUSY",
          "One or more LINE OA Manager profiles are temporarily busy.",
          "PROFILE_BUSY",
        );
      }
      if (sessions.length === 0) {
        return fail(
          "MIRROR_MANAGER_TARGET_NOT_FOUND",
          "No active LINE Manager session could open this OA account.",
          "NO_ACTIVE_SESSION",
        );
      }
      if (diagnostics.sessionsWithProfile === 0) {
        return fail(
          "MIRROR_MANAGER_TARGET_NOT_FOUND",
          "No active LINE Manager session has an available browser profile.",
          "NO_USABLE_SESSION",
        );
      }
      if (diagnostics.recentDiscoveryRejected > 0) {
        return fail(
          "MIRROR_MANAGER_TARGET_NOT_FOUND",
          "LINE Manager target candidates failed recent-chat verification.",
          "RECENT_DISCOVERY_REJECTED",
        );
      }
      if (diagnostics.authenticatedSessions > 0 && diagnostics.redirectsWithoutBotId > 0) {
        return fail(
          "MIRROR_MANAGER_TARGET_NOT_FOUND",
          "Authenticated LINE Manager redirects did not identify a chat target.",
          "REDIRECT_BOT_ID_NOT_FOUND",
        );
      }
      if (diagnostics.sessionsAttempted > 0 && diagnostics.authenticationNotConfirmed > 0) {
        return fail(
          "MIRROR_MANAGER_TARGET_NOT_FOUND",
          "LINE Manager authentication could not be confirmed.",
          "AUTH_NOT_CONFIRMED",
        );
      }
      return fail(
        "MIRROR_MANAGER_TARGET_NOT_FOUND",
        "No active LINE Manager session could open this OA account.",
        "TRUE_TARGET_NOT_FOUND",
      );
    }
    if (candidate === "AMBIGUOUS") {
      return fail(
        "MIRROR_MANAGER_TARGET_AMBIGUOUS",
        "More than one distinct LINE Manager OA bot resolved this account.",
        "AMBIGUOUS",
      );
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
      botIdMasked: `${result.botId.slice(0, 4)}...${result.botId.slice(-4)}`,
    }));
    emitSummary("MANAGER_ACCOUNT_REDIRECT");
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

  private async runHistoricalBackfillStore(target: HistoricalMirrorTarget): Promise<void> {
    const operation = await this.coordinator.withProfileOperation(
      { sessionId: target.session.id, operationKind: "HISTORICAL_BACKFILL" },
      async (operationContext) => {
        operationContext.assertOwnership();
        const resumableStatuses = [
          HistoricalBackfillStatus.FETCHING_INITIAL_PAGE,
          HistoricalBackfillStatus.FAILED,
        ];
        const candidateWhere = {
          lineOfficialAccountId: target.lineOfficialAccountId,
          lastMessageAt: {
            gte: new Date(SEPTEMBER_CHAT_LOWER_BOUND_ISO),
            lt: new Date(SEPTEMBER_CHAT_UPPER_BOUND_EXCLUSIVE_ISO),
          },
          OR: [
            { historicalBackfillStatus: null },
            { historicalBackfillStatus: { in: resumableStatuses } },
          ],
        };
        const [mirroredChatsStored, historicalCandidatesAvailable, candidates] = await Promise.all([
          this.prisma.lineChatMirrorChat.count({
            where: { lineOfficialAccountId: target.lineOfficialAccountId },
          }),
          this.prisma.lineChatMirrorChat.count({ where: candidateWhere }),
          this.prisma.lineChatMirrorChat.findMany({
            where: candidateWhere,
            orderBy: { lastMessageAt: "desc" },
            take: HISTORICAL_MAX_CONVERSATIONS_PER_STORE_CYCLE,
            select: {
              lineChatUserId: true,
              lastMessageAt: true,
              historicalBackfillStatus: true,
            },
          }),
        ]);
        const candidatesWithTimestamp: PendingHistoricalMirrorChat[] = candidates
          .filter((candidate): candidate is typeof candidate & { lastMessageAt: Date } =>
            candidate.lastMessageAt instanceof Date
            && isSeptemberHistoricalChatCandidate(candidate.lastMessageAt),
          )
          .map((candidate) => ({
            lineChatUserId: candidate.lineChatUserId,
            lastMessageAt: candidate.lastMessageAt,
            historicalBackfillStatus: candidate.historicalBackfillStatus,
          }));

        if (candidatesWithTimestamp.length === 0) {
          this.logger.log(JSON.stringify({
            event: "line_chat_historical_backfill_store_cycle_completed",
            storeCode: target.storeCode,
            mirroredChatsStored,
            historicalCandidatesAvailable,
            conversationsProcessed: 0,
            fastPathComplete: 0,
            needsBackwardPagination: 0,
            coverageUnproven: 0,
            eventsObserved: 0,
            validEventsPersisted: 0,
            upsertOperations: 0,
            existingBeforeWrite: 0,
            failures: 0,
            retries: 0,
            liveMirrorStatus: target.liveMirrorStatus,
          }));
          return;
        }

        let context: BrowserContext | null = null;
        const attemptTimes = new Map<string, Date>();
        try {
          const firstCandidate = candidatesWithTimestamp[0];
          for (const candidate of candidatesWithTimestamp) {
            const attemptedAt = new Date();
            attemptTimes.set(candidate.lineChatUserId, attemptedAt);
            await this.prisma.lineChatMirrorChat.update({
              where: {
                lineOfficialAccountId_lineChatUserId: {
                  lineOfficialAccountId: target.lineOfficialAccountId,
                  lineChatUserId: candidate.lineChatUserId,
                },
              },
              data: historicalFetchStartedPatch(attemptedAt),
            });
          }
          context = await this.sessionService.launchManagedPersistentContext(
            target.profilePath,
            {
              profilePath: target.profilePath,
              headless: true,
              viewport: { width: 1280, height: 800 },
              args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-blink-features=AutomationControlled",
              ],
            },
            { sessionId: target.session.id, sessionKey: target.session.sessionKey },
          );
          const page = context.pages()[0] || await context.newPage();
          const refererUrl = this.sessionService.buildChatRefererUrl(
            target.botId,
            firstCandidate.lineChatUserId,
          );
          await page.goto(refererUrl, {
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

          const ownersUrl = `https://chat.line.biz/api/v1/bots/${encodeURIComponent(target.botId)}/owners`;
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
          const ownerByBizId = new Map(owners.map((owner) => [owner.bizId, owner.name]));

          const outcome = await runIndependently({
            items: candidatesWithTimestamp,
            process: async (candidate): Promise<HistoricalBackfillConversationResult> => {
              operationContext.assertOwnership();
              const attemptedAt = attemptTimes.get(candidate.lineChatUserId) ?? new Date();
              const historyUrl = `https://chat.line.biz/api/v3/bots/${encodeURIComponent(target.botId)}/chats/${encodeURIComponent(candidate.lineChatUserId)}/messages`;
              const history = await page.evaluate(async (url) => {
                const response = await fetch(url, {
                  credentials: "include",
                  signal: AbortSignal.timeout(20_000),
                });
                if (!response.ok) {
                  return {
                    ok: false as const,
                    status: response.status,
                    list: [] as unknown[],
                    backwardPresent: false,
                  };
                }
                const body = await response.json() as {
                  list?: unknown;
                  backward?: unknown;
                };
                return {
                  ok: true as const,
                  status: response.status,
                  list: Array.isArray(body.list) ? body.list : [],
                  backwardPresent: typeof body.backward === "string"
                    && body.backward.trim().length > 0,
                };
              }, historyUrl);
              operationContext.assertOwnership();

              if (!history.ok) {
                const errorCode = `HISTORY_HTTP_${history.status}`;
                await this.prisma.lineChatMirrorChat.update({
                  where: {
                    lineOfficialAccountId_lineChatUserId: {
                      lineOfficialAccountId: target.lineOfficialAccountId,
                      lineChatUserId: candidate.lineChatUserId,
                    },
                  },
                  data: {
                    ...historicalFetchFailurePatch(errorCode),
                    historicalBackfillLastAttemptAt: attemptedAt,
                  },
                });
                return {
                  status: HistoricalBackfillStatus.FAILED,
                  eventsObserved: 0,
                  validEventsPersisted: 0,
                  upsertOperations: 0,
                  existingBeforeWrite: 0,
                  invalidEventCount: 0,
                  oldestValidTimestamp: null,
                  newestValidTimestamp: null,
                  errorCode,
                  retried: candidate.historicalBackfillStatus !== null
                    && historicalBackfillCanResume(candidate.historicalBackfillStatus),
              };
            }

            const fetchedAt = new Date();
            await this.prisma.lineChatMirrorChat.update({
              where: {
                lineOfficialAccountId_lineChatUserId: {
                  lineOfficialAccountId: target.lineOfficialAccountId,
                  lineChatUserId: candidate.lineChatUserId,
                },
              },
              data: { historicalBackfillLastSuccessAt: fetchedAt },
            });
            const parsed = parseManagerHistoryPage(
                { list: history.list, backward: history.backwardPresent ? "present" : undefined },
                ownerByBizId,
              );
              const classification = classifyHistoricalPage({
                events: parsed.events,
                backwardPresent: history.backwardPresent,
              }, lineChatHistoricalLowerBound());
              const persistence = await persistHistoricalEvents({
                writer: {
                  findExistingIds: async (lineOfficialAccountId, managerMessageIds) => {
                    const rows = await this.prisma.lineChatMirrorMessage.findMany({
                      where: {
                        lineOfficialAccountId,
                        managerMessageId: { in: managerMessageIds },
                      },
                      select: { managerMessageId: true },
                    });
                    return rows.map((row) => row.managerMessageId);
                  },
                  upsert: async (lineOfficialAccountId, lineChatUserId, event) => {
                    await this.prisma.lineChatMirrorMessage.upsert({
                      where: {
                        lineOfficialAccountId_managerMessageId: {
                          lineOfficialAccountId,
                          managerMessageId: event.managerMessageId,
                        },
                      },
                      update: {
                        lineChatUserId,
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
                        lineOfficialAccountId,
                        lineChatUserId,
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
                      select: { id: true },
                    });
                  },
                },
                lineOfficialAccountId: target.lineOfficialAccountId,
                lineChatUserId: candidate.lineChatUserId,
                events: parsed.events,
              });
              operationContext.assertOwnership();
              await this.prisma.lineChatMirrorChat.update({
                where: {
                  lineOfficialAccountId_lineChatUserId: {
                    lineOfficialAccountId: target.lineOfficialAccountId,
                    lineChatUserId: candidate.lineChatUserId,
                  },
                },
                data: historicalFetchResultPatch(classification, fetchedAt),
              });
              return {
                status: classification.status,
                eventsObserved: history.list.length,
                validEventsPersisted: persistence.observed,
                upsertOperations: persistence.upsertOperations,
                existingBeforeWrite: persistence.existingBeforeWrite,
                invalidEventCount: parsed.invalidEventCount,
                oldestValidTimestamp: classification.oldestValidTimestamp,
                newestValidTimestamp: classification.newestValidTimestamp,
                errorCode: classification.errorCode,
                retried: candidate.historicalBackfillStatus !== null
                  && historicalBackfillCanResume(candidate.historicalBackfillStatus),
              };
            },
            onFailure: async (candidate, error) => {
              await this.prisma.lineChatMirrorChat.update({
                where: {
                  lineOfficialAccountId_lineChatUserId: {
                    lineOfficialAccountId: target.lineOfficialAccountId,
                    lineChatUserId: candidate.lineChatUserId,
                  },
                },
                data: {
                  ...historicalFetchFailurePatch("HISTORICAL_PAGE_EXCEPTION"),
                  historicalBackfillLastAttemptAt: new Date(),
                },
              });
              this.logger.warn(JSON.stringify({
                event: "line_chat_historical_backfill_conversation_failed",
                storeCode: target.storeCode,
                conversationIdMasked: maskIdentifier(candidate.lineChatUserId),
                errorType: safeErrorType(error),
              }));
            },
          });
          const result = outcome.results[0] ?? null;
          const resultStatus = result?.status ?? null;
          const conversationsProcessed = outcome.results.length + outcome.failures;
          this.logger.log(JSON.stringify({
            event: "line_chat_historical_backfill_store_cycle_completed",
            storeCode: target.storeCode,
            mirroredChatsStored,
            historicalCandidatesAvailable,
            conversationsProcessed,
            fastPathCoverageRate: conversationsProcessed > 0
              ? Number((Number(resultStatus === HistoricalBackfillStatus.FAST_PATH_COMPLETE) / conversationsProcessed).toFixed(4))
              : null,
            fastPathComplete: resultStatus === HistoricalBackfillStatus.FAST_PATH_COMPLETE ? 1 : 0,
            needsBackwardPagination: resultStatus === HistoricalBackfillStatus.NEEDS_BACKWARD_PAGINATION ? 1 : 0,
            coverageUnproven: resultStatus === HistoricalBackfillStatus.HISTORICAL_COVERAGE_UNPROVEN ? 1 : 0,
            eventsObserved: result?.eventsObserved ?? 0,
            validEventsPersisted: result?.validEventsPersisted ?? 0,
            upsertOperations: result?.upsertOperations ?? 0,
            existingBeforeWrite: result?.existingBeforeWrite ?? 0,
            invalidEvents: result?.invalidEventCount ?? 0,
            earliestTimestamp: result?.oldestValidTimestamp?.toISOString() ?? null,
            latestTimestamp: result?.newestValidTimestamp?.toISOString() ?? null,
            status: resultStatus,
            errorCode: result?.errorCode ?? null,
            failures: outcome.failures + (resultStatus === HistoricalBackfillStatus.FAILED ? 1 : 0),
            retries: result?.retried ? 1 : 0,
            liveMirrorStatus: target.liveMirrorStatus,
          }));
        } catch (error) {
          await runIndependently({
            items: candidatesWithTimestamp,
            process: async (candidate) => {
              await this.prisma.lineChatMirrorChat.update({
                where: {
                  lineOfficialAccountId_lineChatUserId: {
                    lineOfficialAccountId: target.lineOfficialAccountId,
                    lineChatUserId: candidate.lineChatUserId,
                  },
                },
                data: {
                  ...historicalFetchFailurePatch("HISTORICAL_STORE_EXCEPTION"),
                  historicalBackfillLastAttemptAt: attemptTimes.get(candidate.lineChatUserId) ?? new Date(),
                },
              });
            },
            onFailure: async () => {},
          });
          throw error;
        } finally {
          if (context) {
            await this.sessionService.closeManagedPersistentContext(context, target.profilePath).catch(() => {});
          }
        }
      },
      { waitForLock: false },
    ).catch((error) => {
      this.logger.warn(JSON.stringify({
        event: "line_chat_historical_backfill_store_failed",
        storeCode: target.storeCode,
        errorType: safeErrorType(error),
      }));
      return null;
    });

    if (!operation) return;
    if (!operation.acquired) {
      this.logger.log(JSON.stringify({
        event: "line_chat_historical_backfill_store_skipped",
        storeCode: target.storeCode,
        reason: operation.reason,
        liveMirrorStatus: target.liveMirrorStatus,
      }));
    }
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

  private async markStoreProfileOperationBusy(input: {
    lineOfficialAccountId: string;
    durationMs: number;
  }): Promise<number> {
    const pendingChats = await this.countPendingChats(input.lineOfficialAccountId);
    await this.prisma.lineChatMirrorStoreState.update({
      where: { lineOfficialAccountId: input.lineOfficialAccountId },
      data: {
        status: LineChatMirrorSyncStatus.PARTIAL,
        lastCompletedAt: new Date(),
        lastFailureAt: new Date(),
        lastErrorCode: "PROFILE_OPERATION_BUSY",
        lastErrorMessage: "PROFILE_OPERATION_BUSY",
        pendingChats,
        lastCycleDurationMs: input.durationMs,
      },
    });
    return pendingChats;
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
