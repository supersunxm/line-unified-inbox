"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import type {
  AutoResponseRule,
  AutoResponseStatus,
  AutoResponsePreviewResult,
  ApiStore,
} from "@/types/api";
import { autoResponseI18n } from "./auto-response-i18n";

type AutoResponsesViewProps = {
  language: "th" | "en" | "zh";
  userRole: "ADMIN" | "VIEWER";
};

export function AutoResponsesView({ language, userRole }: AutoResponsesViewProps) {
  const t = autoResponseI18n[language] || autoResponseI18n.th;
  const isAdmin = userRole === "ADMIN";

  const [rules, setRules] = useState<AutoResponseRule[]>([]);
  const [stores, setStores] = useState<ApiStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AutoResponseStatus>("ALL");

  // Selection & Mode
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formTemplate, setFormTemplate] = useState("");
  const [saving, setSaving] = useState(false);

  // Variable dropdown
  const [showVarDropdown, setShowVarDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Preview State
  const [previewStoreId, setPreviewStoreId] = useState<string>("");
  const [previewData, setPreviewData] = useState<AutoResponsePreviewResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Modals
  const [confirmAction, setConfirmAction] = useState<{
    type: "activate" | "deactivate" | "archive";
    rule: AutoResponseRule;
  } | null>(null);
  const [usageModalRule, setUsageModalRule] = useState<AutoResponseRule | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load Rules & Stores
  const loadData = async () => {
    try {
      setLoading(true);
      const [rulesData, storesData] = await Promise.all([
        api.listAutoResponses(),
        api.stores().catch(() => []),
      ]);
      setRules(rulesData);
      setStores(storesData);
      if (storesData.length > 0 && !previewStoreId) {
        setPreviewStoreId(storesData[0].id);
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to load auto-responses", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const selectedRule = useMemo(() => {
    return rules.find((r) => r.id === selectedRuleId) || null;
  }, [rules, selectedRuleId]);

  // Handle Preview
  useEffect(() => {
    if (!selectedRule && !isCreating) {
      setPreviewData(null);
      return;
    }

    if (isEditing || isCreating) {
      // Local live evaluation preview
      const selectedStore = stores.find((s) => s.id === previewStoreId);
      const storeName = selectedStore?.name || "OPPO Store";
      const mapsUrl = selectedStore?.googleMapsUrl || "";
      const lineOaLink = "https://line.me/R/ti/p/@oppostore";
      const tiktokUrl = "";

      let resolved = formTemplate
        .replace(/\{\{\s*store\.storeName\s*\}\}/g, storeName)
        .replace(/\{\{\s*storeName\s*\}\}/g, storeName)
        .replace(/\{\{\s*store\.googleMapsUrl\s*\}\}/g, mapsUrl)
        .replace(/\{\{\s*googleMapsUrl\s*\}\}/g, mapsUrl)
        .replace(/\{\{\s*store\.lineOaLink\s*\}\}/g, lineOaLink)
        .replace(/\{\{\s*lineOaLink\s*\}\}/g, lineOaLink)
        .replace(/\{\{\s*store\.tiktokProfileUrl\s*\}\}/g, tiktokUrl)
        .replace(/\{\{\s*tiktokProfileUrl\s*\}\}/g, tiktokUrl);

      const unres = resolved.match(/\{\{([^}]+)\}\}/g) || [];
      const needsMaps =
        formTemplate.includes("store.googleMapsUrl") || formTemplate.includes("googleMapsUrl");
      const ready = !unres.length && (!needsMaps || Boolean(mapsUrl));
      let reason: string | null = null;
      if (unres.length) {
        reason = `Unresolved variables: ${unres.join(", ")}`;
      } else if (needsMaps && !mapsUrl) {
        reason = t.previewMissingMaps;
      }

      setPreviewData({
        ruleId: selectedRule?.id || "draft",
        ruleName: formName || "Preview",
        store: {
          lineOfficialAccountId: "",
          lineOfficialAccountName: storeName,
          storeId: selectedStore?.id || null,
          storeName,
          externalStoreId: selectedStore?.code || selectedStore?.storeId || null,
          googleMapsUrl: mapsUrl || null,
        },
        usedVariables: [],
        resolvedText: resolved,
        unresolvedVariables: unres,
        ready,
        reason,
      });
      return;
    }

    if (selectedRule && previewStoreId) {
      setLoadingPreview(true);
      api
        .previewAutoResponse(selectedRule.id, { storeId: previewStoreId })
        .then((data) => setPreviewData(data))
        .catch(() => setPreviewData(null))
        .finally(() => setLoadingPreview(false));
    }
  }, [
    selectedRule,
    isEditing,
    isCreating,
    formTemplate,
    formName,
    previewStoreId,
    stores,
    t.previewMissingMaps,
  ]);

  // Filtered Rules
  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      if (statusFilter !== "ALL" && rule.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = rule.name.toLowerCase().includes(q);
        const matchText = rule.textTemplate.toLowerCase().includes(q);
        const matchDesc = rule.description?.toLowerCase().includes(q);
        if (!matchName && !matchText && !matchDesc) return false;
      }
      return true;
    });
  }, [rules, statusFilter, searchQuery]);

  // Insert Variable at cursor position
  const insertVariable = (variableSyntax: string) => {
    if (!textareaRef.current) {
      setFormTemplate((prev) => prev + variableSyntax);
      setShowVarDropdown(false);
      return;
    }
    const elem = textareaRef.current;
    const start = elem.selectionStart;
    const end = elem.selectionEnd;
    const current = formTemplate;
    const next = current.substring(0, start) + variableSyntax + current.substring(end);
    setFormTemplate(next);
    setShowVarDropdown(false);
    setTimeout(() => {
      elem.focus();
      elem.setSelectionRange(start + variableSyntax.length, start + variableSyntax.length);
    }, 50);
  };

  const startCreate = () => {
    setSelectedRuleId(null);
    setFormName("");
    setFormDesc("");
    setFormTemplate("");
    setIsCreating(true);
    setIsEditing(false);
  };

  const startEdit = (rule: AutoResponseRule) => {
    setSelectedRuleId(rule.id);
    setFormName(rule.name);
    setFormDesc(rule.description || "");
    setFormTemplate(rule.textTemplate);
    setIsEditing(true);
    setIsCreating(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setIsCreating(false);
    if (selectedRule) {
      setFormName(selectedRule.name);
      setFormDesc(selectedRule.description || "");
      setFormTemplate(selectedRule.textTemplate);
    }
  };

  const handleSave = async (activateImmediately: boolean = false) => {
    if (!formName.trim()) {
      showToast(t.errorRequiredName, "error");
      return;
    }
    if (!formTemplate.trim()) {
      showToast(t.errorRequiredText, "error");
      return;
    }

    try {
      setSaving(true);
      if (isCreating) {
        const created = await api.createAutoResponse({
          name: formName.trim(),
          description: formDesc.trim() || undefined,
          textTemplate: formTemplate.trim(),
        });
        if (activateImmediately) {
          const activated = await api.activateAutoResponse(created.id);
          showToast(t.activateSuccess);
          setSelectedRuleId(activated.id);
        } else {
          showToast(t.createSuccess);
          setSelectedRuleId(created.id);
        }
      } else if (selectedRule) {
        const updated = await api.updateAutoResponse(selectedRule.id, {
          name: formName.trim(),
          description: formDesc.trim() || undefined,
          textTemplate: formTemplate.trim(),
        });
        if (activateImmediately && updated.status !== "ACTIVE") {
          const activated = await api.activateAutoResponse(updated.id);
          showToast(t.activateSuccess);
          setSelectedRuleId(activated.id);
        } else {
          showToast(t.updateSuccess);
          setSelectedRuleId(updated.id);
        }
      }
      setIsEditing(false);
      setIsCreating(false);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || "Failed to save auto-response", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, rule } = confirmAction;
    try {
      setSaving(true);
      if (type === "activate") {
        await api.activateAutoResponse(rule.id);
        showToast(t.activateSuccess);
      } else if (type === "deactivate") {
        await api.deactivateAutoResponse(rule.id);
        showToast(t.deactivateSuccess);
      } else if (type === "archive") {
        await api.archiveAutoResponse(rule.id);
        showToast(t.archiveSuccess);
      }
      setConfirmAction(null);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || "Operation failed", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--app-bg)] text-[var(--app-text-primary)]">
      {/* Toast Notification */}
      {toast && (
        <div
          data-testid="auto-response-toast"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all ${
            toast.type === "error"
              ? "bg-red-600 text-white"
              : "bg-[var(--app-accent)] text-white"
          }`}
        >
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="border-b border-[var(--app-border)] bg-[var(--app-surface)] px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--app-text-primary)]">
              {t.title}
            </h1>
            <p className="mt-1 text-sm text-[var(--app-text-secondary)]">{t.subtitle}</p>
          </div>
          {isAdmin && (
            <button
              type="button"
              data-testid="create-auto-response-btn"
              onClick={startCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--app-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-95"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              {t.createRuleButton}
            </button>
          )}
        </div>

        {/* Warning Banner: Avoid native auto-response collision */}
        <div
          data-testid="duplicate-reply-warning-banner"
          className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-600 dark:text-amber-400"
        >
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="leading-relaxed">
            <span className="font-semibold">{t.duplicateWarning}</span>
          </div>
        </div>
      </div>

      {/* Main Content: Left List & Right Editor / Preview */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Pane: Rule List */}
        <div className="w-full border-r border-[var(--app-border)] bg-[var(--app-surface)] lg:w-96 flex flex-col shrink-0 overflow-hidden">
          {/* Search & Filter */}
          <div className="border-b border-[var(--app-border)] p-4 space-y-3">
            <div className="relative">
              <input
                type="text"
                data-testid="search-rules-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3.5 py-2 pl-9 text-xs placeholder:text-[var(--app-text-tertiary)] focus:border-[var(--app-accent)] focus:outline-none"
              />
              <svg className="absolute left-3 top-2.5 h-4 w-4 text-[var(--app-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1 text-xs">
              {(["ALL", "ACTIVE", "DRAFT", "INACTIVE", "ARCHIVED"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  data-testid={`filter-tab-${st.toLowerCase()}`}
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-lg px-2.5 py-1 font-medium transition ${
                    statusFilter === st
                      ? "bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                      : "text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]"
                  }`}
                >
                  {st === "ALL" && t.filterAll}
                  {st === "ACTIVE" && t.filterActive}
                  {st === "DRAFT" && t.filterDraft}
                  {st === "INACTIVE" && t.filterInactive}
                  {st === "ARCHIVED" && t.filterArchived}
                </button>
              ))}
            </div>
          </div>

          {/* List Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--app-border)]">
            {loading ? (
              <div className="p-8 text-center text-xs text-[var(--app-text-tertiary)]">Loading...</div>
            ) : filteredRules.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-semibold text-[var(--app-text-secondary)]">{t.emptyList}</p>
                <p className="mt-1 text-xs text-[var(--app-text-tertiary)]">{t.emptyListDesc}</p>
              </div>
            ) : (
              filteredRules.map((rule) => {
                const isSel = rule.id === selectedRuleId && !isCreating;
                return (
                  <div
                    key={rule.id}
                    data-testid={`rule-item-${rule.id}`}
                    onClick={() => {
                      setSelectedRuleId(rule.id);
                      setIsEditing(false);
                      setIsCreating(false);
                      setFormName(rule.name);
                      setFormDesc(rule.description || "");
                      setFormTemplate(rule.textTemplate);
                    }}
                    className={`cursor-pointer p-4 transition ${
                      isSel
                        ? "bg-[var(--app-accent-soft)]/40 border-l-4 border-[var(--app-accent)]"
                        : "hover:bg-[var(--app-surface-hover)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[var(--app-text-primary)] truncate">
                        {rule.name}
                      </h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            rule.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : rule.status === "DRAFT"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : rule.status === "INACTIVE"
                              ? "bg-gray-500/10 text-gray-500"
                              : "bg-red-500/10 text-red-500"
                          }`}
                        >
                          {rule.status === "ACTIVE" && t.statusActive}
                          {rule.status === "DRAFT" && t.statusDraft}
                          {rule.status === "INACTIVE" && t.statusInactive}
                          {rule.status === "ARCHIVED" && t.statusArchived}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--app-text-tertiary)]">
                          {t.versionLabel(rule.version)}
                        </span>
                      </div>
                    </div>

                    <p className="mt-1 line-clamp-2 text-xs text-[var(--app-text-secondary)]">
                      {rule.textTemplate}
                    </p>

                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-[var(--app-text-tertiary)]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUsageModalRule(rule);
                        }}
                        className="hover:text-[var(--app-accent)] hover:underline"
                      >
                        {t.usageLabel(rule.usageCount)}
                      </button>
                      <span>{new Date(rule.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Editor / Preview */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isCreating || isEditing ? (
            /* ============================================================ */
            /* Rule Form Editor */
            /* ============================================================ */
            <div className="max-w-3xl space-y-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-4">
                <h2 className="text-lg font-bold text-[var(--app-text-primary)]">
                  {isCreating ? t.editorCreateTitle : t.editorEditTitle}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-xl border border-[var(--app-border)] px-3.5 py-1.5 text-xs font-semibold text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]"
                  >
                    {t.cancelButton}
                  </button>
                  <button
                    type="button"
                    data-testid="save-draft-btn"
                    disabled={saving}
                    onClick={() => handleSave(false)}
                    className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3.5 py-1.5 text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
                  >
                    {t.saveDraftButton}
                  </button>
                  <button
                    type="button"
                    data-testid="save-activate-btn"
                    disabled={saving}
                    onClick={() => handleSave(true)}
                    className="rounded-xl bg-[var(--app-accent)] px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                  >
                    {t.activateButton}
                  </button>
                </div>
              </div>

              {/* Active Editing Warning */}
              {isEditing && selectedRule?.status === "ACTIVE" && (
                <div className="flex items-center gap-2.5 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-600 dark:text-blue-400">
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>{t.activeEditWarning}</span>
                </div>
              )}

              {/* Form Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--app-text-secondary)] uppercase tracking-wider">
                    {t.fieldName} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    data-testid="rule-name-input"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={t.fieldNamePlaceholder}
                    className="mt-1.5 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-2.5 text-sm text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--app-text-secondary)] uppercase tracking-wider">
                    {t.fieldDescription}
                  </label>
                  <input
                    type="text"
                    data-testid="rule-desc-input"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder={t.fieldDescriptionPlaceholder}
                    className="mt-1.5 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-2.5 text-sm text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[var(--app-text-secondary)] uppercase tracking-wider">
                      {t.fieldTextTemplate} <span className="text-red-500">*</span>
                    </label>

                    {/* Store Variable Inserter */}
                    <div className="relative">
                      <button
                        type="button"
                        data-testid="insert-var-dropdown-btn"
                        onClick={() => setShowVarDropdown(!showVarDropdown)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-2.5 py-1 text-xs font-medium text-[var(--app-accent)] hover:bg-[var(--app-surface-hover)]"
                      >
                        <span>{t.insertStoreVariable}</span>
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {showVarDropdown && (
                        <div className="absolute right-0 top-full mt-1.5 z-20 w-64 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5 shadow-xl">
                          <button
                            type="button"
                            onClick={() => insertVariable("{{store.storeName}}")}
                            className="w-full text-left rounded-lg px-3 py-2 text-xs font-medium hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent)]"
                          >
                            {t.varStoreName}
                          </button>
                          <button
                            type="button"
                            onClick={() => insertVariable("{{store.googleMapsUrl}}")}
                            className="w-full text-left rounded-lg px-3 py-2 text-xs font-medium hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent)]"
                          >
                            {t.varGoogleMapsUrl}
                          </button>
                          <button
                            type="button"
                            onClick={() => insertVariable("{{store.lineOaLink}}")}
                            className="w-full text-left rounded-lg px-3 py-2 text-xs font-medium hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent)]"
                          >
                            {t.varLineOaLink}
                          </button>
                          <button
                            type="button"
                            onClick={() => insertVariable("{{store.tiktokProfileUrl}}")}
                            className="w-full text-left rounded-lg px-3 py-2 text-xs font-medium hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent)]"
                          >
                            {t.varTiktokUrl}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <textarea
                    ref={textareaRef}
                    data-testid="rule-template-textarea"
                    rows={6}
                    value={formTemplate}
                    onChange={(e) => setFormTemplate(e.target.value)}
                    placeholder={t.fieldTextTemplatePlaceholder}
                    className="mt-1.5 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] p-3 text-sm text-[var(--app-text-primary)] font-mono focus:border-[var(--app-accent)] focus:outline-none"
                  />
                  <p className="mt-1.5 text-[11px] text-[var(--app-text-tertiary)]">
                    {t.fieldTextTemplatePlaceholder}
                  </p>
                </div>
              </div>
            </div>
          ) : selectedRule ? (
            /* ============================================================ */
            /* Rule View & Actions */
            /* ============================================================ */
            <div className="max-w-3xl space-y-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--app-border)] pb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold text-[var(--app-text-primary)]">
                      {selectedRule.name}
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        selectedRule.status === "ACTIVE"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : selectedRule.status === "DRAFT"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : selectedRule.status === "INACTIVE"
                          ? "bg-gray-500/10 text-gray-500"
                          : "bg-red-500/10 text-red-500"
                      }`}
                    >
                      {selectedRule.status === "ACTIVE" && t.statusActive}
                      {selectedRule.status === "DRAFT" && t.statusDraft}
                      {selectedRule.status === "INACTIVE" && t.statusInactive}
                      {selectedRule.status === "ARCHIVED" && t.statusArchived}
                    </span>
                    <span className="font-mono text-xs text-[var(--app-text-tertiary)]">
                      {t.versionLabel(selectedRule.version)}
                    </span>
                  </div>
                  {selectedRule.description && (
                    <p className="mt-1 text-sm text-[var(--app-text-secondary)]">
                      {selectedRule.description}
                    </p>
                  )}
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="edit-rule-btn"
                      onClick={() => startEdit(selectedRule)}
                      className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3.5 py-1.5 text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
                    >
                      {t.editButton}
                    </button>

                    {selectedRule.status !== "ACTIVE" && selectedRule.status !== "ARCHIVED" && (
                      <button
                        type="button"
                        data-testid="activate-rule-btn"
                        onClick={() => setConfirmAction({ type: "activate", rule: selectedRule })}
                        className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                      >
                        {t.activateButton}
                      </button>
                    )}

                    {selectedRule.status === "ACTIVE" && (
                      <button
                        type="button"
                        data-testid="deactivate-rule-btn"
                        onClick={() => setConfirmAction({ type: "deactivate", rule: selectedRule })}
                        className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-600 hover:bg-amber-500/20"
                      >
                        {t.deactivateButton}
                      </button>
                    )}

                    {selectedRule.status !== "ARCHIVED" && (
                      <button
                        type="button"
                        data-testid="archive-rule-btn"
                        onClick={() => setConfirmAction({ type: "archive", rule: selectedRule })}
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/20"
                      >
                        {t.archiveButton}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Raw Template View */}
              <div>
                <label className="block text-xs font-bold text-[var(--app-text-secondary)] uppercase tracking-wider">
                  {t.fieldTextTemplate}
                </label>
                <div className="mt-2 whitespace-pre-wrap rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] p-4 font-mono text-sm leading-relaxed text-[var(--app-text-primary)]">
                  {selectedRule.textTemplate}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-[var(--app-border)] p-8 text-center text-sm text-[var(--app-text-secondary)]">
              {t.emptyListDesc}
            </div>
          )}

          {/* ============================================================ */}
          {/* Live Store Preview & Variable Readiness Panel */}
          {/* ============================================================ */}
          {(selectedRule || isCreating || isEditing) && (
            <div className="max-w-3xl space-y-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--app-border)] pb-4">
                <div>
                  <h3 className="text-sm font-bold text-[var(--app-text-primary)]">
                    {t.previewTitle}
                  </h3>
                  <p className="text-xs text-[var(--app-text-secondary)]">
                    {t.previewResolvedTitle}
                  </p>
                </div>

                {/* Store Selector */}
                <div className="flex items-center gap-2">
                  <label htmlFor="preview-store-select" className="text-xs text-[var(--app-text-secondary)] font-medium">
                    {t.previewStoreSelect}:
                  </label>
                  <select
                    id="preview-store-select"
                    data-testid="preview-store-select"
                    value={previewStoreId}
                    onChange={(e) => setPreviewStoreId(e.target.value)}
                    className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-1.5 text-xs text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code || s.storeId || "-"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Readiness Indicator */}
              {previewData && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        previewData.ready ? "bg-emerald-500" : "bg-red-500"
                      }`}
                    />
                    <span
                      className={`text-xs font-bold ${
                        previewData.ready ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
                      }`}
                    >
                      {previewData.ready ? t.previewReady : t.previewBlocked}
                    </span>
                  </div>
                  {previewData.reason && (
                    <span className="text-xs text-red-500 font-medium">{previewData.reason}</span>
                  )}
                </div>
              )}

              {/* LINE Bubble Preview */}
              <div className="flex justify-start">
                <div className="relative max-w-sm rounded-2xl rounded-tl-sm bg-[#74c365] dark:bg-[#488e3c] px-4 py-3 text-sm text-white shadow-md">
                  {loadingPreview ? (
                    <p className="italic opacity-80 text-xs">Loading preview...</p>
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {previewData?.resolvedText || formTemplate || "..."}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* Confirmation Modal */}
      {/* ============================================================ */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-[var(--app-text-primary)]">
              {confirmAction.type === "deactivate" && t.deactivateConfirmTitle}
              {confirmAction.type === "archive" && t.archiveConfirmTitle}
              {confirmAction.type === "activate" && t.activateButton}
            </h3>
            <p className="text-sm text-[var(--app-text-secondary)] leading-relaxed">
              {confirmAction.type === "deactivate" &&
                t.deactivateConfirmDesc(confirmAction.rule.name, confirmAction.rule.usageCount)}
              {confirmAction.type === "archive" &&
                t.archiveConfirmDesc(confirmAction.rule.name, confirmAction.rule.usageCount)}
              {confirmAction.type === "activate" &&
                `คุณต้องการเปิดใช้งานข้อความตอบกลับ "${confirmAction.rule.name}" ใช่หรือไม่?`}
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-xs font-semibold text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]"
              >
                {t.cancelButton}
              </button>
              <button
                type="button"
                data-testid="modal-confirm-btn"
                disabled={saving}
                onClick={handleConfirmAction}
                className={`rounded-xl px-4 py-2 text-xs font-semibold text-white ${
                  confirmAction.type === "archive"
                    ? "bg-red-600 hover:bg-red-700"
                    : confirmAction.type === "deactivate"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {t.confirmAction}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Linked Rich Menus Usage Modal */}
      {/* ============================================================ */}
      {usageModalRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
              <h3 className="text-base font-bold text-[var(--app-text-primary)]">
                {t.linkedRichMenusTitle} ({usageModalRule.name})
              </h3>
              <button
                type="button"
                onClick={() => setUsageModalRule(null)}
                className="rounded-lg p-1 text-[var(--app-text-tertiary)] hover:bg-[var(--app-surface-hover)]"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-[var(--app-border)]">
              {usageModalRule.linkedRichMenus && usageModalRule.linkedRichMenus.length > 0 ? (
                usageModalRule.linkedRichMenus.map((m) => (
                  <div key={m.templateId} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-[var(--app-text-primary)]">{m.templateName}</p>
                      <p className="text-[var(--app-text-tertiary)]">{m.areaCount} area(s)</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        m.templateStatus === "ACTIVE"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-gray-500/10 text-gray-500"
                      }`}
                    >
                      {m.templateStatus}
                    </span>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-xs text-[var(--app-text-tertiary)]">
                  {t.noLinkedMenus}
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setUsageModalRule(null)}
                className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-xs font-semibold text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
