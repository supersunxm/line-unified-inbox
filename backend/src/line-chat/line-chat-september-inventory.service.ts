import { Inject, Injectable, Optional } from "@nestjs/common";
import { LineChatSessionStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { LINE_CHAT_HISTORICAL_PILOT_STORE_CODES } from "./line-chat-historical-backfill";
import { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";
import { LineChatSessionService } from "./line-chat-session.service";
import { LineChatMirrorService } from "./line-chat-mirror.service";
import type { LineChatDiscoveryResult } from "./line-chat.types";
import {
  SeptemberChatListOrderTracker,
  buildSeptemberChatInventoryReport,
  emptySeptemberChatInventoryReport,
  isSeptemberHistoricalChatCandidate,
  type SeptemberChatInventoryReport,
} from "./line-chat-september-inventory";

export interface SeptemberChatInventoryTarget {
  storeCode: string;
  lineOfficialAccountId: string;
  botId: string;
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
    private readonly mirrorService?: LineChatMirrorService,
  ) {}

  /** Builds sanitized reports for the three approved A1 pilot stores, serially. */
  public async discoverPilotStores(): Promise<SeptemberChatInventoryReport[]> {
    const storeStates = await this.prisma.lineChatMirrorStoreState.findMany({
      where: { storeCode: { in: [...LINE_CHAT_HISTORICAL_PILOT_STORE_CODES] } },
      select: { storeCode: true, lineOfficialAccountId: true, enabled: true },
    });
    const reports: SeptemberChatInventoryReport[] = [];

    for (const storeCode of LINE_CHAT_HISTORICAL_PILOT_STORE_CODES) {
      const matchingStates = storeStates.filter((state) => state.storeCode === storeCode);
      if (matchingStates.length !== 1) {
        reports.push(emptySeptemberChatInventoryReport(
          storeCode,
          matchingStates.length === 0 ? "MIRROR_TARGET_NOT_FOUND" : "MIRROR_TARGET_AMBIGUOUS",
        ));
        continue;
      }
      const [state] = matchingStates;
      if (!state.enabled) {
        reports.push(emptySeptemberChatInventoryReport(storeCode, "MIRROR_TARGET_DISABLED"));
        continue;
      }

      const account = await this.prisma.lineOfficialAccount.findUnique({
        where: { id: state.lineOfficialAccountId },
        select: {
          chatBotId: true,
          basicId: true,
          lineChatWorkspaceUrl: true,
          store: {
            select: {
              storeMaster: {
                select: { lineManagerUrl: true },
              },
            },
          },
          lineChatSession: {
            select: {
              id: true,
              sessionKey: true,
              profilePath: true,
              profileStorageKey: true,
              status: true,
            },
          },
        },
      });
      if (!account) {
        reports.push(emptySeptemberChatInventoryReport(storeCode, "MANAGER_TARGET_UNAVAILABLE"));
        continue;
      }

      let botId = account.chatBotId?.trim() ?? "";
      let session = account.lineChatSession;
      if (!botId || !session || session.status !== LineChatSessionStatus.ACTIVE) {
        if (!this.mirrorService) {
          reports.push(emptySeptemberChatInventoryReport(storeCode, "MANAGER_TARGET_UNAVAILABLE"));
          continue;
        }
        const resolved = await this.mirrorService.resolveMirrorTarget({
          lineOfficialAccountId: state.lineOfficialAccountId,
          chatBotId: account.chatBotId,
          basicId: account.basicId,
          lineChatWorkspaceUrl: account.lineChatWorkspaceUrl,
          storeManagerUrl: account.store?.storeMaster?.lineManagerUrl ?? null,
          lineChatSession: account.lineChatSession,
        });
        if (!resolved.ok) {
          reports.push(emptySeptemberChatInventoryReport(storeCode, resolved.errorCode));
          continue;
        }
        botId = resolved.botId;
        session = resolved.session;
      }

      reports.push(await this.discoverStore({
        storeCode,
        lineOfficialAccountId: state.lineOfficialAccountId,
        botId,
        session,
      }));
    }

    return reports;
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

        return buildSeptemberChatInventoryReport({
          storeCode: target.storeCode,
          discovery,
          order: order.snapshot(),
          historicalStates,
        });
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
