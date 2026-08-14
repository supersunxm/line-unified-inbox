"use client";

import Link from "next/link";
import { useEffect } from "react";
import { consumeTikTokOAuthStateAction } from "./actions";
import { TikTokCallbackValidationResult } from "./tiktok-callback-validator";

interface TikTokCallbackViewProps {
  result: TikTokCallbackValidationResult;
}

export function TikTokCallbackView({ result }: TikTokCallbackViewProps) {
  useEffect(() => {
    // Consume and clear the state cookie on the client side via server action
    // to prevent replay attacks on subsequent reloads or callbacks
    consumeTikTokOAuthStateAction().catch(() => {
      // Ignore background cookie cleanup failures
    });
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 transition-colors duration-150 dark:bg-[#0b0d11] dark:text-slate-100">
      {/* Top Header Bar */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-[#12151c]/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 font-bold text-xs text-white shadow-xs dark:bg-emerald-500">
              O
            </span>
            <div>
              <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                OPPO Retail TikTok Monitor
              </span>
              <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:inline">
                {" "}
                · OAuth Integration
              </span>
            </div>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            TikTok Callback
          </span>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#12151c] sm:p-10">
          {result.status === "SUCCESS" && (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400">
                <svg
                  className="h-7 w-7"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>

              <div>
                <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                  Authorization Received
                </span>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
                  TikTok Authorization Code Received
                </h1>
                <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600 dark:text-slate-400">
                  Your TikTok store account authorization has been successfully received by the application.
                </p>
              </div>

              <div className="mx-auto max-w-md rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-left dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                  Status &amp; Next Steps
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-emerald-800 dark:text-emerald-200/90">
                  The authorization code has been recorded for server-side verification. For security, authorization credentials and tokens are processed strictly on the backend and are never displayed on this page.
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                >
                  Return to Dashboard
                </Link>
              </div>
            </div>
          )}

          {result.status === "STATE_MISMATCH" && (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400">
                <svg
                  className="h-7 w-7"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
              </div>

              <div>
                <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                  Verification Failed
                </span>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
                  Unable to Verify Authorization
                </h1>
                <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600 dark:text-slate-400">
                  Unable to verify the TikTok authorization request. Please start the connection again.
                </p>
              </div>

              <div className="mx-auto max-w-md rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-left dark:border-amber-900/60 dark:bg-amber-950/30">
                <h2 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                  Security Protection
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-200/90">
                  The security state parameter in this request could not be validated against your active session. This protects your account against unauthorized connection attempts.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <Link
                  href="/tiktok/connect"
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                >
                  Start Connection Again
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/40 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Dashboard
                </Link>
              </div>
            </div>
          )}

          {result.status === "ERROR" && (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/70 dark:text-rose-400">
                <svg
                  className="h-7 w-7"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                </svg>
              </div>

              <div>
                <span className="rounded-md bg-rose-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-rose-800 dark:bg-rose-950/80 dark:text-rose-300">
                  Connection Error
                </span>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
                  TikTok Authorization Failed
                </h1>
                <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600 dark:text-slate-400">
                  We encountered an issue while processing your TikTok authorization request.
                </p>
              </div>

              <div className="mx-auto max-w-md rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-left dark:border-rose-900/60 dark:bg-rose-950/30">
                <h2 className="text-xs font-bold uppercase tracking-wider text-rose-900 dark:text-rose-300">
                  Error Details
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-rose-800 dark:text-rose-200/90">
                  {result.errorMessage}
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <Link
                  href="/tiktok/connect"
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/40 focus-visible:ring-offset-2 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  Try Again
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/40 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Dashboard
                </Link>
              </div>
            </div>
          )}

          {result.status === "INVALID" && (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400">
                <svg
                  className="h-7 w-7"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
              </div>

              <div>
                <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                  Invalid Request
                </span>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
                  Invalid Authorization Callback
                </h1>
                <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600 dark:text-slate-400">
                  No authorization code or error parameters were found in this request. If you are connecting a store account, please initiate authorization from the dashboard.
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/40 focus-visible:ring-offset-2 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  Return to Dashboard
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <p>© {new Date().getFullYear()} OPPO Retail Operations. All rights reserved.</p>
      </footer>
    </div>
  );
}
