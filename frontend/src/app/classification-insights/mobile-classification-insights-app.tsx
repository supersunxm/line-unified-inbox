"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MobileBottomNav,
  MobileCard,
  MobileEmptyState,
  MobileListCard,
  MobileMetricCard,
  MobileMetricGrid,
  MobileMoreSheet,
  MobilePageHeader,
  MobilePageShell,
  MobileSection,
  MobileSectionTabs,
} from "@/components/mobile/adaptive-mobile";
import { api } from "@/lib/api";
import type { ClassificationInsightsResponse } from "@/types/api";

type AuthUser = { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" };
type Tab = "overview" | "ranking" | "review" | "catalog";
const number = new Intl.NumberFormat("en-US");

function pct(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

export function MobileClassificationInsightsApp() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [data, setData] = useState<ClassificationInsightsResponse | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void api.me().then((value) => { if (active) setUser(value); }).catch(() => window.location.replace("/login")).finally(() => { if (active) setAuthChecked(true); });
    return () => { active = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.classificationInsights()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "โหลดข้อมูล Classification ไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user) void load(); }, [load, user]);

  const topProducts = useMemo(() => data?.productRanking.slice(0, 20) ?? [], [data]);

  if (!authChecked || !user) return <main className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">กำลังเปิด Classification Insights...</main>;

  return (
    <MobilePageShell bottomNav={<MobileBottomNav current="more" onMore={() => setMoreOpen(true)} />}>
      <MobilePageHeader eyebrow="AI · Classification" title="ข้อมูลการจำแนก" description="Coverage, product ranking และรายการที่ควรตรวจสอบ" action={<button type="button" onClick={() => void load()} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--app-border)]">↻</button>} />
      <MobileSectionTabs<Tab> value={tab} items={[{ value: "overview", label: "ภาพรวม" }, { value: "ranking", label: "สินค้า" }, { value: "review", label: "ตรวจสอบ", badge: data?.reviewQueue.length || undefined }, { value: "catalog", label: "Catalog" }]} onChange={setTab} />
      <div className="space-y-4 px-4 py-4 pb-8">
        {error && <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-600">{error}</div>}
        {loading && !data ? <MobileCard><p className="py-10 text-center text-xs text-[var(--app-text-secondary)]">กำลังโหลด...</p></MobileCard> : data && (
          <>
            {tab === "overview" && <Overview data={data} />}
            {tab === "ranking" && <Ranking data={data} items={topProducts} />}
            {tab === "review" && <ReviewQueue data={data} />}
            {tab === "catalog" && <Catalog data={data} />}
          </>
        )}
      </div>
      {moreOpen && <MobileMoreSheet displayName={user.displayName} role={user.role} onClose={() => setMoreOpen(false)} />}
    </MobilePageShell>
  );
}

function Overview({ data }: { data: ClassificationInsightsResponse }) {
  return <div className="space-y-4">
    <MobileMetricGrid>
      <MobileMetricCard label="Text Eligible" value={number.format(data.coverage.textEligibleConversations)} wide />
      <MobileMetricCard label="Classified" value={number.format(data.coverage.classifiedConversations)} tone="accent" />
      <MobileMetricCard label="Coverage" value={pct(data.coverage.coverageRate)} tone={data.coverage.coverageRate >= 90 ? "success" : "warning"} />
      <MobileMetricCard label="Rule" value={number.format(data.coverage.ruleClassified)} />
      <MobileMetricCard label="Manual" value={number.format(data.coverage.manualClassified)} />
    </MobileMetricGrid>

    <MobileSection title="Classification Funnel" description={data.definitions.eligibleDefinition}>
      <MobileCard className="space-y-3">{data.funnel.map((item) => <div key={item.key} className="flex items-center justify-between gap-3 border-b border-[var(--app-border-subtle)] pb-3 last:border-0 last:pb-0"><div className="min-w-0"><p className="truncate text-xs font-bold">{item.key.replaceAll("_", " ")}</p><p className="mt-0.5 text-[10px] text-[var(--app-text-tertiary)]">{pct(item.percentageOfEligible)}</p></div><span className="text-lg font-bold tabular-nums">{number.format(item.count)}</span></div>)}</MobileCard>
    </MobileSection>

    <MobileSection title="จุดที่ควรติดตาม">
      <div className="grid grid-cols-2 gap-2.5"><MobileMetricCard label="No Product" value={data.coverage.noProduct} tone={data.coverage.noProduct > 0 ? "warning" : "default"} /><MobileMetricCard label="High Intent / No Product" value={data.coverage.highIntentWithoutProduct} tone={data.coverage.highIntentWithoutProduct > 0 ? "danger" : "default"} /><MobileMetricCard label="Compact Matches" value={data.compactMonitoring.totalCompactMatches} /><MobileMetricCard label="Mixed Source" value={data.coverage.mixedSource} /></div>
    </MobileSection>
  </div>;
}

function Ranking({ data, items }: { data: ClassificationInsightsResponse; items: ClassificationInsightsResponse["productRanking"] }) {
  return <MobileSection title="Product Ranking" description={`${data.productRanking.length} รุ่นที่ถูกจำแนก`}>
    {items.length === 0 ? <MobileEmptyState title="ยังไม่มี Product Ranking" /> : <div className="space-y-2.5">{items.map((item, index) => <MobileListCard key={item.productModelId} title={item.modelName} subtitle={`${item.familyName} · ${item.productGroup}`} leading={<span className={`flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold ${index < 3 ? "bg-[var(--app-accent)]/10 text-[var(--app-accent)]" : "bg-[var(--app-surface-subtle)]"}`}>#{index + 1}</span>} trailing={<span className="text-base font-bold tabular-nums">{number.format(item.conversationCount)}</span>}><div className="grid grid-cols-3 gap-2"><MiniStat label="Rule" value={item.ruleCount} /><MiniStat label="Manual" value={item.manualCount} /><MiniStat label="Compact" value={item.compactCount} /></div></MobileListCard>)}</div>}
  </MobileSection>;
}

function ReviewQueue({ data }: { data: ClassificationInsightsResponse }) {
  return <MobileSection title="Review Queue" description="Conversation ที่ระบบแนะนำให้ตรวจสอบ">
    {data.reviewQueue.length === 0 ? <MobileEmptyState title="ไม่มีรายการรอตรวจ" description="Classification ปัจจุบันไม่มีรายการที่เข้าเงื่อนไข review" /> : <div className="space-y-2.5">{data.reviewQueue.map((item) => <MobileListCard key={item.conversationId} title={item.store.name} subtitle={`${item.lineOa.name} · ${new Date(item.latestMessageAt).toLocaleString("th-TH")}`} trailing={<Link href={`/chats?conversationId=${encodeURIComponent(item.conversationId)}`} className="rounded-lg bg-[var(--app-accent)] px-2.5 py-2 text-[10px] font-bold text-white">เปิดแชท</Link>}><div className="flex flex-wrap gap-1.5">{item.reasonCodes.map((reason) => <span key={reason} className="rounded-lg bg-amber-500/10 px-2 py-1 text-[9px] font-semibold text-amber-600 dark:text-amber-400">{reason.replaceAll("_", " ")}</span>)}{item.purchaseIntent && <span className="rounded-lg bg-[var(--app-surface-subtle)] px-2 py-1 text-[9px] font-semibold">Intent: {item.purchaseIntent}</span>}</div>{item.topics.length > 0 && <p className="mt-2 text-[10px] text-[var(--app-text-tertiary)]">Topics: {item.topics.join(", ")}</p>}</MobileListCard>)}</div>}
  </MobileSection>;
}

function Catalog({ data }: { data: ClassificationInsightsResponse }) {
  const c = data.catalogHealth;
  return <div className="space-y-4">
    <MobileSection title="Catalog Health">
      <MobileMetricGrid><MobileMetricCard label="Active Models" value={c.activeModels} tone="success" /><MobileMetricCard label="Inactive Models" value={c.inactiveModels} /><MobileMetricCard label="Active Aliases" value={c.activeAliases} /><MobileMetricCard label="No Active Alias" value={c.modelsWithoutActiveCatalogAliases} tone={c.modelsWithoutActiveCatalogAliases > 0 ? "warning" : "default"} /></MobileMetricGrid>
    </MobileSection>
    <MobileSection title="Alias Safety">
      <MobileCard className="space-y-3"><Row label="Safe exact" value={c.safeExactDeclarations} /><Row label="Safe compact" value={c.safeCompactDeclarations} /><Row label="Review required" value={c.reviewRequiredDeclarations} /><Row label="Blocked" value={c.blockedDeclarations} /></MobileCard>
    </MobileSection>
    <MobileSection title="Compact Monitoring" description={`% of rule matches: ${pct(data.compactMonitoring.percentageOfRuleMatches)}`}>
      {data.compactMonitoring.aliases.length === 0 ? <MobileEmptyState title="ยังไม่มี compact alias evidence" /> : <div className="space-y-2.5">{data.compactMonitoring.aliases.slice(0, 30).map((alias) => <MobileListCard key={`${alias.matchedPhrase}-${alias.modelName}`} title={alias.matchedPhrase} subtitle={`→ ${alias.modelName}`} trailing={<span className="text-sm font-bold">{alias.count}</span>}><p className="text-[10px] text-[var(--app-text-tertiary)]">{alias.safetyClass}{alias.latestEvidenceAt ? ` · ล่าสุด ${new Date(alias.latestEvidenceAt).toLocaleDateString("th-TH")}` : ""}</p></MobileListCard>)}</div>}
    </MobileSection>
  </div>;
}

function MiniStat({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-[var(--app-surface-subtle)] px-2 py-2"><p className="text-[9px] text-[var(--app-text-tertiary)]">{label}</p><p className="mt-0.5 text-sm font-bold tabular-nums">{number.format(value)}</p></div>; }
function Row({ label, value }: { label: string; value: number }) { return <div className="flex items-center justify-between border-b border-[var(--app-border-subtle)] pb-3 last:border-0 last:pb-0"><span className="text-xs text-[var(--app-text-secondary)]">{label}</span><span className="text-sm font-bold tabular-nums">{number.format(value)}</span></div>; }
