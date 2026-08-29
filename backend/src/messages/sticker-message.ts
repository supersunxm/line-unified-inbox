export type StickerPresentation = {
  text: string | null;
  keywords: string[];
};

const normalizeStickerText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
};

export function stickerPresentationFromRawPayload(rawPayload: unknown): StickerPresentation | null {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) return null;
  const payload = rawPayload as Record<string, unknown>;
  if (payload.type !== "sticker") return null;

  const keywords = Array.isArray(payload.keywords)
    ? payload.keywords
        .map(normalizeStickerText)
        .filter((keyword): keyword is string => keyword !== null)
    : [];

  return {
    text: normalizeStickerText(payload.text),
    keywords,
  };
}

export function firstUsefulStickerText(sticker: StickerPresentation | null | undefined): string | null {
  return sticker?.text ?? sticker?.keywords[0] ?? null;
}
