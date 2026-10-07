import type { AppLanguage } from "../language-utils";

export const needActionQueueFallbackText: Record<AppLanguage, {
  pendingChats: (count: number) => string;
  pendingConversations: (count: number) => string;
  highTrafficStore: string;
  highSlaRisk: string;
  reviewEveningManpower: string;
}> = {
  th: {
    pendingChats: (count) => `แชทที่รอดำเนินการ ${count} รายการ`,
    pendingConversations: (count) => `บทสนทนาที่รอดำเนินการ ${count} รายการ`,
    highTrafficStore: "ร้านที่มีปริมาณแชทสูง",
    highSlaRisk: "มีความเสี่ยงสูงที่จะไม่เป็นไปตาม SLA",
    reviewEveningManpower: "ตรวจสอบกำลังคนช่วงเย็น",
  },
  en: {
    pendingChats: (count) => `${count} pending chats`,
    pendingConversations: (count) => `${count} Pending Conversations`,
    highTrafficStore: "High traffic store",
    highSlaRisk: "High SLA Risk",
    reviewEveningManpower: "Review evening manpower",
  },
  zh: {
    pendingChats: (count) => `${count} 个待处理聊天`,
    pendingConversations: (count) => `${count} 条待处理对话`,
    highTrafficStore: "高流量门店",
    highSlaRisk: "SLA 违约风险高",
    reviewEveningManpower: "检查晚间人力安排",
  },
};
