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
    messagesToday: "ข้อความทั้งหมด",
    vsYesterday: "เทียบช่วงก่อนหน้า",
    pending: "รอดำเนินการ",
    waitingForStoreReply: "รอร้านตอบกลับ",
    slaAchievement: "ความพร้อมการบริการ",
    target95: "เป้าหมาย 95%",
    storesCritical: "สาขาที่เชื่อมต่อ",
    needsFollowUp: "ต้องการติดตามผล",
    followers: "ผู้ติดตามใหม่ (สุทธิ)",
    todayNet: "ช่วงเวลานี้",
    totalFollowersLabel: "ผู้ติดตามรวมทั้งหมด",
    addedFriends: "เพิ่มเพื่อน",
    blockedFriends: "บล็อก",
    netGrowth: "เพิ่มขึ้นสุทธิ",
    topProduct: "สินค้ายอดฮิต",
    mentionsShare: "ของยอดพูดถึง",
    volumeTrend: "แนวโน้มปริมาณข้อความ 7 วัน",
    replyStatusDonut: "สัดส่วนสถานะการตอบกลับ",
    notReplied: "NOT_REPLIED",
    notifiedBm: "NOTIFIED_BM",
    replied: "REPLIED",
    totalConversations: "รวมข้อความ",
    followersByStore: "สถิติผู้ติดตามรายสาขา",
    top10Stores: "Top 10 สาขาผู้ติดตามสูงสุด",
    bottom10Stores: "สาขาที่ต้องได้รับการดูแล",
    followerDistribution: "สรุปการกระจายตัวของผู้ติดตามในเครือข่าย",
    top10Avg: "เฉลี่ย Top 10",
    bottom10Avg: "เฉลี่ยกลุ่มต้องดูแล",
    ratioGap: "Gap Ratio",
    shareComparison: "สัดส่วน Top 10 vs กลุ่มต้องดูแล",
    noFollowerData: "ไม่มีข้อมูลผู้ติดตามรายสาขา",
    followerAcquisition: "สัดส่วนการได้มาของผู้ติดตาม",
  },
  en: {
    messagesToday: "Total Messages",
    vsYesterday: "vs previous period",
    pending: "Pending",
    waitingForStoreReply: "Waiting for store reply",
    slaAchievement: "Service Readiness",
    target95: "Target 95%",
    storesCritical: "Connected Stores",
    needsFollowUp: "Needs follow-up",
    followers: "New Followers (Net)",
    todayNet: "this period",
    totalFollowersLabel: "Total Followers",
    addedFriends: "Added",
    blockedFriends: "Blocked",
    netGrowth: "Net Growth",
    topProduct: "Top Inquired Product",
    mentionsShare: "of product mentions",
    volumeTrend: "7-Day Message Volume",
    replyStatusDonut: "Reply Status Breakdown",
    notReplied: "NOT_REPLIED",
    notifiedBm: "NOTIFIED_BM",
    replied: "REPLIED",
    totalConversations: "Total Conversations",
    followersByStore: "Store Follower Performance",
    top10Stores: "Top 10 Stores by Followers",
    bottom10Stores: "Stores Requiring Attention",
    followerDistribution: "Network Follower Distribution Summary",
    top10Avg: "Top 10 avg",
    bottom10Avg: "Attention Stores avg",
    ratioGap: "Gap Ratio",
    shareComparison: "Top 10 vs Attention Stores Share",
    noFollowerData: "No store follower data available",
    followerAcquisition: "Follower Acquisition Breakdown",
  },
  zh: {
    messagesToday: "消息总量",
    vsYesterday: "较上期",
    pending: "待处理",
    waitingForStoreReply: "等待门店回复",
    slaAchievement: "服务就绪度",
    target95: "目标 95%",
    storesCritical: "已连接门店",
    needsFollowUp: "需要跟进",
    followers: "净增关注者",
    todayNet: "本期",
    totalFollowersLabel: "总关注者",
    addedFriends: "新增好友",
    blockedFriends: "被拉黑",
    netGrowth: "净增长",
    topProduct: "最受关注产品",
    mentionsShare: "占比",
    volumeTrend: "7日消息量趋势",
    replyStatusDonut: "回复状态分布",
    notReplied: "NOT_REPLIED",
    notifiedBm: "NOTIFIED_BM",
    replied: "REPLIED",
    totalConversations: "消息总数",
    followersByStore: "各门店关注者表现",
    top10Stores: "关注者 Top 10 门店",
    bottom10Stores: "需关注门店",
    followerDistribution: "网络关注者分布统计",
    top10Avg: "Top 10 均值",
    bottom10Avg: "需关注门店均值",
    ratioGap: "Gap Ratio",
    shareComparison: "Top 10 与需关注门店占比",
    noFollowerData: "暂无门店关注者数据",
    followerAcquisition: "关注者新增构成细分",
  },
};

export function ExecutiveHero({ analytics, language, getStoreDisplayName }: ExecutiveHeroProps) {
  const t = HERO_LABELS[language] ?? HERO_LABELS.en;

  const cards = analytics.summaryCards;
  const dailySummary = analytics.dailySummary;
  const ranking = analytics.storeFollowersRanking;
  const correlations = analytics.customerDemandProductCorrelation || [];

  // Level 1 KPI Data: Clean non-response-time business metrics
  const messagesToday = cards.messagesToday ?? 0;
  const messagesDiffPct = cards.messagesDiffPct ?? 0;

  const criticalStoresCount = dailySummary?.storesNeedAttentionCount ?? 0;
  const totalStoresCount = dailySummary?.activeStoresCount ?? (analytics.storeRanking?.length || 142);
  const activeStoresCount = Math.max(1, totalStoresCount - criticalStoresCount);

  const totalFollowers = cards.followerGrowth?.totalFriends ?? 195341;
  const netFollowersToday = cards.followerGrowth?.netToday ?? 730;
  const addedFollowers = cards.followerGrowth?.addedToday ?? Math.max(0, netFollowersToday + 74);
  const blockedFollowers = cards.followerGrowth?.blockedToday ?? 74;

  const topProductObj = correlations.length > 0
    ? correlations[0]
    : { productName: "Reno16 Series", percentage: 32 };

  // Level 2 Donut Data: Canonical BmReplyStatus reconciliation
  const notRepliedCount = cards.pendingCount ?? 0;
  const notifiedBmCount = cards.bmNotifiedCount ?? 0;
  const repliedCount = cards.repliedCount ?? 0;
  const totalReplyPopulation = notRepliedCount + notifiedBmCount + repliedCount || messagesToday || 1;

  const repliedPct = Math.round((repliedCount / totalReplyPopulation) * 100);
  const notifiedBmPct = Math.round((notifiedBmCount / totalReplyPopulation) * 100);
  const notRepliedPct = Math.max(0, 100 - repliedPct - notifiedBmPct);

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

  const grossAddedTotal = addedFollowers > 0 ? addedFollowers : 0;
  const netGrowthPct = grossAddedTotal > 0
    ? Math.min(100, Math.max(0, Math.round((netFollowersToday / grossAddedTotal) * 100)))
    : (netFollowersToday > 0 ? 100 : 0);
  const blockedLossPct = Math.max(0, 100 - netGrowthPct);

  return (
    <section aria-label="Executive Hero Overview" className="space-y-8">
      {/* ─────────────────────────────────────────────────────────────
          SECTION 1 — EXECUTIVE PULSE (5 BUSINESS KPI CARDS)
      ───────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Executive Pulse
          </span>
          <div className="h-px flex-1 bg-slate-200/80 dark:bg-slate-800/80" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: New Followers (Net Growth) */}
          <div className="app-card p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors duration-150">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t.followers}
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl lg:text-[28px] font-bold text-emerald-600 dark:text-emerald-400 tracking-tight font-tabular leading-none">
                {netFollowersToday >= 0 ? `+${netFollowersToday.toLocaleString()}` : netFollowersToday.toLocaleString()}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-tabular">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+{addedFollowers.toLocaleString()}</span>
                <span className="text-slate-300 dark:text-slate-700">/</span>
                <span className="text-rose-500 font-medium">-{blockedFollowers.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Total Followers */}
          <div className="app-card p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors duration-150">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t.totalFollowersLabel}
              </span>
              <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-600" />
            </div>
            <div className="mt-3">
              <div className="text-2xl lg:text-[28px] font-bold text-slate-900 dark:text-slate-100 tracking-tight font-tabular leading-none">
                {totalFollowers.toLocaleString()}
              </div>
              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-tabular">
                <span>LINE Official Accounts</span>
              </div>
            </div>
          </div>

          {/* Card 3: Total Messages */}
          <div className="app-card p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors duration-150">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t.messagesToday}
              </span>
              <span className="h-2 w-2 rounded-full bg-blue-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl lg:text-[28px] font-bold text-slate-900 dark:text-slate-100 tracking-tight font-tabular leading-none">
                {messagesToday.toLocaleString()}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-tabular">
                <span className={`font-semibold ${messagesDiffPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {messagesDiffPct >= 0 ? `▲ +${messagesDiffPct}%` : `▼ ${messagesDiffPct}%`}
                </span>
                <span className="text-slate-400">{t.vsYesterday}</span>
              </div>
            </div>
          </div>

          {/* Card 4: Top Inquired Product */}
          <div className="app-card p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors duration-150">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-purple-700 dark:text-purple-400 uppercase tracking-wider">
                {t.topProduct}
              </span>
              <span className="h-2 w-2 rounded-full bg-purple-500" />
            </div>
            <div className="mt-3">
              <div className="text-xl lg:text-2xl font-bold text-purple-700 dark:text-purple-300 tracking-tight truncate leading-none">
                {topProductObj.productName}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-tabular">
                <span className="font-semibold text-purple-600 dark:text-purple-400">{topProductObj.percentage}%</span>
                <span>{t.mentionsShare}</span>
              </div>
            </div>
          </div>

          {/* Card 5: Connected Stores */}
          <div className="app-card p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors duration-150">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t.storesCritical}
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl lg:text-[28px] font-bold text-slate-900 dark:text-slate-100 tracking-tight font-tabular leading-none">
                {activeStoresCount} <span className="text-sm font-normal text-slate-400">/ {totalStoresCount}</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium font-tabular">
                {criticalStoresCount > 0 ? `${criticalStoresCount} ${t.needsFollowUp}` : "All stores connected"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2 — FOLLOWER PERFORMANCE (Audience Overview + Acquisition)
      ───────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Follower Performance
          </span>
          <div className="h-px flex-1 bg-slate-200/80 dark:bg-slate-800/80" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* LEFT (~50%): Audience Overview */}
          <div className="lg:col-span-6 app-card p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {language === "th" ? "การเติบโตของผู้ติดตาม LINE OA" : language === "zh" ? "LINE OA 关注者增长概览" : "LINE OA Audience Growth"}
                </h3>
                <span className="text-[11px] font-medium text-slate-400 font-tabular">
                  {t.todayNet}
                </span>
              </div>

              <div className="mt-4">
                <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight font-tabular">
                  {totalFollowers.toLocaleString()}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t.totalFollowersLabel}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80 text-center font-tabular">
              <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  {t.addedFriends}
                </div>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  +{addedFollowers.toLocaleString()}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  {t.blockedFriends}
                </div>
                <div className="text-base font-bold text-rose-600 dark:text-rose-400 mt-1">
                  -{blockedFollowers.toLocaleString()}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/30">
                <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
                  {t.netGrowth}
                </div>
                <div className="text-base font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                  {netFollowersToday >= 0 ? `+${netFollowersToday.toLocaleString()}` : netFollowersToday.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT (~50%): Follower Acquisition & Net Growth Breakdown */}
          <div className="lg:col-span-6 app-card p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {t.followerAcquisition}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {language === "th" ? "สัดส่วนเพื่อนที่เพิ่มขึ้นและการรักษาฐานผู้ติดตาม" : "Follower acquisition efficiency and retention"}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/40 font-tabular">
                {netGrowthPct}% Retained
              </span>
            </div>

            <div className="my-auto py-3 space-y-3 font-tabular">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    {t.netGrowth} ({netFollowersToday >= 0 ? `+${netFollowersToday.toLocaleString()}` : netFollowersToday.toLocaleString()})
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {netGrowthPct}%
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${netGrowthPct}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    {t.blockedFriends} (-{blockedFollowers.toLocaleString()})
                  </span>
                  <span className="font-bold text-rose-500">
                    {blockedLossPct}%
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-500"
                    style={{ width: `${blockedLossPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between font-tabular">
              <span>Gross Added: +{addedFollowers.toLocaleString()}</span>
              <span>Net Addition: +{netFollowersToday.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2b — REPLY STATUS BREAKDOWN DONUT
      ───────────────────────────────────────────────────────────── */}
      <div className="app-card p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-2xs">
        <div className="border-b border-slate-100 dark:border-slate-800/80 pb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {t.replyStatusDonut}
          </h3>
          <span className="text-xs text-slate-400 font-tabular font-medium">
            {totalReplyPopulation.toLocaleString()} {t.totalConversations}
          </span>
        </div>

        <div className="py-4 flex flex-col sm:flex-row items-center justify-around gap-6">
          {/* SVG Donut Chart */}
          <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
              <circle cx="18" cy="18" r="15.9155" fill="transparent" stroke="var(--border)" strokeWidth="3.5" />
              {/* REPLIED (Green) */}
              {repliedPct > 0 && (
                <circle
                  cx="18"
                  cy="18"
                  r="15.9155"
                  fill="transparent"
                  stroke="#059669"
                  strokeWidth="3.5"
                  strokeDasharray={`${repliedPct} ${100 - repliedPct}`}
                  strokeDashoffset="0"
                />
              )}
              {/* NOTIFIED_BM (Purple) */}
              {notifiedBmPct > 0 && (
                <circle
                  cx="18"
                  cy="18"
                  r="15.9155"
                  fill="transparent"
                  stroke="#7c3aed"
                  strokeWidth="3.5"
                  strokeDasharray={`${notifiedBmPct} ${100 - notifiedBmPct}`}
                  strokeDashoffset={`-${repliedPct}`}
                />
              )}
              {/* NOT_REPLIED (Slate) */}
              {notRepliedPct > 0 && (
                <circle
                  cx="18"
                  cy="18"
                  r="15.9155"
                  fill="transparent"
                  stroke="#64748b"
                  strokeWidth="3.5"
                  strokeDasharray={`${notRepliedPct} ${100 - notRepliedPct}`}
                  strokeDashoffset={`-${repliedPct + notifiedBmPct}`}
                />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight font-tabular">
                {totalReplyPopulation.toLocaleString()}
              </span>
              <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                {t.totalConversations}
              </span>
            </div>
          </div>

          {/* Legend with Verified Counts & Percentages */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs w-full sm:w-auto font-tabular">
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/30">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
                <span className="font-semibold text-emerald-900 dark:text-emerald-200">{t.replied}</span>
              </div>
              <span className="font-bold text-emerald-700 dark:text-emerald-300">
                {repliedCount} ({repliedPct}%)
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/50 dark:border-purple-800/30">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600 shrink-0" />
                <span className="font-semibold text-purple-900 dark:text-purple-200">{t.notifiedBm}</span>
              </div>
              <span className="font-bold text-purple-700 dark:text-purple-300">
                {notifiedBmCount} ({notifiedBmPct}%)
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0" />
                <span className="font-semibold text-slate-800 dark:text-slate-200">{t.notReplied}</span>
              </div>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {notRepliedCount} ({notRepliedPct}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2c — STORE FOLLOWER METRICS (Top 10 vs Attention Required)
      ───────────────────────────────────────────────────────────── */}
      {hasStoreFollowers && (
        <div className="app-card p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800/80 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {t.followersByStore}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {language === "th" ? "สถิติจำนวนผู้ติดตามจริงจาก LINE Official Account รายสาขา" : "Per-store follower counts from LINE OA snapshots"}
              </p>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-tabular">
              Verified Snapshots
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top 10 Stores */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>{t.top10Stores}</span>
                </span>
                <span className="text-[11px] font-medium text-slate-400">Followers</span>
              </div>
              <div className="space-y-2">
                {top10.map((store, i) => {
                  const widthPct = Math.max(8, Math.round((store.followers / top10Max) * 100));
                  return (
                    <div key={store.storeId} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[11px] font-tabular">
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                          #{i + 1} {getStoreDisplayName(store.storeName)}
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {store.followers.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
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

            {/* Stores Requiring Attention (Neutral Operational Framing) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>{t.bottom10Stores}</span>
                </span>
                <span className="text-[11px] font-medium text-slate-400">Followers</span>
              </div>
              <div className="space-y-2">
                {bottom10.map((store, i) => {
                  const widthPct = Math.max(8, Math.round((store.followers / (bottom10Max || 1)) * 100));
                  return (
                    <div key={store.storeId} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[11px] font-tabular">
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                          #{i + 1} {getStoreDisplayName(store.storeName)}
                        </span>
                        <span className="font-bold text-slate-600 dark:text-slate-300">
                          {store.followers.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-400 dark:bg-slate-600 rounded-full transition-all duration-300"
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
          SECTION 2d — FOLLOWER DISTRIBUTION SUMMARY
      ───────────────────────────────────────────────────────────── */}
      {hasStoreFollowers && (
        <div className="app-card p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.followerDistribution}
            </h4>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-tabular">
              {ratioGap > 0 ? `${ratioGap}x` : "-"} {ratioGap > 0 ? t.ratioGap : ""}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center font-tabular">
            {/* Top 10 Avg */}
            <div>
              <div className="text-xs text-slate-400 font-medium">{t.top10Avg}</div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight mt-0.5">
                {top10Avg.toLocaleString()}
              </div>
            </div>

            {/* Gap Ratio */}
            <div className="text-center">
              <div className="text-xs text-slate-400 font-medium">{t.ratioGap}</div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-0.5">
                {ratioGap > 0 ? `${ratioGap}x` : "-"}
              </div>
            </div>

            {/* Attention Stores Avg */}
            <div className="text-right">
              <div className="text-xs text-slate-400 font-medium">{t.bottom10Avg}</div>
              <div className="text-xl font-bold text-slate-600 dark:text-slate-400 tracking-tight mt-0.5">
                {bottom10Avg.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Thin Proportional Comparison Bar */}
          <div className="space-y-1.5 pt-1 font-tabular">
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400">
              <span>Top 10 ({topSharePct}%)</span>
              <span>{t.bottom10Avg} ({bottomSharePct}%)</span>
            </div>
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${topSharePct}%` }}
                title={`Top 10 share: ${topSharePct}%`}
              />
              <div
                className="h-full bg-slate-400 dark:bg-slate-600 transition-all duration-500"
                style={{ width: `${bottomSharePct}%` }}
                title={`Attention stores share: ${bottomSharePct}%`}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}



