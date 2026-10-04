// Store opening hours and the follow-up rules for v2. One place for every constant.
// Kept free of React so node --test can import it.

/** Asia/Bangkok is UTC+7 all year (no daylight saving), so a fixed offset is exact. */
export const BUSINESS_TIME_ZONE = "Asia/Bangkok";
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DAY_MINUTES = 24 * 60;

/** Stores are assumed open every day, 10:00-21:00 Bangkok time. */
export const BUSINESS_OPEN_MINUTE = 10 * 60;
export const BUSINESS_CLOSE_MINUTE = 21 * 60;
export const BUSINESS_MINUTES_PER_DAY = BUSINESS_CLOSE_MINUTE - BUSINESS_OPEN_MINUTE;

/** A store needs follow-up when a customer has waited this many business minutes. */
export const FOLLOW_UP_THRESHOLD_MINUTES = 60;

/** Target for the backend's "replied within 24 hours" rate, in percent. */
export const RESPONSE_RATE_TARGET_PERCENT = 90;

function toMs(value: Date | number | string): number {
  return value instanceof Date ? value.getTime() : typeof value === "number" ? value : new Date(value).getTime();
}

/** Minutes since the Bangkok-local epoch (a "local clock" timeline with no time zone). */
function bangkokLocalMinutes(ms: number): number {
  return (ms + BANGKOK_OFFSET_MS) / MINUTE_MS;
}

function openMinutesWithinDay(dayStart: number, from: number, to: number): number {
  const open = dayStart + BUSINESS_OPEN_MINUTE;
  const close = dayStart + BUSINESS_CLOSE_MINUTE;
  return Math.max(0, Math.min(close, to) - Math.max(open, from));
}

/**
 * Whole minutes between `start` and `end` that fall inside opening hours, across any
 * number of days. A message sent after closing starts counting at the next opening.
 * Returns 0 when `end` is not after `start`.
 */
export function businessMinutesBetween(start: Date | number | string, end: Date | number | string): number {
  const startMs = toMs(start);
  const endMs = toMs(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  const from = bangkokLocalMinutes(startMs);
  const to = bangkokLocalMinutes(endMs);
  const firstDay = Math.floor(from / DAY_MINUTES);
  const lastDay = Math.floor(to / DAY_MINUTES);
  if (firstDay === lastDay) return Math.floor(openMinutesWithinDay(firstDay * DAY_MINUTES, from, to));
  const firstPart = openMinutesWithinDay(firstDay * DAY_MINUTES, from, to);
  const lastPart = openMinutesWithinDay(lastDay * DAY_MINUTES, from, to);
  const fullDays = lastDay - firstDay - 1;
  return Math.floor(firstPart + lastPart + fullDays * BUSINESS_MINUTES_PER_DAY);
}

/** Real elapsed whole minutes. */
export function realMinutesBetween(start: Date | number | string, end: Date | number | string): number {
  return Math.max(0, Math.floor((toMs(end) - toMs(start)) / MINUTE_MS));
}

export function needsFollowUp(businessMinutes: number): boolean {
  return businessMinutes >= FOLLOW_UP_THRESHOLD_MINUTES;
}

/** "45 นาที", "2 ชม. 5 นาที", "13 ชม." (business time). */
export function formatWaitMinutes(minutes: number): string {
  const safe = Math.max(0, Math.floor(minutes));
  if (safe < 60) return `${safe} นาที`;
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  return rest === 0 ? `${hours} ชม.` : `${hours} ชม. ${rest} นาที`;
}

function bangkokDayKey(ms: number): number {
  return Math.floor(bangkokLocalMinutes(ms) / DAY_MINUTES);
}

function bangkokClock(ms: number): string {
  const minutes = Math.floor(bangkokLocalMinutes(ms)) % DAY_MINUTES;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "วันนี้ 14:05", "เมื่อวาน 20:30" or "3 ต.ค. 09:12", in Bangkok time. */
export function formatSentAt(sentAt: Date | number | string, now: Date | number | string = Date.now()): string {
  const ms = toMs(sentAt);
  const dayDiff = bangkokDayKey(toMs(now)) - bangkokDayKey(ms);
  const clock = bangkokClock(ms);
  if (dayDiff === 0) return `วันนี้ ${clock}`;
  if (dayDiff === 1) return `เมื่อวาน ${clock}`;
  const local = new Date(ms + BANGKOK_OFFSET_MS);
  return `${local.getUTCDate()} ${THAI_MONTHS[local.getUTCMonth()]} ${clock}`;
}

/** Whether a wait spans closed hours, so its business time differs from real time. */
export function waitSpansClosedHours(start: Date | number | string, end: Date | number | string): boolean {
  return realMinutesBetween(start, end) !== businessMinutesBetween(start, end);
}
