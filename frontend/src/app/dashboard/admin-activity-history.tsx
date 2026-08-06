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
    <div className="app-card p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{t.title}</h3>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{t.subtitle}</p>
      </div>

      <div className="space-y-2.5">
        {!logs || logs.length === 0 ? (
          <div className="py-6 text-center text-xs text-[var(--muted-foreground)] border border-dashed border-[var(--border)] rounded-lg">
            {t.noActivity}
          </div>
        ) : (
          logs.map((item, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg bg-[var(--accent)]/50 border border-[var(--border)] flex items-center justify-between text-xs gap-3"
            >
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 font-bold rounded bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] text-[11px] shrink-0">
                  {item.timestamp}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-[var(--foreground)]">{item.admin}</span>
                    <span className="text-[var(--muted-foreground)]">•</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{getStoreDisplayName(item.storeName)}</span>
                  </div>
                  <p className="text-[var(--muted-foreground)] mt-0.5">{item.action}</p>
                </div>
              </div>

              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shrink-0">
                {item.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
