/**
 * Common types, interfaces, and normalization utilities for TikTok Public Metrics Providers.
 */

export const PROVIDER_SOURCES = Object.freeze({
  COUNTIK: "COUNTIK",
  TOKCOUNTER: "TOKCOUNTER",
  TIKTOK_DIRECT: "TIKTOK_DIRECT",
});

export const PROVIDER_HEALTH_STATUS = Object.freeze({
  HEALTHY: "HEALTHY",
  COOLDOWN: "COOLDOWN",
  DEGRADED: "DEGRADED",
  UNAVAILABLE: "UNAVAILABLE",
});

export const EXTRACTION_STATUS = Object.freeze({
  SUCCESS: "SUCCESS",
  RATE_LIMITED: "RATE_LIMITED",
  PROFILE_NOT_FOUND: "PROFILE_NOT_FOUND",
  UNRESOLVED: "UNRESOLVED",
  IDENTITY_MISMATCH: "IDENTITY_MISMATCH",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  PARSE_ERROR: "PARSE_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
});

/**
 * Validates that an extraction result contains an EXACT, non-negative integer follower count.
 * Rejects rounded, estimated, null, or negative counts.
 */
export function assertExactProviderResult(result) {
  if (!result || result.status !== EXTRACTION_STATUS.SUCCESS) {
    throw new Error(`Cannot assert exactness on non-success result: ${result?.status}`);
  }
  if (result.precision !== "EXACT") {
    throw new Error(`Metric precision '${result.precision}' is not EXACT; refusing to persist`);
  }
  if (
    typeof result.followerCount !== "number" ||
    !Number.isSafeInteger(result.followerCount) ||
    result.followerCount < 0
  ) {
    throw new Error(`Follower count ${result.followerCount} is not a valid non-negative integer`);
  }
}

/**
 * Base class for all TikTok public metrics provider adapters.
 */
export class BaseTikTokProviderAdapter {
  constructor(source, options = {}) {
    this.source = source;
    this.name = options.name || source;
    this.healthStatus = PROVIDER_HEALTH_STATUS.HEALTHY;
    this.cooldownUntil = null;
    this.consecutiveFailures = 0;
    this.maxConsecutiveFailures = options.maxConsecutiveFailures || 3;
    this.cooldownDurationMs = options.cooldownDurationMs || 60000;
  }

  isAvailable() {
    if (this.healthStatus === PROVIDER_HEALTH_STATUS.UNAVAILABLE) {
      return false;
    }
    if (this.healthStatus === PROVIDER_HEALTH_STATUS.COOLDOWN) {
      if (this.cooldownUntil && Date.now() >= this.cooldownUntil) {
        // Cooldown has expired, reset to DEGRADED to try cautiously
        this.healthStatus = PROVIDER_HEALTH_STATUS.DEGRADED;
        this.cooldownUntil = null;
        return true;
      }
      return false;
    }
    return true;
  }

  markCooldown(durationMs = null, reason = "Rate limited") {
    const dur = durationMs || this.cooldownDurationMs;
    this.healthStatus = PROVIDER_HEALTH_STATUS.COOLDOWN;
    this.cooldownUntil = Date.now() + dur;
    this.lastError = reason;
  }

  markSuccess() {
    this.healthStatus = PROVIDER_HEALTH_STATUS.HEALTHY;
    this.consecutiveFailures = 0;
    this.cooldownUntil = null;
  }

  markFailure(errorType, message) {
    this.lastError = message;
    if (errorType === EXTRACTION_STATUS.RATE_LIMITED) {
      this.markCooldown(null, message);
      return;
    }
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.healthStatus = PROVIDER_HEALTH_STATUS.DEGRADED;
    }
  }

  async extract(username, options = {}) {
    throw new Error("extract() must be implemented by subclass");
  }
}
