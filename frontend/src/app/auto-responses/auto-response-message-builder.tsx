"use client";

import React, { useState } from "react";
import type {
  AutoResponseMessageBlock,
  AutoResponseTextBlock,
  AutoResponseImageBlock as AutoResponseImageBlockType,
} from "@/types/api";
import { AutoResponseImageBlock } from "./auto-response-image-block";
import type { AutoResponseDict } from "./auto-response-i18n";

type AutoResponseMessageBuilderProps = {
  messages: AutoResponseMessageBlock[];
  disabled?: boolean;
  t: AutoResponseDict;
  onChange: (messages: AutoResponseMessageBlock[]) => void;
};

export function AutoResponseMessageBuilder({
  messages,
  disabled = false,
  t,
  onChange,
}: AutoResponseMessageBuilderProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [variableDropdownBlockId, setVariableDropdownBlockId] = useState<string | null>(null);

  const canAddMore = messages.length < 5;

  const handleAddText = () => {
    if (!canAddMore) return;
    const newBlock: AutoResponseTextBlock = {
      id: crypto.randomUUID(),
      type: "TEXT",
      textTemplate: "",
    };
    onChange([...messages, newBlock]);
    setShowAddMenu(false);
  };

  const handleAddImage = () => {
    if (!canAddMore) return;
    const newBlock: AutoResponseImageBlockType = {
      id: crypto.randomUUID(),
      type: "IMAGE",
      mediaObjectKey: "",
    };
    onChange([...messages, newBlock]);
    setShowAddMenu(false);
  };

  const handleUpdateBlock = (index: number, updated: AutoResponseMessageBlock) => {
    const next = [...messages];
    next[index] = updated;
    onChange(next);
  };

  const handleDeleteBlock = (index: number) => {
    if (messages.length <= 1) {
      // Keep at least one block or reset to empty text
      const next: AutoResponseMessageBlock[] = [
        {
          id: crypto.randomUUID(),
          type: "TEXT",
          textTemplate: "",
        },
      ];
      onChange(next);
      return;
    }
    const next = messages.filter((_, i) => i !== index);
    onChange(next);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const next = [...messages];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    onChange(next);
  };

  const handleMoveDown = (index: number) => {
    if (index >= messages.length - 1) return;
    const next = [...messages];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    onChange(next);
  };

  const handleInsertVariable = (blockIndex: number, varName: string) => {
    const block = messages[blockIndex];
    if (block.type !== "TEXT") return;

    const currentText = block.textTemplate || "";
    const newText = currentText ? `${currentText} ${varName}` : varName;
    handleUpdateBlock(blockIndex, {
      ...block,
      textTemplate: newText,
    });
    setVariableDropdownBlockId(null);
  };

  return (
    <div className="space-y-4">
      {/* Builder Header & Counter */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-xs font-bold text-[var(--app-text-secondary)] uppercase tracking-wider">
            {t.messageSequenceTitle}
          </label>
          <p className="text-[11px] text-[var(--app-text-secondary)]">
            {t.maxBlocksNotice}
          </p>
        </div>

        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            messages.length >= 5
              ? "bg-amber-500/10 text-amber-500"
              : "bg-[var(--app-surface-hover)] text-[var(--app-text-secondary)]"
          }`}
        >
          {t.blocksCount(messages.length)}
        </span>
      </div>

      {/* Ordered Blocks Stream */}
      <div className="space-y-3">
        {messages.map((block, idx) => {
          if (block.type === "IMAGE") {
            return (
              <AutoResponseImageBlock
                key={block.id || `img-${idx}`}
                block={block}
                index={idx}
                totalBlocks={messages.length}
                disabled={disabled}
                t={t}
                onChange={(updated) => handleUpdateBlock(idx, updated)}
                onDelete={() => handleDeleteBlock(idx)}
                onMoveUp={() => handleMoveUp(idx)}
                onMoveDown={() => handleMoveDown(idx)}
              />
            );
          }

          // TEXT Block
          return (
            <div
              key={block.id || `txt-${idx}`}
              className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm transition-all hover:border-[var(--app-accent)]/50"
            >
              {/* Block Header */}
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--app-accent)]/10 text-xs font-bold text-[var(--app-accent)]">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-bold text-[var(--app-text-secondary)] uppercase tracking-wider">
                    {t.typeText}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveUp(idx)}
                    disabled={disabled || idx === 0}
                    title={t.moveUpButton}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] text-xs text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveDown(idx)}
                    disabled={disabled || idx === messages.length - 1}
                    title={t.moveDownButton}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] text-xs text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteBlock(idx)}
                    disabled={disabled}
                    title={t.deleteBlockButton}
                    className="ml-1 flex h-7 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 px-2 text-xs font-semibold text-red-500 hover:bg-red-500/20 disabled:opacity-30"
                  >
                    {t.deleteBlockButton}
                  </button>
                </div>
              </div>

              {/* Textarea */}
              <textarea
                value={block.textTemplate || ""}
                onChange={(e) =>
                  handleUpdateBlock(idx, {
                    ...block,
                    textTemplate: e.target.value,
                  })
                }
                disabled={disabled}
                rows={3}
                placeholder={t.fieldTextTemplatePlaceholder}
                className="w-full resize-y rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] p-3 text-sm text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
              />

              {/* Variable Inserter */}
              <div className="relative mt-2">
                <button
                  type="button"
                  onClick={() =>
                    setVariableDropdownBlockId(
                      variableDropdownBlockId === block.id ? null : block.id,
                    )
                  }
                  disabled={disabled}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] disabled:opacity-50"
                >
                  <svg className="h-3.5 w-3.5 text-[var(--app-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t.insertStoreVariable}
                  <span className="text-[10px] text-[var(--app-text-secondary)]">▼</span>
                </button>

                {variableDropdownBlockId === block.id && (
                  <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5 shadow-xl">
                    <button
                      type="button"
                      onClick={() => handleInsertVariable(idx, "{{store.storeName}}")}
                      className="block w-full rounded-lg px-3 py-1.5 text-left text-xs text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
                    >
                      {t.varStoreName}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertVariable(idx, "{{store.googleMapsUrl}}")}
                      className="block w-full rounded-lg px-3 py-1.5 text-left text-xs text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
                    >
                      {t.varGoogleMapsUrl}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertVariable(idx, "{{store.lineOaLink}}")}
                      className="block w-full rounded-lg px-3 py-1.5 text-left text-xs text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
                    >
                      {t.varLineOaLink}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertVariable(idx, "{{store.tiktokProfileUrl}}")}
                      className="block w-full rounded-lg px-3 py-1.5 text-left text-xs text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
                    >
                      {t.varTiktokUrl}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Block Action */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowAddMenu(!showAddMenu)}
          disabled={disabled || !canAddMore}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-3 text-xs font-bold transition-all ${
            canAddMore
              ? "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-primary)] hover:border-[var(--app-accent)] hover:bg-[var(--app-surface-hover)]"
              : "cursor-not-allowed border-[var(--app-border)]/50 bg-[var(--app-surface)]/50 text-[var(--app-text-secondary)] opacity-50"
          }`}
        >
          <span className="text-base leading-none">+</span>
          {t.addMessageButton}
        </button>

        {showAddMenu && canAddMore && (
          <div className="absolute bottom-full left-1/2 z-20 mb-2 w-48 -translate-x-1/2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-2 shadow-2xl">
            <button
              type="button"
              onClick={handleAddText}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
            >
              <span className="text-sm">💬</span>
              {t.typeText}
            </button>
            <button
              type="button"
              onClick={handleAddImage}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
            >
              <span className="text-sm">🖼</span>
              {t.typeImage}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
