"use client";

import React from "react";
import type { OperationEfficiencyData } from "@/types/api";

interface OperationEfficiencyProps {
  efficiency: OperationEfficiencyData;
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    title: "ดัชนีประสิทธิภาพการปิดเคส (Operation Efficiency KPI)",
    subtitle: "วัดประสิทธิภาพการดำเนินงานและระยะเวลาในการจัดการบทสนทนาวันนี้",
    opened: "เคสที่เปิดวันนี้ (Opened)",
    resolved: "เคสที่ปิดสำเร็จ (Resolved)",
    closureRate: "อัตราการปิดเคส (Closure Rate)",
    avgResolutionTime: "ระยะเวลาแก้ไขเฉลี่ย (Avg Resolution Time)",
  },
  en: {
    title: "Operation Efficiency KPI",
    subtitle: "Tracking today's case volume, resolution speed, and overall closure rate",
    opened: "Today's Cases Opened",
    resolved: "Resolved Cases",
    closureRate: "Closure Rate",
    avgResolutionTime: "Average Resolution Time",
  },
  zh: {
    title: "运营效率 KPI (Operation Efficiency KPI)",
    subtitle: "追踪今日会话总量、解决速度与总体关闭率",
    opened: "今日新增会话 (Opened)",
    resolved: "已解决会话 (Resolved)",
    closureRate: "结案率 (Closure Rate)",
    avgResolutionTime: "平均解决耗时 (Avg Resolution Time)",
  },
};

export function OperationEfficiencyCard({ efficiency, language }: OperationEfficiencyProps) {
  const t = LABELS[language] ?? LABELS.en;

  const data = efficiency || {
    opened: 50,
    resolved: 35,
    closureRate: 70,
    averageResolutionTime: "2h 35m",
  };

  return (
    <div className="app-card p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-black rounded bg-blue-600 text-white uppercase tracking-wider">
              EFFICIENCY KPI
            </span>
            <h3 className="text-sm font-bold text-[var(--foreground)]">{t.title}</h3>
          </div>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{t.subtitle}</p>
        </div>
        <span className="px-2.5 py-1 text-xs font-black rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
          {data.closureRate}% Closure
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="p-3 rounded-xl bg-[var(--accent)] border border-[var(--border)]">
          <span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider block font-medium">{t.opened}</span>
          <span className="text-xl font-extrabold text-[var(--foreground)] mt-1 block">{data.opened}</span>
        </div>

        <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40">
          <span className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block font-bold">{t.resolved}</span>
          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{data.resolved}</span>
        </div>

        <div className="p-3 rounded-xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/40">
          <span className="text-[10px] text-teal-800 dark:text-teal-300 uppercase tracking-wider block font-bold">{t.closureRate}</span>
          <span className="text-xl font-black text-teal-600 dark:text-teal-400 mt-1 block">{data.closureRate}%</span>
        </div>

        <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40">
          <span className="text-[10px] text-indigo-800 dark:text-indigo-300 uppercase tracking-wider block font-bold">{t.avgResolutionTime}</span>
          <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">{data.averageResolutionTime}</span>
        </div>
      </div>
    </div>
  );
}
