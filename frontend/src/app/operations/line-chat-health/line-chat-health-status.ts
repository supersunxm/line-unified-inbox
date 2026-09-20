import type { LineChatBrowserState, LineChatOperationsSession } from "@/lib/api";

export type OverallHealth = { tone: "success" | "warning" | "danger"; label: string; reason: string };

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

export function getOverallHealth(session: LineChatOperationsSession): OverallHealth {
  if (session.authRecoveryInProgress) {
    return {
      tone: "warning",
      label: "Trying remembered login",
      reason: "Automatic re-authentication recovery is currently running for this session.",
    };
  }
  if (session.healthStatus === "AUTH_REQUIRED" || session.status === "AUTH_REQUIRED") {
    if (session.healthFailureStage === "MANAGER_AUTH") {
      const inCooldown = (session.authRecoveryCooldownRemainingMs ?? 0) > 0;
      return {
        tone: "danger",
        label: inCooldown ? "Manual login required" : "Authentication required",
        reason: inCooldown
          ? "Remembered login unavailable or cooling down; manual operator login required."
          : "The LINE session requires re-authentication.",
      };
    }
    return {
      tone: "danger",
      label: "Manual login required",
      reason: "The LINE session requires operator re-authentication.",
    };
  }
  if (session.status !== "ACTIVE" || session.browserState === "UNKNOWN") {
    return {
      tone: "danger",
      label: "Unhealthy",
      reason: session.browserState === "UNKNOWN"
        ? "The Chromium profile is not currently usable."
        : "The LINE session is not active.",
    };
  }
  if (session.browserState === "RECOVERING") {
    return {
      tone: "warning",
      label: "Degraded",
      reason: "The Chromium profile is recovering and may be temporarily unavailable.",
    };
  }
  if (session.activeProfileLeases > 1 || session.healthFailureStage === "PROFILE_LOCK") {
    return {
      tone: "warning",
      label: "Lease or coordinator issue",
      reason: "Profile access is blocked or has more than one active lease.",
    };
  }
  if (session.healthStatus === "DEGRADED") {
    return {
      tone: "warning",
      label: "Degraded",
      reason: session.healthFailureStage
        ? `The latest health check reported a recoverable issue (${session.healthFailureStage}).`
        : "The latest health check reported a recoverable issue.",
    };
  }
  if (session.healthStatus !== "CONNECTED" || session.healthFailureStage) {
    return {
      tone: "danger",
      label: "Session error",
      reason: "The latest session health evidence is not connected.",
    };
  }
  if (session.activeJobRisk === "CRITICAL" || (session.activeStuckJobs ?? 0) > 0) {
    return {
      tone: "warning",
      label: "Degraded",
      reason: "The session is connected, but an active job has exceeded the operational recovery threshold.",
    };
  }
  if (session.activeJobRisk === "WARNING") {
    return {
      tone: "warning",
      label: "Degraded",
      reason: "The session is connected, but an active job is older than the normal operational window.",
    };
  }
  return {
    tone: "success",
    label: "Healthy",
    reason: "Session, browser, and current health checks are operational. Job outcomes remain available in history.",
  };
}
