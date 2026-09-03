/**
 * Passive health-state vocabulary shared by the future probes and the
 * persistence helper. These values describe browser/LINE Manager evidence;
 * they intentionally do not replace LineChatSession.status or
 * LineOfficialAccount.connectionStatus.
 */
export const LINE_CHAT_SESSION_HEALTH_STATUSES = [
  "UNKNOWN",
  "CONNECTED",
  "DEGRADED",
  "AUTH_REQUIRED",
  "CONFIG_ERROR",
] as const;

export type LineChatSessionHealthStatus = typeof LINE_CHAT_SESSION_HEALTH_STATUSES[number];

export const LINE_CHAT_OA_HEALTH_STATUSES = [
  "UNKNOWN",
  "CONNECTED",
  "DEGRADED",
  "OA_ACCESS_LOST",
  "AUTH_REQUIRED",
  "CONFIG_ERROR",
] as const;

export type LineChatOaHealthStatus = typeof LINE_CHAT_OA_HEALTH_STATUSES[number];

export const LINE_CHAT_HEALTH_FAILURE_STAGES = [
  "PROFILE_MISSING",
  "PROFILE_PATH_INVALID",
  "CHROMIUM_LAUNCH",
  "PROFILE_LOCK",
  "MANAGER_AUTH",
  "OA_ACCESS",
  "CHAT_AUTH",
  "CHAT_LIST_REQUEST",
  "CHAT_LIST_RESPONSE",
  "CHAT_LIST_PARSE",
  "RATE_LIMIT",
  "TIMEOUT",
  "CONFIG_ERROR",
  "UNKNOWN",
] as const;

export type LineChatHealthFailureStage = typeof LINE_CHAT_HEALTH_FAILURE_STAGES[number];

export type LineChatHealthEventEntityType = "SESSION" | "OA";
export type LineChatHealthEventSource = "SCHEDULED" | "MANUAL";
export type LineChatHealthEventStatus = LineChatSessionHealthStatus | "OA_ACCESS_LOST";

export type LineChatHealthEvidenceEndpoint = "MANAGER" | "OA" | "CHAT_LIST" | "SESSION";
export type LineChatHealthManagerAuth = "CONFIRMED" | "EXPLICIT_REQUIRED" | "UNKNOWN";
export type LineChatHealthProfileState = "PRESENT" | "MISSING" | "INVALID" | "UNKNOWN";
export type LineChatHealthFailure =
  | "PROFILE_LOCK"
  | "CHROMIUM_LAUNCH"
  | "TIMEOUT"
  | "UNEXPECTED";

/**
 * Sanitized evidence accepted by the pure classifier. It deliberately has no
 * cookie, token, response-body, customer, or chat-identifier fields.
 */
export interface LineChatHealthEvidence {
  endpoint?: LineChatHealthEvidenceEndpoint;
  managerAuth?: LineChatHealthManagerAuth;
  httpStatus?: number;
  loginRedirect?: boolean;
  profileState?: LineChatHealthProfileState;
  failure?: LineChatHealthFailure;
  oaAccess?: "GRANTED" | "DENIED";
  chatAccess?: "GRANTED" | "DENIED";
  responseShape?: "VALID" | "MALFORMED";
}

export interface LineChatSessionHealthClassification {
  status: LineChatSessionHealthStatus;
  failureStage: LineChatHealthFailureStage | null;
}

export interface LineChatOaHealthClassification {
  status: LineChatOaHealthStatus;
  failureStage: LineChatHealthFailureStage | null;
}

export interface LineChatHealthSnapshotInputBase {
  checkedAt?: Date;
  nextCheckAt?: Date | null;
  httpStatus?: number | null;
  durationMs?: number | null;
  source?: LineChatHealthEventSource;
}

export interface RecordSessionHealthResultInput extends LineChatHealthSnapshotInputBase {
  sessionId: string;
  status: LineChatSessionHealthStatus;
  failureStage?: LineChatHealthFailureStage | null;
}

export interface RecordOaHealthResultInput extends LineChatHealthSnapshotInputBase {
  lineOfficialAccountId: string;
  status: LineChatOaHealthStatus;
  failureStage?: LineChatHealthFailureStage | null;
  healthSessionSnapshotAt?: Date | null;
}

export interface EffectiveHealthInput {
  status: LineChatSessionHealthStatus | LineChatOaHealthStatus;
  lastCheckedAt: Date | null | undefined;
  now: Date;
}
