"use client";

import { useMemo, useState } from "react";
import type { ByStoreAccountRow } from "@/types/api";
import type { Language } from "./follower-insights-translations";

type MetricRow = {
  store: string;
  followers: number;
  startFollowers: number | null;
  growth: number | null;
  growthPct: number | null;
  reach: number | null;
  reachPct: number | null;
  blocks: number | null;
  blockPct: number | null;
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

function HorizontalBars({ data, tone, emptyText }: { data: BarDatum[]; tone: "green" | "red"; emptyText: string }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  const barClass = tone === "green" ? "bg-[#00A651]" : "bg-[#FF3B30]";
  if (data.length === 0) return <div className="flex h-[260px] items-center justify-center text-sm text-[#6E6E73]">{emptyText}</div>;
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
  const validRows = useMemo(() => rows.filter((row): row is MetricRow & { reachPct: number } => row.reachPct !== null), [rows]);
  const buckets = useMemo(() => {
    const values = [
      { key: "lt60", label: "<60%", min: 0, max: 60, className: "bg-[#FF3B30]" },
      { key: "60to70", label: "60–70%", min: 60, max: 70, className: "bg-[#FF9500]" },
      { key: "70to80", label: "70–80%", min: 70, max: 80, className: "bg-[#FFCC00]" },
      { key: "80to90", label: "80–90%", min: 80, max: 90, className: "bg-[#7BC67E]" },
      { key: "90to100", label: "90–100%", min: 90, max: 101, className: "bg-[#00A651]" },
    ];
    return values.map((bucket) => ({ ...bucket, count: validRows.filter((row) => row.reachPct >= bucket.min && row.reachPct < bucket.max).length }));
  }, [validRows]);
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  if (validRows.length === 0) {
    return <div className="flex h-[260px] items-center justify-center text-sm text-[#6E6E73]">{language === "th" ? "ไม่มีข้อมูล Reach ในช่วงที่เลือก" : "No reach data for this period"}</div>;
  }
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
    </div>
  );
}

export function StoreAnalyticsOverview({ storeData, endpointsUsable, language = "en" }: { storeData: ByStoreAccountRow[]; endpointsUsable: boolean; language?: Language }) {
  const [showAllCharts, setShowAllCharts] = useState(true);
  const rows = useMemo<MetricRow[]>(() => storeData.flatMap((row) => {
    if (row.followers === null) return [];

    const startFollowers = row.startFollowers;
    const periodIncrease = row.periodIncrease;
    const canCompare = endpointsUsable && startFollowers !== null && periodIncrease !== null;
    const growthPct = canCompare
      ? startFollowers > 0
        ? pct(periodIncrease, startFollowers, 2)
        : periodIncrease === 0
          ? 0
          : null
      : null;

    return [{
      store: row.storeName,
      followers: row.followers,
      startFollowers: canCompare ? startFollowers : null,
      growth: canCompare ? periodIncrease : null,
      growthPct,
      reach: row.targetedReaches,
      reachPct: row.targetedReaches === null ? null : pct(row.targetedReaches, row.followers, 1),
      blocks: row.blocks,
      blockPct: row.blocks === null ? null : pct(row.blocks, row.followers, 1),
    }];
  }), [storeData, endpointsUsable]);

  const totals = useMemo(() => {
    const followers = rows.reduce((sum, row) => sum + row.followers, 0);
    const comparableRows = rows.filter((row): row is MetricRow & { startFollowers: number; growth: number; growthPct: number } => row.startFollowers !== null && row.growth !== null && row.growthPct !== null);
    const start = comparableRows.reduce((sum, row) => sum + row.startFollowers, 0);
    const growth = comparableRows.reduce((sum, row) => sum + row.growth, 0);
    const reachRows = rows.filter((row): row is MetricRow & { reach: number; reachPct: number } => row.reach !== null && row.reachPct !== null);
    const blockRows = rows.filter((row): row is MetricRow & { blocks: number; blockPct: number } => row.blocks !== null && row.blockPct !== null);
    const reachFollowers = reachRows.reduce((sum, row) => sum + row.followers, 0);
    const blockFollowers = blockRows.reduce((sum, row) => sum + row.followers, 0);
    const reach = reachRows.reduce((sum, row) => sum + row.reach, 0);
    const blocks = blockRows.reduce((sum, row) => sum + row.blocks, 0);
    return {
      followers,
      growth,
      growthPct: start > 0 ? pct(growth, start, 2) : null,
      reachPct: reachFollowers > 0 ? pct(reach, reachFollowers, 1) : null,
      blockPct: blockFollowers > 0 ? pct(blocks, blockFollowers, 1) : null,
      zeroGrowth: comparableRows.filter((row) => row.growth === 0).length,
      lowReach: reachRows.filter((row) => row.reachPct < 80).length,
      highBlock: blockRows.filter((row) => row.blockPct > 10).length,
      comparableCoverage: comparableRows.length,
      reachCoverage: reachRows.length,
      blockCoverage: blockRows.length,
    };
  }, [rows]);

  const topGrowth = useMemo(() => rows.filter((row): row is MetricRow & { growth: number } => row.growth !== null && row.growth > 0).sort((a, b) => b.growth - a.growth).slice(0, 12).map((row) => ({ label: row.store, value: row.growth, display: `+${row.growth.toLocaleString()}` })), [rows]);
  const topGrowthPct = useMemo(() => rows.filter((row): row is MetricRow & { growthPct: number } => row.growthPct !== null && row.growthPct > 0).sort((a, b) => b.growthPct - a.growthPct).slice(0, 12).map((row) => ({ label: row.store, value: row.growthPct, display: `${row.growthPct.toFixed(2)}%` })), [rows]);
  const topBlockPct = useMemo(() => rows.filter((row): row is MetricRow & { blockPct: number } => row.blockPct !== null && row.blockPct > 0).sort((a, b) => b.blockPct - a.blockPct).slice(0, 12).map((row) => ({ label: row.store, value: row.blockPct, display: `${row.blockPct.toFixed(1)}%` })), [rows]);

  const th = language === "th";
  const noComparable = th ? "ไม่มีข้อมูลเปรียบเทียบในช่วงที่เลือก" : "No comparable data for this period";
  const growthValue = totals.growthPct === null ? "—" : `${totals.growth > 0 ? "+" : ""}${totals.growth.toLocaleString()}`;
  const growthPctValue = totals.growthPct === null ? "—" : `${totals.growthPct.toFixed(2)}%`;
  const reachValue = totals.reachPct === null ? "—" : `${totals.reachPct.toFixed(1)}%`;
  const blockValue = totals.blockPct === null ? "—" : `${totals.blockPct.toFixed(1)}%`;
  const growthTone = totals.growthPct === null ? "default" : totals.growth >= 0 ? "green" : "red";
  const reachTone = totals.reachPct === null ? "default" : totals.reachPct >= 85 ? "green" : totals.reachPct >= 75 ? "amber" : "red";
  const blockTone = totals.blockPct === null ? "default" : totals.blockPct <= 5 ? "green" : totals.blockPct <= 10 ? "amber" : "red";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label={th ? "ผู้ติดตามรวม" : "Total followers"} value={totals.followers.toLocaleString()} detail={th ? `${rows.length} LINE OA ที่มีข้อมูล` : `${rows.length} LINE OA accounts with data`} />
        <MetricCard label={th ? "เพิ่มขึ้นในช่วง" : "Period growth"} value={growthValue} detail={th ? `เทียบได้ ${totals.comparableCoverage}/${rows.length} สาขา` : `Comparable ${totals.comparableCoverage}/${rows.length} stores`} tone={growthTone} />
        <MetricCard label={th ? "อัตราการเติบโต" : "Growth rate"} value={growthPctValue} detail={th ? `${totals.zeroGrowth} สาขาไม่เติบโต · เฉพาะสาขาที่เทียบได้` : `${totals.zeroGrowth} no-growth stores · comparable only`} tone={growthTone} />
        <MetricCard label={th ? "อัตราการเข้าถึง" : "Reach rate"} value={reachValue} detail={th ? `${totals.lowReach} สาขาต่ำกว่า 80% · มีข้อมูล ${totals.reachCoverage}/${rows.length}` : `${totals.lowReach} below 80% · coverage ${totals.reachCoverage}/${rows.length}`} tone={reachTone} />
        <MetricCard label={th ? "อัตราบล็อก" : "Block rate"} value={blockValue} detail={th ? `${totals.highBlock} สาขาสูงกว่า 10% · มีข้อมูล ${totals.blockCoverage}/${rows.length}` : `${totals.highBlock} above 10% · coverage ${totals.blockCoverage}/${rows.length}`} tone={blockTone} />
      </div>

      <div className="flex items-center justify-between gap-3 px-1 pt-1">
        <div>
          <h3 className="text-[15px] font-semibold text-[#1D1D1F]">{th ? "Performance Analytics" : "Performance analytics"}</h3>
          <p className="mt-0.5 text-xs text-[#6E6E73]">{th ? "ดูสาขาที่เติบโตดี การกระจาย Reach และความเสี่ยงจาก Block" : "Growth leaders, reach distribution and block-rate risk"}</p>
        </div>
        <button type="button" onClick={() => setShowAllCharts((value) => !value)} className="shrink-0 rounded-lg border border-[#E5E5EA] bg-white px-3 py-1.5 text-xs font-semibold text-[#6E6E73] hover:border-[#00A651] hover:text-[#008F46]">
          {showAllCharts ? (th ? "ย่อกราฟ" : "Collapse") : (th ? "แสดงกราฟ" : "Show charts")}
        </button>
      </div>

      {showAllCharts && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
          <div className="rounded-[18px] border border-[#E5E5EA] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.035)]">
            <h4 className="text-[15px] font-semibold text-[#1D1D1F]">{th ? "Top สาขา — ผู้ติดตามเพิ่มขึ้น" : "Top stores — follower growth"}</h4>
            <p className="mt-1 mb-5 text-xs text-[#6E6E73]">{th ? "เรียงตามจำนวนผู้ติดตามที่เพิ่มขึ้นสูงสุด เฉพาะสาขาที่มี baseline ครบ" : "Highest absolute growth among stores with a valid baseline"}</p>
            <HorizontalBars data={topGrowth} tone="green" emptyText={noComparable} />
          </div>
          <div className="rounded-[18px] border border-[#E5E5EA] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.035)]">
            <h4 className="text-[15px] font-semibold text-[#1D1D1F]">{th ? "การกระจายอัตราการเข้าถึง" : "Reach-rate distribution"}</h4>
            <p className="mt-1 text-xs text-[#6E6E73]">{th ? "จำนวนสาขาในแต่ละช่วง % Reach (เฉพาะสาขาที่มีข้อมูล)" : "Stores in each reach bucket (available data only)"}</p>
            <ReachDistribution rows={rows} language={language} />
          </div>
          <div className="rounded-[18px] border border-[#E5E5EA] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.035)]">
            <h4 className="text-[15px] font-semibold text-[#1D1D1F]">{th ? "Top สาขา — อัตราการเติบโต" : "Top stores — growth rate"}</h4>
            <p className="mt-1 mb-5 text-xs text-[#6E6E73]">{th ? "วัดเทียบกับฐานผู้ติดตามต้นช่วง เฉพาะสาขาที่เปรียบเทียบได้" : "Growth relative to the starting base for comparable stores"}</p>
            <HorizontalBars data={topGrowthPct} tone="green" emptyText={noComparable} />
          </div>
          <div className="rounded-[18px] border border-[#E5E5EA] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.035)]">
            <h4 className="text-[15px] font-semibold text-[#1D1D1F]">{th ? "Top สาขา — อัตราบล็อกสูงสุด" : "Highest block-rate stores"}</h4>
            <p className="mt-1 mb-5 text-xs text-[#6E6E73]">{th ? "หา LINE OA ที่ควรทบทวนเนื้อหาหรือความถี่การส่ง (เฉพาะสาขาที่มีข้อมูล)" : "Accounts that may need content or frequency review (available data only)"}</p>
            <HorizontalBars data={topBlockPct} tone="red" emptyText={noComparable} />
          </div>
        </div>
      )}
    </div>
  );
}
