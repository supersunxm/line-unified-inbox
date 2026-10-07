// The "คัดลอกสรุป" text: a short Thai plain-text summary to paste into LINE. Pure.

import { RATE24_TARGET, REPLIED_RATE_TARGET } from "./kpi.ts";
import type { GroupTotals, MonthStoreRow } from "./monthly-model.ts";
import { formatValue, numericValue, type ValueState } from "./value-state.ts";
import { languageLocale, type AppLanguage } from "../../app/language-utils.ts";
import { v2Text } from "./v2-translations.ts";

export const OPEN_MONTH_NOTE = "ตัวเลขเดือนที่ยังไม่ปิดอาจเปลี่ยนได้";

function count(state: ValueState, language: AppLanguage): string {
  return formatValue(state, "count", language).text;
}

function percent(state: ValueState, language: AppLanguage): string {
  const formatted = formatValue(state, "percent", language);
  return state.kind === "low-sample" ? `${formatted.text} (n=${state.n})` : formatted.text;
}

function signed(state: ValueState, language: AppLanguage, withPoints = false): string | null {
  const value = numericValue(state);
  if (value === null) return null;
  const t = v2Text(language);
  if (value === 0) return t("reportSame");
  const magnitude = withPoints
    ? Math.abs(value).toLocaleString(languageLocale(language), { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : Math.abs(value).toLocaleString(languageLocale(language));
  return `${value > 0 ? "+" : "−"}${magnitude}${withPoints ? t("reportDeltaPoints") : ""}`;
}

export function buildReportSummary(input: {
  /** "ต.ค. 2026". */
  monthLabel: string;
  /** "1–7 ต.ค. 2026 เทียบ 1–7 ก.ย. 2026". */
  periodText: string;
  /** "Partner TG", "สาขา …" or "ทุกสาขา". */
  scopeLabel: string;
  totals: GroupTotals;
  /** Stores in scope; the three with the most unreplied chats are named. */
  stores: MonthStoreRow[];
  inProgress: boolean;
  language?: AppLanguage;
}): string {
  const language = input.language ?? "th";
  const t = v2Text(language);
  const { totals } = input;
  const unrepliedDelta = signed(totals.unrepliedDelta, language);
  const rateDelta = signed(totals.rate24Delta, language, true);
  const repliedDelta = signed(totals.replyRateDelta, language, true);
  const target = (value: number | null) => (value === null ? t("noTarget") : t("reportTarget", { value }));
  const top = input.stores
    .filter((row) => (numericValue(row.unreplied) ?? 0) > 0)
    .sort((a, b) => (numericValue(b.unreplied) ?? 0) - (numericValue(a.unreplied) ?? 0) || a.storeName.localeCompare(b.storeName, "th"))
    .slice(0, 3);
  const lines = [
    t("reportSummaryTitle", { month: input.monthLabel, scope: input.scopeLabel }),
    t("reportPeriod", { period: input.periodText }),
    t("reportChats", { chats: count(totals.chats, language), unanswered: count(totals.unreplied, language), delta: unrepliedDelta ? ` (${unrepliedDelta})` : "" }),
    t("reportRepliedRate", { rate: percent(totals.replyRate, language), delta: repliedDelta ? ` (${repliedDelta})` : "", target: target(REPLIED_RATE_TARGET) }),
    t("reportRate24", { rate: percent(totals.rate24, language), delta: rateDelta ? ` (${rateDelta})` : "", target: target(RATE24_TARGET) }),
    top.length > 0
      ? t("reportTopUnanswered", { stores: top.map((row, index) => t("reportTopStoreItem", { rank: index + 1, store: row.storeName, count: count(row.unreplied, language) })).join(" ") })
      : t("reportNoUnanswered"),
  ];
  if (input.inProgress) lines.push(t("reportOpenMonthNote"));
  return lines.join("\n");
}
