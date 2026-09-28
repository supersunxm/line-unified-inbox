import type { ApiConversation } from "@/types/api";
import { historicalMediaPlaceholder } from "./historical-media-placeholder";

type Message = ApiConversation["messages"][number];

export function HistoricalMediaPlaceholder({ message }: { message: Message }) {
  const placeholder = historicalMediaPlaceholder(message);
  if (!placeholder) return null;
  return (
    <div data-historical-media-placeholder className="rounded-xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 py-2.5 text-sm">
      <p>{placeholder.label}</p>
      {placeholder.detail && <p className="mt-1 text-xs opacity-75">{placeholder.detail}</p>}
      <p className="mt-1 text-xs opacity-70">The archive contains metadata only; media bytes are unavailable.</p>
    </div>
  );
}
