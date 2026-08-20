import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_PUBLIC_APP_URL,
  getPublicAppUrl,
} from "../src/app/tiktok/connect/tiktok-oauth.ts";
import { getSafeTikTokErrorMessage } from "../src/app/tiktok/callback/tiktok-callback-utils.ts";
import {
  STATE_MISMATCH_ERROR_MESSAGE,
  logTikTokCallbackDiagnostic,
  processTikTokCallbackParams,
  timingSafeStringEqual,
  validateTikTokOAuthState,
} from "../src/app/tiktok/callback/tiktok-callback-validator.ts";

const routeSource = readFileSync(new URL("../src/app/tiktok/callback/route.ts", import.meta.url), "utf8");
const resultPageSource = readFileSync(new URL("../src/app/tiktok/callback/result/page.tsx", import.meta.url), "utf8");
const viewSource = readFileSync(new URL("../src/app/tiktok/callback/tiktok-callback-view.tsx", import.meta.url), "utf8");
const validatorSource = readFileSync(new URL("../src/app/tiktok/callback/tiktok-callback-validator.ts", import.meta.url), "utf8");
const topNavSource = readFileSync(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");

test("TikTok callback route files exist", () => {
  assert.ok(existsSync(new URL("../src/app/tiktok/callback/route.ts", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/callback/result/page.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/callback/tiktok-callback-view.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/tiktok/callback/tiktok-callback-validator.ts", import.meta.url)));
});

test("TikTok callback result page has appropriate metadata and noindex robots tag", () => {
  assert.match(resultPageSource, /title:\s*"TikTok Authorization \| OPPO Retail TikTok Monitor"/);
  assert.match(resultPageSource, /robots:\s*\{[^}]*index:\s*false[^}]*follow:\s*false[^}]*\}/s);
});

test("timingSafeStringEqual compares strings securely", () => {
  assert.equal(timingSafeStringEqual("secure-state-abc", "secure-state-abc"), true);
  assert.equal(timingSafeStringEqual("secure-state-abc", "secure-state-xyz"), false);
  assert.equal(timingSafeStringEqual("secure-state-abc", "short"), false);
  assert.equal(timingSafeStringEqual("", "something"), false);
  assert.equal(timingSafeStringEqual("something", ""), false);
});

test("validateTikTokOAuthState validates matching, missing, and mismatched state values", () => {
  const validState = "f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8";

  // 1. Valid matching state
  assert.equal(validateTikTokOAuthState(validState, validState), true);

  // 2. Missing query state
  assert.equal(validateTikTokOAuthState(null, validState), false);
  assert.equal(validateTikTokOAuthState(undefined, validState), false);
  assert.equal(validateTikTokOAuthState("", validState), false);

  // 3. Missing cookie state
  assert.equal(validateTikTokOAuthState(validState, null), false);
  assert.equal(validateTikTokOAuthState(validState, undefined), false);
  assert.equal(validateTikTokOAuthState(validState, ""), false);

  // 4. Mismatched state
  assert.equal(
    validateTikTokOAuthState(validState, "wrong-tampered-state-value-0000000000000000000000000000000000"),
    false
  );
});

test("processTikTokCallbackParams handles all OAuth callback branches exactly once", () => {
  const matchingState = "state_123456_abcdef";
  const validCode = "tiktok_auth_code_sample_999";

  // 1. Successful callback after valid matching state
  const successResult = processTikTokCallbackParams({
    code: validCode,
    state: matchingState,
    cookieState: matchingState,
  });
  assert.deepEqual(successResult, { status: "SUCCESS" });

  // 2. Missing state query parameter
  const missingQueryStateResult = processTikTokCallbackParams({
    code: validCode,
    state: null,
    cookieState: matchingState,
  });
  assert.equal(missingQueryStateResult.status, "STATE_MISMATCH");
  assert.equal(
    (missingQueryStateResult as { errorMessage: string }).errorMessage,
    STATE_MISMATCH_ERROR_MESSAGE
  );

  // 3. Missing state cookie
  const missingCookieStateResult = processTikTokCallbackParams({
    code: validCode,
    state: matchingState,
    cookieState: null,
  });
  assert.equal(missingCookieStateResult.status, "STATE_MISMATCH");

  // 4. Mismatched state
  const mismatchedStateResult = processTikTokCallbackParams({
    code: validCode,
    state: matchingState,
    cookieState: "different_state_from_another_session",
  });
  assert.equal(mismatchedStateResult.status, "STATE_MISMATCH");

  // 5. TikTok error returned
  const errorResult = processTikTokCallbackParams({
    error: "access_denied",
    errorDescription: "The user denied authorization.",
    state: matchingState,
    cookieState: matchingState,
  });
  assert.equal(errorResult.status, "ERROR");
  assert.match(
    (errorResult as { errorMessage: string }).errorMessage,
    /cancelled or declined/i
  );

  // 6. Missing parameters
  const invalidResult = processTikTokCallbackParams({});
  assert.equal(invalidResult.status, "INVALID");
});

test("getPublicAppUrl resolves public application domain and excludes internal container hosts", () => {
  assert.equal(DEFAULT_PUBLIC_APP_URL, "https://lineoppo.click");
  assert.equal(getPublicAppUrl(), "https://lineoppo.click");

  const originalEnv = process.env.NEXT_PUBLIC_APP_URL;

  try {
    // Custom valid public URL
    process.env.NEXT_PUBLIC_APP_URL = "https://custom.lineoppo.click/";
    assert.equal(getPublicAppUrl(), "https://custom.lineoppo.click");

    // Internal container addresses must be ignored and fallback safely
    process.env.NEXT_PUBLIC_APP_URL = "http://0.0.0.0:8080";
    assert.equal(getPublicAppUrl(), "https://lineoppo.click");

    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    assert.equal(getPublicAppUrl(), "https://lineoppo.click");
  } finally {
    process.env.NEXT_PUBLIC_APP_URL = originalEnv;
  }
});

test("Callback route handler constructs result redirects with public application origin", () => {
  assert.match(routeSource, /const\s+publicOrigin\s*=\s*getPublicAppUrl\(\)/);
  assert.match(routeSource, /new\s+URL\("\/tiktok\/connect\/error",\s*publicOrigin\)/);
  assert.doesNotMatch(routeSource, /new\s+URL\("\/tiktok\/connect\/error",\s*request\.url\)/);
  assert.doesNotMatch(routeSource, /new\s+URL\("\/tiktok\/connect\/error",\s*request\.nextUrl\)/);
  assert.doesNotMatch(routeSource, /0\.0\.0\.0/);
  assert.doesNotMatch(routeSource, /localhost/);
});

test("Route handler clears state cookie in the 302 redirect response without client-side actions", () => {
  assert.match(routeSource, /response\.cookies\.set\(TIKTOK_OAUTH_STATE_COOKIE/);
  assert.match(routeSource, /maxAge:\s*0/);
  assert.match(routeSource, /httpOnly:\s*true/);
  assert.match(routeSource, /sameSite:\s*"lax"/);
  assert.match(routeSource, /\/tiktok\/connect\/error/);
});

test("No client-side useEffect, POST request, or Server Action triggered from callback view", () => {
  assert.doesNotMatch(viewSource, /useEffect/);
  assert.doesNotMatch(viewSource, /consumeTikTokOAuthStateAction/);
  assert.doesNotMatch(viewSource, /fetch\(/);
  assert.doesNotMatch(viewSource, /method="POST"/i);
});

test("State mismatch displays safe user-facing message without exposing state values", () => {
  assert.match(
    STATE_MISMATCH_ERROR_MESSAGE,
    /Unable to verify the TikTok authorization request\. Please start the connection again\./
  );
  assert.match(
    viewSource,
    /Unable to verify the TikTok authorization request\. Please start the connection again\./
  );
});

test("Safe diagnostics log booleans only, never logging sensitive values", () => {
  assert.ok(typeof logTikTokCallbackDiagnostic === "function");
  assert.match(validatorSource, /callbackStatePresent/);
  assert.match(validatorSource, /stateCookiePresent/);
  assert.match(validatorSource, /stateLengthsMatch/);
  assert.match(validatorSource, /stateMatched/);
  assert.doesNotMatch(validatorSource, /console\.info\([^)]*state,/);
});

test("Security: callback does NOT render or log authorization codes or state values", () => {
  // Authorization code must not be in client templates or props
  assert.doesNotMatch(viewSource, /\{code\}/);
  assert.doesNotMatch(viewSource, /code=\{code\}/);
  assert.doesNotMatch(viewSource, /code:/);

  // State values must not be rendered or passed to client component
  assert.doesNotMatch(viewSource, /\{state\}/);
  assert.doesNotMatch(viewSource, /state=\{state\}/);
  assert.doesNotMatch(viewSource, /state:/);

  // No console logging of code, state, or tokens
  assert.doesNotMatch(viewSource, /console\.log\([^)]*code/i);
  assert.doesNotMatch(viewSource, /console\.log\([^)]*state/i);
  assert.doesNotMatch(validatorSource, /console\.log/i);

  // No hardcoded client secrets or tokens
  assert.doesNotMatch(viewSource, /client_secret/i);
  assert.doesNotMatch(viewSource, /access_token/i);
  assert.doesNotMatch(viewSource, /refresh_token/i);
  assert.doesNotMatch(resultPageSource, /client_secret/i);
});

test("TikTok callback is NOT linked from existing TopNavigation", () => {
  assert.doesNotMatch(topNavSource, /href="\/tiktok\/callback"/);
});
