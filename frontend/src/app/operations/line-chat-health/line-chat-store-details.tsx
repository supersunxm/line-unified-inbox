"use client";

import { useEffect, useRef } from "react";
import { Badge, Button, Modal } from "@/components/ui";
import { getLineChatUiHealth } from "./line-chat-health-status";
import type { StoreRow } from "./line-chat-store-readiness-model";

const date = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "Not available";

export function LineChatStoreDetails({
  row,
  auditGeneratedAt,
  onClose,
  onSession,
  onMapping,
}: {
  row: StoreRow;
  auditGeneratedAt: string;
  onClose: () => void;
  onSession: (key: string) => void;
  onMapping: () => void;
}) {
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dialog = content.current?.closest<HTMLElement>('[role="dialog"]');
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]',
        ) ?? [],
      );
    focusable()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    dialog?.addEventListener("keydown", trap);
    return () => {
      dialog?.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, []);

  const { store, session, health } = row;
  const sessionHealth = session
    ? getLineChatUiHealth({ kind: "session", session })
    : null;
  const fields = [
    ["Store name", store.storeName],
    ["Store code", store.storeCode || "Not assigned"],
    ["LINE OA", store.lineOfficialAccountName],
    [
      "Assigned profile / session",
      session
        ? `${session.displayName} · ${session.sessionKey}${session.liveMirror?.profile ? ` · Profile ${session.liveMirror.profile}` : ""}`
        : (store.sessionKey ?? "Not assigned"),
    ],
    ["Session status", sessionHealth?.label ?? "Unknown"],
    ["OA health (technical)", store.oaHealthStatus],
    [
      "Chat bot ID",
      store.hasChatBotId
        ? "Configured · ID is not included in the health report"
        : "Not configured",
    ],
    [
      "Mapped conversations",
      `${store.mappedConversations} / ${store.totalConversations}${row.coverage.percent !== null ? ` · ${row.coverage.percent}%` : " · Coverage unavailable"}`,
    ],
    [
      "Pilot state",
      store.currentlyPilotEligible
        ? "Currently pilot eligible"
        : "Not currently pilot eligible",
    ],
    ["Last checked (assigned session)", date(row.lastChecked)],
    ["Store audit generated", date(auditGeneratedAt)],
  ];
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Store Details"
      description={`${store.storeName} · ${store.storeCode || "No store code"}`}
      maxWidth="2xl"
    >
      <div ref={content} className="space-y-4">
        <div className="space-y-2 rounded-lg border border-[var(--app-border)] p-3">
          <Badge variant={health.tone} dot>
            {health.label}
          </Badge>
          <p className="leading-relaxed">{health.reason}</p>
          <p className="leading-relaxed text-[var(--app-text-secondary)]">
            {health.recommendedAction}
          </p>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[var(--app-text-tertiary)]">{label}</dt>
              <dd className="mt-1 break-words font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="space-y-2 border-t border-[var(--app-border)] pt-3">
          <h4 className="font-semibold">Technical blockers</h4>
          {store.blockers.length ? (
            <ul className="list-inside list-disc space-y-1 break-words font-mono text-[var(--app-text-secondary)]">
              {store.blockers.map((blocker, index) => (
                <li key={`${blocker}-${index}`}>{blocker}</li>
              ))}
            </ul>
          ) : (
            <p className="text-[var(--app-text-secondary)]">None reported.</p>
          )}
          <p className="break-words text-[var(--app-text-tertiary)]">
            Readiness: {store.status} · Session:{" "}
            {store.sessionStatus ?? "UNKNOWN"} /{" "}
            {store.sessionHealthStatus ?? "UNKNOWN"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-[var(--app-border)] pt-3">
          {health.status === "NEED_SETUP" && (
            <a
              href="/storemanagement"
              className="rounded-lg border border-[var(--app-border)] px-3 py-2 font-medium text-[var(--app-accent)]"
            >
              Open store / OA setup
            </a>
          )}
          {store.sessionKey && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onClose();
                onSession(store.sessionKey!);
              }}
            >
              Go to session controls
            </Button>
          )}
          {store.mappedConversations < store.totalConversations && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onClose();
                onMapping();
              }}
            >
              Review mapping backlog
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
