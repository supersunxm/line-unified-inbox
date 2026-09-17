import assert from "node:assert/strict";
import test, { describe, it } from "node:test";
import {
  PROVIDER_SOURCES,
  PROVIDER_HEALTH_STATUS,
  EXTRACTION_STATUS,
  assertExactProviderResult,
  BaseTikTokProviderAdapter,
} from "../../scripts/tiktok-public/providers/provider-adapter.mjs";
import { TikTokPublicProviderManager } from "../../scripts/tiktok-public/providers/provider-manager.mjs";

describe("TikTok Multi-Provider Architecture Suite", () => {
  describe("Exactness Assertion", () => {
    it("accepts valid exact integer metrics", () => {
      const valid = {
        status: EXTRACTION_STATUS.SUCCESS,
        precision: "EXACT",
        followerCount: 13990,
        source: PROVIDER_SOURCES.COUNTIK,
      };
      assert.doesNotThrow(() => assertExactProviderResult(valid));
    });

    it("rejects rounded metrics", () => {
      const rounded = {
        status: EXTRACTION_STATUS.SUCCESS,
        precision: "ROUNDED",
        followerCount: 14000,
        source: "TOKPLEX",
      };
      assert.throws(() => assertExactProviderResult(rounded), /Metric precision 'ROUNDED' is not EXACT/);
    });

    it("rejects non-integer or negative follower counts", () => {
      const negative = {
        status: EXTRACTION_STATUS.SUCCESS,
        precision: "EXACT",
        followerCount: -5,
      };
      assert.throws(() => assertExactProviderResult(negative), /not a valid non-negative integer/);

      const decimal = {
        status: EXTRACTION_STATUS.SUCCESS,
        precision: "EXACT",
        followerCount: 1234.56,
      };
      assert.throws(() => assertExactProviderResult(decimal), /not a valid non-negative integer/);
    });

    it("rejects non-success status", () => {
      const failed = {
        status: EXTRACTION_STATUS.RATE_LIMITED,
        precision: "EXACT",
        followerCount: 1000,
      };
      assert.throws(() => assertExactProviderResult(failed), /Cannot assert exactness on non-success result/);
    });
  });

  describe("Provider Health & Cooldown Lifecycle", () => {
    class MockAdapter extends BaseTikTokProviderAdapter {
      constructor(source, resultQueue) {
        super(source);
        this.resultQueue = resultQueue || [];
      }
      async extract() {
        return this.resultQueue.shift() || { status: EXTRACTION_STATUS.SUCCESS, followerCount: 100, precision: "EXACT", source: this.source };
      }
    }

    it("transitions to COOLDOWN when RATE_LIMITED and recovers after expiry", () => {
      const adapter = new MockAdapter(PROVIDER_SOURCES.TOKCOUNTER);
      assert.equal(adapter.isAvailable(), true);

      // Trigger rate limit with 50ms cooldown for test
      adapter.markCooldown(50, "HTTP 403");
      assert.equal(adapter.healthStatus, PROVIDER_HEALTH_STATUS.COOLDOWN);
      assert.equal(adapter.isAvailable(), false);

      // Wait for cooldown to expire
      return new Promise((resolve) => {
        setTimeout(() => {
          assert.equal(adapter.isAvailable(), true);
          assert.equal(adapter.healthStatus, PROVIDER_HEALTH_STATUS.DEGRADED);
          adapter.markSuccess();
          assert.equal(adapter.healthStatus, PROVIDER_HEALTH_STATUS.HEALTHY);
          resolve();
        }, 60);
      });
    });

    it("transitions to DEGRADED after consecutive failures", () => {
      const adapter = new MockAdapter(PROVIDER_SOURCES.TIKTOK_DIRECT);
      adapter.markFailure(EXTRACTION_STATUS.PROVIDER_UNAVAILABLE, "Err 1");
      assert.equal(adapter.healthStatus, PROVIDER_HEALTH_STATUS.HEALTHY);
      adapter.markFailure(EXTRACTION_STATUS.PROVIDER_UNAVAILABLE, "Err 2");
      assert.equal(adapter.healthStatus, PROVIDER_HEALTH_STATUS.HEALTHY);
      adapter.markFailure(EXTRACTION_STATUS.PROVIDER_UNAVAILABLE, "Err 3");
      assert.equal(adapter.healthStatus, PROVIDER_HEALTH_STATUS.DEGRADED);
    });
  });

  describe("Provider Manager Failover Execution", () => {
    class MockAdapter extends BaseTikTokProviderAdapter {
      constructor(source, results = []) {
        super(source);
        this.results = results;
        this.calledCount = 0;
      }
      async extract(username) {
        this.calledCount++;
        const res = this.results.shift();
        if (!res) {
          return { status: EXTRACTION_STATUS.SUCCESS, source: this.source, username, followerCount: 1000, precision: "EXACT", durationMs: 10 };
        }
        return { ...res, source: this.source, username, durationMs: 10 };
      }
    }

    it("succeeds with first provider without calling fallback", async () => {
      const p1 = new MockAdapter(PROVIDER_SOURCES.COUNTIK, [
        { status: EXTRACTION_STATUS.SUCCESS, followerCount: 5000, precision: "EXACT" },
      ]);
      const p2 = new MockAdapter(PROVIDER_SOURCES.TOKCOUNTER, [
        { status: EXTRACTION_STATUS.SUCCESS, followerCount: 5000, precision: "EXACT" },
      ]);

      const manager = new TikTokPublicProviderManager({
        countikAdapter: p1,
        tokcounterAdapter: p2,
        priority: [PROVIDER_SOURCES.COUNTIK, PROVIDER_SOURCES.TOKCOUNTER],
        logger: { log: () => {}, warn: () => {} },
      });

      const res = await manager.extractWithFailover("o_test");
      assert.equal(res.status, EXTRACTION_STATUS.SUCCESS);
      assert.equal(res.source, PROVIDER_SOURCES.COUNTIK);
      assert.equal(res.followerCount, 5000);
      assert.equal(p1.calledCount, 1);
      assert.equal(p2.calledCount, 0); // Not called
    });

    it("fails over to second provider when first is RATE_LIMITED", async () => {
      const p1 = new MockAdapter(PROVIDER_SOURCES.TOKCOUNTER, [
        { status: EXTRACTION_STATUS.RATE_LIMITED, error: "HTTP 403" },
      ]);
      const p2 = new MockAdapter(PROVIDER_SOURCES.COUNTIK, [
        { status: EXTRACTION_STATUS.SUCCESS, followerCount: 4477, precision: "EXACT" },
      ]);

      const manager = new TikTokPublicProviderManager({
        tokcounterAdapter: p1,
        countikAdapter: p2,
        priority: [PROVIDER_SOURCES.TOKCOUNTER, PROVIDER_SOURCES.COUNTIK],
        logger: { log: () => {}, warn: () => {} },
      });

      const res = await manager.extractWithFailover("o_seacon");
      assert.equal(res.status, EXTRACTION_STATUS.SUCCESS);
      assert.equal(res.source, PROVIDER_SOURCES.COUNTIK);
      assert.equal(res.followerCount, 4477);
      assert.equal(p1.calledCount, 1);
      assert.equal(p2.calledCount, 1);
      assert.equal(p1.healthStatus, PROVIDER_HEALTH_STATUS.COOLDOWN);

      // On next call, p1 should be skipped immediately because it is in COOLDOWN
      const res2 = await manager.extractWithFailover("o_next");
      assert.equal(res2.status, EXTRACTION_STATUS.SUCCESS);
      assert.equal(res2.source, PROVIDER_SOURCES.COUNTIK);
      assert.equal(p1.calledCount, 1); // Still 1, not hammered!
      assert.equal(p2.calledCount, 2);
    });

    it("fails over when provider returns non-exact or invalid data", async () => {
      const p1 = new MockAdapter(PROVIDER_SOURCES.COUNTIK, [
        { status: EXTRACTION_STATUS.SUCCESS, followerCount: 14000, precision: "ROUNDED" }, // Rejection!
      ]);
      const p2 = new MockAdapter(PROVIDER_SOURCES.TIKTOK_DIRECT, [
        { status: EXTRACTION_STATUS.SUCCESS, followerCount: 13995, precision: "EXACT" },
      ]);

      const manager = new TikTokPublicProviderManager({
        countikAdapter: p1,
        tiktokDirectAdapter: p2,
        priority: [PROVIDER_SOURCES.COUNTIK, PROVIDER_SOURCES.TIKTOK_DIRECT],
        logger: { log: () => {}, warn: () => {} },
      });

      const res = await manager.extractWithFailover("o_centralworld");
      assert.equal(res.status, EXTRACTION_STATUS.SUCCESS);
      assert.equal(res.source, PROVIDER_SOURCES.TIKTOK_DIRECT);
      assert.equal(res.followerCount, 13995);
    });

    it("cross-checks PROFILE_NOT_FOUND with second provider before concluding not found", async () => {
      const p1 = new MockAdapter(PROVIDER_SOURCES.COUNTIK, [
        { status: EXTRACTION_STATUS.PROFILE_NOT_FOUND, error: "404" },
      ]);
      const p2 = new MockAdapter(PROVIDER_SOURCES.TIKTOK_DIRECT, [
        { status: EXTRACTION_STATUS.SUCCESS, followerCount: 2000, precision: "EXACT" }, // Found on direct!
      ]);

      const manager = new TikTokPublicProviderManager({
        countikAdapter: p1,
        tiktokDirectAdapter: p2,
        priority: [PROVIDER_SOURCES.COUNTIK, PROVIDER_SOURCES.TIKTOK_DIRECT],
        logger: { log: () => {}, warn: () => {} },
      });

      const res = await manager.extractWithFailover("o_typo");
      assert.equal(res.status, EXTRACTION_STATUS.SUCCESS);
      assert.equal(res.source, PROVIDER_SOURCES.TIKTOK_DIRECT);
      assert.equal(res.followerCount, 2000);
      assert.equal(p1.calledCount, 1);
      assert.equal(p2.calledCount, 1);
    });

    it("detects and flags suspicious follower jumps", async () => {
      const p1 = new MockAdapter(PROVIDER_SOURCES.COUNTIK, [
        { status: EXTRACTION_STATUS.SUCCESS, followerCount: 50000000, precision: "EXACT" }, // 50M jump!
      ]);
      const p2 = new MockAdapter(PROVIDER_SOURCES.TIKTOK_DIRECT, [
        { status: EXTRACTION_STATUS.SUCCESS, followerCount: 4500, precision: "EXACT" }, // Real value
      ]);

      const warnings = [];
      const manager = new TikTokPublicProviderManager({
        countikAdapter: p1,
        tiktokDirectAdapter: p2,
        priority: [PROVIDER_SOURCES.COUNTIK, PROVIDER_SOURCES.TIKTOK_DIRECT],
        logger: { log: () => {}, warn: (w) => warnings.push(w) },
      });

      const res = await manager.extractWithFailover("o_glitch", { previousFollowers: 4500 });
      assert.equal(res.status, EXTRACTION_STATUS.SUCCESS);
      assert.equal(res.source, PROVIDER_SOURCES.TIKTOK_DIRECT); // Preferred the reasonable value
      assert.equal(res.followerCount, 4500);
      assert.ok(warnings.some((w) => w.includes("SUSPICIOUS METRIC JUMP")));
    });

    it("resolves valid candidate username when primary has typo or hyphen", async () => {
      const p1 = new MockAdapter(PROVIDER_SOURCES.COUNTIK, [
        { status: EXTRACTION_STATUS.PROFILE_NOT_FOUND, error: "404" }, // Primary o-themall
        { status: EXTRACTION_STATUS.SUCCESS, followerCount: 3712, precision: "EXACT" }, // Candidate o_themall
      ]);

      const manager = new TikTokPublicProviderManager({
        countikAdapter: p1,
        priority: [PROVIDER_SOURCES.COUNTIK],
        logger: { log: () => {}, warn: () => {} },
      });

      const res = await manager.extractWithFailover("o-themall", {
        candidateUsernames: ["o-themall", "o_themall"],
      });
      assert.equal(res.status, EXTRACTION_STATUS.SUCCESS);
      assert.equal(res.source, PROVIDER_SOURCES.COUNTIK);
      assert.equal(res.followerCount, 3712);
      assert.equal(res.targetUsername, "o-themall");
      assert.equal(res.matchedCandidate, "o_themall");
    });
  });

  describe("Issue 1 — PROFILE_NOT_FOUND Consensus & Direct Evidence", () => {
    class MockAdapter extends BaseTikTokProviderAdapter {
      constructor(source, results = []) {
        super(source);
        this.results = results;
        this.calledCount = 0;
      }
      async extract(username) {
        this.calledCount++;
        const res = this.results.shift();
        if (!res) {
          return { status: EXTRACTION_STATUS.SUCCESS, source: this.source, username, followerCount: 1000, precision: "EXACT", durationMs: 10 };
        }
        return { ...res, source: this.source, username, durationMs: 10 };
      }
    }

    it("Case 1: returns PROFILE_NOT_FOUND when 2 independent providers agree (Rule A consensus)", async () => {
      const p1 = new MockAdapter(PROVIDER_SOURCES.COUNTIK, [
        { status: EXTRACTION_STATUS.PROFILE_NOT_FOUND, error: "Countik 404 User Not Found" },
      ]);
      const p2 = new MockAdapter(PROVIDER_SOURCES.TIKTOK_DIRECT, [
        { status: EXTRACTION_STATUS.PROFILE_NOT_FOUND, error: "TikTok Direct 404" },
      ]);

      const manager = new TikTokPublicProviderManager({
        countikAdapter: p1,
        tiktokDirectAdapter: p2,
        priority: [PROVIDER_SOURCES.COUNTIK, PROVIDER_SOURCES.TIKTOK_DIRECT],
        logger: { log: () => {}, warn: () => {} },
      });

      const res = await manager.extractWithFailover("o_nonexistent");
      assert.equal(res.status, EXTRACTION_STATUS.PROFILE_NOT_FOUND);
      assert.equal(p1.calledCount, 1);
      assert.equal(p2.calledCount, 1);
    });

    it("Case 2: returns UNRESOLVED (NOT PROFILE_NOT_FOUND) when only 1 provider reports 404 and others are rate-limited or unavailable", async () => {
      const p1 = new MockAdapter(PROVIDER_SOURCES.COUNTIK, [
        { status: EXTRACTION_STATUS.PROFILE_NOT_FOUND, error: "Countik 404" },
      ]);
      const p2 = new MockAdapter(PROVIDER_SOURCES.TOKCOUNTER, [
        { status: EXTRACTION_STATUS.RATE_LIMITED, error: "TokCounter HTTP 403" },
      ]);
      const p3 = new MockAdapter(PROVIDER_SOURCES.TIKTOK_DIRECT, [
        { status: EXTRACTION_STATUS.PROVIDER_UNAVAILABLE, error: "Direct network timeout" },
      ]);

      const manager = new TikTokPublicProviderManager({
        countikAdapter: p1,
        tokcounterAdapter: p2,
        tiktokDirectAdapter: p3,
        priority: [PROVIDER_SOURCES.COUNTIK, PROVIDER_SOURCES.TOKCOUNTER, PROVIDER_SOURCES.TIKTOK_DIRECT],
        logger: { log: () => {}, warn: () => {} },
      });

      const res = await manager.extractWithFailover("o_ambiguous");
      assert.notEqual(res.status, EXTRACTION_STATUS.PROFILE_NOT_FOUND);
      assert.equal(res.status, EXTRACTION_STATUS.UNRESOLVED);
      assert.match(res.error, /lacks independent confirmation/i);
    });

    it("Case 3: returns SUCCESS from fallback provider when first reports PROFILE_NOT_FOUND but second succeeds", async () => {
      const p1 = new MockAdapter(PROVIDER_SOURCES.COUNTIK, [
        { status: EXTRACTION_STATUS.PROFILE_NOT_FOUND, error: "Countik 404" },
      ]);
      const p2 = new MockAdapter(PROVIDER_SOURCES.TIKTOK_DIRECT, [
        { status: EXTRACTION_STATUS.SUCCESS, followerCount: 5432, precision: "EXACT" },
      ]);

      const manager = new TikTokPublicProviderManager({
        countikAdapter: p1,
        tiktokDirectAdapter: p2,
        priority: [PROVIDER_SOURCES.COUNTIK, PROVIDER_SOURCES.TIKTOK_DIRECT],
        logger: { log: () => {}, warn: () => {} },
      });

      const res = await manager.extractWithFailover("o_fallback_found");
      assert.equal(res.status, EXTRACTION_STATUS.SUCCESS);
      assert.equal(res.source, PROVIDER_SOURCES.TIKTOK_DIRECT);
      assert.equal(res.followerCount, 5432);
    });

    it("Case 4: candidate username from rawUrl resolves to SUCCESS when primary is not found", async () => {
      const p1 = new MockAdapter(PROVIDER_SOURCES.COUNTIK, [
        { status: EXTRACTION_STATUS.PROFILE_NOT_FOUND, error: "404 on typo" }, // o-themallthaphra
        { status: EXTRACTION_STATUS.SUCCESS, followerCount: 3712, precision: "EXACT" }, // o_themallthaphra
      ]);

      const manager = new TikTokPublicProviderManager({
        countikAdapter: p1,
        priority: [PROVIDER_SOURCES.COUNTIK],
        logger: { log: () => {}, warn: () => {} },
      });

      const res = await manager.extractWithFailover("o-themallthaphra", {
        candidateUsernames: ["o-themallthaphra", "o_themallthaphra"],
      });
      assert.equal(res.status, EXTRACTION_STATUS.SUCCESS);
      assert.equal(res.source, PROVIDER_SOURCES.COUNTIK);
      assert.equal(res.followerCount, 3712);
      assert.equal(res.targetUsername, "o-themallthaphra");
      assert.equal(res.matchedCandidate, "o_themallthaphra");
    });

    it("Case 5: concludes PROFILE_NOT_FOUND when TikTok Direct provides authoritative official error code 10221 (Rule B)", async () => {
      // Even if Countik was disabled/unavailable, strong direct official TikTok error code 10221 is authoritative
      const p1 = new MockAdapter(PROVIDER_SOURCES.COUNTIK, [
        { status: EXTRACTION_STATUS.PROVIDER_UNAVAILABLE, error: "Countik server 500" },
      ]);
      const p2 = new MockAdapter(PROVIDER_SOURCES.TIKTOK_DIRECT, [
        {
          status: EXTRACTION_STATUS.PROFILE_NOT_FOUND,
          statusCode: 10221,
          category: "ACCOUNT_NOT_FOUND",
          isDirectOfficialNotFound: true,
          error: "TikTok account not found.",
        },
      ]);

      const manager = new TikTokPublicProviderManager({
        countikAdapter: p1,
        tiktokDirectAdapter: p2,
        priority: [PROVIDER_SOURCES.COUNTIK, PROVIDER_SOURCES.TIKTOK_DIRECT],
        logger: { log: () => {}, warn: () => {} },
      });

      const res = await manager.extractWithFailover("oppo_kamthieng01");
      assert.equal(res.status, EXTRACTION_STATUS.PROFILE_NOT_FOUND);
      assert.equal(res.source, PROVIDER_SOURCES.TIKTOK_DIRECT);
    });
  });

  describe("Issue 2 — Run-Scoped Rate Limit Circuit Breaker", () => {
    class MockAdapter extends BaseTikTokProviderAdapter {
      constructor(source, results = []) {
        super(source);
        this.results = results;
        this.calledCount = 0;
      }
      async extract(username) {
        this.calledCount++;
        const res = this.results.shift();
        if (!res) {
          return { status: EXTRACTION_STATUS.SUCCESS, source: this.source, username, followerCount: 1000, precision: "EXACT", durationMs: 10 };
        }
        return { ...res, source: this.source, username, durationMs: 10 };
      }
    }

    it("Case A: Provider A returns RATE_LIMITED on account 1; account 2 in same run never calls Provider A", async () => {
      const p1 = new MockAdapter(PROVIDER_SOURCES.COUNTIK, [
        { status: EXTRACTION_STATUS.RATE_LIMITED, error: "HTTP 429 Rate Limit" }, // For account 1
        { status: EXTRACTION_STATUS.SUCCESS, followerCount: 9999, precision: "EXACT" }, // Would succeed if called, but must NOT be called!
      ]);
      const p2 = new MockAdapter(PROVIDER_SOURCES.TIKTOK_DIRECT, [
        { status: EXTRACTION_STATUS.SUCCESS, followerCount: 1000, precision: "EXACT" }, // For account 1
        { status: EXTRACTION_STATUS.SUCCESS, followerCount: 2000, precision: "EXACT" }, // For account 2
      ]);

      const manager = new TikTokPublicProviderManager({
        countikAdapter: p1,
        tiktokDirectAdapter: p2,
        priority: [PROVIDER_SOURCES.COUNTIK, PROVIDER_SOURCES.TIKTOK_DIRECT],
        logger: { log: () => {}, warn: () => {} },
      });

      // Account 1
      const res1 = await manager.extractWithFailover("account_1");
      assert.equal(res1.status, EXTRACTION_STATUS.SUCCESS);
      assert.equal(res1.source, PROVIDER_SOURCES.TIKTOK_DIRECT);
      assert.equal(p1.calledCount, 1);
      assert.equal(p2.calledCount, 1);
      assert.equal(manager.rateLimitedForRun.has(PROVIDER_SOURCES.COUNTIK), true);

      // Account 2 in SAME manager / run
      const res2 = await manager.extractWithFailover("account_2");
      assert.equal(res2.status, EXTRACTION_STATUS.SUCCESS);
      assert.equal(res2.source, PROVIDER_SOURCES.TIKTOK_DIRECT);
      assert.equal(p1.calledCount, 1); // Provider A was NEVER called again during this run!
      assert.equal(p2.calledCount, 2);
    });

    it("Case B: creating a brand new ProviderManager instance resets run-scoped rate limits for new run", async () => {
      const p1 = new MockAdapter(PROVIDER_SOURCES.COUNTIK, [
        { status: EXTRACTION_STATUS.SUCCESS, followerCount: 5000, precision: "EXACT" },
      ]);

      // Fresh manager instance representing next day's run
      const freshManager = new TikTokPublicProviderManager({
        countikAdapter: p1,
        priority: [PROVIDER_SOURCES.COUNTIK],
        logger: { log: () => {}, warn: () => {} },
      });

      assert.equal(freshManager.rateLimitedForRun.has(PROVIDER_SOURCES.COUNTIK), false);
      const res = await freshManager.extractWithFailover("account_next_day");
      assert.equal(res.status, EXTRACTION_STATUS.SUCCESS);
      assert.equal(res.source, PROVIDER_SOURCES.COUNTIK);
      assert.equal(p1.calledCount, 1);
    });

    it("Case C: COUNTIK rate limits -> fails over to TOKCOUNTER; next account skips COUNTIK and uses TOKCOUNTER directly", async () => {
      const p1 = new MockAdapter(PROVIDER_SOURCES.COUNTIK, [
        { status: EXTRACTION_STATUS.RATE_LIMITED, error: "HTTP 403" },
      ]);
      const p2 = new MockAdapter(PROVIDER_SOURCES.TOKCOUNTER, [
        { status: EXTRACTION_STATUS.SUCCESS, followerCount: 3000, precision: "EXACT" },
        { status: EXTRACTION_STATUS.SUCCESS, followerCount: 4000, precision: "EXACT" },
      ]);

      const manager = new TikTokPublicProviderManager({
        countikAdapter: p1,
        tokcounterAdapter: p2,
        priority: [PROVIDER_SOURCES.COUNTIK, PROVIDER_SOURCES.TOKCOUNTER],
        logger: { log: () => {}, warn: () => {} },
      });

      // Account 1
      const res1 = await manager.extractWithFailover("acc_1");
      assert.equal(res1.status, EXTRACTION_STATUS.SUCCESS);
      assert.equal(res1.source, PROVIDER_SOURCES.TOKCOUNTER);
      assert.equal(res1.followerCount, 3000);
      assert.equal(p1.calledCount, 1);
      assert.equal(p2.calledCount, 1);

      // Account 2
      const res2 = await manager.extractWithFailover("acc_2");
      assert.equal(res2.status, EXTRACTION_STATUS.SUCCESS);
      assert.equal(res2.source, PROVIDER_SOURCES.TOKCOUNTER);
      assert.equal(res2.followerCount, 4000);
      assert.equal(p1.calledCount, 1); // COUNTIK skipped!
      assert.equal(p2.calledCount, 2); // TOKCOUNTER used directly
    });

    it("Case D: returns clear non-success status when all providers become rate-limited/unavailable without fabricating metrics", async () => {
      const p1 = new MockAdapter(PROVIDER_SOURCES.COUNTIK, [
        { status: EXTRACTION_STATUS.RATE_LIMITED, error: "HTTP 429" },
      ]);
      const p2 = new MockAdapter(PROVIDER_SOURCES.TOKCOUNTER, [
        { status: EXTRACTION_STATUS.RATE_LIMITED, error: "HTTP 403" },
      ]);
      const p3 = new MockAdapter(PROVIDER_SOURCES.TIKTOK_DIRECT, [
        { status: EXTRACTION_STATUS.RATE_LIMITED, error: "HTTP 429" },
      ]);

      const manager = new TikTokPublicProviderManager({
        countikAdapter: p1,
        tokcounterAdapter: p2,
        tiktokDirectAdapter: p3,
        priority: [PROVIDER_SOURCES.COUNTIK, PROVIDER_SOURCES.TOKCOUNTER, PROVIDER_SOURCES.TIKTOK_DIRECT],
        logger: { log: () => {}, warn: () => {} },
      });

      const res = await manager.extractWithFailover("acc_all_limited");
      assert.equal(res.status, EXTRACTION_STATUS.RATE_LIMITED);
      assert.equal(res.followerCount, undefined); // Never fabricated!
      assert.match(res.error, /rate limited/i);
    });
  });
});

