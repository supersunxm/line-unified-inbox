"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { api } from "@/lib/api";
import type { BmReplyStatusSummaryResponse, DashboardSummaryResponse, LineOfficialAccountResponse, StorePrioritySummaryResponse } from "@/types/api";
import { KpiCard } from "./kpi-card";
import { SlaDonut } from "./sla-donut";
import { StorePriorityTable } from "./store-priority-table";

type Language = "th" | "en" | "zh";

interface DashboardViewProps {
  language: Language;
  lineOas: LineOfficialAccountResponse[];
  dashboardSummary: DashboardSummaryResponse | null;
  bmSummaryData: BmReplyStatusSummaryResponse;
  getStoreDisplayName: (name: string) => string;
  onOpenStore: (storeId: string) => void;
  lastUpdatedAt: Date | null;
}

// ─── Derived helpers ─────────────────────────────────────────────────────────

function formatUpdatedAt(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function fmtNum(n: number): string {
  return n.toLocaleString();
}

// Build donut slices from store SLA data
function buildSlaSlices(stores: StorePrioritySummaryResponse["stores"]) {
  const counts = { s0: 0, s30: 0, s60: 0, s120: 0 };
  for (const s of stores) {
    if (s.notReplied === 0) continue;
    const m = s.oldestWaitingMinutes ?? 0;
    if (m < 30) counts.s0++;
    else if (m < 60) counts.s30++;
    else if (m < 120) counts.s60++;
    else counts.s120++;
  }
  return {
    slices: [
      { label: "< 30 min",  count: counts.s0,   color: "bg-emerald-500", strokeColor: "#10b981" },
      { label: "30–60 min", count: counts.s30,  color: "bg-amber-400",   strokeColor: "#fbbf24" },
      { label: "1–2 hours", count: counts.s60,  color: "bg-orange-500",  strokeColor: "#f97316" },
      { label: "> 2 hours", count: counts.s120, color: "bg-red-500",     strokeColor: "#ef4444" },
    ],
    total: counts.s0 + counts.s30 + counts.s60 + counts.s120,
    criticalCount: counts.s120,
  };
}

// Derive top/bottom 5 stores by response performance
function derivePerformanceLists(stores: StorePrioritySummaryResponse["stores"]) {
  const ranked = [...stores]
    .filter((s) => s.notReplied + s.notifiedBm + s.replied > 0)
    .map((s) => {
      const total = s.notReplied + s.notifiedBm + s.replied;
      const responseRate = total > 0 ? Math.round((s.replied / total) * 100) : 0;
      return { ...s, total, responseRate };
    });

  const top = [...ranked].sort((a, b) => b.responseRate - a.responseRate).slice(0, 5);
  const bottom = [...ranked].sort((a, b) => a.responseRate - b.responseRate).slice(0, 5);
  return { top, bottom };
}

// ─── Period selector ─────────────────────────────────────────────────────────

type Period = "live" | "7d" | "30d";
const PERIOD_LABELS: Record<Period, string> = { live: "Live", "7d": "7 Days", "30d": "30 Days" };

// ─── Dashboard View ──────────────────────────────────────────────────────────

export function DashboardView({
  language,
  lineOas,
  dashboardSummary,
  bmSummaryData,
  getStoreDisplayName,
  onOpenStore,
  lastUpdatedAt,
}: DashboardViewProps) {
  const [period, setPeriod] = useState<Period>("live");
  const [priorityData, setPriorityData] = useState<StorePrioritySummaryResponse | null>(null);
  const [priorityLoading, setPriorityLoading] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(60);
  const [lastPriorityFetchAt, setLastPriorityFetchAt] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());

  const loadPriorityData = useCallback(async () => {
    setPriorityLoading(true);
    try {
      const data = await api.storePrioritySummary();
      setPriorityData(data);
      setLastPriorityFetchAt(new Date());
      setFetchError(false);
    } catch {
      setFetchError(true);
    } finally {
      setPriorityLoading(false);
      setRefreshCountdown(60);
    }
  }, []);

  // Update `nowTimestamp` every 10s to dynamically evaluate stale threshold
  useEffect(() => {
    const timer = setInterval(() => setNowTimestamp(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  // Handle visibility change: refresh immediately when operator returns to tab after backgrounding
  useEffect(() => {
    let cancelled = false;

    async function fetchLatestData() {
      try {
        const data = await api.storePrioritySummary();
        if (!cancelled) {
          setPriorityData(data);
          setLastPriorityFetchAt(new Date());
          setFetchError(false);
          setPriorityLoading(false);
          setRefreshCountdown(60);
        }
      } catch {
        if (!cancelled) {
          setFetchError(true);
          setPriorityLoading(false);
        }
      }
    }

    void fetchLatestData();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchLatestData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    const interval = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          void fetchLatestData();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
    };
  }, []);



  // Data is considered stale if last successful fetch was over 3 minutes ago
  const effectiveLastUpdate = lastPriorityFetchAt ?? lastUpdatedAt;
  const dataAgeMs = effectiveLastUpdate ? nowTimestamp - effectiveLastUpdate.getTime() : 0;
  const isStaleData = Boolean(effectiveLastUpdate && dataAgeMs > 180_000);



  // ── KPI values ──────────────────────────────────────────────────────────────
  const totalWaiting = bmSummaryData.overview.notReplied;
  const totalNotifiedBm = bmSummaryData.overview.notifiedBm;
  const totalReplied = bmSummaryData.overview.replied;
  const totalConversations = totalWaiting + totalNotifiedBm + totalReplied;
  const slaRate = totalConversations > 0 ? Math.round((totalReplied / totalConversations) * 100) : 0;

  const activeLineOas = lineOas.filter((l) => l.isActive);
  const errorLineOas = lineOas.filter((l) => l.connectionStatus === "ERROR" || l.connectionStatus === "NOT_CONFIGURED");
  const messagesNow = lineOas.reduce((s, l) => s + l.messagesReceivedToday, 0);

  // ── SLA donut data ───────────────────────────────────────────────────────────
  const { slices: slaSlices, total: sliceTotal, criticalCount } = useMemo(
    () => buildSlaSlices(priorityData?.stores ?? []),
    [priorityData],
  );

  // ── Performance lists ────────────────────────────────────────────────────────
  const { top: topStores, bottom: bottomStores } = useMemo(
    () => derivePerformanceLists(priorityData?.stores ?? []),
    [priorityData],
  );

  const totalLineOaCount = lineOas.length;
  const activeCount = activeLineOas.length;

  const criticalLabel = language === "th" ? "ร้านรอเกิน 2 ชม." : "stores waiting > 2h";

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
            Operations Command Center
          </h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <span>{effectiveLastUpdate ? `Updated ${formatUpdatedAt(effectiveLastUpdate)}` : "Loading…"}</span>
            <span>·</span>
            <button
              type="button"
              onClick={() => void loadPriorityData()}
              className="inline-flex items-center gap-1 hover:text-[var(--foreground)] transition-colors"
              title="Click to refresh now"
            >
              {priorityLoading ? (
                <span className="animate-spin">🔄</span>
              ) : (
                <span>Auto-refresh in {refreshCountdown}s</span>
              )}
            </button>
            {fetchError && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 font-semibold text-red-400">
                ⚠️ Connection issue
              </span>
            )}
            {!fetchError && isStaleData && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-400">
                ⚠️ Data stale ({Math.floor(dataAgeMs / 60_000)}m ago)
              </span>
            )}
          </div>

        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
            {(["live", "7d", "30d"] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                  period === p
                    ? "bg-blue-600 text-white shadow"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="SLA Breached"
          value={fmtNum(criticalCount)}
          subtitle={criticalCount > 0 ? `${criticalCount} stores waiting > 2h` : "Zero breaches"}
          variant={criticalCount > 5 ? "critical" : criticalCount > 0 ? "warning" : "healthy"}
          icon={criticalCount > 0 ? "🔥" : "✅"}
        />
        <KpiCard
          label="Unanswered Chats"
          value={fmtNum(totalWaiting)}
          subtitle="Awaiting store response"
          variant={totalWaiting > 50 ? "critical" : totalWaiting > 10 ? "warning" : "healthy"}
          icon="⏳"
          onClick={() => onOpenStore("all")}
        />
        <KpiCard
          label="BM Escalated"
          value={fmtNum(totalNotifiedBm)}
          subtitle="Pending manager action"
          variant={totalNotifiedBm > 20 ? "warning" : "neutral"}
          icon="📣"
        />
        <KpiCard
          label="Response Rate"
          value={`${slaRate}%`}
          subtitle={`${fmtNum(totalReplied)} answered today`}
          variant={slaRate >= 90 ? "healthy" : slaRate >= 70 ? "warning" : "critical"}
          icon="✓"
        />
        <KpiCard
          label="Messages Today"
          value={fmtNum(messagesNow)}
          subtitle={`Across ${activeCount} active OAs`}
          variant="info"
          icon="💬"
        />
        <KpiCard
          label="LINE OA Health"
          value={`${activeCount}/${totalLineOaCount}`}
          subtitle={errorLineOas.length > 0 ? `${errorLineOas.length} connection errors` : "All accounts healthy"}
          variant={errorLineOas.length > 0 ? "critical" : "healthy"}
          icon="📡"
          href="/stores"
        />
      </div>


      {/* ── Operational Row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Store Priority Ranking — takes 2/3 width */}
        <div className="lg:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-lg">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-[var(--foreground)]">Store Priority Ranking</h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Sorted by: volume × SLA urgency score
              </p>
            </div>
            {priorityLoading && (
              <span className="text-xs text-[var(--muted)] animate-pulse">Loading…</span>
            )}
          </div>
          <StorePriorityTable
            stores={priorityData?.stores ?? []}
            onOpenStore={onOpenStore}
            maxRows={10}
            language={language}
            getStoreDisplayName={getStoreDisplayName}
            isLoading={priorityLoading}
          />
        </div>

        {/* SLA Distribution Donut — takes 1/3 width */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-lg">
          <div className="mb-5">
            <h2 className="font-semibold text-[var(--foreground)]">SLA Distribution</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Stores by oldest waiting time</p>
          </div>
          <SlaDonut
            slices={slaSlices}
            total={sliceTotal}
            criticalCount={criticalCount}
            criticalLabel={criticalLabel}
            isLoading={priorityLoading}
          />
        </div>
      </div>


      {/* ── Overview + Activity Row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Overview stats */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
          <h2 className="mb-5 font-semibold text-[var(--foreground)]">BM Response Overview</h2>
          <div className="space-y-4">
            {/* NOT_REPLIED bar */}
            {[
              { label: "Not Replied", value: totalWaiting, color: "bg-slate-500", max: totalConversations },
              { label: "BM Notified", value: totalNotifiedBm, color: "bg-purple-500", max: totalConversations },
              { label: "Replied", value: totalReplied, color: "bg-emerald-500", max: totalConversations },
            ].map(({ label, value, color, max }) => {
              const pct = max > 0 ? Math.round((value / max) * 100) : 0;
              return (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-[var(--muted)]">{label}</span>
                    <span className="font-semibold tabular-nums text-[var(--foreground)]">
                      {fmtNum(value)} <span className="text-[var(--muted)]">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--hover)]">
                    <div
                      className={`h-2 rounded-full ${color} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Per-store BM breakdown top 5 */}
          {bmSummaryData.stores.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Top waiting stores
              </p>
              <div className="space-y-1.5">
                {[...bmSummaryData.stores]
                  .filter((s) => s.notReplied > 0)
                  .sort((a, b) => (b.oldestWaitingMinutes ?? 0) - (a.oldestWaitingMinutes ?? 0))
                  .slice(0, 5)
                  .map((store) => (
                    <button
                      key={store.storeId}
                      type="button"
                      onClick={() => onOpenStore(store.storeId)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-[var(--hover)] transition-colors"
                    >
                      <span className="truncate font-medium text-[var(--foreground)]">
                        {getStoreDisplayName(store.storeName)}
                      </span>
                      <div className="ml-2 flex shrink-0 items-center gap-1.5">
                        <span className="rounded-full bg-slate-700/50 px-2 py-0.5 font-semibold tabular-nums text-[var(--foreground)]">
                          {store.notReplied}
                        </span>
                        {(store.oldestWaitingMinutes ?? 0) > 0 && (
                          <span className={`text-xs font-semibold ${
                            (store.oldestWaitingMinutes ?? 0) >= 120 ? "text-red-400" : "text-amber-400"
                          }`}>
                            {store.oldestWaitingMinutes}m
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Store Performance */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
          <h2 className="mb-5 font-semibold text-[var(--foreground)]">Store Performance</h2>

          {/* Best performers */}
          <div className="mb-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-emerald-500">
              ✓ Top Performing
            </p>
            <div className="space-y-2">
              {topStores.map((store, i) => (
                <button
                  key={store.id}
                  type="button"
                  onClick={() => onOpenStore(store.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs hover:bg-[var(--hover)] transition-colors"
                >
                  <span className="w-5 text-center font-bold text-emerald-500">{i + 1}</span>
                  <span className="flex-1 truncate font-medium text-[var(--foreground)]">
                    {getStoreDisplayName(store.name).replace(/^OBS\s+/i, "").replace(/\s+By\s+.+$/i, "")}
                  </span>
                  <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-400">
                    {store.responseRate}%
                  </span>
                </button>
              ))}
              {topStores.length === 0 && (
                <p className="text-xs text-[var(--muted)]">No data available</p>
              )}
            </div>
          </div>

          <div className="border-t border-[var(--border)] pt-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-red-400">
              ⚠ Needs Attention
            </p>
            <div className="space-y-2">
              {bottomStores
                .filter((s) => s.responseRate < 100)
                .map((store, i) => (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => onOpenStore(store.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs hover:bg-[var(--hover)] transition-colors"
                  >
                    <span className="w-5 text-center font-bold text-red-400">{i + 1}</span>
                    <span className="flex-1 truncate font-medium text-[var(--foreground)]">
                      {getStoreDisplayName(store.name).replace(/^OBS\s+/i, "").replace(/\s+By\s+.+$/i, "")}
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${
                      store.responseRate < 50
                        ? "bg-red-500/10 text-red-400"
                        : "bg-amber-500/10 text-amber-400"
                    }`}>
                      {store.responseRate}%
                    </span>
                  </button>
                ))}
              {bottomStores.filter((s) => s.responseRate < 100).length === 0 && (
                <p className="text-xs text-emerald-400">All stores at 100% response rate 🎉</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Customer Demand Row ─────────────────────────────────────────────── */}
      {dashboardSummary && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
          <h2 className="mb-5 font-semibold text-[var(--foreground)]">Customer Demand</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

            {/* Top products */}
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Top Discussed Products
              </p>
              <div className="space-y-3">
                {(dashboardSummary.mostDiscussedProductModels as Array<{ productModel: { name: string } | null; count: number }>)
                  .filter((item) => item.productModel)
                  .slice(0, 6)
                  .map(({ productModel, count }, i) => {
                    const total = dashboardSummary.totalConversations || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={i}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="font-medium text-[var(--foreground)]">{productModel!.name}</span>
                          <span className="text-[var(--muted)]">{count} · {pct}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[var(--hover)]">
                          <div
                            className="h-1.5 rounded-full bg-blue-500 transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                {(dashboardSummary.mostDiscussedProductModels as unknown[]).length === 0 && (
                  <p className="text-xs text-[var(--muted)]">No product data yet</p>
                )}
              </div>
            </div>

            {/* Top topics */}
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Conversation Topics
              </p>
              <div className="space-y-2">
                {(dashboardSummary.topConversationTopics as Array<{ topic: { name: string } | null; count: number }>)
                  .filter((item) => item.topic)
                  .slice(0, 6)
                  .map(({ topic, count }, i) => {
                    const total = dashboardSummary.totalConversations || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-[var(--surface-elevated)] px-3 py-2 text-xs">
                        <span className="font-medium text-[var(--foreground)]">{topic!.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--muted)]">{count}</span>
                          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 font-semibold text-blue-400">
                            {pct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                {(dashboardSummary.topConversationTopics as unknown[]).length === 0 && (
                  <p className="text-xs text-[var(--muted)]">No topic data yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer note ──────────────────────────────────────────────────────── */}
      <p className="pb-4 text-center text-xs text-[var(--muted)]">
        SLA score = unanswered customers x urgency multiplier (x1/x2/x4/x8/x16) &middot; Auto-refreshes every 60s
      </p>
    </div>
  );
}
