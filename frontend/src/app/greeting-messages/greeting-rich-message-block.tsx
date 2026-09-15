"use client";

import { useEffect, useState } from "react";
import { richMessageApi, type RichMessage } from "../rich-messages/rich-message-api";

export type GreetingRichMessageBlockValue = {
  id: string;
  type: "RICH_MESSAGE";
  richMessageId: string;
  richMessageName?: string;
  previewUrl?: string;
  altText?: string;
};

type Props = {
  block: GreetingRichMessageBlockValue;
  index: number;
  totalBlocks: number;
  disabled?: boolean;
  onChange: (block: GreetingRichMessageBlockValue) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

export function GreetingRichMessageBlock({
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
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "โหลด Rich Message ไม่สำเร็จ"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const selected = items.find((item) => item.id === block.richMessageId) || null;
  const previewUrl = selected?.previewUrl || selected?.imageUrl || block.previewUrl;

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--app-border)] bg-white shadow-xs">
      <div className="flex items-center justify-between border-b border-[var(--app-border)] bg-[#f4f5f7] px-3 py-2 text-xs">
        <div className="flex items-center gap-2 font-medium text-[var(--app-text-primary)]">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-gray-200 bg-white px-1 text-[10px] font-bold">RM</span>
          <span>Rich Message {index + 1}</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onMoveUp} disabled={disabled || index === 0} className="flex h-6 w-6 items-center justify-center rounded text-gray-600 hover:bg-gray-200 disabled:opacity-30">▲</button>
          <button type="button" onClick={onMoveDown} disabled={disabled || index === totalBlocks - 1} className="flex h-6 w-6 items-center justify-center rounded text-gray-600 hover:bg-gray-200 disabled:opacity-30">▼</button>
          <button type="button" onClick={onDelete} disabled={disabled || totalBlocks <= 1} className="flex h-6 w-6 items-center justify-center rounded font-bold text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30">✕</button>
        </div>
      </div>

      <div className="p-4">
        <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            {previewUrl ? <img src={previewUrl} alt="" className="aspect-square h-full w-full object-cover" /> : <div className="flex aspect-square items-center justify-center px-3 text-center text-xs text-gray-400">เลือก Rich Message</div>}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700">เลือกจากคลัง Rich Message</label>
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
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#06c755]"
            >
              <option value="">{loading ? "กำลังโหลด…" : "— เลือก Rich Message —"}</option>
              {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            {selected && <div className="mt-2 rounded-lg bg-gray-50 p-2.5 text-xs text-gray-600"><div className="font-semibold text-gray-800">{selected.name}</div><div className="mt-1">{selected.actions.length} จุดกด · {selected.baseWidth}×{selected.baseHeight}</div><div className="mt-1 truncate">Alt: {selected.altText}</div></div>}
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <a href="/rich-messages" target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-semibold text-[#06a947] hover:underline">จัดการคลัง Rich Message ↗</a>
          </div>
        </div>
      </div>
    </div>
  );
}
