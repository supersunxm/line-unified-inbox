"use client";

import React from "react";
import type {
  AutoResponsePreviewResult,
  ResolvedAutoResponseBlock,
} from "@/types/api";
import type { AutoResponseDict } from "./auto-response-i18n";

type AutoResponsePreviewStreamProps = {
  previewData: AutoResponsePreviewResult | null;
  loading?: boolean;
  t: AutoResponseDict;
};

export function AutoResponsePreviewStream({
  previewData,
  loading = false,
  t,
}: AutoResponsePreviewStreamProps) {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)]/50 p-6">
        <div className="flex items-center gap-2 text-xs text-[var(--app-text-secondary)]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--app-accent)] border-t-transparent" />
          <span>{t.saving}</span>
        </div>
      </div>
    );
  }

  if (!previewData) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)]/50 p-6 text-center text-xs text-[var(--app-text-secondary)]">
        <p>{t.previewNoStore}</p>
      </div>
    );
  }

  const messages: ResolvedAutoResponseBlock[] =
    previewData.messages && previewData.messages.length > 0
      ? previewData.messages
      : [
          {
            id: "default-text",
            type: "TEXT",
            resolvedText: previewData.resolvedText || "",
            usedVariables: previewData.usedVariables || [],
            unresolvedVariables: previewData.unresolvedVariables || [],
            isValid: previewData.ready,
            validationError: previewData.reason || undefined,
          },
        ];

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] shadow-inner">
      {/* LINE Chat Header Simulation */}
      <div className="flex items-center gap-3 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#06C755] font-bold text-white text-xs shadow-sm">
          OA
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-[var(--app-text-primary)]">
            {previewData.store.lineOfficialAccountName || previewData.store.storeName}
          </p>
          <p className="text-[10px] text-[var(--app-text-secondary)]">
            {t.previewBubbleHeader}
          </p>
        </div>
      </div>

      {/* Chat Messages Stream */}
      <div className="space-y-3 p-4">
        {messages.map((msg, idx) => {
          if (msg.type === "IMAGE") {
            return (
              <div key={msg.id || `msg-img-${idx}`} className="flex flex-col items-start">
                <div className="relative max-w-[260px] overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-md">
                  {msg.imageUrl || msg.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={msg.previewUrl || msg.imageUrl}
                      alt="Auto-response image preview"
                      className="h-auto w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-36 w-52 flex-col items-center justify-center p-4 text-center text-xs text-[var(--app-text-secondary)]">
                      <span className="text-2xl mb-1">🖼</span>
                      <span>{t.previewMissingImage}</span>
                    </div>
                  )}
                </div>

                {!msg.isValid && msg.validationError && (
                  <p className="mt-1 text-[11px] font-medium text-red-500">
                    ⚠ {msg.validationError}
                  </p>
                )}
              </div>
            );
          }

          // TEXT Message Bubble
          return (
            <div key={msg.id || `msg-txt-${idx}`} className="flex flex-col items-start">
              <div className="relative max-w-[280px] rounded-2xl rounded-tl-sm bg-[#06C755] p-3 text-xs font-normal text-white shadow-md leading-relaxed whitespace-pre-wrap">
                {msg.resolvedText ? (
                  msg.resolvedText
                ) : (
                  <span className="italic opacity-70">({t.fieldTextTemplate})</span>
                )}
              </div>

              {!msg.isValid && msg.validationError && (
                <p className="mt-1 text-[11px] font-medium text-red-500">
                  ⚠ {msg.validationError}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
