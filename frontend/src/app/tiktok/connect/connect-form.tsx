"use client";

import { useState } from "react";
import { initiateTikTokOAuthAction } from "./actions";

interface ConnectFormProps {
  isConfigured: boolean;
}

export function TikTokConnectForm({ isConfigured }: ConnectFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    if (!isConfigured) {
      setErrorMessage(
        "TikTok integration is not configured on this environment. Missing TIKTOK_CLIENT_KEY."
      );
      return;
    }

    try {
      setIsPending(true);
      setErrorMessage(null);
      await initiateTikTokOAuthAction();
    } catch (err: unknown) {
      // Next.js redirect throws a NEXT_REDIRECT digest error which should bubble up
      if (err && typeof err === "object" && "digest" in err && typeof (err as { digest: string }).digest === "string" && (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")) {
        throw err;
      }

      setIsPending(false);
      const msg = err instanceof Error ? err.message : "Failed to initiate TikTok authorization.";
      setErrorMessage(msg);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-left dark:border-rose-900/60 dark:bg-rose-950/40">
          <p className="text-xs text-rose-800 dark:text-rose-200/90">{errorMessage}</p>
        </div>
      )}

      {!isConfigured && !errorMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-left dark:border-amber-900/60 dark:bg-amber-950/40">
          <p className="text-xs text-amber-800 dark:text-amber-200/90">
            <strong>Configuration Notice:</strong> The TikTok Client Key is not configured yet on this environment. Setting <code className="font-mono text-[11px]">TIKTOK_CLIENT_KEY</code> in server environment variables is required to initiate live authorization.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-xs transition-all hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-600"
      >
        {isPending ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <span>Redirecting to TikTok...</span>
          </>
        ) : (
          <span>Connect TikTok</span>
        )}
      </button>
    </form>
  );
}
