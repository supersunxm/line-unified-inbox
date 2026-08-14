import crypto from "node:crypto";
import { getSafeTikTokErrorMessage } from "./tiktok-callback-utils.ts";

export type TikTokCallbackValidationResult =
  | { status: "SUCCESS" }
  | { status: "ERROR"; errorMessage: string }
  | { status: "STATE_MISMATCH"; errorMessage: string }
  | { status: "INVALID" };

export const STATE_MISMATCH_ERROR_MESSAGE =
  "Unable to verify the TikTok authorization request. Please start the connection again.";

export function timingSafeStringEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function validateTikTokOAuthState(
  returnedState: string | null | undefined,
  storedCookieState: string | null | undefined
): boolean {
  if (!returnedState || !storedCookieState) return false;
  return timingSafeStringEqual(returnedState.trim(), storedCookieState.trim());
}

export function processTikTokCallbackParams(params: {
  code?: string | null;
  state?: string | null;
  error?: string | null;
  errorDescription?: string | null;
  cookieState?: string | null;
}): TikTokCallbackValidationResult {
  const { code, state, error, errorDescription, cookieState } = params;

  // 1. If TikTok returned an error
  if (error) {
    return {
      status: "ERROR",
      errorMessage: getSafeTikTokErrorMessage(error, errorDescription || null),
    };
  }

  // 2. If neither code nor error is present, callback is missing parameters
  if (!code && !state) {
    return { status: "INVALID" };
  }

  // 3. If code is present, state validation is mandatory
  const isStateValid = validateTikTokOAuthState(state, cookieState);
  if (!isStateValid) {
    return {
      status: "STATE_MISMATCH",
      errorMessage: STATE_MISMATCH_ERROR_MESSAGE,
    };
  }

  if (!code) {
    return { status: "INVALID" };
  }

  return { status: "SUCCESS" };
}
