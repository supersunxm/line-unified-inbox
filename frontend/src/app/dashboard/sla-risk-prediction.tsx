"use client";

import React from "react";
import type { SlaRiskPredictionItem } from "@/types/api";

interface SlaRiskPredictionProps {
  predictions: SlaRiskPredictionItem[];
  getStoreDisplayName: (name: string) => string;
  onNotifyBm?: (storeId: string, storeName: string) => void;
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    title: "⚠️ พยากรณ์ความเสี่ยงผิดเป้า 24H SLA (SLA Risk Prediction)",
    subtitle: "คาดการณ์สาขาที่มีโอกาสเกิด SLA Breach ภายใน 24 ชั่วโมง",
    waiting: "รอการตอบกลับแล้ว:",
    expectedBreach: "คาดว่าจะผิด SLA ภายใน:",
    risk: "ระดับความเสี่ยง:",
    recommendation: "ข้อแนะนำ:",
    notifyNow: "Notify BM Now",
    hours: "ชั่วโมง",
    noBreachRisk: "ไม่มีสาขาที่มีความเสี่ยงผิดเป้า SLA ในขณะนี้",
    notifyAlert: "ส่งการแจ้งเตือนไปยังผู้จัดการสาขา (BM) เรียบร้อยแล้ว",
  },
  en: {
    title: "⚠️ SLA Risk Prediction",
    subtitle: "Predicting conversations likely to breach 24H SLA target",
    waiting: "Waiting:",
    expectedBreach: "Expected breach:",
    risk: "Risk:",
    recommendation: "Recommendation:",
    notifyNow: "Notify BM Now",
    hours: "hours",
    noBreachRisk: "No stores currently predicted to breach 24H SLA target.",
    notifyAlert: "Notification dispatched to Store Branch Manager (BM).",
  },
  zh: {
    title: "⚠️ SLA 违约风险预测 (SLA Risk Prediction)",
    subtitle: "预测可能超过 24 小时 SLA 的门店会话",
    waiting: "已等待:",
    expectedBreach: "预计违约:",
    risk: "风险等级:",
    recommendation: "建议:",
    notifyNow: "Notify BM Now",
    hours: "小时",
    noBreachRisk: "当前没有门店被预测为 SLA 违约风险。",
    notifyAlert: "已成功通知门店分店经理 (BM)。",
  },
};

export function SlaRiskPredictionCard({
  predictions,
  getStoreDisplayName,
  onNotifyBm,
  language,
}: SlaRiskPredictionProps) {
  const t = LABELS[language] ?? LABELS.en;

  const handleNotify = (storeId: string, name: string) => {
    if (onNotifyBm) {
      onNotifyBm(storeId, name);
    } else {
      alert(`${t.notifyAlert} (${getStoreDisplayName(name)})`);
    }
  };

  return (
    <div className="app-card p-5 rounded-xl border border-amber-300 dark:border-amber-800/60 bg-[var(--surface)] shadow-sm space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-[10px] font-black rounded bg-amber-600 text-white uppercase tracking-wider">
            EARLY WARNING
          </span>
          <h3 className="text-sm font-bold text-[var(--foreground)]">{t.title}</h3>
        </div>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{t.subtitle}</p>
      </div>

      <div className="space-y-3">
        {!predictions || predictions.length === 0 ? (
          <div className="py-6 text-center text-xs text-[var(--muted-foreground)] border border-dashed border-[var(--border)] rounded-lg">
            {t.noBreachRisk}
          </div>
        ) : (
          predictions.map((p) => (
            <div
              key={p.storeId}
              className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-extrabold text-[var(--foreground)]">{getStoreDisplayName(p.storeName)}</h4>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-extrabold rounded ${
                      p.riskLevel === "HIGH"
                        ? "bg-rose-600 text-white"
                        : p.riskLevel === "MEDIUM"
                        ? "bg-amber-600 text-white"
                        : "bg-emerald-600 text-white"
                    }`}
                  >
                    {p.riskLevel} RISK
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[var(--muted-foreground)] pt-0.5">
                  <span>
                    {t.waiting} <strong className="text-[var(--foreground)]">{p.currentWaitingHours} {t.hours}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    {t.expectedBreach} <strong className="text-rose-600 dark:text-rose-400 font-extrabold">in {p.expectedBreachHours} {t.hours}</strong>
                  </span>
                </div>

                <p className="text-amber-800 dark:text-amber-300 font-semibold pt-0.5">
                  {t.recommendation} {p.recommendation}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleNotify(p.storeId, p.storeName)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors shrink-0 self-end sm:self-center"
              >
                {t.notifyNow}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
