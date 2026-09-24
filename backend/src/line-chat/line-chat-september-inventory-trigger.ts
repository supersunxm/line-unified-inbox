import type { LineChatSeptemberInventoryService } from "./line-chat-september-inventory.service";
import {
  emptySeptemberChatInventoryReport,
  type SeptemberChatInventoryReport,
} from "./line-chat-september-inventory";
import { LINE_CHAT_HISTORICAL_PILOT_STORE_CODES } from "./line-chat-historical-backfill";

export const SEPTEMBER_INVENTORY_STARTUP_ENV = "LINE_CHAT_SEPTEMBER_INVENTORY_ON_STARTUP";

type InventoryService = Pick<LineChatSeptemberInventoryService, "discoverPilotStores">;
type InventoryLogger = {
  log: (message: string) => unknown;
  warn: (message: string) => unknown;
};

export interface SeptemberInventoryStartupResult {
  ran: boolean;
  attempts: number;
  reports: SeptemberChatInventoryReport[];
  error: string | null;
}

export function isSeptemberInventoryStartupEnabled(value: string | undefined): boolean {
  return value === "true";
}

function safeReport(report: SeptemberChatInventoryReport): Record<string, unknown> {
  return {
    storeCode: report.storeCode,
    targetResolutionSource: report.targetResolutionSource,
    inventoryComplete: report.inventoryComplete,
    inventoryIncompleteReason: report.inventoryIncompleteReason,
    conversationsObserved: report.conversationsObserved,
    septemberChats: report.septemberChats,
    septemberChatsObserved: report.septemberChatsObserved,
    beforeSeptemberObserved: report.beforeSeptemberObserved,
    afterSeptemberObserved: report.afterSeptemberObserved,
    chatsWithValidTimestamp: report.chatsWithValidTimestamp,
    chatsWithoutLatestEvent: report.chatsWithoutLatestEvent,
    chatsWithMissingTimestamp: report.chatsWithMissingTimestamp,
    chatsWithInvalidTimestamp: report.chatsWithInvalidTimestamp,
    unknownDateChats: report.unknownDateChats,
    pagesFetched: report.pagesFetched,
    pageLimitReached: report.pageLimitReached,
    chatLimitReached: report.chatLimitReached,
    timeLimitReached: report.timeLimitReached,
    newestChatListTimestamp: report.newestChatListTimestamp,
    oldestChatListTimestamp: report.oldestChatListTimestamp,
    reachedBeforeSeptember: report.reachedBeforeSeptember,
    cursorExhausted: report.cursorExhausted,
    orderingValidated: report.orderingValidated,
    orderingAnomaly: report.orderingAnomaly,
    historicalChecked: report.historicalChecked,
    fastPathComplete: report.fastPathComplete,
    needsBackwardPagination: report.needsBackwardPagination,
    historicalCoverageUnproven: report.historicalCoverageUnproven,
    failed: report.failed,
    historicalNotStarted: report.historicalNotStarted,
    fetchingInitialPage: report.fetchingInitialPage,
    historicalCheckedRate: report.historicalCheckedRate,
    fastPathCompleteRate: report.fastPathCompleteRate,
  };
}

function sleep(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    timer.unref?.();
  });
}

export async function runSeptemberInventoryStartupDiagnostic(input: {
  enabled: boolean;
  service: InventoryService;
  logger: InventoryLogger;
  maxAttempts?: number;
  retryDelayMs?: number;
}): Promise<SeptemberInventoryStartupResult> {
  if (!input.enabled) {
    return { ran: false, attempts: 0, reports: [], error: null };
  }

  const maxAttempts = Math.max(1, Math.min(5, Math.floor(input.maxAttempts ?? 3)));
  const retryDelayMs = Math.max(0, Math.min(60_000, Math.floor(input.retryDelayMs ?? 10_000)));
  const reportsByStore = new Map<string, SeptemberChatInventoryReport>();
  let pendingStoreCodes: string[] = [...LINE_CHAT_HISTORICAL_PILOT_STORE_CODES];
  let attempts = 0;

  input.logger.log(JSON.stringify({
    event: "line_chat_september_inventory_startup_started",
    maxAttempts,
    retryDelayMs,
    mode: "READ_ONLY",
  }));

  try {
    for (let attempt = 1; attempt <= maxAttempts && pendingStoreCodes.length > 0; attempt += 1) {
      attempts = attempt;
      const requested = new Set<string>(pendingStoreCodes);
      const reports = await input.service.discoverPilotStores(pendingStoreCodes);
      for (const report of reports) {
        if (!requested.has(report.storeCode)) continue;
        const previous = reportsByStore.get(report.storeCode);
        if (!previous?.inventoryComplete || report.inventoryComplete) {
          reportsByStore.set(report.storeCode, report);
        }
        input.logger.log(JSON.stringify({
          event: "line_chat_september_inventory_store_report",
          attempt,
          ...safeReport(report),
        }));
      }
      for (const storeCode of pendingStoreCodes) {
        if (!reportsByStore.has(storeCode)) {
          reportsByStore.set(
            storeCode,
            emptySeptemberChatInventoryReport(storeCode, "INVENTORY_REPORT_MISSING"),
          );
        }
      }

      const busyStores = reports
        .filter((report) => report.inventoryIncompleteReason === "PROFILE_OPERATION_BUSY")
        .filter((report) => requested.has(report.storeCode))
        .filter((report) => !reportsByStore.get(report.storeCode)?.inventoryComplete)
        .map((report) => report.storeCode);

      pendingStoreCodes = busyStores;
      if (pendingStoreCodes.length === 0 || attempt === maxAttempts) {
        const finalReports = LINE_CHAT_HISTORICAL_PILOT_STORE_CODES
          .flatMap((storeCode) => {
            const report = reportsByStore.get(storeCode);
            return report ? [report] : [];
          });
        input.logger.log(JSON.stringify({
          event: "line_chat_september_inventory_startup_completed",
          attempts: attempt,
          storeCount: finalReports.length,
          completeStores: finalReports.filter((report) => report.inventoryComplete).length,
          busyStoresRemaining: pendingStoreCodes.length,
          mode: "READ_ONLY",
        }));
        return { ran: true, attempts: attempt, reports: finalReports, error: null };
      }

      input.logger.log(JSON.stringify({
        event: "line_chat_september_inventory_startup_retrying",
        attempt,
        busyStoreCount: pendingStoreCodes.length,
        retryDelayMs,
      }));
      await sleep(retryDelayMs);
    }

    const reports = LINE_CHAT_HISTORICAL_PILOT_STORE_CODES.flatMap((storeCode) => {
      const report = reportsByStore.get(storeCode);
      return report ? [report] : [];
    });
    return { ran: true, attempts, reports, error: null };
  } catch (error) {
    const errorType = error instanceof Error ? error.name.slice(0, 80) : "UNKNOWN_ERROR";
    input.logger.warn(JSON.stringify({
      event: "line_chat_september_inventory_startup_failed",
      errorType,
      mode: "READ_ONLY",
    }));
    const reports = LINE_CHAT_HISTORICAL_PILOT_STORE_CODES.flatMap((storeCode) => {
      const report = reportsByStore.get(storeCode);
      return report ? [report] : [];
    });
    return { ran: true, attempts: Math.max(1, attempts), reports, error: errorType };
  }
}
