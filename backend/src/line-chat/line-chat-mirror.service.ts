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
  if (normalized === "messagereceived") return LineChatMirrorDirection.INBOUND;
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
        storeMaster: { select: { externalStoreId: true } },
        lineOfficialAccounts: {
          where: {
            accountType: LineAccountType.STORE,
            isActive: true,
            archivedAt: null,
          },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: {
            id: true,
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

    const oa = store?.lineOfficialAccounts[0];
    const effectiveStoreCode = store?.code?.trim()
      || store?.storeMaster?.externalStoreId?.trim()
      || storeCode;
    if (!store || !oa) {
      throw new Error("MIRROR_STORE_OR_ACTIVE_OA_NOT_FOUND");
    }

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

    const session = oa.lineChatSession;
    const botId = oa.chatBotId?.trim() || "";
    if (!botId || !session || session.status !== LineChatSessionStatus.ACTIVE) {
      const durationMs = Date.now() - startedAtMs;
      await this.markStoreFailure({
        lineOfficialAccountId: oa.id,
        status: LineChatMirrorSyncStatus.FAILED,
        errorCode: !botId ? "MISSING_CHAT_BOT_ID" : "MIRROR_SESSION_NOT_ACTIVE",
        errorMessage: !botId
          ? "LINE OA has no chatBotId."
          : "LINE OA Manager session is missing or not ACTIVE.",
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
    );

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
    }));
    return result;
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
              messageType: typeof item.message?.type === "string"
                ? item.message.type
                : null,
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
      durationMs: input.durationMs,
    }));
  }
}
