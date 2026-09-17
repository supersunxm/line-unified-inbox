"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui";
import {
  api,
  type CandidateChatInfo,
  type MappingCandidatesResult,
  type UnresolvedMappingItem,
} from "@/lib/api";

interface LineChatManualMappingModalProps {
  item: UnresolvedMappingItem;
  onClose: () => void;
  onSuccess: (result: { conversationId: string; lineChatUserId: string; message: string }) => void;
}

export function LineChatManualMappingModal({
  item,
  onClose,
  onSuccess,
}: LineChatManualMappingModalProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [candidatesData, setCandidatesData] = useState<MappingCandidatesResult | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateChatInfo | null>(null);
  const [overrideConflict, setOverrideConflict] = useState(false);

  const loadCandidates = useCallback(
    async (search?: string) => {
      setError(null);
      try {
        const result = await api.lineChatMappingCandidates(item.conversationId, search);
        setCandidatesData(result);
        setSelectedCandidate(null);
        setOverrideConflict(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load LINE Chat candidates");
      } finally {
        setLoading(false);
      }
    },
    [item.conversationId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCandidates();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCandidates]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    void loadCandidates(searchQuery.trim() || undefined);
  };

  const handleConfirm = async () => {
    if (!selectedCandidate) return;
    if (selectedCandidate.conflict && !overrideConflict) {
      setError("Please confirm overriding the existing conflicting mapping.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await api.bindLineChatManualMapping(item.conversationId, {
        lineOfficialAccountId: item.lineOfficialAccountId,
        lineChatUserId: selectedCandidate.chatUserId,
        overrideConflict: Boolean(selectedCandidate.conflict) ? overrideConflict : false,
      });
      onSuccess({
        conversationId: item.conversationId,
        lineChatUserId: response.lineChatUserId,
        message: response.message,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save manual mapping");
      setSubmitting(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[var(--app-text)]">Manual LINE Chat Mapping</h2>
              <span className="rounded-md bg-[var(--app-surface-subtle)] px-2 py-0.5 text-xs font-mono text-[var(--app-text-secondary)]">
                {item.storeName} ({item.storeCode})
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--app-text-tertiary)]">
              Bind internal conversation to the verified LINE Chat identity for LINE OA:{" "}
              <span className="font-semibold text-[var(--app-text-secondary)]">
                {item.lineOaName || item.lineOfficialAccountName}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-xl leading-none text-[var(--app-text-tertiary)] hover:bg-[var(--app-surface-subtle)] hover:text-[var(--app-text)]"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 rounded-xl border border-[var(--app-danger)]/30 bg-[var(--app-danger-soft)] p-3 text-xs text-[var(--app-danger)]">
            {error}
          </div>
        )}

        {/* Content Body: Split Left (Internal) / Right (Candidates) */}
        <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-[var(--app-border)] overflow-y-auto lg:grid-cols-12 lg:divide-x lg:divide-y-0">
          {/* Left Column: Internal Conversation & Inbound Messages */}
          <div className="flex flex-col bg-[var(--app-surface-subtle)]/30 p-6 lg:col-span-5">
            <div className="mb-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-tertiary)]">
                Internal Conversation
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-base font-bold text-[var(--app-text)]">{item.customerDisplayName}</span>
                <span className="text-xs text-[var(--app-text-tertiary)]">
                  {formatTimestamp(item.latestChatTimestamp || item.latestMessageAt)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--app-text-secondary)]">
                <span className="rounded bg-[var(--app-surface)] px-1.5 py-0.5 text-[11px] font-mono border border-[var(--app-border)]">
                  ID: {item.conversationId.slice(0, 8)}...
                </span>
                {(item.salesStatus || item.customerSalesStatus) && (
                  <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[11px] font-medium text-blue-500">
                    {item.salesStatus || item.customerSalesStatus}
                  </span>
                )}
                {item.nicknameTarget && (
                  <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[11px] font-medium text-purple-500">
                    Target: {item.nicknameTarget}
                  </span>
                )}
              </div>
            </div>

            <div className="text-xs font-semibold text-[var(--app-text-secondary)] mb-2">
              Recent Message History:
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
              {loading ? (
                <div className="py-12 text-center text-xs text-[var(--app-text-tertiary)]">
                  Loading message history...
                </div>
              ) : (candidatesData?.conversation.recentMessages.length ?? 0) === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--app-text-tertiary)]">
                  No message history recorded yet.
                </div>
              ) : (
                candidatesData?.conversation.recentMessages.map((msg) => {
                  const isInbound = msg.direction === "INBOUND";
                  const isSystem = msg.direction === "SYSTEM";
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        isSystem
                          ? "items-center"
                          : isInbound
                          ? "items-start"
                          : "items-end"
                      }`}
                    >
                      <div
                        className={`max-w-[88%] rounded-xl px-3 py-2 text-xs ${
                          isSystem
                            ? "bg-transparent text-[var(--app-text-tertiary)] italic text-center"
                            : isInbound
                            ? "border border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[var(--app-text)]"
                            : "bg-[var(--app-accent)] text-white"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.text || "—"}</p>
                        <p
                          className={`mt-1 text-[10px] ${
                            isInbound
                              ? "text-[var(--app-text-tertiary)]"
                              : "text-white/70 text-right"
                          }`}
                        >
                          {isInbound ? "Inbound" : isSystem ? "System" : "Outbound"} ·{" "}
                          {formatTimestamp(msg.sentAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: LINE Chat Candidates */}
          <div className="flex w-7/12 flex-col p-5 overflow-hidden">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-tertiary)]">
                  LINE Chat Candidates (Same OA Only)
                </div>
                <div className="text-xs text-[var(--app-text-secondary)] mt-0.5">
                  Select the true customer chat from LINE Official Account Manager
                </div>
              </div>
              <span className="rounded-full bg-[var(--app-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--app-text-secondary)]">
                {candidatesData?.candidates.length ?? 0} candidates found
              </span>
            </div>

            {/* Controlled Search Bar */}
            <form onSubmit={handleSearchSubmit} className="mb-3 flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search LINE Chat customers in this OA by display name..."
                className="flex-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs outline-none focus:border-[var(--app-accent)]"
              />
              <Button type="submit" size="sm" variant="outline" disabled={loading}>
                Search OA
              </Button>
              {searchQuery && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSearchQuery("");
                    setLoading(true);
                    void loadCandidates("");
                  }}
                >
                  Reset
                </Button>
              )}
            </form>

            {/* Candidates List */}
            <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
              {loading ? (
                <div className="py-16 text-center text-xs text-[var(--app-text-tertiary)]">
                  Loading candidates from LINE Chat session...
                </div>
              ) : (candidatesData?.candidates.length ?? 0) === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--app-border)] p-8 text-center">
                  <p className="text-sm font-semibold text-[var(--app-text)]">No matching candidates found</p>
                  <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
                    Try searching with another keyword or part of the customer name above.
                  </p>
                </div>
              ) : (
                candidatesData?.candidates.map((candidate) => {
                  const isSelected = selectedCandidate?.chatUserId === candidate.chatUserId;
                  const hasConflict = Boolean(candidate.conflict);
                  return (
                    <div
                      key={candidate.chatUserId}
                      onClick={() => {
                        setSelectedCandidate(candidate);
                        if (!hasConflict) {
                          setOverrideConflict(false);
                        }
                      }}
                      className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                        isSelected
                          ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)]/20 shadow-sm"
                          : "border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--app-border-hover)] hover:bg-[var(--app-surface-subtle)]/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="radio"
                            name="candidate-selection"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedCandidate(candidate);
                              if (!hasConflict) {
                                setOverrideConflict(false);
                              }
                            }}
                            className="h-4 w-4 text-[var(--app-accent)] focus:ring-0"
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-sm text-[var(--app-text)] truncate block">
                              {candidate.displayName}
                            </span>
                            <span className="text-[11px] font-mono text-[var(--app-text-tertiary)]">
                              ID: {candidate.chatUserId}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5">
                          {hasConflict ? (
                            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-500">
                              CONFLICT
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              {candidate.confidence || "SAFE"}
                            </span>
                          )}
                          {candidate.lastMessageAt && (
                            <span className="text-[11px] text-[var(--app-text-tertiary)]">
                              {formatTimestamp(candidate.lastMessageAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Snippet */}
                      {candidate.lastMessageText && (
                        <div className="mt-2 rounded-lg bg-[var(--app-surface-subtle)] px-2.5 py-1.5 text-xs text-[var(--app-text-secondary)]">
                          <span className="font-medium text-[var(--app-text-tertiary)]">Last snippet: </span>
                          &ldquo;{candidate.lastMessageText}&rdquo;
                        </div>
                      )}

                      {/* Conflict details */}
                      {candidate.conflict && (
                        <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-600 dark:text-red-400">
                          <strong>Conflict warning:</strong> This LINE Chat identity is currently mapped to{" "}
                          <span className="font-semibold">
                            {candidate.conflict.conflictingCustomerName || candidate.conflict.conflictingConversationId}
                          </span>
                          . Confirming will overwrite the previous mapping.
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Confirmation and Actions Footer */}
        <div className="border-t border-[var(--app-border)] bg-[var(--app-surface)] p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs">
              {selectedCandidate ? (
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span>
                      Internal:{" "}
                      <strong className="text-[var(--app-text)]">{item.customerDisplayName}</strong>
                    </span>
                    <span>→</span>
                    <span>
                      LINE Chat:{" "}
                      <strong className="text-[var(--app-accent)]">
                        {selectedCandidate.displayName}
                      </strong>
                    </span>
                    <span>·</span>
                    <span className="text-[var(--app-text-secondary)]">
                      Store: <strong>{item.storeName}</strong>
                    </span>
                  </div>

                  {selectedCandidate.conflict && (
                    <label className="mt-1 flex items-center gap-2 font-medium text-red-600 dark:text-red-400">
                      <input
                        type="checkbox"
                        checked={overrideConflict}
                        onChange={(e) => setOverrideConflict(e.target.checked)}
                        className="rounded text-red-600"
                      />
                      Override existing conflict mapping for this LINE identity
                    </label>
                  )}
                </div>
              ) : (
                <span className="italic text-[var(--app-text-tertiary)]">
                  Select a LINE Chat candidate from the right panel to map.
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={
                  !selectedCandidate ||
                  (Boolean(selectedCandidate.conflict) && !overrideConflict) ||
                  submitting
                }
              >
                {submitting ? "Saving Mapping..." : "Confirm Mapping"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
