import type {
  EffectiveHealthInput,
  LineChatOaHealthStatus,
  LineChatSessionHealthStatus,
} from "./line-chat-health.types";

export const LINE_CHAT_SESSION_HEALTH_TARGET_CADENCE_MS = 12 * 60 * 1000;
export const LINE_CHAT_SESSION_HEALTH_GREEN_FRESHNESS_MS = 30 * 60 * 1000;
export const LINE_CHAT_OA_HEALTH_TARGET_CADENCE_MS = 3 * 60 * 60 * 1000;
export const LINE_CHAT_OA_HEALTH_GREEN_FRESHNESS_MS = 6 * 60 * 60 * 1000;

export function isHealthFresh(input: {
  lastCheckedAt: Date | null | undefined;
  now: Date;
  freshnessMs: number;
}): boolean {
  if (!(input.lastCheckedAt instanceof Date) || Number.isNaN(input.lastCheckedAt.getTime())) return false;
  if (!(input.now instanceof Date) || Number.isNaN(input.now.getTime())) return false;
  return input.now.getTime() - input.lastCheckedAt.getTime() <= input.freshnessMs;
}

export function effectiveSessionHealthStatus(input: EffectiveHealthInput): LineChatSessionHealthStatus {
  if (
    input.status === "CONNECTED"
    && !isHealthFresh({
      lastCheckedAt: input.lastCheckedAt,
      now: input.now,
      freshnessMs: LINE_CHAT_SESSION_HEALTH_GREEN_FRESHNESS_MS,
    })
  ) return "UNKNOWN";
  return input.status as LineChatSessionHealthStatus;
}

export function effectiveOaHealthStatus(input: {
  now?: Date;
  session: EffectiveHealthInput;
  oa: EffectiveHealthInput & { status: LineChatOaHealthStatus };
}): LineChatOaHealthStatus {
  const now = input.now ?? input.session.now;
  const parentStatus = effectiveSessionHealthStatus({ ...input.session, now });
  const oaStatus = input.oa.status;

  if (parentStatus === "AUTH_REQUIRED") return "AUTH_REQUIRED";
  if (parentStatus === "CONFIG_ERROR") return "CONFIG_ERROR";
  if (parentStatus === "DEGRADED") return "DEGRADED";

  // A stale/unknown parent must never allow a green child. Preserve a
  // non-green OA observation when it is useful, but gate CONNECTED.
  if (parentStatus === "UNKNOWN") {
    return oaStatus === "CONNECTED" ? "UNKNOWN" : oaStatus;
  }

  if (
    oaStatus === "CONNECTED"
    && !isHealthFresh({
      lastCheckedAt: input.oa.lastCheckedAt,
      now,
      freshnessMs: LINE_CHAT_OA_HEALTH_GREEN_FRESHNESS_MS,
    })
  ) return "UNKNOWN";
  return oaStatus;
}

/** Explicit alias for API/read-model callers. */
export const deriveEffectiveOaHealthStatus = effectiveOaHealthStatus;
