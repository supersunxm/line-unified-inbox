"use client";

import React, { useRef, useState } from "react";
import type {
  GreetingImageBlock as GreetingImageBlockType,
  GreetingMessageBlock,
  GreetingTextBlock,
} from "@/types/api";
import type { GreetingDict } from "./greeting-i18n";
import { GreetingImageBlock } from "./greeting-image-block";

type GreetingMessageBuilderProps = {
  messages: GreetingMessageBlock[];
  disabled?: boolean;
  t: GreetingDict;
  onChange: (updated: GreetingMessageBlock[]) => void;
};

export function GreetingMessageBuilder({
  messages,
  disabled = false,
  t,
  onChange,
}: GreetingMessageBuilderProps) {
  const [activeTextIndex, setActiveTextIndex] = useState<number | null>(null);
  const textareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});

  const handleAddText = () => {
    if (messages.length >= 5 || disabled) return;
    const newBlock: GreetingTextBlock = {
      id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "TEXT",
      textTemplate: "",
    };
    onChange([...messages, newBlock]);
  };

  const handleAddImage = () => {
    if (messages.length >= 5 || disabled) return;
    const newBlock: GreetingImageBlockType = {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "IMAGE",
      mediaObjectKey: "",
    };
    onChange([...messages, newBlock]);
  };

  const handleUpdateBlock = (index: number, updated: GreetingMessageBlock) => {
    const next = [...messages];
    next[index] = updated;
    onChange(next);
  };

  const handleDeleteBlock = (index: number) => {
    if (messages.length <= 1 || disabled) return;
    const next = messages.filter((_, i) => i !== index);
    onChange(next);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0 || disabled) return;
    const next = [...messages];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    onChange(next);
  };

  const handleMoveDown = (index: number) => {
    if (index === messages.length - 1 || disabled) return;
    const next = [...messages];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    onChange(next);
  };

  const handleInsertVariable = (variableToken: string) => {
    if (disabled) return;
    let targetIdx = activeTextIndex;
    if (targetIdx === null || messages[targetIdx]?.type !== "TEXT") {
      const firstTextIdx = messages.findIndex((m) => m.type === "TEXT");
      if (firstTextIdx >= 0) targetIdx = firstTextIdx;
      else return;
    }

    const currentBlock = messages[targetIdx] as GreetingTextBlock;
    const textarea = textareaRefs.current[targetIdx];

    if (textarea) {
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const prev = currentBlock.textTemplate || "";
      const inserted = prev.slice(0, start) + variableToken + prev.slice(end);

      handleUpdateBlock(targetIdx, {
        ...currentBlock,
        textTemplate: inserted,
      });

      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(
            start + variableToken.length,
            start + variableToken.length,
          );
        }
      }, 50);
    } else {
      const prev = currentBlock.textTemplate || "";
      handleUpdateBlock(targetIdx, {
        ...currentBlock,
        textTemplate: prev ? `${prev} ${variableToken}` : variableToken,
      });
    }
  };

  const variablesList: Array<{ token: string; label: string }> = [
    { token: "{{user.displayName}}", label: t.varUserDisplayName },
    { token: "{{account.name}}", label: t.varAccountName },
    { token: "{{store.storeName}}", label: t.varStoreName },
    { token: "{{store.googleMapsUrl}}", label: t.varGoogleMapsUrl },
    { token: "{{store.externalStoreId}}", label: t.varExternalStoreId },
    { token: "{{store.province}}", label: t.varProvince },
    { token: "{{store.region}}", label: t.varRegion },
    { token: "{{store.lineId}}", label: t.varLineId },
    { token: "{{store.tiktokUsername}}", label: t.varTiktokUsername },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--app-text-primary)]">
            {t.messageSequenceTitle}
          </h3>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {t.blocksCount(messages.length)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled || messages.length >= 5}
            onClick={handleAddText}
            className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--app-text-primary)] shadow-sm hover:bg-[var(--app-surface-hover)] disabled:opacity-40"
          >
            {t.addTextBlockButton}
          </button>
          <button
            type="button"
            disabled={disabled || messages.length >= 5}
            onClick={handleAddImage}
            className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--app-text-primary)] shadow-sm hover:bg-[var(--app-surface-hover)] disabled:opacity-40"
          >
            {t.addImageBlockButton}
          </button>
        </div>
      </div>

      {/* Variable Chips Bar */}
      <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--app-text-tertiary)]">
          {t.insertVariable}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {variablesList.map((v) => (
            <button
              key={v.token}
              type="button"
              disabled={disabled}
              onClick={() => handleInsertVariable(v.token)}
              className="rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-xs font-medium text-[var(--app-text-secondary)] shadow-xs transition-colors hover:border-emerald-500/50 hover:bg-[var(--app-surface-hover)] hover:text-emerald-600 disabled:opacity-40 dark:hover:text-emerald-400"
            >
              <span className="font-mono text-emerald-600 dark:text-emerald-400">{v.token}</span>
              <span className="ml-1 text-[var(--app-text-tertiary)]">({v.label})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Message Blocks List */}
      <div className="space-y-3">
        {messages.map((block, idx) => {
          if (block.type === "IMAGE") {
            return (
              <GreetingImageBlock
                key={block.id || idx}
                block={block}
                index={idx}
                totalBlocks={messages.length}
                disabled={disabled}
                t={t}
                onChange={(upd) => handleUpdateBlock(idx, upd)}
                onDelete={() => handleDeleteBlock(idx)}
                onMoveUp={() => handleMoveUp(idx)}
                onMoveDown={() => handleMoveDown(idx)}
              />
            );
          }

          // TEXT Block
          const currentLength = (block.textTemplate || "").length;
          return (
            <div
              key={block.id || idx}
              className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-4 shadow-sm transition-colors"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-tertiary)]">
                    {t.textBlockTitle(idx + 1)}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={disabled || idx === 0}
                    onClick={() => handleMoveUp(idx)}
                    title={t.moveUpButton}
                    aria-label={t.moveUpButton}
                    className="rounded p-1 text-[var(--app-text-tertiary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)] disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={disabled || idx === messages.length - 1}
                    onClick={() => handleMoveDown(idx)}
                    title={t.moveDownButton}
                    aria-label={t.moveDownButton}
                    className="rounded p-1 text-[var(--app-text-tertiary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)] disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={disabled || messages.length <= 1}
                    onClick={() => handleDeleteBlock(idx)}
                    title={t.deleteBlockButton}
                    aria-label={t.deleteBlockButton}
                    className="rounded p-1 text-[var(--app-danger)] hover:bg-[var(--app-danger-soft)] disabled:opacity-30"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <textarea
                ref={(el) => {
                  textareaRefs.current[idx] = el;
                }}
                rows={4}
                disabled={disabled}
                value={block.textTemplate || ""}
                onFocus={() => setActiveTextIndex(idx)}
                onChange={(e) =>
                  handleUpdateBlock(idx, {
                    ...block,
                    textTemplate: e.target.value,
                  })
                }
                placeholder={t.textBlockPlaceholder}
                maxLength={5000}
                className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-3 text-xs text-[var(--app-text-primary)] placeholder:text-[var(--app-text-tertiary)] focus:border-emerald-500 focus:outline-none"
              />

              <div className="mt-1 flex justify-end">
                <span
                  className={`text-[11px] ${
                    currentLength > 4800
                      ? "font-semibold text-[var(--app-danger)]"
                      : "text-[var(--app-text-tertiary)]"
                  }`}
                >
                  {t.charCount(currentLength, 5000)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {messages.length >= 5 && (
        <div className="rounded-lg bg-amber-500/10 p-2 text-center text-xs font-medium text-amber-700 dark:text-amber-300">
          {t.maxBlocksNotice}
        </div>
      )}
    </div>
  );
}
