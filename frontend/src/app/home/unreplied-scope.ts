/**
 * The two "unreplied" numbers on /home, labelled by scope:
 * - the card and the "Needs attention" row count every unreplied chat across all months
 *   (`bm-reply-status-summary` without a month; what they count is unchanged);
 * - "this month" is the sidebar badge's number (same request and helper as /chats).
 */
export type HomeLanguage = "th" | "en" | "zh";

export const UNREPLIED_SCOPE_LABELS: Record<HomeLanguage, { unrepliedAllMonths: string; thisMonth: string }> = {
  th: { unrepliedAllMonths: "ยังไม่ตอบ (ทุกเดือน)", thisMonth: "เดือนนี้" },
  en: { unrepliedAllMonths: "Unreplied (all months)", thisMonth: "This month" },
  zh: { unrepliedAllMonths: "未回复（全部月份）", thisMonth: "本月" },
};

/** "เดือนนี้ 1,258", or null while the month count is loading or failed (never a 0). */
export function thisMonthLine(language: HomeLanguage, monthCount: number | null): string | null {
  if (monthCount === null) return null;
  return `${UNREPLIED_SCOPE_LABELS[language].thisMonth} ${monthCount.toLocaleString("en-US")}`;
}
