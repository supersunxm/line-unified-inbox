import type { LineChatOperationsHealth } from "@/lib/api";
import {
  getLineChatUiHealth,
  type LineChatUiStatus,
} from "./line-chat-health-status.ts";

export const STORE_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "READY", label: "Ready" },
  { value: "NEED_SETUP", label: "Need Setup" },
  { value: "LOGIN_REQUIRED", label: "Login Required" },
  { value: "BLOCKED", label: "Blocked" },
] as const;
export type StoreFilter = (typeof STORE_FILTERS)[number]["value"];
export type StoreControls = {
  status: StoreFilter;
  search: string;
  actionableOnly: boolean;
  pilotOnly: boolean;
};
export const DEFAULT_STORE_CONTROLS: StoreControls = {
  status: "ALL",
  search: "",
  actionableOnly: false,
  pilotOnly: false,
};

const ACTIONS: Record<LineChatUiStatus, string> = {
  READY: "View",
  NEED_SETUP: "Fix setup",
  LOGIN_REQUIRED: "Reconnect",
  DEGRADED: "Resolve",
  BLOCKED: "Resolve",
  RECOVERING: "View",
  UNKNOWN: "View",
};

/** Presentation only. Backend readiness, pilot eligibility and coverage remain authoritative. */
export function buildStoreRows(report: LineChatOperationsHealth) {
  return report.fleetReadiness.stores.map((store) => {
    const session = report.sessions.find(
      (item) => item.sessionKey === store.sessionKey,
    );
    const health = getLineChatUiHealth({ kind: "store", store, session });
    const reportedPercent = store.mappingCoveragePercent;
    const percent =
      reportedPercent !== null && Number.isFinite(reportedPercent)
        ? reportedPercent
        : null;
    return {
      store,
      session,
      health,
      action: ACTIONS[health.status],
      actionable: health.status !== "READY" && health.status !== "UNKNOWN",
      coverage: {
        percent,
        progress: percent === null ? 0 : Math.max(0, Math.min(100, percent)),
      },
      lastChecked: session?.healthLastCheckedAt ?? null,
    };
  });
}
export type StoreRow = ReturnType<typeof buildStoreRows>[number];

/** Counts describe the complete received fleet; search and toggles narrow the visible rows. */
export function storeFilterCounts(
  rows: readonly StoreRow[],
): Record<StoreFilter, number> {
  return Object.fromEntries(
    STORE_FILTERS.map(({ value }) => [
      value,
      value === "ALL"
        ? rows.length
        : rows.filter((row) => row.health.status === value).length,
    ]),
  ) as Record<StoreFilter, number>;
}

export function filterStoreRows(
  rows: readonly StoreRow[],
  controls: StoreControls,
): StoreRow[] {
  const query = controls.search.trim().toLocaleLowerCase();
  return rows.filter(
    (row) =>
      (controls.status === "ALL" || row.health.status === controls.status) &&
      (!controls.actionableOnly || row.actionable) &&
      (!controls.pilotOnly || row.store.currentlyPilotEligible) &&
      (!query ||
        `${row.store.storeName}\n${row.store.storeCode}`
          .toLocaleLowerCase()
          .includes(query)),
  );
}
