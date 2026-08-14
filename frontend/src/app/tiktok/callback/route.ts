import { NextRequest, NextResponse } from "next/server";
import { TIKTOK_OAUTH_STATE_COOKIE } from "../connect/tiktok-oauth";
import {
  logTikTokCallbackDiagnostic,
  processTikTokCallbackParams,
  timingSafeStringEqual,
} from "./tiktok-callback-validator";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const cookieState = request.cookies.get(TIKTOK_OAUTH_STATE_COOKIE)?.value || null;

  // Safe server-side diagnostics (booleans/metadata only, never sensitive values)
  const callbackStatePresent = Boolean(state);
  const stateCookiePresent = Boolean(cookieState);
  const stateLengthsMatch = Boolean(
    state && cookieState && state.length === cookieState.length
  );
  const stateMatched = Boolean(
    state && cookieState && timingSafeStringEqual(state, cookieState)
  );

  logTikTokCallbackDiagnostic({
    callbackStatePresent,
    stateCookiePresent,
    stateLengthsMatch,
    stateMatched,
    hasCode: Boolean(code),
    hasError: Boolean(error),
  });

  const validationResult = processTikTokCallbackParams({
    code,
    state,
    error,
    errorDescription,
    cookieState,
  });

  // Build clean result destination URL without leaking code or state
  const resultUrl = new URL("/tiktok/callback/result", request.url);

  if (validationResult.status === "SUCCESS") {
    resultUrl.searchParams.set("status", "success");
  } else if (validationResult.status === "STATE_MISMATCH") {
    resultUrl.searchParams.set("status", "state_mismatch");
  } else if (validationResult.status === "ERROR") {
    resultUrl.searchParams.set("status", "error");
    if ("errorMessage" in validationResult && validationResult.errorMessage) {
      resultUrl.searchParams.set("error_message", validationResult.errorMessage);
    }
  } else {
    resultUrl.searchParams.set("status", "invalid");
  }

  // Redirect to result page while immediately consuming/deleting the OAuth state cookie
  const response = NextResponse.redirect(resultUrl, 302);
  response.cookies.set(TIKTOK_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
