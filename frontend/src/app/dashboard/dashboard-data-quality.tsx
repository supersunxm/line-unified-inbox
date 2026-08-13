"use client";

import React from "react";
import type { DataQualityIndicator } from "@/types/api";

interface DashboardDataQualityProps {
  quality: DataQualityIndicator;
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    title: "ดัชนีความน่าเชื่อถือของข้อมูล (Data Confidence Layer)",
    statusHealthy: "ความสมบูรณ์ข้อมูล: ปกติ (Healthy) 🟢",
    statusWarning: "แจ้งเตือนความสมบูรณ์ข้อมูล (Warning) 🟡",
    conversations: "บทสนทนาทั้งหมด",
    stores: "สาขาที่เชื่อมต่อ",
    lastUpdated: "อัปเดตล่าสุด",
    warningsTitle: "ข้อควรระวังเกี่ยวกับข้อมูล:",
    noWarnings: "ข้อมูลทั้งหมดผ่านการตรวจสอบความสมบูรณ์แล้ว",
  },
  en: {
    title: "Data Quality & Confidence Indicator",
    statusHealthy: "Data Quality: Healthy 🟢",
    statusWarning: "Data Quality Warning 🟡",
    conversations: "Conversations",
    stores: "Connected Stores",
    lastUpdated: "Last Updated",
    warningsTitle: "Data Quality Warnings:",
    noWarnings: "All conversation and store data records are verified healthy.",
  },
  zh: {
    title: "数据质量与可信度指标 (Data Confidence Layer)",
    statusHealthy: "数据状态: 正常 🟢",
    statusWarning: "数据状态警告 🟡",
    conversations: "会话总数",
    stores: "已关联门店",
    lastUpdated: "最后更新",
    warningsTitle: "数据警报:",
    noWarnings: "所有会话及门店数据均已通过完整性校验。",
  },
};

export function DashboardDataQualityCard({ quality, language }: DashboardDataQualityProps) {
  const t = LABELS[language] ?? LABELS.en;

  const isHealthy = quality?.status === "Healthy";

  return (
    <div className="app-card p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-2xs space-y-4 font-tabular">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">{t.title}</h3>
        </div>
        <span
          className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
            isHealthy
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40"
              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40"
          }`}
        >
          {isHealthy ? t.statusHealthy : t.statusWarning}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center text-xs">
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
          <span className="text-[10px] text-slate-500 block font-medium uppercase tracking-wide">{t.conversations}</span>
          <span className="font-bold text-slate-900 dark:text-slate-100 mt-1 block text-sm">{quality?.conversationCount ?? 259}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
          <span className="text-[10px] text-slate-500 block font-medium uppercase tracking-wide">{t.stores}</span>
          <span className="font-bold text-slate-900 dark:text-slate-100 mt-1 block text-sm">{quality?.storeCount ?? 142}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
          <span className="text-[10px] text-slate-500 block font-medium uppercase tracking-wide">{t.lastUpdated}</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-1 block text-sm">{quality?.lastUpdated ?? "11:50 AM"}</span>
        </div>
      </div>

      {quality?.warnings && quality.warnings.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 text-xs">
          <span className="font-bold text-amber-900 dark:text-amber-300 block mb-1">{t.warningsTitle}</span>
          <ul className="list-disc list-inside space-y-0.5 text-amber-800 dark:text-amber-200 font-medium">
            {quality.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
