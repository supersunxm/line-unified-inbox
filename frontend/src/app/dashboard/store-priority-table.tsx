"use client";

import React from "react";
import { getSlaMultiplier, formatWaitingDuration } from "@/components/shell/store-priority-score";

export interface StorePriorityRow {
  id: string;
  name: string;
  notReplied: number;
  notifiedBm: number;
  replied: number;
  oldestWaitingMinutes?: number;
}

interface StorePriorityTableProps {
  stores: StorePriorityRow[];
  onOpenStore: (storeId: string) => void;
  maxRows?: number;
  language?: "th" | "en" | "zh";
  getStoreDisplayName?: (name: string) => string;
  isLoading?: boolean;
}

function getPriorityScore(row: StorePriorityRow): number {
  const waiting = row.notReplied > 0 ? (row.oldestWaitingMinutes ?? 0) : 0;
  return row.notReplied * getSlaMultiplier(waiting);
}

function getRankBadge(rank: number, score: number) {
  if (rank === 1 && score > 0) return { emoji: "🔥", className: "text-red-400 font-black" };
  if (rank === 2 && score > 0) return { emoji: "⚠️", className: "text-amber-400 font-bold" };
  if (rank === 3 && score > 0) return { emoji: "⚡", className: "text-yellow-400 font-semibold" };
  return { emoji: null, className: "text-[var(--muted)]" };
}

export function StorePriorityTable({
  stores,
  onOpenStore,
  maxRows = 10,
  language = "th",
  getStoreDisplayName,
  isLoading = false,
}: StorePriorityTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 py-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 animate-pulse">
            <div className="h-4 w-6 rounded bg-[var(--hover)]" />
            <div className="h-4 flex-1 rounded bg-[var(--hover)]" />
            <div className="h-4 w-12 rounded bg-[var(--hover)]" />
            <div className="h-4 w-16 rounded bg-[var(--hover)]" />
            <div className="h-7 w-16 rounded bg-[var(--hover)]" />
          </div>
        ))}
      </div>
    );
  }

  const sorted = [...stores]
    .map((s) => ({ ...s, score: getPriorityScore(s) }))
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      const aw = a.notReplied > 0 ? (a.oldestWaitingMinutes ?? 0) : 0;
      const bw = b.notReplied > 0 ? (b.oldestWaitingMinutes ?? 0) : 0;
      if (aw !== bw) return bw - aw;
      return b.notReplied - a.notReplied;
    })
    .slice(0, maxRows);

  if (sorted.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-[var(--muted)]">
        All stores are responding — no urgent issues
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="pb-3 pr-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">#</th>
            <th className="pb-3 pr-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Store</th>
            <th className="pb-3 pr-3 text-center text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Waiting</th>
            <th className="pb-3 pr-3 text-center text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Oldest</th>
            <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]/50">
          {sorted.map((store, index) => {
            const rank = index + 1;
            const waiting = store.notReplied > 0 ? (store.oldestWaitingMinutes ?? 0) : 0;
            const badge = getRankBadge(rank, store.score);
            const displayName = getStoreDisplayName ? getStoreDisplayName(store.name) : store.name;
            const shortName = displayName.replace(/\s+By\s+.+$/i, "").replace(/^OBS\s+/i, "");

            return (
              <tr
                key={store.id}
                className="group transition-colors hover:bg-[var(--hover)]"
              >
                <td className="py-3 pr-3">
                  <span className={`text-sm tabular-nums ${badge.className}`}>
                    {badge.emoji ? (
                      <span>{badge.emoji}</span>
                    ) : (
                      <span className="text-[var(--muted)]">{rank}</span>
                    )}
                  </span>
                </td>

                <td className="py-3 pr-3">
                  <div className="max-w-[200px]">
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]" title={displayName}>
                      {shortName}
                    </p>
                    <p className="text-xs text-[var(--muted)] tabular-nums">
                      Score: <span className="font-semibold text-[var(--foreground)]">{store.score}</span>
                    </p>
                  </div>
                </td>

                <td className="py-3 pr-3 text-center">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                      store.notReplied === 0
                        ? "bg-slate-700/30 text-[var(--muted)]"
                        : store.notReplied >= 20
                        ? "bg-red-500/15 text-red-400"
                        : store.notReplied >= 5
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-slate-700/30 text-[var(--foreground)]"
                    }`}
                  >
                    {store.notReplied}
                  </span>
                </td>

                <td className="py-3 pr-3 text-center">
                  {waiting > 0 ? (
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        waiting >= 120 ? "text-red-400 font-bold" : waiting >= 30 ? "text-amber-400" : "text-[var(--muted)]"
                      }`}
                    >
                      {formatWaitingDuration(waiting, language)}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">—</span>
                  )}
                </td>

                <td className="py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onOpenStore(store.id)}
                    aria-label={`Open store ${shortName}`}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition-colors hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    Open →
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

