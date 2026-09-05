import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import {
  DEFAULT_LOCAL_MAC_PROFILE_DIR,
  resolveGoogleReviewProfileDir,
  resolveGoogleReviewHeadless,
  buildGoogleReviewLaunchOptions,
} from "./browser-runtime-config.mjs";

describe("Google Review Collector Browser Runtime Config", () => {
  describe("resolveGoogleReviewProfileDir", () => {
    it("returns custom GOOGLE_REVIEW_PROFILE_DIR when provided", () => {
      const customPath = "/custom/path/to/profile";
      const result = resolveGoogleReviewProfileDir({
        GOOGLE_REVIEW_PROFILE_DIR: customPath,
      });
      assert.equal(result, customPath);
    });

    it("falls back to legacy GOOGLE_REVIEW_CHROME_PROFILE_DIR if primary is missing", () => {
      const legacyPath = "/legacy/path/to/profile";
      const result = resolveGoogleReviewProfileDir({
        GOOGLE_REVIEW_CHROME_PROFILE_DIR: legacyPath,
      });
      assert.equal(result, legacyPath);
    });

    it("defaults to Mac path on darwin when no env var is set", () => {
      if (process.platform === "darwin") {
        const result = resolveGoogleReviewProfileDir({});
        assert.equal(result, DEFAULT_LOCAL_MAC_PROFILE_DIR);
      }
    });

    it("defaults to temp directory on non-darwin systems without env var", () => {
      const originalPlatform = process.platform;
      try {
        Object.defineProperty(process, "platform", { value: "linux", configurable: true });
        const result = resolveGoogleReviewProfileDir({});
        assert.equal(result, path.join(os.tmpdir(), "google-review-kpi-profile"));
      } finally {
        Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
      }
    });
  });

  describe("resolveGoogleReviewHeadless", () => {
    it("respects explicit GOOGLE_REVIEW_HEADLESS=true / 1", () => {
      assert.equal(resolveGoogleReviewHeadless({ GOOGLE_REVIEW_HEADLESS: "true" }), true);
      assert.equal(resolveGoogleReviewHeadless({ GOOGLE_REVIEW_HEADLESS: "1" }), true);
    });

    it("respects explicit GOOGLE_REVIEW_HEADLESS=false / 0", () => {
      assert.equal(resolveGoogleReviewHeadless({ GOOGLE_REVIEW_HEADLESS: "false" }), false);
      assert.equal(resolveGoogleReviewHeadless({ GOOGLE_REVIEW_HEADLESS: "0" }), false);
    });

    it("defaults to true in Railway environment", () => {
      assert.equal(resolveGoogleReviewHeadless({ RAILWAY_ENVIRONMENT: "production" }), true);
      assert.equal(resolveGoogleReviewHeadless({ RAILWAY_PROJECT_ID: "prj-123" }), true);
    });

    it("defaults to true in CI", () => {
      assert.equal(resolveGoogleReviewHeadless({ CI: "true" }), true);
    });

    it("defaults to true on linux platform", () => {
      const originalPlatform = process.platform;
      try {
        Object.defineProperty(process, "platform", { value: "linux", configurable: true });
        assert.equal(resolveGoogleReviewHeadless({}), true);
      } finally {
        Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
      }
    });
  });

  describe("buildGoogleReviewLaunchOptions", () => {
    it("includes base anti-detection args and handles headless mode", () => {
      const opts = buildGoogleReviewLaunchOptions({ GOOGLE_REVIEW_HEADLESS: "true" });
      assert.equal(opts.headless, true);
      assert.ok(opts.args.includes("--disable-blink-features=AutomationControlled"));
    });

    it("injects Linux container sandbox flags when running in Railway or Linux", () => {
      const opts = buildGoogleReviewLaunchOptions({
        RAILWAY_ENVIRONMENT: "production",
        GOOGLE_REVIEW_HEADLESS: "true",
      });
      assert.equal(opts.headless, true);
      assert.ok(opts.args.includes("--no-sandbox"));
      assert.ok(opts.args.includes("--disable-setuid-sandbox"));
      assert.ok(opts.args.includes("--disable-dev-shm-usage"));
    });

    it("allows caller overrides", () => {
      const opts = buildGoogleReviewLaunchOptions({}, { headless: true, viewport: { width: 1920, height: 1080 } });
      assert.equal(opts.headless, true);
      assert.deepEqual(opts.viewport, { width: 1920, height: 1080 });
    });
  });
});
