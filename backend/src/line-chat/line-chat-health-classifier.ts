import type {
  LineChatHealthEvidence,
  LineChatHealthFailureStage,
  LineChatOaHealthClassification,
  LineChatOaHealthStatus,
  LineChatSessionHealthClassification,
  LineChatSessionHealthStatus,
} from "./line-chat-health.types";

const AUTH_HTTP_STATUSES = new Set([401, 403]);

function isAuthStatus(status: number | undefined): boolean {
  return status !== undefined && AUTH_HTTP_STATUSES.has(status);
}

function explicitManagerAuthEvidence(evidence: LineChatHealthEvidence): boolean {
  return evidence.managerAuth === "EXPLICIT_REQUIRED"
    || evidence.loginRedirect === true
    || (evidence.endpoint === "MANAGER" && isAuthStatus(evidence.httpStatus));
}

function configFailure(evidence: LineChatHealthEvidence): LineChatHealthFailureStage | null {
  if (evidence.profileState === "MISSING") return "PROFILE_MISSING";
  if (evidence.profileState === "INVALID") return "PROFILE_PATH_INVALID";
  return null;
}

function transportFailure(evidence: LineChatHealthEvidence): LineChatHealthFailureStage | null {
  if (evidence.failure === "PROFILE_LOCK") return "PROFILE_LOCK";
  if (evidence.failure === "CHROMIUM_LAUNCH") return "CHROMIUM_LAUNCH";
  if (evidence.failure === "TIMEOUT") return "TIMEOUT";
  if (evidence.httpStatus === 429) return "RATE_LIMIT";
  if (evidence.endpoint === "CHAT_LIST" && evidence.responseShape === "MALFORMED") return "CHAT_LIST_PARSE";
  if (evidence.endpoint === "CHAT_LIST" && evidence.chatAccess === "DENIED" && isAuthStatus(evidence.httpStatus)) return "CHAT_AUTH";
  if (evidence.endpoint === "OA" && evidence.oaAccess === "DENIED") return "OA_ACCESS";
  if (evidence.httpStatus !== undefined && evidence.httpStatus >= 500 && evidence.endpoint === "CHAT_LIST") return "CHAT_LIST_RESPONSE";
  if (evidence.failure === "UNEXPECTED") return "UNKNOWN";
  if (evidence.httpStatus !== undefined && evidence.httpStatus >= 400) return "UNKNOWN";
  return null;
}

function successfulEvidence(evidence: LineChatHealthEvidence): boolean {
  if (evidence.failure || evidence.profileState === "MISSING" || evidence.profileState === "INVALID") return false;
  if (evidence.responseShape === "MALFORMED") return false;
  if (evidence.oaAccess === "DENIED" || evidence.chatAccess === "DENIED") return false;
  if (evidence.httpStatus !== undefined) return evidence.httpStatus >= 200 && evidence.httpStatus < 300;
  return evidence.managerAuth === "CONFIRMED"
    || evidence.oaAccess === "GRANTED"
    || evidence.chatAccess === "GRANTED";
}

function classifySession(evidence: LineChatHealthEvidence): LineChatSessionHealthClassification {
  // This branch is intentionally first: only explicit Manager auth evidence
  // can produce AUTH_REQUIRED. Generic errors never reach that status.
  if (explicitManagerAuthEvidence(evidence)) {
    return { status: "AUTH_REQUIRED", failureStage: "MANAGER_AUTH" };
  }

  const configStage = configFailure(evidence);
  if (configStage) return { status: "CONFIG_ERROR", failureStage: configStage };

  const failureStage = transportFailure(evidence);
  if (failureStage) return { status: "DEGRADED", failureStage };
  if (successfulEvidence(evidence)) return { status: "CONNECTED", failureStage: null };
  return { status: "UNKNOWN", failureStage: null };
}

function classifyOa(evidence: LineChatHealthEvidence): LineChatOaHealthClassification {
  if (explicitManagerAuthEvidence(evidence)) {
    return { status: "AUTH_REQUIRED", failureStage: "MANAGER_AUTH" };
  }

  const configStage = configFailure(evidence);
  if (configStage) return { status: "CONFIG_ERROR", failureStage: configStage };

  const managerKnownGood = evidence.managerAuth === "CONFIRMED";
  if (managerKnownGood && evidence.oaAccess === "DENIED") {
    return { status: "OA_ACCESS_LOST", failureStage: "OA_ACCESS" };
  }
  if (managerKnownGood && evidence.chatAccess === "DENIED" && isAuthStatus(evidence.httpStatus)) {
    return { status: "OA_ACCESS_LOST", failureStage: "CHAT_AUTH" };
  }
  if (managerKnownGood && evidence.endpoint === "CHAT_LIST" && isAuthStatus(evidence.httpStatus)) {
    return { status: "OA_ACCESS_LOST", failureStage: "CHAT_AUTH" };
  }

  const failureStage = transportFailure(evidence);
  if (failureStage) return { status: "DEGRADED", failureStage };
  if (successfulEvidence(evidence)) return { status: "CONNECTED", failureStage: null };
  return { status: "UNKNOWN", failureStage: null };
}

/** Classifies sanitized session-level health evidence without I/O. */
export function classifySessionHealth(evidence: LineChatHealthEvidence): LineChatSessionHealthClassification {
  return classifySession(evidence);
}

/** Classifies sanitized OA/Manager health evidence without I/O. */
export function classifyOaHealth(evidence: LineChatHealthEvidence): LineChatOaHealthClassification {
  return classifyOa(evidence);
}

/** Generic alias for callers that select the entity-specific function later. */
export function classifyLineChatHealth(
  entity: "SESSION" | "OA",
  evidence: LineChatHealthEvidence,
): LineChatSessionHealthClassification | LineChatOaHealthClassification {
  return entity === "SESSION" ? classifySession(evidence) : classifyOa(evidence);
}

export type { LineChatOaHealthStatus, LineChatSessionHealthStatus };
