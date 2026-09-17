"use client";

import Link from "next/link";
import { useEffect } from "react";
import { PageContainer } from "@/components/shell";

export default function TikTokError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("TikTok dashboard error:", error);
  }, [error]);

  const isAuthError = error.message === "UNAUTHORIZED";

  return (
    <PageContainer variant="wide">
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <div className="rounded-full bg-rose-50 p-4 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
          {isAuthError ? "Session Expired" : "Unable to load TikTok Analytics"}
        </h2>
        <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          {isAuthError
            ? "Your session has expired. Please sign in again to view TikTok Analytics."
            : error.message || "An unexpected error occurred while fetching public metrics."}
        </p>
        <div className="mt-6 flex gap-3">
          {isAuthError ? (
            <Link
              href="/login"
              className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
            >
              Sign In
            </Link>
          ) : (
            <button
              onClick={() => reset()}
              className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
