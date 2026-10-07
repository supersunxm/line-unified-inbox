import type { AppLanguage } from "../../language-utils";

export const lineChatPendingControlText = {
  th: {
    downloadCsv: "ดาวน์โหลด CSV", openChat: "เปิดแชท", noMatch: "ไม่พบคู่ใน LINE",
    startNicknameRun: "เริ่มงานเปลี่ยนชื่อเล่น", startNicknameRunTitle: "เริ่มงานเปลี่ยนชื่อเล่นที่ติดตามสถานะ",
    pauseNicknameRunTitle: "หยุดงานชื่อเล่นเบื้องหลังชั่วคราว งานที่กำลังทำจะทำต่อจนเสร็จ",
    trackedRunTitle: "ติดตามงานเปลี่ยนชื่อเล่น", latestChat: "แชทล่าสุด:", missingLabel: "· ขาด:",
    ambiguous: "พบหลายรายการ", conflict: "ข้อมูล Mapping ขัดแย้ง", cash: "สด",
    installment: "ผ่อน", creditCard: "บัตรเครดิต", ufund: "Ufund", sgFinance: "SG",
    other: "อื่น ๆ", purchased: "ซื้อแล้ว", online: "ออนไลน์", interested: "สนใจ", film: "ฟิล์ม",
  },
  en: {
    downloadCsv: "Download CSV", openChat: "Open chat", noMatch: "No LINE match",
    startNicknameRun: "Start Nickname Run", startNicknameRunTitle: "Start a tracked nickname-change run",
    pauseNicknameRunTitle: "Pause background nickname jobs; let the active job finish",
    trackedRunTitle: "Tracked nickname run", latestChat: "Latest chat:", missingLabel: "· Missing:",
    ambiguous: "Multiple matches", conflict: "Conflicting mapping data", cash: "Cash",
    installment: "Installments", creditCard: "Credit card", ufund: "Ufund", sgFinance: "SG Finance",
    other: "Other", purchased: "Purchased", online: "Online", interested: "Interested", film: "Film",
  },
  zh: {
    downloadCsv: "下载 CSV", openChat: "打开聊天", noMatch: "未找到 LINE 匹配项",
    startNicknameRun: "开始昵称任务", startNicknameRunTitle: "启动可跟踪的昵称更改任务",
    pauseNicknameRunTitle: "暂停后台昵称任务；当前任务会继续完成",
    trackedRunTitle: "跟踪昵称任务", latestChat: "最近聊天：", missingLabel: "· 缺少：",
    ambiguous: "找到多个匹配项", conflict: "映射数据冲突", cash: "现金",
    installment: "分期付款", creditCard: "信用卡", ufund: "Ufund", sgFinance: "SG Finance",
    other: "其他", purchased: "已购买", online: "线上", interested: "感兴趣", film: "贴膜",
  },
} satisfies Record<AppLanguage, Record<string, string>>;

export function getLineChatPendingControlText(language: AppLanguage) {
  return lineChatPendingControlText[language];
}
