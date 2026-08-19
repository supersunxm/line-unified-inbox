"use client";

import { useMemo, useState } from "react";
import type { ByStoreAccountRow } from "@/types/api";
import type { Language } from "./follower-insights-translations";

type MetricRow = {
  lineOaId: string;
  store: string;
  followers: number;
  startFollowers: number;
  growth: number;
  growthPct: number;
  reach: number;
  reachPct: number;
  blocks: number;
  blockPct: number;
};

type BarDatum = { label: string; value: number; display: string };

function pct(numerator: number, denominator: number, decimals = 1) {
  if (denominator <= 0) return 0;
  const factor = 10 ** decimals;
  return Math.round(((numerator / denominator) * 100) * factor) / factor;
}

function compactName(value: string, max = 28) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function MetricCard({ label, value, detail, tone = "default" }: { label: string; value: string; detail: string; tone?: "default" | "green" | "red" | "amber" }) {
  const toneClass = tone === "green" ? "text-[#008F46]" : tone === "red" ? "text-[#C62828]" : tone === "amber" ? "text-[#B36B00]" : "text-[#1D1D1F]";
  return (
    <div className="rounded-[18px] border border-[#E5E5EA] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.035)]">
      <p className="text-[12.5px] font-medium text-[#6E6E73]">{label}</p>
      <p className={`mt-2 text-[30px] font-bold leading-none tracking-[-0.035em] tabular-nums ${toneClass}`}>{value}</p>
      <p className="mt-2 text-xs text-[#6E6E73]">{detail}</p>
    </div>
  );
}

function HorizontalBars({ data, tone }: { data: BarDatum[]; tone: "green" | "red" }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  const barClass = tone === "green" ? "bg-[#00A651]" : "bg-[#FF3B30]";
  if (data.length === 0) return <div className="flex h-[260px] items-center justify-center text-sm text-[#6E6E73]">No comparable data</div>;
  return (
    <div className="space-y-2.5">
      {data.map((item) => (
        <div key={`${item.label}-${item.value}`} className="grid grid-cols-[minmax(110px,180px)_1fr_auto] items-center gap-3 text-xs">
          <span className="truncate text-[#6E6E73]" title={item.label}>{compactName(item.label)}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#F2F2F4]">
            <div className={`h-full rounded-full ${barClass}`} style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} />
          </div>
          <span className="min-w-[54px] text-right font-semibold tabular-nums text-[#1D1D1F]">{item.display}</span>
        </div>
      ))}
    </div>
  );
}

function ReachDistribution({ rows, language }: { rows: MetricRow[]; language: Language }) {
  const buckets = useMemo(() => {
    const values = [
      { key: "lt60", label: "<60%", min: 0, max: 60, className: "bg-[#FF3B30]" },
      { key: "60to70", label: "60–70%", min: 60, max: 70, className: "bg-[#FF9500]" },
      { key: "70to80", label: "70–80%", min: 70, max: 80, className: "bg-[#FFCC00]" },
      { key: "80to90", label: "80–90%", min: 80, max: 90, className: "bg-[#7BC67E]" },
      { key: "90to100", label: "90–100%", min: 90, max: 101, className: "bg-[#00A651]" },
    ];
    return values.map((bucket) => ({ ...bucket, count: rows.filter((row) => row.reachPct >= bucket.min && row.reachPct < bucket.max).length }));
  }, [rows]);
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return (
    <div className="flex h-[260px] items-end justify-around gap-3 pt-5">
      {buckets.map((bucket) => (
        <div key={bucket.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
          <span className="text-xs font-semibold tabular-nums text-[#1D1D1F]">{bucket.count}</span>
          <div className="flex h-[190px] w-full max-w-[54px] items-end overflow-hidden rounded-t-lg bg-[#F5F5F7]">
            <div className={`w-full rounded-t-lg ${bucket.className}`} style={{ height: `${Math.max(bucket.count ? 5 : 0, (bucket.count / max) * 100)}%` }} />
          </div>
          <span className="whitespace-nowrap text-[11px] text-[#6E6E73]">{bucket.label}</span>
        </div>
      ))}
      <span className="sr-only">{language === "th" ? "การกระจายอัตราการเข้าถึง" : "Reach distribution"}</span>
    </div>
  );
}

export function StoreAnalyticsOverview({ storeData, endpointsUsable, language = "en" }: { storeData: ByStoreAccountRow[]; endpointsUsable: boolean; language?: Language }) {
  const [showAllCharts, setShowAllCharts] = useState(true);
  const rows = useMemo<MetricRow[]>(() => storeData.flatMap((row) => {
    if (row.followers === null) return [];
    const startFollowers = row.startFollowers ?? row.followers;
    const growth = endpointsUsable && row.periodIncrease !== null ? row.periodIncrease : 0;
    return [{
      lineOaId: row.lineOaId,
      store: row.storeName,
      followers: row.followers,
      startFollowers,
      growth,
      growthPct: endpointsUsable && startFollowers > 0 ? pct(growth, startFollowers, 2) : 0,
      reach: row.targetedReaches ?? 0,
      reachPct: pct(row.targetedReaches ?? 0, row.followers, 1),
      blocks: row.blocks ?? 0,
      blockPct: pct(row.blocks ?? 0, row.followers, 1),
    }];
  }), [storeData, endpointsUsable]);

  const totals = useMemo(() => {
    const followers = rows.reduce((sum, row) => sum + row.followers, 0);
    const start = rows.reduce((sum, row) => sum + row.startFollowers, 0);
    const growth = endpointsUsable ? rows.reduce((sum, row) => sum + row.growth, 0) : 0;
    const reach = rows.reduce((sum, row) => sum + row.reach, 0);
    const blocks = rows.reduce((sum, row) => sum + row.blocks, 0);
    return {
      followers,
      growth,
      growthPct: endpointsUsable && start > 0 ? pct(growth, start, 2) : 0,
      reachPct: followers > 0 ? pct(reach, followers, 1) : 0,
      blockPct: followers > 0 ? pct(blocks, followers, 1) : 0,
      zeroGrowth: endpointsUsable ? rows.filter((row) => row.growth === 0).length : 0,
      lowReach: rows.filter((row) => row.reachPct < 80).length,
      highBlock: rows.filter((row) => row.blockPct > 10).length,
    };
  }, [rows, endpointsUsable]);

  const topGrowth = useMemo(() => [...rows].filter((row) => row.growth > 0).sort((a, b) => b.growth - a.growth).slice(0, 12).map((row) => ({ label: row.store, value: row.growth, display: `+${row.growth.toLocaleString()}` })), [rows]);
  const topGrowthPct = useMemo(() => [...rows].filter((row) => row.growthPct > 0).sort((a, b) => b.growthPct - a.growthPct).slice(0, 12).map((row) => ({ label: row.store, value: row.growthPct, display: `${row.growthPct.toFixed(2)}%` })), [rows]);
  const topBlockPct = useMemo(() => [...rows].filter((row) => row.blockPct > 0).sort((a, b) => b.blockPct - a.blockPct).slice(0, 12).map((row) => ({ label: row.store, value: row.blockPct, display: `${row.blockPct.toFixed(1)}%` })), [rows]);

  const th = language === "th";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label={th ? "ผู้ติดตามรวม" : "Total followers"} value={totals.followers.toLocaleString()} detail={th ? `${rows.length} LINE OA ที่มีข้อมูล` : `${rows.length} LINE OA accounts with data`} />
        <MetricCard label={th ? "เพิ่มขึ้นในช่วง" : "Period growth"} value={endpointsUsable ? `${totals.growth > 0 ? "+" : ""}${totals.growth.toLocaleString()}` : "—"} detail={th ? `อัตราเติบโต ${totals.growthPct.toFixed(2)}%` : `${totals.growthPct.toFixed(2)}% growth rate`} tone={totals.growth >= 0 ? "green" : "red"} />
        <MetricCard label={th ? "อัตราการเติบโต" : "Growth rate"} value={endpointsUsable ? `${totals.growthPct.toFixed(2)}%` : "—"} detail={th ? `${totals.zeroGrowth} สาขาไม่เติบโต` : `${totals.zeroGrowth} stores with no growth`} tone="green" />
        <MetricCard label={th ? "อัตราการเข้าถึง" : "Reach rate"} value={`${totals.reachPct.toFixed(1)}%`} detail={th ? `${totals.lowReach} สาขาต่ำกว่า 80%` : `${totals.lowReach} stores below 80%`} tone={totals.reachPct >= 85 ? "green" : totals.reachPct >= 75 ? "amber" : "red"} />
        <MetricCard label={th ? "อัตราบล็อก" : "Block rate"} value={`${totals.blockPct.toFixed(1)}%`} detail={th ? `${totals.highBlock} สาขาสูงกว่า 10%` : `${totals.highBlock} stores above 10%`} tone={totals.blockPct <= 5 ? "green" : totals.blockPct <= 10 ? "amber" : "red"} />
      </div>

      <div className="flex items-center justify-between px-1 pt-1">
        <div>
          <h3 className="text-[15px] font-semibold text-[#1D1D1F]">{th ? "Performance Analytics" : "Performance analytics"}</h3>
          <p className="mt-0.5 text-xs text-[#6E6E73]">{th ? "ดูสาขาที่เติบโตดี การกระจาย Reach และความเสี่ยงจาก Block" : "Growth leaders, reach distribution and block-rate risk"}</p>
        </div>
        <button type="button" onClick={() => setShowAllCharts((value) => !value)} className="rounded-lg border border-[#E5E5EA] bg-white px-3 py-1.5 text-xs font-semibold text-[#6E6E73] hover:border-[#00A651] hover:text-[#008F46]">
          {showAllCharts ? (th ? "ย่อกราฟ" : "Collapse") : (th ? "แสดงกราฟ" : "Show charts")}
        </button>
      </div>

      {showAllCharts && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
          <div className="rounded-[18px] border border-[#E5E5EA] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.035)]">
            <h4 className="text-[15px] font-semibold text-[#1D1D1F]">{th ? "Top สาขา — ผู้ติดตามเพิ่มขึ้น" : "Top stores — follower growth"}</h4>
            <p className="mt-1 mb-5 text-xs text-[#6E6E73]">{th ? "เรียงตามจำนวนผู้ติดตามที่เพิ่มขึ้นสูงสุดในช่วงที่เลือก" : "Highest absolute follower growth in the selected period"}</p>
            <HorizontalBars data={topGrowth} tone="green" />
          </div>
          <div className="rounded-[18px] border border-[#E5E5EA] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.035)]">
            <h4 className="text-[15px] font-semibold text-[#1D1D1F]">{th ? "การกระจายอัตราการเข้าถึง" : "Reach-rate distribution"}</h4>
            <p className="mt-1 text-xs text-[#6E6E73]">{th ? "จำนวนสาขาในแต่ละช่วง % Reach" : "Number of stores in each reach-rate bucket"}</p>
            <ReachDistribution rows={rows} language={language} />
          </div>
          <div className="rounded-[18px] border border-[#E5E5EA] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.035)]">
            <h4 className="text-[15px] font-semibold text-[#1D1D1F]">{th ? "Top สาขา — อัตราการเติบโต" : "Top stores — growth rate"}</h4>
            <p className="mt-1 mb-5 text-xs text-[#6E6E73]">{th ? "วัดเทียบกับฐานผู้ติดตามต้นช่วง" : "Growth relative to each store's starting follower base"}</p>
            <HorizontalBars data={topGrowthPct} tone="green" />
          </div>
          <div className="rounded-[18px] border border-[#E5E5EA] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.035)]">
            <h4 className="text-[15px] font-semibold text-[#1D1D1F]">{th ? "Top สาขา — อัตราบล็อกสูงสุด" : "Highest block-rate stores"}</h4>
            <p className="mt-1 mb-5 text-xs text-[#6E6E73]">{th ? "ใช้สำหรับหา LINE OA ที่ควรทบทวนเนื้อหาหรือความถี่การส่ง" : "Accounts that may need content or messaging-frequency review"}</p>
            <HorizontalBars data={topBlockPct} tone="red" />
          </div>
        </div>
      )}
    </div>
  );
}
