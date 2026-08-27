"use client";

import React, { useRef, useState } from "react";
import { api } from "@/lib/api";
import type { AutoResponseImageBlock as AutoResponseImageBlockType } from "@/types/api";
import type { AutoResponseDict } from "./auto-response-i18n";

type AutoResponseImageBlockProps = {
  block: AutoResponseImageBlockType;
  index: number;
  totalBlocks: number;
  disabled?: boolean;
  t: AutoResponseDict;
  onChange: (updated: AutoResponseImageBlockType) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

export function AutoResponseImageBlock({
  block,
  index,
  totalBlocks,
  disabled = false,
  t,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: AutoResponseImageBlockProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so same file can be re-selected if needed
    e.target.value = "";

    // Client-side quick check
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
      const res = await api.uploadAutoResponseMedia(file);
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
    } catch (err: any) {
      setError(err?.message || t.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const hasImage = Boolean(block.mediaObjectKey || block.imageUrl);

  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm transition-all hover:border-[var(--app-accent)]/50">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleFileSelected}
        disabled={disabled || uploading}
      />

      {/* Block Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--app-accent)]/10 text-xs font-bold text-[var(--app-accent)]">
            {index + 1}
          </span>
          <span className="text-xs font-bold text-[var(--app-text-secondary)] uppercase tracking-wider">
            {t.typeImage}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={disabled || index === 0}
            title={t.moveUpButton}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] text-xs text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={disabled || index === totalBlocks - 1}
            title={t.moveDownButton}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] text-xs text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            title={t.deleteBlockButton}
            className="ml-1 flex h-7 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 px-2 text-xs font-semibold text-red-500 hover:bg-red-500/20 disabled:opacity-30"
          >
            {t.deleteBlockButton}
          </button>
        </div>
      </div>

      {/* Block Body */}
      {hasImage ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Thumbnail */}
          <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)]">
            {block.imageUrl || block.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={block.previewUrl || block.imageUrl}
                alt={block.fileName || "Auto-response image"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-[var(--app-text-secondary)]">
                {t.typeImage}
              </div>
            )}
          </div>

          {/* Details & Actions */}
          <div className="flex flex-1 flex-col justify-between py-1">
            <div>
              <p className="truncate text-xs font-medium text-[var(--app-text-primary)]">
                {block.fileName || "image.jpg"}
              </p>
              {block.width && block.height && (
                <p className="mt-1 text-[11px] text-[var(--app-text-secondary)]">
                  {t.imageDimensions(
                    block.width,
                    block.height,
                    Math.round((block.fileSize || 0) / 1024),
                  )}
                </p>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || uploading}
                className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] disabled:opacity-50"
              >
                {uploading ? t.uploading : t.changeImageButton}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
            uploading
              ? "border-[var(--app-accent)] bg-[var(--app-accent)]/5"
              : "border-[var(--app-border)] bg-[var(--app-bg)] hover:border-[var(--app-accent)] hover:bg-[var(--app-surface-hover)]"
          }`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--app-accent)]/10 text-[var(--app-accent)]">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="mt-2 text-xs font-semibold text-[var(--app-text-primary)]">
            {uploading ? t.uploading : t.uploadImageButton}
          </p>
          <p className="mt-1 text-[11px] text-[var(--app-text-secondary)]">
            {t.dropImageHint}
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="mt-2 text-xs font-medium text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
