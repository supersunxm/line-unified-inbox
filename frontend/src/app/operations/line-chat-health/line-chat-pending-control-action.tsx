"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";

const PROFILE_B_SESSION_KEY = "profile-b";
const RUN_STORAGE_KEY = "line-chat:nickname-run:profile-b";

type PendingControlResult = {
  sessionKey?: string;
  paused?: boolean;
  pausedPending?: number;
  resumedPending?: number;
  resumedAt?: string;
  jobIds?: string[];
  running?: number;
  note?: string | null;
  message?: string;
};

type StoredRun = {
  sessionKey: string;
  startedAt: string;
  jobIds: string[];
};

type RunFailure = {
  jobId: string;
  conversationId: string | null;
  status: string;
  error: string | null;
  updatedAt: string;
};

type RunProgress = {
  sessionKey: string;
  total: number;
  success: number;
  processing: number;
  waitingForMapping: number;
  mappedReady: number;
  failed: number;
  superseded: number;
  missing: number;
  completed: number;
  remaining: number;
  progressPercent: number;
  finished: boolean;
  checkedAt: string;
  failures: RunFailure[];
};

function findProfileBActionsTarget(): HTMLElement | null {
  for (const row of Array.from(document.querySelectorAll("tbody tr"))) {
    if (!row.textContent?.includes(PROFILE_B_SESSION_KEY)) continue;
    const cells = row.querySelectorAll("td");
    const actionsCell = cells.item(cells.length - 1);
    if (!(actionsCell instanceof HTMLElement)) return null;
    const existingActions = actionsCell.firstElementChild;
    return existingActions instanceof HTMLElement ? existingActions : actionsCell;
  }
  return null;
}

function loadStoredRun(): StoredRun | null {
  try {
    const raw = window.localStorage.getItem(RUN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredRun>;
    if (parsed.sessionKey !== PROFILE_B_SESSION_KEY || !parsed.startedAt || !Array.isArray(parsed.jobIds) || parsed.jobIds.length === 0) {
      window.localStorage.removeItem(RUN_STORAGE_KEY);
      return null;
    }
    return { sessionKey: PROFILE_B_SESSION_KEY, startedAt: parsed.startedAt, jobIds: parsed.jobIds.filter((id): id is string => typeof id === "string" && id.length > 0) };
  } catch {
    window.localStorage.removeItem(RUN_STORAGE_KEY);
    return null;
  }
}

function saveStoredRun(run: StoredRun | null) {
  if (run) window.localStorage.setItem(RUN_STORAGE_KEY, JSON.stringify(run));
  else window.localStorage.removeItem(RUN_STORAGE_KEY);
}

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

export function LineChatPendingControlAction() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [paused, setPaused] = useState(false);
  const [pausedPending, setPausedPending] = useState(0);
  const [running, setRunning] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<StoredRun | null>(null);
  const [runProgress, setRunProgress] = useState<RunProgress | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [showFailures, setShowFailures] = useState(false);

  const refreshTarget = useCallback(() => {
    setTarget(findProfileBActionsTarget());
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `/api-backend/operations/line-chat-nickname/sessions/${PROFILE_B_SESSION_KEY}/pending-control`,
        { credentials: "include", headers: { Accept: "application/json" } },
      );
      if (!response.ok) return;
      const result = (await response.json()) as PendingControlResult;
      setPaused(result.paused === true);
      setPausedPending(result.pausedPending ?? 0);
      setRunning(result.running ?? 0);
    } catch {
      // Health page remains usable if control status cannot be loaded.
    }
  }, []);

  const refreshRunProgress = useCallback(async (run: StoredRun) => {
    try {
      const response = await fetch(
        `/api-backend/operations/line-chat-nickname/sessions/${PROFILE_B_SESSION_KEY}/pending-control/run-progress`,
        {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ jobIds: run.jobIds }),
        },
      );
      let result: RunProgress | { message?: string };
      try { result = (await response.json()) as RunProgress | { message?: string }; } catch { result = {}; }
      if (!response.ok) throw new Error("message" in result && result.message ? result.message : `Unable to load run progress (${response.status}).`);
      setRunProgress(result as RunProgress);
      setRunError(null);
    } catch (reason) {
      setRunError(reason instanceof Error ? reason.message : "Unable to load nickname run progress.");
    }
  }, []);

  useEffect(() => {
    refreshTarget();
    const observer = new MutationObserver(refreshTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [refreshTarget]);

  useEffect(() => {
    const stored = loadStoredRun();
    if (stored) setActiveRun(stored);
  }, []);

  useEffect(() => {
    void refreshStatus();
    const timer = window.setInterval(() => void refreshStatus(), 10_000);
    return () => window.clearInterval(timer);
  }, [refreshStatus]);

  useEffect(() => {
    if (!activeRun) return;
    void refreshRunProgress(activeRun);
    const timer = window.setInterval(() => void refreshRunProgress(activeRun), 3_000);
    return () => window.clearInterval(timer);
  }, [activeRun, refreshRunProgress]);

  const toggle = async () => {
    setLoading(true);
    setError(null);
    try {
      const action = paused ? "resume" : "pause";
      const response = await fetch(
        `/api-backend/operations/line-chat-nickname/sessions/${PROFILE_B_SESSION_KEY}/pending-control/${action}`,
        {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json" },
        },
      );
      let result: PendingControlResult = {};
      try { result = (await response.json()) as PendingControlResult; } catch { /* keep generic error */ }
      if (!response.ok) throw new Error(result.message || `Unable to ${action} pending jobs (${response.status}).`);
      setPaused(result.paused === true);
      setPausedPending(result.pausedPending ?? 0);
      setRunning(result.running ?? 0);

      if (action === "resume" && result.jobIds?.length) {
        const run: StoredRun = {
          sessionKey: PROFILE_B_SESSION_KEY,
          startedAt: result.resumedAt ?? new Date().toISOString(),
          jobIds: result.jobIds,
        };
        saveStoredRun(run);
        setActiveRun(run);
        setRunProgress(null);
        setRunError(null);
        setShowFailures(false);
        void refreshRunProgress(run);
      }

      await refreshStatus();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to change pending queue state.");
    } finally {
      setLoading(false);
    }
  };

  const closeRun = () => {
    saveStoredRun(null);
    setActiveRun(null);
    setRunProgress(null);
    setRunError(null);
    setShowFailures(false);
  };

  const title = paused
    ? `Start a tracked nickname-change run for ${pausedPending} paused jobs. Chat work keeps higher priority.`
    : "Pause background nickname jobs. A currently running job is allowed to finish.";

  const actionPortal = target ? createPortal(
    <>
      <Button
        size="sm"
        variant={paused ? "primary" : "danger"}
        isLoading={loading}
        disabled={loading}
        title={title}
        onClick={(event) => {
          event.stopPropagation();
          void toggle();
        }}
      >
        {loading ? "Working..." : paused ? `Start Nickname Run${pausedPending ? ` (${pausedPending})` : ""}` : "Pause Nickname Run"}
      </Button>
      {paused && running > 0 ? (
        <span className="max-w-44 text-xs text-[var(--app-warning)]" title="The current running job will finish; no paused pending job is eligible to start.">
          {running} running will finish
        </span>
      ) : null}
      {activeRun ? (
        <span className="max-w-52 text-xs text-[var(--app-success)]" title={`Tracked run started ${formatTime(activeRun.startedAt)}`}>
          Tracking {activeRun.jobIds.length} jobs
        </span>
      ) : null}
      {error ? (
        <span role="alert" className="max-w-52 text-xs text-[var(--app-danger)]" title={error}>
          {error}
        </span>
      ) : null}
    </>,
    target,
  ) : null;

  const runPortal = activeRun && typeof document !== "undefined" ? createPortal(
    <aside className="fixed bottom-5 right-5 z-[80] w-[min(440px,calc(100vw-2.5rem))] rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-2xl" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Current nickname run</div>
          <div className="mt-0.5 text-xs text-[var(--app-text-tertiary)]">Profile B · started {formatTime(activeRun.startedAt)}</div>
        </div>
        <button type="button" className="text-xs text-[var(--app-text-tertiary)] hover:text-[var(--app-text)]" onClick={closeRun}>
          Close
        </button>
      </div>

      {runProgress ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-2xl font-semibold">{runProgress.success} / {runProgress.total}</div>
              <div className="text-xs text-[var(--app-text-secondary)]">nicknames changed successfully</div>
            </div>
            <div className={`rounded-full px-2.5 py-1 text-xs font-medium ${runProgress.finished ? "bg-[var(--app-success-soft)] text-[var(--app-success)]" : "bg-[var(--app-info-soft)] text-[var(--app-info)]"}`}>
              {runProgress.finished ? "Finished" : "Running"}
            </div>
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs text-[var(--app-text-secondary)]">
              <span>{runProgress.completed} completed</span>
              <span>{runProgress.progressPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--app-surface-subtle)]">
              <div className="h-full bg-[var(--app-accent)] transition-all" style={{ width: `${Math.max(0, Math.min(100, runProgress.progressPercent))}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-[var(--app-success-soft)] p-2"><div className="font-semibold text-[var(--app-success)]">{runProgress.success}</div><div>Success</div></div>
            <div className="rounded-lg bg-[var(--app-surface-subtle)] p-2"><div className="font-semibold">{runProgress.processing}</div><div>Running</div></div>
            <div className="rounded-lg bg-[var(--app-surface-subtle)] p-2"><div className="font-semibold">{runProgress.mappedReady}</div><div>Mapped ready</div></div>
            <div className="rounded-lg bg-[var(--app-surface-subtle)] p-2"><div className="font-semibold">{runProgress.waitingForMapping}</div><div>Waiting map</div></div>
            <div className="rounded-lg bg-[var(--app-warning-soft)] p-2"><div className="font-semibold text-[var(--app-warning)]">{runProgress.failed}</div><div>Failed</div></div>
            <div className="rounded-lg bg-[var(--app-surface-subtle)] p-2"><div className="font-semibold">{runProgress.remaining}</div><div>Remaining</div></div>
          </div>

          {runProgress.superseded > 0 || runProgress.missing > 0 ? (
            <div className="text-xs text-[var(--app-text-secondary)]">
              Superseded: {runProgress.superseded}{runProgress.missing > 0 ? ` · Missing: ${runProgress.missing}` : ""}
            </div>
          ) : null}

          {runProgress.failed > 0 ? (
            <div className="border-t border-[var(--app-border)] pt-3">
              <Button size="sm" variant="outline" onClick={() => setShowFailures((value) => !value)}>
                {showFailures ? "Hide errors" : `View errors (${runProgress.failed})`}
              </Button>
              {showFailures ? (
                <div className="mt-2 max-h-52 space-y-2 overflow-auto">
                  {runProgress.failures.map((failure) => (
                    <div key={failure.jobId} className="rounded-lg border border-[var(--app-border)] p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono">{failure.jobId.slice(0, 8)}…</span>
                        <span className="text-[var(--app-warning)]">{failure.status}</span>
                      </div>
                      <div className="mt-1 break-words text-[var(--app-text-secondary)]">{failure.error ?? "No error detail recorded."}</div>
                      <div className="mt-1 flex items-center justify-between text-[var(--app-text-tertiary)]">
                        <span>{formatTime(failure.updatedAt)}</span>
                        {failure.conversationId ? <a href={`/chats?conversationId=${encodeURIComponent(failure.conversationId)}`} className="text-[var(--app-accent)] hover:underline">Open chat</a> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="text-[11px] text-[var(--app-text-tertiary)]">Last checked {formatTime(runProgress.checkedAt)} · updates every 3 seconds</div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-[var(--app-text-secondary)]">Loading run progress…</div>
      )}

      {runError ? <div role="alert" className="mt-3 rounded-lg bg-[var(--app-danger-soft)] p-2 text-xs text-[var(--app-danger)]">{runError}</div> : null}
    </aside>,
    document.body,
  ) : null;

  return <>{actionPortal}{runPortal}</>;
}
