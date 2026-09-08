"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";

type RecoveryStartResult = {
  active?: boolean;
  sessionKey?: string;
  expiresAt?: string | null;
  url?: string | null;
  readyToOpen?: boolean;
  message?: string;
};

const PROFILE_B_SESSION_KEY = "profile-b";

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

export function LineChatNovncRecoveryAction() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshTarget = useCallback(() => {
    setTarget(findProfileBActionsTarget());
  }, []);

  useEffect(() => {
    refreshTarget();
    const observer = new MutationObserver(refreshTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [refreshTarget]);

  useEffect(() => {
    let cancelled = false;
    void api.lineChatOperationsHealth()
      .then((report) => {
        if (cancelled) return;
        const profileB = report.sessions.find((session) => session.sessionKey === PROFILE_B_SESSION_KEY);
        setHealthStatus(profileB?.healthStatus ?? profileB?.status ?? null);
      })
      .catch(() => {
        if (!cancelled) setHealthStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openRecovery = async () => {
    setOpening(true);
    setError(null);

    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;

    try {
      const response = await fetch(
        `/api-backend/operations/line-chat-nickname/sessions/${encodeURIComponent(PROFILE_B_SESSION_KEY)}/manual-recovery/start`,
        {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json" },
        },
      );

      let result: RecoveryStartResult = {};
      try {
        result = (await response.json()) as RecoveryStartResult;
      } catch {
        // The backend normally returns JSON; keep a safe generic error if it does not.
      }

      if (!response.ok) {
        throw new Error(result.message || `Unable to start manual recovery (${response.status}).`);
      }
      if (!result.readyToOpen || !result.url) {
        throw new Error("Manual recovery started, but the secure noVNC URL is not available.");
      }

      if (popup && !popup.closed) {
        popup.location.replace(result.url);
      } else {
        const fallback = window.open(result.url, "_blank", "noopener,noreferrer");
        if (!fallback) throw new Error("Popup blocked. Allow popups for this site and try again.");
      }
    } catch (reason) {
      if (popup && !popup.closed) popup.close();
      setError(reason instanceof Error ? reason.message : "Unable to open noVNC recovery.");
    } finally {
      setOpening(false);
    }
  };

  if (!target) return null;

  const needsReconnect = healthStatus === "AUTH_REQUIRED" || healthStatus === "DISCONNECTED";

  return createPortal(
    <>
      <Button
        size="sm"
        variant={needsReconnect ? "primary" : "outline"}
        isLoading={opening}
        disabled={opening}
        title="Manual profile-b recovery. Opens a temporary noVNC session and reserves this browser profile while it is open."
        onClick={(event) => {
          event.stopPropagation();
          void openRecovery();
        }}
      >
        {opening ? "Opening..." : needsReconnect ? "Reconnect LINE" : "Open noVNC"}
      </Button>
      {error ? (
        <span
          role="alert"
          className="max-w-52 text-xs text-[var(--app-danger)]"
          title={error}
        >
          {error}
        </span>
      ) : null}
    </>,
    target,
  );
}
