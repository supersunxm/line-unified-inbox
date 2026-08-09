"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type {
  ClassificationInsightsResponse,
  ProductCorrectionInsightResponse,
  NetworkAccuracyReport,
  ProductReviewQueueResponse,
  ProductReviewQueueItem,
  ProductMetadataResponse,
  AliasRecommendation,
  TargetedReanalysisResponse,
} from "@/types/api";
import {
  ClassificationInsightsLanguage,
  getClassificationInsightsText,
} from "./classification-insights-translations";

function formatDate(value: string | null, language: ClassificationInsightsLanguage) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function MetricCard({ label, value, subtext }: { label: string; value: string | number; subtext?: string }) {
  return (
    <div className="app-card p-4">
      <p className="app-muted text-xs font-medium">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {subtext && <p className="app-muted mt-1 text-xs truncate">{subtext}</p>}
    </div>
  );
}

export function ClassificationInsightsView({ language }: { language: ClassificationInsightsLanguage }) {
  const text = getClassificationInsightsText(language);
  const [data, setData] = useState<ClassificationInsightsResponse | null>(null);
  const [correctionsData, setCorrectionsData] = useState<ProductCorrectionInsightResponse | null>(null);
  const [accuracyData, setAccuracyData] = useState<NetworkAccuracyReport | null>(null);
  const [reviewQueueData, setReviewQueueData] = useState<ProductReviewQueueResponse | null>(null);
  const [productMetadata, setProductMetadata] = useState<ProductMetadataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review Queue Filter State
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [selectedReason, setSelectedReason] = useState<string>("ALL_NEEDS_REVIEW");
  const [reviewItems, setReviewItems] = useState<ProductReviewQueueItem[]>([]);
  const [selectedQueueIndex, setSelectedQueueIndex] = useState<number>(0);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Correction Modal State
  const [correctingItem, setCorrectingItem] = useState<ProductReviewQueueItem | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [savingCorrection, setSavingCorrection] = useState(false);

  // Approval modal state
  const [pendingApproval, setPendingApproval] = useState<AliasRecommendation | null>(null);
  const [approving, setApproving] = useState(false);
  const [approvalSuccess, setApprovalSuccess] = useState<{ phrase: string; affectedCount: number } | null>(null);

  // Re-analysis state
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalysisResult, setReanalysisResult] = useState<TargetedReanalysisResponse | null>(null);

  // Evidence modal state
  const [activeEvidence, setActiveEvidence] = useState<{
    title: string;
    phrase: string;
    model: string;
    samples: string[];
    stores?: string[];
    methods?: string[];
  } | null>(null);

  const loadReviewQueue = useCallback(async (storeId?: string, reason?: string) => {
    try {
      const q = await api.productReviewQueue({
        storeId: storeId || undefined,
        reason: reason || undefined,
        pageSize: 50,
      });
      setReviewQueueData(q);
      setReviewItems(q.items);
      setSelectedQueueIndex(0);
    } catch (err) {
      console.error("Failed to load review queue:", err);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [insights, corrections, accuracy, queue, meta] = await Promise.all([
        api.classificationInsights(),
        api.productCorrections().catch(() => null),
        api.productAccuracy().catch(() => null),
        api.productReviewQueue({ storeId: selectedStoreId || undefined, reason: selectedReason, pageSize: 50 }).catch(() => null),
        api.products().catch(() => null),
      ]);
      setData(insights);
      setCorrectionsData(corrections);
      setAccuracyData(accuracy);
      if (queue) {
        setReviewQueueData(queue);
        setReviewItems(queue.items);
      }
      setProductMetadata(meta);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : text.error);
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, selectedReason, text.error]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId);
    void loadReviewQueue(storeId, selectedReason);
  };

  const handleReasonChange = (reason: string) => {
    setSelectedReason(reason);
    void loadReviewQueue(selectedStoreId, reason);
  };

  // Fast Review Actions (Optimistic 3-5 sec execution)
  const handleConfirmReview = async (item: ProductReviewQueueItem) => {
    // Optimistic removal
    setReviewItems((prev) => prev.filter((i) => i.conversationId !== item.conversationId));
    if (reviewQueueData) {
      setReviewQueueData({
        ...reviewQueueData,
        summary: {
          ...reviewQueueData.summary,
          totalNeedsReview: Math.max(0, reviewQueueData.summary.totalNeedsReview - 1),
          confirmedCount: reviewQueueData.summary.confirmedCount + 1,
          reviewedTotal: reviewQueueData.summary.reviewedTotal + 1,
        },
      });
    }
    setActionMessage(text.actionSuccessConfirmed);
    window.setTimeout(() => setActionMessage(null), 3000);

    try {
      await api.confirmProductReview(item.conversationId);
    } catch (err) {
      console.error("Confirm review failed:", err);
      void loadReviewQueue(selectedStoreId, selectedReason);
    }
  };

  const handleNoProductReview = async (item: ProductReviewQueueItem) => {
    setReviewItems((prev) => prev.filter((i) => i.conversationId !== item.conversationId));
    if (reviewQueueData) {
      setReviewQueueData({
        ...reviewQueueData,
        summary: {
          ...reviewQueueData.summary,
          totalNeedsReview: Math.max(0, reviewQueueData.summary.totalNeedsReview - 1),
          noProductCount: reviewQueueData.summary.noProductCount + 1,
          reviewedTotal: reviewQueueData.summary.reviewedTotal + 1,
        },
      });
    }
    setActionMessage(text.actionSuccessNoProduct);
    window.setTimeout(() => setActionMessage(null), 3000);

    try {
      await api.confirmNoProductReview(item.conversationId);
    } catch (err) {
      console.error("No product review failed:", err);
      void loadReviewQueue(selectedStoreId, selectedReason);
    }
  };

  const handleOpenCorrection = (item: ProductReviewQueueItem) => {
    setCorrectingItem(item);
    setSelectedModelId(item.predictedProducts[0]?.productModelId ?? "");
  };

  const handleSaveCorrection = async () => {
    if (!correctingItem || !selectedModelId) return;
    setSavingCorrection(true);
    const item = correctingItem;

    // Optimistic removal
    setReviewItems((prev) => prev.filter((i) => i.conversationId !== item.conversationId));
    if (reviewQueueData) {
      setReviewQueueData({
        ...reviewQueueData,
        summary: {
          ...reviewQueueData.summary,
          totalNeedsReview: Math.max(0, reviewQueueData.summary.totalNeedsReview - 1),
          correctedCount: reviewQueueData.summary.correctedCount + 1,
          reviewedTotal: reviewQueueData.summary.reviewedTotal + 1,
        },
      });
    }
    setCorrectingItem(null);
    setActionMessage(text.actionSuccessCorrected);
    window.setTimeout(() => setActionMessage(null), 3000);

    try {
      await api.correctProductReview(item.conversationId, selectedModelId);
      // Reload insights to update correction patterns
      const [insights, corrections] = await Promise.all([
        api.classificationInsights(),
        api.productCorrections().catch(() => null),
      ]);
      setData(insights);
      setCorrectionsData(corrections);
    } catch (err) {
      console.error("Correction failed:", err);
      void loadReviewQueue(selectedStoreId, selectedReason);
    } finally {
      setSavingCorrection(false);
    }
  };

  // Keyboard Shortcuts (C = Confirm, E = Edit, N = No Product)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input or modal is open
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) return;
      if (pendingApproval || activeEvidence || correctingItem) return;
      if (reviewItems.length === 0) return;

      const currentItem = reviewItems[Math.min(selectedQueueIndex, reviewItems.length - 1)];
      if (!currentItem) return;

      const key = e.key.toLowerCase();
      if (key === "c") {
        e.preventDefault();
        void handleConfirmReview(currentItem);
      } else if (key === "e") {
        e.preventDefault();
        handleOpenCorrection(currentItem);
      } else if (key === "n") {
        e.preventDefault();
        void handleNoProductReview(currentItem);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [reviewItems, selectedQueueIndex, pendingApproval, activeEvidence, correctingItem]);

  const handleApprove = async () => {
    if (!pendingApproval) return;
    setApproving(true);
    try {
      const res = await api.approveProductAlias(pendingApproval.phrase, pendingApproval.recommendedModel);
      setApprovalSuccess({ phrase: res.phrase, affectedCount: res.affectedConversationsCount });
      setPendingApproval(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve alias");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (rec: AliasRecommendation) => {
    if (!confirm(`Reject alias recommendation "${rec.phrase}" for ${rec.recommendedModel}?`)) return;
    try {
      await api.rejectProductAlias(rec.phrase, rec.recommendedModel);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reject alias");
    }
  };

  const handleReanalyze = async (phrase: string) => {
    setReanalyzing(true);
    try {
      const res = await api.reanalyzeProductAlias(phrase);
      setReanalysisResult(res);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to run re-analysis");
    } finally {
      setReanalyzing(false);
    }
  };

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

  // Extract unique stores for selector
  const storeList = data.reviewQueue
    ? Array.from(new Map(data.reviewQueue.map((item) => [item.store.id, item.store.name])).entries())
    : [];

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

      {/* Action Success Toast Banner */}
      {actionMessage && (
        <div role="status" className="fixed bottom-6 right-6 z-50 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg animate-bounce">
          {actionMessage}
        </div>
      )}

      {/* Post-Approval Alert & Targeted Re-analysis Prompt */}
      {approvalSuccess && (
        <div role="status" className="app-card border-emerald-300 bg-emerald-50/50 p-5 dark:border-emerald-800 dark:bg-emerald-950/40">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                ✓ {text.aliasActivated} <code className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-bold dark:bg-emerald-900">{approvalSuccess.phrase}</code>
              </p>
              <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                {text.affectedConversationsPrompt}: <strong className="tabular-nums">{approvalSuccess.affectedCount}</strong>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={reanalyzing}
                onClick={() => void handleReanalyze(approvalSuccess.phrase)}
                className="app-button-primary rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {reanalyzing ? text.reanalyzing : text.reanalyzeAction}
              </button>
              <button
                type="button"
                onClick={() => setApprovalSuccess(null)}
                className="app-button-secondary rounded-lg border px-3 py-2 text-sm"
              >
                {text.close}
              </button>
            </div>
          </div>
          {reanalysisResult && (
            <div className="mt-3 border-t border-emerald-200 pt-3 text-xs text-emerald-800 dark:border-emerald-800 dark:text-emerald-200">
              {text.reanalysisComplete} {text.scanned}: {reanalysisResult.scanned} · {text.changed}: {reanalysisResult.changed} · {text.manualProtected}: {reanalysisResult.manualProtected}
            </div>
          )}
        </div>
      )}

      {/* SMART PRODUCT REVIEW QUEUE SECTION */}
      {reviewQueueData && (
        <section data-smart-product-review-queue className="app-card overflow-hidden space-y-4 p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center border-b pb-4">
            <div>
              <h2 className="font-semibold text-lg">{text.smartReviewQueueTitle}</h2>
              <p className="app-muted text-xs mt-0.5">{text.shortcutHelp}</p>
            </div>
            {/* Store Filter Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="store-filter" className="app-muted text-xs font-medium">{text.filterByStore}:</label>
              <select
                id="store-filter"
                value={selectedStoreId}
                onChange={(e) => handleStoreChange(e.target.value)}
                className="rounded-lg border bg-background px-3 py-1.5 text-xs font-medium"
              >
                <option value="">{text.allStores}</option>
                {storeList.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Queue Summary KPIs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
            <MetricCard label={text.needsReview} value={number.format(reviewQueueData.summary.totalNeedsReview)} />
            <MetricCard label={text.unclassified} value={number.format(reviewQueueData.summary.unclassified)} />
            <MetricCard label={text.ambiguous} value={number.format(reviewQueueData.summary.ambiguous)} />
            <MetricCard label={text.lowConfidence} value={number.format(reviewQueueData.summary.lowConfidence)} />
            <MetricCard label={text.seriesOnly} value={number.format(reviewQueueData.summary.seriesOnly)} />
            <MetricCard label={text.reviewedTotal} value={number.format(reviewQueueData.summary.reviewedTotal)} />
            <MetricCard
              label={text.humanAccuracy}
              value={reviewQueueData.summary.observedAccuracyPct !== null ? `${reviewQueueData.summary.observedAccuracyPct}%` : "—"}
              subtext={reviewQueueData.summary.hasSufficientData ? "Verified sample >= 10" : "Insufficient reviewed samples"}
            />
          </div>

          {/* Review Reason Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {[
              { key: "ALL_NEEDS_REVIEW", label: `${text.allNeedsReview} (${reviewQueueData.summary.totalNeedsReview})` },
              { key: "UNCLASSIFIED", label: `${text.unclassified} (${reviewQueueData.summary.unclassified})` },
              { key: "AMBIGUOUS", label: `${text.ambiguous} (${reviewQueueData.summary.ambiguous})` },
              { key: "LOW_CONFIDENCE", label: `${text.lowConfidence} (${reviewQueueData.summary.lowConfidence})` },
              { key: "SERIES_ONLY", label: `${text.seriesOnly} (${reviewQueueData.summary.seriesOnly})` },
              { key: "RECENTLY_CORRECTED", label: `${text.recentlyCorrected} (${reviewQueueData.summary.recentlyCorrected})` },
            ].map((pill) => (
              <button
                key={pill.key}
                type="button"
                onClick={() => handleReasonChange(pill.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedReason === pill.key
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Review Queue Items Table */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="app-filter-panel">
                <tr>
                  {[text.customer, text.store, text.latestInboundMessage, text.predictedProduct, text.reviewReason, text.action].map((label) => (
                    <th key={label} className="px-4 py-3 text-xs font-medium">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {reviewItems.map((item, idx) => {
                  const isFirst = idx === selectedQueueIndex;
                  const reasonBadgeClass =
                    item.reviewReason === "UNCLASSIFIED"
                      ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                      : item.reviewReason === "AMBIGUOUS"
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                      : item.reviewReason === "LOW_CONFIDENCE"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      : item.reviewReason === "SERIES_ONLY"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                      : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300";

                  const predictedName = item.predictedProducts.map((p) => p.productModelName).join(", ") || "—";
                  const primaryPred = item.predictedProducts[0];

                  return (
                    <tr
                      key={item.conversationId}
                      className={`transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ${
                        isFirst ? "bg-blue-50/30 dark:bg-blue-950/20" : ""
                      }`}
                      onClick={() => setSelectedQueueIndex(idx)}
                    >
                      <td className="px-4 py-3 font-medium text-xs">{item.customerName}</td>
                      <td className="app-muted px-4 py-3 text-xs">{item.storeName}</td>
                      <td className="px-4 py-3 max-w-xs truncate text-xs italic font-sans" title={item.latestInboundText}>
                        &ldquo;{item.latestInboundText || "—"}&rdquo;
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">
                          <p className="font-semibold text-foreground">{predictedName}</p>
                          {primaryPred && primaryPred.detectionMethod && (
                            <p className="app-muted font-mono text-[10px]">
                              {primaryPred.detectionMethod} {primaryPred.confidence !== null ? `(${Math.round(primaryPred.confidence * 100)}%)` : ""}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${reasonBadgeClass}`}>
                          {text.reviewReasons[item.reviewReason] ?? item.reviewReason}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {item.predictedProducts.length > 0 && (
                            <button
                              type="button"
                              onClick={() => void handleConfirmReview(item)}
                              title="Confirm current prediction (C)"
                              className="app-button-primary rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                            >
                              {text.confirm}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenCorrection(item)}
                            title="Select correct product model (E)"
                            className="app-button-secondary rounded border px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            {text.correctProduct}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleNoProductReview(item)}
                            title="Confirm no product in this chat (N)"
                            className="app-button-secondary rounded border px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950"
                          >
                            {text.noProductAction}
                          </button>
                          <Link
                            href={`/chats?conversationId=${encodeURIComponent(item.conversationId)}`}
                            className="app-button-secondary rounded border px-2 py-1 text-xs app-muted"
                          >
                            {text.openChat}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {reviewItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="app-muted px-4 py-12 text-center text-sm">
                      ✓ {text.noItemsInQueue}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Correct Product Selection Modal */}
      {correctingItem && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="app-card w-full max-w-md overflow-hidden border shadow-xl">
            <header className="flex items-center justify-between border-b p-5 font-semibold text-lg">
              <span>{text.selectModelModalTitle}</span>
              <button type="button" onClick={() => setCorrectingItem(null)} className="app-muted hover:text-foreground text-sm font-bold">✕</button>
            </header>
            <div className="p-5 space-y-4 text-sm">
              <div className="rounded border bg-slate-50/50 p-3 text-xs dark:bg-slate-900/50 space-y-1">
                <p className="app-muted">{text.latestInboundMessage}:</p>
                <p className="italic font-semibold text-foreground">&ldquo;{correctingItem.latestInboundText}&rdquo;</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="model-select" className="text-xs font-medium app-muted">{text.targetProduct}:</label>
                <select
                  id="model-select"
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-medium"
                >
                  <option value="">-- Choose Product Model --</option>
                  {productMetadata?.series.flatMap((s) =>
                    s.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({s.name})
                      </option>
                    )),
                  )}
                </select>
              </div>
            </div>
            <footer className="flex justify-end gap-3 border-t p-4">
              <button
                type="button"
                onClick={() => setCorrectingItem(null)}
                className="app-button-secondary rounded-lg border px-4 py-2 text-sm font-medium"
              >
                {text.cancel}
              </button>
              <button
                type="button"
                disabled={!selectedModelId || savingCorrection}
                onClick={() => void handleSaveCorrection()}
                className="app-button-primary rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingCorrection ? "Saving..." : text.saveCorrection}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Product Intelligence Health Overview */}
      {correctionsData && (
        <section data-product-intelligence-health className="space-y-3">
          <h2 className="font-semibold text-lg">{text.productIntelligenceHealth}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <MetricCard label={text.ruleClassified} value={number.format(data.coverage.ruleClassified)} />
            <MetricCard label={text.manualClassified} value={number.format(data.coverage.manualClassified)} />
            <MetricCard label={text.manualCorrections} value={number.format(correctionsData.totalManualCorrections)} />
            <MetricCard
              label={text.correctionRate}
              value={data.coverage.ruleClassified > 0
                ? `${Math.round((correctionsData.totalManualCorrections / data.coverage.ruleClassified) * 1000) / 10}%`
                : "0.0%"}
            />
            <MetricCard
              label={text.dataSufficiency}
              value={correctionsData.dataSufficiency.hasSufficientData ? "READY" : `${correctionsData.dataSufficiency.currentSamples}/${correctionsData.dataSufficiency.minimumRequired}`}
              subtext={correctionsData.dataSufficiency.message}
            />
            <MetricCard label={text.recommendationCount} value={correctionsData.aliasRecommendations.length} />
          </div>
        </section>
      )}

      {/* Coverage KPIs */}
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

      {/* Correction Patterns */}
      {correctionsData && (
        <section data-correction-patterns className="app-card overflow-hidden">
          <h2 className="border-b p-5 font-semibold">{text.topCorrectionPatterns}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="app-filter-panel">
                <tr>
                  {[text.matchedPhrase, text.aiPredicted, text.humanCorrected, text.count, text.affectedChats, text.latestEvidence, text.action].map((label) => (
                    <th key={label} className="px-4 py-3 text-xs font-medium">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {correctionsData.correctionPatterns.map((row) => (
                  <tr key={`${row.phrase}:${row.predictedModel}:${row.correctedModel}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-medium font-mono text-xs">{row.phrase}</td>
                    <td className="app-muted px-4 py-3">{row.predictedModel}</td>
                    <td className="px-4 py-3 font-semibold text-blue-600 dark:text-blue-400">{row.correctedModel}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold">{number.format(row.correctionCount)}</td>
                    <td className="px-4 py-3 tabular-nums app-muted">{row.affectedConversations.length}</td>
                    <td className="app-muted px-4 py-3 text-xs">{formatDate(row.lastSeen, language)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveEvidence({
                            title: `Pattern: "${row.phrase}"`,
                            phrase: row.phrase,
                            model: row.correctedModel,
                            samples: row.sampleTexts,
                            stores: row.storeNames,
                            methods: row.detectionMethods,
                          })
                        }
                        className="app-button-secondary rounded-lg border px-2.5 py-1 text-xs font-medium"
                      >
                        {text.viewEvidence}
                      </button>
                    </td>
                  </tr>
                ))}
                {correctionsData.correctionPatterns.length === 0 && (
                  <tr>
                    <td colSpan={7} className="app-muted px-4 py-8 text-center">{text.noCorrectionsYet}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Alias Recommendations */}
      {correctionsData && (
        <section data-alias-recommendations className="app-card overflow-hidden">
          <h2 className="border-b p-5 font-semibold">{text.aliasRecommendations}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="app-filter-panel">
                <tr>
                  {[text.matchedPhrase, text.targetProduct, text.evidenceCount, text.confidence, text.risk, text.status, text.reason, text.action].map((label) => (
                    <th key={label} className="px-4 py-3 text-xs font-medium">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {correctionsData.aliasRecommendations.map((row) => (
                  <tr key={row.phrase} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-medium font-mono text-xs">{row.phrase}</td>
                    <td className="px-4 py-3 font-medium">{row.recommendedModel}</td>
                    <td className="px-4 py-3 tabular-nums">{row.corrections} / {row.totalPhraseCorrections}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold">{row.dominancePct}%</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${row.collisionRisk === "HIGH" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : row.collisionRisk === "MEDIUM" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>
                        {row.collisionRisk}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${row.status === "APPROVED" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" : row.status === "REJECTED" ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="app-muted max-w-60 px-4 py-3 text-xs">{row.statusReason}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {row.status === "SUGGESTED" && row.recommendation === "ADD_ALIAS" && (
                          <button
                            type="button"
                            onClick={() => setPendingApproval(row)}
                            className="app-button-primary rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                          >
                            {text.approveAlias}
                          </button>
                        )}
                        {row.status === "SUGGESTED" && (
                          <button
                            type="button"
                            onClick={() => void handleReject(row)}
                            className="app-button-secondary rounded border px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                          >
                            {text.rejectAlias}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setActiveEvidence({
                              title: `Recommendation: "${row.phrase}"`,
                              phrase: row.phrase,
                              model: row.recommendedModel,
                              samples: row.sampleTexts ?? [],
                            })
                          }
                          className="app-button-secondary rounded border px-2 py-1 text-xs app-muted"
                        >
                          {text.viewEvidence}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {correctionsData.aliasRecommendations.length === 0 && (
                  <tr>
                    <td colSpan={8} className="app-muted px-4 py-8 text-center">{text.noRecommendationsYet}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Product Tag Quality Monitor */}
      {accuracyData && (
        <section data-product-quality-monitor className="app-card overflow-hidden">
          <h2 className="border-b p-5 font-semibold">{text.productQualityMonitor}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="app-filter-panel">
                <tr>
                  {[text.product, text.ruleClassified, text.manualClassified, text.manualCorrections, text.correctionRate, text.detectionMethod, text.qualityStatus].map((label) => (
                    <th key={label} className="px-4 py-3 text-xs font-medium">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {accuracyData.perModel.map((row) => {
                  let badge: string = text.goodQuality;
                  let badgeStyle = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";

                  if (row.ruleTagged === 0) {
                    badge = text.insufficientData;
                    badgeStyle = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
                  } else if (row.correctionRate !== null && row.correctionRate >= 20) {
                    badge = text.reviewQuality;
                    badgeStyle = "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
                  } else if (row.correctionRate !== null && row.correctionRate >= 10) {
                    badge = text.watchQuality;
                    badgeStyle = "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
                  }

                  return (
                    <tr key={row.productModel}>
                      <td className="px-4 py-3 font-medium">{row.productModel}</td>
                      <td className="px-4 py-3 tabular-nums">{row.ruleTagged}</td>
                      <td className="px-4 py-3 tabular-nums">{row.manualTagged}</td>
                      <td className="px-4 py-3 tabular-nums">{row.manualCorrections}</td>
                      <td className="px-4 py-3 tabular-nums font-semibold">
                        {row.correctionRate !== null ? `${row.correctionRate}%` : "—"}
                      </td>
                      <td className="app-muted px-4 py-3 text-xs">{row.primaryDetectionMethod ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badgeStyle}`}>
                          {badge}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Coverage Funnel */}
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
                <div className="h-2 rounded-full bg-blue-600 dark:bg-blue-500" style={{ width: `${Math.max(0, Math.min(100, (step.count / maximumFunnel) * 100))}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Product Demand Ranking */}
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

      {/* Opportunity Review Queue */}
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

      {/* Compact Monitoring */}
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

      {/* Catalog Health */}
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

      {/* Confirmation Modal for Alias Approval */}
      {pendingApproval && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="app-card w-full max-w-lg overflow-hidden border shadow-xl">
            <header className="border-b p-5 font-semibold text-lg">{text.confirmApprovalTitle}</header>
            <div className="p-5 space-y-4 text-sm">
              <p className="text-base font-semibold text-blue-600 dark:text-blue-400">
                &ldquo;{pendingApproval.phrase}&rdquo; → {pendingApproval.recommendedModel}
              </p>
              <div className="rounded-lg border p-4 bg-slate-50/50 dark:bg-slate-900/50 space-y-2 text-xs">
                <p><strong>{text.evidenceCount}:</strong> {pendingApproval.corrections} human corrections ({pendingApproval.affectedConversationsCount} affected chats)</p>
                <p><strong>{text.confidence}:</strong> {pendingApproval.dominancePct}% dominant for {pendingApproval.recommendedModel}</p>
                <p><strong>{text.risk}:</strong> <span className="font-semibold">{pendingApproval.collisionRisk}</span></p>
                <p><strong>{text.reason}:</strong> {pendingApproval.statusReason}</p>
              </div>
              <p className="app-muted text-xs">
                Approving this alias activates it as a verified operator-approved product alias in the database.
              </p>
            </div>
            <footer className="flex justify-end gap-3 border-t p-4">
              <button
                type="button"
                disabled={approving}
                onClick={() => setPendingApproval(null)}
                className="app-button-secondary rounded-lg border px-4 py-2 text-sm font-medium"
              >
                {text.cancel}
              </button>
              <button
                type="button"
                disabled={approving}
                onClick={() => void handleApprove()}
                className="app-button-primary rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {approving ? text.approving : text.approveAlias}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Evidence Details Modal */}
      {activeEvidence && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="app-card w-full max-w-lg overflow-hidden border shadow-xl">
            <header className="flex items-center justify-between border-b p-5 font-semibold text-lg">
              <span>{activeEvidence.title}</span>
              <button type="button" onClick={() => setActiveEvidence(null)} className="app-muted hover:text-foreground text-sm font-bold">✕</button>
            </header>
            <div className="p-5 space-y-4 text-sm max-h-[60vh] overflow-y-auto">
              <div>
                <p className="app-muted text-xs">{text.targetProduct}</p>
                <p className="font-semibold">{activeEvidence.model}</p>
              </div>
              {activeEvidence.stores && activeEvidence.stores.length > 0 && (
                <div>
                  <p className="app-muted text-xs">{text.storesInvolved}</p>
                  <p className="text-xs">{activeEvidence.stores.join(", ")}</p>
                </div>
              )}
              {activeEvidence.methods && activeEvidence.methods.length > 0 && (
                <div>
                  <p className="app-muted text-xs">{text.detectionMethod}</p>
                  <p className="text-xs font-mono">{activeEvidence.methods.join(", ")}</p>
                </div>
              )}
              <div>
                <p className="app-muted text-xs mb-2">{text.sampleMessages}</p>
                {activeEvidence.samples.length > 0 ? (
                  <ul className="space-y-2">
                    {activeEvidence.samples.map((msg, i) => (
                      <li key={i} className="rounded border bg-slate-50/50 p-2.5 text-xs italic dark:bg-slate-900/50">
                        &ldquo;{msg}&rdquo;
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="app-muted text-xs italic">{text.noData}</p>
                )}
              </div>
            </div>
            <footer className="flex justify-end border-t p-4">
              <button
                type="button"
                onClick={() => setActiveEvidence(null)}
                className="app-button-secondary rounded-lg border px-4 py-2 text-sm font-medium"
              >
                {text.close}
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
