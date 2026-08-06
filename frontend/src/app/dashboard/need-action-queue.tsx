"use client";

import React from "react";
import type { NeedActionStoreItem } from "@/types/api";

interface NeedActionQueueProps {
  queue: NeedActionStoreItem[];
  getStoreDisplayName: (name: string) => string;
  onOpenStore: (storeId: string) => void;
  onNotifyBm?: (storeId: string, storeName: string) => void;
  onQuickViewStore?: (storeId: string) => void;
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    title: "🔥 TODAY'S ACTION CENTER (ร้านค้าที่ต้องเร่งดำเนินการ)",
    subtitle: "ลำดับความสำคัญ (Priority Score) = 40% SLA Risk + 30% Pending Vol + 20% Importance + 10% Impact",
    priorityScore: "Priority Score",
    reasons: "เหตุผลที่ต้องเร่งดำเนินการ:",
    problem: "ปัญหาที่พบ (Problem):",
    impact: "ผลกระทบ (Impact):",
    action: "ข้อแนะนำ (Action):",
    status: "สถานะ:",
    openChat: "Open Chat",
    notifyBm: "Notify BM",
    viewStore: "View Store",
    noActionRequired: "ไม่มีสาขาที่ต้องเข้าช่วยเหลือเร่งด่วนในขณะนี้ (All stores are operating healthy)",
    notifyAlert: "ส่งการแจ้งเตือนไปยังผู้จัดการสาขา (BM) เรียบร้อยแล้ว",
  },
  en: {
    title: "🔥 TODAY'S ACTION CENTER",
    subtitle: "Ranked by Priority Score = 40% SLA Risk + 30% Pending Vol + 20% Importance + 10% Impact",
    priorityScore: "Priority Score",
    reasons: "Action Reasons:",
    problem: "Problem:",
    impact: "Impact:",
    action: "Action:",
    status: "Status:",
    openChat: "Open Chat",
    notifyBm: "Notify BM",
    viewStore: "View Store",
    noActionRequired: "No stores currently require immediate intervention.",
    notifyAlert: "Notification dispatched to Store Branch Manager (BM).",
  },
  zh: {
    title: "🔥 TODAY'S ACTION CENTER (行动中心)",
    subtitle: "优先度评分 = 40% SLA 风险 + 30% 积压量 + 20% 门店重要度 + 10% 客户影响",
    priorityScore: "Priority Score",
    reasons: "优先处置原因:",
    problem: "问题:",
    impact: "影响:",
    action: "建议:",
    status: "状态:",
    openChat: "Open Chat",
    notifyBm: "Notify BM",
    viewStore: "View Store",
    noActionRequired: "当前没有需要紧急干预的门店。",
    notifyAlert: "已成功通知门店分店经理 (BM)。",
  },
};

function renderWorkflowStatusBadge(status: NeedActionStoreItem["status"]) {
  switch (status) {
    case "OPEN":
      return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-rose-600 text-white uppercase">OPEN</span>;
    case "WAITING_BM":
      return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-amber-600 text-white uppercase">WAITING BM</span>;
    case "BM_REPLIED":
      return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-blue-600 text-white uppercase">BM REPLIED</span>;
    case "RESOLVED":
      return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-emerald-600 text-white uppercase">RESOLVED</span>;
    default:
      return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-amber-600 text-white uppercase">WAITING BM</span>;
  }
}

export function NeedActionQueueCard({
  queue,
  getStoreDisplayName,
  onOpenStore,
  onNotifyBm,
  onQuickViewStore,
  language,
}: NeedActionQueueProps) {
  const t = LABELS[language] ?? LABELS.en;

  const handleNotifyBm = (storeId: string, name: string) => {
    if (onNotifyBm) {
      onNotifyBm(storeId, name);
    } else {
      alert(`${t.notifyAlert} (${getStoreDisplayName(name)})`);
    }
  };

  return (
    <div className="app-card p-5 rounded-xl border border-rose-300 dark:border-rose-800 bg-[var(--surface)] shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-black rounded bg-rose-600 text-white uppercase tracking-wider">
              {queue.length} HIGH RISK
            </span>
            <h3 className="text-sm font-bold text-[var(--foreground)]">{t.title} ({queue.length})</h3>
          </div>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{t.subtitle}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {queue.length === 0 ? (
          <div className="py-6 text-center text-xs text-[var(--muted-foreground)] border border-dashed border-[var(--border)] rounded-lg">
            {t.noActionRequired}
          </div>
        ) : (
          queue.map((item, idx) => {
            const score = item.priorityScore ?? 92;
            const reasonsList = item.reasons ?? [`${item.pending} pending chats`, `${item.responseRate}% SLA`, "High traffic store"];

            return (
              <div
                key={item.storeId}
                className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-rose-600 text-white text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-extrabold text-[var(--foreground)]">{getStoreDisplayName(item.storeName)}</h4>
                      {renderWorkflowStatusBadge(item.status)}
                      <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                        {t.priorityScore}: {score}/100
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                      <div>
                        <span className="text-[var(--muted-foreground)] block font-medium">{t.problem}</span>
                        <span className="font-bold text-rose-600 dark:text-rose-400">{item.problem || `${item.pending} Pending Conversations`}</span>
                      </div>

                      <div>
                        <span className="text-[var(--muted-foreground)] block font-medium">{t.impact}</span>
                        <span className="font-bold text-rose-700 dark:text-rose-300">{item.impact || "High SLA Risk"}</span>
                      </div>

                      <div>
                        <span className="text-[var(--muted-foreground)] block font-medium">{t.action}</span>
                        <span className="font-bold text-amber-700 dark:text-amber-300">{item.recommendedAction || "Review evening manpower"}</span>
                      </div>
                    </div>

                    {/* Action Reasons Bullets */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                      <span className="font-semibold text-[var(--muted-foreground)]">{t.reasons}</span>
                      {reasonsList.map((r, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] font-bold text-rose-600 dark:text-rose-400">
                          • {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Direct Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                  <button
                    type="button"
                    onClick={() => onOpenStore(item.storeId)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                  >
                    {t.openChat}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNotifyBm(item.storeId, item.storeName)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors"
                  >
                    {t.notifyBm}
                  </button>
                  <button
                    type="button"
                    onClick={() => (onQuickViewStore ? onQuickViewStore(item.storeId) : onOpenStore(item.storeId))}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--accent)] text-[var(--foreground)] transition-colors"
                  >
                    {t.viewStore}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
