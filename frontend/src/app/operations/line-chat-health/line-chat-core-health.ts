import type {
  LineChatOperationsHealth,
  LineChatOperationsSession,
} from "@/lib/api";
import type { LineChatUiHealth } from "./line-chat-health-status.ts";

type Presentation = Omit<LineChatUiHealth, "status">;
export type RecoveryStage =
  | "REQUESTED"
  | "WAITING_MIRROR"
  | "OPENING_BROWSER"
  | "WAITING_LOGIN"
  | "VALIDATING"
  | "RESUMING";
export type RecoverySignal = {
  clientPending?: boolean;
  observedAt: number;
  stage?: RecoveryStage;
  active?: boolean;
  pending?: boolean;
  readyToOpen?: boolean;
};
export type RecoverySignals = Readonly<
  Record<string, RecoverySignal | undefined>
>;
/** A background read must not overwrite a newer operator request or its in-flight response. */
export function applyRecoveryObservation(
  current: RecoverySignals,
  key: string,
  signal: RecoverySignal | undefined,
  readStartedAt?: number,
): RecoverySignals {
  if (
    readStartedAt !== undefined &&
    (current[key]?.clientPending ||
      (current[key]?.observedAt ?? 0) > readStartedAt)
  )
    return current;
  return { ...current, [key]: signal };
}
export const RECOVERY_LABELS: Record<RecoveryStage, string> = {
  REQUESTED: "Recovery requested",
  WAITING_MIRROR: "Waiting for Mirror",
  OPENING_BROWSER: "Opening browser",
  WAITING_LOGIN: "Waiting for LINE login",
  VALIDATING: "Validating session",
  RESUMING: "Resuming Mirror",
};
// Match the existing backend health freshness policy; mirror heartbeat is a separate signal.
export const SESSION_HEALTH_FRESHNESS_MS = 30 * 60_000;
export const MIRROR_OBSERVATION_FRESHNESS_MS = 90_000;
export function isRecent(
  value: string | number | null | undefined,
  now: number,
  window: number,
) {
  const time = typeof value === "number" ? value : Date.parse(value ?? "");
  return (
    Number.isFinite(now) &&
    Number.isFinite(time) &&
    time <= now + 5_000 &&
    now - time <= window
  );
}
export function hasActiveMirrorWork(
  session: LineChatOperationsSession,
  now: number,
  reportAt?: string,
) {
  if (reportAt && !isRecent(reportAt, now, MIRROR_OBSERVATION_FRESHNESS_MS))
    return false;
  if (
    session.browserBusyUntil &&
    (!Number.isFinite(Date.parse(session.browserBusyUntil)) ||
      Date.parse(session.browserBusyUntil) <= now)
  )
    return false;
  return (
    (session.activeLeaseOperation === "MIRROR_SYNC" ||
      session.browserOperationKind === "MIRROR_SYNC") &&
    (session.activeProfileLeases > 0 || session.browserState === "BUSY")
  );
}
export function getRecoveryStage(
  session: LineChatOperationsSession,
  signal: RecoverySignal | undefined,
  now = Date.now(),
): RecoveryStage | null {
  if (
    signal &&
    (signal.clientPending ||
      isRecent(signal.observedAt, now, MIRROR_OBSERVATION_FRESHNESS_MS))
  ) {
    if (signal.stage)
      return signal.stage === "RESUMING" && hasActiveMirrorWork(session, now)
        ? null
        : signal.stage;
    if (signal.pending)
      return hasActiveMirrorWork(session, now)
        ? "WAITING_MIRROR"
        : "OPENING_BROWSER";
    if (signal.active)
      return session.browserOperationKind === "HEALTH_SESSION" ||
        session.activeLeaseOperation === "HEALTH_SESSION"
        ? "VALIDATING"
        : signal.readyToOpen
          ? "WAITING_LOGIN"
          : "OPENING_BROWSER";
  }
  if (session.authRecoveryInProgress || session.browserState === "RECOVERING") {
    return session.browserOperationKind === "HEALTH_SESSION" ||
      session.activeLeaseOperation === "HEALTH_SESSION"
      ? "VALIDATING"
      : "REQUESTED";
  }
  return null;
}
export type SessionConnectionStatus =
  | "CONNECTED"
  | "IN_USE"
  | "RECOVERING"
  | "LOGIN_REQUIRED"
  | "DEGRADED"
  | "UNKNOWN";
export type SessionConnection = Presentation & {
  status: SessionConnectionStatus;
  blocked: boolean;
  recoveryStage: RecoveryStage | null;
  primaryAction: "INSPECT" | "REFRESH" | "RECONNECT" | "VIEW_RECOVERY";
};
export function getSessionConnection(
  session: LineChatOperationsSession,
  now = Date.now(),
  signal?: RecoverySignal,
  reportAt?: string,
): SessionConnection {
  const result = (
    status: SessionConnectionStatus,
    label: string,
    tone: Presentation["tone"],
    reason: string,
    primaryAction: SessionConnection["primaryAction"],
    blocked = false,
    recoveryStage: RecoveryStage | null = null,
  ): SessionConnection => ({
    status,
    label,
    tone,
    reason,
    primaryAction,
    blocked,
    recoveryStage,
    recommendedAction:
      primaryAction === "RECONNECT"
        ? "Reconnect LINE using the intended account."
        : primaryAction === "VIEW_RECOVERY"
          ? "Follow the recovery progress before trying again."
          : primaryAction === "REFRESH"
            ? "Refresh health data and review the latest check."
            : "View technical details if investigation is needed.",
  });
  const stage = getRecoveryStage(session, signal, now);
  if (["DISABLED", "INACTIVE"].includes(session.status))
    return result(
      "DEGRADED",
      "Degraded",
      "danger",
      "This account is disabled or inactive.",
      "INSPECT",
      true,
    );
  if (stage)
    return result(
      "RECOVERING",
      "Recovering",
      "warning",
      RECOVERY_LABELS[stage],
      "VIEW_RECOVERY",
      false,
      stage,
    );
  if ([session.status, session.healthStatus].includes("AUTH_REQUIRED"))
    return result(
      "LOGIN_REQUIRED",
      "Login required",
      "danger",
      "LINE login needs confirmation.",
      "RECONNECT",
    );
  if (
    session.healthStatus === "CONFIG_ERROR" ||
    [
      "PROFILE_MISSING",
      "PROFILE_PATH_INVALID",
      "CONFIG_ERROR",
      "PROFILE_LOCK",
    ].includes(session.healthFailureStage ?? "") ||
    session.activeProfileLeases > 1
  )
    return result(
      "DEGRADED",
      "Degraded",
      "danger",
      "The account browser configuration or ownership needs attention.",
      "INSPECT",
      true,
    );
  if (
    session.healthStatus === "DEGRADED" ||
    session.healthFailureStage === "CHROMIUM_LAUNCH" ||
    session.activeJobRisk === "CRITICAL" ||
    (session.activeStuckJobs ?? 0) > 0
  )
    return result(
      "DEGRADED",
      "Degraded",
      "warning",
      "The latest connection check or current work needs attention.",
      "INSPECT",
    );
  const mirror = session.liveMirror;
  if (
    mirror?.telemetryStatus === "FRESH" &&
    isRecent(mirror.observedAt, now, MIRROR_OBSERVATION_FRESHNESS_MS) &&
    ["STOPPED", "START_FAILED"].includes(mirror.browser)
  )
    return result(
      "DEGRADED",
      "Degraded",
      "warning",
      "A current observation reports that the account browser is not running.",
      "INSPECT",
    );
  if (reportAt && !isRecent(reportAt, now, MIRROR_OBSERVATION_FRESHNESS_MS))
    return result(
      "UNKNOWN",
      "Unknown",
      "neutral",
      "The health report is stale; current browser availability is unconfirmed.",
      "REFRESH",
    );
  const healthy =
    isRecent(session.healthLastHealthyAt, now, SESSION_HEALTH_FRESHNESS_MS) ||
    (session.healthStatus === "CONNECTED" &&
      isRecent(session.healthLastCheckedAt, now, SESSION_HEALTH_FRESHNESS_MS));
  if (session.status !== "ACTIVE" || !healthy)
    return result(
      "UNKNOWN",
      "Unknown",
      "neutral",
      "A healthy session check within the last 30 minutes is unavailable.",
      "REFRESH",
    );
  if (
    session.healthStatus === "UNKNOWN" &&
    Date.parse(session.healthLastCheckedAt ?? "") >
      Date.parse(session.healthLastHealthyAt ?? "")
  )
    return result(
      "UNKNOWN",
      "Unknown",
      "neutral",
      "The latest check could not confirm the connection after the last healthy check.",
      "REFRESH",
    );
  if (!["AVAILABLE", "BUSY"].includes(session.browserState))
    return result(
      "UNKNOWN",
      "Unknown",
      "neutral",
      "The connection was recently healthy, but current browser availability is unconfirmed.",
      "REFRESH",
    );
  if (
    session.browserState === "BUSY" &&
    session.browserBusyUntil &&
    (!Number.isFinite(Date.parse(session.browserBusyUntil)) ||
      Date.parse(session.browserBusyUntil) <= now)
  )
    return result(
      "UNKNOWN",
      "Unknown",
      "neutral",
      "The reported browser operation has expired; refresh to confirm availability.",
      "REFRESH",
    );
  return session.browserState === "BUSY"
    ? result(
        "IN_USE",
        "In use",
        "success",
        "The session is connected and its browser is working.",
        "INSPECT",
      )
    : result(
        "CONNECTED",
        "Connected",
        "success",
        "A recent healthy check confirms the LINE connection; the browser is available.",
        "INSPECT",
      );
}
export function summarizeSessions(
  connections: readonly SessionConnection[],
): SessionConnection {
  const order: SessionConnectionStatus[] = [
    "RECOVERING",
    "LOGIN_REQUIRED",
    "DEGRADED",
    "UNKNOWN",
    "IN_USE",
    "CONNECTED",
  ];
  for (const status of order) {
    const match = connections.find((item) => item.status === status);
    if (match) return match;
  }
  return {
    status: "UNKNOWN",
    label: "Unknown",
    tone: "neutral",
    reason: "No session observations are available.",
    recommendedAction: "Refresh health data.",
    blocked: false,
    recoveryStage: null,
    primaryAction: "REFRESH",
  };
}
export type MirrorStatus =
  | "RUNNING"
  | "IDLE"
  | "CATCHING_UP"
  | "PAUSED"
  | "DEGRADED"
  | "LOGIN_REQUIRED"
  | "UNKNOWN";
export type MirrorHealth = Presentation & {
  status: MirrorStatus;
  supporting: string[];
};
export function getMirrorHealth(
  report: LineChatOperationsHealth,
  connections: readonly SessionConnection[],
  now = Date.now(),
): MirrorHealth {
  const fleet = report.liveMirrorFleet;
  const freshFleet =
    !!fleet && isRecent(fleet.observedAt, now, MIRROR_OBSERVATION_FRESHNESS_MS);
  const active = report.sessions.some(
    (session, i) =>
      (connections[i]?.status !== "RECOVERING" ||
        ["REQUESTED", "WAITING_MIRROR"].includes(
          connections[i]?.recoveryStage ?? "",
        )) &&
      hasActiveMirrorWork(session, now, report.timestamp),
  );
  const observations = report.sessions.flatMap((session) =>
    session.liveMirror?.telemetryStatus === "FRESH" &&
    isRecent(
      session.liveMirror.observedAt,
      now,
      MIRROR_OBSERVATION_FRESHNESS_MS,
    )
      ? [session.liveMirror]
      : [],
  );
  const knownCycle =
    fleet?.lastCycle ??
    report.sessions
      .map((session) => session.liveMirror)
      .filter((mirror) => mirror?.cycle && mirror.completedAt)
      .sort(
        (a, b) =>
          Date.parse(b?.completedAt ?? "") - Date.parse(a?.completedAt ?? ""),
      )[0];
  const currentCycle =
    active || (freshFleet && fleet?.cycleRunning)
      ? observations.find((mirror) => !mirror.completedAt && mirror.cycle)
          ?.cycle
      : null;
  const cycle =
    currentCycle ??
    (knownCycle && "attempted" in knownCycle
      ? knownCycle
      : knownCycle && "cycle" in knownCycle
        ? knownCycle.cycle
        : null);
  const completedAt = knownCycle?.completedAt;
  const configured =
    fleet?.configuredStores ??
    (observations.length &&
    observations.every((mirror) => mirror.mappedStores !== null)
      ? observations.reduce(
          (sum, mirror) => sum + (mirror.mappedStores ?? 0),
          0,
        )
      : null);
  const supporting = [
    completedAt
      ? `Last known cycle: ${new Date(completedAt).toLocaleString()}`
      : "No completed cycle reported",
    cycle
      ? `${currentCycle ? "Current" : "Known"} cycle: ${cycle.attempted} processed / ${configured ?? "unreported"} configured · ${cycle.succeeded} succeeded`
      : configured !== null
        ? `${configured} configured · cycle metrics unavailable`
        : "Cycle metrics and configured count are not reported",
  ];
  const result = (
    status: MirrorStatus,
    label: string,
    tone: Presentation["tone"],
    reason: string,
  ): MirrorHealth => ({
    status,
    label,
    tone,
    reason,
    recommendedAction:
      status === "UNKNOWN"
        ? "Refresh status to obtain current mirror evidence."
        : status === "LOGIN_REQUIRED"
          ? "Reconnect the affected LINE session."
          : status === "DEGRADED"
            ? "Review session and mirror technical details."
            : "Monitor current progress.",
    supporting,
  });
  if (
    !active &&
    connections.length &&
    connections.every((item) => item.status === "RECOVERING")
  )
    return result(
      "PAUSED",
      "Paused",
      "warning",
      "Mirror is yielding while session recovery is active.",
    );
  if (
    connections.length &&
    connections.every((item) => item.status === "LOGIN_REQUIRED")
  )
    return result(
      "LOGIN_REQUIRED",
      "Login required",
      "danger",
      "LINE sessions need login before syncing can continue.",
    );
  if (
    connections.some(
      (item) => item.status === "DEGRADED" || item.status === "LOGIN_REQUIRED",
    )
  )
    return result(
      "DEGRADED",
      "Degraded",
      "warning",
      "Some session connections need attention; syncing may be interrupted.",
    );
  const failedCycle =
    freshFleet &&
    !!fleet?.lastCycle &&
    isRecent(
      fleet.lastCycle.completedAt,
      now,
      MIRROR_OBSERVATION_FRESHNESS_MS,
    ) &&
    (fleet.lastCycle.failed > 0 || fleet.lastCycle.partial > 0);
  if (
    failedCycle ||
    observations.some(
      (mirror) =>
        mirror.cycle &&
        isRecent(mirror.completedAt, now, MIRROR_OBSERVATION_FRESHNESS_MS) &&
        (mirror.cycle.failed > 0 || mirror.cycle.partial > 0),
    )
  )
    return result(
      "DEGRADED",
      "Degraded",
      "warning",
      "The latest observed cycle did not finish all stores successfully.",
    );
  if (active || (freshFleet && fleet?.cycleRunning)) {
    const partial = observations.some(
      (mirror) =>
        !mirror.completedAt &&
        mirror.cycle &&
        mirror.mappedStores !== null &&
        mirror.cycle.attempted > 0 &&
        mirror.cycle.attempted < mirror.mappedStores,
    );
    return partial
      ? result(
          "CATCHING_UP",
          "Catching up",
          "success",
          "An active cycle is working through the remaining configured stores.",
        )
      : result(
          "RUNNING",
          "Running",
          "success",
          "Active store-chat sync work is confirmed.",
        );
  }
  if (connections.some((item) => item.status === "RECOVERING"))
    return result(
      "PAUSED",
      "Paused",
      "warning",
      "Mirror is yielding for session recovery; other cycle activity is unconfirmed.",
    );
  if (
    observations.length &&
    observations.every((mirror) => mirror.schedulerRunning === false)
  )
    return result(
      "PAUSED",
      "Paused",
      "neutral",
      "Current telemetry reports that the mirror scheduler is paused.",
    );
  if (
    (freshFleet && !fleet?.cycleRunning) ||
    observations.some(
      (mirror) =>
        mirror.browser === "RUNNING" && mirror.schedulerRunning === true,
    )
  )
    return result(
      "IDLE",
      "Idle",
      "success",
      "The mirror is available and waiting for its next cycle.",
    );
  return result(
    "UNKNOWN",
    "Unknown",
    "neutral",
    fleet || report.sessions.some((session) => session.liveMirror)
      ? "Mirror observations are stale or incomplete; no active sync work is confirmed."
      : "No mirror telemetry or active sync work is reported.",
  );
}
export type CoreHealth = Presentation & {
  status: "OPERATIONAL" | "DEGRADED" | "BLOCKED" | "RECOVERING" | "UNKNOWN";
};
export function getCoreHealth(
  connections: readonly SessionConnection[],
  mirror: MirrorHealth,
): CoreHealth {
  const result = (
    status: CoreHealth["status"],
    label: string,
    tone: Presentation["tone"],
    reason: string,
  ): CoreHealth => ({
    status,
    label,
    tone,
    reason,
    recommendedAction:
      status === "OPERATIONAL"
        ? "Continue monitoring; store setup is tracked separately."
        : "Review the affected sessions and their recommended actions.",
  });
  if (connections.length && connections.every((item) => item.blocked))
    return result(
      "BLOCKED",
      "Blocked",
      "danger",
      "No configured LINE session can currently be used.",
    );
  if (connections.some((item) => item.status === "RECOVERING"))
    return result(
      "RECOVERING",
      "Recovering",
      "warning",
      "Session recovery is active; follow its progress before trying again.",
    );
  if (
    connections.length &&
    connections.every((item) => item.status === "LOGIN_REQUIRED")
  )
    return result(
      "BLOCKED",
      "Blocked",
      "danger",
      "All LINE sessions require login confirmation.",
    );
  if (
    connections.some((item) =>
      ["LOGIN_REQUIRED", "DEGRADED"].includes(item.status),
    ) ||
    mirror.status === "DEGRADED"
  )
    return result(
      "DEGRADED",
      "Degraded",
      "warning",
      "Part of the core LINE Chat service needs attention.",
    );
  if (
    !connections.length ||
    connections.some((item) => item.status === "UNKNOWN")
  )
    return result(
      "UNKNOWN",
      "Unknown",
      "neutral",
      "Current connection health could not be confirmed for every session.",
    );
  if (mirror.status === "PAUSED")
    return result(
      "DEGRADED",
      "Degraded",
      "warning",
      "Sessions are connected, but the mirror scheduler is paused.",
    );
  return result(
    "OPERATIONAL",
    "Operational",
    "success",
    "LINE sessions have recent healthy connection evidence. Store setup is tracked separately.",
  );
}
