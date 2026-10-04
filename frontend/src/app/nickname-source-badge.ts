import { createElement } from "react";

export function NicknameSourceBadge({ tag, language = "th" }: { tag?: string | null; language?: "th" | "en" | "zh" }) {
  if (!tag) return null;
  const label = language === "th" ? "แหล่งที่มา" : language === "zh" ? "来源" : "Source";
  return createElement("span", {
    "data-nickname-source-tag": tag,
    "aria-label": `${label}: ${tag}`,
    className: "rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-1.5 py-0.5 text-[10px] text-[var(--app-text-secondary)]",
  }, `${label}: ${tag}`);
}
