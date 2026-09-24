import { Inject, Injectable, Optional } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { LINE_CHAT_HISTORICAL_PILOT_STORE_CODES } from "./line-chat-historical-backfill";
import { LineChatMirrorService, type MirrorStoreTargetInputs } from "./line-chat-mirror.service";
import {
  LineChatProfileOperationCoordinator,
  type ProfileOperationResult,
} from "./line-chat-profile-operation-coordinator.service";
import { LineChatSessionService } from "./line-chat-session.service";
import type {
  LineChatDiscoveredChat,
  LineChatDiscoveryChunkResult,
  LineChatDiscoveryContinuation,
  LineChatDiscoveryResult,
} from "./line-chat.types";
import {
  SeptemberChatListOrderTracker,
  buildSeptemberChatInventoryReport,
  emptySeptemberChatInventoryReport,
  isSeptemberHistoricalChatCandidate,
  type SeptemberChatInventoryReport,
} from "./line-chat-september-inventory";

const INVENTORY_MAX_PAGES_PER_PROFILE_LEASE = 12;
const INVENTORY_MAX_CHATS_PER_PROFILE_LEASE = 600;
const INVENTORY_MAX_DISCOVERY_DURATION_MS = 15_000;
const INVENTORY_MAX_TOTAL_PAGES = 200;
const INVENTORY_MAX_TOTAL_CHATS = 10_000;
const INVENTORY_MAX_TOTAL_DURATION_MS = 180_000;
const INVENTORY_MAX_BUSY_RETRIES = 3;
const INVENTORY_CHUNK_YIELD_MS = 750;

export interface SeptemberInventoryChunkBudget {
  maxPages: number;
  maxChats: number;
  maxDurationMs: number;
  stopReason: "PAGE_LIMIT" | "CHAT_LIMIT" | "TIME_LIMIT" | null;
}

/** Computes the next lease budget without allowing the global caps to overshoot. */
export function computeSeptemberInventoryChunkBudget(input: {
  pagesFetched: number;
  chatsObserved: number;
  elapsedMs: number;
}): SeptemberInventoryChunkBudget {
  const remainingPages = INVENTORY_MAX_TOTAL_PAGES - input.pagesFetched;
  const remainingChats = INVENTORY_MAX_TOTAL_CHATS - input.chatsObserved;
  const remainingDurationMs = INVENTORY_MAX_TOTAL_DURATION_MS - input.elapsedMs;

  if (remainingDurationMs <= 0) {
    return { maxPages: 0, maxChats: 0, maxDurationMs: 0, stopReason: "TIME_LIMIT" };
  }
  if (remainingPages <= 0) {
    return { maxPages: 0, maxChats: 0, maxDurationMs: 0, stopReason: "PAGE_LIMIT" };
  }
  if (remainingChats <= 0) {
    return { maxPages: 0, maxChats: 0, maxDurationMs: 0, stopReason: "CHAT_LIMIT" };
  }

  return {
    maxPages: Math.min(INVENTORY_MAX_PAGES_PER_PROFILE_LEASE, remainingPages),
    maxChats: Math.min(INVENTORY_MAX_CHATS_PER_PROFILE_LEASE, remainingChats),
    maxDurationMs: Math.min(INVENTORY_MAX_DISCOVERY_DURATION_MS, remainingDurationMs),
    stopReason: null,
  };
}

export interface SeptemberChatInventoryTarget {
  storeCode: string;
  lineOfficialAccountId: string;
  botId: string;
  targetResolutionSource?: "EXISTING_OA" | "MANAGER_ACCOUNT_REDIRECT";
  session: {
    id: string;
    sessionKey?: string | null;
    profilePath?: string | null;
    profileStorageKey?: string | null;
  };
}

@Injectable()
export class LineChatSeptemberInventoryService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LineChatSessionService) private readonly sessionService: LineChatSessionService,
    @Inject(LineChatProfileOperationCoordinator)
    private readonly coordinator: LineChatProfileOperationCoordinator,
    @Optional()
    @Inject(LineChatMirrorService)
    private readonly mirrorService: LineChatMirrorService | undefined = undefined,
  ) {}

  /** Builds sanitized reports for the three approved A1 pilot stores, serially. */
  public async discoverPilotStores(
    requestedStoreCodes: readonly string[] = LINE_CHAT_HISTORICAL_PILOT_STORE_CODES,
  ): Promise<SeptemberChatInventoryReport[]> {
    const storeCodes = LINE_CHAT_HISTORICAL_PILOT_STORE_CODES.filter((storeCode) =>
      requestedStoreCodes.includes(storeCode),
    );
    const storeStates = await this.prisma.lineChatMirrorStoreState.findMany({
      where: { storeCode: { in: storeCodes } },
      select: { storeCode: true, lineOfficialAccountId: true, enabled: true },
    });
    const reports: SeptemberChatInventoryReport[] = [];
    const mirrorService = this.mirrorService;

    for (const storeCode of storeCodes) {
      const matchingStates = storeStates.filter((state) => state.storeCode === storeCode);
      if (matchingStates.length !== 1) {
        reports.push(emptySeptemberChatInventoryReport(
          storeCode,
          matchingStates.length === 0 ? "MIRROR_TARGET_NOT_FOUND" : "MIRROR_TARGET_AMBIGUOUS",
        ));
        await this.yieldToProfileWaiters();
        continue;
      }
      const [state] = matchingStates;
      if (!state.enabled) {
        reports.push(emptySeptemberChatInventoryReport(storeCode, "MIRROR_TARGET_DISABLED"));
        await this.yieldToProfileWaiters();
        continue;
      }
      if (!mirrorService) {
        reports.push(emptySeptemberChatInventoryReport(storeCode, "MIRROR_TARGET_RESOLVER_UNAVAILABLE"));
        await this.yieldToProfileWaiters();
        continue;
      }

      let storeTarget: MirrorStoreTargetInputs;
      try {
        storeTarget = await mirrorService.getStoreMirrorTargetInputs(storeCode);
      } catch (error) {
        const errorCode = error instanceof Error ? error.message : "";
        const reason = errorCode === "MIRROR_STORE_NOT_FOUND"
          ? "MIRROR_TARGET_NOT_FOUND"
          : errorCode.startsWith("MIRROR_OA_IDENTITY_")
            ? "MIRROR_TARGET_AMBIGUOUS"
            : "MIRROR_TARGET_RESOLUTION_FAILED";
        reports.push(emptySeptemberChatInventoryReport(storeCode, reason));
        await this.yieldToProfileWaiters();
        continue;
      }
      if (state.lineOfficialAccountId !== storeTarget.oa.id) {
        reports.push(emptySeptemberChatInventoryReport(storeCode, "MIRROR_OA_MAPPING_MISMATCH"));
        await this.yieldToProfileWaiters();
        continue;
      }

      const targetResolution = await mirrorService.resolveMirrorTarget({
        storeCode,
        lineOfficialAccountId: storeTarget.oa.id,
        chatBotId: storeTarget.oa.chatBotId,
        basicId: storeTarget.oa.basicId,
        lineChatWorkspaceUrl: storeTarget.oa.lineChatWorkspaceUrl,
        storeManagerUrl: storeTarget.storeManagerUrl,
        lineChatSession: storeTarget.oa.lineChatSession,
      }).catch(() => null);
      if (!targetResolution?.ok) {
        reports.push(emptySeptemberChatInventoryReport(
          storeCode,
          targetResolution && !targetResolution.ok
            ? targetResolution.errorCode === "MIRROR_MANAGER_TARGET_BUSY"
              ? "PROFILE_OPERATION_BUSY"
              : targetResolution.errorCode
            : "MIRROR_TARGET_RESOLUTION_FAILED",
        ));
        await this.yieldToProfileWaiters();
        continue;
      }

      reports.push(await this.discoverStore({
        storeCode,
        lineOfficialAccountId: storeTarget.oa.id,
        botId: targetResolution.botId,
        session: targetResolution.session,
        targetResolutionSource: targetResolution.source,
      }));
      await this.yieldToProfileWaiters();
    }

    return reports;
  }

  /** Lets already-scheduled profile work enter between bounded inventory leases. */
  private async yieldToProfileWaiters(delayMs = 0): Promise<void> {
    if (delayMs > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, delayMs);
      });
      return;
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  /**
   * Discovers one store's LINE chat-list inventory in bounded profile leases.
   * Opaque Manager continuation values stay inside LineChatSessionService as
   * in-process handles and are never persisted or logged.
   */
  public async discoverStore(
    target: SeptemberChatInventoryTarget,
  ): Promise<SeptemberChatInventoryReport> {
    let profilePath: string;
    try {
      profilePath = this.sessionService.resolveProfilePath(target.session);
    } catch {
      return emptySeptemberChatInventoryReport(target.storeCode, "PROFILE_UNAVAILABLE");
    }

    const startedAtMs = Date.now();
    const order = new SeptemberChatListOrderTracker();
    const chatsById = new Map<string, LineChatDiscoveredChat>();
    let continuation: LineChatDiscoveryContinuation | null = null;
    let pagesFetched = 0;
    let totalRawRecords = 0;
    let validUserChats = 0;
    let ignoredNonUserRecords = 0;
    let invalidUserRecords = 0;
    let duplicateIds = 0;
    let conflictingDuplicates = 0;
    let endpoint = this.sessionService.buildChatListUrl(target.botId);
    let stoppedEarlyByObserver = false;
    let nextTerminationObserved = false;
    let pageLimitReached = false;
    let chatLimitReached = false;
    let timeLimitReached = false;
    let enumerationError: string | undefined;
    let busyRetries = 0;

    const mergeChats = (chats: readonly LineChatDiscoveredChat[]): void => {
      for (const chat of chats) {
        const previous = chatsById.get(chat.chatUserId);
        if (!previous) {
          chatsById.set(chat.chatUserId, chat);
          continue;
        }
        duplicateIds += 1;
        if (JSON.stringify(previous) !== JSON.stringify(chat)) {
          conflictingDuplicates += 1;
        }
      }
    };

    while (true) {
      const budget = computeSeptemberInventoryChunkBudget({
        pagesFetched,
        chatsObserved: chatsById.size,
        elapsedMs: Date.now() - startedAtMs,
      });

      if (budget.stopReason === "TIME_LIMIT") {
        timeLimitReached = true;
        enumerationError = "Chat-list total inventory time limit reached.";
        break;
      }
      if (budget.stopReason === "PAGE_LIMIT") {
        pageLimitReached = true;
        enumerationError = "Chat-list global page limit reached.";
        break;
      }
      if (budget.stopReason === "CHAT_LIMIT") {
        chatLimitReached = true;
        enumerationError = "Chat-list global discovered-chat limit reached.";
        break;
      }

      let operation: ProfileOperationResult<LineChatDiscoveryChunkResult>;
      try {
        operation = await this.coordinator.withProfileOperation(
          { sessionId: target.session.id, operationKind: "MANUAL_DIAGNOSTIC" },
          async (operationContext) => this.sessionService.discoverChatsChunk({
            botId: target.botId,
            profilePath,
            headless: true,
            operationContext,
            pageObserver: order.observePage,
            continuation,
            maxPages: budget.maxPages,
            maxChats: budget.maxChats,
            maxDurationMs: budget.maxDurationMs,
          }),
          { waitForLock: false },
        );
      } catch {
        if (pagesFetched === 0) {
          return emptySeptemberChatInventoryReport(target.storeCode, "CHAT_LIST_DISCOVERY_FAILED");
        }
        enumerationError = "CHAT_LIST_DISCOVERY_FAILED_DURING_RESUMABLE_INVENTORY";
        break;
      }

      if (!operation.acquired) {
        busyRetries += 1;
        if (busyRetries >= INVENTORY_MAX_BUSY_RETRIES) {
          if (pagesFetched === 0) {
            return emptySeptemberChatInventoryReport(target.storeCode, "PROFILE_OPERATION_BUSY");
          }
          enumerationError = "PROFILE_OPERATION_BUSY_DURING_RESUMABLE_INVENTORY";
          break;
        }
        await this.yieldToProfileWaiters(Math.min(operation.retryAfterMs, 5_000));
        continue;
      }

      busyRetries = 0;
      const chunk = operation.value.discovery;
      endpoint = chunk.endpoint;
      pagesFetched += chunk.pagesFetched;
      totalRawRecords += chunk.totalRawRecords;
      validUserChats += chunk.validUserChats;
      ignoredNonUserRecords += chunk.ignoredNonUserRecords;
      invalidUserRecords += chunk.invalidUserRecords;
      duplicateIds += chunk.duplicateIds;
      conflictingDuplicates += chunk.conflictingDuplicates;
      mergeChats(chunk.chats);

      if (pagesFetched > INVENTORY_MAX_TOTAL_PAGES) {
        pageLimitReached = true;
        enumerationError = "Chat-list global page limit exceeded unexpectedly.";
        break;
      }
      if (chatsById.size > INVENTORY_MAX_TOTAL_CHATS) {
        chatLimitReached = true;
        enumerationError = "Chat-list global discovered-chat limit exceeded unexpectedly.";
        break;
      }
      if (Date.now() - startedAtMs > INVENTORY_MAX_TOTAL_DURATION_MS) {
        timeLimitReached = true;
        enumerationError = "Chat-list total inventory time limit exceeded unexpectedly.";
        break;
      }

      if (chunk.enumerationError) {
        enumerationError = chunk.enumerationError;
        timeLimitReached = chunk.timeLimitReached === true;
        break;
      }

      stoppedEarlyByObserver = stoppedEarlyByObserver || chunk.stoppedEarlyByObserver === true;
      if (stoppedEarlyByObserver) {
        nextTerminationObserved = false;
        break;
      }

      continuation = operation.value.continuation;
      if (!continuation) {
        nextTerminationObserved = chunk.nextTerminationObserved;
        if (!nextTerminationObserved) {
          enumerationError = "CHAT_LIST_CONTINUATION_UNAVAILABLE";
        }
        break;
      }

      // The lease has been released at this point. Give realtime Mirror and
      // reconciliation timers a chance to enter before the next bounded chunk.
      await this.yieldToProfileWaiters(INVENTORY_CHUNK_YIELD_MS);
    }

    const orderSnapshot = order.snapshot();
    const completeByCursor = nextTerminationObserved
      && !enumerationError
      && invalidUserRecords === 0
      && conflictingDuplicates === 0;
    const discovery: LineChatDiscoveryResult = {
      botId: target.botId,
      endpoint,
      responseShape: "list",
      enumerationStatus: completeByCursor ? "COMPLETE" : "PARTIAL",
      chats: [...chatsById.values()],
      pagesFetched,
      totalRawRecords,
      validUserChats,
      ignoredNonUserRecords,
      invalidUserRecords,
      duplicateIds,
      conflictingDuplicates,
      nextTerminationObserved,
      ...(enumerationError ? { enumerationError } : {}),
      ...(stoppedEarlyByObserver ? { stoppedEarlyByObserver: true } : {}),
      ...(pageLimitReached ? { pageLimitReached: true } : {}),
      ...(chatLimitReached ? { chatLimitReached: true } : {}),
      ...(timeLimitReached ? { timeLimitReached: true } : {}),
    };

    const septemberChats = discovery.chats.filter((chat) =>
      isSeptemberHistoricalChatCandidate(chat.lastMessageAt),
    );
    const historicalStates = septemberChats.length === 0
      ? []
      : await this.prisma.lineChatMirrorChat.findMany({
        where: {
          lineOfficialAccountId: target.lineOfficialAccountId,
          lineChatUserId: { in: septemberChats.map((chat) => chat.chatUserId) },
        },
        select: {
          lineChatUserId: true,
          historicalBackfillStatus: true,
        },
      });

    const report = buildSeptemberChatInventoryReport({
      storeCode: target.storeCode,
      discovery,
      order: orderSnapshot,
      historicalStates,
    });
    const forcedIncompleteReason = enumerationError === "PROFILE_OPERATION_BUSY_DURING_RESUMABLE_INVENTORY"
      || enumerationError === "CHAT_LIST_DISCOVERY_FAILED_DURING_RESUMABLE_INVENTORY"
      ? enumerationError
      : null;
    return {
      ...report,
      targetResolutionSource: target.targetResolutionSource ?? null,
      ...(forcedIncompleteReason
        ? {
            inventoryComplete: false,
            inventoryIncompleteReason: forcedIncompleteReason,
            septemberChats: null,
            historicalCheckedRate: null,
            fastPathCompleteRate: null,
          }
        : {}),
    };
  }

  /** Runs read-only store inventories serially to avoid overlapping Manager profiles. */
  public async discoverStores(
    targets: readonly SeptemberChatInventoryTarget[],
  ): Promise<SeptemberChatInventoryReport[]> {
    const reports: SeptemberChatInventoryReport[] = [];
    for (const target of targets) {
      reports.push(await this.discoverStore(target));
    }
    return reports;
  }
}
