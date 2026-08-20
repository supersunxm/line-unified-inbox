"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shell";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingSpinner,
  LoadingState,
  MetricCard,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
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
      console.error("Failed to confirm review item:", err);
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
      console.error("Failed to mark item as no product:", err);
    }
  };

  const handleOpenCorrection = (item: ProductReviewQueueItem) => {
    setCorrectingItem(item);
    setSelectedModelId(item.predictedProducts[0]?.productModelId || "");
  };

  const handleSaveCorrection = async () => {
    if (!correctingItem || !selectedModelId) return;
    setSavingCorrection(true);
    try {
      await api.correctProductReview(correctingItem.conversationId, selectedModelId);
      setReviewItems((prev) => prev.filter((i) => i.conversationId !== correctingItem.conversationId));
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
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save correction");
    } finally {
      setSavingCorrection(false);
    }
  };

  // Keyboard Navigation & Shortcuts for Review Queue (C = Confirm, E = Edit, N = No Product)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when inside input/select or modal is open
      if (
        ["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName) ||
        pendingApproval ||
        activeEvidence ||
        correctingItem
      ) {
        return;
      }

      const currentItem = reviewItems[selectedQueueIndex];
      if (!currentItem) return;

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setSelectedQueueIndex((prev) => Math.min(reviewItems.length - 1, prev + 1));
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setSelectedQueueIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        if (currentItem.predictedProducts.length > 0) {
          void handleConfirmReview(currentItem);
        }
      } else if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        handleOpenCorrection(currentItem);
      } else if (e.key === "n" || e.key === "N") {
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
    return <LoadingState message={text.loading} className="app-card app-muted p-8" />;
  }

  if (error && !data) {
    return (
      <div role="alert" className="app-card rounded-[var(--app-radius-xl)] border border-[var(--app-danger)]/40 bg-[var(--app-danger-soft)] p-6 text-xs text-[var(--app-danger)]">
        <p className="font-bold text-sm">{text.error}</p>
        <p className="mt-1">{error}</p>
        <Button variant="secondary" size="sm" onClick={() => void load()} className="mt-4 app-button-secondary">
          {text.retry}
        </Button>
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
      <PageHeader
        tag="OPPO LINE OA · การวิเคราะห์การจำแนกประเภท"
        title={text.title}
        description={text.subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge size="md" variant="neutral">
              {text.generatedAt}: <time dateTime={data.generatedAt}>{formatDate(data.generatedAt, language)}</time>
            </Badge>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void load()}
              className="app-button-secondary"
            >
              {text.retry}
            </Button>
          </div>
        }
      />

      {/* Action Success Toast Banner */}
      {actionMessage && (
        <div role="status" className="fixed bottom-6 right-6 z-50 rounded-[var(--app-radius-lg)] bg-[var(--app-success)] px-4 py-2.5 text-xs font-semibold text-white shadow-[var(--app-shadow-elevated)] animate-bounce">
          {actionMessage}
        </div>
      )}

      {/* Post-Approval Alert & Targeted Re-analysis Prompt */}
      {approvalSuccess && (
        <div role="status" className="app-card rounded-[var(--app-radius-xl)] border border-[var(--app-success)]/40 bg-[var(--app-success-soft)] p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="font-bold text-xs text-[var(--app-success)]">
                ✓ {text.aliasActivated} <code className="rounded bg-[var(--app-surface)] border border-[var(--app-border)] px-1.5 py-0.5 font-mono text-xs">{approvalSuccess.phrase}</code>
              </p>
              <p className="mt-1 text-xs text-[var(--app-text-primary)]">
                {text.affectedConversationsPrompt}: <strong className="tabular-nums font-mono">{approvalSuccess.affectedCount}</strong>
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <Button
                variant="primary"
                size="sm"
                disabled={reanalyzing}
                onClick={() => void handleReanalyze(approvalSuccess.phrase)}
              >
                {reanalyzing ? text.reanalyzing : text.reanalyzeAction}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setApprovalSuccess(null)}
                className="app-button-secondary"
              >
                {text.close}
              </Button>
            </div>
          </div>
          {reanalysisResult && (
            <div className="mt-3 border-t border-[var(--app-border-subtle)] pt-3 text-xs text-[var(--app-text-secondary)] font-mono">
              {text.reanalysisComplete} {text.scanned}: {reanalysisResult.scanned} · {text.changed}: {reanalysisResult.changed} · {text.manualProtected}: {reanalysisResult.manualProtected}
            </div>
          )}
        </div>
      )}

      {/* SMART PRODUCT REVIEW QUEUE SECTION */}
      {reviewQueueData && (
        <Card data-smart-product-review-queue className="app-card space-y-4">
          <CardHeader>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center w-full">
              <div>
                <CardTitle className="text-base font-bold">{text.smartReviewQueueTitle}</CardTitle>
                <CardDescription className="app-muted text-xs">{text.shortcutHelp}</CardDescription>
              </div>
              {/* Store Filter Selector */}
              <div className="flex items-center gap-2">
                <label htmlFor="store-filter" className="app-muted text-xs font-medium text-[var(--app-text-secondary)]">{text.filterByStore}:</label>
                <select
                  id="store-filter"
                  value={selectedStoreId}
                  onChange={(e) => handleStoreChange(e.target.value)}
                  className="h-8 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 text-xs font-medium text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                >
                  <option value="">{text.allStores}</option>
                  {storeList.map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Queue Summary KPIs */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
              <MetricCard label={text.needsReview} value={number.format(reviewQueueData.summary.totalNeedsReview)} tone="warning" />
              <MetricCard label={text.unclassified} value={number.format(reviewQueueData.summary.unclassified)} tone="danger" />
              <MetricCard label={text.ambiguous} value={number.format(reviewQueueData.summary.ambiguous)} tone="accent" />
              <MetricCard label={text.lowConfidence} value={number.format(reviewQueueData.summary.lowConfidence)} tone="warning" />
              <MetricCard label={text.seriesOnly} value={number.format(reviewQueueData.summary.seriesOnly)} tone="default" />
              <MetricCard label={text.reviewedTotal} value={number.format(reviewQueueData.summary.reviewedTotal)} tone="default" />
              <MetricCard
                label={text.humanAccuracy}
                value={reviewQueueData.summary.observedAccuracyPct !== null ? `${reviewQueueData.summary.observedAccuracyPct}%` : "—"}
                subtext={reviewQueueData.summary.hasSufficientData ? "Verified sample >= 10" : "Insufficient reviewed samples"}
                tone="success"
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
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    selectedReason === pill.key
                      ? "bg-[var(--app-accent)] text-white"
                      : "bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)]"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Review Queue Items Table */}
            <TableContainer>
              <Table>
                <TableHeader className="app-filter-panel">
                  <TableRow>
                    {[text.customer, text.store, text.latestInboundMessage, text.predictedProduct, text.reviewReason, text.action].map((label) => (
                      <TableHead key={label}>{label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewItems.map((item, idx) => {
                    const isFirst = idx === selectedQueueIndex;
                    const predictedName = item.predictedProducts.map((p) => p.productModelName).join(", ") || "—";
                    const primaryPred = item.predictedProducts[0];

                    return (
                      <TableRow
                        key={item.conversationId}
                        className={isFirst ? "bg-[var(--app-accent-soft)]/20" : ""}
                        onClick={() => setSelectedQueueIndex(idx)}
                      >
                        <TableCell className="font-semibold text-xs text-[var(--app-text-primary)]">{item.customerName}</TableCell>
                        <TableCell className="app-muted text-xs text-[var(--app-text-secondary)]">{item.storeName}</TableCell>
                        <TableCell className="max-w-xs truncate text-xs italic font-sans" title={item.latestInboundText}>
                          &ldquo;{item.latestInboundText || "—"}&rdquo;
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <p className="font-semibold text-[var(--app-text-primary)]">{predictedName}</p>
                            {primaryPred && primaryPred.detectionMethod && (
                              <p className="app-muted font-mono text-[10px] text-[var(--app-text-tertiary)]">
                                {primaryPred.detectionMethod} {primaryPred.confidence !== null ? `(${Math.round(primaryPred.confidence * 100)}%)` : ""}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            size="sm"
                            variant={
                              item.reviewReason === "UNCLASSIFIED"
                                ? "danger"
                                : item.reviewReason === "AMBIGUOUS"
                                ? "accent"
                                : item.reviewReason === "LOW_CONFIDENCE"
                                ? "warning"
                                : "neutral"
                            }
                          >
                            {text.reviewReasons[item.reviewReason] ?? item.reviewReason}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {item.predictedProducts.length > 0 && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => void handleConfirmReview(item)}
                                title="Confirm current prediction (C)"
                              >
                                {text.confirm}
                              </Button>
                            )}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenCorrection(item)}
                              title="Select correct product model (E)"
                              className="app-button-secondary"
                            >
                              {text.correctProduct}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => void handleNoProductReview(item)}
                              title="Confirm no product in this chat (N)"
                              className="app-button-secondary text-[var(--app-warning)]"
                            >
                              {text.noProductAction}
                            </Button>
                            <Link
                              href={`/chats?conversationId=${encodeURIComponent(item.conversationId)}`}
                              className="app-button-secondary inline-flex items-center justify-center rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-xs app-muted hover:bg-[var(--app-surface-hover)]"
                            >
                              {text.openChat}
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {reviewItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="app-muted px-4 py-12 text-center text-xs text-[var(--app-text-secondary)]">
                        ✓ {text.noItemsInQueue}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Correct Product Selection Modal */}
      {correctingItem && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="app-card w-full max-w-md rounded-[var(--app-radius-xl)] border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-modal)] p-5 space-y-4">
            <header className="flex items-center justify-between border-b border-[var(--app-border-subtle)] pb-3 font-bold text-base text-[var(--app-text-primary)]">
              <span>{text.selectModelModalTitle}</span>
              <button type="button" onClick={() => setCorrectingItem(null)} className="app-muted text-sm font-bold text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]">✕</button>
            </header>
            <div className="space-y-3 text-xs">
              <div className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-3 space-y-1">
                <p className="app-muted text-[var(--app-text-tertiary)]">{text.latestInboundMessage}:</p>
                <p className="italic font-semibold text-[var(--app-text-primary)]">&ldquo;{correctingItem.latestInboundText}&rdquo;</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="model-select" className="text-xs font-medium app-muted text-[var(--app-text-secondary)]">{text.targetProduct}:</label>
                <select
                  id="model-select"
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  className="w-full h-9 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-xs font-medium text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
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
            <footer className="flex justify-end gap-2.5 border-t border-[var(--app-border-subtle)] pt-3">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setCorrectingItem(null)}
                className="app-button-secondary"
              >
                {text.cancel}
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={!selectedModelId || savingCorrection}
                onClick={() => void handleSaveCorrection()}
              >
                {savingCorrection ? "Saving..." : text.saveCorrection}
              </Button>
            </footer>
          </div>
        </div>
      )}

      {/* Product Intelligence Health Overview */}
      {correctionsData && (
        <Card data-product-intelligence-health className="app-card space-y-3">
          <CardHeader>
            <CardTitle>{text.productIntelligenceHealth}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <MetricCard label={text.ruleClassified} value={number.format(data.coverage.ruleClassified)} tone="default" />
              <MetricCard label={text.manualClassified} value={number.format(data.coverage.manualClassified)} tone="default" />
              <MetricCard label={text.manualCorrections} value={number.format(correctionsData.totalManualCorrections)} tone="warning" />
              <MetricCard
                label={text.correctionRate}
                value={data.coverage.ruleClassified > 0
                  ? `${Math.round((correctionsData.totalManualCorrections / data.coverage.ruleClassified) * 1000) / 10}%`
                  : "0.0%"}
                tone="accent"
              />
              <MetricCard
                label={text.dataSufficiency}
                value={correctionsData.dataSufficiency.hasSufficientData ? "READY" : `${correctionsData.dataSufficiency.currentSamples}/${correctionsData.dataSufficiency.minimumRequired}`}
                subtext={correctionsData.dataSufficiency.message}
                tone={correctionsData.dataSufficiency.hasSufficientData ? "success" : "default"}
              />
              <MetricCard label={text.recommendationCount} value={correctionsData.aliasRecommendations.length} tone="info" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coverage KPIs */}
      <div data-insights-kpis className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label={text.textEligible} value={number.format(data.coverage.textEligibleConversations)} tone="default" />
        <MetricCard label={text.classified} value={number.format(data.coverage.classifiedConversations)} tone="accent" />
        <MetricCard label={text.coverageRate} value={`${data.coverage.coverageRate}%`} tone="success" />
        <MetricCard label={text.ruleClassified} value={number.format(data.coverage.ruleClassified)} tone="default" />
        <MetricCard label={text.manualClassified} value={number.format(data.coverage.manualClassified)} tone="default" />
        <MetricCard label={text.noProduct} value={number.format(data.coverage.noProduct)} tone="default" />
        <MetricCard label={text.highIntentGap} value={number.format(data.opportunityGap.highIntentWithoutProduct)} tone="warning" />
        <MetricCard label={text.compactMatches} value={number.format(data.compactMonitoring.totalCompactMatches)} tone="info" />
      </div>

      {/* Correction Patterns */}
      {correctionsData && (
        <Card data-correction-patterns className="app-card">
          <CardHeader>
            <CardTitle>{text.topCorrectionPatterns}</CardTitle>
          </CardHeader>
          <CardContent>
            <TableContainer>
              <Table>
                <TableHeader className="app-filter-panel">
                  <TableRow>
                    {[text.matchedPhrase, text.aiPredicted, text.humanCorrected, text.count, text.affectedChats, text.latestEvidence, text.action].map((label) => (
                      <TableHead key={label}>{label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {correctionsData.correctionPatterns.map((row) => (
                    <TableRow key={`${row.phrase}:${row.predictedModel}:${row.correctedModel}`}>
                      <TableCell className="font-semibold font-mono text-xs text-[var(--app-text-primary)]">{row.phrase}</TableCell>
                      <TableCell className="app-muted text-xs text-[var(--app-text-secondary)]">{row.predictedModel}</TableCell>
                      <TableCell className="font-semibold text-xs text-[var(--app-accent)]">{row.correctedModel}</TableCell>
                      <TableCell className="tabular-nums font-semibold text-xs text-[var(--app-text-primary)]">{number.format(row.correctionCount)}</TableCell>
                      <TableCell className="tabular-nums app-muted text-xs text-[var(--app-text-secondary)]">{row.affectedConversations.length}</TableCell>
                      <TableCell className="app-muted text-xs text-[var(--app-text-secondary)]">{formatDate(row.lastSeen, language)}</TableCell>
                      <TableCell>
                        <Button
                          variant="secondary"
                          size="sm"
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
                          className="app-button-secondary"
                        >
                          {text.viewEvidence}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {correctionsData.correctionPatterns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="app-muted px-4 py-8 text-center text-xs text-[var(--app-text-secondary)]">{text.noCorrectionsYet}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Alias Recommendations */}
      {correctionsData && (
        <Card data-alias-recommendations className="app-card">
          <CardHeader>
            <CardTitle>{text.aliasRecommendations}</CardTitle>
          </CardHeader>
          <CardContent>
            <TableContainer>
              <Table>
                <TableHeader className="app-filter-panel">
                  <TableRow>
                    {[text.matchedPhrase, text.targetProduct, text.evidenceCount, text.confidence, text.risk, text.status, text.reason, text.action].map((label) => (
                      <TableHead key={label}>{label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {correctionsData.aliasRecommendations.map((row) => (
                    <TableRow key={row.phrase}>
                      <TableCell className="font-semibold font-mono text-xs text-[var(--app-text-primary)]">{row.phrase}</TableCell>
                      <TableCell className="font-medium text-xs text-[var(--app-text-primary)]">{row.recommendedModel}</TableCell>
                      <TableCell className="tabular-nums text-xs text-[var(--app-text-secondary)]">{row.corrections} / {row.totalPhraseCorrections}</TableCell>
                      <TableCell className="tabular-nums font-semibold text-xs text-[var(--app-text-primary)]">{row.dominancePct}%</TableCell>
                      <TableCell>
                        <Badge
                          size="sm"
                          variant={row.collisionRisk === "HIGH" ? "danger" : row.collisionRisk === "MEDIUM" ? "warning" : "success"}
                        >
                          {row.collisionRisk}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          size="sm"
                          variant={row.status === "APPROVED" ? "accent" : row.status === "REJECTED" ? "neutral" : "success"}
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="app-muted max-w-60 text-xs text-[var(--app-text-secondary)]">{row.statusReason}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {row.status === "SUGGESTED" && row.recommendation === "ADD_ALIAS" && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => setPendingApproval(row)}
                            >
                              {text.approveAlias}
                            </Button>
                          )}
                          {row.status === "SUGGESTED" && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => void handleReject(row)}
                            >
                              {text.rejectAlias}
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setActiveEvidence({
                                title: `Recommendation: "${row.phrase}"`,
                                phrase: row.phrase,
                                model: row.recommendedModel,
                                samples: row.sampleTexts ?? [],
                              })
                            }
                            className="app-button-secondary"
                          >
                            {text.viewEvidence}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {correctionsData.aliasRecommendations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="app-muted px-4 py-8 text-center text-xs text-[var(--app-text-secondary)]">{text.noRecommendationsYet}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Product Tag Quality Monitor */}
      {accuracyData && (
        <Card data-product-quality-monitor className="app-card">
          <CardHeader>
            <CardTitle>{text.productQualityMonitor}</CardTitle>
          </CardHeader>
          <CardContent>
            <TableContainer>
              <Table>
                <TableHeader className="app-filter-panel">
                  <TableRow>
                    {[text.product, text.ruleClassified, text.manualClassified, text.manualCorrections, text.correctionRate, text.detectionMethod, text.qualityStatus].map((label) => (
                      <TableHead key={label}>{label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accuracyData.perModel.map((row) => {
                    let badgeVariant: "success" | "neutral" | "danger" | "warning" = "success";
                    let badgeLabel: string = text.goodQuality;

                    if (row.ruleTagged === 0) {
                      badgeLabel = text.insufficientData;
                      badgeVariant = "neutral";
                    } else if (row.correctionRate !== null && row.correctionRate >= 20) {
                      badgeLabel = text.reviewQuality;
                      badgeVariant = "danger";
                    } else if (row.correctionRate !== null && row.correctionRate >= 10) {
                      badgeLabel = text.watchQuality;
                      badgeVariant = "warning";
                    }

                    return (
                      <TableRow key={row.productModel}>
                        <TableCell className="font-semibold text-xs text-[var(--app-text-primary)]">{row.productModel}</TableCell>
                        <TableCell className="tabular-nums text-xs text-[var(--app-text-secondary)]">{row.ruleTagged}</TableCell>
                        <TableCell className="tabular-nums text-xs text-[var(--app-text-secondary)]">{row.manualTagged}</TableCell>
                        <TableCell className="tabular-nums text-xs text-[var(--app-text-secondary)]">{row.manualCorrections}</TableCell>
                        <TableCell className="tabular-nums font-semibold text-xs text-[var(--app-text-primary)]">
                          {row.correctionRate !== null ? `${row.correctionRate}%` : "—"}
                        </TableCell>
                        <TableCell className="app-muted text-xs text-[var(--app-text-secondary)]">{row.primaryDetectionMethod ?? "—"}</TableCell>
                        <TableCell>
                          <Badge size="sm" variant={badgeVariant}>
                            {badgeLabel}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Coverage Funnel */}
      <Card data-coverage-funnel className="app-card">
        <CardHeader>
          <CardTitle>{text.funnel}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.funnel.map((step) => (
              <div key={step.key}>
                <div className="flex items-center justify-between gap-4 text-xs">
                  <span className="font-medium text-[var(--app-text-primary)]">{text.funnelLabels[step.key]}</span>
                  <span className="app-muted font-mono text-[var(--app-text-secondary)]">
                    {number.format(step.count)}
                    {step.percentageOfEligible == null ? "" : ` · ${step.percentageOfEligible}%`}
                  </span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-[var(--app-surface-subtle)] border border-[var(--app-border-subtle)] overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-[var(--app-accent)] transition-all duration-300"
                    style={{ width: `${Math.max(0, Math.min(100, (step.count / maximumFunnel) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Product Demand Ranking */}
      <Card data-product-ranking className="app-card">
        <CardHeader>
          <CardTitle>{text.ranking}</CardTitle>
        </CardHeader>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHeader className="app-filter-panel">
                <TableRow>
                  {[text.product, text.family, text.group, text.conversations, text.sourceSplit, text.compactMatches].map((label) => (
                    <TableHead key={label}>{label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.productRanking.map((row) => (
                  <TableRow key={row.productModelId}>
                    <TableCell className="font-semibold text-xs text-[var(--app-text-primary)]">{row.modelName}</TableCell>
                    <TableCell className="app-muted text-xs text-[var(--app-text-secondary)]">{row.familyName}</TableCell>
                    <TableCell className="app-muted text-xs text-[var(--app-text-secondary)]">{row.productGroup.replaceAll("_", " ")}</TableCell>
                    <TableCell className="tabular-nums font-semibold text-xs text-[var(--app-text-primary)]">{number.format(row.conversationCount)}</TableCell>
                    <TableCell className="tabular-nums text-xs text-[var(--app-text-secondary)]">{row.ruleCount} / {row.manualCount}</TableCell>
                    <TableCell className="tabular-nums text-xs text-[var(--app-text-secondary)]">{number.format(row.compactCount)}</TableCell>
                  </TableRow>
                ))}
                {data.productRanking.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="app-muted px-4 py-8 text-center text-xs text-[var(--app-text-secondary)]">{text.noData}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Opportunity Review Queue */}
      <Card data-review-queue className="app-card">
        <CardHeader>
          <CardTitle>{text.reviewQueue}</CardTitle>
        </CardHeader>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHeader className="app-filter-panel">
                <TableRow>
                  {[text.store, text.lineOa, text.intent, text.priority, text.topics, text.reason, text.action].map((label) => (
                    <TableHead key={label}>{label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.reviewQueue.map((row) => (
                  <TableRow key={row.conversationId}>
                    <TableCell className="font-semibold text-xs text-[var(--app-text-primary)]">{row.store.name}</TableCell>
                    <TableCell className="app-muted text-xs text-[var(--app-text-secondary)]">{row.lineOa.name}</TableCell>
                    <TableCell className="text-xs text-[var(--app-text-primary)]">{row.purchaseIntent ?? "—"}</TableCell>
                    <TableCell className="text-xs font-mono font-semibold">{row.priority}</TableCell>
                    <TableCell className="app-muted max-w-56 text-xs text-[var(--app-text-secondary)]">{row.topics.join(", ") || "—"}</TableCell>
                    <TableCell className="app-muted max-w-64 text-xs text-[var(--app-text-secondary)]">
                      {row.reasonCodes.map((code) => text.reasonCodes[code as keyof typeof text.reasonCodes] ?? code).join(", ")}
                    </TableCell>
                    <TableCell>
                      <Link href={`/chats?conversationId=${encodeURIComponent(row.conversationId)}`} className="app-button-secondary inline-flex items-center justify-center rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--app-surface-hover)]">
                        {text.openConversation}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {data.reviewQueue.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="app-muted px-4 py-8 text-center text-xs text-[var(--app-text-secondary)]">{text.noData}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Compact Monitoring */}
      <Card data-compact-monitoring className="app-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-4 w-full">
            <CardTitle>{text.compactMonitoring}</CardTitle>
            <span className="app-muted text-xs text-[var(--app-text-secondary)]">{data.compactMonitoring.percentageOfRuleMatches ?? 0}% {text.ofRuleMatches}</span>
          </div>
        </CardHeader>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHeader className="app-filter-panel">
                <TableRow>
                  {[text.matchedPhrase, text.canonicalModel, text.safety, text.usage, text.latestEvidence].map((label) => (
                    <TableHead key={label}>{label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.compactMonitoring.aliases.map((row) => (
                  <TableRow key={`${row.modelName}:${row.matchedPhrase}`}>
                    <TableCell className="font-semibold font-mono text-xs text-[var(--app-text-primary)]">{row.matchedPhrase}</TableCell>
                    <TableCell className="text-xs text-[var(--app-text-primary)]">{row.modelName}</TableCell>
                    <TableCell className="app-muted text-xs text-[var(--app-text-secondary)]">{row.safetyClass}</TableCell>
                    <TableCell className="tabular-nums font-semibold text-xs text-[var(--app-text-primary)]">{number.format(row.count)}</TableCell>
                    <TableCell className="app-muted text-xs text-[var(--app-text-secondary)]">{formatDate(row.latestEvidenceAt, language)}</TableCell>
                  </TableRow>
                ))}
                {data.compactMonitoring.aliases.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="app-muted px-4 py-8 text-center text-xs text-[var(--app-text-secondary)]">{text.noData}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Catalog Health */}
      <Card data-catalog-health className="app-card">
        <CardHeader>
          <CardTitle>{text.catalogHealth}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="app-filter-panel rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4">
              <p className="app-muted text-xs font-semibold uppercase tracking-wider text-[var(--app-text-tertiary)]">{text.models}</p>
              <p className="mt-2 font-bold text-xs text-[var(--app-text-primary)]">{text.active}: {data.catalogHealth.activeModels} · {text.inactive}: {data.catalogHealth.inactiveModels}</p>
              <p className="app-muted mt-1 text-[11px] text-[var(--app-text-secondary)]">{text.withoutCatalogAlias}: {data.catalogHealth.modelsWithoutActiveCatalogAliases}</p>
            </div>
            <div className="app-filter-panel rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4">
              <p className="app-muted text-xs font-semibold uppercase tracking-wider text-[var(--app-text-tertiary)]">{text.aliases}</p>
              <p className="mt-2 font-bold text-xs text-[var(--app-text-primary)]">{text.active}: {data.catalogHealth.activeAliases} · {text.inactive}: {data.catalogHealth.inactiveAliases}</p>
            </div>
            <div className="app-filter-panel rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4">
              <p className="app-muted text-xs font-semibold uppercase tracking-wider text-[var(--app-text-tertiary)]">{text.ownership}</p>
              <p className="mt-2 font-bold text-xs text-[var(--app-text-primary)]">CATALOG: {data.catalogHealth.catalogAliases} · MANUAL: {data.catalogHealth.manualAliases}</p>
            </div>
            <div className="app-filter-panel rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4 space-y-1">
              <p className="app-muted text-xs font-semibold uppercase tracking-wider text-[var(--app-text-tertiary)]">{text.safetyDeclarations}</p>
              <p className="text-xs text-[var(--app-text-primary)]">SAFE_EXACT: {data.catalogHealth.safeExactDeclarations}</p>
              <p className="text-xs text-[var(--app-text-primary)]">SAFE_COMPACT: {data.catalogHealth.safeCompactDeclarations}</p>
              <p className="text-xs text-[var(--app-text-primary)]">REVIEW_REQUIRED: {data.catalogHealth.reviewRequiredDeclarations}</p>
              <p className="text-xs text-[var(--app-text-primary)]">BLOCKED: {data.catalogHealth.blockedDeclarations}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Modal for Alias Approval */}
      {pendingApproval && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="app-card w-full max-w-lg rounded-[var(--app-radius-xl)] border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-modal)] p-6 space-y-4">
            <header className="border-b border-[var(--app-border-subtle)] pb-3 font-bold text-base text-[var(--app-text-primary)]">
              {text.confirmApprovalTitle}
            </header>
            <div className="space-y-3 text-xs">
              <p className="text-sm font-bold text-[var(--app-accent)]">
                &ldquo;{pendingApproval.phrase}&rdquo; → {pendingApproval.recommendedModel}
              </p>
              <div className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] p-3.5 bg-[var(--app-surface-subtle)] space-y-1.5 text-xs text-[var(--app-text-primary)]">
                <p><strong>{text.evidenceCount}:</strong> {pendingApproval.corrections} human corrections ({pendingApproval.affectedConversationsCount} affected chats)</p>
                <p><strong>{text.confidence}:</strong> {pendingApproval.dominancePct}% dominant for {pendingApproval.recommendedModel}</p>
                <p><strong>{text.risk}:</strong> <Badge size="sm" variant={pendingApproval.collisionRisk === "HIGH" ? "danger" : "warning"}>{pendingApproval.collisionRisk}</Badge></p>
                <p><strong>{text.reason}:</strong> {pendingApproval.statusReason}</p>
              </div>
              <p className="app-muted text-[11px] text-[var(--app-text-secondary)]">
                Approving this alias activates it as a verified operator-approved product alias in the database.
              </p>
            </div>
            <footer className="flex justify-end gap-2.5 border-t border-[var(--app-border-subtle)] pt-3">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setPendingApproval(null)}
                className="app-button-secondary"
              >
                {text.cancel}
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={approving}
                onClick={() => void handleApprove()}
              >
                {approving ? text.approving : text.approveAlias}
              </Button>
            </footer>
          </div>
        </div>
      )}

      {/* Evidence Details Modal */}
      {activeEvidence && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="app-card w-full max-w-lg rounded-[var(--app-radius-xl)] border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-modal)] p-6 space-y-4">
            <header className="flex items-center justify-between border-b border-[var(--app-border-subtle)] pb-3 font-bold text-base text-[var(--app-text-primary)]">
              <span>{activeEvidence.title}</span>
              <button type="button" onClick={() => setActiveEvidence(null)} className="app-muted text-sm font-bold text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]">✕</button>
            </header>
            <div className="space-y-3 text-xs max-h-[60vh] overflow-y-auto">
              <div>
                <p className="app-muted text-[11px] text-[var(--app-text-secondary)]">{text.targetProduct}</p>
                <p className="font-semibold text-[var(--app-text-primary)]">{activeEvidence.model}</p>
              </div>
              {activeEvidence.stores && activeEvidence.stores.length > 0 && (
                <div>
                  <p className="app-muted text-[11px] text-[var(--app-text-secondary)]">{text.storesInvolved}</p>
                  <p className="text-xs text-[var(--app-text-primary)]">{activeEvidence.stores.join(", ")}</p>
                </div>
              )}
              {activeEvidence.methods && activeEvidence.methods.length > 0 && (
                <div>
                  <p className="app-muted text-[11px] text-[var(--app-text-secondary)]">{text.detectionMethod}</p>
                  <p className="text-xs font-mono text-[var(--app-text-primary)]">{activeEvidence.methods.join(", ")}</p>
                </div>
              )}
              <div>
                <p className="app-muted text-[11px] text-[var(--app-text-secondary)] mb-2">{text.sampleMessages}</p>
                {activeEvidence.samples.length > 0 ? (
                  <ul className="space-y-2">
                    {activeEvidence.samples.map((msg, i) => (
                      <li key={i} className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-2.5 text-xs italic text-[var(--app-text-primary)]">
                        &ldquo;{msg}&rdquo;
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="app-muted text-xs italic text-[var(--app-text-tertiary)]">{text.noData}</p>
                )}
              </div>
            </div>
            <footer className="flex justify-end border-t border-[var(--app-border-subtle)] pt-3">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setActiveEvidence(null)}
                className="app-button-secondary"
              >
                {text.close}
              </Button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
