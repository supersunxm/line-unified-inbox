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

  const hasImage = Boolean(block.mediaObjectKey && (block.imageUrl || block.previewUrl));

  return (
    <div className="rounded-lg border border-[var(--app-border)] bg-white overflow-hidden shadow-xs">
      {/* Top Toolbar matching LINE OA Manager */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#f4f5f7] border-b border-[var(--app-border)] text-xs text-[var(--app-text-secondary)]">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-white text-[var(--app-text-primary)] border border-gray-200 shadow-2xs font-semibold">
            🖼️
          </span>
          <span className="text-[var(--app-text-primary)] font-medium">
            {t.imageBlockTitle(index + 1)}
          </span>
        </div>

        {/* Right Reorder & Delete Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={disabled || index === 0}
            title={t.moveUpButton}
            aria-label={t.moveUpButton}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed text-xs transition"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={disabled || index === totalBlocks - 1}
            title={t.moveDownButton}
            aria-label={t.moveDownButton}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed text-xs transition"
          >
            ▼
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled || totalBlocks <= 1}
            title={t.deleteBlockButton}
            aria-label={t.deleteBlockButton}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-gray-500 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed text-xs transition font-bold"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="p-4 bg-white">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={handleFileSelected}
          disabled={disabled || uploading}
        />

        {hasImage ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="relative w-28 h-28 shrink-0 rounded bg-gray-200 overflow-hidden border border-gray-300">
              <img
                src={block.imageUrl || block.previewUrl || ""}
                alt="Greeting block"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[var(--app-text-primary)] truncate">
                {block.fileName || "greeting-image.jpg"}
              </p>
              {block.width && block.height && (
                <p className="text-xs text-[var(--app-text-tertiary)] mt-0.5 font-tabular">
                  {t.imageDimensions(
                    block.width,
                    block.height,
                    block.fileSize ? Math.round(block.fileSize / 1024) : 0,
                  )}
                </p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || uploading}
                  className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 shadow-2xs transition"
                >
                  {uploading ? t.uploading : t.changeImageButton}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...block,
                      mediaObjectKey: "",
                      previewObjectKey: undefined,
                      imageUrl: undefined,
                      previewUrl: undefined,
                      fileName: undefined,
                    })
                  }
                  disabled={disabled || uploading}
                  className="px-3 py-1.5 text-xs font-medium rounded border border-transparent text-red-600 hover:bg-red-50 transition"
                >
                  {t.deleteBlockButton}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => {
              if (!disabled && !uploading) fileInputRef.current?.click();
            }}
            className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 hover:border-[#06c755] rounded-lg bg-gray-50 hover:bg-white transition cursor-pointer text-center group"
          >
            <div className="w-12 h-12 rounded-full bg-gray-100 group-hover:bg-emerald-50 flex items-center justify-center text-gray-500 group-hover:text-[#06c755] transition mb-2">
              📷
            </div>
            <p className="text-xs font-medium text-gray-700 group-hover:text-[#06c755] transition">
              {uploading ? t.uploading : t.uploadImageButton}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {t.dropImageHint}
            </p>
          </div>
        )}

        {error && (
          <p className="mt-2 text-xs text-red-600 font-medium">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
