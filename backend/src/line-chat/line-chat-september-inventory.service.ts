import { Inject, Injectable, Optional } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { LINE_CHAT_HISTORICAL_PILOT_STORE_CODES } from "./line-chat-historical-backfill";
import { LineChatMirrorService, type MirrorStoreTargetInputs } from "./line-chat-mirror.service";
import { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";
import { LineChatSessionService } from "./line-chat-session.service";
import type { LineChatDiscoveryResult } from "./line-chat.types";
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
  public async discoverPilotStores(): Promise<SeptemberChatInventoryReport[]> {
    const storeStates = await this.prisma.lineChatMirrorStoreState.findMany({
      where: { storeCode: { in: [...LINE_CHAT_HISTORICAL_PILOT_STORE_CODES] } },
      select: { storeCode: true, lineOfficialAccountId: true, enabled: true },
    });
    const reports: SeptemberChatInventoryReport[] = [];
    const mirrorService = this.mirrorService;

    for (const storeCode of LINE_CHAT_HISTORICAL_PILOT_STORE_CODES) {
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
  private async yieldToProfileWaiters(): Promise<void> {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  /**
   * Discovers one store's LINE chat-list inventory and joins only its
   * persisted historical checkpoint state. It does not write mirror messages
   * or historical checkpoints; the coordinator lease protects the shared profile.
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

    const operation = await this.coordinator.withProfileOperation(
      { sessionId: target.session.id, operationKind: "MANUAL_DIAGNOSTIC" },
      async (operationContext) => {
        const order = new SeptemberChatListOrderTracker();
        let discovery: LineChatDiscoveryResult;
        try {
          discovery = await this.sessionService.discoverChats({
            botId: target.botId,
            profilePath,
            headless: true,
            operationContext,
            pageObserver: order.observePage,
            maxPages: INVENTORY_MAX_PAGES_PER_PROFILE_LEASE,
            maxChats: INVENTORY_MAX_CHATS_PER_PROFILE_LEASE,
            maxDurationMs: INVENTORY_MAX_DISCOVERY_DURATION_MS,
          });
        } catch {
          return emptySeptemberChatInventoryReport(target.storeCode, "CHAT_LIST_DISCOVERY_FAILED");
        }

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
          order: order.snapshot(),
          historicalStates,
        });
        return {
          ...report,
          targetResolutionSource: target.targetResolutionSource ?? null,
        };
      },
      { waitForLock: false },
    );

    return operation.acquired
      ? operation.value
      : emptySeptemberChatInventoryReport(target.storeCode, "PROFILE_OPERATION_BUSY");
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
