import type { LineChatBrowserState, LineChatFleetReadinessStore, LineChatOperationsSession } from "@/lib/api";
import type { AppLanguage } from "../../language-utils";

export type LineChatUiStatus = "READY" | "NEED_SETUP" | "LOGIN_REQUIRED" | "DEGRADED" | "BLOCKED" | "RECOVERING" | "UNKNOWN";

export type LineChatUiHealth = {
  status: LineChatUiStatus;
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
  reason: string;
  recommendedAction: string;
};

export type LineChatUiHealthInput =
  | { kind: "session"; session: LineChatOperationsSession }
  | { kind: "store"; store: LineChatFleetReadinessStore; session?: LineChatOperationsSession };

// Explicit blocks win; active recovery overrides older login evidence. Known
// problems remain actionable without telemetry. READY always requires evidence.
const STATUS_PRECEDENCE: readonly LineChatUiStatus[] = [
  "BLOCKED", "RECOVERING", "NEED_SETUP", "LOGIN_REQUIRED", "DEGRADED", "UNKNOWN", "READY",
];
const PRESENTATION: Record<LineChatUiStatus, Pick<LineChatUiHealth, "label" | "tone">> = {
  READY: { label: "Ready", tone: "success" },
  NEED_SETUP: { label: "Needs setup", tone: "warning" },
  LOGIN_REQUIRED: { label: "Login required", tone: "danger" },
  DEGRADED: { label: "Degraded", tone: "warning" },
  BLOCKED: { label: "Blocked", tone: "danger" },
  RECOVERING: { label: "Recovering", tone: "warning" },
  UNKNOWN: { label: "Unknown", tone: "neutral" },
};
type Guidance = Pick<LineChatUiHealth, "reason" | "recommendedAction">;
type Evidence = Partial<Record<LineChatUiStatus, Guidance>>;
const guidance = (reason: string, recommendedAction: string): Guidance => ({ reason, recommendedAction });
const UNKNOWN_GUIDANCE = guidance("Current status could not be confirmed.", "Refresh status. If it remains unknown, ask an administrator to check the service.");

const BROWSER_STATE_LABELS: Record<LineChatBrowserState, string> = {
  AVAILABLE: "พร้อมใช้งาน",
  BUSY: "กำลังใช้งาน",
  RECOVERING: "กำลังกู้คืน",
  UNKNOWN: "ไม่ทราบสถานะ",
};

const BROWSER_OPERATION_LABELS: Record<string, string> = {
  NICKNAME_UPDATE: "เปลี่ยนชื่อลูกค้า",
  RECENT_RESOLUTION: "จับคู่ลูกค้า",
  HEALTH_SESSION: "ตรวจ Session",
  HEALTH_OA: "ตรวจ OA",
  MANUAL_DIAGNOSTIC: "ตรวจสอบ/เปิด Browser",
};

export const BROWSER_STATUS_HELP_TEXT =
  "สถานะ Session แสดงการเชื่อมต่อ LINE\nสถานะ Browser แสดงว่า Chromium Profile พร้อมรับงานใหม่หรือกำลังถูกใช้งาน";
export const BROWSER_BUSY_HELP_TEXT = "เป็นสถานะชั่วคราว ระบบจะรอและลองใหม่อัตโนมัติ";

const browserHelpText: Record<AppLanguage, { status: string; busy: string }> = {
  th: {
    status: "สถานะ Session แสดงการเชื่อมต่อ LINE\nสถานะ Browser แสดงว่า Chromium Profile พร้อมรับงานใหม่หรือกำลังถูกใช้งาน",
    busy: "เป็นสถานะชั่วคราว ระบบจะรอและลองใหม่อัตโนมัติ",
  },
  en: {
    status: "Session status shows the LINE connection.\nBrowser status shows whether the Chromium profile is ready for new work or currently in use.",
    busy: "This is a temporary state. The system will wait and retry automatically.",
  },
  zh: {
    status: "Session 状态表示 LINE 连接情况。\nBrowser 状态表示 Chromium 配置文件是否已准备好接收新任务，或正在使用中。",
    busy: "这是临时状态。系统将等待并自动重试。",
  },
};

export function getBrowserStatusHelpText(language: AppLanguage) {
  return browserHelpText[language].status;
}

export function getBrowserBusyHelpText(language: AppLanguage) {
  return browserHelpText[language].busy;
}

export function getBrowserStateLabel(state: LineChatBrowserState): string {
  return BROWSER_STATE_LABELS[state];
}

export function getBrowserOperationLabel(operationKind: string | null): string | null {
  return operationKind ? BROWSER_OPERATION_LABELS[operationKind] ?? operationKind : null;
}

export function getBrowserStateTone(state: LineChatBrowserState): "success" | "warning" | "info" | "neutral" {
  switch (state) {
    case "AVAILABLE":
      return "success";
    case "BUSY":
      return "warning";
    case "RECOVERING":
      return "info";
    case "UNKNOWN":
    default:
      return "neutral";
  }
}

function recoveryEvidence(session: LineChatOperationsSession | undefined): Guidance | undefined {
  if (session?.authRecoveryInProgress) {
    return guidance("LINE login recovery is in progress.", "Wait for recovery to finish before trying again.");
  }
  if (session?.browserState === "RECOVERING") {
    return guidance("The account browser is being recovered.", "Complete LINE login in the recovery window, then close recovery to resume syncing.");
  }
  return undefined;
}

function sessionEvidence(session: LineChatOperationsSession, now: number): Evidence {
  const evidence: Evidence = {};
  if (session.status === "DISABLED" || session.status === "INACTIVE") {
    evidence.BLOCKED = guidance("This account is disabled or inactive.", "Ask an administrator to enable the intended account.");
  } else if (session.activeProfileLeases > 1 || session.healthFailureStage === "PROFILE_LOCK") {
    evidence.BLOCKED = guidance("Another operation is preventing access to the account browser.", "Wait for the current operation to finish. If access stays blocked, ask an administrator to check it.");
  } else if (session.healthFailureStage === "OA_ACCESS") {
    evidence.BLOCKED = guidance("This LINE account cannot access the store.", "Confirm the correct LINE account and ask the store administrator to check its access.");
  }
  evidence.RECOVERING = recoveryEvidence(session);
  if (session.healthStatus === "CONFIG_ERROR" || ["PROFILE_MISSING", "PROFILE_PATH_INVALID", "CONFIG_ERROR"].includes(session.healthFailureStage ?? "")) {
    evidence.NEED_SETUP = guidance("The account browser setup is missing or incomplete.", "Ask an administrator to complete the account setup before logging in.");
  }
  if (session.healthStatus === "AUTH_REQUIRED" || session.status === "AUTH_REQUIRED") {
    evidence.LOGIN_REQUIRED = guidance("LINE login has expired or needs confirmation.", "Reconnect LINE using the account that has access to the intended stores.");
  }
  if (session.healthStatus === "DEGRADED" || session.healthFailureStage === "CHROMIUM_LAUNCH") {
    evidence.DEGRADED = guidance("The latest account check could not complete normally.", "Allow the next check to retry. If the issue continues, inspect the account diagnostics.");
  } else if (session.activeJobRisk === "CRITICAL" || (session.activeStuckJobs ?? 0) > 0) {
    evidence.DEGRADED = guidance("Current work is taking longer than the recovery limit.", "Inspect the delayed work and follow its recommended recovery action.");
  } else if (session.activeJobRisk === "WARNING") {
    evidence.DEGRADED = guidance("Current work is taking longer than usual.", "Wait for it to finish. Inspect the work if the delay continues.");
  }
  const mirror = session.liveMirror;
  const observedAt = Date.parse(mirror?.observedAt ?? "");
  const fresh = mirror?.telemetryStatus === "FRESH" && Number.isFinite(observedAt)
    && Number.isFinite(now) && now - observedAt <= 90_000 && observedAt <= now + 5_000;
  if (fresh && (mirror?.browser === "STOPPED" || mirror?.browser === "START_FAILED")) {
    evidence.DEGRADED ??= guidance("The sync browser is not running.", "Ask an administrator to check the sync service and its startup diagnostics.");
  } else if (fresh && ((mirror?.cycle?.failed ?? 0) > 0 || (mirror?.cycle?.partial ?? 0) > 0)) {
    evidence.DEGRADED ??= guidance("Some stores did not finish the latest sync.", "Inspect the affected stores and their recommended actions while automatic syncing continues.");
  }
  if (session.status !== "ACTIVE" || session.healthStatus !== "CONNECTED" || session.healthFailureStage) {
    evidence.UNKNOWN = guidance("A successful account health check has not been confirmed.", "Refresh status and wait for the next account check.");
  } else if (!fresh || mirror?.browser !== "RUNNING" || !["AVAILABLE", "BUSY"].includes(session.browserState)) {
    evidence.UNKNOWN = guidance("A recent observation of the sync browser is unavailable.", "Refresh status. If it remains unknown, ask an administrator to check the sync service.");
  } else {
    evidence.READY = guidance("The account is connected and the sync browser is running.", "No action is needed. Normal syncing can continue.");
  }
  return evidence;
}

function storeEvidence(store: LineChatFleetReadinessStore, session?: LineChatOperationsSession): Evidence {
  const evidence: Evidence = {};
  if (store.blockers.includes("STORE_INACTIVE")) {
    evidence.BLOCKED = guidance("This store is inactive.", "Ask an administrator to confirm whether the store should be enabled.");
  } else if (store.sessionStatus === "INACTIVE" || store.sessionStatus === "DISABLED") {
    evidence.BLOCKED = guidance("The store's LINE account is disabled or inactive.", "Ask an administrator to enable the intended account.");
  } else if (store.oaHealthStatus === "OA_ACCESS_LOST") {
    evidence.BLOCKED = guidance("This LINE account cannot access the store.", "Confirm the correct LINE account and ask the store administrator to check its access.");
  }
  evidence.RECOVERING = recoveryEvidence(session);
  if (!store.hasChatBotId || !store.sessionKey || !store.storeId || store.blockers.includes("STORE_MAPPING_INCOMPLETE")
    || store.blockers.includes("MISSING_CHAT_BOT_ID") || store.blockers.includes("MISSING_LINE_CHAT_SESSION")
    || store.status === "NEED_BOT_MAPPING" || store.sessionHealthStatus === "CONFIG_ERROR" || store.oaHealthStatus === "CONFIG_ERROR") {
    evidence.NEED_SETUP = guidance("The store's LINE connection setup is incomplete.", "Ask an administrator to link the store, LINE account, and chat account.");
  }
  if (store.status === "NEED_LOGIN" || store.sessionStatus === "AUTH_REQUIRED"
    || store.sessionHealthStatus === "AUTH_REQUIRED" || store.oaHealthStatus === "AUTH_REQUIRED") {
    evidence.LOGIN_REQUIRED = guidance("The store's LINE account needs login confirmation.", "Reconnect LINE using the account that has access to this store.");
  }
  if (store.sessionHealthStatus === "DEGRADED" || store.oaHealthStatus === "DEGRADED") {
    evidence.DEGRADED = guidance("The latest store connection check could not complete normally.", "Allow the next check to retry. Inspect the store diagnostics if the issue continues.");
  }
  if (store.blockers.some(blocker => ![
    "STORE_INACTIVE", "STORE_MAPPING_INCOMPLETE", "MISSING_CHAT_BOT_ID", "MISSING_LINE_CHAT_SESSION",
    "SESSION_RELOGIN_REQUIRED", "SESSION_OR_OA_CONFIG_NOT_READY", "HEALTH_NOT_CONFIRMED_CONNECTED",
  ].includes(blocker))) {
    evidence.BLOCKED ??= guidance("A store requirement is preventing the connection from being used.", "Ask an administrator to review the store's connection requirements.");
  }
  if (store.status === "READY" && store.sessionStatus === "ACTIVE"
    && store.sessionHealthStatus === "CONNECTED" && store.oaHealthStatus === "CONNECTED") {
    evidence.READY = guidance("The store's LINE connection is ready.", "No action is needed for the connection. Existing rollout limits still apply.");
  } else {
    evidence.UNKNOWN = guidance("A successful store connection check has not been confirmed.", "Refresh status and wait for the next store check.");
  }
  return evidence;
}

/** Presentation only: never changes technical states, retry policy, or rollout eligibility. */
export function getLineChatUiHealth(input: LineChatUiHealthInput, now = Date.now()): LineChatUiHealth {
  const evidence = input.kind === "session" ? sessionEvidence(input.session, now) : storeEvidence(input.store, input.session);
  const status = STATUS_PRECEDENCE.find(candidate => evidence[candidate]) ?? "UNKNOWN";
  return { status, ...PRESENTATION[status], ...(evidence[status] ?? UNKNOWN_GUIDANCE) };
}

// Existing account-health callers use the same model as store readiness.
export function getOverallHealth(session: LineChatOperationsSession, now = Date.now()): LineChatUiHealth {
  return getLineChatUiHealth({ kind: "session", session }, now);
}

/** Aggregate presentation without introducing another precedence table. */
export function summarizeLineChatUiHealth(states: readonly LineChatUiHealth[]): LineChatUiHealth {
  for (const status of STATUS_PRECEDENCE) {
    const match = states.find(state => state.status === status);
    if (match) return match;
  }
  return { status: "UNKNOWN", ...PRESENTATION.UNKNOWN, ...UNKNOWN_GUIDANCE };
}

/** Current work is presentation evidence only; never changes job eligibility. */
export function getLineChatWorkUiHealth(pendingMapping: number, activeIssues: number): LineChatUiHealth {
  const status: LineChatUiStatus = pendingMapping > 0 ? "NEED_SETUP" : activeIssues > 0 ? "DEGRADED" : "READY";
  const detail = pendingMapping > 0
    ? guidance("Current work is waiting for chat mapping.", "Review pending mappings before this work can continue.")
    : activeIssues > 0
      ? guidance("Current issues need review.", "Inspect the current issues and follow their recommended actions.")
      : guidance("No current work requires attention.", "No action is needed. Continue monitoring normally.");
  return { status, ...PRESENTATION[status], ...detail };
}
