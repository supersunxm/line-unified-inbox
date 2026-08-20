"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FilterBar, PageHeader } from "@/components/shell";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  LoadingState,
  MetricCard,
  SearchInput,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableEmptyState,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { api } from "@/lib/api";
import type { FriendAttributionConfigDto, FriendSource, FriendSourceLink, FriendSourceLinksSummaryItem, LineOfficialAccountResponse } from "@/types/api";
import { getFriendSourceLinksText, type Language } from "./friend-source-links-translations.ts";
import {
  ALL_SOURCES,
  MAX_PILOT_STORES,
  calculateAttributionKPIs,
  calculateSummaryKPIs,
  evaluateApiError,
  filterEligibleAccounts,
  formatConversionRate,
  formatShortUrlForClipboard,
  isAccountEligible,
  prepareGeneratePayload,
  prepareUpdatePayload,
  toggleAccountSelection,
} from "./friend-source-links-utils.ts";
import {
  buildExportFilename,
  createExcelWorkbookBuffer,
  triggerBrowserDownload,
} from "./friend-source-links-export.ts";

export function FriendSourceLinksView({
  language = "en",
  userRole,
}: {
  language?: Language;
  userRole: "ADMIN" | "VIEWER";
}) {
  const t = getFriendSourceLinksText(language);

  // Data state
  const [links, setLinks] = useState<FriendSourceLink[]>([]);
  const [summary, setSummary] = useState<FriendSourceLinksSummaryItem[]>([]);
  const [lineOas, setLineOas] = useState<LineOfficialAccountResponse[]>([]);

  // Loading/error states
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [is403, setIs403] = useState(userRole === "VIEWER");

  // Generator state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [generatorSearch, setGeneratorSearch] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<{ createdCount: number; existingCount: number } | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Filter state
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStore, setFilterStore] = useState("");
  const [filterSource, setFilterSource] = useState<FriendSource | "">("");
  const [filterStatus, setFilterStatus] = useState<"" | "true" | "false">("");

  // Toggle/action state
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<FriendSourceLink | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Export state
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Attribution configs state & controls
  const [attrConfigs, setAttrConfigs] = useState<FriendAttributionConfigDto[]>([]);
  const [attrConfigsLoading, setAttrConfigsLoading] = useState(false);
  const [attrConfigsError, setAttrConfigsError] = useState<string | null>(null);
  const [attrExpanded, setAttrExpanded] = useState(false);
  const [attrSearchQuery, setAttrSearchQuery] = useState("");
  const [attrStatusFilter, setAttrStatusFilter] = useState<"ALL" | "ENABLED" | "DISABLED" | "NOT_CONFIGURED">("ALL");

  const [editingConfig, setEditingConfig] = useState<FriendAttributionConfigDto | null>(null);
  const [modalChannelId, setModalChannelId] = useState("");
  const [modalLiffId, setModalLiffId] = useState("");
  const [modalIsEnabled, setModalIsEnabled] = useState(true);
  const [modalError, setModalError] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // Attribution summary counts
  const attrCounts = useMemo(() => {
    let enabled = 0;
    let disabled = 0;
    let notConfigured = 0;
    for (const cfg of attrConfigs) {
      const isConfigured = cfg.isConfigured || Boolean(cfg.liffId);
      if (!isConfigured) {
        notConfigured++;
      } else if (cfg.isEnabled) {
        enabled++;
      } else {
        disabled++;
      }
    }
    return {
      total: attrConfigs.length,
      enabled,
      disabled,
      notConfigured,
    };
  }, [attrConfigs]);

  // Filtered & Sorted Attribution Configs
  const filteredAttrConfigs = useMemo(() => {
    const query = attrSearchQuery.trim().toLowerCase();

    return attrConfigs
      .filter((cfg) => {
        const isConfigured = cfg.isConfigured || Boolean(cfg.liffId);
        const isEnabled = cfg.isEnabled;

        if (attrStatusFilter === "ENABLED" && !(isConfigured && isEnabled)) return false;
        if (attrStatusFilter === "DISABLED" && !(isConfigured && !isEnabled)) return false;
        if (attrStatusFilter === "NOT_CONFIGURED" && isConfigured) return false;

        if (query) {
          const text = `${cfg.storeName || ""} ${cfg.lineOaName || ""} ${cfg.basicId || ""}`.toLowerCase();
          if (!text.includes(query)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const getRank = (cfg: FriendAttributionConfigDto) => {
          const isConfigured = cfg.isConfigured || Boolean(cfg.liffId);
          if (isConfigured && cfg.isEnabled) return 1;
          if (isConfigured && !cfg.isEnabled) return 2;
          return 3;
        };
        const rankDiff = getRank(a) - getRank(b);
        if (rankDiff !== 0) return rankDiff;
        const nameA = a.storeName || a.lineOaName || "";
        const nameB = b.storeName || b.lineOaName || "";
        return nameA.localeCompare(nameB);
      });
  }, [attrConfigs, attrSearchQuery, attrStatusFilter]);

  const loadAttrConfigs = useCallback(async () => {
    if (userRole !== "ADMIN") return;
    setAttrConfigsLoading(true);
    setAttrConfigsError(null);
    try {
      const data = await api.friendAttributionConfigs();
      setAttrConfigs(data);
    } catch (err) {
      const evaluated = evaluateApiError(err, t.errorState);
      setAttrConfigsError(evaluated.message);
    } finally {
      setAttrConfigsLoading(false);
    }
  }, [t.errorState, userRole]);

  const loadData = useCallback(async () => {
    if (userRole === "VIEWER") {
      setIs403(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setIs403(false);
    try {
      const filters = {
        ...(filterSearch ? { search: filterSearch } : {}),
        ...(filterStore ? { storeId: filterStore } : {}),
        ...(filterSource ? { source: filterSource } : {}),
        ...(filterStatus ? { isActive: filterStatus as "true" | "false" } : {}),
      };
      const [linksData, summaryData, oasData] = await Promise.all([
        api.friendSourceLinks(Object.keys(filters).length ? filters : undefined),
        api.friendSourceLinksSummary(),
        api.lineOfficialAccounts(),
      ]);
      setLinks(linksData);
      setSummary(summaryData);
      setLineOas(oasData);
      if (userRole === "ADMIN") {
        void loadAttrConfigs();
      }
    } catch (err) {
      const evaluated = evaluateApiError(err, t.errorState);
      if (evaluated.is403) {
        setIs403(true);
      } else {
        setLoadError(evaluated.message);
      }
    } finally {
      setLoading(false);
    }
  }, [filterSearch, filterStore, filterSource, filterStatus, loadAttrConfigs, t.errorState, userRole]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const handleSaveAttrConfig = async () => {
    if (!editingConfig) return;
    setModalError(null);

    const channelClean = modalChannelId.trim();
    const liffClean = modalLiffId.trim();

    if (!/^[0-9]{8,20}$/.test(channelClean)) {
      setModalError(t.attrInvalidChannelId);
      return;
    }
    if (!/^[0-9]{8,20}-[a-zA-Z0-9_-]+$/.test(liffClean)) {
      setModalError(t.attrInvalidLiffId);
      return;
    }

    setSavingConfig(true);
    try {
      await api.upsertFriendAttributionConfig(editingConfig.lineOaId, {
        lineOaId: editingConfig.lineOaId,
        lineLoginChannelId: channelClean,
        liffId: liffClean,
        isEnabled: modalIsEnabled,
      });
      showToast(t.copiedToast);
      setEditingConfig(null);
      setAttrExpanded(true);
      await loadAttrConfigs();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to save attribution configuration");
    } finally {
      setSavingConfig(false);
    }
  };

  const eligibleOas = lineOas.filter(isAccountEligible);
  const filteredGeneratorOas = filterEligibleAccounts(lineOas, generatorSearch);

  const handleToggleSelection = (id: string) => {
    setValidationError(null);
    const result = toggleAccountSelection(selectedIds, id, MAX_PILOT_STORES, t.maxFiveAllowed);
    setSelectedIds(result.selected);
    if (result.error) {
      setValidationError(result.error);
    }
  };

  const handleGenerate = async () => {
    setValidationError(null);
    setGenerateError(null);
    setGenerateResult(null);

    const prepared = prepareGeneratePayload(selectedIds, t.minOneRequired, t.maxFiveAllowed);
    if (prepared.error) {
      setValidationError(prepared.error);
      return;
    }

    setGenerating(true);
    try {
      const result = await api.generateFriendSourceLinks(prepared.lineOaIds);
      setGenerateResult({ createdCount: result.createdCount, existingCount: result.existingCount });
      setSelectedIds([]);
      await loadData();
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleActive = async (link: FriendSourceLink, newActive: boolean) => {
    if (!newActive) {
      setConfirmDeactivate(link);
      return;
    }
    await doToggle(link.id, true);
  };

  const doToggle = async (id: string, isActive: boolean) => {
    setConfirmDeactivate(null);
    setTogglingId(id);
    try {
      const payload = prepareUpdatePayload(isActive);
      const updated = await api.updateFriendSourceLink(id, payload);
      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, isActive: updated.isActive } : l)));
      showToast(isActive ? t.statusActive : t.statusInactive);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed");
    } finally {
      setTogglingId(null);
    }
  };

  const handleCopyLink = async (shortUrl: string) => {
    const formatted = formatShortUrlForClipboard(shortUrl);
    try {
      await navigator.clipboard.writeText(formatted);
      showToast(t.copiedToast);
    } catch {
      showToast(`${t.copyFailedToast}: ${formatted}`);
    }
  };

  const handleOpenLink = (shortUrl: string) => {
    window.open(shortUrl, "_blank", "noopener,noreferrer");
  };

  const handleExportExcel = async (mode: "all" | "current") => {
    setExportMenuOpen(false);
    setExporting(true);
    try {
      let exportData: FriendSourceLink[] = [];
      if (mode === "all") {
        // Fetch ALL links without UI filters
        exportData = await api.friendSourceLinks();
      } else {
        // Fetch current filtered links
        const filters = {
          ...(filterSearch ? { search: filterSearch } : {}),
          ...(filterStore ? { storeId: filterStore } : {}),
          ...(filterSource ? { source: filterSource } : {}),
          ...(filterStatus ? { isActive: filterStatus as "true" | "false" } : {}),
        };
        exportData = await api.friendSourceLinks(Object.keys(filters).length ? filters : undefined);
      }

      if (!exportData || exportData.length === 0) {
        showToast(t.exportNoData);
        return;
      }

      const filename = buildExportFilename();
      const buffer = await createExcelWorkbookBuffer(exportData, language);
      triggerBrowserDownload(buffer, filename);
      showToast(t.exportSuccess(filename));
    } catch (err) {
      showToast(t.exportError(err instanceof Error ? err.message : "Export failed"));
    } finally {
      setExporting(false);
    }
  };

  const sourceLabel = (source: FriendSource) => {
    const labels: Record<FriendSource, string> = {
      STORE_QR: t.sourceStoreQr,
      TIKTOK: t.sourceTikTok,
      FACEBOOK: t.sourceFacebook,
      INSTAGRAM: t.sourceInstagram,
    };
    return labels[source] ?? source;
  };

  const kpis = calculateSummaryKPIs(summary);
  const uniqueStores = Array.from(new Map(links.map((l) => [l.storeId, l.storeName])).entries());

  // -----------------------------------------------------------------------
  // 403 guard (VIEWER or HTTP 403)
  // -----------------------------------------------------------------------
  if (is403 || userRole === "VIEWER") {
    return (
      <section className="col-span-2 flex flex-col items-center justify-center p-12 text-center">
        <p className="text-4xl">🔒</p>
        <h2 className="mt-4 text-xl font-bold text-[var(--app-text-primary)]">{t.error403}</h2>
        <p className="mt-2 text-xs text-[var(--app-text-secondary)]">{t.error403Description}</p>
      </section>
    );
  }

  // -----------------------------------------------------------------------
  // Loading
  // -----------------------------------------------------------------------
  if (loading && links.length === 0) {
    return (
      <section className="col-span-2 overflow-y-auto p-8">
        <LoadingState message={t.loading} />
      </section>
    );
  }

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------
  if (loadError && !loading) {
    return (
      <section className="col-span-2 flex flex-col items-center justify-center p-12 text-center">
        <ErrorState message={loadError} onRetry={() => void loadData()} />
      </section>
    );
  }

  return (
    <section className="col-span-2 overflow-y-auto p-4 sm:p-6">
      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface-elevated)] px-4 py-3 text-xs font-semibold text-[var(--app-text-primary)] shadow-[var(--app-shadow-elevated)]"
        >
          {toast}
        </div>
      )}

      {/* Deactivate confirm modal */}
      {confirmDeactivate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.deactivate}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-[var(--app-radius-xl)] border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[var(--app-shadow-modal)]">
            <h3 className="text-sm font-bold text-[var(--app-text-primary)]">{t.deactivate}</h3>
            <p className="mt-2 text-xs text-[var(--app-text-secondary)]">{t.confirmDeactivate(confirmDeactivate.shortUrl)}</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmDeactivate(null)}
              >
                {t.deactivateConfirmNo}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => void doToggle(confirmDeactivate.id, false)}
              >
                {t.deactivateConfirmYes}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header with Export Button */}
      <PageHeader
        tag="OPPO LINE OA · การตลาดและการติดตามเพื่อน"
        title={t.pageTitle}
        description={
          <div>
            <span>{t.pageDescription}</span>
            <span className="block mt-0.5 text-xs text-[var(--app-warning)]">{t.pilotNote}</span>
          </div>
        }
        actions={
          <div className="relative shrink-0">
            <Button
              id="fsl-export-button"
              type="button"
              variant="secondary"
              size="md"
              disabled={loading || exporting || (links.length === 0 && kpis.totalLinks === 0)}
              onClick={() => setExportMenuOpen((prev) => !prev)}
              aria-expanded={exportMenuOpen}
              aria-haspopup="true"
              className="gap-2"
            >
              <span>📊</span>
              <span>{exporting ? t.exportRunning : t.exportExcel}</span>
              <span className="text-[10px]">▼</span>
            </Button>

            {exportMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-12 z-30 w-64 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-1.5 shadow-[var(--app-shadow-elevated)]"
              >
                <button
                  id="fsl-export-all"
                  role="menuitem"
                  onClick={() => void handleExportExcel("all")}
                  className="flex w-full flex-col rounded-[var(--app-radius-md)] px-3 py-2 text-left text-xs hover:bg-[var(--app-surface-hover)] transition-colors"
                >
                  <span className="font-semibold text-[var(--app-text-primary)]">{t.exportAll}</span>
                  <span className="text-[11px] text-[var(--app-text-secondary)]">
                    {language === "th"
                      ? "ดาวน์โหลดลิงก์จากทุกร้านค้าในระบบ"
                      : language === "zh"
                      ? "下载系统中所有门店的链接"
                      : "Download all links across all stores"}
                  </span>
                </button>

                <button
                  id="fsl-export-current"
                  role="menuitem"
                  onClick={() => void handleExportExcel("current")}
                  className="mt-1 flex w-full flex-col rounded-[var(--app-radius-md)] px-3 py-2 text-left text-xs hover:bg-[var(--app-surface-hover)] transition-colors"
                >
                  <span className="font-semibold text-[var(--app-text-primary)]">{t.exportCurrent}</span>
                  <span className="text-[11px] text-[var(--app-text-secondary)]">
                    {language === "th"
                      ? "ดาวน์โหลดเฉพาะรายการที่ตรงกับตัวกรอง"
                      : language === "zh"
                      ? "仅下载符合当前筛选条件的链接"
                      : "Download links matching active filters"}
                  </span>
                </button>
              </div>
            )}
          </div>
        }
      />

      {/* KPI cards */}
      {(() => {
        const attrKpis = calculateAttributionKPIs(links);
        return (
          <div className="my-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricCard
              label={t.totalClicks}
              value={`👆 ${attrKpis.totalClicks}`}
              tone="default"
            />
            <MetricCard
              label={t.totalIdentifiedVisits}
              value={`👤 ${attrKpis.identifiedVisits}`}
              tone="info"
            />
            <MetricCard
              label={t.totalConfirmedAdds}
              value={`🎉 ${attrKpis.confirmedAdds}`}
              tone="success"
            />
            <MetricCard
              label={t.overallConversionRate}
              value={`📈 ${attrKpis.overallConversionRate}`}
              tone="accent"
            />
          </div>
        );
      })()}

      {/* Generator card */}
      <Card className="mb-6 p-5 sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--app-text-primary)]">
          {t.generatorTitle}
        </h2>
        <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{t.generatorDescription}</p>
        <p className="mt-0.5 text-[11px] text-[var(--app-text-tertiary)]">{t.eligibleOnly}</p>

        {/* Generator search */}
        <div className="mt-4">
          <input
            id="fsl-generator-search"
            type="text"
            value={generatorSearch}
            onChange={(e) => setGeneratorSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchPlaceholder}
            className="app-input w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--input-background)] px-3 py-2 text-xs text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)]"
          />
        </div>

        {/* Selected count + preview */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-[var(--app-text-secondary)]">
            {t.selectedCount(selectedIds.length, MAX_PILOT_STORES)}
          </span>
          {selectedIds.length > 0 && (
            <Badge variant="success" size="sm">
              {t.generatorPreview(selectedIds.length, ALL_SOURCES.length, selectedIds.length * ALL_SOURCES.length)}
            </Badge>
          )}
        </div>

        {/* Validation error */}
        {validationError && (
          <p role="alert" className="mt-2 text-xs font-medium text-[var(--app-danger)]">
            {validationError}
          </p>
        )}

        {/* Account list */}
        <div
          className="mt-3 max-h-56 overflow-y-auto rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)]"
          role="listbox"
          aria-multiselectable="true"
          aria-label={t.generatorTitle}
        >
          {eligibleOas.length === 0 && (
            <p className="p-4 text-center text-xs text-[var(--app-text-tertiary)]">{t.noEligibleAccounts}</p>
          )}
          {filteredGeneratorOas.map((oa) => {
            const isSelected = selectedIds.includes(oa.id);
            return (
              <button
                key={oa.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleToggleSelection(oa.id)}
                disabled={!isSelected && selectedIds.length >= MAX_PILOT_STORES}
                className={`flex w-full items-center gap-3 border-b border-[var(--app-border-subtle)] px-4 py-2.5 text-left text-xs last:border-b-0 hover:bg-[var(--app-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${
                  isSelected ? "bg-[var(--app-accent-soft)]" : ""
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                    isSelected
                      ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-white"
                      : "border-[var(--app-border)] bg-[var(--app-surface)]"
                  }`}
                  aria-hidden="true"
                >
                  {isSelected ? "✓" : ""}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--app-text-primary)]">{oa.store.name}</p>
                  <p className="truncate text-[11px] text-[var(--app-text-secondary)]">
                    {oa.name} · {oa.basicId}
                  </p>
                </div>
              </button>
            );
          })}
          {filteredGeneratorOas.length === 0 && eligibleOas.length > 0 && (
            <p className="p-4 text-center text-xs text-[var(--app-text-tertiary)]">{t.noResults}</p>
          )}
        </div>

        {/* Generate error */}
        {generateError && (
          <div role="alert" className="mt-3 rounded-[var(--app-radius-md)] border border-[var(--app-danger)]/20 bg-[var(--app-danger-soft)] p-3 text-xs text-[var(--app-danger)]">
            {generateError}
          </div>
        )}

        {/* Generate success */}
        {generateResult && (
          <div role="status" className="mt-3 rounded-[var(--app-radius-md)] border border-[var(--app-success)]/20 bg-[var(--app-success-soft)] p-3 text-xs text-[var(--app-success)]">
            <p className="font-semibold">{t.generateSuccess(generateResult.createdCount, generateResult.existingCount)}</p>
            <p className="mt-1 text-[11px] opacity-90">{t.generateIdempotentNote}</p>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button
            id="fsl-generate-button"
            variant="primary"
            size="md"
            onClick={() => void handleGenerate()}
            disabled={generating || selectedIds.length === 0}
            isLoading={generating}
          >
            {generating ? t.generating : t.generateButton}
          </Button>
        </div>
      </Card>

      {/* Attribution Config Card for ADMIN */}
      {userRole === "ADMIN" && (
        <div id="fsl-attribution-card">
          <Card className="mb-6 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--app-text-primary)]">
                    {t.attributionSectionTitle}
                  </h2>
                </div>
                <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{t.attributionSectionDesc}</p>
                <div className="mt-2">
                  <span
                    id="fsl-attribution-summary"
                    className="inline-block rounded-[var(--app-radius-sm)] border border-[var(--app-border-subtle)] bg-[var(--app-surface-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--app-text-secondary)]"
                  >
                    {t.attrSummary(
                      attrCounts.total,
                      attrCounts.enabled,
                      attrCounts.disabled,
                      attrCounts.notConfigured
                    )}
                  </span>
                </div>
              </div>

              <Button
                id="fsl-attribution-toggle-btn"
                variant="secondary"
                size="sm"
                aria-expanded={attrExpanded}
                aria-controls="fsl-attribution-content"
                onClick={() => setAttrExpanded((prev) => !prev)}
                className="gap-1.5"
              >
                <span>{attrExpanded ? t.attrCollapse : t.attrExpand}</span>
                <span className="text-[10px] text-[var(--app-text-tertiary)]">{attrExpanded ? "▲" : "▼"}</span>
              </Button>
            </div>

            {attrConfigsLoading ? (
              <div role="status" className="mt-4 p-4 text-center text-xs text-[var(--app-text-secondary)]">
                {t.generating}
              </div>
            ) : attrConfigsError ? (
              <div role="alert" className="mt-4 rounded-[var(--app-radius-md)] border border-[var(--app-danger)]/20 bg-[var(--app-danger-soft)] p-3 text-xs text-[var(--app-danger)]">
                <p>{attrConfigsError}</p>
                <button
                  onClick={() => void loadAttrConfigs()}
                  className="mt-2 text-[11px] font-semibold underline hover:opacity-80"
                >
                  {t.retry}
                </button>
              </div>
            ) : (
              attrExpanded && (
                <div id="fsl-attribution-content" className="mt-4">
                  {/* Search & Filter Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--app-radius-md)] border border-[var(--app-border-subtle)] bg-[var(--app-surface-subtle)] p-2.5">
                    <input
                      id="fsl-attribution-search"
                      type="text"
                      value={attrSearchQuery}
                      onChange={(e) => setAttrSearchQuery(e.target.value)}
                      placeholder={t.attrSearchPlaceholder}
                      className="app-input w-full max-w-xs rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--input-background)] px-3 py-1.5 text-xs text-[var(--app-text-primary)]"
                    />

                    <select
                      id="fsl-attribution-status-filter"
                      value={attrStatusFilter}
                      onChange={(e) => setAttrStatusFilter(e.target.value as typeof attrStatusFilter)}
                      className="app-input rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--input-background)] px-3 py-1.5 text-xs font-medium text-[var(--app-text-primary)]"
                    >
                      <option value="ALL">{t.attrFilterAll}</option>
                      <option value="ENABLED">{t.attrFilterEnabled}</option>
                      <option value="DISABLED">{t.attrFilterDisabled}</option>
                      <option value="NOT_CONFIGURED">{t.attrFilterNotConfigured}</option>
                    </select>
                  </div>

                  {/* Scrollable list container */}
                  <div
                    id="fsl-attribution-list-container"
                    className="mt-3 max-h-[440px] overflow-y-auto divide-y divide-[var(--app-border-subtle)] rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)]"
                  >
                    {filteredAttrConfigs.length === 0 ? (
                      <div role="status" className="p-4 text-center text-xs text-[var(--app-text-tertiary)]">
                        {t.noResults}
                      </div>
                    ) : (
                      filteredAttrConfigs.map((cfg) => {
                        const isConfigured = cfg.isConfigured || Boolean(cfg.liffId);
                        const isEnabled = cfg.isEnabled;

                        return (
                          <div
                            key={cfg.lineOaId}
                            className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-xs hover:bg-[var(--app-surface-hover)] transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-[var(--app-text-primary)]">{cfg.storeName || cfg.lineOaName}</span>
                                <span className="text-[var(--app-text-secondary)] text-[11px]">
                                  ({cfg.lineOaName}{cfg.basicId ? ` · ${cfg.basicId}` : ""})
                                </span>
                              </div>
                              {isConfigured && cfg.liffId && (
                                <p className="mt-0.5 font-mono text-[11px] text-[var(--app-text-tertiary)]">
                                  Channel: {cfg.lineLoginChannelId || "-"} · LIFF: {cfg.liffId}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <Badge
                                size="sm"
                                variant={
                                  !isConfigured
                                    ? "neutral"
                                    : isEnabled
                                    ? "success"
                                    : "warning"
                                }
                              >
                                {!isConfigured
                                  ? t.attrStatusNotConfigured
                                  : isEnabled
                                  ? t.attrStatusEnabled
                                  : t.attrStatusDisabled}
                              </Badge>

                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setEditingConfig(cfg);
                                  setModalChannelId(cfg.lineLoginChannelId || "");
                                  setModalLiffId(cfg.liffId || "");
                                  setModalIsEnabled(cfg.isEnabled ?? true);
                                  setModalError(null);
                                }}
                              >
                                {isConfigured ? t.attrEditBtn : t.attrConfigureBtn}
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )
            )}
          </Card>
        </div>
      )}

      {/* Attribution Config Modal */}
      {editingConfig && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[var(--app-radius-xl)] border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[var(--app-shadow-modal)]">
            <h3 className="text-sm font-bold text-[var(--app-text-primary)]">{t.attrModalTitle(editingConfig.storeName || editingConfig.lineOaName)}</h3>
            <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{editingConfig.lineOaName} ({editingConfig.basicId})</p>

            {modalError && (
              <div role="alert" className="mt-3 rounded-[var(--app-radius-md)] border border-[var(--app-danger)]/20 bg-[var(--app-danger-soft)] p-2.5 text-xs text-[var(--app-danger)]">
                {modalError}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--app-text-secondary)]">{t.attrModalChannelId}</label>
                <input
                  type="text"
                  value={modalChannelId}
                  onChange={(e) => setModalChannelId(e.target.value)}
                  placeholder="e.g. 2007073384"
                  className="app-input mt-1 w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--input-background)] px-3 py-2 text-xs text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--app-text-secondary)]">{t.attrModalLiffId}</label>
                <input
                  type="text"
                  value={modalLiffId}
                  onChange={(e) => setModalLiffId(e.target.value)}
                  placeholder="e.g. 2007073384-AbCdEfGh"
                  className="app-input mt-1 w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--input-background)] px-3 py-2 text-xs text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="attr-modal-enabled"
                  checked={modalIsEnabled}
                  onChange={(e) => setModalIsEnabled(e.target.checked)}
                  className="rounded border-[var(--app-border)] accent-[var(--app-accent)]"
                />
                <label htmlFor="attr-modal-enabled" className="text-xs font-medium text-[var(--app-text-primary)] cursor-pointer select-none">
                  {t.attrModalEnabled}
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditingConfig(null)}
              >
                {t.attrModalCancelBtn}
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={savingConfig}
                isLoading={savingConfig}
                onClick={() => void handleSaveAttrConfig()}
              >
                {savingConfig ? t.toggleSaving : t.attrModalSaveBtn}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="mb-4">
        <FilterBar
          searchSlot={
            <SearchInput
              id="fsl-filter-search"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              onClear={() => setFilterSearch("")}
              placeholder={t.filterSearch}
            />
          }
          filtersSlot={
            <>
              <select
                id="fsl-filter-store"
                value={filterStore}
                onChange={(e) => setFilterStore(e.target.value)}
                aria-label={t.filterStore}
                className="app-input rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--input-background)] px-3 py-2 text-xs font-medium text-[var(--app-text-primary)] outline-none"
              >
                <option value="">{t.filterStore}: {t.filterStatusAll}</option>
                {uniqueStores.map(([storeId, storeName]) => (
                  <option key={storeId} value={storeId}>
                    {storeName ?? storeId}
                  </option>
                ))}
              </select>

              <select
                id="fsl-filter-source"
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value as FriendSource | "")}
                aria-label={t.filterSource}
                className="app-input rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--input-background)] px-3 py-2 text-xs font-medium text-[var(--app-text-primary)] outline-none"
              >
                <option value="">{t.filterSource}: {t.filterStatusAll}</option>
                {ALL_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {sourceLabel(s)}
                  </option>
                ))}
              </select>

              <select
                id="fsl-filter-status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as "" | "true" | "false")}
                aria-label={t.filterStatus}
                className="app-input rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--input-background)] px-3 py-2 text-xs font-medium text-[var(--app-text-primary)] outline-none"
              >
                <option value="">{t.filterStatus}: {t.filterStatusAll}</option>
                <option value="true">{t.filterStatusActive}</option>
                <option value="false">{t.filterStatusInactive}</option>
              </select>

              {(filterSearch || filterStore || filterSource || filterStatus) && (
                <Button
                  id="fsl-clear-filters"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterSearch("");
                    setFilterStore("");
                    setFilterSource("");
                    setFilterStatus("");
                  }}
                >
                  {t.clearFilters}
                </Button>
              )}
            </>
          }
        />
      </div>

      {/* Links table */}
      {links.length === 0 && !loading ? (
        <Card className="p-12 text-center">
          {filterSearch || filterStore || filterSource || filterStatus ? (
            <>
              <p className="text-4xl">🔍</p>
              <h3 className="mt-4 text-sm font-bold text-[var(--app-text-primary)]">{t.noResults}</h3>
              <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{t.noResultsDescription}</p>
            </>
          ) : (
            <>
              <p className="text-4xl">🔗</p>
              <h3 className="mt-4 text-sm font-bold text-[var(--app-text-primary)]">{t.emptyState}</h3>
              <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{t.emptyStateDescription}</p>
            </>
          )}
        </Card>
      ) : (
        <TableContainer>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>{t.tableStore}</TableHead>
                  <TableHead>{t.tableLineOa}</TableHead>
                  <TableHead>{t.tableSource}</TableHead>
                  <TableHead>{t.tableShortLink}</TableHead>
                  <TableHead align="right">{t.tableClicks}</TableHead>
                  <TableHead align="right" title={t.tooltipIdentified}>
                    <span className="cursor-help underline decoration-dotted">{t.tableIdentifiedVisits}</span>
                  </TableHead>
                  <TableHead align="right" title={t.tooltipConfirmed}>
                    <span className="cursor-help underline decoration-dotted">{t.tableConfirmedAdds}</span>
                  </TableHead>
                  <TableHead align="right" title={t.tooltipConversion}>
                    <span className="cursor-help underline decoration-dotted">{t.tableConversionRate}</span>
                  </TableHead>
                  <TableHead align="center">{t.tableStatus}</TableHead>
                  <TableHead align="right">{t.tableActions}</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {links.map((link) => (
                  <TableRow key={link.id} className={link.isActive ? "" : "opacity-60"}>
                    <TableCell className="font-semibold text-[var(--app-text-primary)]">
                      {link.storeName ?? link.storeId}
                    </TableCell>
                    <TableCell className="text-xs text-[var(--app-text-secondary)]">
                      {link.lineOaName ?? link.lineOaId}
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral" size="sm">
                        {sourceLabel(link.source)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-[var(--app-text-secondary)]">{link.shortUrl}</span>
                    </TableCell>
                    <TableCell align="right" className="tabular-nums font-medium text-[var(--app-text-primary)]">
                      {link.clickCount}
                    </TableCell>
                    <TableCell align="right" className="tabular-nums text-xs text-[var(--app-text-secondary)]">
                      {link.identifiedVisits || 0}
                    </TableCell>
                    <TableCell align="right" className="tabular-nums">
                      <span
                        className={
                          (link.confirmedAdds || 0) > 0
                            ? "inline-block rounded-[var(--app-radius-sm)] bg-[var(--app-success-soft)] px-2 py-0.5 font-bold text-[var(--app-success)]"
                            : "text-[var(--app-text-secondary)]"
                        }
                      >
                        {link.confirmedAdds || 0}
                      </span>
                    </TableCell>
                    <TableCell align="right" className="tabular-nums font-bold text-[var(--app-text-primary)]">
                      {formatConversionRate(
                        link.conversionRate ?? (link.clickCount > 0 ? (link.confirmedAdds || 0) / link.clickCount : 0)
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Badge
                        size="md"
                        variant={link.isActive ? "success" : "neutral"}
                        dot
                        aria-label={link.isActive ? t.statusActive : t.statusInactive}
                      >
                        {link.isActive ? t.statusActive : t.statusInactive}
                      </Badge>
                    </TableCell>
                    <TableCell align="right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={`${t.copyLink}: ${link.shortUrl}`}
                          onClick={() => void handleCopyLink(link.shortUrl)}
                        >
                          {t.copyLink}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={`${t.openLink}: ${link.shortUrl}`}
                          onClick={() => handleOpenLink(link.shortUrl)}
                        >
                          {t.openLink}
                        </Button>
                        {link.source === "STORE_QR" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={t.qrDownloadSoon}
                            disabled
                            title={t.qrDownloadSoon}
                            className="border-dashed opacity-40 cursor-not-allowed"
                          >
                            QR
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={link.isActive ? "danger" : "secondary"}
                          aria-label={link.isActive ? t.deactivate : t.activate}
                          onClick={() => void handleToggleActive(link, !link.isActive)}
                          disabled={togglingId === link.id}
                        >
                          {togglingId === link.id
                            ? t.toggleSaving
                            : link.isActive
                            ? t.deactivate
                            : t.activate}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TableContainer>
      )}
    </section>
  );
}
