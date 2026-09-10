"use client";

import type { StoreInsightsCustomerVoice, StoreInsightsCustomerVoiceItem } from "@/types/api";

type CustomerVoicePanelProps = {
  data: StoreInsightsCustomerVoice | null;
  loading: boolean;
  selectedTopic: string | null;
  onTopicSelect: (topic: string) => void;
};

function surfaceClass() {
  return "rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-sm)]";
}

function percent(value: number | null) {
  return value === null ? "No data available" : `${Math.round(value * 100)}%`;
}

function trendLabel(item: StoreInsightsCustomerVoiceItem) {
  if (item.trend === "NO_COMPARISON") return null;
  if (item.trend === "NEW") return "New";
  if (item.trend === "FLAT") return "Flat";
  return `${item.trend === "UP" ? "↑" : "↓"} ${item.changePercentage === null ? "" : percent(item.changePercentage)}`.trim();
}

function RankList({ items, clickable, selectedTopic, onTopicSelect }: { items: StoreInsightsCustomerVoiceItem[]; clickable?: boolean; selectedTopic: string | null; onTopicSelect: (topic: string) => void }) {
  if (items.length === 0) return <p className="text-xs text-[var(--app-text-tertiary)]">No data available</p>;
  return (
    <ul className="space-y-2">
      {items.slice(0, 6).map((item) => {
        const trend = trendLabel(item);
        const content = (
          <>
            <span className="min-w-0 truncate font-medium text-[var(--app-text-secondary)]">{item.label}</span>
            <span className="flex shrink-0 items-center gap-2 tabular-nums"><span className="text-[var(--app-text-primary)]">{item.count.toLocaleString()} · {percent(item.percentage)}</span>{trend && <span className={`text-[10px] font-semibold ${item.trend === "DOWN" ? "text-[var(--app-danger)]" : item.trend === "FLAT" ? "text-[var(--app-text-tertiary)]" : "text-[var(--app-success)]"}`}>{trend}</span>}</span>
          </>
        );
        return clickable ? (
          <li key={item.label}>
            <button type="button" aria-pressed={selectedTopic === item.label} onClick={() => onTopicSelect(item.label)} className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-[var(--app-surface-hover)] ${selectedTopic === item.label ? "bg-[var(--app-accent-soft)] ring-1 ring-[var(--app-accent)]" : ""}`}>{content}</button>
          </li>
        ) : <li key={item.label} className="flex items-center justify-between gap-3 text-xs">{content}</li>;
      })}
    </ul>
  );
}

function Coverage({ coverage }: { coverage: StoreInsightsCustomerVoice["coverage"] }) {
  const values = [
    ["Eligible conversations", coverage.totalConversations],
    ["Analyzed", `${coverage.analyzedConversations.toLocaleString()} · ${percent(coverage.analyzedPercentage)}`],
    ["Classified", `${coverage.classifiedConversations.toLocaleString()} · ${percent(coverage.classifiedPercentage)}`],
    ["Persisted topic", coverage.persistedTopicConversations],
    ["Rule enriched", coverage.ruleEnrichedConversations],
    ["AI enriched", coverage.aiEnrichedConversations],
    ["Unclassified", coverage.unclassifiedConversations],
    ["Low confidence", coverage.lowConfidenceConversations],
  ] as const;
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{values.map(([label, value]) => <div key={label} className="rounded-xl bg-[var(--app-surface-subtle)] px-3 py-2"><div className="text-[10px] text-[var(--app-text-tertiary)]">{label}</div><div className="mt-1 text-sm font-semibold tabular-nums text-[var(--app-text-primary)]">{typeof value === "number" ? value.toLocaleString() : value}</div></div>)}</div>;
}

export function CustomerVoicePanel({ data, loading, selectedTopic, onTopicSelect }: CustomerVoicePanelProps) {
  return (
    <section className={`${surfaceClass()} p-5 sm:p-6`} aria-labelledby="customer-voice-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="customer-voice-title" className="text-base font-semibold text-[var(--app-text-primary)]">Customer Voice</h2>
          <p className="mt-1 text-xs text-[var(--app-text-tertiary)]">What customers are talking about in the selected store and period.</p>
        </div>
        {data?.comparisonPeriod && <span className="text-[11px] text-[var(--app-accent)]">Compared with {data.comparisonPeriod.from} → {data.comparisonPeriod.to}</span>}
      </div>
      {loading ? <div className="grid gap-3 sm:grid-cols-3"><div className="h-28 animate-pulse rounded-xl bg-[var(--app-surface-subtle)]" /><div className="h-28 animate-pulse rounded-xl bg-[var(--app-surface-subtle)]" /><div className="h-28 animate-pulse rounded-xl bg-[var(--app-surface-subtle)]" /></div> : !data ? <p className="text-xs text-[var(--app-text-tertiary)]">Customer Voice analysis is not available yet.</p> : <>
        <Coverage coverage={data.coverage} />
        {data.coverage.classifiedConversations === 0 ? <div className="mt-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4"><p className="text-sm font-semibold text-[var(--app-text-primary)]">Customer Voice analysis not available yet</p><p className="mt-1 text-xs leading-5 text-[var(--app-text-secondary)]">No classified customer conversations are persisted for this period. The page does not invent topics or classify synchronously.</p></div> : <div className="mt-5 grid gap-5 lg:grid-cols-3"><div><h3 className="mb-2 text-xs font-semibold text-[var(--app-text-primary)]">Top topics</h3><RankList items={data.topTopics} clickable selectedTopic={selectedTopic} onTopicSelect={onTopicSelect} /><p className="mt-2 text-[10px] text-[var(--app-text-tertiary)]">Select a topic to filter Conversation Explorer.</p></div><div><h3 className="mb-2 text-xs font-semibold text-[var(--app-text-primary)]">Top intents</h3><RankList items={data.topIntents} selectedTopic={selectedTopic} onTopicSelect={onTopicSelect} /></div><div><h3 className="mb-2 text-xs font-semibold text-[var(--app-text-primary)]">Product mentions</h3><RankList items={data.topProducts} selectedTopic={selectedTopic} onTopicSelect={onTopicSelect} /></div></div>}
      </>}
    </section>
  );
}
