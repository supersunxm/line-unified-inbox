/**
 * Display formatting for message-search results. Pure module.
 */
import type { AppLanguage } from "../../../app/language-utils.ts";
import { MESSAGE_SEARCH_TIMEZONE } from "./message-search-config.ts";
import { messageSearchCopy, type MessageSearchCopy } from "./message-search-copy.ts";
import type { MessageSearchDirection, MessageSearchSource } from "./message-search-adapter.ts";

function intlLocale(language: AppLanguage): string {
  return language === "th" ? "th-TH-u-ca-gregory" : language === "zh" ? "zh-CN" : "en-US";
}

/** Message timestamp shown in Asia/Bangkok time, regardless of the viewer's time zone. */
export function formatMessageSearchTimestamp(iso: string, language: AppLanguage = "th"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(intlLocale(language), {
    timeZone: MESSAGE_SEARCH_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function messageSearchDirectionLabel(direction: MessageSearchDirection, language: AppLanguage = "th"): string {
  const copy: MessageSearchCopy = messageSearchCopy(language);
  if (direction === "INBOUND") return copy.directionInbound;
  if (direction === "OUTBOUND") return copy.directionOutbound;
  return copy.directionSystem;
}

export function messageSearchSourceLabel(source: MessageSearchSource, language: AppLanguage = "th"): string {
  const copy: MessageSearchCopy = messageSearchCopy(language);
  return source === "HISTORICAL" ? copy.sourceHistorical : copy.sourceLive;
}
