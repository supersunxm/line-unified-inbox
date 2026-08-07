"use client";

import React from "react";
import type { PreparedExecutiveBriefProps } from "./dashboard-transformers";

interface AiExecutiveDailyBriefProps {
  data: PreparedExecutiveBriefProps;
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    title: "สรุปรายงานการปฏิบัติการสำหรับผู้บริหารประจำวัน (AI Executive Daily Brief)",
    subtitle: "รายงานสังเคราะห์สถานะโครงข่าย การประเมินความเสี่ยง และข้อเสนอแนะการตัดสินใจเชิงกลยุทธ์",
    todaySituation: "สถานการณ์วันนี้ (Today's Situation)",
    highlights: "ข้อสังเกตและประเด็นสำคัญ (Key Highlights)",
    criticalIssues: "ประเด็นวิกฤตที่ต้องได้รับการดูแล (Critical Operational Issues)",
    executiveDecisions: "ข้อเสนอแนะการตัดสินใจของผู้บริหาร (Executive Decisions)",
    messages: "ข้อความทั้งหมด",
    slaRate: "อัตราตอบ SLA",
    pending: "รอดำเนินการ",
    riskStores: "สาขาเสี่ยง",
    owner: "ผู้รับผิดชอบ (Owner)",
    deadline: "กำหนดเสร็จ (Deadline)",
    expectedImpact: "ผลลัพธ์ที่คาดการณ์ (Expected Impact)",
  },
  en: {
    title: "AI Executive Daily Brief",
    subtitle: "Daily operational briefing synthesizing network status, risk assessment & strategic decisions",
    todaySituation: "Today's Operational Situation",
    highlights: "Key Highlights",
    criticalIssues: "Critical Operational Issues",
    executiveDecisions: "Executive Decision Recommendations",
    messages: "Total Messages",
    slaRate: "SLA Rate",
    pending: "Pending",
    riskStores: "Stores at Risk",
    owner: "Owner",
    deadline: "Deadline",
    expectedImpact: "Expected Impact",
  },
  zh: {
    title: "高管每日简报 (AI Executive Daily Brief)",
    subtitle: "每日运营简报：综合网络状态、风险评估与战略决策建议",
    todaySituation: "今日运营概况",
    highlights: "核心亮点与观察",
    criticalIssues: "需要关注的严重问题",
    executiveDecisions: "高管决策建议",
    messages: "消息总数",
    slaRate: "SLA 达成率",
    pending: "待处理",
    riskStores: "风险门店",
    owner: "负责人",
    deadline: "截止时间",
    expectedImpact: "预期 ROI 效果",
  },
};

export function AiExecutiveDailyBrief({ data, language }: AiExecutiveDailyBriefProps) {
  const t = LABELS[language] ?? LABELS.en;
  const { date, overallStatus, headline, keyHighlights, criticalIssues, recommendedDecisions, metrics } = data;

  const statusBadge = overallStatus === "CRITICAL"
    ? "bg-rose-600 text-white border-rose-700"
    : overallStatus === "ATTENTION"
    ? "bg-amber-500 text-white border-amber-600"
    : "bg-emerald-600 text-white border-emerald-700";

  return (
    <section
      data-ai-executive-daily-brief
      className="rounded-2xl border-2 border-purple-500/40 bg-[var(--surface)] p-6 text-[var(--foreground)] shadow-md space-y-6"
    >
      {/* Brief Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 text-xs font-black rounded-lg bg-purple-600 text-white uppercase tracking-wider">
            EXECUTIVE BRIEF
          </span>
          <div>
            <h2 className="text-lg font-black tracking-tight text-[var(--foreground)] flex items-center gap-2">
              <span>🤖</span>
              <span>{t.title}</span>
            </h2>
            <p className="text-xs text-[var(--muted-foreground)] font-medium mt-0.5">
              {t.subtitle} • {date}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border shadow-xs ${statusBadge}`}>
            ● {overallStatus}
          </span>
        </div>
      </div>

      {/* Executive Headline Banner */}
      <div className="p-4 rounded-xl border-2 border-purple-500/30 bg-purple-500/10 space-y-2">
        <div className="text-xs font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
          <span>📢</span>
          <span>Executive Summary Headline</span>
        </div>
        <p className="text-sm font-black text-[var(--foreground)] leading-relaxed">
          &ldquo;{headline}&rdquo;
        </p>
      </div>

      {/* Today's Situation KPI Strip */}
      <div className="space-y-2">
        <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted-foreground)] flex items-center gap-1.5">
          <span>📊</span>
          <span>{t.todaySituation}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[var(--background)] p-3 rounded-xl border border-[var(--border)] text-center space-y-1">
            <div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase">{t.messages}</div>
            <div className="text-base font-black text-[var(--foreground)]">{metrics.totalMessages.toLocaleString()}</div>
          </div>

          <div className="bg-[var(--background)] p-3 rounded-xl border border-[var(--border)] text-center space-y-1">
            <div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase">{t.slaRate}</div>
            <div className={`text-base font-black ${metrics.slaRate < 80 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {metrics.slaRate}%
            </div>
          </div>

          <div className="bg-[var(--background)] p-3 rounded-xl border border-[var(--border)] text-center space-y-1">
            <div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase">{t.pending}</div>
            <div className={`text-base font-black ${metrics.pending > 5 ? "text-amber-600 dark:text-amber-400" : "text-[var(--foreground)]"}`}>
              {metrics.pending}
            </div>
          </div>

          <div className="bg-[var(--background)] p-3 rounded-xl border border-[var(--border)] text-center space-y-1">
            <div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase">{t.riskStores}</div>
            <div className={`text-base font-black ${metrics.riskStores > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {metrics.riskStores}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Key Highlights & Critical Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 📈 Key Highlights */}
        <div className="bg-[var(--background)] p-4 rounded-xl border border-[var(--border)] space-y-3">
          <div className="text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
            <span>📈</span>
            <span>{t.highlights}</span>
          </div>

          <ul className="space-y-2 text-xs font-semibold text-[var(--foreground)]">
            {keyHighlights.map((hl, i) => (
              <li key={i} className="flex items-start gap-2 bg-[var(--surface)] p-2.5 rounded-lg border border-[var(--border)]">
                <span className="text-blue-500 font-bold">•</span>
                <span className="leading-snug">{hl}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 🚨 Critical Operational Issues */}
        <div className="bg-[var(--background)] p-4 rounded-xl border border-[var(--border)] space-y-3">
          <div className="text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
            <span>🚨</span>
            <span>{t.criticalIssues}</span>
          </div>

          <div className="space-y-2">
            {criticalIssues.map((item, idx) => (
              <div key={idx} className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/5 space-y-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-[var(--foreground)]">🏬 {item.storeName}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black ${item.severity === "HIGH" ? "bg-rose-600 text-white" : "bg-amber-500 text-white"}`}>
                    {item.severity}
                  </span>
                </div>
                <div className="text-[11px] font-bold text-rose-700 dark:text-rose-300">
                  Issue: {item.issue}
                </div>
                <div className="text-[10px] font-semibold text-[var(--muted-foreground)]">
                  Impact: {item.impact}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 🎯 Executive Decision Recommendations */}
      <div className="bg-[var(--background)] p-4 rounded-xl border-2 border-emerald-500/40 space-y-3">
        <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
          <span>🎯</span>
          <span>{t.executiveDecisions}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendedDecisions.map((dec, idx) => (
            <div key={idx} className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-2 text-xs">
              <div className="font-extrabold text-[var(--foreground)] leading-relaxed">
                {idx + 1}. {dec.action}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold pt-1 border-t border-emerald-500/20 text-[var(--muted-foreground)]">
                <div>{t.owner}: <strong className="text-[var(--foreground)]">{dec.owner}</strong></div>
                <div>{t.deadline}: <strong className="text-[var(--foreground)]">{dec.deadline}</strong></div>
              </div>

              <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 pt-0.5">
                🎯 {t.expectedImpact}: {dec.expectedImpact}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
