"use client";

import React, { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import type {
  AutoResponseRule,
  AutoResponseStatus,
  AutoResponsePreviewResult,
  AutoResponseMessageBlock,
  ApiStore,
} from "@/types/api";
import { autoResponseI18n } from "./auto-response-i18n";
import { AutoResponseMessageBuilder } from "./auto-response-message-builder";
import { AutoResponsePreviewStream } from "./auto-response-preview-stream";

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
  const [formMessages, setFormMessages] = useState<AutoResponseMessageBlock[]>([
    {
      id: "init-1",
      type: "TEXT",
      textTemplate: "",
    },
  ]);
  const [saving, setSaving] = useState(false);

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

      const resolvedBlocks: any[] = [];
      const usedVarsSet = new Set<string>();
      const unresVarsSet = new Set<string>();
      let allReady = true;
      let firstReason: string | null = null;

      for (const block of formMessages) {
        if (block.type === "TEXT") {
          const text = block.textTemplate || "";
          let resolved = text
            .replace(/\{\{\s*store\.storeName\s*\}\}/g, storeName)
            .replace(/\{\{\s*storeName\s*\}\}/g, storeName)
            .replace(/\{\{\s*store\.googleMapsUrl\s*\}\}/g, mapsUrl)
            .replace(/\{\{\s*googleMapsUrl\s*\}\}/g, mapsUrl)
            .replace(/\{\{\s*store\.lineOaLink\s*\}\}/g, lineOaLink)
            .replace(/\{\{\s*lineOaLink\s*\}\}/g, lineOaLink)
            .replace(/\{\{\s*store\.tiktokProfileUrl\s*\}\}/g, tiktokUrl)
            .replace(/\{\{\s*tiktokProfileUrl\s*\}\}/g, tiktokUrl);

          const unres = resolved.match(/\{\{([^}]+)\}\}/g) || [];
          unres.forEach((u) => unresVarsSet.add(u));
          const needsMaps = text.includes("store.googleMapsUrl") || text.includes("googleMapsUrl");
          const blockReady = !unres.length && (!needsMaps || Boolean(mapsUrl));
          let blockError: string | undefined;

          if (unres.length) {
            blockError = `Unresolved variables: ${unres.join(", ")}`;
            if (allReady) {
              allReady = false;
              firstReason = blockError;
            }
          } else if (needsMaps && !mapsUrl) {
            blockError = t.previewMissingMaps;
            if (allReady) {
              allReady = false;
              firstReason = blockError;
            }
          }

          resolvedBlocks.push({
            id: block.id,
            type: "TEXT",
            resolvedText: resolved,
            usedVariables: [],
            unresolvedVariables: unres,
            isValid: blockReady,
            validationError: blockError,
          });
        } else if (block.type === "IMAGE") {
          const hasImg = Boolean(block.mediaObjectKey || block.imageUrl);
          let blockError: string | undefined;
          if (!hasImg) {
            blockError = t.previewMissingImage;
            if (allReady) {
              allReady = false;
              firstReason = blockError;
            }
          }

          resolvedBlocks.push({
            id: block.id,
            type: "IMAGE",
            imageUrl: block.imageUrl || "",
            previewUrl: block.previewUrl || block.imageUrl || "",
            mediaObjectKey: block.mediaObjectKey,
            isValid: hasImg,
            validationError: blockError,
          });
        }
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
        usedVariables: Array.from(usedVarsSet),
        resolvedText: resolvedBlocks.find((b) => b.type === "TEXT")?.resolvedText || "",
        unresolvedVariables: Array.from(unresVarsSet),
        messages: resolvedBlocks,
        ready: allReady && formMessages.length > 0,
        reason: firstReason,
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
    formMessages,
    formName,
    previewStoreId,
    stores,
    t.previewMissingMaps,
    t.previewMissingImage,
  ]);

  // Filtered Rules
  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      if (statusFilter !== "ALL" && rule.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = rule.name.toLowerCase().includes(q);
        const matchText = rule.textTemplate?.toLowerCase().includes(q);
        const matchDesc = rule.description?.toLowerCase().includes(q);
        if (!matchName && !matchText && !matchDesc) return false;
      }
      return true;
    });
  }, [rules, statusFilter, searchQuery]);

  const startCreate = () => {
    setSelectedRuleId(null);
    setFormName("");
    setFormDesc("");
    setFormMessages([
      {
        id: crypto.randomUUID(),
        type: "TEXT",
        textTemplate: "",
      },
    ]);
    setIsCreating(true);
    setIsEditing(false);
  };

  const startEdit = (rule: AutoResponseRule) => {
    setSelectedRuleId(rule.id);
    setFormName(rule.name);
    setFormDesc(rule.description || "");

    const msgs = rule.messages && rule.messages.length > 0
      ? rule.messages
      : [
          {
            id: crypto.randomUUID(),
            type: "TEXT" as const,
            textTemplate: rule.textTemplate || "",
          },
        ];

    setFormMessages(msgs);
    setIsEditing(true);
    setIsCreating(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setIsCreating(false);
    if (selectedRule) {
      setFormName(selectedRule.name);
      setFormDesc(selectedRule.description || "");
      const msgs = selectedRule.messages && selectedRule.messages.length > 0
        ? selectedRule.messages
        : [
            {
              id: crypto.randomUUID(),
              type: "TEXT" as const,
              textTemplate: selectedRule.textTemplate || "",
            },
          ];
      setFormMessages(msgs);
    }
  };

  const handleSave = async (activateImmediately: boolean = false) => {
    if (!formName.trim()) {
      showToast(t.errorRequiredName, "error");
      return;
    }

    if (!formMessages.length || formMessages.length > 5) {
      showToast(t.errorInvalidBlocks, "error");
      return;
    }

    for (const msg of formMessages) {
      if (msg.type === "TEXT" && !msg.textTemplate?.trim()) {
        showToast(t.errorRequiredText, "error");
        return;
      }
      if (msg.type === "IMAGE" && !msg.mediaObjectKey) {
        showToast(t.previewMissingImage, "error");
        return;
      }
    }

    try {
      setSaving(true);
      if (isCreating) {
        const created = await api.createAutoResponse({
          name: formName.trim(),
          description: formDesc.trim() || undefined,
          messages: formMessages,
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
          messages: formMessages,
        });
        if (activateImmediately && updated.status !== "ACTIVE") {
          const activated = await api.activateAutoResponse(updated.id);
          showToast(t.activateSuccess);
        } else {
          showToast(t.updateSuccess);
        }
      }

      setIsEditing(false);
      setIsCreating(false);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const executeStatusAction = async () => {
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
        if (selectedRuleId === rule.id) {
          setSelectedRuleId(null);
        }
      }
      setConfirmAction(null);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || "Action failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: AutoResponseStatus) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {t.statusActive}
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-500">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {t.statusDraft}
          </span>
        );
      case "INACTIVE":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-500/10 px-2.5 py-0.5 text-xs font-semibold text-neutral-400">
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
            {t.statusInactive}
          </span>
        );
      case "ARCHIVED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            {t.statusArchived}
          </span>
        );
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[var(--app-bg)] px-4 py-6 md:px-8">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl transition-all ${
            toast.type === "error"
              ? "bg-red-600 text-white"
              : "bg-emerald-600 text-white"
          }`}
        >
          <span>{toast.type === "error" ? "✕" : "✓"}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--app-text-primary)]">
            {t.title}
          </h1>
          <p className="mt-1 text-sm text-[var(--app-text-secondary)]">
            {t.subtitle}
          </p>
        </div>

        {isAdmin && !isCreating && !isEditing && (
          <button
            onClick={startCreate}
            className="flex items-center gap-2 rounded-xl bg-[var(--app-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--app-accent-foreground)] shadow-sm hover:opacity-90 active:scale-98"
          >
            <span className="text-base font-bold leading-none">+</span>
            {t.createRuleButton}
          </button>
        )}
      </div>

      {/* Warning Notice Banner */}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-500">
        <svg className="mt-0.5 h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs leading-relaxed font-medium">
          {t.duplicateWarning}
        </p>
      </div>

      {/* Main Workspace Layout */}
      {isCreating || isEditing ? (
        /* Editor & Preview Split Mode */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Message Builder Form */}
          <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm lg:col-span-7">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--app-text-primary)]">
                {isCreating ? t.editorCreateTitle : t.editorEditTitle}
              </h2>
              {selectedRule && getStatusBadge(selectedRule.status)}
            </div>

            {/* Active Edit Warning Notice */}
            {selectedRule?.status === "ACTIVE" && (
              <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3.5 text-blue-500">
                <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs leading-relaxed font-medium">
                  {t.activeEditWarning}
                </p>
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-[var(--app-text-secondary)] uppercase tracking-wider">
                  {t.fieldName}
                </label>
                <input
                  type="text"
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
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder={t.fieldDescriptionPlaceholder}
                  className="mt-1.5 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-2.5 text-sm text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                />
              </div>

              {/* Message Builder */}
              <div className="pt-2">
                <AutoResponseMessageBuilder
                  messages={formMessages}
                  disabled={saving}
                  t={t}
                  onChange={setFormMessages}
                />
              </div>
            </div>

            {/* Editor Action Buttons */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-border)] pt-5">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="rounded-xl border border-[var(--app-border)] px-4 py-2.5 text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] disabled:opacity-50"
              >
                {t.cancelButton}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-2.5 text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] disabled:opacity-50"
                >
                  {saving ? t.saving : t.saveDraftButton}
                </button>

                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  className="rounded-xl bg-[var(--app-accent)] px-4 py-2.5 text-xs font-semibold text-[var(--app-accent-foreground)] shadow-sm hover:opacity-90 active:scale-98 disabled:opacity-50"
                >
                  {saving ? t.saving : t.activateButton}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Live Mobile Preview */}
          <div className="space-y-5 lg:col-span-5">
            <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[var(--app-text-primary)]">
                  {t.previewTitle}
                </h3>
                {previewData && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      previewData.ready
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-amber-500/10 text-amber-500"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        previewData.ready ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                    {previewData.ready ? t.previewReady : t.previewBlocked}
                  </span>
                )}
              </div>

              {/* Store Selector */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-[var(--app-text-secondary)] mb-1">
                  {t.previewStoreSelect}
                </label>
                <select
                  value={previewStoreId}
                  onChange={(e) => setPreviewStoreId(e.target.value)}
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-xs text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code || s.storeId || "-"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Simulated Chat Stream */}
              <AutoResponsePreviewStream
                previewData={previewData}
                loading={loadingPreview}
                t={t}
              />
            </div>
          </div>
        </div>
      ) : (
        /* List Mode */
        <div className="space-y-6">
          {/* Controls Bar: Search & Status Filters */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5">
              {(["ALL", "ACTIVE", "DRAFT", "INACTIVE", "ARCHIVED"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    statusFilter === st
                      ? "bg-[var(--app-accent)] text-[var(--app-accent-foreground)] shadow-sm"
                      : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"
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

            {/* Search Input */}
            <div className="relative min-w-[280px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-xs text-[var(--app-text-primary)] placeholder-[var(--app-text-secondary)] focus:border-[var(--app-accent)] focus:outline-none"
              />
            </div>
          </div>

          {/* Rules Grid */}
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--app-accent)] border-t-transparent" />
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-8 text-center">
              <p className="text-sm font-semibold text-[var(--app-text-primary)]">
                {t.emptyList}
              </p>
              <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
                {t.emptyListDesc}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredRules.map((rule) => {
                const messageCount = rule.messages?.length || 1;
                const hasImage = rule.messages?.some((m) => m.type === "IMAGE") || rule.contentType === "IMAGE";
                const hasText = rule.messages?.some((m) => m.type === "TEXT") || rule.contentType === "TEXT" || Boolean(rule.textTemplate);

                return (
                  <div
                    key={rule.id}
                    className="flex flex-col justify-between rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm transition-all hover:border-[var(--app-accent)]/50"
                  >
                    <div>
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-base font-bold text-[var(--app-text-primary)]">
                              {rule.name}
                            </h3>
                            <span className="text-xs text-[var(--app-text-secondary)] font-mono">
                              {t.versionLabel(rule.version)}
                            </span>
                          </div>
                          {rule.description && (
                            <p className="mt-0.5 line-clamp-1 text-xs text-[var(--app-text-secondary)]">
                              {rule.description}
                            </p>
                          )}
                        </div>
                        {getStatusBadge(rule.status)}
                      </div>

                      {/* Sequence Badge */}
                      <div className="mt-3 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--app-bg)] px-2 py-1 text-[11px] font-medium text-[var(--app-text-secondary)] border border-[var(--app-border)]">
                          {hasImage && "🖼 "}
                          {hasText && "💬 "}
                          {t.blocksCount(messageCount)}
                        </span>

                        {rule.usageCount > 0 && (
                          <button
                            onClick={() => setUsageModalRule(rule)}
                            className="inline-flex items-center gap-1 rounded-lg bg-[var(--app-bg)] px-2 py-1 text-[11px] font-medium text-[var(--app-accent)] border border-[var(--app-border)] hover:bg-[var(--app-surface-hover)]"
                          >
                            <span>{t.usageLabel(rule.usageCount)}</span>
                          </button>
                        )}
                      </div>

                      {/* Preview Snippet */}
                      <div className="mt-3 rounded-2xl bg-[var(--app-bg)] p-3 border border-[var(--app-border)]/50">
                        <p className="line-clamp-2 text-xs text-[var(--app-text-primary)] leading-relaxed whitespace-pre-wrap font-sans">
                          {rule.textTemplate || rule.messages?.find((m) => m.type === "TEXT")?.textTemplate || (hasImage ? `[${t.typeImage}]` : "-")}
                        </p>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="mt-5 flex items-center justify-between border-t border-[var(--app-border)] pt-4">
                      <div className="flex items-center gap-2">
                        {isAdmin && rule.status !== "ARCHIVED" && (
                          <button
                            onClick={() => startEdit(rule)}
                            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
                          >
                            {t.editButton}
                          </button>
                        )}
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-1.5">
                          {rule.status === "DRAFT" || rule.status === "INACTIVE" ? (
                            <button
                              onClick={() => setConfirmAction({ type: "activate", rule })}
                              className="rounded-xl bg-emerald-600/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-600/20"
                            >
                              {t.activateButton}
                            </button>
                          ) : rule.status === "ACTIVE" ? (
                            <button
                              onClick={() => setConfirmAction({ type: "deactivate", rule })}
                              className="rounded-xl bg-amber-600/10 px-3 py-1.5 text-xs font-semibold text-amber-600 hover:bg-amber-600/20"
                            >
                              {t.deactivateButton}
                            </button>
                          ) : null}

                          {rule.status !== "ARCHIVED" && (
                            <button
                              onClick={() => setConfirmAction({ type: "archive", rule })}
                              className="rounded-xl border border-[var(--app-border)] px-2.5 py-1.5 text-xs font-semibold text-neutral-400 hover:bg-neutral-500/10 hover:text-red-500"
                            >
                              {t.archiveButton}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[var(--app-text-primary)]">
              {confirmAction.type === "deactivate" && t.deactivateConfirmTitle}
              {confirmAction.type === "archive" && t.archiveConfirmTitle}
              {confirmAction.type === "activate" && t.activateButton}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--app-text-secondary)]">
              {confirmAction.type === "deactivate" &&
                t.deactivateConfirmDesc(confirmAction.rule.name, confirmAction.rule.usageCount)}
              {confirmAction.type === "archive" &&
                t.archiveConfirmDesc(confirmAction.rule.name, confirmAction.rule.usageCount)}
              {confirmAction.type === "activate" &&
                `ต้องการเปิดใช้งาน "${confirmAction.rule.name}" ใช่หรือไม่?`}
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
              >
                {t.cancelButton}
              </button>
              <button
                onClick={executeStatusAction}
                className="rounded-xl bg-[var(--app-accent)] px-4 py-2 text-xs font-semibold text-[var(--app-accent-foreground)] hover:opacity-90"
              >
                {t.confirmAction}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Linked Rich Menus Modal */}
      {usageModalRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--app-text-primary)]">
                {t.linkedRichMenusTitle} ({usageModalRule.name})
              </h3>
              <button
                onClick={() => setUsageModalRule(null)}
                className="rounded-lg p-1 text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 max-h-72 space-y-2.5 overflow-y-auto pr-1">
              {usageModalRule.linkedRichMenus && usageModalRule.linkedRichMenus.length > 0 ? (
                usageModalRule.linkedRichMenus.map((m) => (
                  <div
                    key={m.templateId}
                    className="flex items-center justify-between rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] p-3"
                  >
                    <div>
                      <p className="text-xs font-bold text-[var(--app-text-primary)]">
                        {m.templateName}
                      </p>
                      <p className="text-[10px] text-[var(--app-text-secondary)]">
                        ID: {m.templateId}
                      </p>
                    </div>
                    <span className="rounded-lg bg-[var(--app-surface)] px-2 py-1 text-[10px] font-semibold text-[var(--app-text-secondary)] border border-[var(--app-border)]">
                      {m.areaCount} {m.areaCount === 1 ? "button" : "buttons"}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-xs text-[var(--app-text-secondary)] py-6">
                  {t.noLinkedMenus}
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setUsageModalRule(null)}
                className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
              >
                {t.cancelButton}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
