import type { LineChatOperationsSession } from "@/lib/api";

export type OverallHealth = { tone: "success" | "warning" | "danger"; label: string; reason: string };

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
  if (session.activeProfileLeases > 1 || session.healthFailureStage === "PROFILE_LOCK") {
    return {
      tone: "warning",
      label: "Lease or coordinator issue",
      reason: "Profile access is blocked or has more than one active lease.",
    };
  }
  if (session.healthStatus !== "CONNECTED" || session.healthFailureStage) {
    return {
      tone: "danger",
      label: "Session error",
      reason: "The latest session health evidence is not connected.",
    };
  }
  if (session.jobs.failed + session.jobs.failedAuth > 0) {
    return {
      tone: "warning",
      label: "Connected with job failures",
      reason: "The session is connected; individual jobs need review.",
    };
  }
  return { tone: "success", label: "Healthy", reason: "Session and job queue are healthy." };
}
