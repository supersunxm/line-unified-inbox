"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { FriendSource, FriendSourceLink, FriendSourceLinksSummaryItem, LineOfficialAccountResponse } from "@/types/api";
import { getFriendSourceLinksText, type Language } from "./friend-source-links-translations.ts";
import {
  ALL_SOURCES,
  MAX_PILOT_STORES,
  calculateSummaryKPIs,
  evaluateApiError,
  filterEligibleAccounts,
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
  userRole?: "ADMIN" | "VIEWER" | string;
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
  }, [filterSearch, filterStore, filterSource, filterStatus, t.errorState, userRole]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

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
        <h2 className="mt-4 text-xl font-bold">{t.error403}</h2>
        <p className="mt-2 text-slate-500">{t.error403Description}</p>
      </section>
    );
  }

  // -----------------------------------------------------------------------
  // Loading
  // -----------------------------------------------------------------------
  if (loading && links.length === 0) {
    return (
      <section className="col-span-2 overflow-y-auto p-8">
        <div className="flex items-center gap-3 text-slate-500">
          <span className="animate-spin text-xl">⏳</span>
          <span>{t.loading}</span>
        </div>
        <div className="mt-6 space-y-3">
          {[...Array<unknown>(6)].map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      </section>
    );
  }

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------
  if (loadError && !loading) {
    return (
      <section className="col-span-2 flex flex-col items-center justify-center p-12 text-center">
        <p className="text-4xl">⚠️</p>
        <h2 className="mt-4 text-xl font-bold">{t.errorState}</h2>
        <p className="mt-2 text-sm text-red-700">{loadError}</p>
        <button
          onClick={() => void loadData()}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
        >
          {t.retry}
        </button>
      </section>
    );
  }

  return (
    <section className="col-span-2 overflow-y-auto p-6">
      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 px-5 py-3 text-sm text-white shadow-lg"
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
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
        >
          <div className="app-card w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <p className="text-sm">{t.confirmDeactivate(confirmDeactivate.shortUrl)}</p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeactivate(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
              >
                {t.deactivateConfirmNo}
              </button>
              <button
                onClick={() => void doToggle(confirmDeactivate.id, false)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-500"
              >
                {t.deactivateConfirmYes}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header with Export Button */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t.pageTitle}</h1>
          <p className="mt-1 text-sm text-slate-500">{t.pageDescription}</p>
          <p className="mt-1 text-xs text-amber-600">{t.pilotNote}</p>
        </div>

        {/* Excel Export Button & Choice Menu */}
        <div className="relative shrink-0">
          <button
            id="fsl-export-button"
            type="button"
            disabled={loading || exporting || (links.length === 0 && kpis.totalLinks === 0)}
            onClick={() => setExportMenuOpen((prev) => !prev)}
            aria-expanded={exportMenuOpen}
            aria-haspopup="true"
            className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>📊</span>
            <span>{exporting ? t.exportRunning : t.exportExcel}</span>
            <span className="text-xs">▼</span>
          </button>

          {exportMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-12 z-30 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
            >
              <button
                id="fsl-export-all"
                role="menuitem"
                onClick={() => void handleExportExcel("all")}
                className="flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100"
              >
                <span className="font-semibold text-slate-900">{t.exportAll}</span>
                <span className="text-xs text-slate-500">
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
                className="mt-1 flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100"
              >
                <span className="font-semibold text-slate-900">{t.exportCurrent}</span>
                <span className="text-xs text-slate-500">
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
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {(
          [
            [t.totalLinks, kpis.totalLinks, "🔗"],
            [t.activeLinks, kpis.activeLinks, "✅"],
            [t.totalClicks, kpis.totalClicks, "👆"],
            [t.storesConfigured, kpis.storesConfigured, "🏪"],
          ] as Array<[string, number, string]>
        ).map(([label, value, icon]) => (
          <div key={label} className="app-card p-5">
            <p className="app-muted text-xs font-medium">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {icon} {value}
            </p>
          </div>
        ))}
      </div>

      {/* Generator card */}
      <div className="app-card mb-6 rounded-2xl p-6">
        <h2 className="text-lg font-semibold">{t.generatorTitle}</h2>
        <p className="mt-1 text-sm text-slate-500">{t.generatorDescription}</p>
        <p className="mt-1 text-xs text-slate-400">{t.eligibleOnly}</p>

        {/* Generator search */}
        <div className="mt-4">
          <input
            id="fsl-generator-search"
            type="text"
            value={generatorSearch}
            onChange={(e) => setGeneratorSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchPlaceholder}
            className="app-input w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </div>

        {/* Selected count + preview */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">
            {t.selectedCount(selectedIds.length, MAX_PILOT_STORES)}
          </span>
          {selectedIds.length > 0 && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
              {t.generatorPreview(selectedIds.length, ALL_SOURCES.length, selectedIds.length * ALL_SOURCES.length)}
            </span>
          )}
        </div>

        {/* Validation error */}
        {validationError && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {validationError}
          </p>
        )}

        {/* Account list */}
        <div
          className="mt-3 max-h-56 overflow-y-auto rounded-lg border"
          role="listbox"
          aria-multiselectable="true"
          aria-label={t.generatorTitle}
        >
          {eligibleOas.length === 0 && (
            <p className="p-4 text-center text-sm text-slate-500">{t.noEligibleAccounts}</p>
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
                className={`flex w-full items-center gap-3 border-b px-4 py-3 text-left text-sm last:border-b-0 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${
                  isSelected ? "bg-green-50" : ""
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold ${
                    isSelected
                      ? "border-green-600 bg-green-600 text-white"
                      : "border-slate-300 bg-white"
                  }`}
                  aria-hidden="true"
                >
                  {isSelected ? "✓" : ""}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{oa.store.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {oa.name} · {oa.basicId}
                  </p>
                </div>
              </button>
            );
          })}
          {filteredGeneratorOas.length === 0 && eligibleOas.length > 0 && (
            <p className="p-4 text-center text-sm text-slate-500">{t.noResults}</p>
          )}
        </div>

        {/* Generate error */}
        {generateError && (
          <div role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {generateError}
          </div>
        )}

        {/* Generate success */}
        {generateResult && (
          <div role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">
            <p>{t.generateSuccess(generateResult.createdCount, generateResult.existingCount)}</p>
            <p className="mt-1 text-xs text-green-700">{t.generateIdempotentNote}</p>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            id="fsl-generate-button"
            onClick={() => void handleGenerate()}
            disabled={generating || selectedIds.length === 0}
            className="rounded-lg bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-50"
          >
            {generating ? t.generating : t.generateButton}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          id="fsl-filter-search"
          type="text"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          placeholder={t.filterSearch}
          aria-label={t.filterSearch}
          className="app-input rounded-lg border px-3 py-2 text-sm outline-none focus:border-slate-500"
        />

        <select
          id="fsl-filter-store"
          value={filterStore}
          onChange={(e) => setFilterStore(e.target.value)}
          aria-label={t.filterStore}
          className="app-input rounded-lg border px-3 py-2 text-sm outline-none focus:border-slate-500"
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
          className="app-input rounded-lg border px-3 py-2 text-sm outline-none focus:border-slate-500"
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
          className="app-input rounded-lg border px-3 py-2 text-sm outline-none focus:border-slate-500"
        >
          <option value="">{t.filterStatus}: {t.filterStatusAll}</option>
          <option value="true">{t.filterStatusActive}</option>
          <option value="false">{t.filterStatusInactive}</option>
        </select>

        {(filterSearch || filterStore || filterSource || filterStatus) && (
          <button
            id="fsl-clear-filters"
            onClick={() => {
              setFilterSearch("");
              setFilterStore("");
              setFilterSource("");
              setFilterStatus("");
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            {t.clearFilters}
          </button>
        )}
      </div>

      {/* Links table */}
      {links.length === 0 && !loading ? (
        <div className="app-card rounded-2xl p-12 text-center">
          {filterSearch || filterStore || filterSource || filterStatus ? (
            <>
              <p className="text-4xl">🔍</p>
              <h3 className="mt-4 text-lg font-semibold">{t.noResults}</h3>
              <p className="mt-2 text-sm text-slate-500">{t.noResultsDescription}</p>
            </>
          ) : (
            <>
              <p className="text-4xl">🔗</p>
              <h3 className="mt-4 text-lg font-semibold">{t.emptyState}</h3>
              <p className="mt-2 text-sm text-slate-500">{t.emptyStateDescription}</p>
            </>
          )}
        </div>
      ) : (
        <div className="app-card overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  {[t.tableStore, t.tableLineOa, t.tableSource, t.tableShortLink, t.tableClicks, t.tableStatus, t.tableActions].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {links.map((link) => (
                  <tr key={link.id} className={link.isActive ? "" : "opacity-60"}>
                    <td className="px-4 py-3 font-medium">{link.storeName ?? link.storeId}</td>
                    <td className="px-4 py-3 text-slate-600">{link.lineOaName ?? link.lineOaId}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {sourceLabel(link.source)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-700">{link.shortUrl}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{link.clickCount}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          link.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-slate-200 text-slate-600"
                        }`}
                        aria-label={link.isActive ? t.statusActive : t.statusInactive}
                      >
                        {link.isActive ? `● ${t.statusActive}` : `○ ${t.statusInactive}`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          aria-label={`${t.copyLink}: ${link.shortUrl}`}
                          onClick={() => void handleCopyLink(link.shortUrl)}
                          className="rounded border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50"
                        >
                          {t.copyLink}
                        </button>
                        <button
                          aria-label={`${t.openLink}: ${link.shortUrl}`}
                          onClick={() => handleOpenLink(link.shortUrl)}
                          className="rounded border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50"
                        >
                          {t.openLink}
                        </button>
                        {link.source === "STORE_QR" && (
                          <button
                            aria-label={t.qrDownloadSoon}
                            disabled
                            title={t.qrDownloadSoon}
                            className="rounded border border-dashed border-slate-300 px-2.5 py-1 text-xs text-slate-400 cursor-not-allowed"
                          >
                            QR
                          </button>
                        )}
                        <button
                          aria-label={link.isActive ? t.deactivate : t.activate}
                          onClick={() => void handleToggleActive(link, !link.isActive)}
                          disabled={togglingId === link.id}
                          className={`rounded border px-2.5 py-1 text-xs ${
                            togglingId === link.id
                              ? "cursor-not-allowed opacity-50"
                              : link.isActive
                              ? "border-red-200 text-red-700 hover:bg-red-50"
                              : "border-green-200 text-green-700 hover:bg-green-50"
                          }`}
                        >
                          {togglingId === link.id
                            ? t.toggleSaving
                            : link.isActive
                            ? t.deactivate
                            : t.activate}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
