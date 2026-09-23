import type { LineChatSeptemberInventoryService } from "./line-chat-september-inventory.service";
import type { SeptemberChatInventoryReport } from "./line-chat-september-inventory";

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
    inventoryComplete: report.inventoryComplete,
    inventoryIncompleteReason: report.inventoryIncompleteReason,
    conversationsObserved: report.conversationsObserved,
    septemberChats: report.septemberChats,
    septemberChatsObserved: report.septemberChatsObserved,
    beforeSeptemberObserved: report.beforeSeptemberObserved,
    afterSeptemberObserved: report.afterSeptemberObserved,
    unknownDateChats: report.unknownDateChats,
    pagesFetched: report.pagesFetched,
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
  let reports: SeptemberChatInventoryReport[] = [];

  input.logger.log(JSON.stringify({
    event: "line_chat_september_inventory_startup_started",
    maxAttempts,
    retryDelayMs,
    mode: "READ_ONLY",
  }));

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      reports = await input.service.discoverPilotStores();
      for (const report of reports) {
        input.logger.log(JSON.stringify({
          event: "line_chat_september_inventory_store_report",
          attempt,
          ...safeReport(report),
        }));
      }

      const busyStores = reports
        .filter((report) => report.inventoryIncompleteReason === "PROFILE_OPERATION_BUSY")
        .map((report) => report.storeCode);

      if (busyStores.length === 0 || attempt === maxAttempts) {
        input.logger.log(JSON.stringify({
          event: "line_chat_september_inventory_startup_completed",
          attempts: attempt,
          storeCount: reports.length,
          completeStores: reports.filter((report) => report.inventoryComplete).length,
          busyStoresRemaining: busyStores.length,
          mode: "READ_ONLY",
        }));
        return { ran: true, attempts: attempt, reports, error: null };
      }

      input.logger.log(JSON.stringify({
        event: "line_chat_september_inventory_startup_retrying",
        attempt,
        busyStoreCount: busyStores.length,
        retryDelayMs,
      }));
      await sleep(retryDelayMs);
    }

    return { ran: true, attempts: maxAttempts, reports, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    input.logger.warn(JSON.stringify({
      event: "line_chat_september_inventory_startup_failed",
      error: message,
      mode: "READ_ONLY",
    }));
    return { ran: true, attempts: 1, reports, error: message };
  }
}
