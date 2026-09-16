"use client";

import { useEffect, useState } from "react";
import { richMessageApi, type RichMessage } from "../rich-messages/rich-message-api";

export type AutoResponseRichMessageBlockValue = {
  id: string;
  type: "RICH_MESSAGE";
  richMessageId: string;
  richMessageName?: string;
  previewUrl?: string;
  altText?: string;
};

type Props = {
  block: AutoResponseRichMessageBlockValue;
  index: number;
  totalBlocks: number;
  disabled?: boolean;
  onChange: (block: AutoResponseRichMessageBlockValue) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

export function AutoResponseRichMessageBlock({
  block,
  index,
  totalBlocks,
  disabled = false,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: Props) {
  const [items, setItems] = useState<RichMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void richMessageApi.list(false)
      .then((data) => { if (!cancelled) setItems(data); })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "โหลด Rich Message ไม่สำเร็จ");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const selected = items.find((item) => item.id === block.richMessageId) || null;
  const previewUrl = selected?.previewUrl || selected?.imageUrl || block.previewUrl;

  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm transition-all hover:border-[var(--app-accent)]/50">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--app-accent)]/10 text-[10px] font-bold text-[var(--app-accent)]">RM</span>
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--app-text-secondary)]">Rich Message</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onMoveUp} disabled={disabled || index === 0} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] text-xs text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] disabled:opacity-30">↑</button>
          <button type="button" onClick={onMoveDown} disabled={disabled || index === totalBlocks - 1} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] text-xs text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] disabled:opacity-30">↓</button>
          <button type="button" onClick={onDelete} disabled={disabled} className="ml-1 flex h-7 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 px-2 text-xs font-semibold text-red-500 hover:bg-red-500/20 disabled:opacity-30">Delete</button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)]">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="aspect-square h-full w-full object-cover" />
          ) : (
            <div className="flex aspect-square items-center justify-center px-3 text-center text-xs text-[var(--app-text-tertiary)]">เลือก Rich Message</div>
          )}
        </div>

        <div className="min-w-0">
          <label className="text-xs font-semibold text-[var(--app-text-secondary)]">เลือกจากคลัง Rich Message</label>
          <select
            value={block.richMessageId}
            disabled={disabled || loading}
            onChange={(event) => {
              const item = items.find((candidate) => candidate.id === event.target.value);
              onChange({
                ...block,
                richMessageId: event.target.value,
                richMessageName: item?.name,
                previewUrl: item?.previewUrl || item?.imageUrl,
                altText: item?.altText,
              });
            }}
            className="mt-1 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2.5 text-sm text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)]"
          >
            <option value="">{loading ? "กำลังโหลด…" : "— เลือก Rich Message —"}</option>
            {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>

          {selected && (
            <div className="mt-2 rounded-xl bg-[var(--app-bg)] p-2.5 text-xs text-[var(--app-text-secondary)]">
              <div className="font-semibold text-[var(--app-text-primary)]">{selected.name}</div>
              <div className="mt-1">{selected.actions.length} จุดกด · {selected.baseWidth}×{selected.baseHeight}</div>
              <div className="mt-1 truncate">Alt: {selected.altText}</div>
            </div>
          )}
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          <a href="/rich-messages" target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-semibold text-[var(--app-accent)] hover:underline">จัดการคลัง Rich Message ↗</a>
        </div>
      </div>
    </div>
  );
}
