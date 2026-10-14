"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { richMessageApi, type RichMessage, type RichMessageAction } from "./rich-message-api";
import { useAppLanguage } from "../language";
import { richMessagesText } from "./rich-messages-i18n";
import {
  ALL_PRESETS,
  AREA_LABELS,
  findMatchingPreset,
  generateActionsForPreset,
  hasConfiguredActions,
  validateActionUrl,
  validateRichMessageGeometry,
  type RichMessageTemplatePreset,
} from "./rich-message-templates";
import { RichMessageTemplateModal } from "./rich-message-template-modal";

type ActionPatch = Omit<Partial<RichMessageAction>, "area"> & {
  area?: Partial<RichMessageAction["area"]>;
};

const blankAction = (height = 1040): RichMessageAction => ({
  id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  type: "URI",
  label: "A",
  value: "https://",
  area: { x: 0, y: 0, width: 1040, height },
});

export function RichMessagesView() {
  const { language } = useAppLanguage();
  const t = richMessagesText[language];
  const [items, setItems] = useState<RichMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [originalActions, setOriginalActions] = useState<RichMessageAction[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [altText, setAltText] = useState("แตะเพื่อดูรายละเอียด");
  const [mediaObjectKey, setMediaObjectKey] = useState("");
  const [previewObjectKey, setPreviewObjectKey] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [baseHeight, setBaseHeight] = useState(1040);
  const [actions, setActions] = useState<RichMessageAction[]>([blankAction()]);
  const [activeActionIndex, setActiveActionIndex] = useState<number>(0);
  const [activeTemplateId, setActiveTemplateId] = useState<string>("square-1");
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<RichMessageTemplatePreset | null>(null);
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [showCoordinates, setShowCoordinates] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId],
  );

  const currentTemplate = useMemo(() => {
    return ALL_PRESETS.find((p) => p.id === activeTemplateId) || null;
  }, [activeTemplateId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await richMessageApi.list(true));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [t.loadFailed]);

  useEffect(() => {
    let active = true;
    richMessageApi.list(true).then(
      (data) => {
        if (!active) return;
        setItems(data);
        setLoading(false);
      },
      (reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : t.loadFailed);
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [t.loadFailed]);

  const reset = () => {
    setSelectedId(null);
    setOriginalActions([]);
    setName("");
    setDescription("");
    setAltText("แตะเพื่อดูรายละเอียด");
    setMediaObjectKey("");
    setPreviewObjectKey("");
    setPreviewUrl("");
    setBaseHeight(1040);
    setActions([blankAction()]);
    setActiveActionIndex(0);
    setActiveTemplateId("square-1");
    setShowCoordinates({});
    setError(null);
    setSuccess(null);
  };

  const select = (item: RichMessage) => {
    setSelectedId(item.id);
    setOriginalActions(item.actions ? JSON.parse(JSON.stringify(item.actions)) : []);
    setName(item.name);
    setDescription(item.description || "");
    setAltText(item.altText);
    setMediaObjectKey(item.mediaObjectKey);
    setPreviewObjectKey(item.previewObjectKey || "");
    setPreviewUrl(item.previewUrl || item.imageUrl);
    setBaseHeight(item.baseHeight);
    const loadedActions = item.actions.length ? item.actions : [blankAction(item.baseHeight)];
    setActions(loadedActions);
    setActiveActionIndex(0);

    const matched = findMatchingPreset(loadedActions, item.baseHeight);
    setActiveTemplateId(matched ? matched.id : "custom");
    setShowCoordinates({});
    setError(null);
    setSuccess(null);
  };

  const updateAction = (index: number, patch: ActionPatch) => {
    setActions((previous) => {
      const updated = previous.map((action, i) => i !== index ? action : {
        ...action,
        ...patch,
        area: { ...action.area, ...(patch.area || {}) },
      });
      // Check if coordinates still match current template
      const matched = findMatchingPreset(updated, baseHeight);
      setActiveTemplateId(matched ? matched.id : "custom");
      return updated;
    });
  };

  const applyTemplatePreset = (preset: RichMessageTemplatePreset) => {
    setActiveTemplateId(preset.id);
    if (preset.id !== "custom") {
      setBaseHeight(preset.height);
      setActions(generateActionsForPreset(preset, actions));
    }
    setActiveActionIndex(0);
    setError(null);
  };

  const handleTemplateSelection = (preset: RichMessageTemplatePreset) => {
    if (hasConfiguredActions(actions)) {
      setPendingTemplate(preset);
      setIsWarningOpen(true);
    } else {
      applyTemplatePreset(preset);
    }
  };

  const confirmTemplateChange = () => {
    if (pendingTemplate) {
      applyTemplatePreset(pendingTemplate);
      setPendingTemplate(null);
    }
    setIsWarningOpen(false);
  };

  const cancelTemplateChange = () => {
    setPendingTemplate(null);
    setIsWarningOpen(false);
  };

  const toggleCoordinates = (actionId: string) => {
    setShowCoordinates((prev) => ({
      ...prev,
      [actionId]: !prev[actionId],
    }));
  };

  const handleImage = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const result = await richMessageApi.uploadImage(file);
      setMediaObjectKey(result.mediaObjectKey);
      setPreviewObjectKey(result.previewObjectKey);
      setPreviewUrl(result.previewUrl || result.imageUrl);
      if (result.width && result.height) {
        // LINE Messaging API baseHeight constraint: between 1 and 2080 px
        const nextHeight = Math.min(2080, Math.max(1, Math.round((result.height / result.width) * 1040)));
        setBaseHeight(nextHeight);
        setActions((prevActions) => {
          const nextActions = prevActions.length === 1
            ? [{ ...prevActions[0], area: { x: 0, y: 0, width: 1040, height: nextHeight } }]
            : prevActions;
          const matched = findMatchingPreset(nextActions, nextHeight);
          setActiveTemplateId(matched ? matched.id : "custom");
          return nextActions;
        });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!name.trim() || !altText.trim() || !mediaObjectKey) {
      setError(t.requiredFields);
      return;
    }

    const geometryUnchanged = Boolean(
      selectedId &&
      originalActions.length === actions.length &&
      actions.every((act, idx) => {
        const orig = originalActions[idx];
        return (
          orig &&
          orig.area &&
          act.area &&
          act.area.x === orig.area.x &&
          act.area.y === orig.area.y &&
          act.area.width === orig.area.width &&
          act.area.height === orig.area.height
        );
      })
    );

    // Client-side geometry, overlap, and URL validation
    const geoValidation = validateRichMessageGeometry(actions, 1040, baseHeight, {
      allowLegacyOverlap: geometryUnchanged,
    });
    if (!geoValidation.valid) {
      const hasOverlap = geoValidation.errors.some((err) => err.includes("overlaps"));
      setError(hasOverlap ? t.areaOverlapError : geoValidation.errors[0]);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        altText: altText.trim(),
        mediaObjectKey,
        previewObjectKey: previewObjectKey || undefined,
        baseWidth: 1040,
        baseHeight,
        actions,
      };
      const saved = selectedId
        ? await richMessageApi.update(selectedId, payload)
        : await richMessageApi.create(payload);
      await load();
      select(saved);
      setSuccess(selectedId ? t.saved : t.created);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-full bg-[var(--app-bg)] p-6 text-[var(--app-text-primary)]">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--app-text-secondary)]">LINE OA</div>
            <h1 className="text-2xl font-semibold">{t.featureName}</h1>
            <p className="mt-1 text-sm text-[var(--app-text-secondary)]">{t.reuseHint}</p>
          </div>
          <div className="flex gap-2">
            <a href="/greeting-messages" className="rounded-lg border border-[var(--app-border)] bg-white px-4 py-2 text-sm">{t.backToGreeting}</a>
            <button type="button" onClick={reset} className="rounded-lg bg-[#06c755] px-4 py-2 text-sm font-semibold text-white dark:bg-[var(--app-accent)]">{t.createNew}</button>
          </div>
        </header>

        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-[var(--app-border)] bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="font-semibold">{t.library}</h2>
              <span className="text-xs text-gray-500">{items.length}</span>
            </div>
            {loading ? <div className="p-4 text-sm text-gray-500">{t.loading}</div> : (
              <div className="space-y-2">
                {items.map((item) => (
                  <button key={item.id} type="button" onClick={() => select(item)} className={`w-full rounded-lg border p-2 text-left ${selectedId === item.id ? "border-[#06c755] bg-emerald-50" : "border-gray-200 hover:bg-gray-50"}`}>
                    <div className="flex gap-3">
                      <img src={item.previewUrl || item.imageUrl} alt="" className="h-16 w-16 rounded-md border object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{item.name}</div>
                        <div className="mt-1 text-xs text-gray-500">{item.actions.length} {t.tapArea} · {item.baseWidth}×{item.baseHeight}</div>
                        <div className={`mt-1 text-xs font-medium ${item.isActive ? "text-emerald-600" : "text-gray-400"}`}>{item.isActive ? t.active : t.inactive}</div>
                      </div>
                    </div>
                  </button>
                ))}
                {!items.length && <div className="p-4 text-center text-sm text-gray-500">{t.empty}</div>}
              </div>
            )}
          </aside>

          <section className="rounded-xl border border-[var(--app-border)] bg-white p-5 shadow-sm">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-medium">{t.name}<input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-[#06c755]" /></label>
                  <label className="text-sm font-medium">{t.altText}<input value={altText} maxLength={400} onChange={(e) => setAltText(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-[#06c755]" /></label>
                </div>
                <label className="block text-sm font-medium">{t.description}<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-[#06c755]" /></label>

                <div>
                  <div className="mb-2 flex items-center justify-between"><span className="text-sm font-medium">{t.image}</span><span className="text-xs text-gray-500">{t.baseWidth}</span></div>
                  <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-600 hover:border-[#06c755]">
                    {uploading ? t.uploading : previewUrl ? t.changeImage : t.uploadImage}
                    <input type="file" accept="image/jpeg,image/png" className="hidden" disabled={uploading} onChange={(e) => void handleImage(e.target.files?.[0])} />
                  </label>
                </div>

                {/* Tap Area Section with Template Picker */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">{t.tapArea}</h3>
                      <p className="text-xs text-gray-500">{t.tapAreaHint}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsTemplateModalOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#06c755] bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-[#087f3b] hover:bg-emerald-100 dark:bg-[#06c755]/15 dark:text-[#06c755]"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                        <span>{t.selectTemplate}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActions((current) => [...current, blankAction(baseHeight)]);
                          setActiveActionIndex(actions.length);
                        }}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium"
                      >
                        {t.addArea}
                      </button>
                    </div>
                  </div>

                  {/* Template Meta Badge */}
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    <div>
                      <span className="text-gray-500">{t.currentTemplate}: </span>
                      <span className="font-semibold text-gray-800 dark:text-gray-100">
                        {currentTemplate ? t[currentTemplate.nameKey] : t.templateCustom}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      1040 × {baseHeight} px · {actions.length} {t.actionCountBadge}
                    </div>
                  </div>

                  {/* Actions Editor Cards */}
                  <div className="space-y-3">
                    {actions.map((action, index) => {
                      const isSelected = activeActionIndex === index;
                      const regionLabel = AREA_LABELS[index] || String(index + 1);
                      const isExpanded = showCoordinates[action.id] || false;
                      const urlCheck = action.type === "URI" ? validateActionUrl(action.value) : { valid: true };

                      return (
                        <div
                          key={action.id}
                          id={`action-card-${action.id}`}
                          onClick={() => setActiveActionIndex(index)}
                          className={`rounded-xl border p-3.5 transition ${
                            isSelected
                              ? "border-[#06c755] bg-emerald-50/20 shadow-xs ring-2 ring-[#06c755]/20"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        >
                          {/* Card Header */}
                          <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                                  isSelected
                                    ? "bg-[#06c755] text-white"
                                    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                }`}
                              >
                                {regionLabel}
                              </span>
                              <span className="text-sm font-semibold">
                                {t.area} {index + 1} ({regionLabel})
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCoordinates(action.id);
                                }}
                                className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                              >
                                {isExpanded ? t.hideAdvancedCoordinates : t.advancedCoordinates}
                              </button>
                              <button
                                type="button"
                                disabled={actions.length === 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActions((current) => current.filter((_, i) => i !== index));
                                  setActiveActionIndex((prev) => Math.max(0, prev > index ? prev - 1 : prev));
                                }}
                                className="text-xs text-red-600 disabled:opacity-30"
                              >
                                {t.delete}
                              </button>
                            </div>
                          </div>

                          {/* Action Type & Value Inputs */}
                          <div className="grid gap-2 md:grid-cols-[130px_minmax(0,1fr)]">
                            <select
                              value={action.type}
                              onChange={(e) => updateAction(index, { type: e.target.value as "URI" | "MESSAGE" })}
                              className="rounded-lg border border-gray-300 px-2 py-2 text-sm outline-none focus:border-[#06c755]"
                            >
                              <option value="URI">URI</option>
                              <option value="MESSAGE">MESSAGE</option>
                            </select>
                            <div>
                              <input
                                value={action.value}
                                onChange={(e) => updateAction(index, { value: e.target.value })}
                                placeholder={action.type === "URI" ? "https://..." : t.messagePlaceholder}
                                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                                  action.type === "URI" && !urlCheck.valid && action.value.trim() !== "https://"
                                    ? "border-red-300 bg-red-50/30 focus:border-red-500"
                                    : "border-gray-300 focus:border-[#06c755]"
                                }`}
                              />
                              {action.type === "URI" && !urlCheck.valid && action.value.trim() !== "https://" && (
                                <p className="mt-1 text-[11px] text-red-600">
                                  {urlCheck.error === "Unsafe javascript: scheme is not allowed" ? t.urlUnsafe : t.urlInvalid}
                                </p>
                              )}
                              {action.type === "MESSAGE" && (
                                <div className="mt-1 flex justify-end text-[11px] text-gray-400">
                                  <span>{action.value.length}/400</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Collapsible Advanced Coordinate Editor */}
                          {isExpanded && (
                            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-800/50">
                              <div className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                                {t.advancedCoordinates}
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                {(["x", "y", "width", "height"] as const).map((key) => (
                                  <label key={key} className="text-[11px] uppercase text-gray-500">
                                    {key}
                                    <input
                                      type="number"
                                      min={key === "width" || key === "height" ? 1 : 0}
                                      value={action.area[key]}
                                      onChange={(e) => updateAction(index, { area: { [key]: Number(e.target.value) } })}
                                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                                    />
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                  <button type="button" disabled={saving || uploading} onClick={() => void save()} className="rounded-lg bg-[#06c755] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-[var(--app-accent)]">{saving ? t.saving : selectedId ? t.saveChanges : t.create}</button>
                  {selected && <button type="button" onClick={async () => { await richMessageApi.setActive(selected.id, !selected.isActive); await load(); }} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm">{selected.isActive ? t.deactivate : t.activate}</button>}
                </div>
              </div>

              {/* Live Preview Sidebar */}
              <aside>
                <div className="sticky top-5 rounded-xl bg-[#eef1f4] p-4 dark:bg-[var(--app-surface-subtle)]">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t.preview}</span>
                    <span className="text-[11px] text-gray-500">{baseHeight > 1040 ? t.templateCategoryPortrait : baseHeight < 1040 ? t.templateCategoryLandscape : t.templateCategorySquare}</span>
                  </div>
                  <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-gray-900">
                    {previewUrl ? (
                      <div className="relative select-none" style={{ aspectRatio: `1040 / ${baseHeight}` }}>
                        <img src={previewUrl} alt={altText} className="block h-full w-full object-cover" />
                        {actions.map((action, index) => {
                          const isSelected = activeActionIndex === index;
                          const regionLabel = AREA_LABELS[index] || String(index + 1);

                          return (
                            <button
                              key={action.id}
                              type="button"
                              onClick={() => {
                                setActiveActionIndex(index);
                                const el = document.getElementById(`action-card-${action.id}`);
                                el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                              }}
                              className={`absolute cursor-pointer transition-all flex items-start justify-start p-1 ${
                                isSelected
                                  ? "border-2 border-[#06c755] bg-[#06c755]/25 shadow-md ring-2 ring-[#06c755]/50 z-10"
                                  : "border border-[#06c755]/70 bg-[#06c755]/10 hover:bg-[#06c755]/20 z-0"
                              }`}
                              style={{
                                left: `${(action.area.x / 10.4)}%`,
                                top: `${(action.area.y / baseHeight) * 100}%`,
                                width: `${(action.area.width / 10.4)}%`,
                                height: `${(action.area.height / baseHeight) * 100}%`,
                              }}
                              title={`${t.area} ${index + 1} (${regionLabel})`}
                            >
                              <span
                                className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-bold shadow-xs ${
                                  isSelected
                                    ? "bg-[#06c755] text-white"
                                    : "bg-white/95 text-[#087f3b] dark:bg-gray-800 dark:text-[#06c755]"
                                }`}
                              >
                                {regionLabel}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex aspect-square items-center justify-center p-4 text-center text-sm text-gray-400">
                        {t.uploadToPreview}
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-gray-500">{t.imageSizingHint}</p>
                </div>
              </aside>
            </div>
          </section>
        </div>
      </div>

      {/* Template Picker Modal */}
      <RichMessageTemplateModal
        isOpen={isTemplateModalOpen}
        activeTemplateId={activeTemplateId}
        t={t}
        onSelect={handleTemplateSelection}
        onClose={() => setIsTemplateModalOpen(false)}
      />

      {/* Confirmation Warning Dialog for Overwriting Actions */}
      {isWarningOpen && (
        <div role="alertdialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[var(--app-border)] bg-white p-6 shadow-2xl dark:bg-[var(--app-surface)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-[var(--app-text-primary)]">
                {t.templateNoticeTitle}
              </h3>
            </div>
            <p className="mt-3 text-sm text-[var(--app-text-secondary)]">
              {t.templateNoticeDesc}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelTemplateChange}
                className="rounded-lg border border-[var(--app-border)] bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:bg-[var(--app-surface)]"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={confirmTemplateChange}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                {t.confirmChangeTemplate}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
