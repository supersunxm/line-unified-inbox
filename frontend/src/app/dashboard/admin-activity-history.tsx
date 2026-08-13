"use client";

import React from "react";
import type { AdminActivityLogItem } from "@/types/api";

interface AdminActivityHistoryProps {
  logs: AdminActivityLogItem[];
  getStoreDisplayName: (name: string) => string;
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    title: "ประวัติกิจกรรมแอดมินและการจัดการ (Admin Operational Audit Trail)",
    subtitle: "บันทึกการดำเนินการแบบเรียลไทม์เพื่อสร้างความโปร่งใส",
    time: "เวลา",
    admin: "ผู้ดำเนินการ",
    action: "กิจกรรม",
    store: "สาขา",
    status: "สถานะ",
    noActivity: "ยังไม่มีประวัติการบันทึกกิจกรรมในวันนี้",
  },
  en: {
    title: "Admin Operational Activity History",
    subtitle: "Real-time audit trail of admin interventions for full accountability",
    time: "Time",
    admin: "Admin",
    action: "Action Taken",
    store: "Store",
    status: "Status",
    noActivity: "No activity logs recorded today.",
  },
  zh: {
    title: "管理员操作历史 (Admin Activity History)",
    subtitle: "管理员干预操作的实时审计日志",
    time: "时间",
    admin: "管理员",
    action: "操作",
    store: "门店",
    status: "状态",
    noActivity: "今日暂无操作日志记录。",
  },
};

export function AdminActivityHistoryCard({ logs, getStoreDisplayName, language }: AdminActivityHistoryProps) {
  const t = LABELS[language] ?? LABELS.en;

  return (
    <div className="app-card p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-2xs space-y-4 font-tabular">
      <div className="border-b border-slate-100 dark:border-slate-800/80 pb-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.subtitle}</p>
      </div>

      <div className="space-y-2.5">
        {!logs || logs.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            {t.noActivity}
          </div>
        ) : (
          logs.map((item, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs gap-3"
            >
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] shrink-0 font-tabular">
                  {item.timestamp}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{item.admin}</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{getStoreDisplayName(item.storeName)}</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-[11px]">{item.action}</p>
                </div>
              </div>

              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 shrink-0">
                {item.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
