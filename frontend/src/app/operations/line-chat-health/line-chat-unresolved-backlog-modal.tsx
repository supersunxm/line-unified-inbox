"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui";
import {
  api,
  type UnresolvedMappingItem,
  type UnresolvedMappingReason,
} from "@/lib/api";
import { LineChatManualMappingModal } from "./line-chat-manual-mapping-modal";

interface LineChatUnresolvedBacklogModalProps {
  onClose: () => void;
  onMappingSuccess: () => void;
}

export function LineChatUnresolvedBacklogModal({
  onClose,
  onMappingSuccess,
}: LineChatUnresolvedBacklogModalProps) {
  const [items, setItems] = useState<UnresolvedMappingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [filterQuery, setFilterQuery] = useState("");
  const [filterReason, setFilterReason] = useState<string>("ALL");

  const [activeMappingItem, setActiveMappingItem] = useState<UnresolvedMappingItem | null>(null);

  const loadBacklog = useCallback(async () => {
    setError(null);
    try {
      const result = await api.lineChatUnresolvedBacklog();
      setItems(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load unresolved mapping backlog");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBacklog();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBacklog]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterReason !== "ALL" && item.mappingReason !== filterReason) {
        return false;
      }
      if (!filterQuery) return true;
      const q = filterQuery.toLowerCase();
      return (
        item.customerDisplayName.toLowerCase().includes(q) ||
        item.storeName.toLowerCase().includes(q) ||
        item.storeCode.toLowerCase().includes(q) ||
        item.lineOaName.toLowerCase().includes(q) ||
        item.conversationId.toLowerCase().includes(q) ||
        (item.latestInboundPreview && item.latestInboundPreview.toLowerCase().includes(q))
      );
    });
  }, [items, filterQuery, filterReason]);

  const handleManualMappingSuccess = (result: {
    conversationId: string;
    lineChatUserId: string;
    message: string;
  }) => {
    setNotice(
      `Successfully mapped conversation ${result.conversationId.slice(0, 8)} to LINE identity ${result.lineChatUserId}!`,
    );
    setActiveMappingItem(null);
    setLoading(true);
    void loadBacklog();
    onMappingSuccess();
  };

  const getReasonBadge = (reason: UnresolvedMappingReason) => {
    switch (reason) {
      case "RESOLVE_AMBIGUOUS":
        return (
          <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
            RESOLVE_AMBIGUOUS
          </span>
        );
      case "RESOLVE_CONFLICT":
        return (
          <span className="inline-flex items-center rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
            RESOLVE_CONFLICT
          </span>
        );
      case "RESOLVE_NO_MATCH":
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            RESOLVE_NO_MATCH
          </span>
        );
    }
  };

  const formatTimestamp = (isoString?: string | null) => {
    if (!isoString) return "—";
    try {
      const d = new Date(isoString);
      return d.toLocaleString("th-TH", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <div className="flex h-[90vh] w-full max-w-6xl flex-col rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--app-border)] px-6 py-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-[var(--app-text)]">
                  Nickname Mapping Backlog — Waiting for Mapping
                </h2>
                <span className="rounded-full bg-[var(--app-accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--app-accent)]">
                  {items.length} waiting
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
                Unresolved conversations without a durable LINE Chat identity. Manual mapping links
                them directly to LINE OA Manager.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setLoading(true);
                  void loadBacklog();
                }}
                disabled={loading}
              >
                Refresh
              </Button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-xl leading-none text-[var(--app-text-tertiary)] hover:bg-[var(--app-surface-subtle)] hover:text-[var(--app-text)]"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Notices & Alerts */}
          {notice && (
            <div className="mx-6 mt-4 rounded-xl border border-[var(--app-success)]/30 bg-[var(--app-success-soft)] p-3 text-xs text-[var(--app-success)] flex items-center justify-between">
              <span>{notice}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="font-bold hover:underline"
              >
                ✕
              </button>
            </div>
          )}
          {error && (
            <div className="mx-6 mt-4 rounded-xl border border-[var(--app-danger)]/30 bg-[var(--app-danger-soft)] p-3 text-xs text-[var(--app-danger)]">
              {error}
            </div>
          )}

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-border)] bg-[var(--app-surface-subtle)]/30 px-6 py-3">
            <div className="flex flex-1 items-center gap-3">
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter by customer, store, conversation ID, or message text..."
                className="max-w-md flex-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-xs outline-none focus:border-[var(--app-accent)]"
              />
              <select
                value={filterReason}
                onChange={(e) => setFilterReason(e.target.value)}
                className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-xs font-medium text-[var(--app-text)] outline-none"
              >
                <option value="ALL">All Mapping Reasons</option>
                <option value="RESOLVE_AMBIGUOUS">RESOLVE_AMBIGUOUS</option>
                <option value="RESOLVE_NO_MATCH">RESOLVE_NO_MATCH</option>
                <option value="RESOLVE_CONFLICT">RESOLVE_CONFLICT</option>
              </select>
            </div>
            <div className="text-xs text-[var(--app-text-tertiary)]">
              Showing {filteredItems.length} of {items.length} items
            </div>
          </div>

          {/* Table / List */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {loading && items.length === 0 ? (
              <div className="py-20 text-center text-sm text-[var(--app-text-tertiary)]">
                Loading backlog items...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--app-border)] p-12 text-center">
                <p className="text-base font-semibold text-[var(--app-text)]">
                  {items.length === 0 ? "All conversations are mapped and ready!" : "No items match filter"}
                </p>
                <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
                  {items.length === 0
                    ? "No pending conversations currently blocked waiting for LINE Chat identity resolution."
                    : "Try adjusting your search query or mapping reason filter."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => (
                  <div
                    key={item.conversationId}
                    className="flex flex-col gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm transition hover:border-[var(--app-border-hover)] sm:flex-row sm:items-center sm:justify-between"
                  >
                    {/* Customer & Info */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold text-[var(--app-text)]">
                          {item.customerDisplayName}
                        </span>
                        {getReasonBadge(item.mappingReason)}
                        {item.matchedCount > 1 && (
                          <span className="rounded bg-[var(--app-surface-subtle)] px-2 py-0.5 text-[11px] text-[var(--app-text-secondary)]">
                            {item.matchedCount} name matches
                          </span>
                        )}
                        <span className="rounded bg-[var(--app-surface-subtle)] px-1.5 py-0.5 text-[11px] font-mono text-[var(--app-text-tertiary)]">
                          ID: {item.conversationId.slice(0, 8)}...
                        </span>
                      </div>

                      {/* Store / OA info */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--app-text-secondary)]">
                        <span>
                          Store:{" "}
                          <strong className="text-[var(--app-text)]">
                            {item.storeName} ({item.storeCode})
                          </strong>
                        </span>
                        <span>·</span>
                        <span>
                          LINE OA: <strong>{item.lineOaName}</strong>
                        </span>
                        <span>·</span>
                        <span>Latest chat: {formatTimestamp(item.latestChatTimestamp)}</span>
                      </div>

                      {/* Message preview */}
                      {item.latestInboundPreview && (
                        <div className="rounded-lg bg-[var(--app-surface-subtle)]/60 px-3 py-1.5 text-xs text-[var(--app-text-secondary)]">
                          <span className="font-semibold text-[var(--app-text-tertiary)]">Latest inbound: </span>
                          &ldquo;{item.latestInboundPreview}&rdquo;
                        </div>
                      )}

                      {/* Status / Tagging tags */}
                      <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px]">
                        {item.salesStatus && (
                          <span className="rounded bg-blue-500/10 px-2 py-0.5 font-medium text-blue-500">
                            Status: {item.salesStatus}
                          </span>
                        )}
                        {item.nicknameTarget && (
                          <span className="rounded bg-purple-500/10 px-2 py-0.5 font-medium text-purple-500">
                            Target: {item.nicknameTarget}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex shrink-0 items-center gap-2 pt-2 sm:pt-0">
                      <a
                        href={`/chats?conversationId=${encodeURIComponent(item.conversationId)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs font-semibold text-[var(--app-text)] hover:bg-[var(--app-surface-subtle)]"
                      >
                        Open internal chat ↗
                      </a>
                      <Button
                        size="sm"
                        onClick={() => setActiveMappingItem(item)}
                        className="bg-[var(--app-accent)] font-semibold text-white"
                      >
                        Manual Mapping
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--app-border)] bg-[var(--app-surface)] px-6 py-3 flex items-center justify-between text-xs text-[var(--app-text-tertiary)]">
            <span>
              Manual mappings take precedence over fuzzy name resolution and are stored durably on the
              conversation.
            </span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>

      {/* Manual Mapping Modal Child */}
      {activeMappingItem && (
        <LineChatManualMappingModal
          item={activeMappingItem}
          onClose={() => setActiveMappingItem(null)}
          onSuccess={handleManualMappingSuccess}
        />
      )}
    </>
  );
}
