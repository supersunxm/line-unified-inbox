"use client";

import React, { useState } from "react";
import type { DashboardAnalyticsResponse } from "@/types/api";

interface TodayActionCenterProps {
  queue: DashboardAnalyticsResponse["needActionQueue"];
  predictions: DashboardAnalyticsResponse["slaRiskPrediction"];
  getStoreDisplayName: (name: string) => string;
  onOpenStore: (storeId: string) => void;
  onQuickViewStore: (storeId: string) => void;
  language: "th" | "en" | "zh";
}

const labels = {
  th: {
    title: "ศูนย์จัดการปฏิบัติการด่วนวันนี้ (Today's Action Center)",
    subtitle: "เคสที่ต้องการการเข้าแทรกแซงและติดตามผลทันที",
    store: "สาขา",
    problem: "ปัญหาที่พบ",
    impact: "ผลกระทบธุรกิจ",
    recommended: "คำแนะนำการดำเนินการ",
    openChat: "เปิดกล่องข้อความ",
    notifyBm: "แจ้งผู้จัดการร้าน (BM)",
    viewStore: "ดูรายละเอียดสาขา",
    notifiedSuccess: "ส่งการแจ้งเตือนไปยังผู้จัดการร้านเรียบร้อยแล้ว",
    noActionRequired: "ไม่มีเคสด่วนที่ต้องดำเนินการในขณะนี้",
    highSlaRisk: "เสี่ยงผิดเวลาตอบสนอง (SLA)",
    pendingMessages: "ข้อความรอดำเนินการ",
    unassignedStore: "สาขายังไม่ระบุ",
  },
  en: {
    title: "Today's Operation Action Center",
    subtitle: "Cases requiring immediate intervention & manager follow-up",
    store: "Store",
    problem: "Detected Problem",
    impact: "Business Impact",
    recommended: "Recommended Action",
    openChat: "Open Chat",
    notifyBm: "Notify Store Manager",
    viewStore: "View Store Details",
    notifiedSuccess: "Notification sent to Store Manager successfully",
    noActionRequired: "No high-priority intervention cases at this moment",
    highSlaRisk: "High SLA Breach Risk",
    pendingMessages: "Pending Messages",
    unassignedStore: "Unassigned Store",
  },
  zh: {
    title: "今日运营行动中心",
    subtitle: "需要立即干预和经理跟进的紧急案例",
    store: "门店",
    problem: "检测到的问题",
    impact: "业务影响",
    recommended: "建议采取的行动",
    openChat: "打开聊天",
    notifyBm: "通知门店经理",
    viewStore: "查看门店详情",
    notifiedSuccess: "已成功发送通知给门店经理",
    noActionRequired: "目前没有高优先级的干预案例",
    highSlaRisk: "高 SLA 违约风险",
    pendingMessages: "待处理消息",
    unassignedStore: "未分配门店",
  },
};

export function TodayActionCenter({
  queue,
  predictions,
  getStoreDisplayName,
  onOpenStore,
  onQuickViewStore,
  language,
}: TodayActionCenterProps) {
  const t = labels[language] ?? labels.th;
  const [notifiedStoreIds, setNotifiedStoreIds] = useState<Set<string>>(new Set());
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const riskCount = predictions.filter((p) => p.riskLevel === "HIGH").length;

  const handleNotifyBm = (storeId: string, storeName: string) => {
    setNotifiedStoreIds((prev) => new Set(prev).add(storeId));
    setToastMsg(`${t.notifiedSuccess}: ${getStoreDisplayName(storeName)}`);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const actionItems = queue.slice(0, 5);

  return (
    <section data-today-action-center className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-black rounded-lg bg-rose-600 text-white uppercase tracking-wider">
              LEVEL 2 · WORKFLOW
            </span>
            <h2 className="text-lg font-extrabold text-[var(--foreground)] tracking-tight">
              🔥 {t.title}
            </h2>
            {riskCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-xs font-bold border border-rose-200 dark:border-rose-800">
                {riskCount} High Risk
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--muted-foreground)] font-medium">
            {t.subtitle}
          </p>
        </div>
      </div>

      {toastMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
          ✓ {toastMsg}
        </div>
      )}

      {actionItems.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted-foreground)]">
          ✨ {t.noActionRequired}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {actionItems.map((item) => {
            const isNotified = notifiedStoreIds.has(item.storeId);
            const slaRiskPct = Math.round((1 - item.responseRate) * 100);

            return (
              <div
                key={item.storeId}
                className="rounded-2xl border border-rose-200/70 dark:border-rose-900/50 bg-gradient-to-r from-rose-50/40 via-[var(--surface)] to-[var(--surface)] dark:from-rose-950/20 p-5 shadow-sm space-y-4"
              >
                {/* Header: Store Name & Risk Level Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🏬</span>
                    <h3 className="text-base font-bold text-[var(--foreground)]">
                      {getStoreDisplayName(item.storeName || t.unassignedStore)}
                    </h3>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 text-xs font-bold border border-rose-200 dark:border-rose-800">
                    🔴 {t.highSlaRisk} (SLA Risk: {slaRiskPct}%)
                  </span>
                </div>

                {/* Structured Information Grid (Store, Problem, Impact, Recommended Action) */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                  <div className="bg-[var(--surface)] p-3 rounded-xl border border-[var(--border)]">
                    <div className="text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
                      {t.store}
                    </div>
                    <div className="mt-1 font-bold text-[var(--foreground)] text-sm truncate">
                      {getStoreDisplayName(item.storeName)}
                    </div>
                  </div>

                  <div className="bg-[var(--surface)] p-3 rounded-xl border border-[var(--border)]">
                    <div className="text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
                      {t.problem}
                    </div>
                    <div className="mt-1 font-semibold text-rose-600 dark:text-rose-400">
                      {item.problem || `${item.pending} ${t.pendingMessages}`}
                    </div>
                  </div>

                  <div className="bg-[var(--surface)] p-3 rounded-xl border border-[var(--border)]">
                    <div className="text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
                      {t.impact}
                    </div>
                    <div className="mt-1 font-semibold text-amber-700 dark:text-amber-300">
                      {item.impact || item.reasons?.join(", ") || "Risk of SLA breach"}
                    </div>
                  </div>

                  <div className="bg-[var(--surface)] p-3 rounded-xl border border-[var(--border)]">
                    <div className="text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
                      {t.recommended}
                    </div>
                    <div className="mt-1 font-semibold text-blue-700 dark:text-blue-300">
                      {item.recommendedAction || "Follow up with Branch Manager"}
                    </div>
                  </div>
                </div>

                {/* Action Buttons (Open Chat, Notify BM, View Store) */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => onOpenStore(item.storeId)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <span>💬</span>
                    <span>{t.openChat}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNotifyBm(item.storeId, item.storeName)}
                    disabled={isNotified}
                    className={`px-4 py-2 rounded-xl font-bold text-xs border transition-colors flex items-center gap-1.5 ${
                      isNotified
                        ? "bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-900 dark:text-slate-600"
                        : "bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-sm"
                    }`}
                  >
                    <span>📣</span>
                    <span>{isNotified ? "Notified" : t.notifyBm}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onQuickViewStore(item.storeId)}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--accent)] text-[var(--foreground)] font-bold text-xs transition-colors flex items-center gap-1.5"
                  >
                    <span>🏬</span>
                    <span>{t.viewStore}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
