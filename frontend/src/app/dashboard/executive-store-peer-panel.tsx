"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Period = "today" | "7d" | "30d";
type WatchIssue = "reach" | "block" | "inactive";

type StoreHealthRow = {
  storeId: string | null;
  storeMasterId: string;
  storeCode: string | null;
  storeName: string;
  partner: string;
  tier: string | null;
  kpiPlan: string | null;
  area: string | null;
  bm: string | null;
  followers: number;
  start: number;
  growth: number;
  growthPct: number | null;
  reach: number | null;
  reachPct: number | null;
  blocks: number | null;
  blockPct: number | null;
  issues: WatchIssue[];
  peerRank: number | null;
  peerSize: number;
  peerAverageFollowers: number | null;
  needsAttention: boolean;
  isConnected: boolean;
};

type ExecutiveStoreHealth = {
  stores: StoreHealthRow[];
  connectedStoreCount: number;
  totalStoreCount: number;
  scopeStoreCount: number;
  filterOptions: {
    tiers: string[];
    kpiPlans: string[];
    areas: string[];
    bms: string[];
  };
};

type Props = {
  getStoreDisplayName: (name: string) => string;
  onOpenStore: (storeId: string) => void;
};

const ISSUE_LABELS: Record<WatchIssue, string> = {
  reach: "Reach ต่ำ",
  block: "Block สูง",
  inactive: "ยังไม่พร้อม",
};

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0 text-[11px] font-semibold text-[var(--dash-text-secondary)]">
      <span className="mb-1 block">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 text-sm font-medium text-[var(--dash-text)] outline-none focus:border-[var(--dash-accent)]"
      >
        <option value="">ทั้งหมด</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

export function ExecutiveStorePeerPanel({ getStoreDisplayName, onOpenStore }: Props) {
  const [period, setPeriod] = useState<Period>("7d");
  const [tier, setTier] = useState("");
  const [kpiPlan, setKpiPlan] = useState("");
  const [area, setArea] = useState("");
  const [bm, setBm] = useState("");
  const [data, setData] = useState<ExecutiveStoreHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (tier) params.set("tier", tier);
      if (kpiPlan) params.set("kpiPlan", kpiPlan);
      if (area) params.set("area", area);
      if (bm) params.set("bm", bm);
      const response = await fetch(`/api-backend/dashboard/executive-store-health?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Executive peer request failed (${response.status})`);
      setData((await response.json()) as ExecutiveStoreHealth);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [area, bm, kpiPlan, period, tier]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), 60_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [load]);

  const peerRanking = useMemo(() => {
    return [...(data?.stores ?? [])]
      .sort((a, b) =>
        (a.kpiPlan ?? "").localeCompare(b.kpiPlan ?? "") ||
        (a.peerRank ?? Number.MAX_SAFE_INTEGER) - (b.peerRank ?? Number.MAX_SAFE_INTEGER) ||
        b.followers - a.followers,
      )
      .slice(0, 10);
  }, [data]);

  const needsAttention = useMemo(() => {
    return [...(data?.stores ?? [])]
      .filter((store) => store.needsAttention)
      .sort((a, b) =>
        b.issues.length - a.issues.length ||
        (b.peerRank ?? 0) - (a.peerRank ?? 0) ||
        a.followers - b.followers,
      )
      .slice(0, 10);
  }, [data]);

  const filtersActive = Boolean(tier || kpiPlan || area || bm);
  const clearFilters = () => {
    setTier("");
    setKpiPlan("");
    setArea("");
    setBm("");
  };

  return (
    <section className="mb-6 rounded-[18px] border border-[var(--dash-border)] bg-[var(--dash-card)] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--dash-text-tertiary)]">StoreMaster Peer Comparison</div>
          <h2 className="mt-1 text-[15px] font-bold text-[var(--dash-text)]">เปรียบเทียบสาขาตาม Tier และ KPI Plan</h2>
          <p className="mt-1 text-xs text-[var(--dash-text-secondary)]">StoreMaster เป็นข้อมูลหลัก · Ranking เทียบเฉพาะร้านที่อยู่ใน KPI Plan เดียวกัน</p>
        </div>
        <div className="flex items-center gap-2">
          {data && <span className="rounded-full bg-[var(--dash-accent-soft)] px-2.5 py-1 text-[10.5px] font-bold text-[var(--dash-accent)]">{data.totalStoreCount.toLocaleString()} / {data.scopeStoreCount.toLocaleString()} ร้าน</span>}
          {filtersActive && (
            <button type="button" onClick={clearFilters} className="rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-xs font-semibold text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)]">
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <label className="min-w-0 text-[11px] font-semibold text-[var(--dash-text-secondary)]">
          <span className="mb-1 block">ช่วงข้อมูล</span>
          <select value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="h-10 w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 text-sm font-medium text-[var(--dash-text)] outline-none focus:border-[var(--dash-accent)]">
            <option value="today">วันนี้</option>
            <option value="7d">7 วัน</option>
            <option value="30d">30 วัน</option>
          </select>
        </label>
        <SelectFilter label="Tier" value={tier} options={data?.filterOptions.tiers ?? []} onChange={setTier} />
        <SelectFilter label="KPI Plan" value={kpiPlan} options={data?.filterOptions.kpiPlans ?? []} onChange={setKpiPlan} />
        <SelectFilter label="Area" value={area} options={data?.filterOptions.areas ?? []} onChange={setArea} />
        <SelectFilter label="BM" value={bm} options={data?.filterOptions.bms ?? []} onChange={setBm} />
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--dash-red)]/30 bg-[var(--dash-red-soft)] px-3.5 py-3 text-xs text-[var(--dash-red)]">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="font-bold underline">ลองใหม่</button>
        </div>
      )}

      {loading && !data ? (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="h-48 animate-pulse rounded-xl bg-[var(--dash-bg)]" />
          <div className="h-48 animate-pulse rounded-xl bg-[var(--dash-bg)]" />
        </div>
      ) : data ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-[var(--dash-bg)] px-3 py-2.5"><div className="text-[10.5px] text-[var(--dash-text-tertiary)]">ร้านในผลลัพธ์</div><div className="mt-0.5 text-lg font-bold">{data.totalStoreCount.toLocaleString()}</div></div>
            <div className="rounded-xl bg-[var(--dash-bg)] px-3 py-2.5"><div className="text-[10.5px] text-[var(--dash-text-tertiary)]">เชื่อมต่อแล้ว</div><div className="mt-0.5 text-lg font-bold text-[var(--dash-green)]">{data.connectedStoreCount.toLocaleString()}</div></div>
            <div className="rounded-xl bg-[var(--dash-bg)] px-3 py-2.5"><div className="text-[10.5px] text-[var(--dash-text-tertiary)]">Needs Attention</div><div className="mt-0.5 text-lg font-bold text-[var(--dash-red)]">{data.stores.filter((store) => store.needsAttention).length.toLocaleString()}</div></div>
            <div className="rounded-xl bg-[var(--dash-bg)] px-3 py-2.5"><div className="text-[10.5px] text-[var(--dash-text-tertiary)]">ผู้ติดตามรวม</div><div className="mt-0.5 text-lg font-bold">{data.stores.reduce((sum, store) => sum + store.followers, 0).toLocaleString()}</div></div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="min-w-0 overflow-x-auto rounded-xl border border-[var(--dash-border)]">
              <div className="border-b border-[var(--dash-border)] px-3.5 py-3">
                <div className="text-xs font-bold text-[var(--dash-text)]">Same KPI Plan Ranking</div>
                <div className="mt-0.5 text-[10.5px] text-[var(--dash-text-tertiary)]">อันดับไม่ข้าม KPI Plan เพื่อให้เทียบร้านที่มีแผนเดียวกัน</div>
              </div>
              <table className="w-full min-w-[590px] border-collapse text-[12px]">
                <thead><tr className="border-b border-[var(--dash-border)] text-[10px] uppercase text-[var(--dash-text-tertiary)]"><th className="px-3 py-2 text-left">ร้านค้า</th><th className="px-2 py-2 text-left">KPI Plan</th><th className="px-2 py-2 text-right">Peer Rank</th><th className="px-3 py-2 text-right">Followers</th></tr></thead>
                <tbody>
                  {peerRanking.map((store) => (
                    <tr key={store.storeMasterId} className="border-b border-[var(--dash-border)] last:border-b-0 hover:bg-[var(--dash-accent-soft)]">
                      <td className="px-3 py-2.5"><button type="button" disabled={!store.storeId} onClick={() => store.storeId && onOpenStore(store.storeId)} className="max-w-[260px] truncate text-left font-semibold text-[var(--dash-text)] hover:text-[var(--dash-accent)] disabled:cursor-default">{getStoreDisplayName(store.storeName)}</button><div className="mt-0.5 text-[10px] text-[var(--dash-text-tertiary)]">{store.tier ?? "—"} · {store.area ?? "—"}</div></td>
                      <td className="px-2 py-2.5 text-[var(--dash-text-secondary)]">{store.kpiPlan ?? "—"}</td>
                      <td className="px-2 py-2.5 text-right font-bold tabular-nums text-[var(--dash-accent)]">{store.peerRank ? `#${store.peerRank}/${store.peerSize}` : "—"}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{store.followers.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {peerRanking.length === 0 && <div className="py-6 text-center text-xs text-[var(--dash-text-tertiary)]">ไม่พบร้านตามตัวกรอง</div>}
            </div>

            <div className="min-w-0 overflow-x-auto rounded-xl border border-[var(--dash-border)]">
              <div className="border-b border-[var(--dash-border)] px-3.5 py-3">
                <div className="text-xs font-bold text-[var(--dash-text)]">Needs Attention</div>
                <div className="mt-0.5 text-[10.5px] text-[var(--dash-text-tertiary)]">ใช้เกณฑ์เดิม: Reach ต่ำกว่า 80% · Block สูงกว่า 10% · Followers ต่ำกว่า 10</div>
              </div>
              <table className="w-full min-w-[590px] border-collapse text-[12px]">
                <thead><tr className="border-b border-[var(--dash-border)] text-[10px] uppercase text-[var(--dash-text-tertiary)]"><th className="px-3 py-2 text-left">ร้านค้า</th><th className="px-2 py-2 text-left">เหตุผล</th><th className="px-3 py-2 text-right">Peer Rank</th></tr></thead>
                <tbody>
                  {needsAttention.map((store) => (
                    <tr key={store.storeMasterId} className="border-b border-[var(--dash-border)] last:border-b-0 hover:bg-[var(--dash-red-soft)]">
                      <td className="px-3 py-2.5"><button type="button" disabled={!store.storeId} onClick={() => store.storeId && onOpenStore(store.storeId)} className="max-w-[260px] truncate text-left font-semibold text-[var(--dash-text)] hover:text-[var(--dash-accent)] disabled:cursor-default">{getStoreDisplayName(store.storeName)}</button><div className="mt-0.5 text-[10px] text-[var(--dash-text-tertiary)]">{store.kpiPlan ?? "—"} · BM {store.bm ?? "—"}</div></td>
                      <td className="px-2 py-2.5"><div className="flex flex-wrap gap-1">{store.issues.map((issue) => <span key={issue} className="rounded-full bg-[var(--dash-red-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--dash-red)]">{ISSUE_LABELS[issue]}</span>)}</div></td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums">{store.peerRank ? `#${store.peerRank}/${store.peerSize}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {needsAttention.length === 0 && <div className="py-6 text-center text-xs text-[var(--dash-text-tertiary)]">ไม่มีร้านที่เข้าเกณฑ์ Needs Attention</div>}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
