"use client";

import React, { useRef, useState } from "react";
import { api } from "@/lib/api";
import type { GreetingImageBlock as GreetingImageBlockType } from "@/types/api";
import type { GreetingDict } from "./greeting-i18n";

type GreetingImageBlockProps = {
  block: GreetingImageBlockType;
  index: number;
  totalBlocks: number;
  disabled?: boolean;
  t: GreetingDict;
  onChange: (updated: GreetingImageBlockType) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

export function GreetingImageBlock({
  block,
  index,
  totalBlocks,
  disabled = false,
  t,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: GreetingImageBlockProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";

    if (file.size > 10 * 1024 * 1024) {
      setError(t.invalidImage);
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "jpg" && ext !== "jpeg" && ext !== "png") {
      setError(t.invalidImage);
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const res = await api.uploadGreetingMedia(file);
      onChange({
        ...block,
        mediaObjectKey: res.mediaObjectKey,
        previewObjectKey: res.previewObjectKey,
        imageUrl: res.imageUrl,
        previewUrl: res.previewUrl,
        fileName: file.name,
        fileSize: res.fileSize,
        width: res.width,
        height: res.height,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.uploadFailed;
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled || uploading) return;

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError(t.invalidImage);
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "jpg" && ext !== "jpeg" && ext !== "png") {
      setError(t.invalidImage);
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const res = await api.uploadGreetingMedia(file);
      onChange({
        ...block,
        mediaObjectKey: res.mediaObjectKey,
        previewObjectKey: res.previewObjectKey,
        imageUrl: res.imageUrl,
        previewUrl: res.previewUrl,
        fileName: file.name,
        fileSize: res.fileSize,
        width: res.width,
        height: res.height,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.uploadFailed;
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const hasImage = Boolean(block.mediaObjectKey && (block.imageUrl || block.previewUrl));

  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-4 shadow-sm transition-colors">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            {index + 1}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-tertiary)]">
            {t.imageBlockTitle(index + 1)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={disabled || index === 0}
            onClick={onMoveUp}
            title={t.moveUpButton}
            aria-label={t.moveUpButton}
            className="rounded p-1 text-[var(--app-text-tertiary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)] disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={disabled || index === totalBlocks - 1}
            onClick={onMoveDown}
            title={t.moveDownButton}
            aria-label={t.moveDownButton}
            className="rounded p-1 text-[var(--app-text-tertiary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)] disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            disabled={disabled || totalBlocks <= 1}
            onClick={onDelete}
            title={t.deleteBlockButton}
            aria-label={t.deleteBlockButton}
            className="rounded p-1 text-[var(--app-danger)] hover:bg-[var(--app-danger-soft)] disabled:opacity-30"
          >
            ✕
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleFileSelected}
        disabled={disabled || uploading}
      />

      {hasImage ? (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)]">
            <img
              src={block.imageUrl || block.previewUrl}
              alt={block.fileName || "Greeting Image"}
              className="max-h-56 w-full object-contain"
            />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-semibold text-white backdrop-blur-xs">
                {t.uploading}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-[var(--app-text-tertiary)]">
            <span>
              {block.width && block.height && block.fileSize
                ? t.imageDimensions(block.width, block.height, Math.round(block.fileSize / 1024))
                : block.fileName || "Uploaded Image"}
            </span>
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => fileInputRef.current?.click()}
              className="font-medium text-emerald-600 hover:underline disabled:opacity-50 dark:text-emerald-400"
            >
              {t.changeImageButton}
            </button>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => {
            if (!disabled && !uploading) fileInputRef.current?.click();
          }}
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--app-border)] p-6 text-center transition-colors ${
            disabled || uploading
              ? "cursor-not-allowed opacity-60"
              : "cursor-pointer hover:border-emerald-500/50 hover:bg-[var(--app-surface-hover)]"
          }`}
        >
          {uploading ? (
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {t.uploading}
            </div>
          ) : (
            <>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mb-2 h-8 w-8 text-[var(--app-text-tertiary)]"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <div className="text-xs font-medium text-[var(--app-text-secondary)]">
                {t.uploadImageButton}
              </div>
              <div className="mt-1 text-[11px] text-[var(--app-text-tertiary)]">
                {t.dropImageHint}
              </div>
            </>
          )}
        </div>
      )}

      {error && <div className="mt-2 text-xs font-medium text-[var(--app-danger)]">{error}</div>}
    </div>
  );
}
