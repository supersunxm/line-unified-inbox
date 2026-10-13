import type { SecretaryMonthlyAnswer } from "./sunn-secretary-monthly";

/** LINE text message max 5000 chars. Budget below the limit for safety. */
const MAX_REPLY_LENGTH = 4500;
const MAX_STORE_ROWS = 30;
const THAI_MONTH_NAMES = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"] as const;

function safeName(value: string): string {
  let sanitized = "";
  for (const character of value) {
    const code = character.charCodeAt(0);
    sanitized += code <= 0x1f || code === 0x7f ? " " : character;
  }
  return sanitized.trim().slice(0, 100);
}
export function formatSunnMonthlyReply(answer: SecretaryMonthlyAnswer): string {
  const dataAsOf = answer.dataQuality ? new Date(answer.dataQuality.sourceDataAsOf) : null;
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/u.test(answer.month) ||
      !Number.isSafeInteger(answer.totalUnansweredConversations) ||
      answer.totalUnansweredConversations < 0 ||
      !Number.isSafeInteger(answer.storesWithUnanswered) ||
      answer.storesWithUnanswered < 0 ||
      !Array.isArray(answer.stores) ||
      answer.stores.length !== answer.storesWithUnanswered ||
      !answer.stores.every(s => typeof s.storeName === "string" && s.storeName.trim() &&
        Number.isSafeInteger(s.notReplied) && s.notReplied > 0) ||
      answer.stores.reduce((sum, s) => sum + s.notReplied, 0) !== answer.totalUnansweredConversations ||
      !answer.dataQuality || answer.dataQuality.status !== "VERIFIED_OPERATIONAL_SNAPSHOT" ||
      answer.dataQuality.timezone !== "Asia/Bangkok" || answer.dataQuality.operationalCoverageStartMonth !== "2026-09" ||
      answer.dataQuality.mirrorFreshnessWindowHours !== 2 ||
      answer.dataQuality.replyProjection !== "CURRENT_FOR_ALL_RETURNED_CONVERSATIONS" ||
      answer.dataQuality.historicalMessageCompleteness !== "NOT_CERTIFIED_BY_RECENT_MIRROR_SYNC" ||
      !dataAsOf || !Number.isFinite(dataAsOf.getTime())) {
    throw new Error("Cannot format unverifiable LINE OA metrics");
  }
  const asOf = new Date(answer.calculatedAt);
  if (!Number.isFinite(asOf.getTime())) throw new Error("Invalid reporting timestamp");
  const timestamp = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(asOf);
  const sourceTimestamp = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(dataAsOf);
  const [year, month] = answer.month.split("-").map(Number);
  const monthLabel = `${THAI_MONTH_NAMES[month - 1]} ${year}`;
  const lines = [
    `เลขาซันน์ | รายงาน LINE OA ${monthLabel}`,
    `แชทค้างตอบ: ${answer.totalUnansweredConversations} บทสนทนา (ตามข้อมูลที่ตรวจสอบได้)`,
    `ร้านที่มีแชทค้างในข้อมูลที่ตรวจสอบได้: ${answer.storesWithUnanswered} ร้าน`,
    `ตรวจข้อมูล ณ ${timestamp} (เวลาไทย)`,
    "แหล่งข้อมูล: LINE OA Monitor และ Reply State Projection",
    "สถานะข้อมูล: Projection สอดคล้อง และ Mirror ล่าสุดในขอบเขตไม่เกิน 2 ชั่วโมง",
    `Mirror sync ล่าสุดในขอบเขต ณ ${sourceTimestamp} (เวลาไทย)`,
    "ขอบเขต Reply Status ที่เชื่อถือได้เริ่มตั้งแต่ กันยายน 2026",
    "หมายเหตุ: การซิงก์ Mirror ล่าสุดไม่รับรองว่าประวัติแชทย้อนหลังครบถ้วน",
  ];
  if (answer.stores.length === 0) lines.push("ไม่มีร้านที่มีแชทค้างตอบตามข้อมูลที่ตรวจสอบได้");
  const shown = answer.stores.slice(0, MAX_STORE_ROWS);
  for (const row of shown) {
    const line = `• ${safeName(row.storeName)}: ${row.notReplied} แชท`;
    if ([...lines, line, "ดูรายละเอียดเพิ่มเติมที่ lineoppo.click"].join("\n").length > MAX_REPLY_LENGTH) break;
    lines.push(line);
  }
  const displayedCount = lines.filter(s => s.startsWith("• ")).length;
  if (displayedCount < answer.stores.length) lines.push(`และอีก ${answer.stores.length - displayedCount} ร้าน — ดูรายละเอียดที่ lineoppo.click`);
  lines.push("หมายเหตุ: นับจำนวนบทสนทนาที่ยังค้างตอบ ไม่ใช่จำนวนข้อความหรือ KPI ตอบใน 24 ชั่วโมง");
  const text = lines.join("\n");
  if (text.length > 5000) throw new Error("LINE reply exceeds platform limit");
  return text;
}
