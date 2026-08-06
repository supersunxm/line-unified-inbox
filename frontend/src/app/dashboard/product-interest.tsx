"use client";

import React from "react";
import type { DashboardAnalyticsResponse } from "@/types/api";

interface ProductInterestProps {
  products: DashboardAnalyticsResponse["topProducts"];
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    title: "รุ่นสินค้าที่ได้รับความสนใจสูงสุดวันนี้ (Top Products Today)",
    subtitle: "วัดจากความถี่ในการระบุชื่อรุ่นสินค้าในบทสนทนา",
    noData: "ยังไม่มีข้อมูลรุ่นสินค้า",
  },
  en: {
    title: "Top Products Today",
    subtitle: "Measured by device model mentions in customer chats",
    noData: "No product data available",
  },
  zh: {
    title: "今日热门产品 (Top Products Today)",
    subtitle: "按会话中提到的设备型号频率统计",
    noData: "暂无产品数据",
  },
};

export function ProductInterestCard({ products, language }: ProductInterestProps) {
  const t = LABELS[language] ?? LABELS.en;

  return (
    <div className="app-card p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col justify-between">
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{t.title}</h3>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{t.subtitle}</p>
      </div>

      <div className="mt-4 space-y-3">
        {products.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">{t.noData}</p>
        ) : (
          products.map((item) => (
            <div key={item.productModelId} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[var(--foreground)]">{item.name}</span>
                <span className="font-semibold text-teal-600 dark:text-teal-400">
                  {item.percentage}% <span className="text-[var(--muted-foreground)] font-normal">({item.count})</span>
                </span>
              </div>
              <div className="w-full h-2 bg-[var(--accent)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(4, item.percentage)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
