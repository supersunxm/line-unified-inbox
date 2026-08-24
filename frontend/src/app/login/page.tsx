"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { defaultRouteForUser, type AuthUser } from "@/lib/authorization";
import { ApplicationWorkspace } from "../page";

type LoginState = "checking" | "ready" | "first-admin" | "redirecting";

export default function LoginPage() {
  const [state, setState] = useState<LoginState>("checking");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      try {
        const setup = await api.setupStatus();
        if (cancelled) return;
        if (setup.firstAdminRequired) {
          setState("first-admin");
          return;
        }
        try {
          const user = await api.me();
          if (cancelled) return;
          setState("redirecting");
          window.location.replace(defaultRouteForUser(user as AuthUser));
        } catch (reason: unknown) {
          if (cancelled) return;
          if (reason instanceof ApiError && reason.status === 401) {
            setState("ready");
            return;
          }
          throw reason;
        }
      } catch (reason: unknown) {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "Unable to check sign-in status");
        setState("ready");
      }
    };
    void bootstrap();
    return () => { cancelled = true; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.login(identifier, password);
      const user = await api.me();
      setPassword("");
      setState("redirecting");
      window.location.replace(defaultRouteForUser(user as AuthUser));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in");
      setSubmitting(false);
      setState("ready");
    }
  }

  if (state === "first-admin") {
    return <ApplicationWorkspace initialSection="dashboard" />;
  }

  if (state === "checking" || state === "redirecting") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        {state === "checking" ? "Checking account access…" : "Opening your workspace…"}
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <form onSubmit={submit} className="rounded-2xl bg-white p-7 shadow-xl dark:bg-slate-900">
          <h1 className="text-xl font-bold text-slate-950 dark:text-white">OPPO LINE OA Monitor</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sign in to your authorized workspace</p>
          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          <label className="mt-5 block text-sm text-slate-700 dark:text-slate-200">
            Username or email
            <input
              type="text"
              required
              autoComplete="username"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="mt-4 block text-sm text-slate-700 dark:text-slate-200">
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <button disabled={submitting} className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-950">
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="mt-4 text-center">
          <Link href="/register" className="text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
            Create BM / PC account
          </Link>
        </div>
      </div>
    </main>
  );
}
