type WeeklyPeriodLabelSource = {
  weekNumber: number;
  label: string;
  labelTh: string;
  labelZh: string;
};

export function formatGoogleReviewWeeklyPeriodLabel(
  period: WeeklyPeriodLabelSource,
  language: "th" | "en" | "zh",
): string {
  const localizedWeek = language === "th"
    ? period.labelTh
    : language === "zh"
      ? period.labelZh
      : `Week ${period.weekNumber}`;
  const dateRange = period.label.match(/\(([^()]*)\)\s*$/)?.[1];

  return dateRange ? `${localizedWeek} (${dateRange})` : localizedWeek;
}
