"use client";

import React from "react";
import type { DashboardAnalyticsResponse } from "@/types/api";

export type Language = "th" | "en" | "zh";

interface ExecutiveHeroProps {
  analytics: DashboardAnalyticsResponse;
  language: Language;
  getStoreDisplayName: (name: string) => string;
}

export const HERO_LABELS = {
  th: {
    messagesToday: "ข้อความวันนี้",
    vsYesterday: "เทียบเมื่อวาน",
    pending: "รอดำเนินการ",
    waitingForStoreReply: "Waiting for store reply",
    slaAchievement: "SLA Achievement",
    target95: "Target 95%",
    storesCritical: "สาขาที่ต้องดูแล",
    needsFollowUp: "Needs follow-up",
    followers: "ผู้ติดตามรวม",
    todayNet: "วันนี้",
    volumeTrend: "7-Day Message Volume",
    replyStatusDonut: "Reply Status Breakdown",
    notReplied: "NOT_REPLIED",
    notifiedBm: "NOTIFIED_BM",
    replied: "REPLIED",
    totalConversations: "Total Conversations",
    followersByStore: "Followers by Store — Top 10 vs Bottom 10",
    top10Stores: "Top 10 Stores by Followers",
    bottom10Stores: "Bottom 10 Stores by Followers",
    followerDistribution: "Follower Distribution Summary",
    top10Avg: "Top 10 avg",
    bottom10Avg: "Bottom 10 avg",
    ratioGap: "Gap Ratio",
    shareComparison: "Top 10 vs Bottom 10 Share",
    noFollowerData: "ไม่มีข้อมูลผู้ติดตามรายสาขา",
  },
  en: {
    messagesToday: "Messages Today",
    vsYesterday: "vs yesterday",
    pending: "Pending",
    waitingForStoreReply: "Waiting for store reply",
    slaAchievement: "SLA Achievement",
    target95: "Target 95%",
    storesCritical: "Stores Critical",
    needsFollowUp: "Needs follow-up",
    followers: "Followers",
    todayNet: "today",
    volumeTrend: "7-Day Message Volume",
    replyStatusDonut: "Reply Status Breakdown",
    notReplied: "NOT_REPLIED",
    notifiedBm: "NOTIFIED_BM",
    replied: "REPLIED",
    totalConversations: "Total Conversations",
    followersByStore: "Followers by Store — Top 10 vs Bottom 10",
    top10Stores: "Top 10 Stores by Followers",
    bottom10Stores: "Bottom 10 Stores by Followers",
    followerDistribution: "Follower Distribution Summary",
    top10Avg: "Top 10 avg",
    bottom10Avg: "Bottom 10 avg",
    ratioGap: "Gap Ratio",
    shareComparison: "Top 10 vs Bottom 10 Share",
    noFollowerData: "No store follower data available",
  },
  zh: {
    messagesToday: "今日消息",
    vsYesterday: "较昨日",
    pending: "待处理",
    waitingForStoreReply: "Waiting for store reply",
    slaAchievement: "SLA Achievement",
    target95: "Target 95%",
    storesCritical: "风险关注门店",
    needsFollowUp: "Needs follow-up",
    followers: "总关注者",
    todayNet: "今日",
    volumeTrend: "7-Day Message Volume",
    replyStatusDonut: "Reply Status Breakdown",
    notReplied: "NOT_REPLIED",
    notifiedBm: "NOTIFIED_BM",
    replied: "REPLIED",
    totalConversations: "Total Conversations",
    followersByStore: "Followers by Store — Top 10 vs Bottom 10",
    top10Stores: "Top 10 Stores by Followers",
    bottom10Stores: "Bottom 10 Stores by Followers",
    followerDistribution: "Follower Distribution Summary",
    top10Avg: "Top 10 avg",
    bottom10Avg: "Bottom 10 avg",
    ratioGap: "Gap Ratio",
    shareComparison: "Top 10 vs Bottom 10 Share",
    noFollowerData: "暂无门店关注者数据",
  },
};

export function ExecutiveHero({ analytics, language, getStoreDisplayName }: ExecutiveHeroProps) {
  const t = HERO_LABELS[language] ?? HERO_LABELS.en;

  const cards = analytics.summaryCards;
  const dailySummary = analytics.dailySummary;
  const trend = analytics.trend7Days || [];
  const ranking = analytics.storeFollowersRanking;

  // Level 1 KPI Data
  const messagesToday = cards.messagesToday ?? 0;
  const messagesDiffPct = cards.messagesDiffPct ?? 0;
  const pendingCount = cards.pendingCount ?? 0;
  const slaAchievementRate = dailySummary?.slaAchievementRate ?? cards.responseRate24h ?? 0;
  const isSlaCritical = slaAchievementRate < 95;

  const criticalStoresCount = dailySummary?.storesNeedAttentionCount ?? 0;
  const totalStoresCount = dailySummary?.activeStoresCount ?? 0;

  const totalFollowers = cards.followerGrowth?.totalFriends ?? 0;
  const netFollowersToday = cards.followerGrowth?.netToday ?? 0;

  // Level 2 Donut Data: Canonical BmReplyStatus reconciliation
  const notRepliedCount = cards.pendingCount ?? 0;
  const notifiedBmCount = cards.bmNotifiedCount ?? 0;
  const repliedCount = cards.repliedCount ?? 0;
  const totalReplyPopulation = notRepliedCount + notifiedBmCount + repliedCount || messagesToday || 1;

  const repliedPct = Math.round((repliedCount / totalReplyPopulation) * 100);
  const notifiedBmPct = Math.round((notifiedBmCount / totalReplyPopulation) * 100);
  const notRepliedPct = Math.max(0, 100 - repliedPct - notifiedBmPct);

  // Level 2 Trend Data: 7 calendar days
  const maxTrend = Math.max(1, ...trend.map((d) => d.count));

  // Level 3 & 4 Followers by Store
  const hasStoreFollowers = Boolean(ranking && ranking.top10.length > 0);
  const top10 = ranking?.top10 ?? [];
  const bottom10 = ranking?.bottom10 ?? [];
  const top10Max = Math.max(1, ...top10.map((s) => s.followers));
  const bottom10Max = Math.max(1, ...bottom10.map((s) => s.followers));

  const top10Avg = ranking?.top10Average ?? 0;
  const bottom10Avg = ranking?.bottom10Average ?? 0;
  const ratioGap = ranking?.ratio ?? (bottom10Avg > 0 ? +(top10Avg / bottom10Avg).toFixed(1) : 0);
  const totalAvgSum = top10Avg + bottom10Avg || 1;
  const topSharePct = Math.round((top10Avg / totalAvgSum) * 100);
  const bottomSharePct = Math.max(0, 100 - topSharePct);

  return (
    <section aria-label="Executive Hero Overview" className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          LEVEL 1 — KPI ROW (Single row, 5 cards)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Messages Today */}
        <div className="app-card p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
              {t.messagesToday}
            </span>
            <span className="text-base" aria-hidden="true">💬</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[var(--foreground)] tracking-tight">
              {messagesToday.toLocaleString()}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs">
              <span className={`font-bold ${messagesDiffPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {messagesDiffPct >= 0 ? `+${messagesDiffPct}%` : `${messagesDiffPct}%`}
              </span>
              <span className="text-[var(--muted-foreground)]">{t.vsYesterday}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Pending */}
        <div className={`app-card p-4 rounded-xl border shadow-xs flex flex-col justify-between ${
          pendingCount > 0
            ? "border-rose-300 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20"
            : "border-[var(--border)] bg-[var(--surface)]"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
              {t.pending}
            </span>
            <span className="text-base" aria-hidden="true">⏳</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-700 dark:text-rose-400 tracking-tight">
              {pendingCount.toLocaleString()}
            </div>
            <div className="mt-1 text-xs font-medium text-rose-600/80 dark:text-rose-400/80">
              {t.waitingForStoreReply}
            </div>
          </div>
        </div>

        {/* Card 3: SLA Achievement */}
        <div className={`app-card p-4 rounded-xl border shadow-xs flex flex-col justify-between ${
          isSlaCritical
            ? "border-amber-300 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20"
            : "border-[var(--border)] bg-[var(--surface)]"
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${
              isSlaCritical ? "text-amber-700 dark:text-amber-400" : "text-[var(--muted-foreground)]"
            }`}>
              {t.slaAchievement}
            </span>
            <span className="text-base" aria-hidden="true">🎯</span>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-black tracking-tight ${
              isSlaCritical ? "text-amber-700 dark:text-amber-400" : "text-[var(--foreground)]"
            }`}>
              {slaAchievementRate}%
            </div>
            <div className={`mt-1 text-xs font-semibold ${
              isSlaCritical ? "text-amber-700 dark:text-amber-400" : "text-[var(--muted-foreground)]"
            }`}>
              {t.target95}
            </div>
          </div>
        </div>

        {/* Card 4: Stores Critical */}
        <div className="app-card p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
              {t.storesCritical}
            </span>
            <span className="text-base" aria-hidden="true">🏬</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[var(--foreground)] tracking-tight">
              {criticalStoresCount} <span className="text-base font-normal text-[var(--muted-foreground)]">/ {totalStoresCount}</span>
            </div>
            <div className="mt-1 text-xs text-[var(--muted-foreground)] font-medium">
              {t.needsFollowUp}
            </div>
          </div>
        </div>

        {/* Card 5: Followers */}
        <div className="app-card p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
              {t.followers}
            </span>
            <span className="text-base" aria-hidden="true">👥</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[var(--foreground)] tracking-tight">
              {totalFollowers.toLocaleString()}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span>{netFollowersToday >= 0 ? `+${netFollowersToday.toLocaleString()}` : netFollowersToday.toLocaleString()}</span>
              <span className="font-normal text-[var(--muted-foreground)]">{t.todayNet}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          LEVEL 2 — OPERATIONAL TREND (60% Trend / 40% Reply Status Donut)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* LEFT (~60%): 7-Day Message Volume */}
        <div className="lg:col-span-7 app-card p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                <span>📈</span>
                <span>{t.volumeTrend}</span>
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Exact 7 calendar-day message & reply history
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                <span className="text-[var(--foreground)]">Total</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <span className="text-[var(--foreground)]">Replied</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-end justify-between gap-2 h-44 px-2">
            {trend.map((item) => {
              const barHeightPct = Math.max(12, Math.round((item.count / maxTrend) * 100));
              const repliedHeightPct = item.count > 0 ? Math.round((item.replied / item.count) * 100) : 0;
              return (
                <div key={item.date} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <div className="text-[10px] font-bold text-[var(--muted-foreground)] opacity-70 group-hover:opacity-100 transition-opacity">
                    {item.count}
                  </div>
                  <div className="w-full max-w-[36px] bg-blue-500/20 dark:bg-blue-950/40 rounded-t-md relative overflow-hidden flex flex-col justify-end transition-all" style={{ height: `${barHeightPct}%` }}>
                    <div
                      className="w-full bg-emerald-500 transition-all duration-300 rounded-t-xs"
                      style={{ height: `${repliedHeightPct}%` }}
                      title={`${item.label}: ${item.replied} replied / ${item.count} total`}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-[var(--muted-foreground)] whitespace-nowrap">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT (~40%): Reply Status Donut */}
        <div className="lg:col-span-5 app-card p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col justify-between">
          <div className="border-b border-[var(--border)] pb-3">
            <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
              <span>🍩</span>
              <span>{t.replyStatusDonut}</span>
            </h3>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Canonical BM reply status reconciliation
            </p>
          </div>

          <div className="my-auto py-4 flex flex-col sm:flex-row items-center justify-around gap-6">
            {/* SVG Donut Chart */}
            <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                <circle cx="18" cy="18" r="15.9155" fill="transparent" stroke="var(--border)" strokeWidth="3.8" />
                {/* REPLIED (Green) */}
                {repliedPct > 0 && (
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9155"
                    fill="transparent"
                    stroke="#10b981"
                    strokeWidth="3.8"
                    strokeDasharray={`${repliedPct} ${100 - repliedPct}`}
                    strokeDashoffset="0"
                  />
                )}
                {/* NOTIFIED_BM (Purple/Amber) */}
                {notifiedBmPct > 0 && (
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9155"
                    fill="transparent"
                    stroke="#a855f7"
                    strokeWidth="3.8"
                    strokeDasharray={`${notifiedBmPct} ${100 - notifiedBmPct}`}
                    strokeDashoffset={`-${repliedPct}`}
                  />
                )}
                {/* NOT_REPLIED (Rose) */}
                {notRepliedPct > 0 && (
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9155"
                    fill="transparent"
                    stroke="#f43f5e"
                    strokeWidth="3.8"
                    strokeDasharray={`${notRepliedPct} ${100 - notRepliedPct}`}
                    strokeDashoffset={`-${repliedPct + notifiedBmPct}`}
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-extrabold text-[var(--foreground)] tracking-tight">
                  {totalReplyPopulation.toLocaleString()}
                </span>
                <span className="text-[9px] text-[var(--muted-foreground)] font-bold uppercase tracking-wider">
                  {t.totalConversations}
                </span>
              </div>
            </div>

            {/* Legend with Verified Counts & Percentages */}
            <div className="flex flex-col gap-3 text-xs w-full sm:w-auto">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-semibold text-[var(--foreground)]">{t.replied}</span>
                </div>
                <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {repliedCount} ({repliedPct}%)
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500 shrink-0" />
                  <span className="font-semibold text-[var(--foreground)]">{t.notifiedBm}</span>
                </div>
                <span className="font-black text-purple-600 dark:text-purple-400 tabular-nums">
                  {notifiedBmCount} ({notifiedBmPct}%)
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
                  <span className="font-semibold text-[var(--foreground)]">{t.notReplied}</span>
                </div>
                <span className="font-black text-rose-600 dark:text-rose-400 tabular-nums">
                  {notRepliedCount} ({notRepliedPct}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          LEVEL 3 — FOLLOWERS BY STORE (Top 10 vs Bottom 10)
      ───────────────────────────────────────────────────────────── */}
      {hasStoreFollowers && (
        <div className="app-card p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm space-y-5">
          <div className="border-b border-[var(--border)] pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                <span>🏬</span>
                <span>{t.followersByStore}</span>
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Real per-store follower counts from LINE OA snapshots
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
              Verified Snapshot Data
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top 10 Stores (Green Bars) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>{t.top10Stores}</span>
                </span>
                <span>Followers</span>
              </div>
              <div className="space-y-2">
                {top10.map((store, i) => {
                  const widthPct = Math.max(8, Math.round((store.followers / top10Max) * 100));
                  return (
                    <div key={store.storeId} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-[var(--foreground)] truncate max-w-[200px]">
                          #{i + 1} {getStoreDisplayName(store.storeName)}
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {store.followers.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom 10 Stores (Red Bars) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>{t.bottom10Stores}</span>
                </span>
                <span>Followers</span>
              </div>
              <div className="space-y-2">
                {bottom10.map((store, i) => {
                  const widthPct = Math.max(8, Math.round((store.followers / (bottom10Max || 1)) * 100));
                  return (
                    <div key={store.storeId} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-[var(--foreground)] truncate max-w-[200px]">
                          #{i + 1} {getStoreDisplayName(store.storeName)}
                        </span>
                        <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                          {store.followers.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500 rounded-full transition-all duration-300"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          LEVEL 4 — FOLLOWER DISTRIBUTION SUMMARY
      ───────────────────────────────────────────────────────────── */}
      {hasStoreFollowers && (
        <div className="app-card p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              {t.followerDistribution}
            </h4>
            <span className="text-xs font-black text-blue-600 dark:text-blue-400">
              {ratioGap}x gap
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            {/* Top 10 Avg */}
            <div>
              <div className="text-xs text-[var(--muted-foreground)] font-medium">{t.top10Avg}</div>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight mt-0.5">
                {top10Avg.toLocaleString()}
              </div>
            </div>

            {/* Gap Ratio */}
            <div className="text-center">
              <div className="text-xs text-[var(--muted-foreground)] font-medium">{t.ratioGap}</div>
              <div className="text-xl font-black text-[var(--foreground)] tracking-tight mt-0.5">
                {ratioGap > 0 ? `${ratioGap}x` : "-"}
              </div>
            </div>

            {/* Bottom 10 Avg */}
            <div className="text-right">
              <div className="text-xs text-[var(--muted-foreground)] font-medium">{t.bottom10Avg}</div>
              <div className="text-xl font-black text-rose-600 dark:text-rose-400 tracking-tight mt-0.5">
                {bottom10Avg.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Thin Proportional Comparison Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[10px] font-bold text-[var(--muted-foreground)]">
              <span>Top 10 ({topSharePct}%)</span>
              <span>Bottom 10 ({bottomSharePct}%)</span>
            </div>
            <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${topSharePct}%` }}
                title={`Top 10 share: ${topSharePct}%`}
              />
              <div
                className="h-full bg-rose-500 transition-all duration-500"
                style={{ width: `${bottomSharePct}%` }}
                title={`Bottom 10 share: ${bottomSharePct}%`}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
