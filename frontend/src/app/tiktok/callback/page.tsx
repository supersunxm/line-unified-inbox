import type { Metadata } from "next";
import { cookies } from "next/headers";
import { TIKTOK_OAUTH_STATE_COOKIE } from "../connect/tiktok-oauth";
import { TikTokCallbackView } from "./tiktok-callback-view";
import {
  logTikTokCallbackDiagnostic,
  processTikTokCallbackParams,
  timingSafeStringEqual,
} from "./tiktok-callback-validator";

export const metadata: Metadata = {
  title: "TikTok Authorization | OPPO Retail TikTok Monitor",
  description: "OAuth authorization callback endpoint for OPPO Retail TikTok Monitor.",
  robots: {
    index: false,
    follow: false,
  },
};

interface TikTokCallbackPageProps {
  searchParams?:
    | Promise<{ [key: string]: string | string[] | undefined }>
    | { [key: string]: string | string[] | undefined };
}

export default async function TikTokCallbackPage(props: TikTokCallbackPageProps) {
  const resolvedParams = props.searchParams ? await Promise.resolve(props.searchParams) : {};

  const code = typeof resolvedParams.code === "string" ? resolvedParams.code : null;
  const state = typeof resolvedParams.state === "string" ? resolvedParams.state : null;
  const error = typeof resolvedParams.error === "string" ? resolvedParams.error : null;
  const errorDescription =
    typeof resolvedParams.error_description === "string"
      ? resolvedParams.error_description
      : null;

  const cookieStore = await cookies();
  const cookieState = cookieStore.get(TIKTOK_OAUTH_STATE_COOKIE)?.value || null;

  // Safe server-side diagnostics (booleans/metadata only)
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

  // Only pass the status and human-readable error message to the client view
  // Authorization code, state, and secrets are NEVER passed to client component props
  return (
    <TikTokCallbackView
      status={validationResult.status}
      errorMessage={
        "errorMessage" in validationResult ? validationResult.errorMessage : null
      }
    />
  );
}
