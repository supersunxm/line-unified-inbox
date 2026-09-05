import os from "node:os";
import path from "node:path";

/**
 * Default local Mac profile path preserved for local development backwards-compatibility.
 */
export const DEFAULT_LOCAL_MAC_PROFILE_DIR = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "GoogleReviewKpiChromeProfile"
);

/**
 * Resolves the persistent Chrome profile directory from environment variable or system default.
 * Priority:
 * 1. GOOGLE_REVIEW_PROFILE_DIR (or legacy GOOGLE_REVIEW_CHROME_PROFILE_DIR)
 * 2. On Darwin (macOS): ~/Library/Application Support/GoogleReviewKpiChromeProfile
 * 3. On Linux/Other (e.g. Railway container): /tmp/google-review-kpi-profile (or system tempdir)
 */
export function resolveGoogleReviewProfileDir(env = process.env) {
  const customDir = env.GOOGLE_REVIEW_PROFILE_DIR || env.GOOGLE_REVIEW_CHROME_PROFILE_DIR;
  if (customDir && customDir.trim().length > 0) {
    return customDir.trim();
  }

  if (process.platform === "darwin") {
    return DEFAULT_LOCAL_MAC_PROFILE_DIR;
  }

  return path.join(os.tmpdir(), "google-review-kpi-profile");
}

/**
 * Resolves whether the browser should run in headless mode.
 * Priority:
 * 1. Explicit GOOGLE_REVIEW_HEADLESS env ("true" / "false" / "1" / "0")
 * 2. If running in Railway, CI, or non-darwin environment: defaults to true (headless)
 * 3. If running locally on macOS without env: defaults to false (headed for operator visibility)
 */
export function resolveGoogleReviewHeadless(env = process.env) {
  const headlessEnv = env.GOOGLE_REVIEW_HEADLESS;
  if (headlessEnv !== undefined && headlessEnv !== null) {
    const trimmed = String(headlessEnv).trim().toLowerCase();
    if (trimmed === "true" || trimmed === "1") return true;
    if (trimmed === "false" || trimmed === "0") return false;
  }

  // In production/Railway/CI or headless Linux environments, default to headless
  if (env.RAILWAY_ENVIRONMENT || env.RAILWAY_PROJECT_ID || env.CI || process.platform !== "darwin") {
    return true;
  }

  // Local development on macOS defaults to headed unless specified
  return false;
}

/**
 * Builds Chromium launch options suitable for both local development and Railway/Linux container environments.
 */
export function buildGoogleReviewLaunchOptions(env = process.env, overrides = {}) {
  const headless = resolveGoogleReviewHeadless(env);
  const isLinux = process.platform === "linux" || Boolean(env.RAILWAY_ENVIRONMENT || env.RAILWAY_PROJECT_ID);

  const baseArgs = [
    "--disable-blink-features=AutomationControlled",
  ];

  // In Linux / containerized environments, sandbox and dev-shm flags are critical
  if (isLinux) {
    baseArgs.push(
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    );
  }

  const extraArgs = Array.isArray(overrides.args) ? overrides.args : [];

  return {
    headless: overrides.headless !== undefined ? overrides.headless : headless,
    args: Array.from(new Set([...baseArgs, ...extraArgs])),
    viewport: overrides.viewport || { width: 1440, height: 900 },
    ...overrides,
  };
}
