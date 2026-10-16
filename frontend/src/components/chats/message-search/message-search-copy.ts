import type { AppLanguage } from "../../../app/language-utils.ts";

export type MessageSearchCopy = {
  pageTitle: string;
  modeLabel: string;
  modeNote: string;
  searchPlaceholder: string;
  keywordHint: string;
  keywordEmpty: string;
  keywordTooShort: string;
  keywordTooLong: string;
  allStores: string;
  selectStores: string;
  storeSearchPlaceholder: string;
  storesSelected: (count: number) => string;
  noStoreMatch: string;
  periodLabel: string;
  preset: (days: number) => string;
  customPeriod: string;
  periodChip: string;
  storeChip: string;
  keywordChip: string;
  removeChip: string;
  clearFilters: string;
  futureDate: string;
  periodTooLong: string;
  periodReversed: string;
  invalidDate: string;
  noResults: string;
  loading: string;
  loadingMore: string;
  loadMore: string;
  searchError: string;
  retry: string;
  sourceLive: string;
  sourceHistorical: string;
  directionInbound: string;
  directionOutbound: string;
  directionSystem: string;
  customerUnknown: string;
  partialDataNote: string;
  accountStatusNote: string;
  disabledTitle: string;
  disabledBody: string;
  syntheticNotice: string;
  backToChats: string;
};

const copy: Record<AppLanguage, MessageSearchCopy> = {
  th: {
    pageTitle: "ค้นหาข้อความ",
    modeLabel: "ค้นหาข้อความ (ตามวันที่ส่งข้อความ)",
    modeNote: "ตัวกรองเดือนของรายการสนทนาไม่ได้ใช้กับการค้นหาข้อความ",
    searchPlaceholder: "พิมพ์คำที่ต้องการค้นหา",
    keywordHint: "พิมพ์อย่างน้อย 2 ตัวอักษร",
    keywordEmpty: "กรุณาพิมพ์คำที่ต้องการค้นหา",
    keywordTooShort: "พิมพ์อย่างน้อย 2 ตัวอักษร",
    keywordTooLong: "คำค้นหาต้องไม่เกิน 100 ตัวอักษร",
    allStores: "ทุกร้าน",
    selectStores: "เลือกร้านค้า",
    storeSearchPlaceholder: "ค้นหาชื่อร้านหรือรหัสร้าน",
    storesSelected: (count) => `เลือก ${count} ร้าน`,
    noStoreMatch: "ไม่พบร้านที่ตรงกับคำค้นหา",
    periodLabel: "ช่วงวันที่",
    preset: (days) => `${days} วัน`,
    customPeriod: "กำหนดเอง",
    periodChip: "วันที่",
    storeChip: "ร้าน",
    keywordChip: "คำค้น",
    removeChip: "ลบตัวกรอง",
    clearFilters: "ล้างตัวกรอง",
    futureDate: "ไม่สามารถเลือกวันในอนาคตได้",
    periodTooLong: "ช่วงวันที่ต้องไม่เกิน 90 วัน",
    periodReversed: "วันสิ้นสุดต้องไม่มาก่อนวันเริ่มต้น",
    invalidDate: "ไม่ใช่วันที่ที่ถูกต้อง",
    noResults: "ไม่พบข้อความ",
    loading: "กำลังค้นหา…",
    loadingMore: "กำลังโหลดเพิ่มเติม…",
    loadMore: "โหลดเพิ่มเติม",
    searchError: "ค้นหาไม่สำเร็จ กรุณาลองอีกครั้ง",
    retry: "ลองอีกครั้ง",
    sourceLive: "ข้อความปัจจุบัน",
    sourceHistorical: "ข้อความประวัติ",
    directionInbound: "ลูกค้า",
    directionOutbound: "พนักงาน",
    directionSystem: "ระบบ",
    customerUnknown: "ไม่ระบุชื่อลูกค้า",
    partialDataNote: "ข้อมูลบางส่วนอาจอยู่ระหว่างการกู้คืน",
    accountStatusNote: "ข้อความจากบัญชี LINE OA ที่ปิดใช้งานหรือถูกเก็บถาวรจะไม่แสดงในผลค้นหา",
    disabledTitle: "ยังไม่เปิดใช้งานการค้นหาข้อความ",
    disabledBody: "ฟีเจอร์นี้ยังไม่เปิดให้ใช้งานในระบบนี้",
    syntheticNotice: "โหมดทดสอบ: แสดงข้อมูลตัวอย่างเท่านั้น",
    backToChats: "กลับไปหน้าแชท",
  },
  en: {
    pageTitle: "Message search",
    modeLabel: "Message search (by message send date)",
    modeNote: "The conversation month filter does not apply to message search.",
    searchPlaceholder: "Type a keyword to search",
    keywordHint: "Type at least 2 characters",
    keywordEmpty: "Enter a keyword to search",
    keywordTooShort: "Type at least 2 characters",
    keywordTooLong: "Keyword must be 100 characters or fewer",
    allStores: "All stores",
    selectStores: "Select stores",
    storeSearchPlaceholder: "Search store name or code",
    storesSelected: (count) => `${count} stores selected`,
    noStoreMatch: "No stores match your search",
    periodLabel: "Date range",
    preset: (days) => `${days}D`,
    customPeriod: "Custom",
    periodChip: "Dates",
    storeChip: "Stores",
    keywordChip: "Keyword",
    removeChip: "Remove filter",
    clearFilters: "Clear filters",
    futureDate: "Future dates cannot be selected",
    periodTooLong: "The date range cannot exceed 90 days",
    periodReversed: "End date cannot be earlier than start date",
    invalidDate: "Not a valid date",
    noResults: "No messages found",
    loading: "Searching…",
    loadingMore: "Loading more…",
    loadMore: "Load more",
    searchError: "Search failed. Please try again.",
    retry: "Retry",
    sourceLive: "Current messages",
    sourceHistorical: "Historical messages",
    directionInbound: "Customer",
    directionOutbound: "Staff",
    directionSystem: "System",
    customerUnknown: "Unknown customer",
    partialDataNote: "Some data may still be recovering",
    accountStatusNote: "Messages from disabled or archived LINE OA accounts are not shown in search results.",
    disabledTitle: "Message search is not enabled",
    disabledBody: "This feature is not enabled for this environment.",
    syntheticNotice: "Test mode: showing sample data only",
    backToChats: "Back to chats",
  },
  zh: {
    pageTitle: "消息搜索",
    modeLabel: "消息搜索（按消息发送日期）",
    modeNote: "会话月份筛选不适用于消息搜索。",
    searchPlaceholder: "输入要搜索的关键词",
    keywordHint: "至少输入 2 个字符",
    keywordEmpty: "请输入要搜索的关键词",
    keywordTooShort: "至少输入 2 个字符",
    keywordTooLong: "关键词不能超过 100 个字符",
    allStores: "全部门店",
    selectStores: "选择门店",
    storeSearchPlaceholder: "搜索门店名称或编号",
    storesSelected: (count) => `已选择 ${count} 家门店`,
    noStoreMatch: "没有匹配的门店",
    periodLabel: "日期范围",
    preset: (days) => `${days}天`,
    customPeriod: "自定义",
    periodChip: "日期",
    storeChip: "门店",
    keywordChip: "关键词",
    removeChip: "移除筛选",
    clearFilters: "清除筛选",
    futureDate: "不能选择未来日期",
    periodTooLong: "日期范围不能超过 90 天",
    periodReversed: "结束日期不能早于开始日期",
    invalidDate: "日期无效",
    noResults: "未找到消息",
    loading: "正在搜索…",
    loadingMore: "正在加载更多…",
    loadMore: "加载更多",
    searchError: "搜索失败，请重试。",
    retry: "重试",
    sourceLive: "当前消息",
    sourceHistorical: "历史消息",
    directionInbound: "客户",
    directionOutbound: "员工",
    directionSystem: "系统",
    customerUnknown: "未知客户",
    partialDataNote: "部分数据可能仍在恢复中",
    accountStatusNote: "已停用或已归档的 LINE OA 账号消息不会显示在搜索结果中。",
    disabledTitle: "尚未启用消息搜索",
    disabledBody: "此环境尚未开放该功能。",
    syntheticNotice: "测试模式：仅显示示例数据",
    backToChats: "返回聊天",
  },
};

export function messageSearchCopy(language: AppLanguage): MessageSearchCopy {
  return copy[language];
}
