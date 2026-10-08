import type { SecretaryMonthlyAnswer } from "./sunn-secretary-monthly";

/** LINE text message max 5000 chars. Budget below the limit for safety. */
const MAX_REPLY_LENGTH = 4500;
const MAX_STORE_ROWS = 30;

function safeName(value: string): string {
  return value.replace(/[\r\n\t\u0000-\u001f\u007f]/gu, " ").trim().slice(0, 100);
}
export function formatSunnMonthlyReply(answer: SecretaryMonthlyAnswer): string {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/u.test(answer.month) ||
      !Number.isSafeInteger(answer.totalUnansweredConversations) ||
      answer.totalUnansweredConversations < 0 ||
      !Number.isSafeInteger(answer.storesWithUnanswered) ||
      answer.storesWithUnanswered < 0 ||
      !Array.isArray(answer.stores) ||
      answer.stores.length !== answer.storesWithUnanswered ||
      !answer.stores.every(s => typeof s.storeName === "string" && s.storeName.trim() &&
        Number.isSafeInteger(s.notReplied) && s.notReplied > 0) ||
      answer.stores.reduce((sum, s) => sum + s.notReplied, 0) !== answer.totalUnansweredConversations) {
    throw new Error("Cannot format unverifiable LINE OA metrics");
  }
  const asOf = new Date(answer.calculatedAt);
  if (!Number.isFinite(asOf.getTime())) throw new Error("Invalid reporting timestamp");
  const timestamp = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(asOf);
  const lines = [
    `เลขาซันน์ | รายงาน LINE OA ${answer.month}`,
    `แชทค้างตอบทั้งหมด: ${answer.totalUnansweredConversations} บทสนทนา`,
    `ร้านที่มีแชทค้าง: ${answer.storesWithUnanswered} ร้าน`,
    `ตรวจข้อมูล ณ ${timestamp} (เวลาไทย)`,
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
