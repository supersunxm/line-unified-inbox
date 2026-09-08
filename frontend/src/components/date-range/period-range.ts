export type PeriodRange = { dateFrom: string; dateTo: string };
export type DraftRange = { start: string | null; end: string | null };
export const PERIOD_PRESETS = [7, 14, 30] as const;

/** UTC arithmetic preserves inclusive calendar dates across DST and browser time zones. */
export function presetRange(days: number, today: string): PeriodRange {
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { dateFrom: start.toISOString().slice(0, 10), dateTo: today };
}

export function matchesPreset(range: PeriodRange, days: number, today: string): boolean {
  const preset = presetRange(days, today);
  return range.dateFrom === preset.dateFrom && range.dateTo === preset.dateTo;
}

export function selectDraftDate(draft: DraftRange, date: string): DraftRange {
  if (!draft.start || draft.end) return { start: date, end: null };
  return date < draft.start ? { start: date, end: draft.start } : { start: draft.start, end: date };
}
