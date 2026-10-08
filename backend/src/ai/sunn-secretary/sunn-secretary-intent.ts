/**
 * Sunn Secretary: deterministic, read-only request recognition.
 * No database access, no LINE send, no external API calls.
 * Fail closed for unsupported queries; do not ask a generative model to invent KPI figures.
 */
export type UnansweredMonthIntent = {
  kind: "UNANSWERED_BY_STORE";
  month: string; // YYYY-MM, Asia/Bangkok
};
export type SecretaryIntent = UnansweredMonthIntent | { kind: "UNSUPPORTED" };

const THAI_MONTHS: Record<string, number> = {
  มกราคม: 1, กุมภาพันธ์: 2, มีนาคม: 3, เมษายน: 4, พฤษภาคม: 5, มิถุนายน: 6,
  กรกฎาคม: 7, สิงหาคม: 8, กันยายน: 9, ตุลาคม: 10, พฤศจิกายน: 11, ธันวาคม: 12,
};

export function bangkokMonth(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error("Unable to resolve Bangkok month");
  return `${year}-${month}`;
}

export function parseSunnSecretaryIntent(text: string, now: Date): SecretaryIntent {
  const message = text.replace(/@เลขาซันน์/gu, "").trim();
  const isUnanswered = /(?:ค้างตอบ|ยังไม่ตอบ|ไม่ได้ตอบ|รอตอบ)/u.test(message);
  const isLine = /(?:LINE\s*OA|ไลน์\s*โอเอ|ร้าน|สาขา)/iu.test(message);
  if (!isUnanswered || !isLine) return { kind: "UNSUPPORTED" };

  let month = bangkokMonth(now);
  const explicit = message.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/u);
  if (explicit) {
    month = `${explicit[1]}-${explicit[2]}`;
  } else {
    const found = Object.entries(THAI_MONTHS).find(([name]) => message.includes(name));
    if (found) {
      const currentYear = Number(month.slice(0, 4));
      const yearMatch = message.match(/(?:พ\.ศ\.|ปี)\s*(25\d{2}|20\d{2})/u);
      const year = yearMatch ? Number(yearMatch[1]) : currentYear;
      month = `${year > 2400 ? year - 543 : year}-${String(found[1]).padStart(2, "0")}`;
    }
  }
  return { kind: "UNANSWERED_BY_STORE", month };
}
