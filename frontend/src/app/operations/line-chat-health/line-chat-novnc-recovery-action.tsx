"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";

type RecoveryStartResult = {
  active?: boolean;
  pending?: boolean;
  error?: string | null;
  sessionKey?: string;
  expiresAt?: string | null;
  url?: string | null;
  readyToOpen?: boolean;
  message?: string;
};

function findProfileActionsTarget(sessionKey: string): HTMLElement | null {
  const cardTarget = Array.from(document.querySelectorAll<HTMLElement>("[data-session-actions]")).find(element => element.dataset.sessionActions === sessionKey);
  if (cardTarget) return cardTarget;
  for (const row of Array.from(document.querySelectorAll("tbody tr"))) {
    const cells = row.querySelectorAll("td");
    if (!cells.item(0)?.textContent?.includes(sessionKey)) continue;
    const actionsCell = cells.item(cells.length - 1);
    if (!(actionsCell instanceof HTMLElement)) return null;
    const existingActions = actionsCell.firstElementChild;
    return existingActions instanceof HTMLElement ? existingActions : actionsCell;
  }
  return null;
}

export function LineChatNovncRecoveryAction({ sessionKey = "profile-b" }: { sessionKey?: "account-1" | "profile-b" }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshTarget = useCallback(() => {
    const nextTarget = findProfileActionsTarget(sessionKey);
    setTarget((current) => current === nextTarget ? current : nextTarget);
  }, [sessionKey]);

  useEffect(() => {
    const frame = requestAnimationFrame(refreshTarget);
    const timer = window.setInterval(refreshTarget, 1_000);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, [refreshTarget]);

  useEffect(() => {
    let cancelled = false;
    void api.lineChatOperationsHealth()
      .then((report) => {
        if (cancelled) return;
        const profile = report.sessions.find((session) => session.sessionKey === sessionKey);
        setHealthStatus(profile?.healthStatus ?? profile?.status ?? null);
      })
      .catch(() => {
        if (!cancelled) setHealthStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionKey]);

  const openRecovery = async () => {
    setOpening(true);
    setError(null);

    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;

    try {
      let response = await fetch(
        `/api-backend/operations/line-chat-nickname/sessions/${encodeURIComponent(sessionKey)}/manual-recovery/start`,
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
      const deadline = Date.now() + 150_000;
      while (result.pending && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        response = await fetch(
          `/api-backend/operations/line-chat-nickname/sessions/${encodeURIComponent(sessionKey)}/manual-recovery`,
          { credentials: "include", headers: { Accept: "application/json" } },
        );
        result = await response.json() as RecoveryStartResult;
        if (!response.ok) throw new Error(result.message || "Unable to check recovery status.");
      }
      if (result.pending) throw new Error("Recovery is still starting. Try again to reconnect to the pending session.");
      if (result.error) throw new Error(result.error);
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
        title={`Manual ${sessionKey} recovery. Waits for Mirror to yield, then holds exclusive profile ownership until recovery closes.`}
        onClick={(event) => {
          event.stopPropagation();
          void openRecovery();
        }}
      >
        {opening ? "Waiting for Mirror to yield…" : needsReconnect ? "Reconnect LINE" : "Open noVNC"}
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
