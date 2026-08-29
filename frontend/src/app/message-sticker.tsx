import type { ApiConversation } from "@/types/api";

type Sticker = ApiConversation["messages"][number]["sticker"];

export function firstUsefulStickerText(sticker: Sticker): string | null {
  const text = sticker?.text?.replace(/\s+/g, " ").trim();
  if (text) return text;
  for (const keyword of sticker?.keywords ?? []) {
    const normalized = keyword.replace(/\s+/g, " ").trim();
    if (normalized) return normalized;
  }
  return null;
}

export function lineStickerLabel(language: "th" | "en" | "zh" = "th") {
  if (language === "en") return "Sent a LINE sticker";
  if (language === "zh") return "发送了 LINE 贴纸";
  return "ส่งสติกเกอร์ LINE";
}

export function MessageSticker({ sticker, language = "th" }: { sticker: Sticker; language?: "th" | "en" | "zh" }) {
  const detail = firstUsefulStickerText(sticker);
  return (
    <div data-line-sticker className="min-w-40 py-0.5">
      <div className="flex items-center gap-2 font-semibold">
        <span aria-hidden="true" className="inline-block h-4 w-4 rounded-[4px] bg-[#06c755]" />
        <span>{lineStickerLabel(language)}</span>
      </div>
      {detail && <p data-line-sticker-text className="mt-1.5 whitespace-pre-wrap break-words text-sm opacity-85">{detail}</p>}
    </div>
  );
}
