import {
  PROVIDER_SOURCES,
  PROVIDER_HEALTH_STATUS,
  EXTRACTION_STATUS,
  assertExactProviderResult,
} from "./provider-adapter.mjs";
import { CountikAdapter } from "./countik-adapter.mjs";
import { TokCounterAdapter } from "./tokcounter-adapter.mjs";
import { TikTokDirectAdapter } from "./tiktok-direct-adapter.mjs";

export class TikTokPublicProviderManager {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.providers = new Map();
    this.rateLimitedForRun = new Set(options.initialRateLimitedProviders || []);

    // Initialize adapters
    const countik = options.countikAdapter || new CountikAdapter(options.countikOptions);
    const tokcounter = options.tokcounterAdapter || new TokCounterAdapter(options.tokcounterOptions);
    const tiktokDirect = options.tiktokDirectAdapter || new TikTokDirectAdapter(options.tiktokDirectOptions);

    this.providers.set(PROVIDER_SOURCES.COUNTIK, countik);
    this.providers.set(PROVIDER_SOURCES.TOKCOUNTER, tokcounter);
    this.providers.set(PROVIDER_SOURCES.TIKTOK_DIRECT, tiktokDirect);

    // Configurable priority order
    this.priority = options.priority || [
      PROVIDER_SOURCES.COUNTIK,
      PROVIDER_SOURCES.TOKCOUNTER,
      PROVIDER_SOURCES.TIKTOK_DIRECT,
    ];

    // TokCounter initial state check: if known in cooldown from previous run, we can mark it
    if (options.initialTokCounterCooldown) {
      tokcounter.markCooldown(options.initialTokCounterCooldown, "Host IP rate limited on TokCounter");
      this.rateLimitedForRun.add(PROVIDER_SOURCES.TOKCOUNTER);
    }
  }

  getProvider(source) {
    return this.providers.get(source) || null;
  }

  getHealthSummary() {
    const summary = {};
    for (const [source, adapter] of this.providers.entries()) {
      summary[source] = {
        name: adapter.name,
        healthStatus: adapter.healthStatus,
        isAvailable: adapter.isAvailable() && !this.rateLimitedForRun.has(source),
        isRateLimitedForRun: this.rateLimitedForRun.has(source),
        cooldownUntil: adapter.cooldownUntil ? new Date(adapter.cooldownUntil).toISOString() : null,
        consecutiveFailures: adapter.consecutiveFailures,
        lastError: adapter.lastError || null,
      };
    }
    return summary;
  }

  /**
   * Evaluates whether an account is confirmed non-existent based on:
   * - Rule A: Independent consensus from >= 2 distinct providers
   * - Rule B: Authoritative direct TikTok evidence (e.g. error code 10221, ACCOUNT_NOT_FOUND)
   */
  isConfirmedNotFound(notFoundAttempts) {
    if (!notFoundAttempts || notFoundAttempts.length === 0) {
      return false;
    }

    // Rule A: Independent consensus from at least 2 distinct providers
    const distinctSources = new Set(notFoundAttempts.map((a) => a.source));
    if (distinctSources.size >= 2) {
      return true;
    }

    // Rule B: Authoritative direct TikTok evidence from TIKTOK_DIRECT probe
    const directAttempt = notFoundAttempts.find(
      (a) => a.source === PROVIDER_SOURCES.TIKTOK_DIRECT
    );
    if (directAttempt && directAttempt.result) {
      const res = directAttempt.result;
      if (
        res.isDirectOfficialNotFound === true ||
        res.statusCode === 10221 ||
        res.category === "ACCOUNT_NOT_FOUND" ||
        (typeof res.error === "string" && /account not found/i.test(res.error))
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Suspicious Jump Guard (Phase 15):
   * Flags anomaly if new followerCount is > 10x higher and absolute jump > 50,000.
   */
  isSuspiciousJump(previousCount, newCount) {
    if (previousCount == null || previousCount <= 0 || newCount == null) {
      return false;
    }
    const ratio = newCount / previousCount;
    const diff = newCount - previousCount;
    return ratio >= 10 && diff >= 50000;
  }

  /**
   * Extracts public TikTok metrics for a username with automatic multi-provider failover
   * and optional candidate username resolution (e.g. url handle vs hyphenated typos).
   */
  async extractWithFailover(username, options = {}) {
    const cleanUser = username.replace(/^@+/, "").trim().toLowerCase();
    const candidateList = options.candidateUsernames && Array.isArray(options.candidateUsernames)
      ? Array.from(new Set([cleanUser, ...options.candidateUsernames.map(u => u.replace(/^@+/, "").trim().toLowerCase())]))
      : [cleanUser];

    let lastResult = null;

    for (let cIdx = 0; cIdx < candidateList.length; cIdx++) {
      const currentCandidate = candidateList[cIdx];
      const attempts = [];
      const previousFollowers = options.previousFollowers ?? null;

      if (cIdx > 0) {
        this.logger.log(`  -> Primary username not found. Attempting candidate [${cIdx + 1}/${candidateList.length}]: @${currentCandidate}...`);
      }

      for (const source of this.priority) {
        const adapter = this.providers.get(source);
        if (!adapter) continue;

        // Run-Scoped Rate Limit Guard: immediately skip providers disabled for this run
        if (this.rateLimitedForRun.has(source)) {
          this.logger.log(`  -> Provider ${source} is disabled for current run (RATE_LIMITED). Skipping.`);
          attempts.push({
            source,
            skipped: true,
            reason: "RATE_LIMITED_FOR_RUN",
          });
          continue;
        }

        if (!adapter.isAvailable()) {
          this.logger.log(`  -> Provider ${source} is currently ${adapter.healthStatus}. Skipping.`);
          attempts.push({
            source,
            skipped: true,
            reason: `Provider in ${adapter.healthStatus}`,
          });
          continue;
        }

        this.logger.log(`  -> Querying provider ${source} for @${currentCandidate}...`);
        const result = await adapter.extract(currentCandidate, options);
        attempts.push({ source, result });

        if (result.status === EXTRACTION_STATUS.SUCCESS) {
          // Assert exactness
          try {
            assertExactProviderResult(result);
          } catch (exactErr) {
            this.logger.warn(`  -> Provider ${source} returned non-exact result: ${exactErr.message}. Failing over.`);
            adapter.markFailure(EXTRACTION_STATUS.PARSE_ERROR, exactErr.message);
            continue;
          }

          // Suspicious Jump Guard
          if (this.isSuspiciousJump(previousFollowers, result.followerCount)) {
            this.logger.warn(
              `  -> SUSPICIOUS METRIC JUMP: previous=${previousFollowers}, current=${result.followerCount} (from ${source}). Verifying with next provider...`
            );
            // Find next available provider to cross-validate
            const nextSource = this.priority.find(
              (s) => s !== source && !this.rateLimitedForRun.has(s) && this.providers.get(s)?.isAvailable()
            );
            if (nextSource) {
              const crossAdapter = this.providers.get(nextSource);
              const crossResult = await crossAdapter.extract(currentCandidate, options);
              attempts.push({ source: nextSource, crossCheckFor: source, result: crossResult });
              if (crossResult.status === EXTRACTION_STATUS.SUCCESS) {
                const crossDiff = Math.abs(crossResult.followerCount - result.followerCount);
                if (crossDiff > result.followerCount * 0.5) {
                  this.logger.warn(
                    `  -> Anomaly confirmed: ${source} (${result.followerCount}) diverges heavily from ${nextSource} (${crossResult.followerCount}). Preferring ${nextSource}.`
                  );
                  return {
                    ...crossResult,
                    targetUsername: cleanUser,
                    matchedCandidate: currentCandidate,
                    attempts,
                    crossValidated: true,
                  };
                }
              }
            }
          }

          return {
            ...result,
            targetUsername: cleanUser,
            matchedCandidate: currentCandidate,
            attempts,
          };
        }

        if (result.status === EXTRACTION_STATUS.RATE_LIMITED) {
          this.rateLimitedForRun.add(source);
          adapter.markCooldown(null, result.error || "403/429 Rate limited");
          this.logger.warn(
            `  -> Provider ${source} RATE LIMITED (${result.error || "403/429"}). Disabled for current run and failing over.`
          );
          continue;
        }

        if (result.status === EXTRACTION_STATUS.PROFILE_NOT_FOUND) {
          this.logger.warn(`  -> Provider ${source} reported @${currentCandidate} NOT FOUND. Cross-checking with next provider...`);
          // Do not immediately fail; check next provider to see if it agrees
          continue;
        }

        // Provider unavailable, network error, or parse error
        this.logger.warn(`  -> Provider ${source} failed (${result.status}: ${result.error || "unknown"}). Failing over.`);
      }

      // Check failure outcomes for this candidate
      const notFoundAttempts = attempts.filter((a) => a.result?.status === EXTRACTION_STATUS.PROFILE_NOT_FOUND);
      const rateLimitedAttempts = attempts.filter((a) => a.result?.status === EXTRACTION_STATUS.RATE_LIMITED);

      // Issue 1: PROFILE_NOT_FOUND requires independent consensus or direct authoritative evidence
      if (this.isConfirmedNotFound(notFoundAttempts)) {
        lastResult = {
          status: EXTRACTION_STATUS.PROFILE_NOT_FOUND,
          source: notFoundAttempts[0].source,
          username: currentCandidate,
          targetUsername: cleanUser,
          error: notFoundAttempts[0].result?.error || "Account not found across checked independent providers",
          attempts,
        };
        // Continue to next candidate (if any) to check alternate handles
        continue;
      }

      // If only 1 provider reported not found without independent consensus/direct evidence
      if (notFoundAttempts.length > 0) {
        lastResult = {
          status: EXTRACTION_STATUS.UNRESOLVED,
          source: notFoundAttempts[0].source,
          username: currentCandidate,
          targetUsername: cleanUser,
          error: "Account reported not found by single provider but lacks independent confirmation",
          attempts,
        };
        continue;
      }

      if (rateLimitedAttempts.length === attempts.filter((a) => !a.skipped).length && rateLimitedAttempts.length > 0) {
        return {
          status: EXTRACTION_STATUS.RATE_LIMITED,
          source: rateLimitedAttempts[0].source,
          username: currentCandidate,
          targetUsername: cleanUser,
          error: "All active providers are rate limited",
          attempts,
        };
      }

      lastResult = {
        status: EXTRACTION_STATUS.PROVIDER_UNAVAILABLE,
        source: "ALL_FAILED",
        username: currentCandidate,
        targetUsername: cleanUser,
        error: "All providers failed or unavailable",
        attempts,
      };
    }

    return (
      lastResult || {
        status: EXTRACTION_STATUS.PROVIDER_UNAVAILABLE,
        source: "ALL_FAILED",
        username: cleanUser,
        targetUsername: cleanUser,
        error: "All providers failed or unavailable",
        attempts: [],
      }
    );
  }
}
