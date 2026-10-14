"use client";

import { useMemo, useState } from "react";
import {
  ALL_PRESETS,
  AREA_LABELS,
  CUSTOM_PRESET,
  LANDSCAPE_PRESETS,
  PORTRAIT_PRESETS,
  SQUARE_PRESETS,
  type RichMessageTemplatePreset,
  type TemplateCategory,
} from "./rich-message-templates";
import type { RichMessageTranslations } from "./rich-messages-i18n";

interface TemplateModalProps {
  isOpen: boolean;
  activeTemplateId: string | null;
  t: RichMessageTranslations;
  onSelect: (preset: RichMessageTemplatePreset) => void;
  onClose: () => void;
}

/**
 * Visual SVG wireframe preview for a template preset tile.
 */
function TemplateWireframe({
  preset,
  isSelected,
}: {
  preset: RichMessageTemplatePreset;
  isSelected: boolean;
}) {
  const viewBoxWidth = preset.width;
  const viewBoxHeight = preset.height;

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      className="h-full w-full rounded border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
      preserveAspectRatio="none"
    >
      {preset.areas.map((area, index) => {
        const label = AREA_LABELS[index] || String(index + 1);
        const centerX = area.x + area.width / 2;
        const centerY = area.y + area.height / 2;
        const fontSize = Math.min(180, Math.max(60, Math.floor(Math.min(area.width, area.height) * 0.35)));

        return (
          <g key={area.id}>
            <rect
              x={area.x + 2}
              y={area.y + 2}
              width={Math.max(1, area.width - 4)}
              height={Math.max(1, area.height - 4)}
              className={
                isSelected
                  ? "fill-[#06c755]/15 stroke-[#06c755] stroke-[4]"
                  : "fill-white stroke-gray-300 stroke-[3] dark:fill-gray-900 dark:stroke-gray-600"
              }
              rx={6}
            />
            <text
              x={centerX}
              y={centerY}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={fontSize}
              fontWeight="bold"
              className={isSelected ? "fill-[#087f3b] dark:fill-[#06c755]" : "fill-gray-400 dark:fill-gray-500"}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function RichMessageTemplateModal({
  isOpen,
  activeTemplateId,
  t,
  onSelect,
  onClose,
}: TemplateModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>("SQUARE");
  const [selectedPresetId, setSelectedPresetId] = useState<string>(activeTemplateId || "square-1");

  const categories: Array<{ id: TemplateCategory; label: string; count?: number }> = useMemo(
    () => [
      { id: "SQUARE", label: t.templateCategorySquare, count: SQUARE_PRESETS.length },
      { id: "LANDSCAPE", label: t.templateCategoryLandscape, count: LANDSCAPE_PRESETS.length },
      { id: "PORTRAIT", label: t.templateCategoryPortrait, count: PORTRAIT_PRESETS.length },
      { id: "CUSTOM", label: t.templateCategoryCustom },
    ],
    [t],
  );

  const presetsToDisplay = useMemo(() => {
    switch (selectedCategory) {
      case "SQUARE":
        return SQUARE_PRESETS;
      case "LANDSCAPE":
        return LANDSCAPE_PRESETS;
      case "PORTRAIT":
        return PORTRAIT_PRESETS;
      case "CUSTOM":
        return [CUSTOM_PRESET];
      default:
        return SQUARE_PRESETS;
    }
  }, [selectedCategory]);

  const currentPreset = useMemo(
    () => ALL_PRESETS.find((p) => p.id === selectedPresetId) || SQUARE_PRESETS[0],
    [selectedPresetId],
  );

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-white shadow-2xl dark:bg-[var(--app-surface)]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-6 py-4">
          <div>
            <h2 id="template-modal-title" className="text-lg font-semibold text-[var(--app-text-primary)]">
              {t.selectTemplateTitle}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--app-text-secondary)]">
              {t.selectTemplateDesc}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
            aria-label={t.cancel}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex border-b border-[var(--app-border)] px-6 pt-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition ${
                selectedCategory === cat.id
                  ? "border-[#06c755] text-[#06c755]"
                  : "border-transparent text-[var(--app-text-secondary)] hover:border-gray-300 hover:text-[var(--app-text-primary)]"
              }`}
            >
              <span>{cat.label}</span>
              {cat.count !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    selectedCategory === cat.id
                      ? "bg-[#06c755]/15 text-[#087f3b] dark:text-[#06c755]"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {cat.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Presets Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {presetsToDisplay.map((preset) => {
              const isSelected = selectedPresetId === preset.id;
              const name = t[preset.nameKey] || preset.id;

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedPresetId(preset.id)}
                  className={`group relative flex flex-col items-center rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? "border-[#06c755] bg-emerald-50/50 shadow-md ring-2 ring-[#06c755]/30 dark:bg-[#06c755]/10"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-850 dark:hover:bg-gray-800"
                  }`}
                >
                  {/* Aspect Ratio Box for Wireframe */}
                  <div
                    className="flex w-full items-center justify-center p-1"
                    style={{
                      aspectRatio: `${preset.width} / ${preset.height}`,
                      maxHeight: "130px",
                    }}
                  >
                    <TemplateWireframe preset={preset} isSelected={isSelected} />
                  </div>

                  {/* Template Meta */}
                  <div className="mt-3 w-full text-center">
                    <div className="truncate text-xs font-semibold text-[var(--app-text-primary)]" title={name}>
                      {name}
                    </div>
                    <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] text-[var(--app-text-secondary)]">
                      <span>{preset.width}×{preset.height}</span>
                      <span>•</span>
                      <span>
                        {preset.areas.length} {t.actionCountBadge}
                      </span>
                    </div>
                  </div>

                  {/* Selected Badge */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#06c755] text-white shadow-xs">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-border)] bg-gray-50/50 px-6 py-4 dark:bg-[var(--app-surface-subtle)]">
          <div className="text-xs text-[var(--app-text-secondary)]">
            <span className="font-medium text-[var(--app-text-primary)]">
              {t[currentPreset.nameKey] || currentPreset.id}
            </span>{" "}
            ({currentPreset.width} × {currentPreset.height} px, {currentPreset.areas.length} {t.actionCountBadge})
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--app-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--app-text-primary)] hover:bg-gray-50 dark:bg-[var(--app-surface)]"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={() => {
                onSelect(currentPreset);
                onClose();
              }}
              className="rounded-lg bg-[#06c755] px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[#05b34c] dark:bg-[var(--app-accent)]"
            >
              {t.applyTemplate}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
