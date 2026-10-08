// Bangkok date keys (YYYY-MM-DD, Asia/Bangkok = UTC+7, no DST). Pure.

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** YYYY-MM-DD in Asia/Bangkok. */
export function bangkokDateKey(at: Date | number = Date.now()): string {
  const ms = at instanceof Date ? at.getTime() : at;
  return new Date(ms + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

export function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
