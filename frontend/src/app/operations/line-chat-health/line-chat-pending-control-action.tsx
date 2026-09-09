"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";

const PROFILE_B_SESSION_KEY = "profile-b";

type PendingControlResult = {
  sessionKey?: string;
  paused?: boolean;
  pausedPending?: number;
  resumedPending?: number;
  running?: number;
  note?: string | null;
  message?: string;
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

export function LineChatPendingControlAction() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [paused, setPaused] = useState(false);
  const [pausedPending, setPausedPending] = useState(0);
  const [running, setRunning] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    refreshTarget();
    const observer = new MutationObserver(refreshTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [refreshTarget]);

  useEffect(() => {
    void refreshStatus();
    const timer = window.setInterval(() => void refreshStatus(), 10_000);
    return () => window.clearInterval(timer);
  }, [refreshStatus]);

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
      await refreshStatus();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to change pending queue state.");
    } finally {
      setLoading(false);
    }
  };

  if (!target) return null;

  const title = paused
    ? `Pending queue paused${pausedPending ? ` (${pausedPending})` : ""}. Click to resume.`
    : "Pause profile-b pending nickname jobs. A currently running job is allowed to finish.";

  return createPortal(
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
        {loading ? "Working..." : paused ? `Resume Pending${pausedPending ? ` (${pausedPending})` : ""}` : "Pause Pending"}
      </Button>
      {paused && running > 0 ? (
        <span className="max-w-44 text-xs text-[var(--app-warning)]" title="The current running job will finish; no paused pending job is eligible to start.">
          {running} running will finish
        </span>
      ) : null}
      {error ? (
        <span role="alert" className="max-w-52 text-xs text-[var(--app-danger)]" title={error}>
          {error}
        </span>
      ) : null}
    </>,
    target,
  );
}
