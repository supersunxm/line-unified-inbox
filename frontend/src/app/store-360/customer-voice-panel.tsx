"use client";

import { useState } from "react";
import Link from "next/link";
import type { StoreInsightsCustomerVoice, StoreInsightsCustomerVoiceItem } from "@/types/api";
import { customerVoiceDrilldownHref } from "./customer-voice-utils";

type CustomerVoicePanelProps = {
  data: StoreInsightsCustomerVoice | null;
  loading: boolean;
  error: string | null;
  storeId: string;
  from: string;
  to: string;
};

type VoiceTab = "topics" | "intents" | "products";

function percent(value: number | null) {
  return value === null ? "No data available" : Math.round(value * 100) + "%";
}

function RankList({ items, dimension, storeId, from, to }: { items: StoreInsightsCustomerVoiceItem[]; dimension: "topic" | "intent" | "product"; storeId: string; from: string; to: string }) {
  if (items.length === 0) return <p className="text-xs text-[var(--app-text-tertiary)]">No Customer Voice results for this period.</p>;
  return (
    <ol className="space-y-0.5">
      {items.slice(0, 5).map((item, index) => {
        const content = <><span className="flex min-w-0 items-center gap-1.5"><span className="w-4 shrink-0 text-[10px] font-bold text-[var(--app-text-tertiary)]">{index + 1}</span><span className="min-w-0 truncate text-xs font-semibold text-[var(--app-text-primary)]">{item.label}</span></span><span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--app-text-secondary)]">{item.count.toLocaleString()} · {percent(item.percentage)}</span></>;
        return <li key={item.label}><Link href={customerVoiceDrilldownHref(storeId, from, to, dimension, item.label)} className="block w-full rounded-xl px-1.5 py-0.5 text-left transition-colors hover:bg-[var(--app-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40"><span className="flex items-center justify-between gap-2">{content}</span><span className="ml-5 mt-0.5 block h-1 overflow-hidden rounded-full bg-[var(--app-surface-subtle)]"><span className="block h-full rounded-full bg-[var(--app-accent)]" style={{ width: Math.max(5, item.percentage * 100) + "%" }} /></span></Link></li>;
      })}
    </ol>
  );
}

function Coverage({ coverage }: { coverage: StoreInsightsCustomerVoice["coverage"] }) {
  const values = [["Eligible conversations", coverage.totalConversations], ["Analyzed", coverage.analyzedConversations], ["Classified", coverage.classifiedConversations], ["Unclassified", coverage.unclassifiedConversations], ["Not analyzed", coverage.notAnalyzedConversations]] as const;
  return <div className="rounded-xl bg-[var(--app-surface-subtle)] px-2.5 py-2"><div className="flex items-center justify-between gap-3"><span className="text-[11px] font-semibold text-[var(--app-text-primary)]">Current-version coverage</span><span className="text-sm font-bold tabular-nums text-[var(--app-accent)]">{percent(coverage.classifiedPercentage)}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--app-border-subtle)]"><div className="h-full rounded-full bg-[var(--app-accent)]" style={{ width: (coverage.classifiedPercentage === null ? 0 : coverage.classifiedPercentage * 100) + "%" }} /></div><div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[10px] leading-4 text-[var(--app-text-tertiary)]"><span>{values[0][1].toLocaleString()} eligible</span><span aria-hidden="true">·</span><span>{values[1][1].toLocaleString()} analyzed</span><span aria-hidden="true">·</span><span>{values[2][1].toLocaleString()} classified</span><span aria-hidden="true">·</span><span>{values[3][1].toLocaleString()} unclassified</span><span aria-hidden="true">·</span><span>{values[4][1].toLocaleString()} not analyzed</span></div><p className="mt-0.5 text-[10px] leading-4 text-[var(--app-text-tertiary)]">Classified / eligible; current analysis only.</p></div>;
}

export function CustomerVoicePanel({ data, loading, error, storeId, from, to }: CustomerVoicePanelProps) {
  const [tab, setTab] = useState<VoiceTab>("topics");
  const visibleItems = !data ? [] : tab === "topics" ? data.topTopics : tab === "intents" ? data.topIntents : data.topProducts;
  const tabLabel = tab === "topics" ? "Top Topics" : tab === "intents" ? "Intent" : "Product Interest";
  return (
    <section className="flex min-h-[360px] flex-col rounded-2xl border border-[var(--app-border-subtle)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-sm)] sm:p-5" aria-labelledby="customer-voice-title">
      <div className="mb-3 flex items-start justify-between gap-3"><div className="min-w-0"><h2 id="customer-voice-title" className="text-[17px] font-bold tracking-[-0.02em] text-[var(--app-text-primary)]">Customer Voice</h2><p className="mt-1 text-xs text-[var(--app-text-tertiary)]">What customers are talking about this period.</p></div><div className="flex shrink-0 items-center gap-2"><Link href={customerVoiceDrilldownHref(storeId, from, to)} className="text-[10px] font-semibold text-[var(--app-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40">Explore <span aria-hidden="true">→</span></Link><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--app-purple-soft)] text-[var(--app-purple)]" aria-hidden="true">✦</span></div></div>
      {loading ? <div className="space-y-3"><div className="h-14 animate-pulse rounded-xl bg-[var(--app-surface-subtle)]" /><div className="space-y-2">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-7 animate-pulse rounded-lg bg-[var(--app-surface-subtle)]" />)}</div></div> : error ? <div className="rounded-xl bg-[var(--app-danger-soft)] p-4"><p className="text-sm font-semibold text-[var(--app-danger)]">Customer Voice is temporarily unavailable</p><p className="mt-1 text-xs leading-5 text-[var(--app-text-secondary)]">{error}</p></div> : !data ? <div className="rounded-xl bg-[var(--app-surface-subtle)] p-4 text-xs leading-5 text-[var(--app-text-tertiary)]">Customer Voice analysis is not available yet.</div> : <><Coverage coverage={data.coverage} />{data.coverage.classifiedConversations === 0 ? <div className="mt-3 rounded-xl bg-[var(--app-surface-subtle)] p-4"><p className="text-sm font-semibold text-[var(--app-text-primary)]">Customer Voice analysis not available yet</p><p className="mt-1 text-xs leading-5 text-[var(--app-text-secondary)]">No classified customer conversations are persisted for this period. The page does not invent topics or classify synchronously.</p></div> : <><div className="mt-3 flex rounded-xl bg-[var(--app-surface-subtle)] p-1" role="tablist" aria-label="Customer Voice views">{([["topics", "Top Topics"], ["intents", "Intent"], ["products", "Product Interest"]] as Array<[VoiceTab, string]>).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={"min-w-0 flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors " + (tab === value ? "bg-[var(--app-surface)] text-[var(--app-accent)] shadow-sm" : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]")}>{label}</button>)}</div><div className="mt-3"><div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-xs font-semibold text-[var(--app-text-primary)]">{tabLabel}</h3>{tab === "products" && <span className="text-[10px] text-[var(--app-text-tertiary)]">From conversations</span>}</div><RankList items={visibleItems} dimension={tab === "topics" ? "topic" : tab === "intents" ? "intent" : "product"} storeId={storeId} from={from} to={to} /></div></>}</>}
    </section>
  );
}
