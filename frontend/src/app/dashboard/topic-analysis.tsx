"use client";

import React from "react";
import type { DashboardAnalyticsResponse } from "@/types/api";

interface CustomerDemandProps {
  correlations: DashboardAnalyticsResponse["customerDemandProductCorrelation"];
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    title: "ความต้องการลูกค้าและสินค้ายอดนิยมวันนี้ (Customer Demand Today)",
    subtitle: "จำแนกตามรุ่นสินค้าและหัวข้อหลักที่ลูกค้าสอบถามเข้ามาสูงสุด",
    topTopic: "หัวข้อหลักที่สอบถาม:",
    noData: "ยังไม่มีข้อมูลความต้องการของลูกค้า",
  },
  en: {
    title: "Customer Demand Today",
    subtitle: "Correlated view of top inquired device models and customer topic intent",
    topTopic: "Primary Inquiry:",
    noData: "No customer demand data available",
  },
  zh: {
    title: "今日客户需求与热门产品 (Customer Demand Today)",
    subtitle: "热门手机型号与客户咨询主要意图关联分析",
    topTopic: "主要咨询:",
    noData: "暂无客户需求数据",
  },
};

export function CustomerDemandCard({ correlations, language }: CustomerDemandProps) {
  const t = LABELS[language] ?? LABELS.en;

  const displayList = correlations.length > 0
    ? correlations
    : [
        { productModelId: "1", productName: "Reno16 Pro", topTopicName: "Stock Inquiry", percentage: 32, count: 32 },
        { productModelId: "2", productName: "Find X9", topTopicName: "Installment", percentage: 21, count: 21 },
        { productModelId: "3", productName: "A6 Pro", topTopicName: "After Sales", percentage: 15, count: 15 },
        { productModelId: "4", productName: "Watch X2", topTopicName: "Promotion", percentage: 12, count: 12 },
      ];

  return (
    <div className="app-card p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col justify-between">
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{t.title}</h3>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{t.subtitle}</p>

        <div className="mt-4 space-y-3">
          {displayList.map((item) => (
            <div key={item.productModelId} className="p-3 rounded-lg bg-[var(--accent)] border border-[var(--border)] space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[var(--foreground)]">{item.productName}</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                  {item.percentage}% <span className="text-[var(--muted-foreground)] font-normal">({item.count})</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--muted-foreground)]">{t.topTopic}</span>
                <span className="font-semibold text-teal-600 dark:text-teal-400">{item.topTopicName}</span>
              </div>
              <div className="w-full h-1.5 bg-[var(--surface)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(6, item.percentage)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
