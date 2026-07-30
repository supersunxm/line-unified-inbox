"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ClassificationInsightsResponse } from "@/types/api";
import {
  ClassificationInsightsLanguage,
  getClassificationInsightsText,
} from "./classification-insights-translations";

function formatDate(value: string | null, language: ClassificationInsightsLanguage) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="app-card p-4">
      <p className="app-muted text-xs font-medium">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

export function ClassificationInsightsView({ language }: { language: ClassificationInsightsLanguage }) {
  const text = getClassificationInsightsText(language);
  const [data, setData] = useState<ClassificationInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.classificationInsights());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : text.error);
    } finally {
      setLoading(false);
    }
  }, [text.error]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (loading && !data) {
    return <div className="app-card p-8 text-center app-muted">{text.loading}</div>;
  }

  if (error && !data) {
    return (
      <div role="alert" className="app-card border-red-200 p-6 text-red-700 dark:border-red-900 dark:text-red-300">
        <p className="font-medium">{text.error}</p>
        <p className="mt-1 text-sm">{error}</p>
        <button type="button" onClick={() => void load()} className="app-button-secondary mt-4 rounded-lg border px-3 py-2 text-sm">
          {text.retry}
        </button>
      </div>
    );
  }

  if (!data) return null;
  const number = new Intl.NumberFormat(language);
  const maximumFunnel = Math.max(1, ...data.funnel.map(({ count }) => count));

  return (
    <section data-classification-insights className="space-y-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{text.title}</h1>
          <p className="app-muted mt-1 text-sm">{text.subtitle}</p>
        </div>
        <p className="app-muted text-xs">
          {text.generatedAt}: <time dateTime={data.generatedAt}>{formatDate(data.generatedAt, language)}</time>
        </p>
      </header>

      <div data-insights-kpis className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label={text.textEligible} value={number.format(data.coverage.textEligibleConversations)} />
        <MetricCard label={text.classified} value={number.format(data.coverage.classifiedConversations)} />
        <MetricCard label={text.coverageRate} value={`${data.coverage.coverageRate}%`} />
        <MetricCard label={text.ruleClassified} value={number.format(data.coverage.ruleClassified)} />
        <MetricCard label={text.manualClassified} value={number.format(data.coverage.manualClassified)} />
        <MetricCard label={text.noProduct} value={number.format(data.coverage.noProduct)} />
        <MetricCard label={text.highIntentGap} value={number.format(data.opportunityGap.highIntentWithoutProduct)} />
        <MetricCard label={text.compactMatches} value={number.format(data.compactMonitoring.totalCompactMatches)} />
      </div>

      <section data-coverage-funnel className="app-card p-5">
        <h2 className="font-semibold">{text.funnel}</h2>
        <div className="mt-4 space-y-3">
          {data.funnel.map((step) => (
            <div key={step.key}>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span>{text.funnelLabels[step.key]}</span>
                <span className="app-muted tabular-nums">
                  {number.format(step.count)}
                  {step.percentageOfEligible == null ? "" : ` · ${step.percentageOfEligible}%`}
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                <div className="h-2 rounded-full bg-blue-600 dark:bg-blue-500" style={{ width: `${Math.max(0, Math.min(100, step.count / maximumFunnel * 100))}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section data-product-ranking className="app-card overflow-hidden">
        <h2 className="border-b p-5 font-semibold">{text.ranking}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="app-filter-panel">
              <tr>
                {[text.product, text.family, text.group, text.conversations, text.sourceSplit, text.compactMatches].map((label) => (
                  <th key={label} className="px-4 py-3 text-xs font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.productRanking.map((row) => (
                <tr key={row.productModelId}>
                  <td className="px-4 py-3 font-medium">{row.modelName}</td>
                  <td className="app-muted px-4 py-3">{row.familyName}</td>
                  <td className="app-muted px-4 py-3">{row.productGroup.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3 tabular-nums">{number.format(row.conversationCount)}</td>
                  <td className="px-4 py-3 tabular-nums">{row.ruleCount} / {row.manualCount}</td>
                  <td className="px-4 py-3 tabular-nums">{number.format(row.compactCount)}</td>
                </tr>
              ))}
              {data.productRanking.length === 0 && <tr><td colSpan={6} className="app-muted px-4 py-8 text-center">{text.noData}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section data-review-queue className="app-card overflow-hidden">
        <h2 className="border-b p-5 font-semibold">{text.reviewQueue}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="app-filter-panel">
              <tr>
                {[text.store, text.lineOa, text.intent, text.priority, text.topics, text.reason, text.action].map((label) => (
                  <th key={label} className="px-4 py-3 text-xs font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.reviewQueue.map((row) => (
                <tr key={row.conversationId}>
                  <td className="px-4 py-3 font-medium">{row.store.name}</td>
                  <td className="app-muted px-4 py-3">{row.lineOa.name}</td>
                  <td className="px-4 py-3">{row.purchaseIntent ?? "—"}</td>
                  <td className="px-4 py-3">{row.priority}</td>
                  <td className="app-muted max-w-56 px-4 py-3">{row.topics.join(", ") || "—"}</td>
                  <td className="app-muted max-w-64 px-4 py-3">
                    {row.reasonCodes.map((code) => text.reasonCodes[code as keyof typeof text.reasonCodes] ?? code).join(", ")}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/chats?conversationId=${encodeURIComponent(row.conversationId)}`} className="app-button-secondary inline-flex rounded-lg border px-3 py-1.5 text-xs font-medium">
                      {text.openConversation}
                    </Link>
                  </td>
                </tr>
              ))}
              {data.reviewQueue.length === 0 && <tr><td colSpan={7} className="app-muted px-4 py-8 text-center">{text.noData}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section data-compact-monitoring className="app-card overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b p-5">
          <h2 className="font-semibold">{text.compactMonitoring}</h2>
          <span className="app-muted text-xs">{data.compactMonitoring.percentageOfRuleMatches ?? 0}% {text.ofRuleMatches}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="app-filter-panel">
              <tr>
                {[text.matchedPhrase, text.canonicalModel, text.safety, text.usage, text.latestEvidence].map((label) => (
                  <th key={label} className="px-4 py-3 text-xs font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.compactMonitoring.aliases.map((row) => (
                <tr key={`${row.modelName}:${row.matchedPhrase}`}>
                  <td className="px-4 py-3 font-medium">{row.matchedPhrase}</td>
                  <td className="px-4 py-3">{row.modelName}</td>
                  <td className="app-muted px-4 py-3">{row.safetyClass}</td>
                  <td className="px-4 py-3 tabular-nums">{number.format(row.count)}</td>
                  <td className="app-muted px-4 py-3">{formatDate(row.latestEvidenceAt, language)}</td>
                </tr>
              ))}
              {data.compactMonitoring.aliases.length === 0 && <tr><td colSpan={5} className="app-muted px-4 py-8 text-center">{text.noData}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section data-catalog-health className="app-card p-5">
        <h2 className="font-semibold">{text.catalogHealth}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="app-filter-panel rounded-lg p-4">
            <p className="app-muted text-xs">{text.models}</p>
            <p className="mt-2 font-semibold">{text.active}: {data.catalogHealth.activeModels} · {text.inactive}: {data.catalogHealth.inactiveModels}</p>
            <p className="app-muted mt-1 text-xs">{text.withoutCatalogAlias}: {data.catalogHealth.modelsWithoutActiveCatalogAliases}</p>
          </div>
          <div className="app-filter-panel rounded-lg p-4">
            <p className="app-muted text-xs">{text.aliases}</p>
            <p className="mt-2 font-semibold">{text.active}: {data.catalogHealth.activeAliases} · {text.inactive}: {data.catalogHealth.inactiveAliases}</p>
          </div>
          <div className="app-filter-panel rounded-lg p-4">
            <p className="app-muted text-xs">{text.ownership}</p>
            <p className="mt-2 font-semibold">CATALOG: {data.catalogHealth.catalogAliases} · MANUAL: {data.catalogHealth.manualAliases}</p>
          </div>
          <div className="app-filter-panel rounded-lg p-4">
            <p className="app-muted text-xs">{text.safetyDeclarations}</p>
            <p className="mt-2 text-sm">SAFE_EXACT: {data.catalogHealth.safeExactDeclarations}</p>
            <p className="text-sm">SAFE_COMPACT: {data.catalogHealth.safeCompactDeclarations}</p>
            <p className="text-sm">REVIEW_REQUIRED: {data.catalogHealth.reviewRequiredDeclarations}</p>
            <p className="text-sm">BLOCKED: {data.catalogHealth.blockedDeclarations}</p>
          </div>
        </div>
      </section>
    </section>
  );
}
