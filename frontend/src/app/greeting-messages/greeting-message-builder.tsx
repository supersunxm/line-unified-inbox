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

const COMMON_EMOJIS = [
  "😊", "👋", "🎉", "✨", "❤️", "📱", "🛍️", "🌟", "📍", "🕒", "📞", "🙏", "🏬", "💯", "🎁"
];

export function GreetingMessageBuilder({
  messages,
  disabled = false,
  t,
  onChange,
}: GreetingMessageBuilderProps) {
  const [activeTextIndex, setActiveTextIndex] = useState<number | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showEmojiPickerIndex, setShowEmojiPickerIndex] = useState<number | null>(null);
  const [showMoreVarsIndex, setShowMoreVarsIndex] = useState<number | null>(null);
  const textareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});

  const handleAddText = () => {
    if (messages.length >= 5 || disabled) return;
    const newBlock: GreetingTextBlock = {
      id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "TEXT",
      textTemplate: "",
    };
    onChange([...messages, newBlock]);
    setShowAddMenu(false);
  };

  const handleAddImage = () => {
    if (messages.length >= 5 || disabled) return;
    const newBlock: GreetingImageBlockType = {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "IMAGE",
      mediaObjectKey: "",
    };
    onChange([...messages, newBlock]);
    setShowAddMenu(false);
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

  const handleInsertText = (blockIndex: number, textToInsert: string) => {
    if (disabled) return;
    const currentBlock = messages[blockIndex] as GreetingTextBlock;
    if (!currentBlock || currentBlock.type !== "TEXT") return;

    const textarea = textareaRefs.current[blockIndex];
    const prev = currentBlock.textTemplate || "";

    if (textarea) {
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const inserted = prev.slice(0, start) + textToInsert + prev.slice(end);

      handleUpdateBlock(blockIndex, {
        ...currentBlock,
        textTemplate: inserted,
      });

      // Restore focus & cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + textToInsert.length,
          start + textToInsert.length,
        );
      }, 0);
    } else {
      handleUpdateBlock(blockIndex, {
        ...currentBlock,
        textTemplate: prev + textToInsert,
      });
    }
  };

  return (
    <div className="space-y-4">
      {messages.map((block, index) => {
        if (block.type === "IMAGE") {
          return (
            <GreetingImageBlock
              key={block.id || `block-${index}`}
              block={block}
              index={index}
              totalBlocks={messages.length}
              disabled={disabled}
              t={t}
              onChange={(updated) => handleUpdateBlock(index, updated)}
              onDelete={() => handleDeleteBlock(index)}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
            />
          );
        }

        const textBlock = block as GreetingTextBlock;
        const charLen = (textBlock.textTemplate || "").length;
        const isMaxLimit = charLen >= 5000;

        return (
          <div
            key={block.id || `block-${index}`}
            className="rounded-lg border border-[var(--app-border)] bg-white overflow-hidden shadow-xs"
          >
            {/* Top Toolbar matching LINE OA Manager */}
            <div className="flex items-center justify-between px-3 py-2 bg-[#f4f5f7] border-b border-[var(--app-border)] text-xs text-[var(--app-text-secondary)]">
              <div className="flex items-center gap-1.5 font-medium">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-white text-[var(--app-text-primary)] border border-gray-200 shadow-2xs font-bold text-xs">
                  T
                </span>
                <span className="text-[var(--app-text-primary)] font-medium">
                  {t.textBlockTitle(index + 1)}
                </span>
              </div>

              {/* Right Reorder & Delete Controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleMoveUp(index)}
                  disabled={disabled || index === 0}
                  title={t.moveUpButton}
                  aria-label={t.moveUpButton}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed text-xs transition"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveDown(index)}
                  disabled={disabled || index === messages.length - 1}
                  title={t.moveDownButton}
                  aria-label={t.moveDownButton}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed text-xs transition"
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteBlock(index)}
                  disabled={disabled || messages.length <= 1}
                  title={t.deleteBlockButton}
                  aria-label={t.deleteBlockButton}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-gray-500 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed text-xs transition font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Clean Textarea Area */}
            <div className="p-4 bg-white">
              <div className="relative">
                <textarea
                  ref={(el) => {
                    textareaRefs.current[index] = el;
                  }}
                  rows={6}
                  value={textBlock.textTemplate || ""}
                  disabled={disabled}
                  onFocus={() => setActiveTextIndex(index)}
                  onChange={(e) =>
                    handleUpdateBlock(index, {
                      ...textBlock,
                      textTemplate: e.target.value,
                    })
                  }
                  placeholder={t.textBlockPlaceholder}
                  className="w-full resize-y rounded-md border border-gray-300 p-3 text-sm text-gray-800 placeholder-gray-400 focus:border-[#06c755] focus:ring-1 focus:ring-[#06c755] focus:outline-none transition leading-relaxed min-h-[140px]"
                />
                <div className="absolute right-3 bottom-3 text-xs text-gray-400 font-tabular pointer-events-none">
                  <span className={isMaxLimit ? "text-red-500 font-semibold" : ""}>
                    {charLen}
                  </span>{" "}
                  / 5000
                </div>
              </div>

              {/* Variable Buttons matching LINE OA Manager */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {/* Emoji Picker Button */}
                <div className="relative">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setShowEmojiPickerIndex(
                        showEmojiPickerIndex === index ? null : index,
                      );
                      setShowMoreVarsIndex(null);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 shadow-2xs transition"
                  >
                    <span>😊</span>
                    <span>{t.emoji}</span>
                  </button>

                  {showEmojiPickerIndex === index && (
                    <div className="absolute left-0 bottom-full mb-1 z-30 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-lg grid grid-cols-5 gap-1 text-lg">
                      {COMMON_EMOJIS.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => {
                            handleInsertText(index, em);
                            setShowEmojiPickerIndex(null);
                          }}
                          className="w-9 h-9 flex items-center justify-center rounded hover:bg-gray-100 transition cursor-pointer"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Priority Variable Buttons */}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleInsertText(index, "{{user.displayName}}")}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded border border-gray-300 bg-white hover:bg-emerald-50 hover:border-[#06c755] hover:text-[#06c755] text-gray-700 shadow-2xs transition"
                >
                  {t.userDisplayName}
                </button>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleInsertText(index, "{{account.name}}")}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded border border-gray-300 bg-white hover:bg-emerald-50 hover:border-[#06c755] hover:text-[#06c755] text-gray-700 shadow-2xs transition"
                >
                  {t.accountName}
                </button>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleInsertText(index, "{{store.storeName}}")}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded border border-gray-300 bg-white hover:bg-emerald-50 hover:border-[#06c755] hover:text-[#06c755] text-gray-700 shadow-2xs transition"
                >
                  {t.storeName}
                </button>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleInsertText(index, "{{store.googleMapsUrl}}")}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded border border-gray-300 bg-white hover:bg-emerald-50 hover:border-[#06c755] hover:text-[#06c755] text-gray-700 shadow-2xs transition"
                >
                  {t.googleMaps}
                </button>

                {/* More Variables Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setShowMoreVarsIndex(
                        showMoreVarsIndex === index ? null : index,
                      );
                      setShowEmojiPickerIndex(null);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 shadow-2xs transition"
                  >
                    <span>{t.moreVariables}</span>
                    <span className="text-[10px]">▼</span>
                  </button>

                  {showMoreVarsIndex === index && (
                    <div className="absolute left-0 bottom-full mb-1 z-30 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          handleInsertText(index, "{{store.externalStoreId}}");
                          setShowMoreVarsIndex(null);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-gray-100 text-gray-700"
                      >
                        {t.varExternalStoreId}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleInsertText(index, "{{store.province}}");
                          setShowMoreVarsIndex(null);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-gray-100 text-gray-700"
                      >
                        {t.varProvince}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleInsertText(index, "{{store.region}}");
                          setShowMoreVarsIndex(null);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-gray-100 text-gray-700"
                      >
                        {t.varRegion}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleInsertText(index, "{{store.lineBasicId}}");
                          setShowMoreVarsIndex(null);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-gray-100 text-gray-700"
                      >
                        {t.varLineId}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleInsertText(index, "{{store.tiktokUsername}}");
                          setShowMoreVarsIndex(null);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-gray-100 text-gray-700"
                      >
                        {t.varTiktokUsername}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Notice below buttons */}
              <p className="mt-2 text-[11px] text-gray-500">
                {t.userDisplayNameNotice}
              </p>
            </div>
          </div>
        );
      })}

      {/* Add Message Button matching LINE OA Manager */}
      <div className="relative inline-block">
        <button
          type="button"
          disabled={disabled || messages.length >= 5}
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded border border-[#06c755] bg-white text-[#06c755] hover:bg-[#e8f9ee] disabled:opacity-40 disabled:hover:bg-white cursor-pointer disabled:cursor-not-allowed shadow-2xs transition"
        >
          <span className="font-bold text-sm">+</span>
          <span>{t.add}</span>
          <span className="text-gray-400 font-normal text-[11px]">
            ({messages.length}/5)
          </span>
        </button>

        {showAddMenu && (
          <div className="absolute left-0 top-full mt-1 z-30 w-36 rounded-md border border-gray-200 bg-white py-1 shadow-lg text-xs">
            <button
              type="button"
              onClick={handleAddText}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 text-gray-800"
            >
              <span className="font-bold text-gray-500">T</span>
              <span>{t.text}</span>
            </button>
            <button
              type="button"
              onClick={handleAddImage}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 text-gray-800"
            >
              <span>🖼️</span>
              <span>{t.image}</span>
            </button>
          </div>
        )}
      </div>

      {messages.length >= 5 && (
        <p className="text-xs text-amber-600 font-medium mt-1">
          {t.maxBlocksNotice}
        </p>
      )}
    </div>
  );
}
