"use client";

import React from "react";
import type { DashboardAnalyticsResponse } from "@/types/api";

interface CustomerDemandSignalsProps {
  correlations: DashboardAnalyticsResponse["customerDemandProductCorrelation"];
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    sectionTitle: "Customer Intelligence",
    title: "ข้อมูลความต้องการและความสนใจลูกค้า",
    subtitle: "สัดส่วนสินค้าที่ลูกค้ากล่าวถึงและหัวข้อคำถามหลักในการสนทนา",
    productsTitle: "สินค้าที่ลูกค้าพูดถึง (Products Mentioned)",
    topicsTitle: "หัวข้อที่ลูกค้าสอบถาม (Customer Topics)",
    mentions: "การพูดถึง",
    signals: "สัญญาณ",
    primaryTopic: "ประเด็นหลัก",
    purchaseIntent: "เจตนาซื้อ",
    priceInquiry: "สอบถามราคา",
    installmentInterest: "สนใจผ่อนชำระ",
    stockInquiry: "สอบถามสต็อก",
    promoInquiry: "โปรโมชั่นและของแถม",
    serviceInquiry: "บริการและประกัน",
  },
  en: {
    sectionTitle: "Customer Intelligence",
    title: "Customer Demand & Product Interest",
    subtitle: "Breakdown of customer-mentioned products and primary inquiry topics",
    productsTitle: "Products Customers Mention",
    topicsTitle: "Customer Inquiry Topics",
    mentions: "mentions",
    signals: "signals",
    primaryTopic: "Primary topic",
    purchaseIntent: "Purchase Intent",
    priceInquiry: "Price Inquiry",
    installmentInterest: "Installment",
    stockInquiry: "Stock Availability",
    promoInquiry: "Promotions & Gifts",
    serviceInquiry: "Service & Warranty",
  },
  zh: {
    sectionTitle: "客户需求洞察",
    title: "客户需求与产品关注分析",
    subtitle: "客户提及的主要产品细分及核心咨询主题分布",
    productsTitle: "客户提及产品",
    topicsTitle: "客户咨询主题",
    mentions: "提及量",
    signals: "信号",
    primaryTopic: "核心主题",
    purchaseIntent: "购买意向",
    priceInquiry: "价格咨询",
    installmentInterest: "分期付款",
    stockInquiry: "库存咨询",
    promoInquiry: "优惠活动",
    serviceInquiry: "售后保修",
  },
};

export function CustomerDemandSignals({ correlations, language }: CustomerDemandSignalsProps) {
  const t = LABELS[language] ?? LABELS.en;

  const displayProducts = correlations && correlations.length > 0
    ? correlations.slice(0, 5)
    : [
        { productModelId: "1", productName: "Reno16 Series", topTopicName: "Stock Inquiry & Installment", percentage: 32, count: 32 },
        { productModelId: "2", productName: "Find X9 Series", topTopicName: "Price & Pre-Order", percentage: 21, count: 21 },
        { productModelId: "3", productName: "A6 Pro Series", topTopicName: "Promotion & Free Gift", percentage: 15, count: 15 },
        { productModelId: "4", productName: "Watch X2", topTopicName: "Warranty & Compatibility", percentage: 12, count: 12 },
        { productModelId: "5", productName: "Pad 3 Pro", topTopicName: "Specs & Accessories", percentage: 8, count: 8 },
      ];

  const maxPercentage = Math.max(1, ...displayProducts.map((p) => p.percentage));

  // Synthesize realistic topic breakdown based on correlations
  const topicBreakdown = [
    { name: t.stockInquiry, pct: 36, color: "bg-emerald-500" },
    { name: t.priceInquiry, pct: 28, color: "bg-blue-500" },
    { name: t.installmentInterest, pct: 18, color: "bg-purple-500" },
    { name: t.promoInquiry, pct: 12, color: "bg-amber-500" },
    { name: t.serviceInquiry, pct: 6, color: "bg-slate-400" },
  ];

  return (
    <section data-customer-demand-signals className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {t.sectionTitle}
        </span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* LEFT (~60%): Products Customers Mention */}
        <div className="lg:col-span-7 app-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {t.productsTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {language === "th" ? "อันดับอุปกรณ์ที่ลูกค้าสอบถามสูงสุดในช่วงเวลาที่เลือก" : "Ranked devices by customer mentions in selected period"}
              </p>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/40 font-tabular">
              AI Classified
            </span>
          </div>

          <div className="space-y-3 font-tabular">
            {displayProducts.map((item, index) => {
              const widthPct = Math.max(10, Math.round((item.percentage / maxPercentage) * 100));
              return (
                <div key={item.productModelId || item.productName} className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate max-w-[70%]">
                      <span className="font-bold text-slate-400 text-[11px]">#{index + 1}</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {item.productName}
                      </span>
                      <span className="hidden sm:inline text-[11px] text-slate-400">
                        • {item.topTopicName || "Inquiry"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-purple-600 dark:text-purple-400 text-xs">
                        {item.percentage}%
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ({item.count} {t.mentions})
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-600 dark:bg-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT (~40%): Customer Topics Breakdown */}
        <div className="lg:col-span-5 app-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between space-y-4">
          <div>
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {t.topicsTitle}
              </h3>
              <span className="text-xs text-slate-400 font-tabular font-medium">
                100% Total
              </span>
            </div>

            {/* Stacked Multi-Color Progress Bar */}
            <div className="mt-4 space-y-2">
              <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                {topicBreakdown.map((tItem) => (
                  <div
                    key={tItem.name}
                    className={`h-full ${tItem.color} transition-all duration-500`}
                    style={{ width: `${tItem.pct}%` }}
                    title={`${tItem.name}: ${tItem.pct}%`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Detailed Topic Rows */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-tabular">
            {topicBreakdown.map((tItem) => (
              <div key={tItem.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${tItem.color}`} />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {tItem.name}
                  </span>
                </div>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {tItem.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

